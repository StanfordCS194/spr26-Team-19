"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CompletionModal } from "@/components/completion-modal";
import { PythonCodeEditor } from "@/components/python-code";
import { canonicalizeTopic } from "@/lib/numpy-learning-path";
import { saveNumpyPlacement } from "@/lib/numpy-placement-storage";
import { awardXPWithResult, XP_AWARD } from "@/lib/xp-store";
import { XPToast } from "@/components/xp-toast";
import { BadgeToast } from "@/components/badge-toast";
import { checkStreakBadge, checkTierBadge, tryAwardBadge, type Badge } from "@/lib/achievements";
import { runAndValidateChallenge } from "@/lib/numpy-code-validate";
import { ensurePyodideWorker } from "@/lib/pyodide-web-worker";
import { MINIMAL_STARTER_CODE } from "@/lib/numpy-starter-code";

type PlacementResult = {
  level: string;
  mcqScore: number;
  totalMcq: number;
  codeScore: number;
  totalCode: number;
  recommendedTopic: string | null;
};

// Generic shape for each multiple-choice question used in the MCQ stage.
type PlacementQuestion = {
  prompt: string;
  topic: string; 
  difficulty: Difficulty;
  choices: string[];
  correctIndex: number;
  explanation: string;
  hint: string; 
};
type AnsweredQuestion = PlacementQuestion & { //Added to track user answer for adaptive logic
  chosenIndex: number;
  isCorrect: boolean;
};

// MCQ count + short code tasks (see placementCodingChallenges) make up the full placement.
const TOTAL_MCQ = 4;
const TOTAL_CODE = 4;

type PlacementCodingChallenge = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  starterCode: string;
  expectedOutputs: string[];
  hint: string;
};

/** Placement-only tasks: same runner contract as basics quiz (`answer`, repr compare). */
const placementCodingChallenges: PlacementCodingChallenge[] = [
  {
    id: "placement-mask-then-sum",
    topic: "indexing",
    difficulty: "medium",
    prompt: `Multi-step: build a 3×4 array containing 0 through 11 in row-major order.

1) Make a copy so the original array is unchanged.
2) On that copy, set every value strictly greater than 8 to 0.
3) Set \`answer\` to the sum of all entries in the modified copy.`,
    starterCode: MINIMAL_STARTER_CODE,
    expectedOutputs: ["np.int64(36)", "36"],
    hint: "Duplicating the array first avoids side effects; then think how to target elements above a cutoff and collapse the grid to one number.",
  },
  {
    id: "placement-diagonal-pipeline",
    topic: "shape ops",
    difficulty: "medium",
    prompt: `Multi-step: build a 3×3 matrix with values 1 through 9 in row-major order.

1) Extract its main diagonal as a 1D array.
2) Multiply every element of that diagonal by 2.
3) Reverse the resulting vector (last element first).
4) Set \`answer\` to that final 1D array.`,
    starterCode: MINIMAL_STARTER_CODE,
    expectedOutputs: ["array([18,10,2])"],
    hint: "There is a dedicated way to read the main diagonal; afterward you are doing element-wise math on a 1D array, then reversing index order.",
  },
  {
    id: "placement-slice-sum",
    topic: "slicing",
    difficulty: "easy",
    prompt: `Build a 1D array with values 5, 10, 15, 20, 25, and 30.

1) Slice out the middle four values (10, 15, 20, 25).
2) Set \`answer\` to the sum of that slice.`,
    starterCode: MINIMAL_STARTER_CODE,
    expectedOutputs: ["np.int64(70)", "70"],
    hint: "A slice keeps the start index and stops before the end index; then reduce the slice to one number.",
  },
  {
    id: "placement-mean-of-evens",
    topic: "boolean indexing",
    difficulty: "medium",
    prompt: `Build a 1D array with values 3, 8, 5, 12, 7, and 6.

1) Keep only the even values using a boolean mask.
2) Set \`answer\` to the mean of those even values.`,
    starterCode: MINIMAL_STARTER_CODE,
    expectedOutputs: ["np.float64(8.666666666666666)", "8.666666666666666"],
    hint: "A comparison like values % 2 == 0 builds a mask; index with it, then take the mean.",
  },
];

