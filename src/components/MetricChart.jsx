// 指标对比图表：左侧筛选栏（气候带 / 研究方法）实时过滤，按指标切换，颜色按方法全局固定
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { Filter, X } from "lucide-react";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#e879f9", "#64748b"];

const parseValue = (raw) => {
  if (raw == null) return null;
  const m = String(raw).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// 可多选的筛选项：空选 = 全部
function FilterGroup({ title, options, selected, onToggle }) {
  if (!options.length) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
        {title}
        {selected.length > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{selected.length}</span>
        )}
      </p>
      <div className="space-y-0.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition ${
              selected.includes(o) ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${
                selected.includes(o) ? "border-primary bg-primary" : "border-muted-foreground/40"
              }`}
            />
            <span className="truncate" title={o}>{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MetricChart({ claims, papers }) {
  const usable = useMemo(
    () =>
      claims
        .filter((c) => c.review_status !== "rejected" && c.metric && parseValue(c.metric_value) != null)
        .map((c) => ({
          metric: c.metric,
          value: parseValue(c.metric_value),
          method: c.method || "未标注方法",
          climate: c.climate_zone || "未标注气候带",
          paper: papers.find((p) => p.id === c.paper_id)?.title || c.paper_id || "未知文献",
        })),
    [claims, papers]
  );

  const metrics = [...new Set(usable.map((d) => d.metric))];
  const climates = [...new Set(usable.map((d) => d.climate))].sort();
  const methodList = [...new Set(usable.map((d) => d.method))].sort();
  const methodColor = new Map(methodList.map((m, i) => [m, COLORS[i % COLORS.length]]));

  const [selected, setSelected] = useState(null);
  const [selClimates, setSelClimates] = useState([]);
  const [selMethods, setSelMethods] = useState([]);
  const metric = selected && metrics.includes(selected) ? selected : metrics[0];

  const data = useMemo(() => {
    const rows = usable.filter(
      (d) =>
        d.metric === metric &&
        (selClimates.length === 0 || selClimates.includes(d.climate)) &&
        (selMethods.length === 0 || selMethods.includes(d.method))
    );
    const unit = claims.find((c) => c.metric === metric)?.metric_unit || "";
    return rows.map((d) => ({ ...d, label: d.paper.length > 18 ? d.paper.slice(0, 18) + "…" : d.paper, unit }));
  }, [usable, metric, selClimates, selMethods, claims]);
  const unit = data[0]?.unit || "";
  const hasFilter = selClimates.length > 0 || selMethods.length > 0;

  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <aside className="w-full shrink-0 space-y-3 rounded-xl border bg-card p-3 sm:w-44">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5" /> 筛选器
        </p>
        <FilterGroup
          title="气候带"
          options={climates}
          selected={selClimates}
          onToggle={(o) => setSelClimates((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]))}
        />
        <FilterGroup
          title="研究方法"
          options={methodList}
          selected={selMethods}
          onToggle={(o) => setSelMethods((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]))}
        />
        {hasFilter && (
          <button
            onClick={() => { setSelClimates([]); setSelMethods([]); }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline transition hover:text-foreground"
          >
            <X className="h-3 w-3" /> 清除筛选
          </button>
        )}
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {metrics.map((m) => (
            <button
              key={m}
              onClick={() => setSelected(m)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                m === metric ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="h-64 w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              当前筛选条件下没有可对比的数据，请调整气候带或研究方法筛选。
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip
                  formatter={(v, name) => [`${v} ${unit}`, name]}
                  labelFormatter={(label) => data.find((d) => d.label === label)?.paper || label}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {methodList
                  .filter((method) => data.some((d) => d.method === method))
                  .map((method) => (
                    <Bar
                      key={method}
                      dataKey="value"
                      name={method}
                      fill={methodColor.get(method)}
                      data={data.filter((d) => d.method === method)}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          各柱数值取自对应文献主张的指标数值（已拒绝的主张不计入）；左侧筛选器实时过滤图表数据。
        </p>
      </div>
    </div>
  );
}