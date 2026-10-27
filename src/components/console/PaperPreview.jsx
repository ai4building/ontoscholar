import { X, ExternalLink, Quote, Loader2, MousePointerClick, BadgeCheck, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeUrl } from "@/lib/safeUrl";

const STATUS = {
  approved: { icon: BadgeCheck, label: "已审核", cls: "text-emerald-700 bg-emerald-100" },
  pending: { icon: Clock, label: "待审核", cls: "text-amber-700 bg-amber-100" },
  rejected: { icon: XCircle, label: "已拒绝", cls: "text-red-700 bg-red-100" },
};

export default function PaperPreview({ paper, claims, loading, onClose }) {
  if (!paper) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <MousePointerClick className="mb-3 h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          从左侧选择一篇文献，这里会显示出处信息与已抽取的结构化主张
        </p>
      </div>
    );
  }

  const url = safeUrl(paper.url);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-xs font-semibold text-muted-foreground">文献快速预览</h2>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h3 className="text-sm font-semibold leading-snug">{paper.title}</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {[paper.authors, paper.year, paper.venue].filter(Boolean).join(" · ") || "未记录出处信息"}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              paper.decision === "included"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            )}
          >
            {paper.decision === "included" ? "已纳入" : "已排除"}
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" /> 原文
            </a>
          )}
        </div>

        {paper.decision_reason && (
          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">判定理由：</span>
            {paper.decision_reason}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-muted-foreground">已抽取主张</h4>
          <span className="text-[11px] text-muted-foreground">{claims.length} 条</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">该文献尚未抽取结构化主张</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {claims.map((c) => {
              const s = STATUS[c.review_status] || STATUS.pending;
              const Icon = s.icon;
              return (
                <li key={c.id} className="rounded-lg border bg-card p-2.5">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", s.cls)}>
                      <Icon className="h-2.5 w-2.5" />
                      {s.label}
                    </span>
                    {c.metric && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {c.metric} {c.metric_value ? `${c.metric_value}${c.metric_unit || ""}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed">{c.result_summary}</p>
                  {(c.method || c.climate_zone || c.building_type) && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {[c.method, c.building_type, c.climate_zone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {c.evidence_text && (
                    <p className="mt-1.5 flex gap-1 text-[10px] leading-relaxed text-muted-foreground">
                      <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                      <span className="line-clamp-3">{c.evidence_text}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}