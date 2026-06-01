"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LessonPractice } from "@/components/lesson-practice";
import { LessonPlaygroundView } from "@/components/numpy-playgrounds";
import { PythonCodeBlock } from "@/components/python-code";
import {
  findLesson,
  lessonNeighbors,
  unitForLesson,
} from "@/lib/numpy-curriculum";
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  lessonProgress,
  subscribeProgress,
  type LessonProgress,
} from "@/lib/numpy-progress-store";

const STATUS_BADGE: Record<LessonProgress["status"], { label: string; cls: string }> = {
  new: { label: "Not started", cls: "border-slate-200 bg-slate-50 text-slate-500" },
  in_progress: { label: "In progress", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  mastered: { label: "Mastered", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

export default function NumpyLessonDetailPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId;
  const lesson = findLesson(lessonId);
  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );

  if (!lesson) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Lesson not found</h1>
          <p className="mt-2 text-slate-600">That lesson doesn’t exist.</p>
          <Link
            href="/numpy/lessons"
            className="mt-6 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Back to lessons
          </Link>
        </div>
      </main>
    );
  }

  const unit = unitForLesson(lesson.id);
  const { prev, next } = lessonNeighbors(lesson.id);
  const lp = lessonProgress(progress, lesson);
  const badge = STATUS_BADGE[lp.status];

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/numpy/lessons" className="text-sm text-sky-700 hover:underline">
          ← All lessons
        </Link>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {unit && (
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
                {unit.title}
              </p>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{lesson.title}</h1>
          <p className="mt-3 text-lg text-slate-700">{lesson.blurb}</p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <PythonCodeBlock code={lesson.example} />
          </div>
        </div>

        {lesson.playground && (
          <div className="mt-6">
            <LessonPlaygroundView kind={lesson.playground} />
          </div>
        )}

        {lesson.practice && (
          <div className="mt-6">
            <LessonPractice lesson={lesson} />
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Practice more</h3>
          <p className="mt-1 text-sm text-slate-600">
            Generate fresh AI questions and code tasks focused on this topic.
          </p>
          <Link
            href={`/numpy/exercises?focus=${encodeURIComponent(lesson.focus)}`}
            className="mt-3 inline-block rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-600"
          >
            Open Exercise zone →
          </Link>
        </div>

        <div className="mt-8 flex items-stretch justify-between gap-3">
          {prev ? (
            <Link
              href={`/numpy/lessons/${prev.id}`}
              className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <span className="text-xs text-slate-500">← Previous</span>
              <span className="mt-0.5 block font-medium text-slate-900">{prev.title}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/numpy/lessons/${next.id}`}
              className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <span className="text-xs text-slate-500">Next →</span>
              <span className="mt-0.5 block font-medium text-slate-900">{next.title}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      </div>
    </main>
  );
}
