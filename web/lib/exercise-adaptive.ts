export type DrillDifficulty = "easy" | "medium" | "hard";

/** Topic the learner missed most this session; falls back to placement/URL focus. */
export function pickFocusTopic(
  topicMistakes: Record<string, number>,
  fallback?: string,
): string | undefined {
  const entries = Object.entries(topicMistakes).sort((a, b) => b[1] - a[1]);
  const weakest = entries[0]?.[0];
  if (weakest) return weakest;
  return fallback?.trim() || undefined;
}

/** Session accuracy → easy / medium / hard (same thresholds as placement). */
export function difficultyFromSession(
  attempted: number,
  correct: number,
): DrillDifficulty {
  if (attempted < 2) return "easy";
  const accuracy = correct / attempted;
  if (accuracy < 0.7) return "easy";
  if (accuracy >= 0.85 && attempted >= 4) return "hard";
  return "medium";
}
