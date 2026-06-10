"use client";

/**
 * Dev-only QA harness for the curated coding-problem banks.
 *
 * Two layers of verification:
 *  1. Static audit (auditCuratedBanks) — ids, structure, anti-shortcut gate.
 *  2. Solvability — each problem's reference solution is executed through the
 *     SAME Pyodide grader learners use; a problem only passes if the grader
 *     reports `passed`. This catches broken Python assertions that static
 *     checks can't see.
 *
 * Not linked from the app; visit /dev/bank-check during `next dev`.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CURATED_CODE_CHALLENGES } from "@/lib/numpy-code-challenge-quality";
import { allCurriculumCodeChallenges } from "@/lib/numpy-code-topics";
import {
  auditCuratedBanks,
  referenceSolutionFor,
  type BankAuditReport,
} from "@/lib/numpy-bank-audit";
import { toWorkerChecks } from "@/lib/numpy-code-validate";
import { validatePythonInWorker } from "@/lib/pyodide-web-worker";

type SolveStatus = "pending" | "running" | "pass" | "fail";

type SolveRow = {
  id: string;
  topic: string;
  status: SolveStatus;
  detail: string;
};

const STATUS_STYLE: Record<SolveStatus, string> = {
  pending: "bg-slate-100 text-slate-500",
  running: "bg-amber-100 text-amber-800",
  pass: "bg-emerald-100 text-emerald-800",
  fail: "bg-rose-100 text-rose-800",
};

// The full graded pool: curated fallback bank + curriculum practice exercises.
const ALL_CHALLENGES = [...CURATED_CODE_CHALLENGES, ...allCurriculumCodeChallenges()];

export default function BankCheckPage() {
  // Pure, module-data-only computations — safe as lazy initializers (no
  // setState-in-effect needed, runs once on first render).
  const [audit] = useState<BankAuditReport>(() => auditCuratedBanks());
  const [rows, setRows] = useState<SolveRow[]>(() =>
    ALL_CHALLENGES.map((c) => ({
      id: c.id,
      topic: c.topic,
      status: "pending",
      detail: "",
    })),
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const c of ALL_CHALLENGES) {
        if (cancelled) return;
        setRows((prev) =>
          prev.map((r) => (r.id === c.id ? { ...r, status: "running" } : r)),
        );

        let status: SolveStatus = "fail";
        let detail = "";
        const solution = referenceSolutionFor(c.id);
        if (!solution) {
          detail = "no reference solution";
        } else {
          try {
            const res = await validatePythonInWorker(solution, toWorkerChecks(c.checks));
            if (!res.ok) {
              detail = `runner error: ${res.error}`;
            } else if (res.error) {
              detail = `${res.error.type}: ${res.error.message}`;
            } else if (!res.passed) {
              detail = res.failures.map((f) => f.message).join("; ") || "checks failed";
            } else {
              status = "pass";
              detail = "solvable + graded correctly";
            }
          } catch (e) {
            detail = `runner error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }

        if (cancelled) return;
        setRows((prev) =>
          prev.map((r) => (r.id === c.id ? { ...r, status, detail } : r)),
        );
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const passCount = rows.filter((r) => r.status === "pass").length;
  const failCount = rows.filter((r) => r.status === "fail").length;
  const staticIssues = [...audit.results, ...audit.curriculumResults].filter(
    (r) => r.issues.length > 0,
  );
  const allGreen = audit.ok === true && done && failCount === 0 && rows.length > 0;

  return (
    <main className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Curated bank QA</h1>
        <Link href="/dashboard" className="text-sm text-sky-700 hover:underline">
          ← Back to app
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Static audit + live Pyodide solvability check for every curated fallback
        problem and curriculum practice exercise.
      </p>

      {/* Overall banner */}
      <div
        className={`mt-6 rounded-2xl border p-4 text-sm font-medium ${
          !done
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : allGreen
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
        }`}
      >
        {!done
          ? "Running solvability checks in Pyodide…"
          : allGreen
            ? `All ${rows.length} problems (curated + curriculum) pass static audit and solve correctly.`
            : `Problems found — ${failCount} solvability failure(s), ${staticIssues.length} static issue(s).`}
      </div>

      {/* Static audit summary */}
      {audit && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Static audit
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>Curated challenges: {audit.totalCurated}</li>
            <li>Curriculum challenges: {audit.totalCurriculum}</li>
            <li>
              Duplicate ids:{" "}
              {audit.duplicateIds.length === 0 ? "none" : audit.duplicateIds.join(", ")}
            </li>
          </ul>
          {staticIssues.length > 0 && (
            <ul className="mt-3 space-y-2">
              {staticIssues.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                >
                  <span className="font-mono font-semibold">{r.id}</span>:{" "}
                  {r.issues.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Solvability table */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Solvability ({passCount}/{rows.length} passing)
        </h2>
        <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}
              >
                {r.status}
              </span>
              <span className="font-mono text-slate-900">{r.id}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{r.topic}</span>
              {r.detail && (
                <span className="ml-auto truncate pl-3 text-xs text-slate-500">
                  {r.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
