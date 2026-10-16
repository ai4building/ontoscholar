import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PapersTable({ papers, onToggle }) {
  if (!papers.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">文献</th>
            <th className="px-3 py-2 font-medium">决定</th>
            <th className="px-3 py-2 font-medium">理由</th>
            {onToggle && <th className="px-3 py-2 font-medium">人工改判</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {papers.map((p) => (
            <tr key={p.id} className="align-top">
              <td className="px-3 py-2">
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="text-muted-foreground">
                  {[p.authors, p.year, p.venue].filter(Boolean).join(" · ")}
                </p>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
                    p.decision === "included"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {p.decision === "included" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {p.decision === "included" ? "纳入" : "排除"}
                </span>
              </td>
              <td className="max-w-[240px] px-3 py-2 text-muted-foreground">{p.decision_reason}</td>
              {onToggle && (
                <td className="px-3 py-2">
                  <button
                    onClick={() => onToggle(p)}
                    className="whitespace-nowrap rounded-md border px-2 py-1 text-[11px] transition hover:bg-accent"
                  >
                    改为{p.decision === "included" ? "排除" : "纳入"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}