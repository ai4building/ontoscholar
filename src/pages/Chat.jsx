import { useState, useRef, useEffect } from "react";
import { Sparkles, RotateCcw, FlaskConical, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import AgentPicker from "@/components/AgentPicker";

const SUGGESTIONS = [
  "Summarize the OntoScholar proposal's core contribution",
  "What are the seven agent roles in OntoScholar?",
  "Explain how ontology alignment works in this system",
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [agents, setAgents] = useState([]);
  const [defaultAgentId, setDefaultAgentId] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Non-blocking: if the agent list fails, the default secret agent is still used.
    (async () => {
      try {
        const response = await base44.functions.invoke('sciencepalAgents', {});
        setAgents(response.data.agents || []);
        setDefaultAgentId(response.data.default_agent_id || null);
        setAgentId(response.data.default_agent_id || null);
      } catch {
        // leave agents empty; the default agent is used
      }
    })();
  }, []);

  const handleSend = async (text) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setError(null);
    setStreaming(true);
    try {
      const response = await base44.functions.invoke('sciencepalChat', {
        prompt: text,
        thread_id: threadId || undefined,
        agent_id: agentId || undefined,
      });
      const data = response.data;
      if (data.thread_id) setThreadId(data.thread_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "(empty response)" }]);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Request failed";
      setError(msg);
    } finally {
      setStreaming(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setThreadId(null);
    setError(null);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight">SciencePal Console</h1>
            <p className="text-[11px] text-muted-foreground">Agent conversation bridge</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AgentPicker agents={agents} agentId={agentId} onChange={setAgentId} defaultAgentId={defaultAgentId} />
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New thread
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-auto mt-3 flex max-w-3xl items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 py-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center px-6 pt-20 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">Start a conversation</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Send a message to your SciencePal agent. Each new thread starts a fresh
                conversation on your account.
              </p>
              <div className="mt-6 w-full max-w-md space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="w-full rounded-xl border px-4 py-3 text-left text-sm text-foreground transition hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <ChatMessage
                key={i}
                role={m.role}
                content={m.content}
                pending={m.role === "assistant" && streaming && i === messages.length - 1}
              />
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={streaming} streaming={streaming} />
    </div>
  );
}