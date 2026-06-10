type GroqMessage = { role: "system" | "user"; content: string };

function parseRetryAfterMs(errorText: string): number | null {
  const match = /try again in (\d+(?:\.\d+)?)\s*ms/i.exec(errorText);
  if (!match?.[1]) return null;
  const ms = Math.ceil(Number(match[1]));
  return Number.isFinite(ms) ? ms : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Groq chat/completions with JSON response_format and one rate-limit retry. */
export async function groqJsonChat(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  temperature: number,
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (response.ok) {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content ?? null;
    }

    const errorText = await response.text();
    const isRateLimit =
      response.status === 429 || /rate_limit_exceeded/i.test(errorText);

    if (isRateLimit && attempt === 0) {
      const waitMs = parseRetryAfterMs(errorText) ?? 1200;
      console.warn("Groq rate limit — retrying", { model, waitMs });
      await sleep(waitMs);
      continue;
    }

    console.error("Groq chat failed", { model, status: response.status, errorText });
    return null;
  }

  return null;
}
