export function formatNumber(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return "0";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString("tr-TR");
}

export function formatPercent(change) {
    if (change == null || Number.isNaN(change)) return null;
    const n = Number(change);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n}%`;
}

export function pageSlugLabel(slug) {
    if (!slug || slug === "home") return "/ (Ana sayfa)";
    return `/${slug}`;
}

export const PERIOD_OPTIONS = [
    { value: "7d", label: "7 gün" },
    { value: "30d", label: "30 gün" },
    { value: "90d", label: "90 gün" },
];

export const PERIOD_LABELS = { "7d": "7 gün", "30d": "30 gün", "90d": "90 gün", today: "Bugün" };
