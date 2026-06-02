export type NumpyPlacementPayload = {
  level: string;
  weakTopics: string[];
  recommendedTopic: string | null;
  mcqScore: number;
  totalMcq: number;
  /** First-try passes on placement code tasks, if that stage was included. */
  codeScore?: number;
  totalCode?: number;
  completedAt: string;
};

export const NUMPY_PLACEMENT_STORAGE_KEY = "adapted.numpy.placement.v1";

/**
 * The session payload (above) is per-tab, but whether a user has *ever* taken
 * placement should persist. Track that per account email in localStorage so the
 * nav can hide Placement for returning users while new signups still see it.
 */
const PLACEMENT_COMPLETED_KEY = "adapted.numpy.placementCompleted.v1";
const PLACEMENT_COMPLETED_EVENT = "adapted-placement-completed-change";

function currentUserEmail(): string | null {
  try {
    const raw = localStorage.getItem("adaptedCurrentUser");
    if (!raw) return null;
    const u = JSON.parse(raw) as { email?: unknown };
    return typeof u.email === "string" ? u.email : null;
  } catch {
    return null;
  }
}

function readCompletedMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PLACEMENT_COMPLETED_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Record that the current user has completed placement (persists across sessions). */
export function markPlacementCompleted(): void {
  if (typeof window === "undefined") return;
  const email = currentUserEmail();
  if (!email) return;
  const map = readCompletedMap();
  map[email] = new Date().toISOString();
  try {
    localStorage.setItem(PLACEMENT_COMPLETED_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(PLACEMENT_COMPLETED_EVENT));
  } catch {
    /* ignore */
  }
}

export function hasCompletedPlacement(): boolean {
  if (typeof window === "undefined") return false;
  const email = currentUserEmail();
  if (!email) return false;
  return Boolean(readCompletedMap()[email]);
}

/** External-store adapter so React can read completion with useSyncExternalStore. */
export function subscribePlacementCompleted(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === PLACEMENT_COMPLETED_KEY || e.key === "adaptedCurrentUser") callback();
  };
  window.addEventListener("focus", callback);
  window.addEventListener("storage", onStorage);
  window.addEventListener(PLACEMENT_COMPLETED_EVENT, callback);
  return () => {
    window.removeEventListener("focus", callback);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PLACEMENT_COMPLETED_EVENT, callback);
  };
}

export function getPlacementCompletedSnapshot(): boolean {
  return hasCompletedPlacement();
}

export function getPlacementCompletedServerSnapshot(): boolean {
  return false;
}

export function saveNumpyPlacement(payload: NumpyPlacementPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NUMPY_PLACEMENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  // Finishing placement (the only caller) means this account has taken it.
  markPlacementCompleted();
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
    const codeScore = o.codeScore;
    const totalCode = o.totalCode;
    return {
      level: o.level,
      weakTopics: o.weakTopics as string[],
      recommendedTopic: o.recommendedTopic as string | null,
      mcqScore: o.mcqScore,
      totalMcq: o.totalMcq,
      ...(typeof codeScore === "number" ? { codeScore } : {}),
      ...(typeof totalCode === "number" ? { totalCode } : {}),
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
