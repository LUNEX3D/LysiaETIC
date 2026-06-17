/**
 * Store Builder V5 — bilgi mimarisi (rotalar mevcut API ile uyumlu)
 */

export const PAGE_TEMPLATE_LINKS = [
    { key: "home", label: "Ana Sayfa", type: "home", slug: "", isHomePage: true },
    { key: "collection", label: "Koleksiyon", type: "products", slug: "products" },
    { key: "product", label: "Ürün", type: "product", slug: "product" },
    { key: "about", label: "Hakkımızda", type: "about", slug: "about" },
    { key: "contact", label: "İletişim", type: "contact", slug: "contact" },
    { key: "blog", label: "Blog", type: "blog", slug: "blog" },
];

export const PAGES_MANAGER_TYPES = [
    { type: "home", label: "Ana Sayfa" },
    { type: "products", label: "Koleksiyon" },
    { type: "product", label: "Ürün" },
    { type: "contact", label: "İletişim" },
    { type: "faq", label: "SSS" },
    { type: "blog", label: "Blog" },
];

export function getStorePageEditPath(siteId, pageId) {
    return `/website-builder/${siteId}/pages`;
}

export function findPageForTemplate(pages, template) {
    if (!pages?.length || !template) return null;
    if (template.isHomePage) {
        return pages.find((p) => p.isHomePage || p.type === "home" || p.slug === "" || p.slug === "home");
    }
    return pages.find((p) => p.type === template.type || p.slug === template.slug);
}

export function pageTypeLabel(page) {
    const map = {
        home: "Ana Sayfa",
        products: "Koleksiyon",
        product: "Ürün",
        "product-detail": "Ürün Detay",
        contact: "İletişim",
        faq: "SSS",
        blog: "Blog",
        about: "Hakkımızda",
        cart: "Sepet",
        custom: "Özel",
    };
    return map[page?.type] || page?.title || "Sayfa";
}
