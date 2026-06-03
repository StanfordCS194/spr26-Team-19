/**
 * Shared helpers for scoping client-side storage to the logged-in account.
 *
 * Login state lives in localStorage under `adaptedCurrentUser`. Learning state
 * (placement results, exercise/lesson progress) should be namespaced per
 * account so two users on the same browser don't share progress, and so a
 * returning user keeps their data across sessions.
 */
export const CURRENT_USER_KEY = "adaptedCurrentUser";

export function currentUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as { email?: unknown };
    return typeof u.email === "string" ? u.email : null;
  } catch {
    return null;
  }
}

/** Namespaces a base storage key to the current account (falls back to "guest"). */
export function scopedStorageKey(base: string): string {
  return `${base}::${currentUserEmail() ?? "guest"}`;
}
