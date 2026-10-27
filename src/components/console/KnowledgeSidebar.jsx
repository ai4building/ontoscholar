import { Search, X, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function Filter({ label, value, onChange, options, allLabel }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export default function KnowledgeSidebar({ browser, onClose }) {
  const {
    search, setSearch, method, setMethod, climate, setClimate, decision, setDecision,
    methodOptions, climateOptions, papers, loading, selectedPaper, setSelectedPaper,
  } = browser;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <FileText className="h-3.5 w-3.5" />
          文献知识库
          <span className="font-normal text-muted-foreground">({papers.length})</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 border-b px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题 / 作者 / 期刊"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Filter label="研究方法" value={method} onChange={setMethod} options={methodOptions} allLabel="全部方法" />
        <Filter label="气候区" value={climate} onChange={setClimate} options={climateOptions} allLabel="全部气候区" />
        <Filter
          label="筛选结果"
          value={decision}
          onChange={setDecision}
          options={["included", "excluded"]}
          allLabel="全部文献"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : papers.length === 0 ? (
          <p className="px-3 py-10 text-center text-xs text-muted-foreground">没有符合条件的文献</p>
        ) : (
          <ul className="divide-y">
            {papers.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedPaper(p)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left transition hover:bg-accent",
                    selectedPaper?.id === p.id && "bg-accent",
                    selectedPaper?.id === p.id && "border-l-2 border-emerald-600"
                  )}
                >
                  <p className="line-clamp-2 text-xs font-medium leading-snug">{p.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        p.decision === "included" ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    />
                    {[p.authors, p.year, p.venue].filter(Boolean).join(" · ") || "未记录出处"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}