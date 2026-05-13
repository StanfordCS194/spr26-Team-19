"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ExerciseProgressRing } from "@/components/exercise-progress-ring";
import { PythonCodeEditor } from "@/components/python-code";
import {
  EXERCISE_ZONE_CODE_LAB,
  EXERCISE_ZONE_MCQ_DRILL,
  loadNumpyExerciseProgress,
  recordExerciseResult,
  summarizeExerciseProgress,
} from "@/lib/numpy-exercise-progress";
import { loadNumpyPlacement, type NumpyPlacementPayload } from "@/lib/numpy-placement-storage";
import { ensurePyodideWorker, runPythonInWorker } from "@/lib/pyodide-web-worker";

type DrillMcq = {
  topic: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
};

type CodeChallenge = {
  id: string;
  topic: string;
  prompt: string;
  starterCode: string;
  expectedOutputs: string[];
  hint: string;
};

const FALLBACK_MCQ: DrillMcq = {
  topic: "indexing",
  prompt: "In NumPy, what does `arr[0]` return for a 1D array?",
  choices: ["The last element", "The first element", "A copy of the array", "The dtype only"],
  correctIndex: 1,
  explanation: "Index 0 selects the first element in a 0-based array.",
  hint: "Python and NumPy use 0-based indexing.",
};

const FALLBACK_CODE: CodeChallenge = {
  id: "slice-1d-fallback",
  topic: "slicing",
  prompt:
    "Create `a = np.array([10, 20, 30, 40, 50])` and set `answer` to the slice that returns [20, 30, 40].",
  starterCode: `import numpy as np

a = np.array([10, 20, 30, 40, 50])
answer = None`,
  expectedOutputs: ["[20, 30, 40]", "array([20, 30, 40])"],
  hint: "Use slicing with start index 1 and end index 4.",
};

