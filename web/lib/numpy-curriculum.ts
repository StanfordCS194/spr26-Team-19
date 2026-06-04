import {
  checkAnswerSet,
  checkArrayEqual,
  checkScalar,
  checkShape,
  checkShapeTuple,
} from "@/lib/numpy-code-validate";

/**
 * NumPy curriculum modeled on the official "absolute beginners" guide.
 * Single source of truth for the lessons page, path-map defaults, and the
 * exercise focus passed to the generators (via `focus`).
 *
 * `focus` doubles as the exercise focus string AND the topic key (slugified by
 * numpy-learning-path.slugifyTopic) so per-lesson progress lines up with the
 * stats recorded in numpy-exercise-progress.
 */

/** Interactive widget shown on a lesson detail page, if any. */
export type LessonPlayground = "index-slice" | "matrix" | "custom-array";

/** A runnable, output-checked exercise (executed in Pyodide). */
export type LessonPractice = {
  prompt: string;
  /** Must import numpy and initialize `answer`. */
  starterCode: string;
  /**
   * Legacy accepted repr(answer) variants (graded in Python via env checks).
   * Omit when `checks` is provided.
   */
  expectedOutputs?: string[];
  /** Env assertions evaluated after the learner's code runs (preferred). */
  checks?: CodeChallengeCheck[];
  hint: string;
};

export type Lesson = {
  id: string;
  title: string;
  /** Sent to generators as focusTopic; slug becomes the progress key. */
  focus: string;
  blurb: string;
  example: string;
  playground?: LessonPlayground;
  practice?: LessonPractice;
};

export type CurriculumUnit = {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
};

