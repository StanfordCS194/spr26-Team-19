/**
 * Saved code problems, namespaced per account (same scoped-key pattern as the
 * other progress stores). Lets learners bookmark a code challenge and revisit it
 * later from the dashboard.
 *
 * Exposes a useSyncExternalStore adapter (stable snapshots, custom same-tab event)
 * so the save button and dashboard list stay in sync without setState-in-effect.
 */
import { CURRENT_USER_KEY, scopedStorageKey } from "@/lib/current-user";
import type { CodeChallengeCheck } from "@/lib/numpy-code-validate";

export const SAVED_PROBLEMS_STORAGE_KEY = "adapted.numpy.savedProblems.v1";
const SAVED_PROBLEMS_EVENT = "adapted-saved-problems-change";
/** Cap so a runaway session can't bloat localStorage. */
const MAX_SAVED = 100;

export type SavedProblem = {
  /** Stable key — the challenge id. */
  id: string;
  topic: string;
  prompt: string;
  hint: string;
  /** Editor template to restore when the problem is reopened. */
  starterCode?: string;
  checks?: CodeChallengeCheck[];
  expectedOutputs?: string[];
  /** ISO timestamp of when it was saved. */
  savedAt: string;
};

function storageKey(): string {
  return scopedStorageKey(SAVED_PROBLEMS_STORAGE_KEY);
}

function isSavedProblem(v: unknown): v is SavedProblem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.topic === "string" &&
    typeof o.prompt === "string" &&
    typeof o.hint === "string" &&
    typeof o.savedAt === "string"
  );
}

export function loadSavedProblems(): SavedProblem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedProblem);
  } catch {
    return [];
  }
}

function persist(problems: SavedProblem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(problems.slice(0, MAX_SAVED)));
    window.dispatchEvent(new Event(SAVED_PROBLEMS_EVENT));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function isProblemSaved(id: string): boolean {
  return loadSavedProblems().some((p) => p.id === id);
}

export function findSavedProblem(id: string): SavedProblem | null {
  return loadSavedProblems().find((p) => p.id === id) ?? null;
}

/** Add a problem (newest first); no-op if already saved. */
export function saveProblem(problem: Omit<SavedProblem, "savedAt">): void {
  const existing = loadSavedProblems();
  if (existing.some((p) => p.id === problem.id)) return;
  persist([{ ...problem, savedAt: new Date().toISOString() }, ...existing]);
}

export function removeSavedProblem(id: string): void {
  persist(loadSavedProblems().filter((p) => p.id !== id));
}

/** Toggle saved state; returns the new state (true = now saved). */
export function toggleSavedProblem(problem: Omit<SavedProblem, "savedAt">): boolean {
  if (isProblemSaved(problem.id)) {
    removeSavedProblem(problem.id);
    return false;
  }
  saveProblem(problem);
  return true;
}

/* —— useSyncExternalStore adapter —— */

let cachedRaw: string | null = null;
let cachedValue: SavedProblem[] = [];
const EMPTY: SavedProblem[] = [];

export function getSavedProblemsSnapshot(): SavedProblem[] {
  if (typeof window === "undefined") return EMPTY;
  const key = storageKey();
  const raw = `${key}\u0000${window.localStorage.getItem(key) ?? ""}`;
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = loadSavedProblems();
  return cachedValue;
}

export function getSavedProblemsServerSnapshot(): SavedProblem[] {
  return EMPTY;
}

export function subscribeSavedProblems(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === null ||
      e.key === CURRENT_USER_KEY ||
      e.key.startsWith(SAVED_PROBLEMS_STORAGE_KEY)
    ) {
      callback();
    }
  };
  window.addEventListener("focus", callback);
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAVED_PROBLEMS_EVENT, callback);
  return () => {
    window.removeEventListener("focus", callback);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAVED_PROBLEMS_EVENT, callback);
  };
}
