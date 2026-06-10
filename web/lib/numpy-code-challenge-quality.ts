import type { CodeChallengeCheck } from "@/lib/numpy-code-validate";
import { MINIMAL_STARTER_CODE } from "@/lib/numpy-starter-code";
import { promptAmbiguityIssues } from "@/lib/numpy-prompt-style";
import {
  allCurriculumCodeChallenges,
  curriculumCodeChallengeForFocus,
  resolveLessonForFocus,
} from "@/lib/numpy-code-topics";
import { slugifyTopic } from "@/lib/numpy-learning-path";

export type CuratedCodeChallenge = {
  id: string;
  topic: string;
  prompt: string;
  starterCode: string;
  checks: CodeChallengeCheck[];
  hint: string;
};

/** Prompts describe the task in plain English — no Python setup code (digits like 5, 15 are fine). */
export function promptHasCodeLiterals(prompt: string): boolean {
  return (
    /np\.(array|arange|zeros|ones|linspace|reshape|newaxis)\s*\(/i.test(prompt) ||
    /`[^`]*=\s*[^`]+`/i.test(prompt) ||
    /\bcreate\s+`?\w+`?\s*=/i.test(prompt) ||
    /\bstart with\s+`?\w+`?\s*=/i.test(prompt)
  );
}

/** Hand-authored drills that require real NumPy ops — not shortcuttable metadata answers. */
export const CURATED_CODE_CHALLENGES: CuratedCodeChallenge[] = [
  {
    id: "slice-middle",
    topic: "indexing and slicing",
    prompt:
      "Build a one-dimensional array with values 10, 20, 30, 40, and 50. Set `answer` to the three middle elements (20, 30, and 40).",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert:
          "isinstance(a, np.ndarray) and np.array_equal(a, np.array([10, 20, 30, 40, 50]))",
        message: "Build the source array first.",
        capture: "a",
      },
      {
        id: "slice-result",
        assert: "np.array_equal(answer, a[1:4])",
        message: "Slice your array — don't hard-code the result.",
        capture: "answer",
        skill: "indexing",
      },
    ],
    hint: "Use slicing with start index 1 and end index 4.",
  },
  {
    id: "boolean-mask",
    topic: "indexing and slicing",
    prompt:
      "Build a one-dimensional array with values 3, 7, 2, 9, and 4. Set `answer` to the elements greater than 5.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.array([3, 7, 2, 9, 4]))",
        message: "Build the source array first.",
        capture: "a",
      },
      {
        id: "mask-result",
        assert: "np.array_equal(answer, a[a > 5])",
        message: "Use boolean indexing on your array.",
        capture: "answer",
        skill: "indexing",
      },
    ],
    hint: "Filter with a comparison, then index with the resulting mask.",
  },
  {
    id: "reshape-arange",
    topic: "reshaping arrays (reshape)",
    prompt:
      "Build an array of integers 0 through 5, then set `answer` to a 3×2 reshape of that array.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.arange(6))",
        message: "Build the 0–5 array first.",
        capture: "a",
      },
      {
        id: "reshape-result",
        assert: "np.array_equal(answer, a.reshape(3, 2))",
        message: "Reshape your array — don't paste a literal grid.",
        capture: "answer",
        skill: "shapes",
      },
    ],
    hint: "Call `.reshape(3, 2)` on your array.",
  },
  {
    id: "column-newaxis",
    topic: "adding a new axis (np.newaxis, expand_dims)",
    prompt:
      "Start with a one-dimensional array containing 1, 2, and 3. Set `answer` to its column-vector form with shape (3, 1).",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.array([1, 2, 3]))",
        message: "Build the 1D array first.",
        capture: "a",
      },
      {
        id: "newaxis-result",
        assert: "np.array_equal(answer, a[:, np.newaxis])",
        message: "Derive the column from your array with np.newaxis.",
        capture: "answer",
        skill: "shapes",
      },
    ],
    hint: "Add a new axis to turn the vector into a column.",
  },
  {
    id: "sum-reduction",
    topic: "basic array operations (+, -, *, sum)",
    prompt:
      "Build a one-dimensional array with values 1, 2, 3, and 4. Set `answer` to the total of all its values.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([1, 2, 3, 4]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "sum-result",
        assert: "answer == x.sum()",
        message: "Compute the sum from your array — don't hard-code the total.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "Use a reduction method on the array.",
  },
  {
    id: "shape-from-array",
    topic: "array attributes (ndim, shape, size, dtype)",
    prompt:
      "Build a 2×3 matrix whose rows are 1, 2, 3 and 4, 5, 6. Set `answer` to that matrix's shape (read it from the array).",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-m",
        assert:
          "isinstance(m, np.ndarray) and np.array_equal(m, np.array([[1, 2, 3], [4, 5, 6]]))",
        message: "Build the matrix first.",
        capture: "m",
      },
      {
        id: "shape-result",
        assert: "answer == m.shape",
        message: "Read the shape from your matrix — don't type the tuple yourself.",
        capture: "answer",
        skill: "shapes",
      },
    ],
    hint: "Use the `.shape` attribute of your matrix.",
  },
];

