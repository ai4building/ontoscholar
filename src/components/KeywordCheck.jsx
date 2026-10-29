// 知识库关键词检查：调用 SciencePal API 判断关键词是否被知识库覆盖
import { useState } from "react";
import { SearchCheck, Loader2, CheckCircle2, XCircle, AlertTriangle, Quote, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const SUGGEST_GAP = ["MPC", "强化学习", "能耗基准", "生命周期评价"];

export default function KeywordCheck({ questionId, suggestions = SUGGEST_GAP }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const keywords = input
    .split(/[,，;；\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);

  const check = async () => {
    if (!keywords.length || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await base44.functions.invoke("checkKnowledgeKeywords", {
        question_id: questionId,
        keywords,
      });
      setResult(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "检查失败");
    } finally {
      setLoading(false);
    }
  };

  const addSuggestion = (kw) => {
    if (keywords.includes(kw)) return;
    setInput(input.trim() ? `${input.trim()}，${kw}` : kw);
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <SearchCheck className="h-3.5 w-3.5" />
        输入关键词（用逗号或空格分隔，最多 10 个），由 SciencePal 核查知识库是否覆盖。
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="例如：MPC，强化学习，能耗基准"
          className="min-w-56 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={check}
          disabled={loading || !keywords.length}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs text-background transition hover:opacity-80 disabled:opacity-30"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="h-3.5 w-3.5" />}
          {loading ? "检查中…" : "开始检查"}
        </button>
      </div>

      {suggestions?.length > 0 && !input && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">常用：</span>
          {suggestions.map((kw) => (
            <button
              key={kw}
              onClick={() => addSuggestion(kw)}
              className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent"
            >
              {kw}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {result?.parse_error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> SciencePal 未返回结构化结果，以下是原始回复：
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{result.raw}</p>
        </div>
      )}

      {result?.results?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            共检查 {result.total} 个关键词，命中{" "}
            <span className="font-medium text-emerald-700">{result.found_count}</span> 个，未命中{" "}
            <span className="font-medium text-muted-foreground">{result.total - result.found_count}</span> 个。
          </p>
          <div className="mt-2 space-y-2">
            {result.results.map((r) => (
              <div
                key={r.keyword}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  r.found ? "border-emerald-200 bg-emerald-50/60" : "border-dashed bg-background"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      r.found ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.found ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {r.found ? "已覆盖" : "未覆盖"}
                  </span>
                  <span className="text-sm font-medium">{r.keyword}</span>
                  {r.found && r.source && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <BookOpen className="h-3 w-3" /> {r.source}
                    </span>
                  )}
                </div>
                {r.evidence && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                    {r.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}