// 概念版本历史：以时间线展示一个概念从提出、修正到确认的全部变化
import { useState, useEffect } from "react";
import { GitBranch } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TYPE_STYLE = {
  "提出": "bg-sky-100 text-sky-700",
  "修正": "bg-amber-100 text-amber-700",
  "确认": "bg-emerald-100 text-emerald-700",
};
const DOT = { "提出": "bg-sky-500", "修正": "bg-amber-500", "确认": "bg-emerald-500" };

export default function ConceptHistory({ concept, onClose }) {
  const [revisions, setRevisions] = useState(null);

  useEffect(() => {
    (async () => {
      let res = await base44.entities.ConceptRevision.filter(
        { concept_id: concept.id },
        { sort: "created_date", limit: 50 }
      );
      if (!res.items.length) {
        // 历史概念首次查看时补记初始「提出」版本，作为时间线起点
        await base44.entities.ConceptRevision.create({
          concept_id: concept.id,
          version: concept.version || "1.0",
          name: concept.name,
          domain: concept.domain,
          definition: concept.definition || "",
          change_type: "提出",
          change_note: concept.origin === "seed" ? "种子概念初始定义" : "由概念提议发布初始定义",
        });
        res = await base44.entities.ConceptRevision.filter(
          { concept_id: concept.id },
          { sort: "created_date", limit: 50 }
        );
      }
      setRevisions(res.items);
    })();
  }, [concept.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <GitBranch className="h-4 w-4" /> {concept.name} · 版本历史
          </h3>
          <button onClick={onClose} className="rounded-lg border px-2 py-1 text-xs transition hover:bg-accent">关闭</button>
        </div>

        {!revisions ? (
          <p className="py-10 text-center text-xs text-muted-foreground">加载中…</p>
        ) : (
          <div className="mt-4">
            {revisions.map((r, i) => (
              <div key={r.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < revisions.length - 1 && <div className="absolute left-[5px] top-4 h-full w-px bg-border" />}
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[r.change_type] || "bg-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLE[r.change_type] || "bg-muted"}`}>
                      {r.change_type}
                    </span>
                    {r.version && <span className="text-[10px] font-medium text-muted-foreground">v{r.version}</span>}
                    <span className="text-[10px] text-muted-foreground">
                      {(r.created_date || "").slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  {r.prev_definition && (
                    <div className="mt-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground">旧定义</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-through">{r.prev_definition}</p>
                    </div>
                  )}
                  {r.definition && (
                    <div className="mt-1.5 rounded-lg border px-2.5 py-1.5">
                      <p className="text-[10px] font-medium">{r.prev_definition ? "新定义" : "定义"}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed">{r.definition}</p>
                    </div>
                  )}
                  {r.change_note && <p className="mt-1 text-[11px] text-muted-foreground">备注：{r.change_note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}