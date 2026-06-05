"use client";

import { useEffect, useState } from "react";
import { PythonCodeEditor } from "@/components/python-code";
import { XPToast } from "@/components/xp-toast";
import type { Lesson } from "@/lib/numpy-curriculum";
import { EXERCISE_ZONE_CODE_LAB, loadNumpyExerciseProgress, recordExerciseResult } from "@/lib/numpy-exercise-progress";
import { slugifyTopic } from "@/lib/numpy-learning-path";
import { lessonProgress, notifyProgressChange } from "@/lib/numpy-progress-store";
import { runAndValidateChallenge } from "@/lib/numpy-code-validate";
import { ensurePyodideWorker } from "@/lib/pyodide-web-worker";
import { awardXPWithResult, XP_AWARD } from "@/lib/xp-store";

export function LessonPractice({ lesson }: { lesson: Lesson }) {
  const practice = lesson.practice;
  const [code, setCode] = useState(practice?.starterCode ?? "");
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");
  const [xpToast, setXpToast] = useState<{ amount: number; levelUpTier?: { name: string; icon: string } } | null>(null);

  useEffect(() => {
    let cancelled = false;
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

  if (!practice) return null;

  const canRun = !pyodideLoading && !pyodideError;
  const topicKey = slugifyTopic(lesson.focus);

  async function runCode() {
    if (!canRun || !practice) return;
    setRunStatus("running");
    setRunMessage("Running…");

    // Snapshot mastery state BEFORE running so we can detect a transition.
    const wasAlreadyMastered = lessonProgress(loadNumpyExerciseProgress(), lesson).status === "mastered";

    try {
      const outcome = await runAndValidateChallenge(code, {
        expectedOutputs: practice.expectedOutputs,
        checks: practice.checks,
      });
      setRunStatus(outcome.passed ? "pass" : "fail");
      setRunMessage(outcome.message);
      recordExerciseResult(EXERCISE_ZONE_CODE_LAB, outcome.passed, { topicKey });
      notifyProgressChange();

      if (outcome.passed) {
        // Check if this run pushed the lesson to mastered for the first time.
        const nowMastered = lessonProgress(loadNumpyExerciseProgress(), lesson).status === "mastered";
        if (nowMastered && !wasAlreadyMastered) {
          const result = awardXPWithResult("lesson_mastered");
          setXpToast({
            amount: XP_AWARD.lesson_mastered,
            ...(result.leveledUp ? { levelUpTier: result.newTier } : {}),
          });
        }
      }
    } catch (e) {
      setRunStatus("fail");
      setRunMessage(e instanceof Error ? e.message : "Run failed");
      recordExerciseResult(EXERCISE_ZONE_CODE_LAB, false, { topicKey });
      notifyProgressChange();
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Your turn</h3>
      <p className="mt-1 text-slate-800">{practice.prompt}</p>
      <p className="mt-1 text-sm text-slate-600">
        Set <code className="rounded bg-white px-1">answer</code>, then run. Your result is checked
        with real Python and counts toward this topic&apos;s progress.
      </p>

      {pyodideLoading && <p className="mt-2 text-sm text-amber-800">Loading Python…</p>}
      {pyodideError && <p className="mt-2 text-sm text-red-700">{pyodideError}</p>}

      <PythonCodeEditor
        className="mt-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
        minHeight="10rem"
        modelPath={`/numpy/lessons/${lesson.id}.py`}
        value={code}
        onChange={setCode}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
          onClick={() => {
            setCode(practice.starterCode);
            setRunStatus("idle");
            setRunMessage("");
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-white"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          className="text-sm text-sky-700 hover:underline"
        >
          {showHint ? "Hide hint" : "Show hint"}
        </button>
      </div>

      {showHint && <p className="mt-2 text-sm text-slate-700">Hint: {practice.hint}</p>}
      {runMessage && (
        <p
          className={`mt-3 text-sm ${
            runStatus === "pass" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {runMessage}
        </p>
      )}
      <XPToast
        amount={xpToast?.amount ?? null}
        levelUpTier={xpToast?.levelUpTier}
        onDone={() => setXpToast(null)}
      />
    </section>
  );
}
