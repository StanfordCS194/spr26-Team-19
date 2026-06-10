import {
  allLessons,
  findLesson,
  NUMPY_LESSON_COUNT,
  type Lesson,
  type LessonPractice,
} from "@/lib/numpy-curriculum";
import type { CodeChallengeCheck } from "@/lib/numpy-code-validate";
import { MINIMAL_STARTER_CODE } from "@/lib/numpy-starter-code";
import { slugifyTopic } from "@/lib/numpy-learning-path";

export type CurriculumCodeChallenge = {
  id: string;
  topic: string;
  prompt: string;
  starterCode: string;
  checks: CodeChallengeCheck[];
  hint: string;
};

/**
 * What kind of Pyodide code task fits each of the 27 curriculum lessons.
 * Generator + reviewer use this instead of a one-size-fits-all slice template.
 */
export const LESSON_CODE_TASK_GUIDES: Record<string, string> = {
  "import-numpy":
    "Import NumPy and build a small array described in words (e.g. three integers); answer is that array.",
  "reading-example-code":
    "Build a 1D array from described values; answer is one element — read code behavior, not syntax trivia.",
  "why-numpy":
    "Build two 1D arrays and set answer to their element-wise sum (show vectorized math).",
  "what-is-an-array":
    "Build a 2D array with described rows; answer is the full ndarray.",
  "array-fundamentals":
    "Build a 1D array; answer is a single element via zero-based indexing.",
  "array-attributes":
    "Build a 2D array; answer is shape, ndim, size, or dtype read from the array.",
  "create-basic-array":
    "Use arange, linspace, zeros, or ones to build the described array; answer is that array.",
  "array-from-existing":
    "Build a source array, then slice or stack to form answer (vstack/hstack/slice).",
  "add-remove-sort":
    "Build a 1D array; answer is sorted, appended, or filtered via np.sort/append/delete.",
  "unique-counts":
    "Build a 1D array with duplicates; answer is unique values or counts via np.unique.",
  "reverse-array":
    "Build a 1D array; answer is reversed via np.flip or slicing.",
  "shape-and-size":
    "Build an array with described shape; answer is .shape or .size.",
  reshape:
    "Build a 1D array; answer is a reshape with described dimensions.",
  "new-axis":
    "Build a 1D array; answer is a column or row vector via np.newaxis.",
  "transpose-matrix":
    "Build a 2D matrix; answer is its transpose.",
  "flatten-multidim":
    "Build a 2D array; answer is 1D via flatten or ravel.",
  "indexing-slicing":
    "Build a 1D or 2D array; answer is a slice, subset, or boolean mask.",
  "basic-operations":
    "Build one or two arrays; answer is element-wise op result or .sum().",
  broadcasting:
    "Build a 1D array; answer combines it with a scalar via broadcasting.",
  "more-operations":
    "Build a 2D array; answer is mean, max, min, or std (whole array or axis).",
  "math-formulas":
    "Build small arrays; answer evaluates a simple formula (e.g. squared error term).",
  "creating-matrices":
    "Build a 2D matrix; answer is one element or row/column via 2D indexing.",
  "random-numbers":
    "Use default_rng with a fixed seed; answer is a small random array of described size.",
  docstring:
    "Build a small array; answer reads an attribute (.dtype or .shape) — no help() calls.",
  "save-load":
    "Build an array and round-trip through memory (np.array_equal after copy); answer is the array.",
  "csv-io":
    "Build answer from described values as if parsed from a row (use np.array on listed numbers).",
  plotting:
    "Build x and y arrays of same length for a line plot; answer is y derived from x (e.g. x**2).",
};

/** All 27 curriculum lessons are eligible for the code lab. */
export function codeLabLessons(): Lesson[] {
  return allLessons();
}

/**
 * Pick which curriculum lesson the next code task should use.
 * Rotates through all 27 lessons — placement only nudges 1-in-4 challenges.
 * Mistake reinforcement only applies on explicit reinforceTopic (first-try code fail).
 */
