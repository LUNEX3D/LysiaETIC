"use strict";

/**
 * Lysia kürasyon tema slug → tam vitrin paketi (backend/data/oss-themes/*.json)
 * Her curated tema kendi tam paketine sahip; yoksa modern-store'a düşer.
 */
const CURATED_TO_OSS = {
    "modern-store": "modern-store",
    "dawn-trade": "dawn-trade",
    "fashion-pro": "fashion-pro",
    "craft-boutique": "craft-boutique",
    "spotlight-showcase": "spotlight-showcase",
    "electronics-plus": "electronics-plus",
    "minimal-luxury": "minimal-luxury",
    "beauty-store": "beauty-store",
    "food-store": "food-store",
    "furniture-store": "furniture-store",
    "lumiere-fashion": "lumiere-fashion",
    "luxury-brand": "luxury-brand",
    "jewelry-store": "jewelry-store",
    "kids-store": "kids-store",
    "pet-store": "pet-store",
    "sports-store": "sports-store",
    "home-decor": "home-decor",
    "digital-products": "digital-products",
    "marketplace-pro": "marketplace-pro",
    // Legacy aliases
    aurora: "modern-store",
    minimal: "minimal-luxury",
    bold: "dark-commerce",
    // OSS slug aliases
    "vercel-commerce": "vercel-commerce",
    "medusa-starter": "medusa-starter",
    "saleor-storefront": "saleor-storefront",
    "shadcn-storefront": "shadcn-storefront",
    "tailwind-blocks": "tailwind-blocks",
    "commerce-daisy": "commerce-daisy",
    "bootstrap-store": "bootstrap-store",
    "storefront-minimal": "storefront-minimal",
    "boutique-elegant": "boutique-elegant",
    "dark-commerce": "dark-commerce",
};

const DEFAULT_OSS_SLUG = "modern-store";

function resolveOssSlugForTheme(themeSlug) {
    const key = String(themeSlug || "").toLowerCase();
    return CURATED_TO_OSS[key] || key || DEFAULT_OSS_SLUG;
}

module.exports = {
    CURATED_TO_OSS,
    DEFAULT_OSS_SLUG,
    resolveOssSlugForTheme,
};
