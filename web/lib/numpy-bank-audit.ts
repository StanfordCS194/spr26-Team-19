/**
 * Dev-only audit harness for the curated coding-problem banks.
 *
 * The curated challenges feed the *fallback* code lab (used when the AI is
 * unavailable), so a malformed problem can't break the happy path — but it can
 * still ship a broken drill. This module is the guard against that:
 *
 *  1. `auditCuratedBanks()` — pure, UI-free static checks (no Pyodide):
 *     unique ids, ≥2 checks with the required fields, a captured result check,
 *     a non-empty starter + reference solution, and that every problem passes
 *     the SAME `isWeakCodeChallenge` anti-shortcut gate the generator enforces.
 *  2. `REFERENCE_SOLUTIONS` — a known-correct solution per curated id, used by
 *     the `/dev/bank-check` page to execute each problem through the real
 *     Pyodide grader and prove it is solvable and graded correctly.
 *
 * Nothing here is imported by the learner-facing app at runtime.
 */
import {
  CURATED_CODE_CHALLENGES,
  isWeakCodeChallenge,
  type CuratedCodeChallenge,
} from "@/lib/numpy-code-challenge-quality";
import { allCurriculumCodeChallenges } from "@/lib/numpy-code-topics";

/**
 * Known-correct solution for every curated challenge id. Solutions assign the
 * source variable(s) and `answer`; `np` is already in the grading namespace, so
 * the explicit import is only there to keep each solution self-contained.
 */
export const REFERENCE_SOLUTIONS: Record<string, string> = {
  // ── pre-existing curated challenges ────────────────────────────────────────
  "slice-middle": "import numpy as np\na = np.array([10, 20, 30, 40, 50])\nanswer = a[1:4]",
  "boolean-mask": "import numpy as np\na = np.array([3, 7, 2, 9, 4])\nanswer = a[a > 5]",
  "reshape-arange": "import numpy as np\na = np.arange(6)\nanswer = a.reshape(3, 2)",
  "column-newaxis": "import numpy as np\na = np.array([1, 2, 3])\nanswer = a[:, np.newaxis]",
  "sum-reduction": "import numpy as np\nx = np.array([1, 2, 3, 4])\nanswer = x.sum()",
  "shape-from-array":
    "import numpy as np\nm = np.array([[1, 2, 3], [4, 5, 6]])\nanswer = m.shape",
  // ── added curated challenges ───────────────────────────────────────────────
  "mean-reduction": "import numpy as np\nx = np.array([2, 4, 6, 8])\nanswer = x.mean()",
  "max-reduction": "import numpy as np\nx = np.array([7, 3, 9, 2, 5])\nanswer = x.max()",
  "min-reduction": "import numpy as np\nx = np.array([7, 3, 9, 2, 5])\nanswer = x.min()",
  "broadcast-add-scalar": "import numpy as np\nx = np.array([1, 2, 3, 4])\nanswer = x + 10",
  "broadcast-multiply-scalar": "import numpy as np\nx = np.array([1, 2, 3, 4])\nanswer = x * 3",
  "elementwise-add-two":
    "import numpy as np\na = np.array([1, 2, 3])\nb = np.array([10, 20, 30])\nanswer = a + b",
  "transpose-matrix":
    "import numpy as np\nm = np.array([[1, 2, 3], [4, 5, 6]])\nanswer = m.T",
  "flatten-2d": "import numpy as np\nm = np.array([[1, 2], [3, 4]])\nanswer = m.flatten()",
  "reverse-1d": "import numpy as np\nx = np.array([1, 2, 3, 4, 5])\nanswer = x[::-1]",
  "sort-1d": "import numpy as np\nx = np.array([4, 1, 3, 2])\nanswer = np.sort(x)",
  "unique-values": "import numpy as np\nx = np.array([1, 2, 2, 3, 3, 3])\nanswer = np.unique(x)",
  "where-indices":
    "import numpy as np\nx = np.array([5, 12, 7, 20, 3])\nanswer = np.where(x > 8)[0]",
  "concatenate-two":
    "import numpy as np\na = np.array([1, 2, 3])\nb = np.array([4, 5, 6])\nanswer = np.concatenate([a, b])",
  "vstack-two":
    "import numpy as np\na = np.array([1, 2, 3])\nb = np.array([4, 5, 6])\nanswer = np.vstack([a, b])",
  "linspace-build": "import numpy as np\nanswer = np.linspace(0, 1, 5)",
  "dot-product":
    "import numpy as np\na = np.array([1, 2, 3])\nb = np.array([4, 5, 6])\nanswer = a.dot(b)",
};

export function referenceSolutionFor(id: string): string | null {
  return REFERENCE_SOLUTIONS[id] ?? null;
}

export type ChallengeAuditResult = {
  id: string;
  topic: string;
  /** Empty when the challenge passes every static check. */
  issues: string[];
};

export type BankAuditReport = {
  ok: boolean;
  totalCurated: number;
  totalCurriculum: number;
  /** Ids that appear more than once across curated + curriculum challenges. */
  duplicateIds: string[];
  results: ChallengeAuditResult[];
};

/** Static checks for a single curated challenge (no code execution). */
function auditChallenge(c: CuratedCodeChallenge): ChallengeAuditResult {
  const issues: string[] = [];

  if (typeof c.starterCode !== "string" || c.starterCode.trim() === "") {
    issues.push("missing starterCode");
  }
  if (!Array.isArray(c.checks) || c.checks.length < 2) {
    issues.push("needs at least 2 checks (source + result)");
  } else {
    c.checks.forEach((check, i) => {
      if (!check.id?.trim()) issues.push(`check[${i}] missing id`);
      if (!check.assert?.trim()) issues.push(`check[${i}] missing assert`);
      if (!check.message?.trim()) issues.push(`check[${i}] missing message`);
    });
    const hasCapturedResult = c.checks.some((check) => check.capture?.trim());
    if (!hasCapturedResult) {
      issues.push("no check captures a value (need a result check with `capture`)");
    }
  }

  // Reuse the production anti-shortcut gate so curated content can never drift
  // below what the generator is held to.
  const gate = isWeakCodeChallenge(c.prompt, c.checks ?? []);
  if (gate) issues.push(`quality gate: ${gate}`);

  const solution = REFERENCE_SOLUTIONS[c.id];
  if (typeof solution !== "string" || solution.trim() === "") {
    issues.push("missing reference solution (add to REFERENCE_SOLUTIONS)");
  } else if (!/\banswer\b/.test(solution)) {
    issues.push("reference solution never assigns `answer`");
  }

  return { id: c.id, topic: c.topic, issues };
}

/**
 * Audit the curated bank plus curriculum-derived challenges. Returns a report;
 * `ok` is true only when there are no duplicate ids and every curated challenge
 * passes all static checks.
 */
export function auditCuratedBanks(): BankAuditReport {
  const curriculum = allCurriculumCodeChallenges();

  // Duplicate-id detection across both pools.
  const counts = new Map<string, number>();
  for (const c of [...CURATED_CODE_CHALLENGES, ...curriculum]) {
    counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  }
  const duplicateIds = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  const results = CURATED_CODE_CHALLENGES.map(auditChallenge);
  const ok = duplicateIds.length === 0 && results.every((r) => r.issues.length === 0);

  return {
    ok,
    totalCurated: CURATED_CODE_CHALLENGES.length,
    totalCurriculum: curriculum.length,
    duplicateIds,
    results,
  };
}
