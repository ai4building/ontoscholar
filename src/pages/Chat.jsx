import { useState, useRef, useEffect } from "react";
import { Sparkles, RotateCcw, FlaskConical } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";

// Local sample data — replaced by live SciencePal responses once the backend is wired.
const SAMPLE_MESSAGES = [
  {
    role: "user",
    content: "Summarize the key claims from the OntoScholar proposal in three bullets.",
  },
  {
    role: "assistant",
    content:
      "Here is a preview of what a connected SciencePal agent will return:\n\n• OntoScholar uses an ontology to constrain LLM output across seven cooperating agents.\n• It turns literature into a knowledge graph of traceable research claims.\n• The demo domain is AI-based energy-saving control for building HVAC systems.\n\n(This is placeholder text — connect your API key to get real agent responses.)",
  },
];

const SUGGESTIONS = [
  "Summarize the OntoScholar proposal's core contribution",
  "What are the seven agent roles in OntoScholar?",
  "Explain how ontology alignment works in this system",
];

export default function Chat() {
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);
  const [streaming, setStreaming] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = (text) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    // Placeholder: simulates a delayed assistant reply until backend is wired.
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Backend not connected yet. Add your SciencePal API key and agent ID in app secrets to enable live responses.",
        },
      ]);
      setStreaming(false);
    }, 900);
  };

  const handleReset = () => {
    setMessages([]);
    setThreadId(null);
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
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New thread
        </button>
      </header>

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
      <ChatInput onSend={handleSend} disabled={streaming} streaming={streaming} onStop={handleReset} />
    </div>
  );
}