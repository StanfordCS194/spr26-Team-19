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

The learner runs code in Pyodide in the browser. They must set a variable named \`answer\`.
Grading runs their code in an isolated Python namespace, then evaluates \`checks\` (boolean expressions).

Return ONLY JSON with this exact schema:
{
  "id": "string (kebab-case, short)",
  "topic": "string",
  "prompt": "string (what to do, 1-3 sentences)",
  "starterCode": "string (must include import numpy as np and set answer = None initially)",
  "checks": [
    {
      "id": "string",
      "assert": "string (Python expression; must be truthy after learner code runs; may use answer, np)",
      "message": "string (shown when this check fails)",
      "capture": "answer"
    }
  ],
  "hint": "string"
}

Rules:
- starterCode must be valid Python that runs in Pyodide with NumPy loaded.
- Use at most ~12 lines in starterCode.
- Provide 1-3 checks. Prefer semantic assertions (e.g. answer.shape == (2,), np.array_equal(answer, expected)) over raw repr strings.
- Each check's assert must be safe to eval in the learner namespace after exec(starterCode + edits).
- capture should usually be "answer".

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

    const checksRaw = parsed.checks;
    const checksValid =
      Array.isArray(checksRaw) &&
      checksRaw.length >= 1 &&
      checksRaw.length <= 4 &&
      checksRaw.every((c) => {
        if (!c || typeof c !== "object") return false;
        const row = c as Record<string, unknown>;
        return (
          typeof row.id === "string" &&
          typeof row.assert === "string" &&
          typeof row.message === "string" &&
          (row.capture === undefined || typeof row.capture === "string")
        );
      });

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.topic !== "string" ||
      typeof parsed.prompt !== "string" ||
      typeof parsed.starterCode !== "string" ||
      typeof parsed.hint !== "string" ||
      !checksValid
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
      checks: checksRaw,
      hint: parsed.hint,
    });
  } catch (error) {
    console.error("Failed to parse code challenge JSON", { content, error });
    return NextResponse.json({ error: "Could not parse LLM JSON output" }, { status: 502 });
  }
}
