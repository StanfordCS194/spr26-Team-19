"use client";

import { useEffect, useMemo, useState } from "react";

type QuizQuestion = {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

type CodingChallenge = {
  id: string;
  prompt: string;
  starterCode: string;
  expectedOutputs: string[];
  hint: string;
};

declare global {
  interface Window {
    loadPyodide?: (options?: { indexURL?: string }) => Promise<PyodideLike>;
  }
}

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (pkg: string) => Promise<void>;
};

const TOTAL_MCQ = 5;

const fallbackMcqBank: QuizQuestion[] = [
  {
    prompt: "What does indexing return in `arr[2]`?",
    choices: [
      "A single element at position 2",
      "All elements from 0 to 2",
      "A tuple with shape information",
      "A sorted copy of the array",
    ],
    correctIndex: 0,
    explanation: "Indexing with one integer returns one element at that position.",
  },
  {
    prompt: "Given arr = [5, 10, 15, 20], what does `arr[1:3]` return?",
    choices: ["[5, 10]", "[10, 15]", "[10, 15, 20]", "[15, 20]"],
    correctIndex: 1,
    explanation: "Slices include start and exclude end, so indices 1 and 2.",
  },
  {
    prompt: "For a 1D array with 6 elements, what is `arr.shape`?",
    choices: ["(6)", "(6,)", "(1, 6)", "6"],
    correctIndex: 1,
    explanation: "A 1D NumPy array shape is represented as `(n,)`.",
  },
  {
    prompt: "Which expression returns the last two elements of `arr`?",
    choices: ["arr[:2]", "arr[2:]", "arr[-2:]", "arr[-1]"],
    correctIndex: 2,
    explanation: "Negative slicing with `-2:` selects the last two elements.",
  },
  {
    prompt: "Which function returns a sorted copy of an array `a`?",
    choices: ["a.sortcopy()", "np.sort(a)", "np.order(a)", "a.sorted()"],
    correctIndex: 1,
    explanation: "`np.sort(a)` returns a sorted copy.",
  },
];

