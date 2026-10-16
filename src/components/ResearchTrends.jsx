// 研究趋势：已审核主张按气候带 / 控制方法的分布（数据库聚合统计）
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#e879f9", "#64748b"];

function Donut({ title, rows }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">暂无数据</p>
      ) : (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} 条主张`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ResearchTrends() {
  const [climate, setClimate] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [byZone, byMethod] = await Promise.all([
        base44.entities.Claim.aggregate({ query: { review_status: "approved" }, groupBy: "climate_zone" }),
        base44.entities.Claim.aggregate({ query: { review_status: "approved" }, groupBy: "method" }),
      ]);
      setClimate(byZone.rows.map((r) => ({ name: r.climate_zone || "未标注气候带", value: r.count })));
      setMethods(byMethod.rows.map((r) => ({ name: r.method || "未标注方法", value: r.count })));
      setLoaded(true);
    })();
  }, []);

  const total = [...climate, ...methods].length > 0
    ? climate.reduce((s, r) => s + r.value, 0)
    : 0;
  if (loaded && total === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <TrendingUp className="h-4 w-4" />
        研究趋势（已审核主张分布，共 {total} 条）
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Donut title="按气候带分布" rows={climate} />
        <Donut title="按控制方法分布" rows={methods} />
      </div>
    </section>
  );
}