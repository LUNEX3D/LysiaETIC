"use strict";

/**
 * Starter tema klasörleri için preview.jpg (1280×720) ve thumbnail.jpg (480×300) üretir.
 * Kullanım: node scripts/generate-theme-preview-assets.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const THEMES_ROOT = path.join(__dirname, "../data/themes");

const STARTER_THEMES = [
    { slug: "modern-store", primary: "#0f172a", secondary: "#3b82f6", accent: "#10b981", label: "Modern Store", layout: "marquee" },
    { slug: "fashion-pro", primary: "#111827", secondary: "#dc2626", accent: "#f9fafb", label: "Fashion Pro", layout: "hero" },
    { slug: "electronics-plus", primary: "#06b6d4", secondary: "#0ea5e9", accent: "#0f172a", label: "Electronics Plus", layout: "tech" },
    { slug: "marketplace-pro", primary: "#2563eb", secondary: "#8b5cf6", accent: "#f8fafc", label: "Marketplace Pro", layout: "dense" },
    { slug: "furniture-store", primary: "#78716c", secondary: "#ca8a04", accent: "#fafaf9", label: "Furniture Store", layout: "warm" },
];

function blocksForLayout(layout, primary, secondary) {
    const bar = (y, w, h, fill) => `<rect x="40" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" opacity="0.9"/>`;
    switch (layout) {
        case "marquee":
            return `${bar(24, 920, 28, primary)}${bar(68, 920, 200, secondary)}${bar(288, 440, 120, "#e2e8f0")}${bar(288, 500, 120, "#e2e8f0")}${bar(288, 560, 400, "#e2e8f0")}${bar(432, 920, 64, primary)}`;
        case "hero":
            return `${bar(24, 920, 220, secondary)}${bar(260, 920, 100, primary)}${bar(380, 300, 140, "#e2e8f0")}${bar(380, 360, 300, "#e2e8f0")}${bar(380, 680, 280, "#e2e8f0")}${bar(540, 920, 56, primary)}`;
        case "tech":
            return `${bar(24, 920, 32, primary)}${bar(72, 920, 180, secondary)}${bar(272, 200, 160, "#334155")}${bar(272, 380, 200, "#334155")}${bar(272, 600, 360, "#334155")}${bar(452, 920, 80, primary)}`;
        case "dense":
            return `${bar(24, 920, 160, secondary)}${bar(200, 140, 100, "#e2e8f0")}${bar(200, 260, 100, "#e2e8f0")}${bar(200, 380, 100, "#e2e8f0")}${bar(200, 500, 100, "#e2e8f0")}${bar(320, 640, 120, "#e2e8f0")}${bar(320, 780, 180, "#e2e8f0")}${bar(520, 920, 48, primary)}`;
        case "warm":
        default:
            return `${bar(24, 920, 200, secondary)}${bar(240, 280, 160, "#e7e5e4")}${bar(240, 460, 160, "#e7e5e4")}${bar(240, 640, 160, "#e7e5e4")}${bar(420, 920, 120, primary)}${bar(560, 920, 52, primary)}`;
    }
}

function buildStorefrontSvg(theme) {
    const { primary, secondary, accent, label, layout } = theme;
    const blocks = blocksForLayout(layout, primary, secondary);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${accent};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="0" y="0" width="1280" height="56" fill="${primary}"/>
  <text x="48" y="36" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700">${label}</text>
  <rect x="80" y="80" width="1120" height="560" rx="12" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
  ${blocks}
  <text x="640" y="680" text-anchor="middle" fill="${primary}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="600">LysiaETIC Theme Preview</text>
</svg>`;
}

async function writeJpegs(dir, svg) {
    const preview = await sharp(Buffer.from(svg)).resize(1280, 720, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
    const thumbnail = await sharp(Buffer.from(svg)).resize(480, 300, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    fs.writeFileSync(path.join(dir, "preview.jpg"), preview);
    fs.writeFileSync(path.join(dir, "thumbnail.jpg"), thumbnail);
}

async function main() {
    for (const theme of STARTER_THEMES) {
        const dir = path.join(THEMES_ROOT, theme.slug);
        if (!fs.existsSync(dir)) {
            console.warn(`[skip] ${theme.slug} — klasör yok`);
            continue;
        }
        const svg = buildStorefrontSvg(theme);
        await writeJpegs(dir, svg);
        console.log(`[ok] ${theme.slug} → preview.jpg, thumbnail.jpg`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
