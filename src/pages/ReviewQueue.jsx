import { useState, useEffect } from "react";
import { Check, X, Clock, Shapes } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClaimCard from "@/components/ClaimCard";

export default function ReviewQueue() {
  const [claims, setClaims] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conceptCount, setConceptCount] = useState(0);

  const load = async () => {
    const [c, p, ps, concepts] = await Promise.all([
      base44.entities.Claim.filter({ review_status: "pending" }, { sort: "-created_date", limit: 30 }),
      base44.entities.ConceptProposal.filter({ status: "pending" }, { sort: "-created_date", limit: 30 }),
      base44.entities.Paper.filter({}, { limit: 100, fields: ["title"] }),
      base44.entities.OntologyConcept.filter({ status: "approved" }, { limit: 100 }),
    ]);
    setClaims(c.items);
    setProposals(p.items);
    setPapers(ps.items);
    setConceptCount(concepts.items.length);
  };

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, []);

  const paperById = Object.fromEntries(papers.map((p) => [p.id, p]));

  const reviewClaim = async (claim, status) => {
    await base44.entities.Claim.update(claim.id, { review_status: status });
    setClaims((prev) => prev.filter((c) => c.id !== claim.id));
  };

  const resolveProposal = async (proposal, decision) => {
    if (decision === "approved") {
      const created = await base44.entities.OntologyConcept.create({
        name: proposal.name,
        domain: proposal.domain || "Concept",
        definition: proposal.definition || "",
        version: `1.0.${conceptCount + 1}`,
        status: "approved",
        origin: "agent-proposed",
      });
      // 记录版本历史：提议 → 确认入库
      await base44.entities.ConceptRevision.bulkCreate([
        {
          concept_id: created.id,
          version: created.version,
          name: proposal.name,
          domain: proposal.domain || "Concept",
          definition: proposal.definition || "",
          change_type: "提出",
          change_note: `来自概念提议：${proposal.rationale || ""}`,
        },
        {
          concept_id: created.id,
          version: created.version,
          name: proposal.name,
          domain: proposal.domain || "Concept",
          definition: proposal.definition || "",
          change_type: "确认",
          change_note: "研究者审核通过，正式发布入库",
        },
      ]);
      setConceptCount((n) => n + 1);
    }
    await base44.entities.ConceptProposal.update(proposal.id, { status: decision });
    setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Clock className="h-5 w-5 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h2 className="text-base font-semibold">审核队列</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        低置信抽取与本体概念提议在此由研究者裁决：AI 承担劳动，人保留判断。
      </p>

      {/* 待审核主张 */}
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold">待审核主张（{claims.length}）</h3>
        {claims.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            没有待审核的主张。
          </p>
        ) : (
          <div className="space-y-3">
            {claims.map((c) => (
              <div key={c.id} className="rounded-xl border bg-card p-4">
                <ClaimCard claim={c} paper={paperById[c.paper_id]} />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => reviewClaim(c, "approved")}
                    className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-80"
                  >
                    <Check className="h-3.5 w-3.5" /> 批准入库
                  </button>
                  <button
                    onClick={() => reviewClaim(c, "rejected")}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5" /> 拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 概念提议 */}
      <section className="mt-8">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Shapes className="h-4 w-4" />
          本体概念提议（{proposals.length}）
        </h3>
        {proposals.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            没有待处理的概念提议。
          </p>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-4">
                <p className="text-sm font-medium">
                  {p.name}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{p.domain}</span>
                </p>
                {p.definition && <p className="mt-1 text-xs text-muted-foreground">{p.definition}</p>}
                <p className="mt-1.5 text-xs leading-relaxed">提议理由：{p.rationale}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolveProposal(p, "approved")}
                    className="inline-flex items-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background transition hover:opacity-80"
                  >
                    <Check className="h-3.5 w-3.5" /> 批准并发布新版本
                  </button>
                  <button
                    onClick={() => resolveProposal(p, "rejected")}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5" /> 拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}