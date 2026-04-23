"use client";

import { useState } from "react";

type Difficulty = "easy" | "medium";

type QuestionTemplate = {
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

type Question = QuestionTemplate & {
  id: number;
};

type AttemptLog = {
  questionId: number;
  topic: string;
  difficulty: Difficulty;
  selectedIndex: number;
  correct: boolean;
};

const QUESTION_BANK: QuestionTemplate[] = [
  {
    topic: "What is an array?",
    difficulty: "easy",
    prompt: "What is an array in NumPy?",
    choices: [
      "A table in a SQL database",
      "A fixed-size, homogeneous n-dimensional container",
      "A Python dictionary with integer keys",
      "A file format for machine learning",
    ],
    correctIndex: 1,
    explanation:
      "A NumPy array stores values in a homogeneous n-dimensional structure.",
  },
  {
    topic: "Array fundamentals",
    difficulty: "easy",
    prompt: "Which option best describes why NumPy arrays are useful?",
    choices: [
      "They are optimized for numerical operations on large data",
      "They can store arbitrary object trees more efficiently than lists",
      "They replace all Python data structures",
      "They automatically train ML models",
    ],
    correctIndex: 0,
    explanation:
      "NumPy arrays are efficient for vectorized numerical computations.",
  },
  {
    topic: "Array attributes",
    difficulty: "easy",
    prompt: "Which attribute gives the number of dimensions of an array `arr`?",
    choices: ["arr.shape", "arr.ndim", "arr.size", "arr.dtype"],
    correctIndex: 1,
    explanation: "`ndim` returns how many dimensions the array has.",
  },
  {
    topic: "How to create a basic array",
    difficulty: "easy",
    prompt: "How do you create an array from `[1, 2, 3]`?",
    choices: [
      "np.make([1, 2, 3])",
      "np.array([1, 2, 3])",
      "array.np([1, 2, 3])",
      "np.create([1, 2, 3])",
    ],
    correctIndex: 1,
    explanation: "Use `np.array(...)` to create a NumPy array.",
  },
  {
    topic: "Adding, removing, and sorting elements",
    difficulty: "medium",
    prompt: "Which function returns a sorted copy of `arr`?",
    choices: ["np.reorder(arr)", "arr.sortcopy()", "np.sort(arr)", "np.sorted(arr)"],
    correctIndex: 2,
    explanation: "`np.sort(arr)` returns a sorted copy.",
  },
  {
    topic: "Shape and size",
    difficulty: "easy",
    prompt: "For `arr = np.array([[1,2,3],[4,5,6]])`, what is `arr.shape`?",
    choices: ["(2, 3)", "(3, 2)", "(6,)", "2"],
    correctIndex: 0,
    explanation: "The array has 2 rows and 3 columns, so shape is `(2, 3)`.",
  },
  {
    topic: "Can you reshape an array?",
    difficulty: "medium",
    prompt: "Which line reshapes `arr` into 2 rows and 3 columns?",
    choices: ["arr.shape(2, 3)", "arr.reshape(2, 3)", "np.reshape(arr, (2, 3))", "Both B and C"],
    correctIndex: 3,
    explanation: "Both `arr.reshape(2, 3)` and `np.reshape(arr, (2, 3))` are valid.",
  },
  {
    topic: "Convert 1D to 2D (new axis)",
    difficulty: "medium",
    prompt: "How do you convert 1D array `arr` to a column vector?",
    choices: ["arr[:, np.newaxis]", "arr[np.newaxis, :]", "arr.to2d()", "np.column(arr)"],
    correctIndex: 0,
    explanation: "`arr[:, np.newaxis]` adds a new axis as the second dimension.",
  },
  {
    topic: "Indexing and slicing",
    difficulty: "easy",
    prompt: "Given `arr = np.array([10, 20, 30, 40])`, what is `arr[1:3]`?",
    choices: ["[10, 20]", "[20, 30]", "[20, 30, 40]", "[30, 40]"],
    correctIndex: 1,
    explanation: "Slice `1:3` includes index 1 and 2, not 3.",
  },
];

let questionCounter = 0;

function generateQuestion(params: {
  previousTopic?: string;
  preferEasy: boolean;
}): Question {
  const preferredDifficulty: Difficulty = params.preferEasy ? "easy" : "medium";
  const matching = QUESTION_BANK.filter(
    (q) => q.difficulty === preferredDifficulty && q.topic !== params.previousTopic,
  );
  const fallback = QUESTION_BANK.filter((q) => q.topic !== params.previousTopic);
  const pool = matching.length > 0 ? matching : fallback;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  questionCounter += 1;
  return { ...chosen, id: questionCounter };
}

async function generateQuestionFromApi(params: {
  previousTopic?: string;
  preferEasy: boolean;
}): Promise<Question | null> {
  try {
    const response = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!response.ok) return null;

    const parsed = (await response.json()) as Partial<QuestionTemplate>;
    if (
      !parsed ||
      typeof parsed.prompt !== "string" ||
      !Array.isArray(parsed.choices) ||
      parsed.choices.length !== 4 ||
      typeof parsed.correctIndex !== "number" ||
      parsed.correctIndex < 0 ||
      parsed.correctIndex > 3 ||
      typeof parsed.explanation !== "string"
    ) {
      return null;
    }

    const topic = typeof parsed.topic === "string" ? parsed.topic : "Array fundamentals";
    const difficulty: Difficulty = parsed.difficulty === "medium" ? "medium" : "easy";
    questionCounter += 1;
    return {
      id: questionCounter,
      topic,
      difficulty,
      prompt: parsed.prompt,
      choices: parsed.choices.map(String),
      correctIndex: parsed.correctIndex,
      explanation: parsed.explanation,
    };
  } catch {
    return null;
  }
}

