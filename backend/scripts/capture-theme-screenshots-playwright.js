"use strict";

/**
 * Gerçek vitrin ekran görüntüleri — Playwright.
 * Kullanım: node scripts/capture-theme-screenshots-playwright.js <slug>
 * Env: WB_SCREENSHOT_BASE=http://localhost:3000 API_BASE=http://localhost:5000
 */
const fs = require("fs");
const path = require("path");

const slug = process.argv[2];
if (!slug) {
    console.error("Kullanım: node scripts/capture-theme-screenshots-playwright.js <theme-slug>");
    process.exit(1);
}

const BASE = process.env.WB_SCREENSHOT_BASE || "http://localhost:3000";
const THEMES_ROOT = path.join(__dirname, "../data/themes");
const outDir = path.join(THEMES_ROOT, slug);

const VIEWPORTS = {
    desktop: { width: 1280, height: 720 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 390, height: 844 },
};

async function main() {
    let playwright;
    try {
        playwright = require("playwright");
    } catch {
        console.error("playwright yüklü değil. Çalıştırın: npm install playwright --save-dev && npx playwright install chromium");
        process.exit(1);
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await playwright.chromium.launch({ headless: true });
    const url = `${BASE.replace(/\/$/, "")}/site/demo-store-preview?theme=${slug}`;

    for (const [name, vp] of Object.entries(VIEWPORTS)) {
        const page = await browser.newPage({ viewport: vp });
        try {
            await page.goto(`${BASE}/site/${slug}`, { waitUntil: "networkidle", timeout: 60000 });
        } catch {
            try {
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
            } catch (e) {
                console.warn(`[${name}] sayfa yüklenemedi:`, e.message);
                await page.close();
                continue;
            }
        }
        await page.waitForTimeout(1500);
        const file = name === "desktop" ? "preview.jpg" : `preview-${name}.jpg`;
        await page.screenshot({
            path: path.join(outDir, file),
            type: "jpeg",
            quality: 88,
            fullPage: name !== "desktop",
        });
        if (name === "mobile") {
            await page.screenshot({
                path: path.join(outDir, "thumbnail.jpg"),
                type: "jpeg",
                quality: 85,
            });
        }
        console.log(`[ok] ${slug} → ${file}`);
        await page.close();
    }

    await browser.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
