/**
 * Achievement badge system. Badges are earned once and stored in per-user
 * localStorage — same scoped-key pattern as the rest of the progress stores.
 *
 * Callers award badges by calling tryAwardBadge(id). It returns the Badge
 * object only the first time it's earned, so components can show a toast.
 * Subsequent calls for the same id return null (idempotent).
 */
import { scopedStorageKey } from "@/lib/current-user";

export type Badge = {
  id: string;
  icon: string;
  name: string;
  description: string;
};

export const ALL_BADGES: Badge[] = [
  {
    id: "first-correct",
    icon: "🎯",
    name: "First Strike",
    description: "Got your first MCQ answer correct",
  },
  {
    id: "first-code",
    icon: "💻",
    name: "Code Runner",
    description: "Passed your first code challenge",
  },
  {
    id: "placed",
    icon: "🧭",
    name: "Placed",
    description: "Completed the placement quiz",
  },
  {
    id: "first-mastery",
    icon: "📚",
    name: "Scholar",
    description: "Mastered your first lesson",
  },
  {
    id: "streak-3",
    icon: "🔥",
    name: "On Fire",
    description: "Kept a 3-day learning streak",
  },
  {
    id: "tier-bronze",
    icon: "🥉",
    name: "Bronze",
    description: "Reached Bronze tier (100 XP)",
  },
  {
    id: "tier-silver",
    icon: "🥈",
    name: "Silver",
    description: "Reached Silver tier (300 XP)",
  },
  {
    id: "tier-gold",
    icon: "🥇",
    name: "Gold",
    description: "Reached Gold tier (600 XP)",
  },
  {
    id: "tier-platinum",
    icon: "💎",
    name: "Platinum",
    description: "Reached Platinum tier (1000 XP)",
  },
];

const BADGES_KEY = "adapted.badges.v1";
const BADGES_CHANGE_EVENT = "adapted-badges-change";

function badgesStorageKey(): string {
  return scopedStorageKey(BADGES_KEY);
}

function loadEarnedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(badgesStorageKey());
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set((arr as unknown[]).filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

let _cachedRaw: string | null = null;
let _cachedValue: Badge[] | null = null;

function saveEarnedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(badgesStorageKey(), JSON.stringify([...ids]));
    _cachedRaw = null;
    window.dispatchEvent(new Event(BADGES_CHANGE_EVENT));
  } catch { /* quota */ }
}

/**
 * Try to award a badge. Returns the Badge if this is the first time it's
 * earned so the caller can show a notification. Returns null if already earned.
 */
export function tryAwardBadge(id: string): Badge | null {
  const earned = loadEarnedIds();
  if (earned.has(id)) return null;
  const badge = ALL_BADGES.find((b) => b.id === id);
  if (!badge) return null;
  earned.add(id);
  saveEarnedIds(earned);
  return badge;
}

/** Award the appropriate tier badge for the given XP total. */
export function checkTierBadge(xpTotal: number): Badge | null {
  if (xpTotal >= 1000) return tryAwardBadge("tier-platinum");
  if (xpTotal >= 600)  return tryAwardBadge("tier-gold");
  if (xpTotal >= 300)  return tryAwardBadge("tier-silver");
  if (xpTotal >= 100)  return tryAwardBadge("tier-bronze");
  return null;
}

/** Award the streak badge when the learner hits a 3-day streak. */
export function checkStreakBadge(streak: number): Badge | null {
  if (streak >= 3) return tryAwardBadge("streak-3");
  return null;
}

export function getEarnedBadges(): Badge[] {
  const earned = loadEarnedIds();
  return ALL_BADGES.filter((b) => earned.has(b.id));
}

// ─── React external-store adapter ────────────────────────────────────────────

const EMPTY_BADGES: Badge[] = [];

export function getBadgesSnapshot(): Badge[] {
  if (typeof window === "undefined") return EMPTY_BADGES;
  const key = badgesStorageKey();
  const raw = `${key} ${window.localStorage.getItem(key) ?? ""}`;
  if (raw === _cachedRaw && _cachedValue !== null) return _cachedValue;
  _cachedRaw = raw;
  _cachedValue = getEarnedBadges();
  return _cachedValue;
}

export function getBadgesServerSnapshot(): Badge[] {
  return EMPTY_BADGES;
}

export function subscribeBadges(callback: () => void): () => void {
  window.addEventListener(BADGES_CHANGE_EVENT, callback);
  window.addEventListener("focus", callback);
  return () => {
    window.removeEventListener(BADGES_CHANGE_EVENT, callback);
    window.removeEventListener("focus", callback);
  };
}
