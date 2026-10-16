// Shared SciencePal HTTP API helpers (https://sciencepal.ai/help/sdk)

export const SCIENCEPAL_BASE_URL = "https://sciencepal.ai/api";

export function sciencepalHeaders(apiKey: string) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "application/json",
  };
}

export function sciencepalError(context: string, respStatus: number, detail: string) {
  return new Error(`SciencePal ${context} error ${respStatus}: ${detail.slice(0, 300)}`);
}

// Best-effort text extraction from a single SSE event (schema is not publicly documented).
export function extractTextFromEvent(ev: any): string {
  if (ev == null) return "";
  if (typeof ev === "string") return ev;
  const candidates = [ev.content, ev.text, ev.delta, ev.answer, ev.output];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  if (ev.message && typeof ev.message.content === "string") return ev.message.content;
  if (ev.output && typeof ev.output.content === "string") return ev.output.content;
  if (ev.data && typeof ev.data.content === "string") return ev.data.content;
  return "";
}

// Accumulate text, guarding against duplicated full replays / deltas.
export function appendText(acc: string, chunk: string): string {
  if (!chunk) return acc;
  if (!acc) return chunk;
  if (chunk === acc) return acc;
  if (chunk.startsWith(acc)) return chunk; // full replacement of what we have
  if (acc.endsWith(chunk)) return acc;
  return acc + chunk;
}

// Reads the SSE stream for a run until it ends, collecting events and assistant text.
export async function consumeRunStream(runId: string, apiKey: string, timeoutMs = 280000) {
  const resp = await fetch(`${SCIENCEPAL_BASE_URL}/agent-run/${runId}/stream`, {
    headers: { ...sciencepalHeaders(apiKey), "Accept": "text/event-stream" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => "");
    throw sciencepalError("stream", resp.status, detail);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let events: any[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        events.push(ev);
        text = appendText(text, extractTextFromEvent(ev));
      } catch {
        // ignore non-JSON keepalive lines
      }
    }
  }
  return { text, events };
}

// Final run status (completed / failed / stopped / asked / running).
export async function getRunStatus(runId: string, apiKey: string) {
  const resp = await fetch(`${SCIENCEPAL_BASE_URL}/agent-run/${runId}`, {
    headers: sciencepalHeaders(apiKey),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) return null;
  try {
    return await resp.json();
  } catch {
    return null;
  }
}