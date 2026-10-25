// 溯源查询：基于已审核知识库提问，[n] 引用可点击跳转到溯源来源（含原文链接）
import { useState, useEffect, useRef } from "react";
import { Send, ShieldAlert, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { safeUrl } from "@/lib/safeUrl";

export default function QueryBox({ questionId, preset }) {
  const [query, setQuery] = useState("");
  const [paperFilter, setPaperFilter] = useState("");
  const [papers, setPapers] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    (async () => {
      const p = await base44.entities.Paper.filter(
        { question_id: questionId },
        { sort: "-created_date", limit: 50, fields: ["title"] }
      );
      setPapers(p.items);
    })();
  }, [questionId]);

  // 来自主张卡片「提问」按钮的预填
  useEffect(() => {
    if (preset) {
      setQuery(preset.query);
      setPaperFilter(preset.paper_id || "");
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [preset]);

  const ask = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const response = await base44.functions.invoke('queryKnowledge', {
        question_id: questionId,
        query: query.trim(),
        ...(paperFilter ? { paper_id: paperFilter } : {}),
      });
      setAnswer(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "查询失败");
    } finally {
      setLoading(false);
    }
  };

  const jumpToSource = (n) => {
    setHighlight(n);
    document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlight(null), 2000);
  };

  const parts = answer?.answer ? answer.answer.split(/(\[\d+\])/g) : [];

  return (
    <div ref={boxRef} className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="基于知识库提问，例如：MPC 与 RL 控制的节能率差异如何？"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {papers.length > 1 && (
          <select
            value={paperFilter}
            onChange={(e) => setPaperFilter(e.target.value)}
            className="rounded-lg border bg-background px-2 py-2 text-xs outline-none"
            title="限定只基于某篇文献的已审核主张回答"
          >
            <option value="">全部文献</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>{p.title.slice(0, 30)}</option>
            ))}
          </select>
        )}
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
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {parts.map((part, i) => {
              const m = part.match(/^\[(\d+)\]$/);
              if (!m) return <span key={i}>{part}</span>;
              const n = Number(m[1]);
              return (
                <button
                  key={i}
                  onClick={() => jumpToSource(n)}
                  className="mx-0.5 inline-flex items-center rounded bg-sky-100 px-1 text-[11px] font-medium text-sky-700 transition hover:bg-sky-200"
                  title="跳转到溯源来源"
                >
                  [{n}]
                </button>
              );
            })}
          </p>
          {answer.sources?.length > 0 && (
            <div className="mt-2.5 border-t pt-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">溯源来源（点击上方 [n] 定位）</p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {answer.sources.map((s) => {
                  const pageMatch = String(s.evidence_source || "").match(/(?:p{1,2}\.|page|第)\s*(\d+)\s*(?:页)?/i);
                  const pageLabel = pageMatch ? `第 ${pageMatch[1]} 页` : s.evidence_source;
                  return (
                    <div
                      key={s.n}
                      id={`src-${s.n}`}
                      className={cn(
                        "flex flex-col rounded-lg border px-3 py-2.5 text-xs transition",
                        highlight === s.n ? "border-sky-400 bg-sky-50" : "bg-background"
                      )}
                    >
                      <p className="font-medium leading-snug" title={s.paper}>
                        <span className="text-muted-foreground">[{s.n}]</span> {s.paper}
                      </p>
                      {pageLabel && (
                        <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {pageLabel}
                        </span>
                      )}
                      {s.evidence_text && (
                        <p className="mt-1.5 line-clamp-3 leading-relaxed text-muted-foreground">“{s.evidence_text}”</p>
                      )}
                      {safeUrl(s.url) && (
                        <a
                          href={safeUrl(s.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex w-fit items-center gap-1 text-sky-700 underline"
                        >
                          <Link2 className="h-3 w-3" /> 查看原文
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}