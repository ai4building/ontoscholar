import { useState } from "react";
import { Send, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function QueryBox({ questionId }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ask = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const response = await base44.functions.invoke('queryKnowledge', {
        question_id: questionId,
        query: query.trim(),
      });
      setAnswer(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "查询失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="基于知识库提问，例如：MPC 与 RL 控制的节能率差异如何？"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={ask}
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs text-background transition hover:opacity-80 disabled:opacity-30"
        >
          <Send className="h-3.5 w-3.5" />
          {loading ? "查询中…" : "查询"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {answer && (
        <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2.5">
          {answer.rejected && (
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              无足够证据，明确拒答
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</p>
        </div>
      )}
    </div>
  );
}