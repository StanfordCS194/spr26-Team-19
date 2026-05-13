"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveNumpyPlacement } from "@/lib/numpy-placement-storage";

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

// MCQ stage is capped intentionally to keep quiz duration predictable.
const TOTAL_MCQ = 10;

// Local fallback bank used when LLM generation fails/rate-limits/duplicates.
const fallbackMcqBank: PlacementQuestion[] = [
  {
    prompt: "What does indexing return in `arr[2]`?",
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
    hint: "Focus on what a single integer index does: it selects one position, not a range.",
  },
  {
    prompt: "Given arr = [5, 10, 15, 20], what does `arr[1:3]` return?",
    topic: "slicing",
    difficulty: "easy",
    choices: ["[5, 10]", "[10, 15]", "[10, 15, 20]", "[15, 20]"],
    correctIndex: 1,
    explanation: "Slices include start and exclude end, so indices 1 and 2.",
    hint: "Remember that slicing includes the start index but excludes the end index.",
  },
  {
    prompt: "For a 1D array with 6 elements, what is `arr.shape`?",
    topic: "array shape",
    difficulty: "medium",
    choices: ["(6)", "(6,)", "(1, 6)", "6"],
    correctIndex: 1,
    explanation: "A 1D NumPy array shape is represented as `(n,)`.",
    hint: "A 1D NumPy shape is written as a tuple even if it has only one dimension.",
  },
  {
    prompt: "Which expression returns the last two elements of `arr`?",
    topic: "slicing",
    difficulty: "medium",
    choices: ["arr[:2]", "arr[2:]", "arr[-2:]", "arr[-1]"],
    correctIndex: 2,
    explanation: "Negative slicing with `-2:` selects the last two elements.",
    hint: "Negative indices count backward from the end of the array.",
  },
  {
    prompt: "Which function returns a sorted copy of an array `a`?",
    topic: "numpy functions",
    difficulty: "medium",
    choices: ["a.sortcopy()", "np.sort(a)", "np.order(a)", "a.sorted()"],
    correctIndex: 1,
    explanation: "`np.sort(a)` returns a sorted copy.",
    hint: "Think about the standard NumPy function for sorting without modifying the original array in place.",
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
};
function computeFinalLevel(history: AnsweredQuestion[]): string{
  if (history.length === 0) return "Beginner";
  const overallAccuracy = history.filter((a) => a.isCorrect).length / history.length;
  const hardAttempts = history.filter((a) => a.difficulty === "hard");
  const hardAccuracy = hardAttempts.length > 0 ? hardAttempts.filter((a) => a.isCorrect).length / hardAttempts.length : 0;
  const hardCorrect = hardAttempts.filter((a) => a.isCorrect).length;
  
  if (overallAccuracy >= 0.7 && hardAccuracy >= 0.8 && hardCorrect >= 2) {
    return "Advanced";
  } else if (overallAccuracy >= 0.7 && hardAccuracy >= 0.5 && hardCorrect >= 1) {
    return "Intermediate";
  } else {
    return "Beginner";
  }
}



export default function FindMyLevelPage() {
  const router = useRouter();
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


  const question = currentQuestion; // Alias for readability in JSX.
  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;
  const isLastQuestion = index === TOTAL_MCQ - 1;
  
  function getWeakTopics() {
    return Object.entries(topicMistakes)
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);
  }
  
  function getRecommendedTopic() {
    const weakTopics = getWeakTopics();
    return weakTopics.length > 0 ? weakTopics[0] : null;
  }
  //Hint State 
  const [showHint, setShowHint] = useState(false); 
  //Mistake tracker 
  const [topicMistakes, setTopicMistakes] = useState<Record<string, number>>({});

  function buildAdaptiveGenerationRequest(answerWasCorrect?: boolean): placementGenerationRequest {
    const projectedMistakes = { ...topicMistakes };
    
    if (answerWasCorrect === false) {
      projectedMistakes[question.topic] = (projectedMistakes[question.topic] ?? 0) + 1;
    }
    const weakTopic = Object.entries(projectedMistakes).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    const attemptedCount = index + (answerWasCorrect === undefined ? 0 : 1);
    const projectedScore = mcqScore + (answerWasCorrect ? 1 : 0);
    const projectedAccuracy = attemptedCount === 0 ? 1 : projectedScore / attemptedCount;


    let difficulty: Difficulty; // declaration w/ no initial value

    // Stay easy early or when accuracy drops; otherwise allow medium questions.
    if (attemptedCount < 2 || projectedAccuracy < 0.7) {
    difficulty = "easy";
    } else {
    difficulty = "medium";
    }

    return {
      // Stay easy early or when accuracy drops; otherwise allow medium questions.
      difficulty,
      previousTopic: question.topic,
      focusTopic: weakTopic,
    };
  }

  


  function getFallbackQuestion(existingPrompts: Set<string>): PlacementQuestion {
    // Prefer unseen fallback prompts first, otherwise allow reuse.
    const candidate = fallbackMcqBank.find((item) => !existingPrompts.has(item.prompt));
    return candidate ?? fallbackMcqBank[Math.floor(Math.random() * fallbackMcqBank.length)]!;
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
        hint: payload.hint?.trim() || "Consider the NumPy rule being tested here.",
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

  async function prefetchBufferedMcq(answerWasCorrect? : boolean) {
    // Only prefetch during MCQ stage and only when not on terminal MCQ.
    if (isLastQuestion || isPrefetchingMcq) return;
    setIsPrefetchingMcq(true);
    const existingPrompts = new Set(seenPrompts);
    const result = await fetchGeneratedMcq(
      existingPrompts,
      buildAdaptiveGenerationRequest(answerWasCorrect),
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
    if (hasAnswered) return;
    setSelected(choiceIndex);
    const answerWasCorrect = choiceIndex === question.correctIndex;
    setHistory((prev) => [
      ...prev,
      { ...question, chosenIndex: choiceIndex, isCorrect: answerWasCorrect },
    ]);
    if (answerWasCorrect) {
      setMcqScore((prev) => prev + 1);
    } else { //Track for mistakes
      setTopicMistakes((prev) => ({
        ...prev,
        [question.topic]: (prev[question.topic] || 0) + 1,
      }));
    }
    // Trigger background generation on answer selection (not on Next).
    void prefetchBufferedMcq(answerWasCorrect);
  }

  function handleNext() {
    if (isLastQuestion) return;
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





  function handleRestart() {
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
    setTopicMistakes({});
    setHistory([]);
  }
  function goToPlacementHub() {
    const level = computeFinalLevel(history);
    saveNumpyPlacement({
      level,
      weakTopics: getWeakTopics(),
      recommendedTopic: getRecommendedTopic(),
      mcqScore,
      totalMcq: TOTAL_MCQ,
      completedAt: new Date().toISOString(),
    });
    router.push(`/numpy/path?level=${encodeURIComponent(level)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <a href="/" className="text-sm text-blue-600 hover:underline">
          Back to home
        </a>
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
          Finish the quiz, then open your personalized path and exercise zone.
        </p>
            <p className="mt-2 text-gray-700">
              MCQ {index + 1} of {TOTAL_MCQ}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {isPrefetchingMcq
                ? "Generating next question in background..."
                : mcqGenerationStatus === "generated"
                  ? "Next question source: LLM generated"
                  : mcqGenerationStatus === "fallback"
                    ? "Next question source: fallback question"
                    : "Next question source: waiting for answer"}
            </p>

            <h2 className="mt-6 text-xl font-semibold text-gray-900">{question.prompt}</h2>

            <div className="mt-4">
              {!showHint ? (
                <button
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                  onClick={() => setShowHint(true)}
                  disabled={hasAnswered}
                >
                  Show hint
              </button>
              )   : (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3">
                  <p className="text-sm font-medium text-yellow-800">Hint</p>
                  <p className="mt-1 text-sm text-gray-800">
                    {question.hint}
                  </p>
                </div>
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
                      onClick={() => goToPlacementHub()}
                    >
                      See my results and path
                    </button>
                  </div>
                )}
              </div>
            )}
      </div>
    </main>
  );
}
