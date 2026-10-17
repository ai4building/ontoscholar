// 提交概念提议：基于文献与研究问题提议新的本体概念，进入审核队列
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DOMAINS = [
  { value: "Method", label: "方法" },
  { value: "Equipment", label: "设备" },
  { value: "Metric", label: "指标" },
  { value: "Condition", label: "条件" },
  { value: "BuildingType", label: "建筑类型" },
  { value: "Concept", label: "概念" },
];

export default function SubmitProposal() {
  const [questions, setQuestions] = useState([]);
  const [papers, setPapers] = useState([]);
  const [form, setForm] = useState({ name: "", domain: "Concept", definition: "", rationale: "", question_id: "", paper_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [qs, ps] = await Promise.all([
        base44.entities.ResearchQuestion.filter({}, { sort: "-created_date", limit: 50, fields: ["text"] }),
        base44.entities.Paper.filter({ decision: "included" }, { sort: "-created_date", limit: 100, fields: ["title", "question_id"] }),
      ]);
      setQuestions(qs.items);
      setPapers(ps.items);
    })();
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.rationale.trim()) {
      setError("概念名称与提议理由为必填。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await base44.entities.ConceptProposal.create({
        name: form.name.trim(),
        domain: form.domain,
        definition: form.definition.trim(),
        rationale: form.rationale.trim(),
        question_id: form.question_id || undefined,
        paper_id: form.paper_id || undefined,
        status: "pending",
      });
      setDone(created);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 text-base font-semibold">概念提议已提交</h2>
        <p className="mt-1 text-xs text-muted-foreground">「{done.name}」已进入审核队列，由研究者裁决后发布入库。</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/review" className="rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-80">前往审核队列</Link>
          <button
            onClick={() => { setDone(null); setForm({ name: "", domain: "Concept", definition: "", rationale: "", question_id: "", paper_id: "" }); }}
            className="rounded-lg border px-3 py-1.5 text-xs transition hover:bg-accent"
          >
            再提一个
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Sparkles className="h-4 w-4" /> 提交概念提议
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">基于具体文献与研究问题提议新的本体概念，提交后进入审核队列裁决。</p>

      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium">概念名称 *</span>
            <input value={form.name} onChange={set("name")} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="例如：自适应预测控制" />
          </label>
          <label className="block">
            <span className="text-xs font-medium">所属领域</span>
            <select value={form.domain} onChange={set("domain")} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none">
              {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium">关联研究问题</span>
          <select value={form.question_id} onChange={set("question_id")} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none">
            <option value="">不关联</option>
            {questions.map((q) => <option key={q.id} value={q.id}>{q.text.slice(0, 50)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium">关联文献</span>
          <select value={form.paper_id} onChange={set("paper_id")} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none">
            <option value="">不关联</option>
            {papers.map((p) => <option key={p.id} value={p.id}>{p.title.slice(0, 50)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium">概念定义</span>
          <textarea value={form.definition} onChange={set("definition")} rows={3} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="该概念在本体中的精确定义" />
        </label>
        <label className="block">
          <span className="text-xs font-medium">提议理由 *</span>
          <textarea value={form.rationale} onChange={set("rationale")} rows={3} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="为何现有概念无法覆盖，需要新增该概念" />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs text-background transition hover:opacity-80 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {submitting ? "提交中…" : "提交提议"}
        </button>
      </form>
    </div>
  );
}