/**
 * Shared fallback multiple-choice bank for the Exercises MCQ drill.
 *
 * When the AI question generator is unavailable (no API key, rate limit, or a
 * malformed response), the drill needs a local question. Previously the
 * Exercises page fell back to a single hard-coded question and repeated it every
 * time. This bank + the deterministic `pickFallbackMcq` rotation give the drill
 * variety in degraded mode, mirroring the rotating fallbacks the placement and
 * quiz pages already use.
 *
 * Questions test beginner NumPy reasoning (not syntax trivia) and follow the
 * same shape the live generator returns, so the page treats generated and
 * fallback questions identically.
 */
export type FallbackMcq = {
  topic: string;
  prompt: string;
  /** Exactly four options. */
  choices: string[];
  /** Index (0–3) of the correct option in `choices`. */
  correctIndex: number;
  explanation: string;
  hint?: string;
};

export const FALLBACK_MCQ_BANK: FallbackMcq[] = [
  {
    topic: "indexing",
    prompt: "In NumPy, what does `arr[0]` return for a 1D array?",
    choices: ["The first element", "The last element", "A copy of the array", "The dtype only"],
    correctIndex: 0,
    explanation: "Index 0 selects the first element in a 0-based array.",
    hint: "Python and NumPy use 0-based indexing.",
  },
  {
    topic: "array attributes",
    prompt: "What is the shape of the array returned by `np.zeros((2, 3))`?",
    choices: ["(3, 2)", "(6,)", "(2, 3)", "(2,)"],
    correctIndex: 2,
    explanation: "np.zeros takes the shape tuple directly, so you get 2 rows and 3 columns.",
    hint: "The tuple you pass to np.zeros is the shape.",
  },
  {
    topic: "array creation",
    prompt: "What array does `np.arange(1, 6)` produce?",
    choices: ["[1, 2, 3, 4, 5, 6]", "[1, 2, 3, 4, 5]", "[0, 1, 2, 3, 4, 5]", "[1, 6]"],
    correctIndex: 1,
    explanation: "np.arange(start, stop) includes start but excludes stop.",
    hint: "The stop value is exclusive.",
  },
  {
    topic: "array operations",
    prompt: "For `a = np.array([1, 2, 3])`, what is `a * 2`?",
    choices: ["[1, 2, 3, 1, 2, 3]", "[1, 4, 9]", "An error", "[2, 4, 6]"],
    correctIndex: 3,
    explanation:
      "NumPy multiplies element-wise, unlike a Python list which would repeat its contents.",
    hint: "NumPy arithmetic applies to each element.",
  },
  {
    topic: "boolean indexing",
    prompt: "For `a = np.array([1, 2, 3, 4])`, what does `a[a > 2]` return?",
    choices: ["[3, 4]", "[True, True]", "[1, 2]", "[2, 3, 4]"],
    correctIndex: 0,
    explanation: "The boolean mask keeps only the elements where the condition is True.",
    hint: "Which elements are greater than 2?",
  },
  {
    topic: "aggregation",
    prompt: "What does `np.array([[1, 2], [3, 4]]).sum()` return?",
    choices: ["[4, 6]", "[3, 7]", "10", "[[1, 2], [3, 4]]"],
    correctIndex: 2,
    explanation: "With no axis, sum reduces every element: 1 + 2 + 3 + 4 = 10.",
    hint: "Without an axis, the whole array collapses to one number.",
  },
  {
    topic: "array attributes",
    prompt: "What is `np.array([[1, 2, 3], [4, 5, 6]]).ndim`?",
    choices: ["1", "2", "3", "6"],
    correctIndex: 1,
    explanation: "It has rows and columns, so it is a 2-dimensional array.",
    hint: "Count the levels of nesting.",
  },
  {
    topic: "shapes",
    prompt: "Which reshape is valid for an array of 12 elements?",
    choices: ["reshape(4, 3)", "reshape(3, 5)", "reshape(2, 5)", "reshape(7, 2)"],
    correctIndex: 0,
    explanation: "The new shape must multiply to the same element count: 4 × 3 = 12.",
    hint: "The dimensions must multiply to the number of elements.",
  },
  {
    topic: "data types",
    prompt: "What dtype does `np.array([1.0, 2.0, 3.0])` have?",
    choices: ["int64", "complex128", "bool", "float64"],
    correctIndex: 3,
    explanation: "All inputs are floats, so NumPy infers a floating-point dtype.",
    hint: "Look at the kind of numbers in the list.",
  },
  {
    topic: "broadcasting",
    prompt: "For `a = np.array([10, 20, 30])`, what is `a + 5`?",
    choices: ["[15, 20, 30]", "[15, 25, 35]", "[10, 20, 30, 5]", "An error"],
    correctIndex: 1,
    explanation: "The scalar 5 is broadcast and added to every element.",
    hint: "Adding a scalar affects each element.",
  },
  {
    topic: "indexing and slicing",
    prompt: "For `a = np.array([0, 1, 2, 3, 4])`, what does `a[1:4]` return?",
    choices: ["[1, 2, 3, 4]", "[0, 1, 2, 3]", "[1, 2, 3]", "[2, 3, 4]"],
    correctIndex: 2,
    explanation: "A slice includes the start index and excludes the stop index: positions 1, 2, 3.",
    hint: "The stop index is exclusive.",
  },
  {
    topic: "array creation",
    prompt: "How many numbers does `np.linspace(0, 1, 5)` produce?",
    choices: ["4", "5", "6", "infinitely many"],
    correctIndex: 1,
    explanation: "The third argument is the count of evenly spaced points, including both ends.",
    hint: "The third argument is the number of samples.",
  },
];

/**
 * Pick a fallback question, preferring one whose prompt hasn't been shown yet.
 * Deterministic (no randomness) so it's easy to reason about and test: once
 * every prompt has been seen, it rotates by the number seen so far.
 */
export function pickFallbackMcq(seenPrompts: string[]): FallbackMcq {
  const unseen = FALLBACK_MCQ_BANK.find((q) => !seenPrompts.includes(q.prompt));
  if (unseen) return unseen;
  return FALLBACK_MCQ_BANK[seenPrompts.length % FALLBACK_MCQ_BANK.length]!;
}
