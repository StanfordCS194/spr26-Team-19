"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  NUMPY_CURRICULUM,
  NUMPY_LESSON_COUNT,
  type Lesson,
} from "@/lib/numpy-curriculum";
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  lessonProgress,
  subscribeProgress,
  type LessonProgress,
} from "@/lib/numpy-progress-store";
import { PATH_MASTERY_PERCENT, PATH_MIN_ATTEMPTS } from "@/lib/numpy-learning-path";

const STATUS_BADGE: Record<LessonProgress["status"], { label: string; cls: string }> = {
  new: { label: "Not started", cls: "border-slate-200 bg-slate-50 text-slate-500" },
  in_progress: { label: "In progress", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  mastered: { label: "Mastered", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

function LessonCard({ lesson, progress }: { lesson: Lesson; progress: LessonProgress }) {
  const badge = STATUS_BADGE[progress.status];
  const interactive = Boolean(lesson.playground || lesson.practice);
  return (
    <li>
      <Link
        href={`/numpy/lessons/${lesson.id}`}
        className="block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{lesson.title}</h3>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-slate-600">{lesson.blurb}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {interactive && (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                Interactive
              </span>
            )}
            {progress.percent != null && (
              <span className="text-xs text-slate-500">
                {progress.correct}/{progress.attempted} · {progress.percent}%
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-sky-700">Open lesson →</span>
        </div>
      </Link>
    </li>
  );
}

export default function NumpyLessonsPage() {
  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );

  const masteredCount = useMemo(() => {
    return NUMPY_CURRICULUM.reduce(
      (sum, unit) =>
        sum +
        unit.lessons.filter((l) => lessonProgress(progress, l).status === "mastered")
          .length,
      0,
    );
  }, [progress]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/numpy/path" className="text-sm text-sky-700 hover:underline">
          ← Back to path
        </Link>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
            NumPy · Lessons
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            The NumPy beginner curriculum
          </h1>
          <p className="mt-2 max-w-2xl text-slate-700">
            Every topic from the official NumPy beginner guide, grouped into units. Open a lesson
            to read the idea, play with interactive visuals, and practice in real Python.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Mastered <strong className="text-slate-900">{masteredCount}</strong> of{" "}
            {NUMPY_LESSON_COUNT} lessons ({PATH_MASTERY_PERCENT}%+ accuracy with{" "}
            {PATH_MIN_ATTEMPTS}+ tries).
          </p>

          <nav className="mt-6 flex flex-wrap gap-2" aria-label="On this page">
            {NUMPY_CURRICULUM.map((unit) => (
              <a
                key={unit.id}
                href={`#${unit.id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700"
              >
                {unit.title}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-8 space-y-10">
          {NUMPY_CURRICULUM.map((unit) => (
            <section key={unit.id} id={unit.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold text-slate-900">{unit.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{unit.summary}</p>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {unit.lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    progress={lessonProgress(progress, lesson)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
