/** Maps v3 registry section types to SectionRenderer block types */
export function resolveSectionRenderType(section) {
    const type = section?.type || section?.content?.type;
    const content = section?.content || {};

    if (content.announcement) return "html";
    if (content.marquee) return "html";
    if (type === "hero-slider") return "slider";
    if (type === "hero-split" || content.sectionVariant === "split") return "hero";
    if (type === "hero-video") return "video";
    if (type === "product-slider" || content.sectionVariant === "slider") {
        if (type === "category-grid" || type === "category-slider" || type === "collection-grid") return "category-grid";
        return "product-grid";
    }
    if (type === "image-with-text") return "image-with-text";
    if (type === "image" && (content.html || content.heading)) return "image-with-text";
    if (type === "features") return "html";
    if (type === "story") return "text";
    if (type === "faq") return "text";
    if (type === "blog-grid") return "text";
    if (type === "instagram-feed") return "image";
    if (type === "banner") return "banner";

    return type;
}
