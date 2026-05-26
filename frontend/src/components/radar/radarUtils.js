/** Dashtock Radar — paylaşılan yardımcılar */

export const scoreColor = (s) =>
    s >= 75 ? "#22c55e" : s >= 55 ? "#3b82f6" : s >= 40 ? "#f59e0b" : "#ef4444";

export const formatMoney = (n) => {
    if (!n || n === 0) return "₺0";
    if (n >= 1000000) return `₺${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `₺${(n / 1000).toFixed(1)}K`;
    return `₺${Math.round(n).toLocaleString("tr-TR")}`;
};

export const trendDirectionLabel = (d) => {
    if (d === "breakout") return "Patlama";
    if (d === "rising") return "Yükseliş";
    if (d === "stable") return "Stabil";
    if (d === "declining") return "Düşüş";
    return "—";
};

export const RADAR_TABS = ["opportunities", "products", "insights"];

export const parseRadarTab = (value) =>
    RADAR_TABS.includes(value) ? value : "opportunities";

/** Fırsat listesini sekme filtresine göre sırala (API tekrarı yok) */
export const sortOpportunities = (list, sortKey) => {
    const arr = [...(list || [])];
    const by = (fn) => arr.sort((a, b) => fn(b) - fn(a));

    switch (sortKey) {
        case "fresh":
            return by((o) => new Date(o.dataFreshness || o.updatedAt || 0).getTime());
        case "trend":
            return by((o) => o.scores?.trend ?? o.totalScore ?? 0);
        case "profit":
            return by((o) => o.scores?.profit ?? o.totalScore ?? 0);
        case "competition":
            return by((o) => o.scores?.competition ?? o.totalScore ?? 0);
        case "best":
        default:
            return by((o) => o.totalScore ?? 0);
    }
};

export const sortProducts = (list, sortKey) => {
    const arr = [...(list || [])];
    switch (sortKey) {
        case "profit":
            return arr.sort((a, b) => (b.estimatedProfit || 0) - (a.estimatedProfit || 0));
        case "price":
            return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
        case "rating":
            return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        case "score":
        default:
            return arr.sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));
    }
};
