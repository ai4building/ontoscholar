// 科研主张列表：跨问题查看、搜索与筛选所有抽取主张
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, ListFilter, FileSearch } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { safeUrl } from "@/lib/safeUrl";

const STATUS_BADGE = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};
const STATUS_LABEL = { approved: "已入库", pending: "待审核", rejected: "已拒绝" };

export default function ResearchClaims() {
  const [claims, setClaims] = useState([]);
  const [papers, setPapers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [questionId, setQuestionId] = useState("");

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const query = {};
    if (status) query.review_status = status;
    if (questionId) query.question_id = questionId;
    if (search.trim()) {
      query.$or = ["result_summary", "method", "metric", "evidence_text"].map((f) => ({
        [f]: { $regex: search.trim(), $options: "i" },
      }));
    }
    const res = await base44.entities.Claim.filter(query, {
      sort: "-created_date",
      limit: 50,
      ...(reset || !cursor ? {} : { cursor }),
    });
    setClaims((prev) => (reset || !cursor ? res.items : [...prev, ...res.items]));
    setCursor(res.next_cursor);
    setHasMore(res.has_more);
    setLoading(false);
  }, [search, status, questionId, cursor]);

  useEffect(() => {
    (async () => {
      const [ps, qs] = await Promise.all([
        base44.entities.Paper.filter({}, { limit: 100, fields: ["title", "url"] }),
        base44.entities.ResearchQuestion.filter({}, { sort: "-created_date", limit: 50, fields: ["text"] }),
      ]);
      setPapers(ps.items);
      setQuestions(qs.items);
    })();
  }, []);

  useEffect(() => {
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, questionId]);

  const paperById = Object.fromEntries(papers.map((p) => [p.id, p]));
  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <FileSearch className="h-4 w-4" /> 科研主张
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">查看、搜索与筛选所有抽取主张，每条均可溯源到研究问题与文献。</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 sm:max-w-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索结论、方法、指标或证据…"
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border bg-card px-2 py-1.5 text-xs outline-none">
          <option value="">全部状态</option>
          <option value="approved">已入库</option>
          <option value="pending">待审核</option>
          <option value="rejected">已拒绝</option>
        </select>
        <select value={questionId} onChange={(e) => setQuestionId(e.target.value)} className="max-w-56 rounded-lg border bg-card px-2 py-1.5 text-xs outline-none">
          <option value="">全部研究问题</option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>{q.text.slice(0, 40)}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2.5">
        {claims.map((c) => {
          const paper = paperById[c.paper_id] || {};
          const question = questionById[c.question_id] || {};
          return (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[c.review_status] || "bg-muted"}`}>
                  {STATUS_LABEL[c.review_status] || c.review_status}
                </span>
                {c.metric && <span className="text-[11px] text-muted-foreground">指标：{c.metric}{c.metric_value ? ` = ${c.metric_value}${c.metric_unit || ""}` : ""}</span>}
                {c.method && <span className="text-[11px] text-muted-foreground">方法：{c.method}</span>}
                {c.climate_zone && <span className="text-[11px] text-muted-foreground">气候带：{c.climate_zone}</span>}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed">{c.result_summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <Link to={`/questions/${c.question_id}`} className="underline transition hover:text-foreground">
                  问题：{question.text ? question.text.slice(0, 40) : "未知问题"}
                </Link>
                {safeUrl(paper.url) ? (
                  <a href={safeUrl(paper.url)} target="_blank" rel="noreferrer" className="underline transition hover:text-foreground">
                    文献：{paper.title ? paper.title.slice(0, 40) : "未知文献"} ↗
                  </a>
                ) : (
                  <span>文献：{paper.title ? paper.title.slice(0, 40) : "未知文献"}</span>
                )}
              </div>
            </div>
          );
        })}
        {!loading && claims.length === 0 && (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            没有匹配的主张，请调整搜索或筛选条件。
          </p>
        )}
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <button onClick={() => load(false)} disabled={loading} className="rounded-lg border px-4 py-1.5 text-xs transition hover:bg-accent disabled:opacity-50">
            {loading ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}