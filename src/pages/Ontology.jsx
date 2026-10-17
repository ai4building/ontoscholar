// 本体概念：全部已定义概念及其定义与领域，按领域分组便于参考
import { useState, useEffect } from "react";
import { Search, Shapes, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DOMAIN_LABEL = {
  Method: "方法",
  Equipment: "设备",
  Metric: "指标",
  Condition: "条件",
  BuildingType: "建筑类型",
  Concept: "概念",
};

export default function Ontology() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");

  useEffect(() => {
    (async () => {
      const res = await base44.entities.OntologyConcept.filter({}, { sort: "domain", limit: 200 });
      setConcepts(res.items);
      setLoading(false);
    })();
  }, []);

  const filtered = concepts.filter(
    (c) =>
      (domain ? c.domain === domain : true) &&
      (search.trim()
        ? (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.definition || "").toLowerCase().includes(search.toLowerCase())
        : true)
  );
  const domains = [...new Set(concepts.map((c) => c.domain))];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Shapes className="h-4 w-4" /> 本体概念
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            全部已定义概念及定义（共 {concepts.length} 个），作为抽取与问答的共同契约。
          </p>
        </div>
        <button
          onClick={() => (window.location.href = "/submit-proposal")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-80"
        >
          <Sparkles className="h-3.5 w-3.5" /> 提出新概念
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索概念名称或定义…"
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <button
          onClick={() => setDomain("")}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${!domain ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent"}`}
        >
          全部
        </button>
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${domain === d ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent"}`}
          >
            {DOMAIN_LABEL[d] || d}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{c.name}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{DOMAIN_LABEL[c.domain] || c.domain}</span>
              {c.status === "proposed" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">提议中</span>}
              {c.origin === "agent-proposed" && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">智能体提议</span>}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.definition || "暂无定义。"}</p>
            {c.version && <p className="mt-1.5 text-[11px] text-muted-foreground">版本 {c.version}</p>}
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            没有匹配的概念，请调整搜索或领域筛选。
          </p>
        )}
      </div>
    </div>
  );
}