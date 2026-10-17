// 矛盾分析：列出并核查不同研究主张之间识别出的矛盾
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const VERDICT_STYLE = {
  "真实矛盾": "bg-red-100 text-red-700",
  "条件差异": "bg-amber-100 text-amber-700",
  "研究空白": "bg-sky-100 text-sky-700",
};

export default function Contradictions() {
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState("");

  useEffect(() => {
    (async () => {
      const [a, cs, ps] = await Promise.all([
        base44.entities.ContradictionAnalysis.filter({}, { sort: "-created_date", limit: 50 }),
        base44.entities.Claim.filter({}, { limit: 200, fields: ["result_summary", "paper_id", "metric", "method"] }),
        base44.entities.Paper.filter({}, { limit: 100, fields: ["title", "url"] }),
      ]);
      setItems(a.items);
      setClaims(cs.items);
      setPapers(ps.items);
      setLoading(false);
    })();
  }, []);

  const claimById = Object.fromEntries(claims.map((c) => [c.id, c]));
  const paperById = Object.fromEntries(papers.map((p) => [p.id, p]));

  const confirm = async (item) => {
    await base44.entities.ContradictionAnalysis.update(item.id, { confirmed: true });
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, confirmed: true } : x)));
  };

  const filtered = verdict ? items.filter((x) => x.verdict === verdict) : items;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-5 w-5 animate-pulse rounded-full bg-muted-foreground/40" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <AlertTriangle className="h-4 w-4" /> 矛盾分析
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">识别并核查不同研究主张之间的矛盾，辅助数据校验与知识库治理。</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setVerdict("")}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${!verdict ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent"}`}
        >
          全部（{items.length}）
        </button>
        {["真实矛盾", "条件差异", "研究空白"].map((v) => (
          <button
            key={v}
            onClick={() => setVerdict(v)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${verdict === v ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent"}`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((item) => {
          const a = claimById[item.claim_a_id];
          const b = claimById[item.claim_b_id];
          return (
            <div key={item.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${VERDICT_STYLE[item.verdict] || "bg-muted"}`}>
                  {item.verdict}
                </span>
                {item.confirmed && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> 已核查
                  </span>
                )}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {[a, b].map((c, i) => {
                  const paper = paperById[c?.paper_id] || {};
                  return (
                    <div key={i} className="rounded-lg border px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">主张 {i === 0 ? "A" : "B"}</p>
                      <p className="mt-1 text-xs leading-relaxed">{c?.result_summary || "主张已删除"}</p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {paper.title || "未知文献"}
                        {c?.metric ? ` · ${c.metric}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-relaxed">{item.explanation}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {a && (
                  <Link to={`/questions/${item.question_id}`} className="underline transition hover:text-foreground">
                    查看所属研究问题
                  </Link>
                )}
                {!item.confirmed && (
                  <button
                    onClick={() => confirm(item)}
                    className="rounded-lg border px-2.5 py-1 transition hover:bg-accent"
                  >
                    <CheckCircle2 className="mr-1 inline h-3 w-3" /> 标记已核查
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            没有匹配的矛盾分析记录；可先在科研问题详情页运行可比性分析。
          </p>
        )}
      </div>
    </div>
  );
}