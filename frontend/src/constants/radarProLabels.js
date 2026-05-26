/** Dashtock Radar — AI Fırsat Motoru metinleri */

export const scoreLabel = (s) =>
    s >= 75 ? "Güçlü Fırsat" : s >= 55 ? "İyi Potansiyel" : s >= 40 ? "Orta" : "Düşük";

export const scoreEmoji = (s) => (s >= 75 ? "🔥" : s >= 55 ? "✨" : s >= 40 ? "📊" : "⚠️");

export const trendIcon = (d) =>
    d === "breakout" ? "🚀" : d === "rising" ? "📈" : d === "stable" ? "➡️" : d === "declining" ? "📉" : "—";

export const expansionLabel = (t) => {
    if (t === "same_category") return { text: "Aynı Kategori", color: "#22c55e", icon: "🎯" };
    if (t === "adjacent_category") return { text: "Yakın Kategori", color: "#3b82f6", icon: "↔️" };
    if (t === "trending") return { text: "Trend", color: "#f59e0b", icon: "📈" };
    return { text: "Yeni Kategori", color: "#8b5cf6", icon: "🆕" };
};

export const MAIN_TABS = [
    { key: "opportunities", label: "Fırsat Radarı", icon: "crosshairs", desc: "AI skorlu anahtar kelime fırsatları" },
    { key: "products", label: "Ürün Keşfi", icon: "box", desc: "Pazaryerinden örnek ürünler" },
    { key: "insights", label: "Trend & Veri", icon: "chart", desc: "Google, arbitraj ve kaynak durumu" },
];

export const FILTER_OPTIONS = [
    { key: "best", label: "En İyi Fırsatlar", sortBy: null },
    { key: "fresh", label: "En Güncel", sortBy: "fresh" },
    { key: "trend", label: "Trend Olanlar", sortBy: "trend" },
    { key: "profit", label: "Yüksek Kâr", sortBy: "profit" },
    { key: "competition", label: "Düşük Rekabet", sortBy: "competition" },
];

export const PRODUCT_SORT_OPTIONS = [
    { key: "score", label: "Fırsat Skoru" },
    { key: "profit", label: "Yüksek Kâr" },
    { key: "price", label: "Düşük Fiyat" },
    { key: "rating", label: "Yüksek Puan" },
];
