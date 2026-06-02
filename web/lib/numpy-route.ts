/**
 * Builds the gamified "journey" of stops shown on the Path page. Stops are the
 * curriculum units, in order, so a fresh beginner starts at the first unit
 * ("Getting started") and unlocks the next once the current one is mastered.
 *
 * Placement weak topics don't change the route; they just flag the units worth
 * reviewing. Per-unit progress comes from the per-lesson exercise stats.
 */
import { NUMPY_CURRICULUM } from "@/lib/numpy-curriculum";
import type { NumpyExerciseProgress } from "@/lib/numpy-exercise-progress";
import { canonicalizeTopic, dedupeTopics } from "@/lib/numpy-learning-path";
import type { NumpyPlacementPayload } from "@/lib/numpy-placement-storage";
import { lessonProgress } from "@/lib/numpy-progress-store";

export type StopStatus = "complete" | "current" | "available" | "locked";
export type StopKind = "start" | "topic" | "goal";

export type RouteStop = {
  id: string;
  label: string;
  kind: StopKind;
  href: string | null;
  status: StopStatus;
  /** Mastery percent for the unit once any lesson is attempted, else null. */
  percent: number | null;
  icon: string;
  /** Contains a placement weak topic worth reviewing. */
  flagged: boolean;
};

const UNIT_ICONS: Record<string, string> = {
  "getting-started": "🧭",
  fundamentals: "🧱",
  editing: "🔀",
  shapes: "📐",
  operations: "🎯",
  "matrices-random": "🟦",
  "docs-io": "💾",
};

function iconFor(unitId: string): string {
  return UNIT_ICONS[unitId] ?? "🔹";
}

/** Builds one stop per curriculum unit, with sequential unlocking. */
export function buildUnitRoute(
  payload: NumpyPlacementPayload | null,
  progress: NumpyExerciseProgress | null,
): RouteStop[] {
  const weakSet = new Set(dedupeTopics(payload?.weakTopics ?? []));
  const stops: RouteStop[] = [];

  let priorComplete = true; // first unit is always unlocked
  let currentAssigned = false;

  for (const unit of NUMPY_CURRICULUM) {
    const lessons = unit.lessons;
    let mastered = 0;
    let attemptedAny = false;
    for (const lesson of lessons) {
      const lp = lessonProgress(progress, lesson);
      if (lp.status === "mastered") mastered += 1;
      if (lp.attempted > 0) attemptedAny = true;
    }
    const total = lessons.length;
    const complete = total > 0 && mastered === total;
    const percent = !attemptedAny ? null : Math.round((100 * mastered) / Math.max(1, total));

    let status: StopStatus;
    if (!priorComplete) {
      status = "locked";
    } else if (complete) {
      status = "complete";
    } else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else {
      status = "available";
    }
    priorComplete = complete;

    const target =
      lessons.find((l) => lessonProgress(progress, l).status !== "mastered") ?? lessons[0];
    const flagged = lessons.some((l) => weakSet.has(canonicalizeTopic(l.focus)));

    stops.push({
      id: unit.id,
      label: unit.title,
      kind: "topic",
      href: target ? `/numpy/lessons/${target.id}` : "/numpy/lessons",
      status,
      percent,
      icon: iconFor(unit.id),
      flagged,
    });
  }

  return stops;
}

/** Count of mastered unit stops and total units. */
export function routeProgress(stops: RouteStop[]): { done: number; total: number } {
  const units = stops.filter((s) => s.kind === "topic");
  return { done: units.filter((s) => s.status === "complete").length, total: units.length };
}