// Local fallback bank — used when LLM generation fails, rate-limits, or produces a duplicate.
// Covers a wide range of beginner NumPy topics so repeated fallback draws vary.
const fallbackMcqBank: PlacementQuestion[] = [
  {
    prompt: "What does `arr[2]` return for a 1D NumPy array?",
    topic: "indexing",
    difficulty: "easy",
    choices: [
      "A single element at position 2",
      "All elements from 0 to 2",
      "A tuple with shape information",
      "A sorted copy of the array",
    ],
    correctIndex: 0,
    explanation: "Indexing with one integer returns one element at that position.",
    hint: "One integer in brackets selects a single position, not a range.",
  },
  {
    prompt: "Given `arr = np.array([5, 10, 15, 20])`, what does `arr[1:3]` return?",
    topic: "slicing",
    difficulty: "easy",
    choices: ["array([5, 10])", "array([10, 15])", "array([10, 15, 20])", "array([15, 20])"],
    correctIndex: 1,
    explanation: "Slices include the start index and exclude the end, so indices 1 and 2.",
    hint: "The left bound is inclusive, the right bound is exclusive.",
  },
  {
    prompt: "For a 1D array with 6 elements, what is `arr.shape`?",
    topic: "array shape",
    difficulty: "easy",
    choices: ["(6)", "(6,)", "(1, 6)", "6"],
    correctIndex: 1,
    explanation: "A 1D NumPy array shape is the tuple `(n,)` — the trailing comma distinguishes it from an integer.",
    hint: "NumPy shapes are always tuples, even for a single axis.",
  },
  {
    prompt: "Which expression returns the last two elements of `arr`?",
    topic: "slicing",
    difficulty: "easy",
    choices: ["arr[:2]", "arr[2:]", "arr[-2:]", "arr[-1]"],
    correctIndex: 2,
    explanation: "`arr[-2:]` slices from the second-to-last element to the end.",
    hint: "Negative indices count backwards from the end of the array.",
  },
  {
    prompt: "Which function returns a sorted copy of array `a` without modifying it?",
    topic: "numpy functions",
    difficulty: "easy",
    choices: ["a.sortcopy()", "np.sort(a)", "np.order(a)", "a.sorted()"],
    correctIndex: 1,
    explanation: "`np.sort(a)` returns a new sorted array and leaves `a` unchanged.",
    hint: "Look for the standard NumPy function — some options are misspelled on purpose.",
  },
  {
    prompt: "What does `np.zeros((3, 4))` produce?",
    topic: "array creation",
    difficulty: "easy",
    choices: [
      "A 1D array of twelve zeros",
      "A 3×4 array filled with zeros",
      "A 3×4 array filled with ones",
      "An error — zeros takes an integer, not a tuple",
    ],
    correctIndex: 1,
    explanation: "`np.zeros` accepts a shape tuple and creates an array of that shape filled with 0.0.",
    hint: "The argument is the shape you want, described as a tuple of dimensions.",
  },
  {
    prompt: "What is the output of `np.arange(0, 10, 2)`?",
    topic: "array creation",
    difficulty: "easy",
    choices: [
      "array([0, 2, 4, 6, 8])",
      "array([0, 2, 4, 6, 8, 10])",
      "array([2, 4, 6, 8])",
      "array([0, 1, 2, 3, 4])",
    ],
    correctIndex: 0,
    explanation: "`np.arange(start, stop, step)` — stop is exclusive, so 10 is not included.",
    hint: "Like Python's range: start included, stop excluded, step controls the gap.",
  },
  {
    prompt: "What is `arr.ndim` for `arr = np.array([[1, 2], [3, 4]])`?",
    topic: "array attributes",
    difficulty: "easy",
    choices: ["1", "2", "4", "(2, 2)"],
    correctIndex: 1,
    explanation: "`ndim` counts the number of axes (dimensions). A 2D matrix has 2.",
    hint: "Count the number of nested lists you need to describe the structure.",
  },
  {
    prompt: "Which call reshapes a 12-element 1D array into a 3×4 matrix?",
    topic: "shapes",
    difficulty: "medium",
    choices: [
      "arr.reshape(3, 4)",
      "arr.resize(3, 4)",
      "arr.shape(3, 4)",
      "np.reshape(arr, 12)",
    ],
    correctIndex: 0,
    explanation: "`arr.reshape(3, 4)` returns a view with the new shape without changing data.",
    hint: "The method name describes what it does; the argument is the target shape.",
  },
  {
    prompt: "Given `a = np.array([1, 2, 3])`, what does `a * 2` return?",
    topic: "array operations",
    difficulty: "easy",
    choices: [
      "array([1, 2, 3, 1, 2, 3])",
      "array([2, 4, 6])",
      "array([1, 4, 9])",
      "6",
    ],
    correctIndex: 1,
    explanation: "NumPy applies scalar operations element-wise, so each element is multiplied by 2.",
    hint: "NumPy arithmetic operates element-by-element, not like Python lists.",
  },
  {
    prompt: "What does `arr.sum()` compute?",
    topic: "aggregation",
    difficulty: "easy",
    choices: [
      "The maximum value",
      "The sum of all elements",
      "The number of elements",
      "The mean of all elements",
    ],
    correctIndex: 1,
    explanation: "`arr.sum()` sums every element in the array and returns a scalar.",
    hint: "The method name is the aggregation it performs.",
  },
  {
    prompt: "What does `arr[arr > 5]` return for `arr = np.array([3, 6, 2, 8, 1])`?",
    topic: "boolean indexing",
    difficulty: "medium",
    choices: [
      "array([True, False, True, False, True])",
      "array([6, 8])",
      "array([3, 2, 1])",
      "array([False, True, False, True, False])",
    ],
    correctIndex: 1,
    explanation: "Boolean indexing filters the array — only elements where the condition is True are returned.",
    hint: "The condition creates a mask; applying that mask to the array selects matching elements.",
  },
  {
    prompt: "What is the shape of `np.array([[1, 2, 3], [4, 5, 6]])`?",
    topic: "array shape",
    difficulty: "easy",
    choices: ["(6,)", "(3, 2)", "(2, 3)", "(1, 2, 3)"],
    correctIndex: 2,
    explanation: "Two rows of three columns → shape (2, 3). First dimension is rows, second is columns.",
    hint: "Count the outer lists for the first dimension, and the inner list length for the second.",
  },
  {
    prompt: "What does `arr.T` do to a 2D array?",
    topic: "transpose",
    difficulty: "medium",
    choices: [
      "Flattens it to 1D",
      "Reverses the element order",
      "Swaps rows and columns",
      "Doubles each element",
    ],
    correctIndex: 2,
    explanation: "`.T` is the transpose attribute — it swaps the axes so rows become columns.",
    hint: "Transposing flips the matrix over its diagonal.",
  },
  {
    prompt: "What does `np.mean(arr)` return for `arr = np.array([2, 4, 6, 8])`?",
    topic: "aggregation",
    difficulty: "easy",
    choices: ["4", "4.0", "5.0", "20"],
    correctIndex: 2,
    explanation: "(2+4+6+8)/4 = 20/4 = 5.0. `np.mean` returns a float.",
    hint: "Add all the values, then divide by how many there are.",
  },
];

