"use client";

/**
 * Post-placement hub at /numpy/path.
 *
 * Reads placement written by Find my level (sessionStorage). Split into an inner component
 * + Suspense because useSearchParams() in the App Router must be under Suspense for static generation.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  clearNumpyPlacement,
  loadNumpyPlacement,
  type NumpyPlacementPayload,
} from "@/lib/numpy-placement-storage";

function formatCompleted(iso: string): string {
  // Human-readable timestamp for the hub header (best-effort).
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function NumpyLearningPathContent() {
  const searchParams = useSearchParams();
  // Shallow bookmark from find-my-level redirect; full weak-topic list still lives in sessionStorage.
  const levelFromQuery = searchParams.get("level");

  const [payload, setPayload] = useState<NumpyPlacementPayload | null>(null);
  // Avoid flashing the "no placement" empty state before we read sessionStorage on the client.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPayload(loadNumpyPlacement());
    setHydrated(true);
  }, []);

  const displayLevel = useMemo(() => {
    if (payload?.level) return payload.level;
    if (levelFromQuery?.trim()) return levelFromQuery.trim();
    return null;
  }, [payload, levelFromQuery]);

  // First client tick: avoid SSR/CSR mismatch and empty-state flash before sessionStorage read.
  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-600">Loading your path…</p>
      </main>
    );
  }

  // No saved session and no ?level= — send the learner to placement first.
  if (!payload && !displayLevel) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Your NumPy path</h1>
          <p className="mt-3 text-slate-700">
            Complete the placement quiz once so we can show your level, weak topics, and
            suggested next steps. Results are kept for this browser session only (no account
            required yet).
          </p>
          <Link
            href="/find-my-level"
            className="mt-6 inline-block rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Take Find my level
          </Link>
          <Link
            href="/"
            className="mt-4 block text-sm text-sky-700 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  // Main hub: prefer session payload; ?level= alone can still show a headline after storage was cleared.
  const weak = payload?.weakTopics ?? [];
  const recommended = payload?.recommendedTopic ?? null;
  const scoreLine =
    payload != null ? `${payload.mcqScore} / ${payload.totalMcq}` : null;
  const completedLine = payload?.completedAt ? formatCompleted(payload.completedAt) : null;

  return (
    <main className="min-h-screen p-6 md:p-10 bg-slate-50">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-sky-700 hover:underline">
          Back to home
        </Link>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
            NumPy · Your path
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Here is where to focus next</h1>
          {completedLine && (
            <p className="mt-2 text-sm text-slate-500">Placement from {completedLine}</p>
          )}

          <div className="mt-8 rounded-xl border border-sky-100 bg-sky-50/80 p-5">
            <p className="text-sm font-medium text-slate-600">Recommended level</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{displayLevel ?? "Unknown"}</p>
            {scoreLine && (
              <p className="mt-2 text-sm text-slate-700">MCQ score: {scoreLine}</p>
            )}
          </div>

          {weak.length > 0 ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-5">
              <p className="font-semibold text-slate-900">Topics to review</p>
              <ul className="mt-2 list-disc list-inside text-slate-800">
                {weak.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
              {recommended && (
                <p className="mt-3 text-slate-900">
                  Start with: <strong>{recommended}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/90 p-5">
              <p className="font-semibold text-slate-900">No clear weak spot</p>
              <p className="mt-1 text-sm text-slate-700">
                Keep practicing with mixed questions and hands-on code to stay sharp.
              </p>
            </div>
          )}

          <h2 className="mt-10 text-lg font-semibold text-slate-900">Next steps</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick one track — you can switch anytime.
          </p>

          <ul className="mt-4 space-y-3">
            <li>
              <Link
                href="/start-from-scratch"
                className="block rounded-xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-4 transition hover:shadow-md"
              >
                <span className="font-semibold text-slate-900">Review concepts and playground</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Visuals, reference sections, and short typing checks — good after missing theory.
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/start-from-scratch/quiz"
                className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md"
              >
                <span className="font-semibold text-slate-900">Basics quiz (MCQ + code)</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Mixed adaptive MCQs plus runnable NumPy challenges in the browser.
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/find-my-level"
                className="block rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:shadow-md"
              >
                <span className="font-semibold text-slate-900">Retake placement</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Updates this page after you finish (same browser session).
                </span>
              </Link>
            </li>
          </ul>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                // Drop session copy so the empty state + retake CTA match a fresh demo.
                clearNumpyPlacement();
                setPayload(null);
              }}
            >
              Clear saved placement
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function NumpyLearningPathPage() {
  // Required wrapper when the tree uses useSearchParams (Next.js App Router).
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <p className="text-slate-600">Loading your path…</p>
        </main>
      }
    >
      <NumpyLearningPathContent />
    </Suspense>
  );
}
