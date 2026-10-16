// 指标对比图表：按指标筛选，横轴为文献，柱高为指标数值，颜色区分控制方法
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#e879f9", "#64748b"];

const parseValue = (raw) => {
  if (raw == null) return null;
  const m = String(raw).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

export default function MetricChart({ claims, papers }) {
  const usable = useMemo(
    () =>
      claims
        .filter((c) => c.review_status !== "rejected" && c.metric && parseValue(c.metric_value) != null)
        .map((c) => ({
          metric: c.metric,
          value: parseValue(c.metric_value),
          method: c.method || "未标注方法",
          paper: papers.find((p) => p.id === c.paper_id)?.title || c.paper_id || "未知文献",
        })),
    [claims, papers]
  );
  const metrics = [...new Set(usable.map((d) => d.metric))];
  const [selected, setSelected] = useState(null);
  const metric = selected && metrics.includes(selected) ? selected : metrics[0];

  const data = useMemo(() => {
    const rows = usable.filter((d) => d.metric === metric);
    const unit = claims.find((c) => c.metric === metric)?.metric_unit || "";
    return rows.map((d) => ({ ...d, label: d.paper.length > 18 ? d.paper.slice(0, 18) + "…" : d.paper, unit }));
  }, [usable, metric, claims]);
  const unit = data[0]?.unit || "";

  if (metrics.length === 0) return null;

  return (
    <div>
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
            {[...new Set(data.map((d) => d.method))].map((method, i) => (
              <Bar
                key={method}
                dataKey="value"
                name={method}
                fill={COLORS[i % COLORS.length]}
                data={data.filter((d) => d.method === method)}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        各柱数值取自对应文献主张的指标数值（已拒绝的主张不计入）。
      </p>
    </div>
  );
}