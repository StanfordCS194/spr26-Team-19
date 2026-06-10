"use client";

import { useEffect, useMemo, useState } from "react";
import { PythonCodeEditor } from "@/components/python-code";
import { runAndValidateChallenge } from "@/lib/numpy-code-validate";
import { ensurePyodideWorker } from "@/lib/pyodide-web-worker";
import { MINIMAL_STARTER_CODE } from "@/lib/numpy-starter-code";

// Generic shape for each multiple-choice question used in the MCQ stage.
type QuizQuestion = {
  prompt: string;
  topic: string; 
  choices: string[];
  correctIndex: number;
  explanation: string;
  hint: string; 
};

// Coding stage metadata for Pyodide runtime validation.
type CodingChallenge = {
  id: string;
  prompt: string;
  starterCode: string;
  expectedOutputs: string[];
  hint: string;
};

// MCQ stage is capped intentionally to keep quiz duration predictable.
const TOTAL_MCQ = 5;

// Local fallback bank used when LLM generation fails/rate-limits/duplicates.
const fallbackMcqBank: QuizQuestion[] = [
  {
    prompt: "What does indexing return in `arr[2]`?",
    topic: "indexing",
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
    choices: ["[5, 10]", "[10, 15]", "[10, 15, 20]", "[15, 20]"],
    correctIndex: 1,
    explanation: "Slices include start and exclude end, so indices 1 and 2.",
    hint: "Remember that slicing includes the start index but excludes the end index.",
  },
  {
    prompt: "For a 1D array with 6 elements, what is `arr.shape`?",
    topic: "array shape",
    choices: ["(6)", "(6,)", "(1, 6)", "6"],
    correctIndex: 1,
    explanation: "A 1D NumPy array shape is represented as `(n,)`.",
    hint: "A 1D NumPy shape is written as a tuple even if it has only one dimension.",
  },
  {
    prompt: "Which expression returns the last two elements of `arr`?",
    topic: "slicing",
    choices: ["arr[:2]", "arr[2:]", "arr[-2:]", "arr[-1]"],
    correctIndex: 2,
    explanation: "Negative slicing with `-2:` selects the last two elements.",
    hint: "Negative indices count backward from the end of the array.",
  },
  {
    prompt: "Which function returns a sorted copy of an array `a`?",
    topic: "numpy functions",
    choices: ["a.sortcopy()", "np.sort(a)", "np.order(a)", "a.sorted()"],
    correctIndex: 1,
    explanation: "`np.sort(a)` returns a sorted copy.",
    hint: "Think about the standard NumPy function for sorting without modifying the original array in place.",
  },
];

// Expected response shape from /api/generate-question endpoint.
type GeneratedQuestionResponse = {
  topic: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
};

type Difficulty = "easy" | "medium" | "hard";

type mcqGenerationRequest = {
  difficulty: Difficulty;
  previousTopic?: string;
  focusTopic?: string;
  seenPrompts?: string[];
};

// Pyodide coding challenges run after MCQ stage.
const codingChallenges: CodingChallenge[] = [
  {
    id: "slice-1d",
    prompt:
      "Build a one-dimensional array with values 10, 20, 30, 40, and 50. Set `answer` to the three middle elements.",
    starterCode: MINIMAL_STARTER_CODE,
    expectedOutputs: ["[20, 30, 40]", "array([20, 30, 40])"],
    hint: "Use slicing with start index 1 and end index 4.",
  },
  {
    id: "newaxis-shape",
    prompt:
      "Build a one-dimensional array of integers 0 through 5, turn it into a column vector, and set `answer` to that column's shape.",
    starterCode: MINIMAL_STARTER_CODE,
    expectedOutputs: ["(6, 1)", "(6,1)"],
    hint: "Use `col.shape` for the answer.",
  },
];