// Expected response shape from /api/generate-question endpoint.
type GeneratedQuestionResponse = {
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
};

type Difficulty = "easy" | "medium" | "hard";

type placementGenerationRequest = {
  difficulty: Difficulty;
  previousTopic?: string;
  focusTopic?: string;
  seenPrompts?: string[];
};
/**
 * Compute final placement level from MCQ history and code challenge results.
 *
 * Updated for the 4-MCQ + 4-code format: with fewer MCQs the adaptive engine
 * rarely reaches "hard" difficulty, so hard-correct counts alone can't be the
 * deciding gate. Code first-try accuracy is now the primary signal for
 * Advanced/Intermediate because the four coding challenges cover a meaningful
 * breadth of NumPy skills (boolean indexing, shape ops, slicing, aggregation).
 *
 * Thresholds are deliberately lower than the old 8-MCQ version because the
 * total sample is smaller and we'd rather place a borderline learner at
 * Intermediate (and let them progress) than keep them at Beginner.
 */
function computeFinalLevel(
  mcqHistory: AnsweredQuestion[],
  codeFirstTryPassed: number,
  totalCode: number,
): string {
  const totalSlots = mcqHistory.length + totalCode;
  if (totalSlots === 0) return "Beginner";

  const mcqCorrect = mcqHistory.filter((a) => a.isCorrect).length;
  const correct = mcqCorrect + codeFirstTryPassed;
  const overallAccuracy = correct / totalSlots;

  // Code-only accuracy (0–1) — first-try passes reflect genuine mastery.
  const codeAccuracy = totalCode > 0 ? codeFirstTryPassed / totalCode : 0;

  // Hard MCQ signals (may be 0 if adaptive difficulty never reached "hard").
  const hardAttempts = mcqHistory.filter((a) => a.difficulty === "hard");
  const hardAccuracy =
    hardAttempts.length > 0
      ? hardAttempts.filter((a) => a.isCorrect).length / hardAttempts.length
      : 0;
  const hardCorrect = hardAttempts.filter((a) => a.isCorrect).length;

  // Advanced: strong overall + at least 3/4 code first-try, or hard MCQ evidence.
  if (overallAccuracy >= 0.75 && codeAccuracy >= 0.75) return "Advanced";
  if (overallAccuracy >= 0.75 && hardCorrect >= 1 && hardAccuracy >= 0.8) return "Advanced";

  // Intermediate: solid overall + at least half the code challenges first-try,
  // or demonstrated ability on hard MCQs.
  if (overallAccuracy >= 0.6 && codeAccuracy >= 0.5) return "Intermediate";
  if (overallAccuracy >= 0.6 && hardCorrect >= 1) return "Intermediate";

  return "Beginner";
}



