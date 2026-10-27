import { Quote, FileText, ExternalLink, Loader2, BadgeCheck, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeUrl } from "@/lib/safeUrl";

const STATUS = {
  approved: { icon: BadgeCheck, label: "已审核", cls: "text-emerald-700 bg-emerald-100" },
  pending: { icon: Clock, label: "待审核", cls: "text-amber-700 bg-amber-100" },
  rejected: { icon: XCircle, label: "已拒绝", cls: "text-red-700 bg-red-100" },
};

function paperMeta(paper) {
  const parts = [paper.authors, paper.year, paper.venue].filter(Boolean);
  return parts.length ? `（${parts.join("，")}）` : "";
}

export function buildPaperCitation(paper) {
  return `请基于以下文献回答：\n《${paper.title}》${paperMeta(paper)}\n`;
}

export function buildClaimCitation(claim, paper) {
  const lines = [
    `请基于以下文献证据回答：`,
    `文献：《${paper.title}》${paperMeta(paper)}`,
    `主张：${claim.result_summary || ""}`,
  ];
  if (claim.method) lines.push(`研究方法：${claim.method}`);
  if (claim.building_type) lines.push(`建筑类型：${claim.building_type}`);
  if (claim.climate_zone) lines.push(`气候区：${claim.climate_zone}`);
  if (claim.metric) lines.push(`指标：${claim.metric} ${claim.metric_value || ""}${claim.metric_unit || ""}`.trim());
  if (claim.operating_condition) lines.push(`运行工况：${claim.operating_condition}`);
  if (claim.evidence_text) lines.push(`原文证据：「${claim.evidence_text}」`);
  return lines.join("\n") + "\n";
}

export default function LiteratureBrief({ paper, claims, loading, onQuote }) {
  if (!paper) return null;
  const url = safeUrl(paper.url);

  return (
    <div className="w-full max-w-2xl text-left">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3 w-3" /> 当前文献
            </p>
            <h3 className="mt-1 text-base font-semibold leading-snug">{paper.title}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {[paper.authors, paper.year, paper.venue].filter(Boolean).join(" · ") || "未记录出处信息"}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              paper.decision === "included" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}
          >
            {paper.decision === "included" ? "已纳入" : "已排除"}
          </span>
        </div>

        {paper.decision_reason && (
          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">判定理由：</span>
            {paper.decision_reason}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onQuote(buildPaperCitation(paper))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-85"
          >
            <Quote className="h-3.5 w-3.5" /> 引用整篇文献到对话
          </button>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" /> 查看原文
            </a>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <h4 className="text-[11px] font-semibold text-muted-foreground">已抽取的结构化主张</h4>
          <span className="text-[11px] text-muted-foreground">{claims.length} 条</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <p className="py-5 text-center text-xs text-muted-foreground">该文献尚未抽取结构化主张</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {claims.map((c) => {
              const s = STATUS[c.review_status] || STATUS.pending;
              const Icon = s.icon;
              return (
                <li key={c.id} className="rounded-xl border bg-background p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", s.cls)}>
                      <Icon className="h-2.5 w-2.5" />
                      {s.label}
                    </span>
                    {c.metric && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {c.metric} {c.metric_value ? `${c.metric_value}${c.metric_unit || ""}` : ""}
                      </span>
                    )}
                    <button
                      onClick={() => onQuote(buildClaimCitation(c, paper))}
                      className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition hover:bg-accent"
                    >
                      <Quote className="h-2.5 w-2.5" /> 引用
                    </button>
                  </div>
                  <p className="text-xs font-medium leading-relaxed">{c.result_summary}</p>
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