export default function BasicsQuizPage() {
  // Top-level finite state machine for assessment progression.
  const [phase, setPhase] = useState<"mcq" | "code" | "complete">("mcq");
  // 2-slot + buffer pipeline:
  // - currentQuestion: visible now
  // - prefetchedQuestion: next question ready immediately
  // - bufferedQuestion: newly generated in background after answer selection
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion>(fallbackMcqBank[0]!);
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<QuizQuestion>(
    fallbackMcqBank[1] ?? fallbackMcqBank[0]!,
  );
  const [bufferedQuestion, setBufferedQuestion] = useState<QuizQuestion | null>(null);
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
  // Coding stage state.
  const [codeIndex, setCodeIndex] = useState(0);
  // passedChallengeIds tracks completion; firstTryPassedIds drives score.
  const [passedChallengeIds, setPassedChallengeIds] = useState<string[]>([]);
  const [firstTryPassedIds, setFirstTryPassedIds] = useState<string[]>([]);
  const [challengeAttempts, setChallengeAttempts] = useState<Record<string, number>>({});
  const [codeInput, setCodeInput] = useState(MINIMAL_STARTER_CODE);
  // Runtime execution and messaging state for Pyodide code runner.
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  // Pyodide runs in a Web Worker (public/workers/pyodide-runner.js) so the main thread UI stays smooth.
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");
  const canRunPython = !pyodideLoading && !pyodideError;

  const question = currentQuestion; // Alias for readability in JSX.
  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;
  const isLastQuestion = index === TOTAL_MCQ - 1;
  const codeChallenge = codingChallenges[codeIndex]!;
  // Code score is first-try-only by design.
  const codeScore = firstTryPassedIds.length;
  const totalScore = useMemo(
    () => mcqScore + codeScore,
    [mcqScore, codeScore],
  );
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

  function buildAdaptiveGenerationRequest(
    existingPrompts: Set<string>,
    answerWasCorrect?: boolean,
  ): mcqGenerationRequest {
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
    } else if (projectedAccuracy >= 0.85 && attemptedCount >= 3) {
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

  useEffect(() => {
    let cancelled = false;
    setPyodideError("");
    setPyodideLoading(true);
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

  function getFallbackQuestion(existingPrompts: Set<string>): QuizQuestion {
    // Prefer unseen fallback prompts first, otherwise allow reuse.
    const candidate = fallbackMcqBank.find((item) => !existingPrompts.has(item.prompt));
    return candidate ?? fallbackMcqBank[Math.floor(Math.random() * fallbackMcqBank.length)]!;
  }

  async function fetchGeneratedMcq(
    existingPrompts: Set<string>,
    generationRequest: mcqGenerationRequest,
  ): Promise<{ question: QuizQuestion; source: "generated" | "fallback" }> {
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
      const generated: QuizQuestion = {
        topic: payload.topic,
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
    if (hasAnswered) return;
    setSelected(choiceIndex);
    const answerWasCorrect = choiceIndex === question.correctIndex;

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

  function moveToCodingStage() {
    // Transition from MCQ stage to executable coding stage.
    setPhase("code");
    setSelected(null);
    setCodeIndex(0);
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
    setShowHint(false);
  }

  async function runCodeChallenge() {
    if (!canRunPython) return;
    setRunStatus("running");
    setRunMessage("Running code...");
    // We track attempts to compute first-try-only scoring.
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
        // Completion tracking (any attempt).
        setPassedChallengeIds((prev) => {
          if (prev.includes(codeChallenge.id)) return prev;
          return [...prev, codeChallenge.id];
        });
        // First-try scoring only increments if this was attempt #1.
        if (attemptsSoFar === 0) {
          setFirstTryPassedIds((prev) => {
            if (prev.includes(codeChallenge.id)) return prev;
            return [...prev, codeChallenge.id];
          });
        }
      }
    } catch (error) {
      setRunStatus("fail");
      setRunMessage(
        error instanceof Error ? `Execution error: ${error.message}` : "Execution failed.",
      );
    }
  }

  function nextCodeChallenge() {
    // Advance coding challenge pointer or complete quiz if done.
    if (codeIndex === codingChallenges.length - 1) {
      setPhase("complete");
      return;
    }
    const nextIndex = codeIndex + 1;
    setCodeIndex(nextIndex);
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
  }

  function handleRestart() {
    // Full session reset across both MCQ and coding phases.
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
    setPassedChallengeIds([]);
    setFirstTryPassedIds([]);
    setChallengeAttempts({});
    setCodeIndex(0);
    setCodeInput(MINIMAL_STARTER_CODE);
    setRunStatus("idle");
    setRunMessage("");
    setShowHint(false);
    setTopicMistakes({});
  }
  const recommendedTopic = getRecommendedTopic();
  const weakTopics = getWeakTopics();

  const totalSteps = TOTAL_MCQ + codingChallenges.length;
  const completedSteps =
    phase === "mcq"
      ? index + (selected !== null ? 1 : 0)
      : phase === "code"
        ? TOTAL_MCQ + codeIndex + (runStatus === "pass" ? 1 : 0)
        : totalSteps;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <a href="/numpy/lessons" className="text-sm text-blue-600 hover:underline">
          ← Back to lessons
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Basics quiz</h1>

        {/* Unified progress bar */}
        {phase !== "complete" && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>
                {phase === "mcq"
                  ? `Question ${index + 1} of ${TOTAL_MCQ}`
                  : `Code challenge ${codeIndex + 1} of ${codingChallenges.length}`}
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
        )}

        {phase === "mcq" && (
          <>
            <p className="mt-3 text-xs text-slate-400">
              {isPrefetchingMcq
                ? "Preparing next question…"
                : mcqGenerationStatus === "generated"
                  ? "AI-generated question"
                  : mcqGenerationStatus === "fallback"
                    ? "Fallback question"
                    : ""}
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
                    key={choice}
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
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={moveToCodingStage}
                    >
                      Continue to code execution challenges
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {phase === "code" && (
          <>
            <p className="mt-2 text-gray-700">
              Code challenge {codeIndex + 1} of {codingChallenges.length}
            </p>
            <h2 className="mt-6 text-xl font-semibold text-gray-900">Run real NumPy code</h2>
            <p className="mt-2 text-sm text-gray-800">{codeChallenge.prompt}</p>
            <p className="mt-1 text-xs text-gray-700">Hint: {codeChallenge.hint}</p>

            {pyodideLoading && (
              <p className="mt-3 text-sm text-amber-700">
                Initializing Python runtime (Pyodide)...
              </p>
            )}
            {pyodideError && (
              <p className="mt-3 text-sm text-red-700">
                {pyodideError}
              </p>
            )}

            <PythonCodeEditor
              className="mt-4 w-full rounded-md border border-gray-300 overflow-hidden"
              minHeight="12rem"
              modelPath={`/quiz/numpy-basics-challenge-${codeIndex}.py`}
              value={codeInput}
              onChange={setCodeInput}
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={runCodeChallenge}
                disabled={!canRunPython || runStatus === "running"}
              >
                {runStatus === "running" ? "Running..." : "Run and validate"}
              </button>
              {runStatus === "pass" && (
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={nextCodeChallenge}
                >
                  {codeIndex === codingChallenges.length - 1
                    ? "Finish quiz"
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

        {phase === "complete" && (
          <div className="mt-6">
            {/* Completion banner */}
            <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-sky-50 border border-pink-200 p-6 text-center">
              <p className="text-4xl">🎉</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Basics quiz complete!</h2>
              <p className="mt-1 text-sm text-slate-600">Here&apos;s how you did.</p>
            </div>

            {/* Score summary */}
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "MCQ", value: `${mcqScore} / ${TOTAL_MCQ}` },
                { label: "Code (1st try)", value: `${codeScore} / ${codingChallenges.length}` },
                { label: "Total", value: `${totalScore} / ${TOTAL_MCQ + codingChallenges.length}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <dt className="text-xs font-medium text-slate-500">{s.label}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-slate-900">{s.value}</dd>
                </div>
              ))}
            </dl>

            {/* Weak topics */}
            {weakTopics.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-slate-900">Topics to review</p>
                <ul className="mt-2 list-disc list-inside text-slate-800 text-sm">
                  {weakTopics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
                {recommendedTopic && (
                  <p className="mt-3 text-sm text-slate-900">
                    Start with: <strong>{recommendedTopic}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-slate-900">No clear weak spot — great work!</p>
              </div>
            )}

            {/* Forward navigation */}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`/numpy/path${recommendedTopic ? `?level=Beginner` : ""}`}
                className="rounded-xl bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md transition"
              >
                See my learning path →
              </a>
              <a
                href="/numpy/lessons"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Go to lessons
              </a>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition"
                onClick={handleRestart}
              >
                Retake quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
