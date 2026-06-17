"use strict";

/**
 * Tam vitrin tema paketlerini backend/data/oss-themes/*.json olarak yazar.
 * Kullanım: node backend/scripts/sync-full-theme-packs.js
 */
const fs = require("fs");
const path = require("path");
const { getAllThemePacks } = require("../lib/fullStorefrontTemplates");

const OUT_DIR = path.join(__dirname, "../data/oss-themes");

function main() {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const packs = getAllThemePacks();
    let written = 0;

    for (const pack of packs) {
        const { meta, ...rest } = pack;
        const out = {
            slug: rest.slug,
            name: rest.name,
            fallbackThemeSlug: rest.fallbackThemeSlug,
            previewColors: rest.previewColors,
            variables: rest.variables,
            category: meta?.category,
            descriptionTr: meta?.descriptionTr,
            source: meta?.source,
            license: meta?.license,
            stack: meta?.stack,
            grapes: rest.grapes,
        };
        const filePath = path.join(OUT_DIR, `${rest.slug}.json`);
        fs.writeFileSync(filePath, JSON.stringify(out, null, 2), "utf8");
        written += 1;
        console.log(`✓ ${rest.slug} (${rest.grapes.html.length} html chars)`);
    }

    console.log(`\n${written} tam tema paketi yazıldı → ${OUT_DIR}`);
}

main();
