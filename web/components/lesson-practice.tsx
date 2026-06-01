"use client";

import { useEffect, useState } from "react";
import { PythonCodeEditor } from "@/components/python-code";
import type { Lesson } from "@/lib/numpy-curriculum";
import { EXERCISE_ZONE_CODE_LAB, recordExerciseResult } from "@/lib/numpy-exercise-progress";
import { slugifyTopic } from "@/lib/numpy-learning-path";
import { notifyProgressChange } from "@/lib/numpy-progress-store";
import { ensurePyodideWorker, runPythonInWorker } from "@/lib/pyodide-web-worker";

function normalizeOutput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function LessonPractice({ lesson }: { lesson: Lesson }) {
  const practice = lesson.practice;
  const [code, setCode] = useState(practice?.starterCode ?? "");
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [runMessage, setRunMessage] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodideError, setPyodideError] = useState("");

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

  function record(passed: boolean) {
    recordExerciseResult(EXERCISE_ZONE_CODE_LAB, passed, { topicKey });
    notifyProgressChange();
  }

  async function runCode() {
    if (!canRun || !practice) return;
    setRunStatus("running");
    setRunMessage("Running…");
    try {
      const exec = await runPythonInWorker(`${code}\nrepr(answer)`);
      if (!exec.ok) {
        setRunStatus("fail");
        setRunMessage(exec.error ?? "Error");
        record(false);
        return;
      }
      const out = normalizeOutput(exec.result);
      const passed = practice.expectedOutputs.some(
        (exp) => normalizeOutput(exp) === out,
      );
      setRunStatus(passed ? "pass" : "fail");
      setRunMessage(
        passed
          ? `Passed. answer = ${exec.result.trim()}`
          : `Not yet. Expected one of: ${practice.expectedOutputs.join(" | ")}; got ${exec.result.trim()}`,
      );
      record(passed);
    } catch (e) {
      setRunStatus("fail");
      setRunMessage(e instanceof Error ? e.message : "Run failed");
      record(false);
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
    </section>
  );
}
