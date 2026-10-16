import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Search, Layers, GitCompareArrows, Loader2, AlertTriangle, Table2, ChartColumn, CheckCheck,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import PapersTable from "@/components/PapersTable";
import ClaimCard from "@/components/ClaimCard";
import MatrixView from "@/components/MatrixView";
import MetricChart from "@/components/MetricChart";
import QueryBox from "@/components/QueryBox";

const VERDICT_CLS = {
  "真实矛盾": "bg-red-100 text-red-700",
  "条件差异": "bg-amber-100 text-amber-700",
  "研究空白": "bg-sky-100 text-sky-700",
};

const STEPS = [
  { key: "discover", label: "检索与筛选", icon: Search, fn: "discoverPapers", done: "papers" },
  { key: "extract", label: "结构化抽取", icon: Layers, fn: "extractClaims", done: "claims" },
  { key: "compare", label: "可比性判定", icon: GitCompareArrows, fn: "analyzeComparability", done: "pairs" },
];

export default function QuestionDetail() {
  const { id } = useParams();
  const [question, setQuestion] = useState(null);
  const [papers, setPapers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [running, setRunning] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = async () => {
    try {
      const q = await base44.entities.ResearchQuestion.get(id);
      if (!q) { setMissing(true); return; }
      const [p, c, a] = await Promise.all([
        base44.entities.Paper.filter({ question_id: id }, { sort: "-created_date", limit: 20 }),
        base44.entities.Claim.filter({ question_id: id }, { sort: "-created_date", limit: 50 }),
        base44.entities.ContradictionAnalysis.filter({ question_id: id }, { sort: "-created_date", limit: 20 }),
      ]);
      setQuestion(q);
      setPapers(p.items);
      setClaims(c.items);
      setPairs(a.items);
    } catch {
      setMissing(true);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleDecision = async (p) => {
    await base44.entities.Paper.update(p.id, {
      decision: p.decision === "included" ? "excluded" : "included",
      decision_reason: "人工改判",
    });
    await load();
  };

  const reviewClaim = async (claimId, status) => {
    await base44.entities.Claim.update(claimId, { review_status: status });
    await load();
  };

  const updateClaim = async (claimId, patch) => {
    await base44.entities.Claim.update(claimId, patch);
    await load();
  };

  const reviewAll = async (status) => {
    if (reviewing) return;
    setReviewing(true);
    try {
      await base44.entities.Claim.bulkUpdate(
        claims.filter((c) => c.review_status === "pending").map((c) => ({ id: c.id, review_status: status }))
      );
      await load();
    } finally {
      setReviewing(false);
    }
  };

  const runStep = async (step) => {
    if (running) return;
    setRunning(step.key);
    setError(null);
    try {
      await base44.functions.invoke(step.fn, { question_id: id });
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "执行失败");
    } finally {
      setRunning(null);
    }
  };

  if (missing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">未找到该研究问题。</p>
        <Link to="/" className="mt-3 inline-block text-sm underline">返回知识库</Link>
      </div>
    );
  }
  if (!question) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const includedCount = papers.filter((p) => p.decision === "included").length;
  const paperById = Object.fromEntries(papers.map((p) => [p.id, p]));
  const claimById = Object.fromEntries(claims.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回知识库
      </Link>

      <div className="mt-3 rounded-xl border bg-card p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">研究问题</p>
        <h2 className="mt-1 text-base font-semibold">{question.text}</h2>
        {(question.parsed_focus || question.parsed_methods || question.parsed_metrics) && (
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {question.parsed_focus && <p><span className="font-medium text-foreground">研究对象：</span>{question.parsed_focus}</p>}
            {question.parsed_methods && <p><span className="font-medium text-foreground">方法：</span>{question.parsed_methods}</p>}
            {question.parsed_metrics && <p><span className="font-medium text-foreground">指标：</span>{question.parsed_metrics}</p>}
            {question.parsed_conditions && <p><span className="font-medium text-foreground">条件：</span>{question.parsed_conditions}</p>}
          </div>
        )}
      </div>

      {/* 流水线步骤 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = running === s.key;
          return (
            <button
              key={s.key}
              onClick={() => runStep(s)}
              disabled={!!running}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition hover:bg-accent disabled:opacity-40"
            >
              {active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              {s.label}
            </button>
          );
        })}
        <span className="text-[11px] text-muted-foreground">
          文献 {papers.length}（纳入 {includedCount}） · 主张 {claims.length}
        </span>
      </div>
      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* 文献 */}
      {papers.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">检索与筛选结果</h3>
          <PapersTable papers={papers} onToggle={toggleDecision} />
        </section>
      )}

      {/* 主张 */}
      {claims.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">研究主张（每条可回溯原文证据）</h3>
          {claims.some((c) => c.review_status === "pending") ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                抽取完成，{claims.filter((c) => c.review_status === "pending").length} 条主张待人工确认，
                确认无误后才会发布到最终科研知识库。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => reviewAll("approved")}
                  disabled={reviewing}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                  全部确认并发布
                </button>
                <button
                  onClick={() => reviewAll("rejected")}
                  disabled={reviewing}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent disabled:opacity-40"
                >
                  全部拒绝
                </button>
              </div>
            </div>
          ) : (
            claims.length > 0 && (
              <p className="mb-3 text-xs text-emerald-700">
                本问题的主张已全部人工确认，均已进入最终科研知识库。
              </p>
            )
          )}
          <div className="space-y-3">
            {claims.map((c) => (
              <ClaimCard key={c.id} claim={c} paper={paperById[c.paper_id]} onReview={reviewClaim} onUpdate={updateClaim} />
            ))}
          </div>
        </section>
      )}

      {/* 对比矩阵 */}
      {claims.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Table2 className="h-4 w-4" />
            对比矩阵（方法 × 建筑类型 × 节能指标）
          </h3>
          <MatrixView claims={claims} />
        </section>
      )}

      {/* 指标对比图表 */}
      {claims.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <ChartColumn className="h-4 w-4" />
            指标数据对比
          </h3>
          <div className="rounded-xl border bg-card p-4">
            <MetricChart claims={claims} papers={papers} />
          </div>
        </section>
      )}

      {/* 可比性判定 */}
      {pairs.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">可比性判定</h3>
          <div className="space-y-2">
            {pairs.map((p) => {
              const a = claimById[p.claim_a_id];
              const b = claimById[p.claim_b_id];
              return (
                <div key={p.id} className="rounded-xl border bg-card p-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERDICT_CLS[p.verdict] || "bg-muted"}`}>
                    {p.verdict}
                  </span>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    {[a, b].map((c, i) => (
                      <div key={i} className="rounded-lg bg-muted/60 px-2.5 py-2">
                        <p className="text-[11px] font-medium text-muted-foreground">主张 {i === 0 ? "A" : "B"}{c?.paper_id && paperById[c.paper_id] ? ` · ${paperById[c.paper_id].title}` : ""}</p>
                        <p className="mt-0.5 leading-relaxed">{c?.result_summary || "（该主张已被删除）"}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.explanation}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 查询 */}
      {claims.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">溯源查询</h3>
          <QueryBox questionId={id} />
        </section>
      )}
    </div>
  );
}