export const NUMPY_CURRICULUM: CurriculumUnit[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "What NumPy is, why it exists, and how to read the examples.",
    lessons: [
      {
        id: "import-numpy",
        title: "How to import NumPy",
        focus: "importing NumPy",
        blurb:
          "Bring NumPy into your file. The community convention is to alias it as np so every example reads the same way.",
        example: "import numpy as np",
      },
      {
        id: "reading-example-code",
        title: "Reading the example code",
        focus: "reading NumPy examples",
        blurb:
          "In docs, lines starting with >>> are input and np is already imported. Lines without a prompt are the output.",
        example: ">>> a = np.array([1, 2, 3])\n>>> a\narray([1, 2, 3])",
      },
      {
        id: "why-numpy",
        title: "Why use NumPy?",
        focus: "why use NumPy vs Python lists",
        blurb:
          "NumPy arrays are faster and use less memory than Python lists, and let you operate on whole arrays at once.",
        example: "np.array([1, 2, 3]) * 2   # array([2, 4, 6])",
      },
      {
        id: "what-is-an-array",
        title: 'What is an "array"?',
        focus: "what is a NumPy array (ndarray)",
        blurb:
          "An array (ndarray) is a grid of values of the same type, indexed by a tuple of nonnegative integers.",
        example: "a = np.array([[1, 2, 3],\n              [4, 5, 6]])",
        playground: "custom-array",
        practice: {
          prompt: "Build the 2x3 array [[1, 2, 3], [4, 5, 6]] and store it in `answer`.",
          starterCode: "import numpy as np\n\n# Make a 2x3 array\nanswer = None",
          checks: [
            checkAnswerSet(),
            checkShape([2, 3]),
            checkArrayEqual([
              [1, 2, 3],
              [4, 5, 6],
            ]),
          ],
          hint: "Pass a list of two lists to np.array.",
        },
      },
    ],
  },
  {
    id: "fundamentals",
    title: "Array fundamentals",
    summary: "Create arrays, inspect them, and build them from existing data.",
    lessons: [
      {
        id: "array-fundamentals",
        title: "Array fundamentals",
        focus: "array fundamentals (access and mutate elements)",
        blurb:
          "Access elements by index, read ranges with slices, and mutate values in place. Arrays are zero-indexed.",
        example: "a = np.array([1, 2, 3, 4])\na[0]       # 1\na[0] = 10",
        playground: "index-slice",
        practice: {
          prompt: "Set `answer` to the first element of `a`.",
          starterCode: "import numpy as np\n\na = np.array([10, 20, 30, 40])\nanswer = None",
          checks: [checkAnswerSet(), checkScalar(10)],
          hint: "Arrays are zero-indexed: use a[0].",
        },
      },
      {
        id: "array-attributes",
        title: "Array attributes",
        focus: "array attributes (ndim, shape, size, dtype)",
        blurb:
          "Inspect an array with .ndim (dimensions), .shape (size per axis), .size (total elements), and .dtype (type).",
        example: "a = np.array([[1, 2, 3], [4, 5, 6]])\na.ndim    # 2\na.shape   # (2, 3)\na.size    # 6",
        practice: {
          prompt: "Set `answer` to the shape of `a`.",
          starterCode:
            "import numpy as np\n\na = np.array([[1, 2, 3], [4, 5, 6]])\nanswer = None",
          checks: [checkAnswerSet(), checkShapeTuple([2, 3])],
          hint: "Use the .shape attribute (no parentheses).",
        },
      },
      {
        id: "create-basic-array",
        title: "How to create a basic array",
        focus: "creating arrays (zeros, ones, arange, linspace)",
        blurb:
          "Create arrays with np.array, or generators like np.zeros, np.ones, np.arange, and np.linspace.",
        example: "np.zeros(3)\nnp.ones((2, 2))\nnp.arange(0, 10, 2)\nnp.linspace(0, 1, 5)",
        playground: "custom-array",
        practice: {
          prompt: "Use np.arange to build the array [2, 4, 6, 8] and store it in `answer`.",
          starterCode: "import numpy as np\n\nanswer = None",
          checks: [checkAnswerSet(), checkArrayEqual([2, 4, 6, 8])],
          hint: "np.arange(start, stop, step) stops before `stop`.",
        },
      },
      {
        id: "array-from-existing",
        title: "How to create an array from existing data",
        focus: "creating arrays from existing data (slicing, stacking)",
        blurb:
          "Build new arrays from existing ones with slicing, np.vstack, np.hstack, and np.hsplit.",
        example: "a = np.array([1, 2, 3, 4])\nb = a[1:3]\nnp.vstack((a, a))",
      },
    ],
  },
  {
    id: "editing",
    title: "Editing & ordering",
    summary: "Add, remove, sort, dedupe, and reverse the contents of arrays.",
    lessons: [
      {
        id: "add-remove-sort",
        title: "Adding, removing, and sorting elements",
        focus: "adding, removing, and sorting array elements",
        blurb:
          "Use np.sort to order, np.append to add, np.delete to remove, and np.concatenate to join arrays.",
        example: "a = np.array([3, 1, 2])\nnp.sort(a)            # [1 2 3]\nnp.concatenate((a, [4, 5]))",
      },
      {
        id: "unique-counts",
        title: "How to get unique items and counts",
        focus: "unique items and counts (np.unique)",
        blurb:
          "np.unique returns sorted unique values; pass return_counts=True to also get how often each appears.",
        example: "a = np.array([1, 2, 2, 3, 3, 3])\nvals, counts = np.unique(a, return_counts=True)",
      },
      {
        id: "reverse-array",
        title: "How to reverse an array",
        focus: "reversing arrays (np.flip)",
        blurb:
          "np.flip reverses elements along an axis; for a 1D array, a[::-1] does the same thing.",
        example: "a = np.array([1, 2, 3, 4])\nnp.flip(a)   # [4 3 2 1]\na[::-1]",
      },
    ],
  },
  {
    id: "shapes",
    title: "Shapes & dimensions",
    summary: "Read shapes, reshape, add axes, transpose, and flatten arrays.",
    lessons: [
      {
        id: "shape-and-size",
        title: "How do you know the shape and size of an array?",
        focus: "array shape and size",
        blurb:
          "ndarray.shape is a tuple of axis lengths and ndarray.size is the total number of elements.",
        example: "a = np.zeros((3, 4))\na.shape   # (3, 4)\na.size    # 12",
      },
      {
        id: "reshape",
        title: "Can you reshape an array?",
        focus: "reshaping arrays (reshape)",
        blurb:
          "reshape returns a new view with a different shape. The total number of elements must stay the same.",
        example: "a = np.arange(6)\na.reshape(2, 3)",
        practice: {
          prompt: "Reshape np.arange(6) into a 3x2 array stored in `answer`.",
          starterCode: "import numpy as np\n\nanswer = None",
          checks: [
            checkAnswerSet(),
            checkShape([3, 2]),
            {
              id: "reshape-values",
              assert: "np.array_equal(answer, np.arange(6).reshape(3, 2))",
              message: "Reshape np.arange(6) into a 3×2 array.",
              capture: "answer",
              skill: "shapes",
            },
          ],
          hint: "Chain it: np.arange(6).reshape(3, 2).",
        },
      },
      {
        id: "new-axis",
        title: "How to convert a 1D array into a 2D array (new axis)",
        focus: "adding a new axis (np.newaxis, expand_dims)",
        blurb:
          "Add a dimension with np.newaxis or np.expand_dims to turn a 1D vector into a row or column.",
        example: "a = np.array([1, 2, 3])\na[np.newaxis, :]   # shape (1, 3)\na[:, np.newaxis]   # shape (3, 1)",
        practice: {
          prompt: "Turn `a` into a column vector of shape (3, 1) stored in `answer`.",
          starterCode: "import numpy as np\n\na = np.array([1, 2, 3])\nanswer = None",
          checks: [
            checkAnswerSet(),
            checkShape([3, 1]),
            checkArrayEqual([[1], [2], [3]]),
          ],
          hint: "Add the new axis in the second slot: a[:, np.newaxis].",
        },
      },
      {
        id: "transpose-matrix",
        title: "Transposing and reshaping a matrix",
        focus: "transposing a matrix (.T, transpose)",
        blurb:
          "Swap rows and columns with .T or np.transpose; reshape changes the dimensions entirely.",
        example: "a = np.array([[1, 2], [3, 4]])\na.T",
      },
      {
        id: "flatten-multidim",
        title: "Reshaping and flattening multidimensional arrays",
        focus: "flattening arrays (flatten, ravel)",
        blurb:
          "flatten returns a 1D copy of the data; ravel returns a 1D view when it can.",
        example: "a = np.array([[1, 2], [3, 4]])\na.flatten()   # [1 2 3 4]",
      },
    ],
  },
  {
    id: "operations",
    title: "Indexing & operations",
    summary: "Index, slice, do elementwise math, broadcast, and aggregate.",
    lessons: [
      {
        id: "indexing-slicing",
        title: "Indexing and slicing",
        focus: "indexing and slicing",
        blurb:
          "Select single elements by index, ranges with slices, and subsets with boolean or fancy indexing.",
        example: "a = np.array([1, 2, 3, 4, 5])\na[1:4]      # [2 3 4]\na[a > 2]    # [3 4 5]",
        playground: "index-slice",
        practice: {
          prompt: "Set `answer` to the last two elements of `a` using a slice.",
          starterCode: "import numpy as np\n\na = np.array([10, 20, 30, 40, 50])\nanswer = None",
          checks: [checkAnswerSet(), checkArrayEqual([40, 50])],
          hint: "Negative indices count from the end: a[-2:].",
        },
      },
      {
        id: "basic-operations",
        title: "Basic array operations",
        focus: "basic array operations (+, -, *, sum)",
        blurb:
          "Arithmetic is elementwise; reductions like sum, min, and max work over the whole array or an axis.",
        example: "a = np.array([1, 2, 3])\nb = np.array([4, 5, 6])\na + b      # [5 7 9]\na.sum()    # 6",
        practice: {
          prompt: "Set `answer` to the sum of all values in `x`.",
          starterCode: "import numpy as np\n\nx = np.array([1, 2, 3, 4])\nanswer = None",
          checks: [checkAnswerSet(), checkScalar(10)],
          hint: "Use x.sum() or np.sum(x).",
        },
      },
      {
        id: "broadcasting",
        title: "Broadcasting",
        focus: "broadcasting",
        blurb:
          "NumPy stretches smaller arrays across larger ones so they combine without writing explicit loops.",
        example: "a = np.array([1, 2, 3])\na * 2      # [2 4 6]\nnp.array([[1], [2]]) + np.array([10, 20])",
      },
      {
        id: "more-operations",
        title: "More useful array operations",
        focus: "aggregations (mean, max, min, std, axis)",
        blurb:
          "Aggregate with mean, max, min, and std; pass axis to reduce along rows or columns.",
        example: "a = np.array([[1, 2], [3, 4]])\na.mean()        # 2.5\na.max(axis=0)   # [3 4]",
      },
      {
        id: "math-formulas",
        title: "Working with mathematical formulas",
        focus: "implementing math formulas with NumPy",
        blurb:
          "Vectorized math lets a formula read like the equation, e.g. mean squared error across two arrays.",
        example: "error = (1 / n) * np.sum(np.square(predictions - labels))",
      },
    ],
  },
  {
    id: "matrices-random",
    title: "Matrices & random",
    summary: "Work with 2D matrices and generate random data.",
    lessons: [
      {
        id: "creating-matrices",
        title: "Creating matrices",
        focus: "creating and indexing 2D matrices",
        blurb:
          "A 2D array is a matrix; index with [row, col] and slice along both axes.",
        example: "m = np.array([[1, 2], [3, 4], [5, 6]])\nm[1, 0]   # 3\nm[:, 0]   # column 0",
        playground: "matrix",
        practice: {
          prompt: "Set `answer` to the element at row 1, column 0 of matrix `m`.",
          starterCode:
            "import numpy as np\n\nm = np.array([[1, 2], [3, 4], [5, 6]])\nanswer = None",
          checks: [checkAnswerSet(), checkScalar(3)],
          hint: "Index with [row, col]: m[1, 0].",
        },
      },
      {
        id: "random-numbers",
        title: "Generating random numbers",
        focus: "generating random numbers (default_rng)",
        blurb:
          "Use the modern Generator from np.random.default_rng for random integers and floats.",
        example: "rng = np.random.default_rng(0)\nrng.integers(0, 10, size=3)\nrng.random(3)",
      },
    ],
  },
  {
    id: "docs-io",
    title: "Docs & input/output",
    summary: "Read docs, save/load arrays, handle CSVs, and plot results.",
    lessons: [
      {
        id: "docstring",
        title: "How to access the docstring for more information",
        focus: "accessing NumPy docs (help, ?)",
        blurb:
          "Read built-in docs with help(np.sum), or np.sum? in IPython/Jupyter for a quick reference.",
        example: "help(np.sum)",
      },
      {
        id: "save-load",
        title: "How to save and load NumPy objects",
        focus: "saving and loading .npy/.npz files",
        blurb:
          "np.save writes one array to .npy, np.savez bundles several, and np.load reads them back.",
        example: "np.save('a.npy', a)\nb = np.load('a.npy')",
      },
      {
        id: "csv-io",
        title: "Importing and exporting a CSV",
        focus: "reading and writing CSV files",
        blurb:
          "Save with np.savetxt and load with np.loadtxt (or genfromtxt for messy data), using delimiter=','.",
        example: "np.savetxt('a.csv', a, delimiter=',')\nnp.loadtxt('a.csv', delimiter=',')",
      },
      {
        id: "plotting",
        title: "Plotting arrays with Matplotlib",
        focus: "plotting arrays with Matplotlib",
        blurb:
          "Pair NumPy with matplotlib.pyplot to visualize arrays as lines, scatters, or images.",
        example: "import matplotlib.pyplot as plt\nplt.plot(np.arange(10), np.arange(10) ** 2)",
      },
    ],
  },
];

export function allLessons(): Lesson[] {
  return NUMPY_CURRICULUM.flatMap((unit) => unit.lessons);
}

export const NUMPY_LESSON_COUNT = allLessons().length;

export function findLesson(id: string): Lesson | undefined {
  return allLessons().find((lesson) => lesson.id === id);
}

export function unitForLesson(id: string): CurriculumUnit | undefined {
  return NUMPY_CURRICULUM.find((unit) => unit.lessons.some((l) => l.id === id));
}

export function lessonNeighbors(id: string): {
  prev: Lesson | null;
  next: Lesson | null;
} {
  const lessons = allLessons();
  const i = lessons.findIndex((l) => l.id === id);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? lessons[i - 1]! : null,
    next: i < lessons.length - 1 ? lessons[i + 1]! : null,
  };
}

/** Foundational focuses used as default path-map stops when no weak topics exist. */
export const DEFAULT_PATH_FOCUSES: string[] = [
  "array fundamentals (access and mutate elements)",
  "indexing and slicing",
  "array shape and size",
  "basic array operations (+, -, *, sum)",
];
