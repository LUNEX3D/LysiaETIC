/** Section blocks helpers — v3 schema sections may use blocks[] or content.slides */
export function getSectionBlocks(section) {
    return section?.blocks || [];
}

export function blocksToSliderSlides(blocks = []) {
    return blocks.map((block) => {
        const c = block.content || block.settings || block;
        return {
            heading: c.heading || c.title || "",
            text: c.text || c.subheading || "",
            ctaText: c.ctaText || c.buttonText || "",
            ctaUrl: c.ctaUrl || c.url || "/",
            backgroundUrl: c.backgroundUrl || c.image || "",
            backgroundColor: c.backgroundColor || "",
            textColor: c.textColor || "#fff",
        };
    });
}
