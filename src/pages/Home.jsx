import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Inbox, ArrowRight, Shapes } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_LABEL = {
  created: "待检索",
  screening: "检索筛选中…",
  extracting: "抽取中…",
  ready: "已就绪",
  failed: "失败",
};

export default function Home() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const [q, c, pending, proposals] = await Promise.all([
        base44.entities.ResearchQuestion.filter({}, { sort: "-created_date", limit: 20 }),
        base44.entities.OntologyConcept.filter({ status: "approved" }, { sort: "name", limit: 100 }),
        base44.entities.Claim.count({ review_status: "pending" }),
        base44.entities.ConceptProposal.count({ status: "pending" }),
      ]);
      setQuestions(q.items);
      setConcepts(c.items);
      setPendingCount(pending + proposals);
    })();
  }, []);

  const createQuestion = async () => {
    const trimmed = text.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const q = await base44.entities.ResearchQuestion.create({ text: trimmed });
      navigate(`/questions/${q.id}`);
    } finally {
      setCreating(false);
    }
  };

  const domains = [...new Set(concepts.map((c) => c.domain))];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* 新建研究问题 */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createQuestion()}
            placeholder="输入一个研究问题，例如：冷水机组系统的模型预测控制与强化学习控制，节能效果如何比较？"
            className="flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={createQuestion}
            disabled={creating || !text.trim()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-foreground px-3.5 py-2.5 text-sm text-background transition hover:opacity-80 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
            新建
          </button>
        </div>
      </div>

      {/* 研究问题列表 */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">研究问题</h2>
          <a
            href="/review"
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
          >
            <Inbox className="h-3.5 w-3.5" />
            审核队列
            {pendingCount > 0 && (
              <span className="rounded-full bg-foreground px-1.5 py-px text-[10px] text-background">
                {pendingCount}
              </span>
            )}
          </a>
        </div>
        {questions.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            还没有研究问题。输入上方问题开始构建知识。
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => navigate(`/questions/${q.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left transition hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{q.text}</p>
                  <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[q.status] || q.status}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 领域种子本体 */}
      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Shapes className="h-4 w-4" />
          领域种子本体（Brick / Haystack，HVAC 节能控制）
        </h2>
        <div className="space-y-3">
          {domains.map((d) => (
            <div key={d}>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</p>
              <div className="flex flex-wrap gap-1.5">
                {concepts.filter((c) => c.domain === d).map((c) => (
                  <span
                    key={c.id}
                    title={c.definition}
                    className="rounded-full border px-2.5 py-1 text-xs"
                  >
                    {c.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">{c.version}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}