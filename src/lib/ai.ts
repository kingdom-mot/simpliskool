import "server-only";

/** AI suggestions switch on when ANTHROPIC_API_KEY is set (Vercel → Settings → Environment Variables). */
export function aiReady() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function askClaude(system: string, user: string, maxTokens = 220): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${process.env.ANTHROPIC_API_URL ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    return text || null;
  } catch {
    return null;
  }
}
