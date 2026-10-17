// 知识看板：研究问题、文献发现与本体概念提议的全局状态概览
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Library, FileText, CheckCircle2, Shapes, LayoutDashboard, ArrowRight, FileDown, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";

const Q_STATUS = { created: "已创建", screening: "筛选中", extracting: "抽取中", ready: "就绪", failed: "失败" };
const C_STATUS = { pending: "待审核", approved: "已入库", rejected: "已拒绝" };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState(null);

  const exportToDocs = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await base44.functions.invoke("exportKnowledgeToDocs", {});
      setExportResult(res.data);
    } catch {
      setExportError("导出失败：请确认 Google 账号已连接后重试。");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [qs, cs, ps, paperCount, conceptCount, recentQs, recentPs, recentProps] = await Promise.all([
        base44.entities.ResearchQuestion.aggregate({ groupBy: "status" }),
        base44.entities.Claim.aggregate({ groupBy: "review_status" }),
        base44.entities.ConceptProposal.aggregate({ groupBy: "status" }),
        base44.entities.Paper.count({}),
        base44.entities.OntologyConcept.count({ status: "approved" }),
        base44.entities.ResearchQuestion.filter({}, { sort: "-created_date", limit: 5 }),
        base44.entities.Paper.filter({}, { sort: "-created_date", limit: 6, fields: ["title", "decision", "year", "question_id"] }),
        base44.entities.ConceptProposal.filter({ status: "pending" }, { sort: "-created_date", limit: 5 }),
      ]);
      setStats({ q: qs.rows, c: cs.rows, p: ps.rows, paperCount, conceptCount });
      setRecent({ q: recentQs.items, p: recentPs.items, props: recentProps.items });
      setLoading(false);
    })();
  }, []);

  const countOf = (rows, key) => rows?.find((r) => r[key])?.count || 0;

  if (loading || !stats || !recent) {
    return <div className="flex justify-center py-20"><Clock_ /></div>;
  }

  const claimTotal = stats.c.reduce((s, r) => s + r.count, 0);
  const approvedClaims = countOf(stats.c, "approved");
  const pendingProps = countOf(stats.p, "pending");

  const cards = [
    { icon: Library, label: "研究问题", value: stats.q.reduce((s, r) => s + r.count, 0), sub: stats.q.map((r) => `${Q_STATUS[r.status] || r.status} ${r.count}`).join(" · ") || "暂无", to: "/" },
    { icon: FileText, label: "文献", value: stats.paperCount, sub: "已检索入库", to: "/research-claims" },
    { icon: CheckCircle2, label: "已审核主张", value: `${approvedClaims}/${claimTotal}`, sub: "入库 / 全部抽取", to: "/research-claims" },
    { icon: Shapes, label: "已发布概念", value: stats.conceptCount, sub: `待处理提议 ${pendingProps}`, to: "/ontology" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <LayoutDashboard className="h-4 w-4" /> 知识看板
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">研究问题、文献发现与本体概念提议的全局状态概览。</p>
        </div>
        <div className="text-right">
          <button
            onClick={exportToDocs}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-80 disabled:opacity-40"
          >
            <FileDown className="h-3.5 w-3.5" /> {exporting ? "正在导出…" : "导出到 Google 文档"}
          </button>
          {exportResult?.url && (
            <p className="mt-1.5 text-[11px]">
              <a href={exportResult.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 underline">
                <ExternalLink className="h-3 w-3" /> 打开已生成的文档
              </a>
            </p>
          )}
          {exportError && <p className="mt-1.5 text-[11px] text-destructive">{exportError}</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, sub, to }) => (
          <Link key={label} to={to} className="rounded-xl border bg-card p-4 transition hover:bg-accent">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs font-medium">{label}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">最近研究问题</h3>
            <Link to="/" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              查看全部 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {recent.q.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">暂无研究问题。</p>}
            {recent.q.map((q) => (
              <Link key={q.id} to={`/questions/${q.id}`} className="block rounded-lg border px-3 py-2 text-xs transition hover:bg-accent">
                <p className="truncate font-medium">{q.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{Q_STATUS[q.status] || q.status}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">最近文献发现</h3>
            <Link to="/research-claims" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              查看全部 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {recent.p.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">暂无文献。</p>}
            {recent.p.map((p) => (
              <div key={p.id} className="rounded-lg border px-3 py-2 text-xs">
                <p className="truncate font-medium" title={p.title}>{p.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {p.year || "—"}
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 ${p.decision === "included" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {p.decision === "included" ? "已纳入" : "已排除"}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">待处理本体概念提议（{recent.props.length}）</h3>
          <Link to="/review" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            前往审核 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-2 space-y-1.5">
          {recent.props.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">没有待处理的概念提议。</p>}
          {recent.props.map((p) => (
            <div key={p.id} className="rounded-lg border px-3 py-2 text-xs">
              <p className="font-medium">
                {p.name}
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{p.domain}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.rationale}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Clock_() {
  return <div className="h-5 w-5 animate-pulse rounded-full bg-muted-foreground/40" />;
}