type GeneratedQuestionResponse = {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

const codingChallenges: CodingChallenge[] = [
  {
    id: "slice-1d",
    prompt:
      "Create a NumPy array `a = np.array([10, 20, 30, 40, 50])` and set `answer` to the slice that returns [20, 30, 40].",
    starterCode: `import numpy as np

a = np.array([10, 20, 30, 40, 50])
# Set answer below
answer = None`,
    expectedOutputs: ["[20, 30, 40]", "array([20, 30, 40])"],
    hint: "Use slicing with start index 1 and end index 4.",
  },
  {
    id: "newaxis-shape",
    prompt:
      "Create `a = np.arange(6)` and set `answer` to the shape after converting it to a column vector with `np.newaxis`.",
    starterCode: `import numpy as np

a = np.arange(6)
col = a[:, np.newaxis]
# Set answer below
answer = None`,
    expectedOutputs: ["(6, 1)", "(6,1)"],
    hint: "Use `col.shape` for the answer.",
  },
];

export default function BasicsQuizPage() {
  const [phase, setPhase] = useState<"mcq" | "code" | "complete">("mcq");
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion>(fallbackMcqBank[0]!);
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<QuizQuestion>(
    fallbackMcqBank[1] ?? fallbackMcqBank[0]!,
  );
  const [bufferedQuestion, setBufferedQuestion] = useState<QuizQuestion | null>(null);
  const [seenPrompts, setSeenPrompts] = useState<string[]>([
    fallbackMcqBank[0]!.prompt,
    (fallbackMcqBank[1] ?? fallbackMcqBank[0]!).prompt,
  ]);
  const [isPrefetchingMcq, setIsPrefetchingMcq] = useState(false);
  const [mcqGenerationStatus, setMcqGenerationStatus] = useState<
    "idle" | "generated" | "fallback"
  >("idle");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [mcqScore, setMcqScore] = useState(0);
  const [codeIndex, setCodeIndex] = useState(0);
  const [passedChallengeIds, setPassedChallengeIds] = useState<string[]>([]);
  const [firstTryPassedIds, setFirstTryPassedIds] = useState<string[]>([]);
  const [challengeAttempts, setChallengeAttempts] = useState<Record<string, number>>({});
  const [codeInput, setCodeInput] = useState(codingChallenges[0].starterCode);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  const [pyodide, setPyodide] = useState<PyodideLike | null>(null);
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");

  const question = currentQuestion;
  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;
  const isLastQuestion = index === TOTAL_MCQ - 1;
  const codeChallenge = codingChallenges[codeIndex]!;
  const codeScore = firstTryPassedIds.length;
  const totalScore = useMemo(
    () => mcqScore + codeScore,
    [mcqScore, codeScore],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPyodideRuntime() {
      try {
        if (!window.loadPyodide) {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
          script.async = true;
          document.body.appendChild(script);
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Pyodide script"));
          });
        }

        if (!window.loadPyodide) {
          throw new Error("Pyodide loader is unavailable.");
        }

        const runtime = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        });
        await runtime.loadPackage("numpy");
        if (!cancelled) {
          setPyodide(runtime);
          setPyodideLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setPyodideError(
            error instanceof Error ? error.message : "Failed to initialize code runner.",
          );
          setPyodideLoading(false);
        }
      }
    }

    void loadPyodideRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

  function normalizeOutput(raw: string): string {
    return raw.trim().replace(/\s+/g, "");
  }

  function getFallbackQuestion(existingPrompts: Set<string>): QuizQuestion {
    const candidate = fallbackMcqBank.find((item) => !existingPrompts.has(item.prompt));
    return candidate ?? fallbackMcqBank[Math.floor(Math.random() * fallbackMcqBank.length)]!;
  }

  async function fetchGeneratedMcq(
    existingPrompts: Set<string>,
  ): Promise<{ question: QuizQuestion; source: "generated" | "fallback" }> {
    try {
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferEasy: true }),
      });
      if (!response.ok) throw new Error("MCQ generation request failed");
      const payload = (await response.json()) as GeneratedQuestionResponse;
      if (
        !payload ||
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
        prompt: payload.prompt,
        choices: payload.choices.map(String),
        correctIndex: payload.correctIndex,
        explanation: payload.explanation,
      };
      if (existingPrompts.has(generated.prompt)) {
        return { question: getFallbackQuestion(existingPrompts), source: "fallback" };
      }
      return { question: generated, source: "generated" };
    } catch {
      return { question: getFallbackQuestion(existingPrompts), source: "fallback" };
    }
  }

  async function prefetchBufferedMcq() {
    if (phase !== "mcq" || isLastQuestion || isPrefetchingMcq) return;
    setIsPrefetchingMcq(true);
    const existingPrompts = new Set(seenPrompts);
    const result = await fetchGeneratedMcq(existingPrompts);
    const nextQuestion = result.question;
    setBufferedQuestion(nextQuestion);
    setMcqGenerationStatus(result.source);
    setSeenPrompts((prev) =>
      prev.includes(nextQuestion.prompt) ? prev : [...prev, nextQuestion.prompt],
    );
    setIsPrefetchingMcq(false);
  }

  function handleSelect(choiceIndex: number) {
    if (hasAnswered) return;
    setSelected(choiceIndex);
    if (choiceIndex === question.correctIndex) {
      setMcqScore((prev) => prev + 1);
    }
    void prefetchBufferedMcq();
  }

  function handleNext() {
    if (isLastQuestion) return;
    setSelected(null);
    const existingPrompts = new Set(seenPrompts);
    const nextCurrent = prefetchedQuestion ?? getFallbackQuestion(existingPrompts);
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
  }

  function moveToCodingStage() {
    setPhase("code");
    setSelected(null);
    setCodeIndex(0);
    setCodeInput(codingChallenges[0].starterCode);
    setRunStatus("idle");
    setRunMessage("");
  }

  async function runCodeChallenge() {
    if (!pyodide) return;
    setRunStatus("running");
    setRunMessage("Running code...");
    const attemptsSoFar = challengeAttempts[codeChallenge.id] ?? 0;
    setChallengeAttempts((prev) => ({ ...prev, [codeChallenge.id]: attemptsSoFar + 1 }));

    try {
      const result = await pyodide.runPythonAsync(`${codeInput}\nrepr(answer)`);
      const output = String(result).trim();
      const normalizedOutput = normalizeOutput(output);
      const passed = codeChallenge.expectedOutputs.some(
        (expected) => normalizeOutput(expected) === normalizedOutput,
      );
      setRunStatus(passed ? "pass" : "fail");
      setRunMessage(
        passed
          ? `Passed. Output: ${output}`
          : `Output was ${output}. Expected one of: ${codeChallenge.expectedOutputs.join(" or ")}.`,
      );
      if (passed) {
        setPassedChallengeIds((prev) => {
          if (prev.includes(codeChallenge.id)) return prev;
          return [...prev, codeChallenge.id];
        });
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
    if (codeIndex === codingChallenges.length - 1) {
      setPhase("complete");
      return;
    }
    const nextIndex = codeIndex + 1;
    setCodeIndex(nextIndex);
    setCodeInput(codingChallenges[nextIndex].starterCode);
    setRunStatus("idle");
    setRunMessage("");
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
    setPassedChallengeIds([]);
    setFirstTryPassedIds([]);
    setChallengeAttempts({});
    setCodeIndex(0);
    setCodeInput(codingChallenges[0].starterCode);
    setRunStatus("idle");
    setRunMessage("");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <a href="/start-from-scratch" className="text-sm text-blue-600 hover:underline">
          Back to basics page
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Basics quiz</h1>
        {phase === "mcq" && (
          <>
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

            <textarea
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              className="mt-4 w-full min-h-48 rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-900"
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={runCodeChallenge}
                disabled={pyodideLoading || !pyodide || runStatus === "running"}
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
            <h2 className="text-xl font-semibold text-gray-900">Quiz complete</h2>
            <p className="mt-2 text-gray-800">
              MCQ score: {mcqScore} / {TOTAL_MCQ}
            </p>
            <p className="mt-1 text-gray-800">
              Code score (first try): {codeScore} / {codingChallenges.length}
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              Total score: {totalScore} / {TOTAL_MCQ + codingChallenges.length}
            </p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleRestart}
            >
              Retake full quiz
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
