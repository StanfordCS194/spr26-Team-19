"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type LevelQuestion = {
  prompt: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  choices: string[];
  correctIndex: number;
};

// Starter diagnostic set. This can later be replaced or expanded by DB/LLM-generated content.
const surveyQuestions: LevelQuestion[] = [
  {
    prompt: "What does `np.array([[1, 2], [3, 4]]).shape` return?",
    topic: "array shape",
    difficulty: "easy",
    choices: ["(2, 2)", "(4,)", "(1, 4)", "2"],
    correctIndex: 0,
  },
  {
    prompt: "Which slicing expression selects the first column of a 2D array `a`?",
    topic: "indexing",
    difficulty: "medium",
    choices: ["a[0, :]", "a[:, 0]", "a[0:0]", "a[:, :]"],
    correctIndex: 1,
  },
  {
    prompt:
      "For arrays `a.shape == (3, 1)` and `b.shape == (1, 4)`, what is `(a + b).shape`?",
    topic: "broadcasting",
    difficulty: "hard",
    choices: ["(3, 1)", "(1, 4)", "(3, 4)", "Broadcasting fails"],
    correctIndex: 2,
  },
];

export default function FindMyLevelPage() {
  // currentIndex points to active diagnostic prompt.
  const [currentIndex, setCurrentIndex] = useState(0);
  // answers stores the choice index selected per question in order.
  const [answers, setAnswers] = useState<number[]>([]);
  const question = surveyQuestions[currentIndex];
  const isComplete = currentIndex >= surveyQuestions.length;

  // Score is derived from answer history and reference correct indexes.
  const score = useMemo(() => {
    return answers.reduce((total, answer, i) => {
      return total + (answer === surveyQuestions[i].correctIndex ? 1 : 0);
    }, 0);
  }, [answers]);

  function getRecommendedLevel() {
    // Lightweight rubric: intended as a placeholder until adaptive model routing is added.
    if (score <= 1) return "Beginner";
    if (score === 2) return "Intermediate";
    return "Advanced";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white/80 backdrop-blur rounded-2xl shadow-lg ring-1 ring-slate-200 p-8">
        <Link
          href="/"
          className="text-sm text-pink-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 rounded"
        >
          Back to path selection
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Find my level
        </h1>
        <p className="mt-2 text-slate-600">
          Quick NumPy diagnostic across topics and difficulty.
        </p>

        {!isComplete ? (
          <div className="mt-6">
            <p className="text-sm text-slate-500">
              Question {currentIndex + 1} of {surveyQuestions.length} - Topic:{" "}
              {question.topic} ({question.difficulty})
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {question.prompt}
            </h2>

            <div className="mt-4 flex flex-col gap-3">
              {question.choices.map((choice, choiceIndex) => (
                <button
                  key={choice}
                  className="text-left p-4 border border-slate-200 rounded-xl bg-white/60 hover:bg-white hover:border-slate-300 text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
                  onClick={() => {
                    // Record answer then advance linearly to next prompt.
                    setAnswers((prev) => [...prev, choiceIndex]);
                    setCurrentIndex((prev) => prev + 1);
                  }}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-pink-200/70 bg-pink-50/70 p-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Assessment complete
            </h2>
            <p className="mt-2 text-slate-800">
              You got {score} out of {surveyQuestions.length} correct.
            </p>
            <p className="mt-1 text-slate-800">
              Recommended starting level: <strong>{getRecommendedLevel()}</strong>
            </p>
            <button
              className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
              onClick={() => {
                // Reset full diagnostic session state for retakes.
                setAnswers([]);
                setCurrentIndex(0);
              }}
            >
              Retake survey
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
