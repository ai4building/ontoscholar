import { useState } from "react";
import { BadgeCheck, Clock, XCircle, Quote, Pencil, Check, X, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const STATUS = {
  approved: { icon: BadgeCheck, label: "已审核", cls: "text-emerald-700 bg-emerald-100" },
  pending: { icon: Clock, label: "待审核", cls: "text-amber-700 bg-amber-100" },
  rejected: { icon: XCircle, label: "已拒绝", cls: "text-red-700 bg-red-100" },
};

const FIELDS = [
  ["result_summary", "结果摘要"],
  ["method", "方法"],
  ["building_type", "建筑类型"],
  ["climate_zone", "气候区"],
  ["metric", "指标"],
  ["metric_value", "指标数值"],
  ["metric_unit", "单位"],
  ["operating_condition", "运行工况"],
];

export default function ClaimCard({ claim, paper, onReview, onUpdate, onAsk }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const s = STATUS[claim.review_status] || STATUS.pending;
  const Icon = s.icon;

  const startEdit = () => {
    const d = {};
    FIELDS.forEach(([key]) => (d[key] = claim[key] || ""));
    setDraft(d);
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    onUpdate?.(claim.id, draft);
  };

  const editable = claim.review_status === "pending" && (onReview || onUpdate);

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
        {!editing && claim.metric && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {claim.metric} {claim.metric_value ? `${claim.metric_value}${claim.metric_unit || ""}` : ""}
          </span>
        )}
        {!editing && (editable || onAsk) && (
          <div className="ml-auto flex items-center gap-1.5">
            {onAsk && !editing && (
              <button
                onClick={() => onAsk(claim)}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition hover:bg-accent"
                title="基于这条已抽取的信息发起溯源提问"
              >
                <MessageCircleQuestion className="h-3 w-3" /> 提问
              </button>
            )}
            {onUpdate && (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition hover:bg-accent"
              >
                <Pencil className="h-3 w-3" /> 编辑
              </button>
            )}
            {onReview && (
              <>
                <button
                  onClick={() => onReview(claim.id, "approved")}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-700"
                >
                  <Check className="h-3 w-3" /> 通过
                </button>
                <button
                  onClick={() => onReview(claim.id, "rejected")}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition hover:bg-accent"
                >
                  <X className="h-3 w-3" /> 拒绝
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="text-xs">
              <span className="mb-1 block text-muted-foreground">{label}</span>
              <Input
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="h-8 text-xs"
              />
            </label>
          ))}
          <div className="col-span-full flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-md border px-3 py-1.5 text-xs transition hover:bg-accent"
            >
              取消
            </button>
            <button
              onClick={save}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}