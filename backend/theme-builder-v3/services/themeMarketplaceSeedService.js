"use strict";

const WBTheme = require("../../models/WBTheme");
const WBThemeVersion = require("../../models/WBThemeVersion");
const {
    OS_THEME_SLUGS,
    OPENSOURCE_THEME_CATALOG,
    THEME_PRESETS,
    getThemePreviewImage,
} = require("../catalog/opensourceThemes");

async function upsertThemeVersion(theme, preset) {
    let version = await WBThemeVersion.findOne({ themeId: theme._id, version: "1.0.0" });
    if (!version) {
        version = await WBThemeVersion.create({
            themeId: theme._id,
            version: "1.0.0",
            changelog: `${theme.name} — açık kaynak paket`,
            status: "published",
            publishedAt: new Date(),
            defaultSettings: {
                variables: preset?.globalStyles || {},
                headerConfig: preset?.header || {},
                footerConfig: preset?.footer || {},
            },
        });
    }
    return version;
}

async function ensureMarketplaceThemes() {
    // Eski Lysia temalarını devre dışı bırak
    await WBTheme.updateMany(
        { slug: { $nin: OS_THEME_SLUGS } },
        { $set: { isActive: false } }
    );

    let count = 0;
    for (const t of OPENSOURCE_THEME_CATALOG) {
        const preset = THEME_PRESETS[t.slug];
        await WBTheme.findOneAndUpdate(
            { slug: t.slug },
            {
                slug: t.slug,
                name: t.name,
                category: t.category,
                description: t.description,
                author: t.author,
                version: "1.0.0",
                isActive: true,
                isPremium: false,
                isFeatured: !!t.isFeatured,
                sortOrder: t.sortOrder,
                thumbnailUrl: t.thumbnailUrl || getThemePreviewImage(t.slug),
                previewUrl: t.previewUrl || getThemePreviewImage(t.slug),
                variables: preset?.globalStyles || {},
                defaultHomeLayout: [],
                defaultHeaderConfig: preset?.header || {},
                defaultFooterConfig: {},
                tags: [t.license, "opensource", t.slug],
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const theme = await WBTheme.findOne({ slug: t.slug });
        await upsertThemeVersion(theme, preset);
        count += 1;
    }
    return count;
}

module.exports = {
    OPENSOURCE_THEME_CATALOG,
    OS_THEME_SLUGS,
    ensureMarketplaceThemes,
};
