import { NextResponse } from "next/server";

type Difficulty = "easy" | "medium";

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
];

type RequestBody = {
  previousTopic?: string;
  preferEasy?: boolean;
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
  const preferEasy = Boolean(body.preferEasy);
  const targetDifficulty: Difficulty = preferEasy ? "easy" : "medium";

  // We explicitly force a strict JSON schema in prompt form because this route is consumed
  // programmatically by the quiz UI and needs predictable fields.
  const prompt = `
Generate one beginner NumPy multiple-choice question as strict JSON.
Difficulty target: ${targetDifficulty}.
Avoid repeating this topic if possible: ${body.previousTopic ?? "none"}.
Use these topics: ${TOPIC_HINTS.join("; ")}.

Return ONLY JSON with this exact schema:
{
  "topic": "string",
  "difficulty": "easy" or "medium",
  "prompt": "string",
  "choices": ["string","string","string","string"],
  "correctIndex": 0-3,
  "explanation": "string"
}
No markdown, no code fences.
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
    };

    // Runtime schema guard: reject malformed model output before it reaches client UI.
    if (
      typeof parsed.topic !== "string" ||
      (parsed.difficulty !== "easy" && parsed.difficulty !== "medium") ||
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

    // Return only validated payload fields expected by quiz UI.
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Failed to parse Groq JSON output", { content, error });
    return NextResponse.json(
      { error: "Could not parse LLM JSON output" },
      { status: 502 },
    );
  }
}
