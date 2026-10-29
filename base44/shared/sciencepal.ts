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

// The stream sometimes double-encodes a payload as a JSON string, and sometimes
// packs several JSON objects into one `data:` line. Normalise both cases.
export function parseEventPayload(raw: string): any[] {
  const out: any[] = [];
  const scan = (input: string) => {
    let depth = 0;
    let start = -1;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          try {
            out.push(JSON.parse(input.slice(start, i + 1)));
          } catch {
            // skip malformed fragment
          }
          start = -1;
        }
      }
    }
  };

  const push = (value: any) => {
    if (typeof value !== "string") {
      if (value && typeof value === "object") out.push(value);
      return;
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) return;
    try {
      const inner = JSON.parse(trimmed);
      if (inner && typeof inner === "object") out.push(inner);
      else scan(trimmed);
    } catch {
      scan(trimmed);
    }
  };

  const trimmed = raw.trim();
  if (!trimmed) return out;
  try {
    push(JSON.parse(trimmed));
  } catch {
    scan(trimmed);
  }
  return out;
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

// SciencePal wraps each payload as a JSON string inside `content`, so the answer
// text sits one level deeper than a naive read expects.
export function extractAssistantDelta(ev: any): string {
  if (!ev || typeof ev !== "object") return "";
  const inner = parseMaybeJson(ev.content);
  if (inner && typeof inner === "object") {
    const role = (inner as any).role || (inner as any).message?.role;
    const content = typeof (inner as any).content === "string"
      ? (inner as any).content
      : typeof (inner as any).message?.content === "string"
        ? (inner as any).message.content
        : "";
    if (!content) return "";
    if (role && role !== "assistant") return "";
    return content;
  }
  const role = ev.role || ev.message?.role;
  const content = typeof ev.content === "string" ? ev.content : "";
  if (!content) return "";
  if (role && role !== "assistant") return "";
  return content;
}

// The complete answer carried by the final LLM response event, if present.
// Delta chunks can arrive out of order, so a full snapshot is always preferred.
// SciencePal marks the authoritative full message with metadata.stream_status "complete".
export function extractFinalAnswer(ev: any): string {
  if (!ev || typeof ev !== "object") return "";
  const meta = parseMaybeJson(ev.metadata);
  const isComplete =
    !!meta && typeof meta === "object" && (meta as any).stream_status === "complete";
  const inner = parseMaybeJson(ev.content);
  if (isComplete && inner && typeof inner === "object") {
    const content = typeof (inner as any).content === "string" ? (inner as any).content : "";
    if (content.trim()) return content;
  }
  for (const c of [inner, ev]) {
    if (!c || typeof c !== "object") continue;
    const choice = Array.isArray((c as any).choices) ? (c as any).choices[0] : null;
    const content = choice?.message?.content;
    if (typeof content === "string" && content.trim()) return content;
  }
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
  let finalAnswer = "";
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
      for (const ev of parseEventPayload(payload)) {
        events.push(ev);
        const snapshot = extractFinalAnswer(ev);
        if (snapshot) finalAnswer = snapshot;
        const delta = extractAssistantDelta(ev);
        if (delta) {
          text = appendText(text, delta);
          continue;
        }
        // Some events carry the answer under a plain text field instead.
        const fallback = typeof ev?.answer === "string" ? ev.answer : typeof ev?.text === "string" ? ev.text : "";
        if (fallback) text = appendText(text, fallback);
      }
    }
  }
  return { text: finalAnswer || text, events };
}

// Starts an agent run for a prompt: continues the given thread when present,
// otherwise initiates a new conversation with the configured agent.
export async function startAgentRun(opts: {
  apiKey: string;
  agentId: string;
  prompt: string;
  threadId?: string | null;
}): Promise<{ threadId: string; runId: string }> {
  const { apiKey, agentId, prompt, threadId } = opts;

  if (threadId) {
    const msgResp = await fetch(`${SCIENCEPAL_BASE_URL}/thread/${threadId}/messages`, {
      method: "POST",
      headers: { ...sciencepalHeaders(apiKey), "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: crypto.randomUUID(), content: prompt }),
      signal: AbortSignal.timeout(60000),
    });
    if (!msgResp.ok) {
      const detail = await msgResp.text().catch(() => "");
      throw sciencepalError("message", msgResp.status, detail);
    }
    const startResp = await fetch(`${SCIENCEPAL_BASE_URL}/thread/${threadId}/agent/start`, {
      method: "POST",
      headers: { ...sciencepalHeaders(apiKey), "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(60000),
    });
    if (!startResp.ok) {
      const detail = await startResp.text().catch(() => "");
      throw sciencepalError("thread start", startResp.status, detail);
    }
    const startData = await startResp.json();
    if (!startData?.agent_run_id) {
      throw new Error("SciencePal did not return an agent_run_id when starting the thread.");
    }
    return { threadId, runId: startData.agent_run_id };
  }

  const form = new URLSearchParams({
    agent_id: agentId,
    prompt,
    stream: "true",
    agent_select_type: "manual",
  });
  const initResp = await fetch(`${SCIENCEPAL_BASE_URL}/agent/initiate`, {
    method: "POST",
    headers: { ...sciencepalHeaders(apiKey), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(120000),
  });
  if (!initResp.ok) {
    const detail = await initResp.text().catch(() => "");
    throw sciencepalError("initiate", initResp.status, detail);
  }
  const run = await initResp.json();
  if (!run?.agent_run_id) throw new Error("No agent run was created by SciencePal.");
  return { threadId: run.thread_id, runId: run.agent_run_id };
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