"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { canonicalizeTopic, dedupeTopics } from "@/lib/numpy-learning-path";
import {
  clearNumpyPlacement,
  loadNumpyPlacement,
  type NumpyPlacementPayload,
} from "@/lib/numpy-placement-storage";

function formatCompleted(iso: string): string {
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
  const levelFromQuery = searchParams.get("level");

  const [payload, setPayload] = useState<NumpyPlacementPayload | null>(null);
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

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-600">Loading your path…</p>
      </main>
    );
  }

  if (!payload && !displayLevel) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Your NumPy path</h1>
          <p className="mt-3 text-slate-700">
            Complete Find my level first. Results stay in this browser session until you clear
            them.
          </p>
          <Link
            href="/find-my-level"
            className="mt-6 inline-block rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Take Find my level
          </Link>
          <Link href="/" className="mt-4 block text-sm text-sky-700 hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const weak = dedupeTopics(payload?.weakTopics ?? []);
  const recommended = payload?.recommendedTopic
    ? canonicalizeTopic(payload.recommendedTopic)
    : null;
  const scoreLine =
    payload != null ? `${payload.mcqScore} / ${payload.totalMcq}` : null;
  const codeScoreLine =
    payload != null &&
    typeof payload.codeScore === "number" &&
    typeof payload.totalCode === "number"
      ? `${payload.codeScore} / ${payload.totalCode}`
      : null;
  const completedLine = payload?.completedAt ? formatCompleted(payload.completedAt) : null;

  const focusParam =
    recommended ?? (weak.length > 0 ? weak[0] : null)
      ? `?focus=${encodeURIComponent((recommended ?? weak[0])!)}`
      : "";

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
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
            {scoreLine && <p className="mt-2 text-sm text-slate-700">MCQ score: {scoreLine}</p>}
            {codeScoreLine && (
              <p className="mt-1 text-sm text-slate-700">
                Code score (first try): {codeScoreLine}
              </p>
            )}
          </div>

          {weak.length > 0 ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-5">
              <p className="font-semibold text-slate-900">Topics to review</p>
              <ul className="mt-2 list-inside list-disc text-slate-800">
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
                Mixed practice will still help lock in fluency.
              </p>
            </div>
          )}

          <h2 className="mt-10 text-lg font-semibold text-slate-900">Next steps</h2>
          <p className="mt-1 text-sm text-slate-600">Pick one track — you can switch anytime.</p>

          <ul className="mt-4 space-y-3">
            <li>
              <Link
                href="/numpy/lessons"
                className="block rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 transition hover:shadow-md"
              >
                <span className="font-semibold text-slate-900">Lessons (full curriculum)</span>
                <span className="mt-1 block text-sm text-slate-600">
                  Every NumPy beginner topic, grouped into units, with interactive visuals,
                  playgrounds, and hands-on Python practice.
                </span>
              </Link>
            </li>
            <li>
              <Link
                href={`/numpy/exercises${focusParam}`}
                className="block rounded-xl border-2 border-sky-300 bg-sky-50/90 p-4 transition hover:shadow-md"
              >
                <span className="font-semibold text-slate-900">Exercise zone</span>
                <span className="mt-1 block text-sm text-slate-600">
                  AI MCQ drills and structured code tasks with saved progress (this browser).
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
                  Longer adaptive flow with runnable challenges.
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/find-my-level"
                className="block rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:shadow-md"
              >
                <span className="font-semibold text-slate-900">Retake placement</span>
              </Link>
            </li>
          </ul>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
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
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <p className="text-slate-600">Loading your path…</p>
        </main>
      }
    >
      <NumpyLearningPathContent />
    </Suspense>
  );
}
