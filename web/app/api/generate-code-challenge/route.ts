import { NextResponse } from "next/server";

type Difficulty = "easy" | "medium" | "hard";

type RequestBody = {
  focusTopic?: string;
  difficulty?: Difficulty;
};

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as RequestBody;
  const difficulty: Difficulty = body.difficulty ?? "medium";
  const focus = body.focusTopic?.trim() || "NumPy arrays and indexing";

  const prompt = `
Generate ONE small beginner NumPy coding exercise as strict JSON.
Difficulty: ${difficulty}.
Lean on this learner focus (variable names / story can reflect it): ${focus}.

The learner runs code in Pyodide in the browser. They must set a variable named \`answer\`
to a value we can check with Python repr(answer).

Return ONLY JSON with this exact schema:
{
  "id": "string (kebab-case, short)",
  "topic": "string",
  "prompt": "string (what to do, 1-3 sentences)",
  "starterCode": "string (must include import numpy as np and set answer = None initially)",
  "expectedOutputs": ["string", ...],
  "hint": "string"
}

Rules:
- starterCode must be valid Python that runs in Pyodide with NumPy loaded.
- Use at most ~12 lines in starterCode.
- expectedOutputs: 1-4 strings; each is a valid repr(answer) OR common alternate (e.g. with/without spaces in tuples).
- The exercise must be objectively checkable via repr(answer) equality after normalization (spaces collapsed).

No markdown, no code fences.
`;

  const model = process.env.GROQ_MODEL ?? "groq/compound-mini";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an educational coding exercise generator. Return only valid JSON with exactly the requested fields.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq code-challenge failed", { model, errorText });
    return NextResponse.json(
      { error: "LLM request failed", details: errorText },
      { status: 502 },
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: "Empty LLM response" }, { status: 502 });
  }

  try {
    const normalizedContent = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(normalizedContent) as Record<string, unknown>;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.topic !== "string" ||
      typeof parsed.prompt !== "string" ||
      typeof parsed.starterCode !== "string" ||
      typeof parsed.hint !== "string" ||
      !Array.isArray(parsed.expectedOutputs) ||
      parsed.expectedOutputs.length < 1 ||
      parsed.expectedOutputs.length > 6 ||
      !parsed.expectedOutputs.every((x) => typeof x === "string")
    ) {
      return NextResponse.json(
        { error: "Invalid LLM response schema", details: parsed },
        { status: 502 },
      );
    }

    return NextResponse.json({
      id: parsed.id,
      topic: parsed.topic,
      prompt: parsed.prompt,
      starterCode: parsed.starterCode,
      expectedOutputs: parsed.expectedOutputs as string[],
      hint: parsed.hint,
    });
  } catch (error) {
    console.error("Failed to parse code challenge JSON", { content, error });
    return NextResponse.json({ error: "Could not parse LLM JSON output" }, { status: 502 });
  }
}
