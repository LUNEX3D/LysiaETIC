#!/usr/bin/env node
/**
 * setup-android-icons.js — LysiaETIC
 * Copies PWA icons to Android mipmap directories
 *
 * Android icon sizes:
 *   mdpi:    48x48   → icon-72x72.png (closest)
 *   hdpi:    72x72   → icon-72x72.png
 *   xhdpi:   96x96   → icon-96x96.png
 *   xxhdpi:  144x144 → icon-144x144.png
 *   xxxhdpi: 192x192 → icon-192x192.png
 */

const fs = require("fs");
const path = require("path");

const ICONS_SRC = path.resolve(__dirname, "..", "public", "icons");
const RES_DIR = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");

const mappings = [
    { density: "mipmap-mdpi",    src: "icon-72x72.png" },
    { density: "mipmap-hdpi",    src: "icon-72x72.png" },
    { density: "mipmap-xhdpi",   src: "icon-96x96.png" },
    { density: "mipmap-xxhdpi",  src: "icon-144x144.png" },
    { density: "mipmap-xxxhdpi", src: "icon-192x192.png" }
];

console.log("📱 LysiaETIC — Android Icon Setup\n");

for (const { density, src } of mappings) {
    const srcPath = path.join(ICONS_SRC, src);
    const destDir = path.join(RES_DIR, density);
    const destPath = path.join(destDir, "ic_launcher.png");
    const destRound = path.join(destDir, "ic_launcher_round.png");

    if (!fs.existsSync(srcPath)) {
        console.log(`   ⚠️ ${src} bulunamadı — atlanıyor`);
        continue;
    }

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(srcPath, destPath);
    fs.copyFileSync(srcPath, destRound);
    console.log(`   ✅ ${density} → ${src}`);
}

// Also copy 512x512 as the Play Store icon
const storeSrc = path.join(ICONS_SRC, "icon-512x512.png");
const storeDest = path.join(RES_DIR, "..", "ic_launcher-playstore.png");
if (fs.existsSync(storeSrc)) {
    fs.copyFileSync(storeSrc, storeDest);
    console.log(`   ✅ Play Store icon → icon-512x512.png`);
}

console.log("\n✅ Android ikonları kuruldu!\n");
