/**
 * Scaffold for every code challenge: the import, a place to work, and an
 * explicit `answer` line. Grading only ever reads `answer`, so learners can
 * structure the middle however they like — they just set `answer` at the end.
 */
export const MINIMAL_STARTER_CODE =
  "import numpy as np\n\n# your code here\n\nanswer = None\n";

/** Always return the minimal template; LLM or legacy starters cannot add setup code. */
export function sanitizeStarterCode(_code?: string): string {
  return MINIMAL_STARTER_CODE;
}