function normalizeOutput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function NumpyExercisesContent() {
  const searchParams = useSearchParams();
  const [placement, setPlacement] = useState<NumpyPlacementPayload | null>(null);
  const [tab, setTab] = useState<"mcq" | "code">("mcq");
  const [progressTick, setProgressTick] = useState(0);

  const focusHint = useMemo(() => {
    const q = searchParams.get("focus")?.trim();
    if (q) return q;
    if (placement?.recommendedTopic) return placement.recommendedTopic;
    if (placement?.weakTopics?.length) return placement.weakTopics[0]!;
    return "NumPy arrays and indexing";
  }, [placement, searchParams]);

  useEffect(() => {
    setPlacement(loadNumpyPlacement());
    const t = searchParams.get("tab");
    if (t === "code") setTab("code");
  }, [searchParams]);

  const summary = useMemo(() => {
    void progressTick;
    return summarizeExerciseProgress(loadNumpyExerciseProgress());
  }, [progressTick]);

  const bumpProgress = useCallback(() => {
    setProgressTick((n) => n + 1);
  }, []);

  /* —— MCQ drill —— */
  const [mcq, setMcq] = useState<DrillMcq | null>(null);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [mcqError, setMcqError] = useState<string | null>(null);
  const [prevTopic, setPrevTopic] = useState<string | undefined>(undefined);
  const [mcqSelected, setMcqSelected] = useState<number | null>(null);

  const loadMcq = useCallback(async () => {
    setMcqLoading(true);
    setMcqError(null);
    setMcqSelected(null);
    try {
      const res = await fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty: "medium",
          focusTopic: focusHint,
          previousTopic: prevTopic,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as Record<string, unknown>;
      if (
        typeof data.prompt !== "string" ||
        !Array.isArray(data.choices) ||
        data.choices.length !== 4 ||
        typeof data.correctIndex !== "number" ||
        data.correctIndex < 0 ||
        data.correctIndex > 3
      ) {
        throw new Error("Bad shape");
      }
      setMcq({
        topic: typeof data.topic === "string" ? data.topic : "general",
        prompt: data.prompt as string,
        choices: data.choices as string[],
        correctIndex: data.correctIndex as number,
        explanation: typeof data.explanation === "string" ? data.explanation : "",
        hint: typeof data.hint === "string" ? data.hint : undefined,
      });
    } catch {
      setMcq(FALLBACK_MCQ);
      setMcqError("Using fallback question (API unavailable or invalid response).");
    } finally {
      setMcqLoading(false);
    }
  }, [focusHint, prevTopic]);

  useEffect(() => {
    if (tab === "mcq" && !mcq && !mcqLoading) void loadMcq();
  }, [tab, mcq, mcqLoading, loadMcq]);

  function onMcqPick(idx: number) {
    if (mcqSelected !== null || !mcq) return;
    setMcqSelected(idx);
    const ok = idx === mcq.correctIndex;
    recordExerciseResult(EXERCISE_ZONE_MCQ_DRILL, ok);
    bumpProgress();
    setPrevTopic(mcq.topic);
  }

  function onMcqNext() {
    void loadMcq();
  }

  /* —— Code lab —— */
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState(FALLBACK_CODE.starterCode);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");
  const canRun = !pyodideLoading && !pyodideError;

  useEffect(() => {
    let cancelled = false;
    setPyodideError("");
    setPyodideLoading(true);
    void ensurePyodideWorker()
      .then(() => {
        if (!cancelled) setPyodideLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setPyodideError(e instanceof Error ? e.message : "Pyodide failed");
          setPyodideLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCodeChallenge = useCallback(async () => {
    setCodeLoading(true);
    setCodeError(null);
    setRunStatus("idle");
    setRunMessage("");
    try {
      const res = await fetch("/api/generate-code-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "medium", focusTopic: focusHint }),
      });
      if (!res.ok) throw new Error("bad");
      const data = (await res.json()) as Record<string, unknown>;
      if (
        typeof data.id !== "string" ||
        typeof data.prompt !== "string" ||
        typeof data.starterCode !== "string" ||
        !Array.isArray(data.expectedOutputs)
      ) {
        throw new Error("shape");
      }
      const ch: CodeChallenge = {
        id: data.id,
        topic: typeof data.topic === "string" ? data.topic : "general",
        prompt: data.prompt,
        starterCode: data.starterCode,
        expectedOutputs: data.expectedOutputs as string[],
        hint: typeof data.hint === "string" ? data.hint : "",
      };
      setChallenge(ch);
      setCodeInput(ch.starterCode);
    } catch {
      setChallenge(FALLBACK_CODE);
      setCodeInput(FALLBACK_CODE.starterCode);
      setCodeError("Using fallback challenge (API unavailable or invalid response).");
    } finally {
      setCodeLoading(false);
    }
  }, [focusHint]);

  useEffect(() => {
    if (tab === "code" && !challenge && !codeLoading) void loadCodeChallenge();
  }, [tab, challenge, codeLoading, loadCodeChallenge]);

  async function runCode() {
    if (!canRun || !challenge) return;
    setRunStatus("running");
    setRunMessage("Running…");
    try {
      const exec = await runPythonInWorker(`${codeInput}\nrepr(answer)`);
      if (!exec.ok) {
        setRunStatus("fail");
        setRunMessage(exec.error ?? "Error");
        recordExerciseResult(EXERCISE_ZONE_CODE_LAB, false);
        bumpProgress();
        return;
      }
      const out = normalizeOutput(exec.result);
      const passed = challenge.expectedOutputs.some(
        (exp) => normalizeOutput(exp) === out,
      );
      setRunStatus(passed ? "pass" : "fail");
      setRunMessage(
        passed
          ? `Passed. Output: ${exec.result.trim()}`
          : `Expected one of: ${challenge.expectedOutputs.join(" | ")}; got ${exec.result.trim()}`,
      );
      recordExerciseResult(EXERCISE_ZONE_CODE_LAB, passed);
      bumpProgress();
    } catch (e) {
      setRunStatus("fail");
      setRunMessage(e instanceof Error ? e.message : "Run failed");
      recordExerciseResult(EXERCISE_ZONE_CODE_LAB, false);
      bumpProgress();
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/numpy/path" className="text-sm text-sky-700 hover:underline">
            ← Back to path
          </Link>
          <p className="text-xs text-slate-500">
            Focus: <strong>{focusHint}</strong>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ExerciseProgressRing percent={summary.overallPercent} />
          <div className="text-sm text-slate-600">
            <p>
              Attempts: <strong>{summary.totalAttempted}</strong>
            </p>
            <p>
              Correct: <strong>{summary.totalCorrect}</strong>
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "mcq" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => setTab("mcq")}
          >
            MCQ drill
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "code" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => setTab("code")}
          >
            Code lab
          </button>
        </div>

        {tab === "mcq" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Adaptive MCQs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Each answer updates your stored accuracy. Next loads another AI question when the API
              is available.
            </p>
            {mcqError && <p className="mt-2 text-sm text-amber-700">{mcqError}</p>}
            {mcqLoading && <p className="mt-4 text-slate-600">Loading question…</p>}
            {!mcqLoading && mcq && (
              <div className="mt-4">
                <p className="text-xs uppercase text-slate-500">{mcq.topic}</p>
                <h3 className="mt-1 text-xl font-medium text-slate-900">{mcq.prompt}</h3>
                <div className="mt-4 flex flex-col gap-2">
                  {mcq.choices.map((c, i) => {
                    let cls = "border-slate-200 hover:bg-slate-50";
                    if (mcqSelected !== null) {
                      if (i === mcq.correctIndex) cls = "border-emerald-500 bg-emerald-50";
                      else if (i === mcqSelected) cls = "border-red-400 bg-red-50";
                      else cls = "border-slate-100 text-slate-400";
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={mcqSelected !== null}
                        onClick={() => onMcqPick(i)}
                        className={`rounded-lg border-2 p-3 text-left text-sm ${cls}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {mcqSelected !== null && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-700">{mcq.explanation}</p>
                    <button
                      type="button"
                      className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                      onClick={onMcqNext}
                    >
                      Next question
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "code" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Structured code tasks</h2>
            <p className="mt-1 text-sm text-slate-600">
              Set <code className="rounded bg-slate-100 px-1">answer</code> so{" "}
              <code className="rounded bg-slate-100 px-1">repr(answer)</code> matches an expected
              value. Graded runs update your progress.
            </p>
            {codeError && <p className="mt-2 text-sm text-amber-700">{codeError}</p>}
            {pyodideLoading && <p className="mt-2 text-sm text-amber-800">Loading Python…</p>}
            {pyodideError && <p className="mt-2 text-sm text-red-700">{pyodideError}</p>}
            {codeLoading && <p className="mt-4 text-slate-600">Loading challenge…</p>}
            {!codeLoading && challenge && (
              <div className="mt-4">
                <p className="text-xs uppercase text-slate-500">{challenge.topic}</p>
                <p className="mt-2 text-slate-800">{challenge.prompt}</p>
                <p className="mt-2 text-xs text-slate-500">Hint: {challenge.hint}</p>
                <PythonCodeEditor
                  className="mt-3 w-full overflow-hidden rounded-lg border border-slate-200"
                  minHeight="12rem"
                  modelPath={`/numpy/exercises/${challenge.id}.py`}
                  value={codeInput}
                  onChange={setCodeInput}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canRun || runStatus === "running"}
                    onClick={() => void runCode()}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {runStatus === "running" ? "Running…" : "Run and check"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadCodeChallenge()}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    New challenge
                  </button>
                </div>
                {runMessage && (
                  <p
                    className={`mt-3 text-sm ${
                      runStatus === "pass" ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {runMessage}
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function NumpyExercisesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <p className="text-slate-600">Loading exercises…</p>
        </main>
      }
    >
      <NumpyExercisesContent />
    </Suspense>
  );
}
