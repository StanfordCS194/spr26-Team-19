"use client";

import { useState } from "react";
import Link from "next/link";
import { PythonCodeBlock, PythonCodeEditor } from "@/components/python-code";

// Fixed arrays used for deterministic visuals in the beginner playground.
const sampleArray = [5, 10, 15, 20, 25, 30];
const sampleMatrix = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];

// Metadata for each teach-and-practice section shown in the reference area.
type SectionPractice = {
  id: string;
  title: string;
  description: string;
  code: string;
  prompt: string;
  acceptedAnswers: string[];
  hint: string;
  exampleAnswer: string;
  outputPreview: string;
};

// Structured curriculum cards: explanation + code + task + validation metadata.
const referenceSections: SectionPractice[] = [
  {
    id: "import",
    title: "1) Import NumPy",
    description: "The `np` alias is the standard convention in Python projects.",
    code: "import numpy as np",
    prompt: "Practice task: type the exact import line.",
    acceptedAnswers: ["import numpy as np"],
    hint: "Use the short alias `np`.",
    exampleAnswer: "import numpy as np",
    outputPreview: "No printed output. NumPy is now available as `np`.",
  },
  {
    id: "create",
    title: "2) Create arrays",
    description:
      "You can build arrays from lists or create ranges/intervals with helper functions.",
    code: `a = np.array([1, 2, 3, 4])
zeros = np.zeros(3)
ones = np.ones(3, dtype=np.int64)
range_arr = np.arange(2, 9, 2)
line = np.linspace(0, 10, num=5)`,
    prompt: "Practice task: write a line that creates 8 evenly spaced values from 0 to 10.",
    acceptedAnswers: [
      "line = np.linspace(0, 10, num=8)",
      "np.linspace(0, 10, num=8)",
      "line=np.linspace(0,10,num=8)",
    ],
    hint: "Use `np.linspace(start, end, num=...)`.",
    exampleAnswer: "line = np.linspace(0, 10, num=8)",
    outputPreview: "array([0. , 1.428..., 2.857..., 4.285..., 5.714..., 7.142..., 8.571..., 10. ])",
  },
  {
    id: "attributes",
    title: "3) Attributes",
    description:
      "Use attributes to inspect dimensions, total size, shape, and data type.",
    code: `a.ndim    # number of axes
a.shape   # elements per axis
a.size    # total elements
a.dtype   # element type`,
    prompt: "Practice task: type one line to print an array's shape.",
    acceptedAnswers: ["print(a.shape)", "a.shape"],
    hint: "Use the `shape` attribute on `a`.",
    exampleAnswer: "print(a.shape)",
    outputPreview: "(2, 3)",
  },
  {
    id: "indexing",
    title: "4) Indexing and slicing",
    description:
      "NumPy is 0-indexed. Slices include the start index and exclude the end index.",
    code: `a = np.array([10, 20, 30, 40, 50])
a[0]      # 10
a[-1]     # 50
a[1:4]    # [20, 30, 40]
a[:3]     # [10, 20, 30]`,
    prompt: "Practice task: type a slice expression to get the last 2 elements.",
    acceptedAnswers: ["a[-2:]", "print(a[-2:])"],
    hint: "Use negative indexing with slicing.",
    exampleAnswer: "a[-2:]",
    outputPreview: "array([40, 50])",
  },
  {
    id: "reshape",
    title: "5) Shape changes: reshape and new axis",
    description:
      "Reshape keeps the same values while changing layout; `np.newaxis` adds a dimension.",
    code: `a = np.arange(6)           # [0 1 2 3 4 5]
b = a.reshape(3, 2)       # shape (3, 2)
row = a[np.newaxis, :]    # shape (1, 6)
col = a[:, np.newaxis]    # shape (6, 1)`,
    prompt: "Practice task: type a line that converts 1D array `a` to a column vector.",
    acceptedAnswers: ["col = a[:, np.newaxis]", "a[:, np.newaxis]"],
    hint: "Use `np.newaxis` in the second dimension slot.",
    exampleAnswer: "col = a[:, np.newaxis]",
    outputPreview: "col.shape -> (6, 1)",
  },
  {
    id: "ops",
    title: "6) Basic operations",
    description:
      "Operations are usually element-wise, and aggregation helpers summarize arrays quickly.",
    code: `x = np.array([1, 2, 3])
y = np.array([4, 5, 6])
x + y
x * y
x.mean()
x.sum()
np.sort(y)`,
    prompt: "Practice task: type a line that computes the sum of all values in `x`.",
    acceptedAnswers: ["x.sum()", "print(x.sum())"],
    hint: "Use NumPy's sum method on the array.",
    exampleAnswer: "x.sum()",
    outputPreview: "6",
  },
  {
    id: "copy-view",
    title: "7) Copy vs view (important)",
    description:
      "Slicing often returns a view (shared memory). Use `.copy()` for an independent array.",
    code: `a = np.array([1, 2, 3, 4])
v = a[1:3]      # view
v[0] = 99       # also changes a
c = a.copy()    # deep copy`,
    prompt: "Practice task: type a line that creates a deep copy of `a`.",
    acceptedAnswers: ["c = a.copy()", "a.copy()"],
    hint: "Use the array's `copy()` method.",
    exampleAnswer: "c = a.copy()",
    outputPreview: "No direct output; `c` is independent from `a`.",
  },
];

