/**
 * External-store adapter over the exercise-progress localStorage blob so React
 * components can read it with useSyncExternalStore (no setState-in-effect).
 *
 * getSnapshot must be referentially stable, so we cache by the raw string and
 * only re-parse when it changes. A custom event lets same-tab writers (e.g. the
 * lesson practice runner) trigger an immediate refresh.
 */
import type { Lesson } from "@/lib/numpy-curriculum";
import {
  loadNumpyExerciseProgress,
  NUMPY_EXERCISE_PROGRESS_STORAGE_KEY,
  type NumpyExerciseProgress,
} from "@/lib/numpy-exercise-progress";
import {
  PATH_MASTERY_PERCENT,
  PATH_MIN_ATTEMPTS,
  slugifyTopic,
} from "@/lib/numpy-learning-path";

const PROGRESS_CHANGE_EVENT = "numpy-progress-change";

let cachedRaw: string | null = null;
let cachedValue: NumpyExerciseProgress | null = null;

export function getProgressSnapshot(): NumpyExerciseProgress | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(NUMPY_EXERCISE_PROGRESS_STORAGE_KEY);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = loadNumpyExerciseProgress();
  return cachedValue;
}

export function getProgressServerSnapshot(): NumpyExerciseProgress | null {
  return null;
}

export function subscribeProgress(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === NUMPY_EXERCISE_PROGRESS_STORAGE_KEY) callback();
  };
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  window.addEventListener("storage", onStorage);
  window.addEventListener(PROGRESS_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROGRESS_CHANGE_EVENT, callback);
  };
}

/** Notify same-tab subscribers that progress changed (after a graded run). */
export function notifyProgressChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROGRESS_CHANGE_EVENT));
  }
}

export type LessonStatus = "new" | "in_progress" | "mastered";

export type LessonProgress = {
  attempted: number;
  correct: number;
  percent: number | null;
  status: LessonStatus;
};

/**
 * Per-lesson progress derived from the topic key (slug of lesson.focus).
 *
 * Mastery uses a rolling window of the most recent attempts (PATH_RECENT_WINDOW)
 * so a rough start doesn't permanently block mastery. The reported
 * attempted/correct reflect that window once any windowed attempt exists; we
 * fall back to all-time totals for legacy data without a recent window.
 */
export function lessonProgress(
  progress: NumpyExerciseProgress | null,
  lesson: Lesson,
): LessonProgress {
  const stats = progress?.topics?.[slugifyTopic(lesson.focus)] ?? {
    attempted: 0,
    correct: 0,
  };
  const hasWindow = Array.isArray(stats.recent) && stats.recent.length > 0;
  const attempted = hasWindow ? stats.recent!.length : stats.attempted;
  const correct = hasWindow ? stats.recent!.filter(Boolean).length : stats.correct;
  const percent = attempted === 0 ? null : Math.round((100 * correct) / attempted);
  const mastered = attempted >= PATH_MIN_ATTEMPTS && (percent ?? 0) >= PATH_MASTERY_PERCENT;
  return {
    attempted,
    correct,
    percent,
    status: mastered ? "mastered" : attempted > 0 ? "in_progress" : "new",
  };
}