export default function StartFromScratchPage() {
  const [currentQuestion, setCurrentQuestion] = useState<Question>(() => ({
    ...QUESTION_BANK[0],
    id: 1,
  }));
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<Question>(() => ({
    ...QUESTION_BANK[1],
    id: 2,
  }));
  const [bufferedQuestion, setBufferedQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [attemptLog, setAttemptLog] = useState<AttemptLog[]>([]);
  const [isPrefetching, setIsPrefetching] = useState(false);

  const hasAnswered = selected !== null;
  const isCorrect = selected === currentQuestion.correctIndex;

  async function prefetchFollowUpQuestion(params: {
    previousTopic?: string;
    preferEasy: boolean;
  }) {
    setIsPrefetching(true);
    const apiQuestion = await generateQuestionFromApi(params);
    const followUp =
      apiQuestion ??
      generateQuestion({
        previousTopic: params.previousTopic,
        preferEasy: params.preferEasy,
      });
    setBufferedQuestion(followUp);
    setIsPrefetching(false);
  }

  function handleAnswer(choiceIndex: number) {
    if (hasAnswered) return;

    setSelected(choiceIndex);
    const correct = choiceIndex === currentQuestion.correctIndex;
    const nextWrongStreak = correct ? 0 : wrongStreak + 1;
    setWrongStreak(nextWrongStreak);

    const logEntry: AttemptLog = {
      questionId: currentQuestion.id,
      topic: currentQuestion.topic,
      difficulty: currentQuestion.difficulty,
      selectedIndex: choiceIndex,
      correct,
    };
    setAttemptLog((prev) => [...prev, logEntry]);

    // Prefetch is triggered by answer selection, so "Next" is instant.
    // Replace this generator with an async LLM API call later.
    void prefetchFollowUpQuestion({
      previousTopic: prefetchedQuestion.topic,
      preferEasy: nextWrongStreak >= 2,
    });
  }

  function handleNextQuestion() {
    const fallback = generateQuestion({
      previousTopic: currentQuestion.topic,
      preferEasy: wrongStreak >= 2,
    });
    setCurrentQuestion(prefetchedQuestion ?? fallback);
    setPrefetchedQuestion(
      bufferedQuestion ??
        generateQuestion({
          previousTopic: (prefetchedQuestion ?? fallback).topic,
          preferEasy: wrongStreak >= 2,
        }),
    );
    setBufferedQuestion(null);
    setSelected(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <a href="/" className="text-sm text-blue-600 hover:underline">
          Back to path selection
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Start from scratch: NumPy basics
        </h1>
        <p className="mt-2 text-gray-600">
          Beginner track with adaptive question generation and topic coverage.
        </p>

        <h2 className="mt-6 text-xl font-semibold text-gray-900">
          {currentQuestion.prompt}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          {currentQuestion.choices.map((choice, choiceIndex) => {
            let style = "border-gray-300 hover:bg-gray-100 text-gray-900";
            if (hasAnswered) {
              if (choiceIndex === currentQuestion.correctIndex) {
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
                onClick={() => handleAnswer(choiceIndex)}
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
            <p className="mt-1 text-sm text-gray-700">{currentQuestion.explanation}</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleNextQuestion}
              disabled={isPrefetching}
            >
              {isPrefetching ? "Generating next question..." : "Next basics question"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