function parseArrayInput(raw: string): number[] {
  // Parse comma-separated numeric input for custom visual builder.
  // Invalid numbers are dropped so we always render safe numeric arrays.
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value));
}

export default function StartFromScratchPage() {
  // 1D interaction state.
  const [selectedIndex, setSelectedIndex] = useState(2);
  const [sliceStart, setSliceStart] = useState(1);
  const [sliceEnd, setSliceEnd] = useState(4);
  // 2D interaction state.
  const [selectedRow, setSelectedRow] = useState(1);
  const [selectedCol, setSelectedCol] = useState(2);
  // Freeform input for custom array visual.
  const [customArrayInput, setCustomArrayInput] = useState("3, 8, 13, 21");
  // Practice panel state: learner code and pass/fail status per section.
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceResults, setPracticeResults] = useState<
    Record<string, "pass" | "fail" | undefined>
  >({});
  // Controls on-demand reveal of example solutions (hidden by default).
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});

  // Derived values used by live visuals.
  const indexValue = sampleArray[selectedIndex];
  const sliceValue = sampleArray.slice(sliceStart, sliceEnd);
  const matrixValue = sampleMatrix[selectedRow][selectedCol];
  const customArray = parseArrayInput(customArrayInput);

  function normalizeAnswer(raw: string): string {
    // Loose normalization for small syntax/spacing differences in typed practice answers.
    return raw.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function checkSectionAnswer(section: SectionPractice) {
    // Compare learner input against accepted canonical variants for each section task.
    const typed = practiceAnswers[section.id] ?? "";
    const normalized = normalizeAnswer(typed);
    const isPass = section.acceptedAnswers.some(
      (answer) => normalizeAnswer(answer) === normalized,
    );
    setPracticeResults((prev) => ({ ...prev, [section.id]: isPass ? "pass" : "fail" }));
  }

  // Helper text reused for section cards to make expectations explicit for learners.
  const practiceGuidance =
    "Type the exact code line, then press Check. Matching is syntax-aware but not full Python execution.";

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm text-pink-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 rounded"
        >
          Back to path selection
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 tracking-tight">
          NumPy Basics Playground
        </h1>
        <p className="mt-2 text-gray-800 max-w-3xl">
          NumPy is a Python library for fast numerical computing using arrays.
          Start here to understand what arrays are, how indexing works, and how
          slicing selects ranges of values.
        </p>

        <nav className="mt-4 sticky top-3 z-10 rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur p-3 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-gray-900">Jump to section</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <a href="#quick-concepts" className="text-pink-700 hover:underline">
              Quick concepts
            </a>
            <a
              href="#indexing-slicing"
              className="text-pink-700 hover:underline"
            >
              Indexing & slicing
            </a>
            <a href="#live-visual" className="text-pink-700 hover:underline">
              Live visual
            </a>
            <a
              href="#two-d-playground"
              className="text-pink-700 hover:underline"
            >
              2D indexing
            </a>
            <a href="#reference" className="text-pink-700 hover:underline">
              Reference
            </a>
            <a href="#custom-array" className="text-pink-700 hover:underline">
              Create array
            </a>
            <a href="#quiz-next" className="text-pink-700 hover:underline">
              Quiz
            </a>
          </div>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section
            id="quick-concepts"
            className="rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
          >
            <h2 className="text-xl font-semibold text-gray-900">
              Quick concepts
            </h2>
            <ul className="mt-3 space-y-2 text-gray-800 list-disc list-inside">
              <li>
                <span className="font-medium">Array:</span> ordered values in one
                container, usually all the same data type.
              </li>
              <li>
                <span className="font-medium">Indexing:</span> pick one value
                using its position like <code>arr[2]</code>.
              </li>
              <li>
                <span className="font-medium">Slicing:</span> pick a range with{" "}
                <code>arr[start:end]</code> (end is excluded).
              </li>
              <li>
                <span className="font-medium">Shape:</span> for a 1D array, shape
                is <code>(n,)</code> where <code>n</code> is element count.
              </li>
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/40 p-4">
              <p className="font-mono text-sm text-gray-800">
                arr = np.array([{sampleArray.join(", ")}])
              </p>
              <p className="font-mono text-sm text-gray-800 mt-1">
                arr.shape = ({sampleArray.length},)
              </p>
            </div>
          </section>

          <section
            id="indexing-slicing"
            className="rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
          >
            <h2 className="text-xl font-semibold text-gray-900">
              Try indexing and slicing
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800">
                  Index selector (<code>arr[i]</code>): i = {selectedIndex}
                </label>
                <input
                  type="range"
                  min={0}
                  max={sampleArray.length - 1}
                  value={selectedIndex}
                  onChange={(event) =>
                    setSelectedIndex(Number(event.target.value))
                  }
                  className="mt-2 w-full"
                />
                <p className="mt-2 font-mono text-sm text-gray-800">
                  arr[{selectedIndex}] = {indexValue}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Slice start
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={sampleArray.length}
                    value={sliceStart}
                    onChange={(event) =>
                      setSliceStart(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Slice end
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={sampleArray.length}
                    value={sliceEnd}
                    onChange={(event) => setSliceEnd(Number(event.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              </div>

              <p className="font-mono text-sm text-gray-800">
                arr[{sliceStart}:{sliceEnd}] = [{sliceValue.join(", ")}]
              </p>
            </div>
          </section>
        </div>

        <section
          id="live-visual"
          className="mt-6 rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
        >
          <h2 className="text-xl font-semibold text-gray-900">Live visual</h2>
          <p className="mt-2 text-sm text-gray-800">
            The highlighted box is the selected index. Blue boxes show the
            current slice range.
          </p>
          <div className="mt-4 overflow-x-auto">
            <div className="inline-flex gap-2">
              {sampleArray.map((value, idx) => {
                const inSlice = idx >= sliceStart && idx < sliceEnd;
                const isSelected = idx === selectedIndex;
                const boxClass = isSelected
                  ? "border-2 border-pink-400 bg-pink-100"
                  : inSlice
                    ? "border-2 border-sky-300 bg-sky-100"
                    : "border border-slate-200 bg-white/60";
                return (
                  <div key={idx} className="text-center min-w-16">
                    <div className="text-xs text-gray-700">idx {idx}</div>
                    <div className={`mt-1 rounded-md px-3 py-2 ${boxClass}`}>
                      <span className="font-mono text-gray-900">{value}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      {isSelected ? "selected" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-4 font-mono text-sm text-gray-800">
            Pointer: index {selectedIndex} -&gt; value {indexValue}
          </p>
        </section>

        <section
          id="two-d-playground"
          className="mt-6 rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
        >
          <h2 className="text-xl font-semibold text-gray-900">
            2D indexing playground
          </h2>
          <p className="mt-2 text-sm text-gray-800">
            Practice matrix-style indexing with <code>a[row, col]</code>.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Row index: {selectedRow}
              </label>
              <input
                type="range"
                min={0}
                max={sampleMatrix.length - 1}
                value={selectedRow}
                onChange={(event) => setSelectedRow(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Column index: {selectedCol}
              </label>
              <input
                type="range"
                min={0}
                max={sampleMatrix[0].length - 1}
                value={selectedCol}
                onChange={(event) => setSelectedCol(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </div>
          </div>

          <p className="mt-3 font-mono text-sm text-gray-800">
            a[{selectedRow}, {selectedCol}] = {matrixValue}
          </p>

          <div className="mt-4 overflow-x-auto">
            <div className="inline-grid gap-2">
              {sampleMatrix.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-2">
                  {row.map((value, colIndex) => {
                    const isSelected =
                      rowIndex === selectedRow && colIndex === selectedCol;
                    return (
                      <div key={`${rowIndex}-${colIndex}`} className="text-center">
                        <div className="text-xs text-gray-700">
                          {rowIndex},{colIndex}
                        </div>
                        <div
                          className={`mt-1 min-w-14 rounded-md px-3 py-2 border ${
                            isSelected
                              ? "border-2 border-pink-400 bg-pink-100"
                              : "border-slate-200 bg-white/60"
                          }`}
                        >
                          <span className="font-mono text-gray-900">{value}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="reference"
          className="mt-6 rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
        >
          <h2 className="text-xl font-semibold text-gray-900">
            NumPy absolute basics (reference)
          </h2>
          <p className="mt-2 text-gray-800">
            This section mirrors the beginner-first flow from NumPy docs in a
            shorter, practical format.
          </p>

          <div className="mt-5 space-y-5">
            {referenceSections.map((section) => (
              <div
                key={section.id}
                className="rounded-2xl border border-slate-200/80 bg-white/40 backdrop-blur p-4"
              >
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
                <p className="mt-2 text-sm text-gray-800">{section.description}</p>
                <div className="mt-2 rounded-md border border-gray-300 overflow-x-auto text-sm">
                  <PythonCodeBlock code={section.code} />
                </div>

                <div className="mt-3 rounded-md border border-pink-200 bg-pink-50 p-3">
                  <p className="text-sm text-gray-900">{section.prompt}</p>
                  <p className="mt-1 text-xs text-gray-800">{practiceGuidance}</p>
                  <PythonCodeEditor
                    className="mt-2 w-full rounded-md border border-gray-300 overflow-hidden"
                    minHeight="5.5rem"
                    modelPath={`/learn/practice/${section.id}.py`}
                    value={practiceAnswers[section.id] ?? ""}
                    onChange={(value) => {
                      setPracticeAnswers((prev) => ({ ...prev, [section.id]: value }));
                      setPracticeResults((prev) => ({ ...prev, [section.id]: undefined }));
                    }}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => checkSectionAnswer(section)}
                      className="px-3 py-1.5 rounded bg-pink-500 text-white hover:bg-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
                    >
                      Check
                    </button>
                    {practiceResults[section.id] === "pass" && (
                      <span className="text-sm font-semibold text-green-700">Passed</span>
                    )}
                    {practiceResults[section.id] === "fail" && (
                      <span className="text-sm font-semibold text-red-700">
                        Not yet - try again
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-800">Hint: {section.hint}</p>
                  <p className="mt-1 text-xs text-gray-800">
                    Expected output preview: {section.outputPreview}
                  </p>
                  {!revealedSolutions[section.id] ? (
                    <button
                      onClick={() =>
                        setRevealedSolutions((prev) => ({ ...prev, [section.id]: true }))
                      }
                      className="mt-2 text-xs text-pink-700 hover:underline"
                    >
                      Reveal example solution
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-gray-900">
                      Example correct code: <code>{section.exampleAnswer}</code>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="custom-array"
          className="mt-6 rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
        >
          <h2 className="text-xl font-semibold text-gray-900">
            Create your own array visual
          </h2>
          <p className="mt-2 text-gray-800">
            Type comma-separated numbers to build an array. The visual updates
            instantly so learners can see how array positions map to values.
          </p>

          <label className="mt-4 block text-sm font-medium text-gray-800">
            Enter values (comma-separated)
          </label>
          <input
            type="text"
            value={customArrayInput}
            onChange={(event) => setCustomArrayInput(event.target.value)}
            placeholder="Example: 1, 4, 9, 16"
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
          />

          {customArray.length > 0 ? (
            <>
              <p className="mt-3 font-mono text-sm text-gray-800">
                np.array([{customArray.join(", ")}])  # shape ({customArray.length},)
              </p>
              <div className="mt-4 overflow-x-auto">
                <div className="inline-flex gap-2">
                  {customArray.map((value, idx) => (
                    <div key={idx} className="text-center min-w-16">
                      <div className="text-xs text-gray-500">idx {idx}</div>
                      <div className="mt-1 rounded-md px-3 py-2 border border-slate-200 bg-white/60">
                        <span className="font-mono text-gray-900">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-red-600">
              Add at least one valid number (for example: 2, 5, 8).
            </p>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-pink-200 bg-pink-50 p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Common mistakes / misconceptions
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-900 list-disc list-inside">
            <li>
              <span className="font-semibold">Off-by-one slicing:</span> in
              <code> arr[start:end] </code>, the <code>end</code> index is not
              included.
            </li>
            <li>
              <span className="font-semibold">Indexing starts at 0:</span> the
              first element is <code>arr[0]</code>, not <code>arr[1]</code>.
            </li>
            <li>
              <span className="font-semibold">1D shape formatting:</span> a
              1D array with 6 values has shape <code>(6,)</code>, including the
              trailing comma.
            </li>
            <li>
              <span className="font-semibold">2D index order:</span> NumPy uses
              <code>arr[row, col]</code> (row first, column second).
            </li>
            <li>
              <span className="font-semibold">View vs copy:</span> slices often
              create views, so editing them can mutate the original array.
              Use <code>.copy()</code> for an independent version.
            </li>
          </ul>
        </section>

        <section
          id="quiz-next"
          className="mt-6 rounded-2xl bg-white/60 backdrop-blur shadow-sm ring-1 ring-slate-200 p-6 scroll-mt-20"
        >
          <h2 className="text-xl font-semibold text-gray-900">Ready for practice?</h2>
          <p className="mt-2 text-gray-800">
            After exploring the basics, move to a short quiz to check your understanding.
          </p>
          <Link
            href="/start-from-scratch/quiz"
            className="inline-block mt-4 px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
          >
            Start basics quiz
          </Link>
        </section>
      </div>
    </main>
  );
}
