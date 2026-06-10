/** Blank editor template for every code challenge — no setup, no hints. */
export const MINIMAL_STARTER_CODE = "import numpy as np\n";

/** Always return the minimal template; LLM or legacy starters cannot add setup code. */
export function sanitizeStarterCode(_code?: string): string {
  return MINIMAL_STARTER_CODE;
}
