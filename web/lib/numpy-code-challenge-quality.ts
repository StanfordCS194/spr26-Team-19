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
  {
    id: "mean-reduction",
    topic: "more array operations (mean, max, min)",
    prompt:
      "Build a one-dimensional array with values 2, 4, 6, and 8. Set `answer` to the mean (average) of all its values.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([2, 4, 6, 8]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "mean-result",
        assert: "np.isclose(answer, x.mean())",
        message: "Compute the mean from your array — don't hard-code the average.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "Use the array's mean method.",
  },
  {
    id: "max-reduction",
    topic: "more array operations (mean, max, min)",
    prompt:
      "Build a one-dimensional array with values 7, 3, 9, 2, and 5. Set `answer` to the largest value in it.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([7, 3, 9, 2, 5]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "max-result",
        assert: "answer == x.max()",
        message: "Read the largest value from your array — don't hard-code it.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "Use a reduction method that returns the maximum.",
  },
  {
    id: "min-reduction",
    topic: "more array operations (mean, max, min)",
    prompt:
      "Build a one-dimensional array with values 7, 3, 9, 2, and 5. Set `answer` to the smallest value in it.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([7, 3, 9, 2, 5]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "min-result",
        assert: "answer == x.min()",
        message: "Read the smallest value from your array — don't hard-code it.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "Use a reduction method that returns the minimum.",
  },
  {
    id: "broadcast-add-scalar",
    topic: "broadcasting (array and scalar)",
    prompt:
      "Build a one-dimensional array with values 1, 2, 3, and 4. Set `answer` to a new array with 10 added to every element.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([1, 2, 3, 4]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "broadcast-result",
        assert: "np.array_equal(answer, x + 10)",
        message: "Add the scalar to your array — don't type the result by hand.",
        capture: "answer",
        skill: "broadcasting",
      },
    ],
    hint: "Adding a number to an array broadcasts it across every element.",
  },
  {
    id: "broadcast-multiply-scalar",
    topic: "broadcasting (array and scalar)",
    prompt:
      "Build a one-dimensional array with values 1, 2, 3, and 4. Set `answer` to a new array with every element multiplied by 3.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([1, 2, 3, 4]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "broadcast-result",
        assert: "np.array_equal(answer, x * 3)",
        message: "Multiply your array by the scalar — don't type the result by hand.",
        capture: "answer",
        skill: "broadcasting",
      },
    ],
    hint: "Multiplying an array by a number scales every element.",
  },
  {
    id: "elementwise-add-two",
    topic: "basic array operations (+, -, *, sum)",
    prompt:
      "Build two one-dimensional arrays: the first with 1, 2, and 3, the second with 10, 20, and 30. Set `answer` to their element-wise sum.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.array([1, 2, 3]))",
        message: "Build the first source array.",
        capture: "a",
      },
      {
        id: "source-b",
        assert: "isinstance(b, np.ndarray) and np.array_equal(b, np.array([10, 20, 30]))",
        message: "Build the second source array.",
        capture: "b",
      },
      {
        id: "sum-result",
        assert: "np.array_equal(answer, a + b)",
        message: "Add the two arrays element-wise — don't type the result.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "NumPy adds arrays element by element when they share a shape.",
  },
  {
    id: "transpose-matrix",
    topic: "transpose (.T)",
    prompt:
      "Build a 2×3 matrix whose rows are 1, 2, 3 and 4, 5, 6. Set `answer` to its transpose.",
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
        id: "transpose-result",
        assert: "np.array_equal(answer, m.T)",
        message: "Transpose your matrix — don't retype a flipped grid.",
        capture: "answer",
        skill: "shapes",
      },
    ],
    hint: "Use the `.T` attribute to swap rows and columns.",
  },
  {
    id: "flatten-2d",
    topic: "flatten a multidimensional array",
    prompt:
      "Build a 2×2 matrix whose rows are 1, 2 and 3, 4. Set `answer` to a flattened one-dimensional version of it.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-m",
        assert: "isinstance(m, np.ndarray) and np.array_equal(m, np.array([[1, 2], [3, 4]]))",
        message: "Build the matrix first.",
        capture: "m",
      },
      {
        id: "flatten-result",
        assert: "np.array_equal(answer, m.flatten())",
        message: "Flatten your matrix — don't type the 1D list yourself.",
        capture: "answer",
        skill: "shapes",
      },
    ],
    hint: "Use `.flatten()` (or `.ravel()`) to collapse the matrix to 1D.",
  },
  {
    id: "reverse-1d",
    topic: "reversing an array",
    prompt:
      "Build a one-dimensional array with values 1, 2, 3, 4, and 5. Set `answer` to the array reversed, so the last element comes first.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([1, 2, 3, 4, 5]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "reverse-result",
        assert: "np.array_equal(answer, x[::-1])",
        message: "Reverse your array with slicing — don't retype it backwards.",
        capture: "answer",
        skill: "indexing",
      },
    ],
    hint: "A slice with step -1 walks the array backwards.",
  },
  {
    id: "sort-1d",
    topic: "sorting array elements",
    prompt:
      "Build a one-dimensional array with values 4, 1, 3, and 2. Set `answer` to its values sorted in ascending order.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([4, 1, 3, 2]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "sort-result",
        assert: "np.array_equal(answer, np.sort(x))",
        message: "Sort your array — don't type the ordered values directly.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "`np.sort` returns a new array in ascending order.",
  },
  {
    id: "unique-values",
    topic: "unique items and counts",
    prompt:
      "Build a one-dimensional array with values 1, 2, 2, 3, 3, and 3. Set `answer` to the unique values it contains.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([1, 2, 2, 3, 3, 3]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "unique-result",
        assert: "np.array_equal(answer, np.unique(x))",
        message: "Use np.unique on your array — don't type the unique list yourself.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "`np.unique` returns the sorted, de-duplicated values.",
  },
  {
    id: "where-indices",
    topic: "indexing and slicing",
    prompt:
      "Build a one-dimensional array with values 5, 12, 7, 20, and 3. Set `answer` to the indices (positions) where the value is greater than 8.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-x",
        assert: "isinstance(x, np.ndarray) and np.array_equal(x, np.array([5, 12, 7, 20, 3]))",
        message: "Build the source array first.",
        capture: "x",
      },
      {
        id: "where-result",
        assert: "np.array_equal(answer, np.where(x > 8)[0])",
        message: "Find the matching positions from your array — don't hard-code indices.",
        capture: "answer",
        skill: "indexing",
      },
    ],
    hint: "`np.where(condition)` returns the indices where the condition holds.",
  },
  {
    id: "concatenate-two",
    topic: "creating arrays from existing data",
    prompt:
      "Build two one-dimensional arrays: the first with 1, 2, and 3, the second with 4, 5, and 6. Set `answer` to the two arrays joined end to end into a single array.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.array([1, 2, 3]))",
        message: "Build the first source array.",
        capture: "a",
      },
      {
        id: "source-b",
        assert: "isinstance(b, np.ndarray) and np.array_equal(b, np.array([4, 5, 6]))",
        message: "Build the second source array.",
        capture: "b",
      },
      {
        id: "concat-result",
        assert: "np.array_equal(answer, np.concatenate([a, b]))",
        message: "Join the two arrays — don't type the combined list.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "`np.concatenate` joins arrays end to end along an axis.",
  },
  {
    id: "vstack-two",
    topic: "creating arrays from existing data",
    prompt:
      "Build two one-dimensional arrays: the first with 1, 2, and 3, the second with 4, 5, and 6. Set `answer` to a 2×3 matrix formed by stacking the first array on top of the second.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.array([1, 2, 3]))",
        message: "Build the first source array.",
        capture: "a",
      },
      {
        id: "source-b",
        assert: "isinstance(b, np.ndarray) and np.array_equal(b, np.array([4, 5, 6]))",
        message: "Build the second source array.",
        capture: "b",
      },
      {
        id: "vstack-result",
        assert: "np.array_equal(answer, np.vstack([a, b]))",
        message: "Stack the two arrays vertically — don't type the grid.",
        capture: "answer",
        skill: "shapes",
      },
    ],
    hint: "`np.vstack` stacks arrays as rows of a new matrix.",
  },
  {
    id: "linspace-build",
    topic: "create a basic array (arange, linspace)",
    prompt:
      "Use NumPy to build an array of 5 evenly spaced numbers from 0 to 1, including both ends. Set `answer` to that array.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "answer-shape",
        assert: "isinstance(answer, np.ndarray) and answer.shape == (5,)",
        message: "answer should be a 1D array of 5 numbers.",
        capture: "answer",
        skill: "array-creation",
      },
      {
        id: "linspace-values",
        assert: "np.allclose(answer, np.linspace(0, 1, 5))",
        message: "Generate the evenly spaced values — don't type them by hand.",
        capture: "answer",
        skill: "array-creation",
      },
    ],
    hint: "`np.linspace(start, stop, num)` includes both endpoints.",
  },
  {
    id: "dot-product",
    topic: "math formulas",
    prompt:
      "Build two one-dimensional arrays: the first with 1, 2, and 3, the second with 4, 5, and 6. Set `answer` to the dot product of the two arrays.",
    starterCode: MINIMAL_STARTER_CODE,
    checks: [
      {
        id: "source-a",
        assert: "isinstance(a, np.ndarray) and np.array_equal(a, np.array([1, 2, 3]))",
        message: "Build the first source array.",
        capture: "a",
      },
      {
        id: "source-b",
        assert: "isinstance(b, np.ndarray) and np.array_equal(b, np.array([4, 5, 6]))",
        message: "Build the second source array.",
        capture: "b",
      },
      {
        id: "dot-result",
        assert: "answer == a.dot(b)",
        message: "Compute the dot product from your arrays — don't hard-code the total.",
        capture: "answer",
        skill: "operations",
      },
    ],
    hint: "The dot product multiplies matching elements and sums them.",
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
