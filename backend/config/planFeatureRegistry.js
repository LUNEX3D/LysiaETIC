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
    enterprise_sla: { minPlan: "enterprise", label: "SLA & kurumsal özellikler" },
    own_storefront: { minPlan: "basic", label: "Web mağaza (Dashtock Store)" },
    custom_domain: { minPlan: "pro", label: "Özel domain bağlama" },
    store_checkout: { minPlan: "basic", label: "Mağaza online ödeme (kendi PayTR)" },
    store_marketing: { minPlan: "pro", label: "Pazarlama modülleri (e-posta, otomasyon)" },
    product_personalization_pricing: { minPlan: "pro", label: "Ücretli ürün kişiselleştirmesi" },
    // ─── Website Builder ─────────────────────────────────────────────────────
    website_builder:                 { minPlan: "basic",      label: "Website Builder — temel editör" },
    website_builder_blog:            { minPlan: "basic",      label: "Website Builder Blog modülü" },
    website_builder_product_reviews: { minPlan: "basic",      label: "Website Builder Ürün Değerlendirmeleri" },
    website_builder_analytics:       { minPlan: "pro",        label: "Website Builder Analytics" },
    website_builder_multilang:       { minPlan: "pro",        label: "Website Builder çoklu dil & çeviri" },
    website_builder_premium_themes:  { minPlan: "pro",        label: "Website Builder premium temalar" },
    website_builder_ai:              { minPlan: "pro",        label: "Website Builder AI içerik üretimi" },
    website_builder_ab_testing:      { minPlan: "pro",        label: "Website Builder A/B Test" },
    website_builder_popup_builder:   { minPlan: "pro",        label: "Website Builder Popup/Banner Builder" },
    website_builder_redirect_mgr:    { minPlan: "basic",      label: "Website Builder Yönlendirme Yönetimi" },
    website_builder_multi_store:     { minPlan: "pro",        label: "Website Builder Çoklu Mağaza (tenant > 1 site)" },
    website_builder_custom_checkout: { minPlan: "enterprise", label: "Website Builder Özel Checkout Tasarımı" }
};

/** Website Builder — plan başına site/sayfa/blog limitleri */
const WB_LIMITS = {
    free:       { maxSites: 0,  maxPages: 0,   maxBlogPosts: 0,   maxMediaMb: 0    },
    trial:      { maxSites: 1,  maxPages: 5,   maxBlogPosts: 5,   maxMediaMb: 100  },
    basic:      { maxSites: 1,  maxPages: 10,  maxBlogPosts: 20,  maxMediaMb: 500  },
    pro:        { maxSites: 3,  maxPages: 50,  maxBlogPosts: 200, maxMediaMb: 5000 },
    enterprise: { maxSites: 10, maxPages: -1,  maxBlogPosts: -1,  maxMediaMb: -1   },
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
    WB_LIMITS,
    UPGRADE_HINT,
    normalizeMp,
    isMarketplaceAllowedForPlan,
};
