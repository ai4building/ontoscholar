import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function useKnowledgeBrowser() {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [climate, setClimate] = useState("all");
  const [decision, setDecision] = useState("all");
  const [methodOptions, setMethodOptions] = useState([]);
  const [climateOptions, setClimateOptions] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  // 筛选器候选项：来自已抽取主张的方法与气候区
  useEffect(() => {
    Promise.all([
      base44.entities.Claim.list({ distinct: "method" }),
      base44.entities.Claim.list({ distinct: "climate_zone" }),
    ])
      .then(([m, c]) => {
        setMethodOptions((m.items || []).filter(Boolean));
        setClimateOptions((c.items || []).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  // 文献列表：关键词 + 方法 + 气候区 + 纳入状态
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const query = {};
        if (decision !== "all") query.decision = decision;
        const term = search.trim();
        if (term) {
          query.$or = [
            { title: { $regex: term, $options: "i" } },
            { authors: { $regex: term, $options: "i" } },
            { venue: { $regex: term, $options: "i" } },
          ];
        }
        if (method !== "all" || climate !== "all") {
          const cq = {};
          if (method !== "all") cq.method = method;
          if (climate !== "all") cq.climate_zone = climate;
          const claimPage = await base44.entities.Claim.filter(cq, { limit: 500 });
          const ids = [...new Set((claimPage.items || []).map((c) => c.paper_id).filter(Boolean))];
          if (!ids.length) {
            if (!cancelled) setPapers([]);
            return;
          }
          query.id = { $in: ids };
        }
        const page = await base44.entities.Paper.filter(query, { sort: "-created_date", limit: 100 });
        if (!cancelled) setPapers(page.items || []);
      } catch {
        if (!cancelled) setPapers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, method, climate, decision]);

  // 选中文献后加载其抽取主张
  useEffect(() => {
    if (!selectedPaper?.id) {
      setClaims([]);
      return;
    }
    let cancelled = false;
    setClaimsLoading(true);
    base44.entities.Claim.filter({ paper_id: selectedPaper.id }, { sort: "-created_date", limit: 30 })
      .then((page) => {
        if (!cancelled) setClaims(page.items || []);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPaper?.id]);

  return {
    search, setSearch,
    method, setMethod,
    climate, setClimate,
    decision, setDecision,
    methodOptions,
    climateOptions,
    papers,
    loading,
    selectedPaper,
    setSelectedPaper,
    claims,
    claimsLoading,
  };
}