const OPERATION_VERBS =
  /slice|reshape|arange|index|sum|mean|copy|transpose|flatten|stack|boolean|mask|diagonal|newaxis|element|first|last|multiply|reverse|greater|less|where|dot|column|row|extract|filter/i;

function sourceVarsFromChecks(checks: CodeChallengeCheck[]): string[] {
  const vars = new Set<string>();
  for (const c of checks) {
    const m = /isinstance\((\w+)/.exec(c.assert);
    if (m?.[1]) vars.add(m[1]);
  }
  return [...vars];
}

/** Reject exercises answerable by hard-coding length, shape, or literals. */
export function isWeakCodeChallenge(
  prompt: string,
  checks: CodeChallengeCheck[],
): string | null {
  if (promptHasCodeLiterals(prompt)) {
    return "prompt must not contain code literals or assignment snippets";
  }

  const ambiguous = promptAmbiguityIssues(prompt);
  if (ambiguous) return ambiguous;

  if (checks.length < 2) {
    return "need at least 2 checks (source + result)";
  }

  const asserts = checks.map((c) => c.assert);
  const hasArrayEqual = asserts.some((a) => a.includes("array_equal"));
  const referencesSource = asserts.some((a) =>
    /\b(a|b|x|m|arr|data|col|matrix)\b/.test(a),
  );

  const sourceVars = sourceVarsFromChecks(checks);
  const derivedAsserts = asserts.filter((a) => !a.includes("isinstance("));
  for (const v of sourceVars) {
    const usedInDerivation = derivedAsserts.some((a) => new RegExp(`\\b${v}\\b`).test(a));
    if (!usedInDerivation) {
      return `checks must derive answer from source variable \`${v}\``;
    }
  }

  const onlyMetadata = asserts.every(
    (a) =>
      /shape|len\(|ndim|size|is not None|\.item\(\)/.test(a) && !a.includes("array_equal"),
  );
  if (onlyMetadata) {
    return "checks only test metadata (shape/length), not a real operation";
  }

  const metaOnlyPrompt =
    /\b(length|shape|size|how many|number of elements|dimension)\b/i.test(prompt) &&
    !OPERATION_VERBS.test(prompt);
  if (metaOnlyPrompt && !hasArrayEqual && !referencesSource) {
    return "prompt asks only for metadata without an operation";
  }

  const literalShapeShortcut = asserts.some(
    (a) => /answer\s*==\s*\(/.test(a) && !referencesSource,
  );
  if (literalShapeShortcut) {
    return "answer can be shortcut with a literal tuple";
  }

  const lenOnly = asserts.some((a) => /len\s*\(\s*answer\s*\)/.test(a)) && !hasArrayEqual;
  if (lenOnly) {
    return "answer can be shortcut by setting length only";
  }

  return null;
}

export function pickCuratedCodeChallenge(
  focusTopic?: string,
  excludeIds: string[] = [],
): CuratedCodeChallenge {
  const fromLesson = curriculumCodeChallengeForFocus(focusTopic);
  if (fromLesson && !excludeIds.includes(fromLesson.id)) {
    return fromLesson;
  }

  const lesson = resolveLessonForFocus(focusTopic);
  const lessonSlug = slugifyTopic(lesson.focus);
  const matching = CURATED_CODE_CHALLENGES.filter(
    (c) => !excludeIds.includes(c.id) && slugifyTopic(c.topic) === lessonSlug,
  );
  if (matching.length > 0) {
    return matching[Math.floor(Math.random() * matching.length)]!;
  }

  const curriculumPool = allCurriculumCodeChallenges().filter(
    (c) => !excludeIds.includes(c.id),
  );
  if (curriculumPool.length > 0) {
    return curriculumPool[Math.floor(Math.random() * curriculumPool.length)]!;
  }

  const pool = CURATED_CODE_CHALLENGES.filter((c) => !excludeIds.includes(c.id));
  const choices = pool.length > 0 ? pool : CURATED_CODE_CHALLENGES;
  return choices[Math.floor(Math.random() * choices.length)]!;
}
