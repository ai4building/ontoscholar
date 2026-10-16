// 对比矩阵：控制方法 × 建筑类型，单元格为节能指标数值（均来自已入库主张）
export default function MatrixView({ claims }) {
  const approved = claims.filter((c) => c.review_status !== "rejected");
  if (approved.length === 0) return null;

  const methods = [...new Set(approved.map((c) => c.method || "未标注方法"))];
  const types = [...new Set(approved.map((c) => c.building_type || "未标注建筑类型"))];

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">控制方法 \ 建筑类型</th>
            {types.map((t) => (
              <th key={t} className="whitespace-nowrap px-3 py-2 font-medium">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {methods.map((m) => (
            <tr key={m}>
              <td className="whitespace-nowrap px-3 py-2 font-medium">{m}</td>
              {types.map((t) => {
                const cell = approved.filter(
                  (c) => (c.method || "未标注方法") === m && (c.building_type || "未标注建筑类型") === t
                );
                return (
                  <td key={t} className="px-3 py-2 align-top">
                    {cell.length === 0 ? (
                      <span className="text-muted-foreground">—（研究空白）</span>
                    ) : (
                      cell.map((c) => (
                        <p key={c.id}>
                          {c.metric_value ? `${c.metric_value}${c.metric_unit || ""}` : c.result_summary}
                          {c.climate_zone ? ` · ${c.climate_zone}` : ""}
                        </p>
                      ))
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}