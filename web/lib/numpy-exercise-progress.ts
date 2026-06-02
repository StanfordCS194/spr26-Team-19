/**
 * NumPy exercise zone progress (localStorage). Swap for API-backed storage when profiles ship.
 */

import { PATH_RECENT_WINDOW } from "@/lib/numpy-learning-path";

export const NUMPY_EXERCISE_PROGRESS_VERSION = 1 as const;

export const EXERCISE_ZONE_MCQ_DRILL = "mcq_drill";
export const EXERCISE_ZONE_CODE_LAB = "code_lab";

export type ZoneStats = {
  attempted: number;
  correct: number;
  /**
   * Outcomes of the most recent attempts (capped at PATH_RECENT_WINDOW), newest
   * last. Used for rolling-window mastery on per-topic stats.
   */
  recent?: boolean[];
};

export type NumpyExerciseProgress = {
  version: typeof NUMPY_EXERCISE_PROGRESS_VERSION;
  updatedAt: string;
  zones: Record<string, ZoneStats>;
  /** Per-topic stats keyed by slug (see numpy-learning-path.slugifyTopic). */
  topics?: Record<string, ZoneStats>;
};

export const NUMPY_EXERCISE_PROGRESS_STORAGE_KEY = "adapted.numpy.exerciseProgress.v1";
const STORAGE_KEY = NUMPY_EXERCISE_PROGRESS_STORAGE_KEY;

function emptyProgress(): NumpyExerciseProgress {
  return {
    version: NUMPY_EXERCISE_PROGRESS_VERSION,
    updatedAt: new Date().toISOString(),
    zones: {},
  };
}

function isZoneStats(v: unknown): v is ZoneStats {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (
    o.recent !== undefined &&
    (!Array.isArray(o.recent) || !o.recent.every((b) => typeof b === "boolean"))
  ) {
    return false;
  }
  return (
    typeof o.attempted === "number" &&
    o.attempted >= 0 &&
    Number.isInteger(o.attempted) &&
    typeof o.correct === "number" &&
    o.correct >= 0 &&
    Number.isInteger(o.correct) &&
    o.correct <= o.attempted
  );
}

export function loadNumpyExerciseProgress(): NumpyExerciseProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.version !== NUMPY_EXERCISE_PROGRESS_VERSION) return null;
    if (typeof o.updatedAt !== "string") return null;
    if (!o.zones || typeof o.zones !== "object") return null;
    const zones = o.zones as Record<string, unknown>;
    for (const [id, stats] of Object.entries(zones)) {
      if (typeof id !== "string" || !isZoneStats(stats)) return null;
    }
    let topics: Record<string, ZoneStats> | undefined;
    if (o.topics != null) {
      if (typeof o.topics !== "object") return null;
      topics = {};
      for (const [id, stats] of Object.entries(o.topics as Record<string, unknown>)) {
        if (typeof id !== "string" || !isZoneStats(stats)) return null;
        topics[id] = stats;
      }
    }
    return {
      version: NUMPY_EXERCISE_PROGRESS_VERSION,
      updatedAt: o.updatedAt,
      zones: zones as Record<string, ZoneStats>,
      ...(topics ? { topics } : {}),
    };
  } catch {
    return null;
  }
}

export function saveNumpyExerciseProgress(data: NumpyExerciseProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function clearNumpyExerciseProgress(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function recordExerciseResult(
  zoneId: string,
  isCorrect: boolean,
  options?: { topicKey?: string },
): NumpyExerciseProgress {
  const prev = loadNumpyExerciseProgress() ?? emptyProgress();
  const zones = { ...prev.zones };
  const cur = zones[zoneId] ?? { attempted: 0, correct: 0 };
  zones[zoneId] = {
    attempted: cur.attempted + 1,
    correct: cur.correct + (isCorrect ? 1 : 0),
  };

  let topics = prev.topics ? { ...prev.topics } : undefined;
  const topicKey = options?.topicKey?.trim();
  if (topicKey) {
    topics = topics ?? {};
    const tCur = topics[topicKey] ?? { attempted: 0, correct: 0, recent: [] };
    const recent = [...(tCur.recent ?? []), isCorrect].slice(-PATH_RECENT_WINDOW);
    topics[topicKey] = {
      attempted: tCur.attempted + 1,
      correct: tCur.correct + (isCorrect ? 1 : 0),
      recent,
    };
  }

  const next: NumpyExerciseProgress = {
    version: NUMPY_EXERCISE_PROGRESS_VERSION,
    updatedAt: new Date().toISOString(),
    zones,
    ...(topics ? { topics } : {}),
  };
  saveNumpyExerciseProgress(next);
  return next;
}

export function getZoneStats(
  progress: NumpyExerciseProgress | null,
  zoneId: string,
): ZoneStats {
  if (!progress) return { attempted: 0, correct: 0 };
  return progress.zones[zoneId] ?? { attempted: 0, correct: 0 };
}

export function summarizeExerciseProgress(progress: NumpyExerciseProgress | null): {
  totalAttempted: number;
  totalCorrect: number;
  overallPercent: number | null;
} {
  if (!progress) {
    return { totalAttempted: 0, totalCorrect: 0, overallPercent: null };
  }
  let totalAttempted = 0;
  let totalCorrect = 0;
  for (const z of Object.values(progress.zones)) {
    totalAttempted += z.attempted;
    totalCorrect += z.correct;
  }
  if (totalAttempted === 0) {
    return { totalAttempted: 0, totalCorrect: 0, overallPercent: null };
  }
  return {
    totalAttempted,
    totalCorrect,
    overallPercent: Math.round((100 * totalCorrect) / totalAttempted),
  };
}
