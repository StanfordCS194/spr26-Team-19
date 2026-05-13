export type NumpyPlacementPayload = {
  level: string;
  weakTopics: string[];
  recommendedTopic: string | null;
  mcqScore: number;
  totalMcq: number;
  completedAt: string;
};

export const NUMPY_PLACEMENT_STORAGE_KEY = "adapted.numpy.placement.v1";

export function saveNumpyPlacement(payload: NumpyPlacementPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NUMPY_PLACEMENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadNumpyPlacement(): NumpyPlacementPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NUMPY_PLACEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.level !== "string" ||
      !Array.isArray(o.weakTopics) ||
      !o.weakTopics.every((t) => typeof t === "string") ||
      (o.recommendedTopic !== null && typeof o.recommendedTopic !== "string") ||
      typeof o.mcqScore !== "number" ||
      typeof o.totalMcq !== "number" ||
      typeof o.completedAt !== "string"
    ) {
      return null;
    }
    return {
      level: o.level,
      weakTopics: o.weakTopics as string[],
      recommendedTopic: o.recommendedTopic as string | null,
      mcqScore: o.mcqScore,
      totalMcq: o.totalMcq,
      completedAt: o.completedAt,
    };
  } catch {
    return null;
  }
}

export function clearNumpyPlacement(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(NUMPY_PLACEMENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
