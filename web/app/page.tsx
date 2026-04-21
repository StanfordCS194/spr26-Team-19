"use client";

import { useState } from "react";


// Initial Idea:
// Keep two questions preloaded. As the user answers one question, the second is built
// by an LLM and given to the user on the next call. While the user answers this question
// the first question is rebuilt. The app then goes back and forth. This way the LLM runs
// in the background and not at every 'Next Question' call. We can include a visual that runs
// after a question is called (ie a character advancing forward) to 'hide' the LLM's runtime.

// TODO:
// - Add second question
// - Add logic to switch back and forth
// - Keep a log of questions and their difficulty
// - Implement LLM question generation (prefetching)
// - Prefetch on answer selection, not question load


// Further thinking: Parrallel prefetching (3 questions),




// QUESTION FORMAT
const question = {
  prompt: "What is the name of this App?",
  choices: ["Dynamic-Ed", "Learn-In", "Adapt-Ed", "None of the Above"],
  correctIndex: 2,
};




export default function Home() {
  // Track which choice the user picked. null means "hasn't picked yet."
  const [selected, setSelected] = useState<number | null>(null);

  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctIndex;

  // Component Renders
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-xl w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">
          {question.prompt}
        </h1>

        <div className="flex flex-col gap-3">
          {question.choices.map((choice, index) => {
            // Decide the button's color based on state.
            let style = "border-gray-300 hover:bg-gray-100 text-gray-900";
            if (hasAnswered) {
              if (index === question.correctIndex) {
                style = "border-green-500 bg-green-100 text-gray-900";
              } else if (index === selected) {
                style = "border-red-500 bg-red-100 text-gray-900";
              } else {
                style = "border-gray-200 text-gray-500";
              }
            }

            return (
              <button
                key={index}
                onClick={() => setSelected(index)}
                disabled={hasAnswered}
                className={`text-left p-4 border-2 rounded-md transition ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {hasAnswered && (
          <div className="mt-6">
            <p
              className={`font-semibold ${
                isCorrect ? "text-green-600" : "text-red-600"
              }`}
            >
              {isCorrect ? "Correct!" : "Not quite — try again."}
            </p>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next question
            </button>
          </div>
        )}
      </div>
    </main>
  );
}