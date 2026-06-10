import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type RequestBody = {
  topic?: string;
  prompt?: string;
  hint?: string;
  learnerCode?: string;
  messages?: ChatMessage[];
};

const SYSTEM_PROMPT = `You are "Bit", a warm, playful NumPy coding tutor living inside a practice playground.
A learner is working on a coding challenge and may ask you for help. Your job is to help them LEARN, never to solve the challenge for them.

You are given the challenge prompt, its topic, an official hint, and the learner's current code.

STRICT RULES — never break these:
- NEVER write the full solution, and NEVER write the line(s) that set the variable \`answer\`.
- NEVER output code that, if pasted into their editor, would complete the challenge.
- If the learner asks for the answer outright, kindly refuse and instead ask a guiding question or give a conceptual nudge.

You MAY:
- Explain NumPy syntax and what a function/method/attribute does.
- Point them to the right function to reach for (e.g. "look at np.mean").
- Show at most ONE tiny illustrative snippet, using DIFFERENT data/values than the challenge, and it must NOT set \`answer\`.
- Suggest a sensible first step or help them break the problem down.
- Help interpret a Python error message.

Style: friendly, encouraging, a little playful. Keep replies short (2-5 sentences). Use backticks for code terms. Never lecture.`;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const model = process.env.GROQ_MODEL ?? "groq/compound-mini";

  const context = `Challenge topic: ${body.topic ?? "NumPy"}
Challenge prompt: ${body.prompt ?? "(none)"}
Official hint: ${body.hint ?? "(none)"}
Learner's current code:
\`\`\`python
${(body.learnerCode ?? "").slice(0, 2000)}
\`\`\``;

  const history = (body.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: context },
    ...history,
  ];

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, temperature: 0.4, stream: true, messages }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => "");
    console.error("Tutor chat failed", { status: upstream.status, errorText });
    return NextResponse.json({ error: "Tutor is unavailable right now." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = json.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // Ignore partial / non-JSON keepalive lines.
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
