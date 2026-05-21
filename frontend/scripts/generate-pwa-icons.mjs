/**
 * Dashtock PWA ikonları — brand SVG'den PNG üretir
 * Kullanım: cd frontend && npm install --save-dev sharp && node scripts/generate-pwa-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "brand", "dashtock-logo.svg");
const iconsDir = path.join(root, "public", "icons");

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 192, 384, 512];

if (!fs.existsSync(svgPath)) {
    console.error("Logo bulunamadı:", svgPath);
    process.exit(1);
}

fs.mkdirSync(iconsDir, { recursive: true });
const svg = fs.readFileSync(svgPath);

for (const size of sizes) {
    const out = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(svg).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
    console.log("✓", path.basename(out));
}

// Tarayıcı varsayılanı /favicon.ico — 32px PNG (çoğu tarayıcı kabul eder)
await sharp(svg).resize(32, 32, { fit: "contain", background: { r: 15, g: 118, b: 110, alpha: 255 } }).png().toFile(path.join(root, "public", "favicon.png"));

console.log("\nTamamlandı. index.html favicon linklerini yenileyin gerekirse.");
