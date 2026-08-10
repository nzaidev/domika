import "server-only";

// DeepSeek is OpenAI-wire-compatible; we call it with a plain fetch (no SDK,
// no new dependency). Server-only — the key never reaches the client.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export function hasDeepseekConfig(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

// Runs a single chat completion in JSON mode and returns the parsed JSON
// (or null on any failure — missing key, network error, bad/invalid JSON).
// Callers validate the shape; a null here means "no suggestions", never a throw.
export async function deepseekChatJson(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<unknown | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }

  const body = JSON.stringify({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: input.maxTokens ?? 1024,
    stream: false,
  });

  // DeepSeek's JSON mode can occasionally return empty content — one retry.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body,
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(
          `[deepseek] ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
        return null; // 4xx/5xx won't fix itself on an identical retry
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim().length > 0) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error("[deepseek] request failed:", error);
    }
  }

  return null;
}
