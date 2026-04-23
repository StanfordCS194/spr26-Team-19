"use client";

import { useState } from "react";

type QuizQuestion = {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

const quizQuestions: QuizQuestion[] = [
  {
    prompt: "What does indexing return in `arr[2]`?",
    choices: [
      "A single element at position 2",
      "All elements from 0 to 2",
      "A tuple with shape information",
      "A sorted copy of the array",
    ],
    correctIndex: 0,
    explanation: "Indexing with one integer returns one element at that position.",
  },
  {
    prompt: "Given arr = [5, 10, 15, 20], what does `arr[1:3]` return?",
    choices: ["[5, 10]", "[10, 15]", "[10, 15, 20]", "[15, 20]"],
    correctIndex: 1,
    explanation: "Slices include start and exclude end, so indices 1 and 2.",
  },
  {
    prompt: "For a 1D array with 6 elements, what is `arr.shape`?",
    choices: ["(6)", "(6,)", "(1, 6)", "6"],
    correctIndex: 1,
    explanation: "A 1D NumPy array shape is represented as `(n,)`.",
  },
];

export default function BasicsQuizPage() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const question = quizQuestions[index];
  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;
  const isLastQuestion = index === quizQuestions.length - 1;

  function handleSelect(choiceIndex: number) {
    if (hasAnswered) return;
    setSelected(choiceIndex);
    if (choiceIndex === question.correctIndex) {
      setScore((prev) => prev + 1);
    }
  }

  function handleNext() {
    if (isLastQuestion) return;
    setSelected(null);
    setIndex((prev) => prev + 1);
  }

  function handleRestart() {
    setIndex(0);
    setSelected(null);
    setScore(0);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <a href="/start-from-scratch" className="text-sm text-blue-600 hover:underline">
          Back to basics page
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Basics quiz</h1>
        <p className="mt-2 text-gray-700">
          Question {index + 1} of {quizQuestions.length}
        </p>

        <h2 className="mt-6 text-xl font-semibold text-gray-900">{question.prompt}</h2>

        <div className="mt-4 flex flex-col gap-3">
          {question.choices.map((choice, choiceIndex) => {
            let style = "border-gray-300 hover:bg-gray-100 text-gray-900";
            if (hasAnswered) {
              if (choiceIndex === question.correctIndex) {
                style = "border-green-500 bg-green-100 text-gray-900";
              } else if (choiceIndex === selected) {
                style = "border-red-500 bg-red-100 text-gray-900";
              } else {
                style = "border-gray-200 text-gray-500";
              }
            }

            return (
              <button
                key={choice}
                className={`text-left p-4 border-2 rounded-md transition ${style}`}
                onClick={() => handleSelect(choiceIndex)}
                disabled={hasAnswered}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {hasAnswered && (
          <div className="mt-5">
            <p className={`font-semibold ${isCorrect ? "text-green-600" : "text-red-600"}`}>
              {isCorrect ? "Correct!" : "Not quite."}
            </p>
            <p className="mt-1 text-sm text-gray-700">{question.explanation}</p>
            {!isLastQuestion ? (
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleNext}
              >
                Next question
              </button>
            ) : (
              <div className="mt-4">
                <p className="text-gray-800">
                  Final score: {score} / {quizQuestions.length}
                </p>
                <button
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={handleRestart}
                >
                  Retake quiz
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