export default function FindMyLevelPage() {
  const [phase, setPhase] = useState<"mcq" | "code">("mcq");
  // 2-slot + buffer pipeline:
  // - currentQuestion: visible now
  // - prefetchedQuestion: next question ready immediately
  // - bufferedQuestion: newly generated in background after answer selection
  const [currentQuestion, setCurrentQuestion] = useState<PlacementQuestion>(fallbackMcqBank[0]!);
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<PlacementQuestion>(
    fallbackMcqBank[1] ?? fallbackMcqBank[0]!,
  );
  const [bufferedQuestion, setBufferedQuestion] = useState<PlacementQuestion | null>(null);
  // Track prompts to reduce duplicates from model generation.
  const [seenPrompts, setSeenPrompts] = useState<string[]>([
    fallbackMcqBank[0]!.prompt,
    (fallbackMcqBank[1] ?? fallbackMcqBank[0]!).prompt,
  ]);
  // Status for generation source visibility in UI.
  const [isPrefetchingMcq, setIsPrefetchingMcq] = useState(false);
  const [mcqGenerationStatus, setMcqGenerationStatus] = useState<
    "idle" | "generated" | "fallback"
  >("idle");
  // MCQ stage state.
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [mcqScore, setMcqScore] = useState(0);
  const [history, setHistory] = useState<AnsweredQuestion[]>([]); // Added to track user answers for adaptive logic

  const [codeIndex, setCodeIndex] = useState(0);
  const [firstTryPassedIds, setFirstTryPassedIds] = useState<string[]>([]);
  const [xpClaimedCodeIds, setXpClaimedCodeIds] = useState<string[]>([]);
  const [completion, setCompletion] = useState<PlacementResult | null>(null);
  const [challengeAttempts, setChallengeAttempts] = useState<Record<string, number>>({});
  const [codeInput, setCodeInput] = useState(MINIMAL_STARTER_CODE);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");
  const canRunPython = !pyodideLoading && !pyodideError;
  const [xpToast, setXpToast] = useState<{ amount: number; levelUpTier?: { name: string; icon: string } } | null>(null);
  const [badgeToast, setBadgeToast] = useState<Badge | null>(null);

  const question = currentQuestion; // Alias for readability in JSX.
  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;
  const isLastQuestion = index === TOTAL_MCQ - 1;
  const codeChallenge = placementCodingChallenges[codeIndex]!;

  useEffect(() => {
    let cancelled = false;
    void ensurePyodideWorker()
      .then(() => {
        if (!cancelled) setPyodideLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setPyodideError(
            error instanceof Error ? error.message : "Failed to initialize code runner.",
          );
          setPyodideLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keyboard shortcuts: 1-4 selects an answer, Enter advances after answering
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "mcq") return;
      if (e.key === "Enter" && hasAnswered) {
        if (!isLastQuestion) handleNext();
        else moveToCodingStage();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 4 && !hasAnswered) {
        handleSelect(num - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hasAnswered, isLastQuestion, index]);

  function getWeakTopics() {
    const merged = new Map<string, number>();
    for (const [topic, count] of Object.entries(topicMistakes)) {
      const label = canonicalizeTopic(topic);
      merged.set(label, (merged.get(label) ?? 0) + count);
    }
    return [...merged.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic);
  }
  
  function getRecommendedTopic() {
    const weakTopics = getWeakTopics();
    return weakTopics.length > 0 ? weakTopics[0] : null;
  }
  //Hint State 
  const [showHint, setShowHint] = useState(false);
  const [showCodeHint, setShowCodeHint] = useState(false);
  //Mistake tracker 
  const [topicMistakes, setTopicMistakes] = useState<Record<string, number>>({});

  function buildAdaptiveGenerationRequest(
    existingPrompts: Set<string>,
    answerWasCorrect?: boolean,
  ): placementGenerationRequest {
    const projectedMistakes = { ...topicMistakes };
    if (answerWasCorrect === false) {
      projectedMistakes[question.topic] = (projectedMistakes[question.topic] ?? 0) + 1;
    }
    const weakTopic = Object.entries(projectedMistakes).sort((a, b) => b[1] - a[1])[0]?.[0];
    const attemptedCount = index + (answerWasCorrect === undefined ? 0 : 1);
    const projectedScore = mcqScore + (answerWasCorrect ? 1 : 0);
    const projectedAccuracy = attemptedCount === 0 ? 1 : projectedScore / attemptedCount;

    let difficulty: Difficulty;
    if (attemptedCount < 2 || projectedAccuracy < 0.7) {
      difficulty = "easy";
    } else if (projectedAccuracy >= 0.85 && attemptedCount >= 4) {
      difficulty = "hard";
    } else {
      difficulty = "medium";
    }

    return {
      difficulty,
      previousTopic: question.topic,
      focusTopic: weakTopic,
      seenPrompts: [...existingPrompts],
    };
  }

  


  function getFallbackQuestion(existingPrompts: Set<string>): PlacementQuestion {
    // Prefer unseen fallback prompts first, otherwise rotate deterministically.
    const candidate = fallbackMcqBank.find((item) => !existingPrompts.has(item.prompt));
    if (candidate) return candidate;
    return fallbackMcqBank[existingPrompts.size % fallbackMcqBank.length]!;
  }

  async function fetchGeneratedMcq(
    existingPrompts: Set<string>,
    generationRequest: placementGenerationRequest,
  ): Promise<{ question: PlacementQuestion; source: "generated" | "fallback" }> {
    try {
      // MCQ generation is delegated to server endpoint (which calls provider model).
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generationRequest),
      });
      if (!response.ok) throw new Error("MCQ generation request failed");
      const payload = (await response.json()) as GeneratedQuestionResponse;
      if (
        !payload ||
        typeof payload.topic !== "string" ||
        (payload.difficulty !== "easy" &&
          payload.difficulty !== "medium" &&
          payload.difficulty !== "hard") ||
        typeof payload.prompt !== "string" ||
        !Array.isArray(payload.choices) ||
        payload.choices.length !== 4 ||
        typeof payload.correctIndex !== "number" ||
        payload.correctIndex < 0 ||
        payload.correctIndex > 3 ||
        typeof payload.explanation !== "string"
      ) {
        throw new Error("Invalid MCQ payload");
      }
      const generated: PlacementQuestion = {
        topic: payload.topic,
        difficulty: payload.difficulty, 
        prompt: payload.prompt,
        choices: payload.choices.map(String),
        correctIndex: payload.correctIndex,
        explanation: payload.explanation,
        hint: payload.hint?.trim() || "Eliminate answers that contradict how NumPy usually behaves, then re-read the question.",
      };



      // If duplicate prompt appears, fall back to local question for variety.
      if (existingPrompts.has(generated.prompt)) {
        return { question: getFallbackQuestion(existingPrompts), source: "fallback" };
      }
      return { question: generated, source: "generated" };
    } catch {
      // Any provider/network/schema failure gracefully downgrades to fallback.
      return { question: getFallbackQuestion(existingPrompts), source: "fallback" };
    }
  }

  async function prefetchBufferedMcq(answerWasCorrect?: boolean) {
    if (phase !== "mcq" || isLastQuestion || isPrefetchingMcq) return;
    setIsPrefetchingMcq(true);
    const existingPrompts = new Set(seenPrompts);
    const result = await fetchGeneratedMcq(
      existingPrompts,
      buildAdaptiveGenerationRequest(existingPrompts, answerWasCorrect),
    );
    const nextQuestion = result.question;
    setBufferedQuestion(nextQuestion);
    setMcqGenerationStatus(result.source);
    setSeenPrompts((prev) =>
      prev.includes(nextQuestion.prompt) ? prev : [...prev, nextQuestion.prompt],
    );
    setIsPrefetchingMcq(false);
  }

  function handleSelect(choiceIndex: number) {
    // Lock answer after first selection to avoid double-scoring.
    if (phase !== "mcq" || hasAnswered) return;
    setSelected(choiceIndex);
    const answerWasCorrect = choiceIndex === question.correctIndex;
    setHistory((prev) => [
      ...prev,
      { ...question, chosenIndex: choiceIndex, isCorrect: answerWasCorrect },
    ]);
    if (answerWasCorrect) {
      setMcqScore((prev) => prev + 1);
      const r = awardXPWithResult("mcq_correct");
      setXpToast({ amount: XP_AWARD.mcq_correct, ...(r.leveledUp ? { levelUpTier: r.newTier } : {}) });
      // First-correct badge + tier/streak checks
      setBadgeToast((prev) => prev ?? tryAwardBadge("first-correct") ?? checkTierBadge(r.newTier.minXP) ?? checkStreakBadge(0));
    } else {
      setTopicMistakes((prev) => ({
        ...prev,
        [question.topic]: (prev[question.topic] || 0) + 1,
      }));
    }
    void prefetchBufferedMcq(answerWasCorrect);
  }

  function handleNext() {
    if (phase !== "mcq" || isLastQuestion) return;
    setSelected(null);
    const existingPrompts = new Set(seenPrompts);
    // Promote prefetched -> current immediately for snappy UX.
    const nextCurrent = prefetchedQuestion ?? getFallbackQuestion(existingPrompts);
    // Promote buffered -> prefetched for next hop in the pipeline.
    const nextPrefetched =
      bufferedQuestion ?? getFallbackQuestion(new Set([...existingPrompts, nextCurrent.prompt]));
    setCurrentQuestion(nextCurrent);
    setPrefetchedQuestion(nextPrefetched);
    setSeenPrompts((prev) => {
      const next = [...prev];
      if (!next.includes(nextCurrent.prompt)) next.push(nextCurrent.prompt);
      if (!next.includes(nextPrefetched.prompt)) next.push(nextPrefetched.prompt);
      return next;
    });
    setBufferedQuestion(null);
    setMcqGenerationStatus("idle");
    setIndex((prev) => prev + 1);
    setShowHint(false);
  }

  /**
   * Skip the current MCQ without answering. Counts the topic as a miss so the
   * adaptive engine knows to revisit it, but does not penalise the score.
   * Requested in user testing: "skip questions if you don't know the answer."
   */
  function handleSkip() {
    if (phase !== "mcq" || hasAnswered) return;
    // Log as a topic weakness so post-placement recommendations stay accurate.
    setTopicMistakes((prev) => ({
      ...prev,
      [question.topic]: (prev[question.topic] ?? 0) + 1,
    }));
    setHistory((prev) => [
      ...prev,
      { ...question, chosenIndex: -1, isCorrect: false },
    ]);
    if (isLastQuestion) {
      moveToCodingStage();
    } else {
      handleNext();
    }
  }

  function moveToCodingStage() {
    setPhase("code");
    setSelected(null);
    setCodeIndex(0);
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
    setShowHint(false);
    setShowCodeHint(false);
    setFirstTryPassedIds([]);
    setChallengeAttempts({});
  }

  async function runCodeChallenge() {
    if (!canRunPython) return;
    setRunStatus("running");
    setRunMessage("Running code...");
    const attemptsSoFar = challengeAttempts[codeChallenge.id] ?? 0;
    setChallengeAttempts((prev) => ({ ...prev, [codeChallenge.id]: attemptsSoFar + 1 }));

    try {
      const outcome = await runAndValidateChallenge(codeInput, {
        expectedOutputs: codeChallenge.expectedOutputs,
      });
      const passed = outcome.passed;
      setRunStatus(passed ? "pass" : "fail");
      const printLine = outcome.stdout.trim()
        ? ` Program output: ${outcome.stdout.trim()}`
        : "";
      setRunMessage(`${outcome.message}${printLine}`);
      if (passed) {
        if (!xpClaimedCodeIds.includes(codeChallenge.id)) {
          setXpClaimedCodeIds((prev) => [...prev, codeChallenge.id]);
          if (attemptsSoFar === 0) {
            setFirstTryPassedIds((prev) => {
              if (prev.includes(codeChallenge.id)) return prev;
              return [...prev, codeChallenge.id];
            });
            const r1 = awardXPWithResult("code_first_try");
            setXpToast({
              amount: XP_AWARD.code_first_try,
              ...(r1.leveledUp ? { levelUpTier: r1.newTier } : {}),
            });
            setBadgeToast((prev) => prev ?? tryAwardBadge("first-code") ?? checkTierBadge(r1.newTier.minXP));
          } else {
            const r2 = awardXPWithResult("code_pass");
            setXpToast({
              amount: XP_AWARD.code_pass,
              ...(r2.leveledUp ? { levelUpTier: r2.newTier } : {}),
            });
            setBadgeToast((prev) => prev ?? checkTierBadge(r2.newTier.minXP));
          }
        }
      } else if (attemptsSoFar === 0) {
        setTopicMistakes((prev) => ({
          ...prev,
          [codeChallenge.topic]: (prev[codeChallenge.topic] || 0) + 1,
        }));
      }
    } catch (error) {
      setRunStatus("fail");
      setRunMessage(
        error instanceof Error ? `Execution error: ${error.message}` : "Execution failed.",
      );
    }
  }

  function nextCodeChallenge() {
    if (codeIndex === placementCodingChallenges.length - 1) return;
    const nextIndex = codeIndex + 1;
    setCodeIndex(nextIndex);
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
    setShowCodeHint(false);
  }

  function handleRestart() {
    setPhase("mcq");
    setCurrentQuestion(fallbackMcqBank[0]!);
    setPrefetchedQuestion(fallbackMcqBank[1] ?? fallbackMcqBank[0]!);
    setBufferedQuestion(null);
    setSeenPrompts([fallbackMcqBank[0]!.prompt, (fallbackMcqBank[1] ?? fallbackMcqBank[0]!).prompt]);
    setIsPrefetchingMcq(false);
    setMcqGenerationStatus("idle");
    setIndex(0);
    setSelected(null);
    setMcqScore(0);
    setShowHint(false);
    setShowCodeHint(false);
    setTopicMistakes({});
    setHistory([]);
    setCodeIndex(0);
    setFirstTryPassedIds([]);
    setChallengeAttempts({});
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
  }
  function goToPlacementHub() {
    const level = computeFinalLevel(history, firstTryPassedIds.length, TOTAL_CODE);
    const recommendedTopic = getRecommendedTopic();
    saveNumpyPlacement({
      level,
      weakTopics: getWeakTopics(),
      recommendedTopic,
      mcqScore,
      totalMcq: TOTAL_MCQ,
      codeScore: firstTryPassedIds.length,
      totalCode: TOTAL_CODE,
      completedAt: new Date().toISOString(),
    });
    const rp = awardXPWithResult("placement_complete");
    setXpToast({ amount: XP_AWARD.placement_complete, ...(rp.leveledUp ? { levelUpTier: rp.newTier } : {}) });
    setBadgeToast((prev) => prev ?? tryAwardBadge("placed") ?? checkTierBadge(rp.newTier.minXP));
    setCompletion({
      level,
      mcqScore,
      totalMcq: TOTAL_MCQ,
      codeScore: firstTryPassedIds.length,
      totalCode: TOTAL_CODE,
      recommendedTopic,
    });
  }

  const totalSteps = TOTAL_MCQ + TOTAL_CODE;
  const completedSteps =
    phase === "mcq"
      ? index + (hasAnswered ? 1 : 0)
      : TOTAL_MCQ + codeIndex + (runStatus === "pass" ? 1 : 0);
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Find my level</h1>
          <button
            type="button"
            className="text-sm text-blue-600 underline hover:text-blue-800"
            onClick={handleRestart}
          >
            Start over
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {TOTAL_MCQ} multiple-choice questions and {TOTAL_CODE} short coding tasks, then open your
          personalized path and exercise zone.
        </p>

        {/* Unified progress bar spanning MCQ + code phases */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>
              {phase === "mcq"
                ? `Question ${index + 1} of ${TOTAL_MCQ}`
                : `Code challenge ${codeIndex + 1} of ${TOTAL_CODE}`}
            </span>
            <span className="font-semibold">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {phase === "mcq" && (
          <>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {isPrefetchingMcq
                  ? "Preparing next question…"
                  : mcqGenerationStatus === "generated"
                    ? "AI-generated question"
                    : mcqGenerationStatus === "fallback"
                      ? "Fallback question"
                      : ""}
              </p>
              <p className="text-xs text-slate-300">Press 1–4 to select · Enter to continue</p>
            </div>

            <h2 className="mt-6 text-xl font-semibold text-gray-900">{question.prompt}</h2>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!showHint ? (
                <button
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                  onClick={() => setShowHint(true)}
                  disabled={hasAnswered}
                >
                  Show hint
                </button>
              ) : (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 flex-1">
                  <p className="text-sm font-medium text-yellow-800">Hint</p>
                  <p className="mt-1 text-sm text-gray-800">{question.hint}</p>
                </div>
              )}
              {!hasAnswered && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 hover:underline"
                  onClick={handleSkip}
                  title="Skip this question — it will be marked as a weak topic"
                >
                  Skip question
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {question.choices.map((choice, choiceIndex) => {
                let style = "border-gray-300 hover:bg-gray-100 text-gray-900";
                if (hasAnswered) {
                  if (choiceIndex === question.correctIndex) {
                    style = "border-green-500 bg-green-100 text-gray-900";
                  } else if (choiceIndex === selected) {
                    style = "border-red-500 bg-red-100 text-gray-900";
                  } else {
                    style = "border-gray-200 text-gray-500";
                  }
                }

                return (
                  <button
                    key={choiceIndex}
                    className={`text-left p-4 border-2 rounded-md transition ${style}`}
                    onClick={() => handleSelect(choiceIndex)}
                    disabled={hasAnswered}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {hasAnswered && (
              <div className="mt-5">
                <p className={`font-semibold ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                  {isCorrect ? "Correct!" : "Not quite."}
                </p>
                <p className="mt-1 text-sm text-gray-700">{question.explanation}</p>
                {!isLastQuestion ? (
                  <button
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={handleNext}
                  >
                    Next question
                  </button>
                ) : (
                  <div className="mt-4">
                    <p className="text-gray-800">
                      MCQ score: {mcqScore} / {TOTAL_MCQ}
                    </p>
                    <button
                      type="button"
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={moveToCodingStage}
                    >
                      Continue to code challenges
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {phase === "code" && (
          <>
            <h2 className="mt-6 text-xl font-semibold text-gray-900">Run real NumPy code</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{codeChallenge.prompt}</p>

            <div className="mt-3">
              {!showCodeHint ? (
                <button
                  type="button"
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                  onClick={() => setShowCodeHint(true)}
                  disabled={runStatus === "running"}
                >
                  Show hint
                </button>
              ) : (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3">
                  <p className="text-sm font-medium text-yellow-800">Hint</p>
                  <p className="mt-1 text-sm text-gray-800">{codeChallenge.hint}</p>
                </div>
              )}
            </div>

            {pyodideLoading && (
              <p className="mt-3 text-sm text-amber-700">
                Initializing Python runtime (Pyodide)...
              </p>
            )}
            {pyodideError && <p className="mt-3 text-sm text-red-700">{pyodideError}</p>}

            <PythonCodeEditor
              className="mt-4 w-full rounded-md border border-gray-300 overflow-hidden"
              minHeight="12rem"
              modelPath={`/find-my-level/placement-code-${codeIndex}.py`}
              value={codeInput}
              onChange={setCodeInput}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={runCodeChallenge}
                disabled={!canRunPython || runStatus === "running"}
              >
                {runStatus === "running" ? "Running..." : "Run and validate"}
              </button>
              {runStatus === "pass" && (
                <button
                  type="button"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={
                    codeIndex === placementCodingChallenges.length - 1
                      ? goToPlacementHub
                      : nextCodeChallenge
                  }
                >
                  {codeIndex === placementCodingChallenges.length - 1
                    ? "See my results and path"
                    : "Next code challenge"}
                </button>
              )}
            </div>

            {runMessage && (
              <p
                className={`mt-3 text-sm ${
                  runStatus === "pass" ? "text-green-700" : "text-red-700"
                }`}
              >
                {runMessage}
              </p>
            )}
          </>
        )}
      </div>

      <CompletionModal
        open={completion !== null}
        emoji="🏆"
        title="Placement complete!"
        message={
          completion?.level === "Advanced"
            ? "Strong performance — you’re placed at Advanced. Your path starts from the tougher units."
            : completion?.level === "Intermediate"
              ? "Solid work — you’re placed at Intermediate. Your path skips the basics and goes right to the good stuff."
              : "You’re placed at Beginner. Your path starts from the foundations and builds up steadily."
        }
        highlight={completion ? { label: "Your level", value: completion.level } : undefined}
        stats={
          completion
            ? [
                {
                  label: "MCQ score",
                  value: `${completion.mcqScore} / ${completion.totalMcq}`,
                },
                {
                  label: "Code (first try)",
                  value: `${completion.codeScore} / ${completion.totalCode}`,
                },
                {
                  label: "Overall",
                  value: `${Math.round(((completion.mcqScore + completion.codeScore) / (completion.totalMcq + completion.totalCode)) * 100)}%`,
                },
                ...(completion.recommendedTopic
                  ? [{ label: "Focus topic", value: completion.recommendedTopic }]
                  : []),
              ]
            : undefined
        }
        primaryAction={{
          label: "See my learning path →",
          href: `/numpy/path?level=${encodeURIComponent(completion?.level ?? "")}`,
        }}
        secondaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
      />
      <XPToast amount={xpToast?.amount ?? null} levelUpTier={xpToast?.levelUpTier} onDone={() => setXpToast(null)} />
      <BadgeToast badge={badgeToast} onDone={() => setBadgeToast(null)} />
    </main>
  );
}
