"use client";

import { useState } from "react";
import type { LessonPlayground } from "@/lib/numpy-curriculum";

const sampleArray = [5, 10, 15, 20, 25, 30];
const sampleMatrix = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];

function parseArrayInput(raw: string): number[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value));
}

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

/** Interactive 1D index + slice explorer with a live box visual. */
export function IndexSlicePlayground() {
  const [selectedIndex, setSelectedIndex] = useState(2);
  const [sliceStart, setSliceStart] = useState(1);
  const [sliceEnd, setSliceEnd] = useState(4);

  const indexValue = sampleArray[selectedIndex];
  const sliceValue = sampleArray.slice(sliceStart, sliceEnd);

  return (
    <section className={cardClass}>
      <h3 className="text-lg font-semibold text-slate-900">Try indexing and slicing</h3>
      <p className="mt-1 text-sm text-slate-600">
        Move the controls and watch the array below. The pink box is the selected index; blue
        boxes are the current slice.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Index selector (<code>arr[i]</code>): i = {selectedIndex}
          </label>
          <input
            type="range"
            min={0}
            max={sampleArray.length - 1}
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Slice start</label>
            <input
              type="number"
              min={0}
              max={sampleArray.length}
              value={sliceStart}
              onChange={(e) => setSliceStart(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Slice end</label>
            <input
              type="number"
              min={0}
              max={sampleArray.length}
              value={sliceEnd}
              onChange={(e) => setSliceEnd(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-flex gap-2">
          {sampleArray.map((value, idx) => {
            const inSlice = idx >= sliceStart && idx < sliceEnd;
            const isSelected = idx === selectedIndex;
            const boxClass = isSelected
              ? "border-2 border-pink-400 bg-pink-100"
              : inSlice
                ? "border-2 border-sky-300 bg-sky-100"
                : "border border-slate-200 bg-white";
            return (
              <div key={idx} className="min-w-16 text-center">
                <div className="text-xs text-slate-500">idx {idx}</div>
                <div className={`mt-1 rounded-md px-3 py-2 ${boxClass}`}>
                  <span className="font-mono text-slate-900">{value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-1 font-mono text-sm text-slate-700">
        <p>
          arr[{selectedIndex}] = {indexValue}
        </p>
        <p>
          arr[{sliceStart}:{sliceEnd}] = [{sliceValue.join(", ")}]
        </p>
      </div>
    </section>
  );
}

/** Interactive 2D matrix indexing explorer. */
export function MatrixPlayground() {
  const [selectedRow, setSelectedRow] = useState(1);
  const [selectedCol, setSelectedCol] = useState(2);
  const matrixValue = sampleMatrix[selectedRow][selectedCol];

  return (
    <section className={cardClass}>
      <h3 className="text-lg font-semibold text-slate-900">2D indexing playground</h3>
      <p className="mt-1 text-sm text-slate-600">
        Practice matrix-style indexing with <code>a[row, col]</code> (row first, column second).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Row index: {selectedRow}
          </label>
          <input
            type="range"
            min={0}
            max={sampleMatrix.length - 1}
            value={selectedRow}
            onChange={(e) => setSelectedRow(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Column index: {selectedCol}
          </label>
          <input
            type="range"
            min={0}
            max={sampleMatrix[0].length - 1}
            value={selectedCol}
            onChange={(e) => setSelectedCol(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>
      </div>

      <p className="mt-3 font-mono text-sm text-slate-700">
        a[{selectedRow}, {selectedCol}] = {matrixValue}
      </p>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-grid gap-2">
          {sampleMatrix.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2">
              {row.map((value, colIndex) => {
                const isSelected = rowIndex === selectedRow && colIndex === selectedCol;
                return (
                  <div key={`${rowIndex}-${colIndex}`} className="text-center">
                    <div className="text-xs text-slate-500">
                      {rowIndex},{colIndex}
                    </div>
                    <div
                      className={`mt-1 min-w-14 rounded-md border px-3 py-2 ${
                        isSelected
                          ? "border-2 border-pink-400 bg-pink-100"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="font-mono text-slate-900">{value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Build-your-own array visual from comma-separated input. */
export function CustomArrayPlayground() {
  const [customArrayInput, setCustomArrayInput] = useState("3, 8, 13, 21");
  const customArray = parseArrayInput(customArrayInput);

  return (
    <section className={cardClass}>
      <h3 className="text-lg font-semibold text-slate-900">Create your own array visual</h3>
      <p className="mt-1 text-sm text-slate-600">
        Type comma-separated numbers to build an array. The visual updates instantly so you can
        see how positions map to values.
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Enter values (comma-separated)
      </label>
      <input
        type="text"
        value={customArrayInput}
        onChange={(e) => setCustomArrayInput(e.target.value)}
        placeholder="Example: 1, 4, 9, 16"
        className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
      />

      {customArray.length > 0 ? (
        <>
          <p className="mt-3 font-mono text-sm text-slate-700">
            np.array([{customArray.join(", ")}])  # shape ({customArray.length},)
          </p>
          <div className="mt-4 overflow-x-auto">
            <div className="inline-flex gap-2">
              {customArray.map((value, idx) => (
                <div key={idx} className="min-w-16 text-center">
                  <div className="text-xs text-slate-500">idx {idx}</div>
                  <div className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <span className="font-mono text-slate-900">{value}</span>
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
  );
}

export function LessonPlaygroundView({ kind }: { kind: LessonPlayground }) {
  if (kind === "index-slice") return <IndexSlicePlayground />;
  if (kind === "matrix") return <MatrixPlayground />;
  return <CustomArrayPlayground />;
}
