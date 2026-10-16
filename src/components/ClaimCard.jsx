import { BadgeCheck, Clock, XCircle, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  approved: { icon: BadgeCheck, label: "已审核", cls: "text-emerald-700 bg-emerald-100" },
  pending: { icon: Clock, label: "待审核", cls: "text-amber-700 bg-amber-100" },
  rejected: { icon: XCircle, label: "已拒绝", cls: "text-red-700 bg-red-100" },
};

export default function ClaimCard({ claim, paper }) {
  const s = STATUS[claim.review_status] || STATUS.pending;
  const Icon = s.icon;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", s.cls)}>
          <Icon className="h-3 w-3" />
          {s.label}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          置信度 {(claim.confidence ?? 0).toFixed(2)}
        </span>
        {claim.metric && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {claim.metric} {claim.metric_value ? `${claim.metric_value}${claim.metric_unit || ""}` : ""}
          </span>
        )}
      </div>
      <p className="text-sm font-medium">{claim.result_summary}</p>
      {(claim.building_type || claim.climate_zone || claim.operating_condition) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {claim.method && <>{claim.method} · </>}
          {claim.building_type && <>{claim.building_type} · </>}
          {claim.climate_zone && <>{claim.climate_zone} · </>}
          {claim.operating_condition}
        </p>
      )}
      {claim.evidence_text && (
        <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Quote className="h-3 w-3" />
            原文证据{claim.evidence_source ? `（${claim.evidence_source}）` : ""}
            {paper?.title ? ` · ${paper.title}` : ""}
          </p>
          <p className="mt-1 text-xs leading-relaxed">{claim.evidence_text}</p>
        </div>
      )}
    </div>
  );
}