export function pickRotatingCodeLesson(options: {
  placementRecommended?: string | null;
  placementWeak?: string[];
  urlFocus?: string;
  reinforceTopic?: string | null;
  recentLessonIds: string[];
  rotationIndex: number;
}): Lesson {
  if (options.reinforceTopic) {
    return resolveLessonForFocus(options.reinforceTopic);
  }

  const pool = codeLabLessons();
  const anchors = [
    options.urlFocus,
    options.placementRecommended ?? undefined,
    ...(options.placementWeak ?? []),
  ].filter((v): v is string => Boolean(v?.trim()));

  const recent = options.recentLessonIds.slice(-3);

  if (anchors.length > 0 && options.rotationIndex % 4 === 0) {
    const anchor = anchors[options.rotationIndex % anchors.length]!;
    const anchorLesson = resolveLessonForFocus(anchor);
    if (!recent.includes(anchorLesson.id)) return anchorLesson;
  }

  let idx = options.rotationIndex % pool.length;
  let lesson = pool[idx]!;
  for (let i = 0; i < pool.length && recent.includes(lesson.id); i++) {
    idx = (idx + 1) % pool.length;
    lesson = pool[idx]!;
  }
  return lesson;
}

/** Resolve placement / URL / mistake topic strings to a curriculum lesson. */
export function resolveLessonForFocus(focusTopic?: string): Lesson {
  const lessons = allLessons();
  const raw = focusTopic?.trim();
  if (!raw) {
    return lessons.find((l) => l.id === "indexing-slicing") ?? lessons[0]!;
  }

  const lower = raw.toLowerCase();
  const exact = lessons.find((l) => l.focus.toLowerCase() === lower);
  if (exact) return exact;

  const slug = slugifyTopic(raw);
  const bySlug = lessons.find((l) => slugifyTopic(l.focus) === slug);
  if (bySlug) return bySlug;

  const partial = lessons.find(
    (l) =>
      l.focus.toLowerCase().includes(lower) ||
      lower.includes(l.focus.toLowerCase()) ||
      slugifyTopic(l.focus).includes(slug) ||
      slug.includes(slugifyTopic(l.focus)),
  );
  if (partial) return partial;

  return lessons.find((l) => l.id === "indexing-slicing") ?? lessons[0]!;
}

export function codeTaskGuideForLesson(lesson: Lesson): string {
  return (
    LESSON_CODE_TASK_GUIDES[lesson.id] ??
    `Teach "${lesson.focus}": ${lesson.blurb}`
  );
}

export function buildCurriculumGenerationContext(lesson: Lesson): string {
  const guide = codeTaskGuideForLesson(lesson);
  const lines = [
    `Curriculum lesson (${NUMPY_LESSON_COUNT} total): ${lesson.focus}`,
    `Task type: ${guide}`,
    `Lesson example (for your reasoning only — do not copy into prompt): ${lesson.example}`,
  ];
  if (lesson.practice?.checks?.length) {
    lines.push(
      `Existing reference exercise (vary values, same skill): ${lesson.practice.prompt}`,
      `Reference checks pattern: ${lesson.practice.checks.map((c) => c.assert).join(" | ")}`,
    );
  }
  lines.push(
    `JSON "topic" field must be exactly: ${lesson.focus}`,
    `Prompt style: concise; use digits (5, 15, 25) for values — never spell numbers as words.`,
  );
  return lines.join("\n");
}

function practiceToChallenge(lesson: Lesson, practice: LessonPractice): CurriculumCodeChallenge {
  return {
    id: `curriculum-${lesson.id}`,
    topic: lesson.focus,
    prompt: practice.prompt,
    starterCode: MINIMAL_STARTER_CODE,
    checks: practice.checks ?? [],
    hint: practice.hint,
  };
}

/** Curriculum-authored challenge for a focus topic (lesson practice if available). */
export function lessonById(lessonId?: string): Lesson | null {
  if (!lessonId?.trim()) return null;
  return findLesson(lessonId) ?? null;
}

export function curriculumCodeChallengeForFocus(
  focusTopic?: string,
): CurriculumCodeChallenge | null {
  const lesson = resolveLessonForFocus(focusTopic);
  if (!lesson.practice?.checks?.length) return null;
  return practiceToChallenge(lesson, lesson.practice);
}

/** All lessons that already ship a hand-checked practice exercise. */
export function allCurriculumCodeChallenges(): CurriculumCodeChallenge[] {
  return allLessons()
    .filter((l) => l.practice?.checks?.length)
    .map((l) => practiceToChallenge(l, l.practice!));
}
