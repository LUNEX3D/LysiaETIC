/**
 * Paket → özellik eşlemesi (route ve menü kilidi için)
 * Admin paneldeki katalog metinleriyle uyumlu; minPlan admin revizyonuyla örtüşür.
 */
const PLAN_RANK = { free: 0, trial: 0, basic: 1, pro: 2, enterprise: 3 };

const FEATURES = {
    dashboard: { minPlan: "trial", label: "Dashboard" },
    orders: { minPlan: "trial", label: "Sipariş yönetimi" },
    products: { minPlan: "trial", label: "Ürün yönetimi" },
    inventory: { minPlan: "trial", label: "Stok yönetimi" },
    shipping: { minPlan: "basic", label: "Kargo takibi" },
    finance_basic: { minPlan: "basic", label: "Finans özeti" },
    reporting_basic: { minPlan: "trial", label: "Temel raporlama" },
    reporting_advanced: { minPlan: "basic", label: "Gelişmiş raporlama" },
    profit_analytics: { minPlan: "pro", label: "Kâr/zarar ve gelişmiş analitik" },
    bulk_products: { minPlan: "basic", label: "Toplu ürün düzenleme" },
    category_center: { minPlan: "basic", label: "Kategori merkezi" },
    category_auto_match: { minPlan: "pro", label: "Akıllı kategori eşleştirme" },
    product_upload: { minPlan: "basic", label: "Ürün yükleme" },
    ai_assistant: { minPlan: "pro", label: "AI Asistan (Dashtock AI)" },
    ai_radar: { minPlan: "pro", label: "Fırsat Radarı" },
    roketfy: { minPlan: "pro", label: "Roketfy pazar araştırması" },
    e_invoice: { minPlan: "pro", label: "E-fatura & otomatik faturalama" },
    finance_dashboard: { minPlan: "pro", label: "Finans dashboard" },
    api_keys: { minPlan: "pro", label: "API anahtarı yönetimi" },
    webhooks: { minPlan: "pro", label: "Webhook desteği" },
    priority_support: { minPlan: "pro", label: "Öncelikli destek" },
    enterprise_sla: { minPlan: "enterprise", label: "SLA & kurumsal özellikler" }
};

/** Plan başına izin verilen pazaryeri adları (yeni entegrasyon) */
const MARKETPLACES_BY_PLAN = {
    trial: ["trendyol", "hepsiburada"],
    basic: ["trendyol", "hepsiburada", "n11"],
    pro: ["trendyol", "hepsiburada", "n11", "amazon", "çiçeksepeti", "ciceksepeti", "pttavm", "ozon"],
    enterprise: ["*"]
};

const normalizeMp = (name) =>
    String(name || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");

const isMarketplaceAllowedForPlan = (plan, marketplaceName) => {
    const key = plan || "trial";
    const allowed = MARKETPLACES_BY_PLAN[key] || MARKETPLACES_BY_PLAN.trial;
    if (allowed.includes("*")) return true;
    const norm = normalizeMp(marketplaceName);
    return allowed.some((a) => norm.includes(normalizeMp(a)) || normalizeMp(a).includes(norm));
};

/** Yükseltme önerisi için bir üst paket */
const UPGRADE_HINT = {
    trial: "basic",
    basic: "pro",
    pro: "enterprise",
    enterprise: "enterprise"
};

module.exports = {
    PLAN_RANK,
    FEATURES,
    MARKETPLACES_BY_PLAN,
    UPGRADE_HINT,
    normalizeMp,
    isMarketplaceAllowedForPlan
};
