"use strict";

/**
 * OSS / legacy tema slug → TBv2 Lysia paket slug
 * Eski installOssTheme çağrıları gerçek section vitrinine yönlendirilir.
 */
const OSS_TO_TBV2_SLUG = {
    "modern-store": "lysia-market",
    "dawn-trade": "lysia-dawn",
    "fashion-pro": "lysia-boutique",
    "craft-boutique": "lysia-boutique",
    "spotlight-showcase": "lysia-luxe",
    "electronics-plus": "lysia-tech",
    "minimal-luxury": "lysia-luxe",
    "beauty-store": "lysia-boutique",
    "food-store": "lysia-fresh",
    "furniture-store": "lysia-market",
    "lumiere-fashion": "lysia-boutique",
    "luxury-brand": "lysia-luxe",
    "jewelry-store": "lysia-luxe",
    "kids-store": "lysia-fresh",
    "pet-store": "lysia-fresh",
    "sports-store": "lysia-market",
    "home-decor": "lysia-market",
    "digital-products": "lysia-tech",
    "marketplace-pro": "lysia-market",
    "vercel-commerce": "lysia-market",
    "medusa-starter": "lysia-market",
    "boutique-elegant": "lysia-boutique",
    "dark-commerce": "lysia-tech",
    aurora: "lysia-dawn",
    minimal: "lysia-luxe",
    bold: "lysia-tech",
};

const DEFAULT_TBV2_SLUG = "lysia-market";

function resolveTbv2SlugForOss(ossSlug) {
    const key = String(ossSlug || "").toLowerCase();
    return OSS_TO_TBV2_SLUG[key] || DEFAULT_TBV2_SLUG;
}

module.exports = {
    OSS_TO_TBV2_SLUG,
    DEFAULT_TBV2_SLUG,
    resolveTbv2SlugForOss,
};
