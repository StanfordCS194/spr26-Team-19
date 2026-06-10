import { NextResponse } from "next/server";

type Difficulty = "easy" | "medium" | "hard";

// High-level content rails used to keep generated questions within beginner NumPy scope.
const TOPIC_HINTS = [
  "What is an array?",
  "Array fundamentals",
  "Array attributes",
  "How to create a basic array",
  "Adding, removing, and sorting elements",
  "How do you know the shape and size of an array?",
  "Can you reshape an array?",
  "How to convert a 1D array into a 2D array (add new axis)",
  "Indexing and slicing",
  "Boolean indexing",
  "np.zeros, np.ones, np.arange, np.linspace",
  "Array math: add, subtract, multiply arrays",
  "Aggregation: sum, mean, min, max",
  "Broadcasting rules",
  "Transpose and flatten",
];

type RequestBody = {
  previousTopic?: string;
  focusTopic?: string;
  difficulty?: Difficulty;
  /** Prompts of questions already shown — model must not repeat these. */
  seenPrompts?: string[];
};

export async function POST(req: Request) {
  // API key is resolved server-side only. The client never receives this secret.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 503 },
    );
  }

  // Input from frontend controls question difficulty and optional topic de-duplication hints.
  const body = (await req.json()) as RequestBody;
  const targetDifficulty: Difficulty = body.difficulty ?? "medium"; // medium is fallback

  const seenBlock =
    body.seenPrompts?.length
      ? `\nDo NOT generate a question with a prompt similar to any of these already-asked questions:\n${body.seenPrompts
          .slice(0, 12)
          .map((p, i) => `${i + 1}. ${p}`)
          .join("\n")}\n`
      : "";

  const prompt = `
You are writing NumPy quiz questions for a student who is actively learning — not just testing recall.
Every question must build REAL understanding. Bad questions test syntax trivia (e.g. "what is the parameter name for X?"). Good questions test reasoning: why does this code behave this way, what will this expression evaluate to, which approach is correct and why.

Rules for good questions:
- Include a SHORT code snippet in the prompt whenever possible (2-5 lines). The learner should read code and reason about it.
- Distractors must be PLAUSIBLE — a wrong answer a real beginner would actually pick, not an obvious mistake.
- Explanation must say WHY the correct answer is right, not just restate it.
- Test understanding of NumPy semantics: views vs copies, broadcasting, element-wise vs Python-list behaviour, shape rules, axis parameter effects.
- Difficulty "${targetDifficulty}": easy = single concept, obvious code; medium = two-step reasoning or a subtle NumPy gotcha; hard = multi-step reasoning or a common misconception.
- Avoid repeating this topic if possible: ${body.previousTopic ?? "none"}.
- If provided, focus on this weak topic: ${body.focusTopic ?? "none"}.
- Draw from these topic areas: ${TOPIC_HINTS.join("; ")}.
${seenBlock}
Return ONLY strict JSON — no markdown, no code fences — with this exact schema:
{
  "topic": "string",
  "difficulty": "easy" | "medium" | "hard",
  "prompt": "string (include a code snippet here when it makes the question concrete)",
  "choices": ["string","string","string","string"],
  "correctIndex": 0-3,
  "explanation": "string (explain the WHY, not just the what; 1-3 sentences)",
  "hint": "string (one sentence nudge that guides thinking WITHOUT giving away the answer)"
}
`;

  // Model can be overridden by env; fallback defaults to a smaller/cheaper model.
  const model = process.env.GROQ_MODEL ?? "groq/compound-mini";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      // Ask the OpenAI-compatible endpoint for JSON-shaped output.
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an educational content generator. Return only valid JSON with exactly the requested fields.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    // We return upstream body for debugging quota/model failures in local dev.
    const errorText = await response.text();
    console.error("Groq request failed", { model, errorText });
    return NextResponse.json(
      { error: "LLM request failed", details: errorText },
      { status: 502 },
    );
  }

  // Groq uses OpenAI-compatible chat response shape.
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    console.error("Groq returned empty content", json);
    return NextResponse.json({ error: "Empty LLM response" }, { status: 502 });
  }

  try {
    // Some providers occasionally wrap JSON with code fences; normalize before parse.
    const normalizedContent = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(normalizedContent) as {
      topic?: unknown;
      difficulty?: unknown;
      prompt?: unknown;
      choices?: unknown;
      correctIndex?: unknown;
      explanation?: unknown;
      hint?: unknown;
    };

    // Runtime schema guard: reject malformed model output before it reaches client UI.
    if (
      typeof parsed.topic !== "string" ||
      (parsed.difficulty !== "easy" && parsed.difficulty !== "medium" && parsed.difficulty !== "hard") ||
      typeof parsed.prompt !== "string" ||
      !Array.isArray(parsed.choices) ||
      parsed.choices.length !== 4 ||
      !parsed.choices.every((value) => typeof value === "string") ||
      typeof parsed.correctIndex !== "number" ||
      parsed.correctIndex < 0 ||
      parsed.correctIndex > 3 ||
      typeof parsed.explanation !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid LLM response schema", details: parsed },
        { status: 502 },
      );
    }

    return NextResponse.json({
      topic: parsed.topic,
      difficulty: parsed.difficulty,
      prompt: parsed.prompt,
      choices: parsed.choices,
      correctIndex: parsed.correctIndex,
      explanation: parsed.explanation,
      hint: typeof parsed.hint === "string" ? parsed.hint : undefined,
    });
  } catch (error) {
    console.error("Failed to parse Groq JSON output", { content, error });
    return NextResponse.json(
      { error: "Could not parse LLM JSON output" },
      { status: 502 },
    );
  }
}
