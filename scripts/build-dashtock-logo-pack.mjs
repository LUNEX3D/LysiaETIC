/**
 * Dashtock logo paketi — SVG'den PNG, frontend senkron, RAR arşivi
 * Kullanım: node scripts/build-dashtock-logo-pack.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(path.join(root, "frontend", "package.json"));
const sharp = require("sharp");
const pack = path.join(root, "Dashtock-Logo-Pack");
const sourceDir = path.join(root, "Dashtock", "Dashtock");
const iconSvg = fs.existsSync(path.join(sourceDir, "Logo.svg"))
    ? path.join(sourceDir, "Logo.svg")
    : path.join(pack, "svg", "dashtock-icon.svg");
const fullSvg = fs.existsSync(path.join(sourceDir, "Dashtock.svg"))
    ? path.join(sourceDir, "Dashtock.svg")
    : path.join(pack, "svg", "dashtock-logo-full.svg");
const fullLightSvg = path.join(pack, "svg", "dashtock-logo-full-on-light.svg");
const publicBrand = path.join(root, "frontend", "public", "brand");
const iconOut = path.join(pack, "png", "icon");
const yatayOut = path.join(pack, "png", "yatay");
const previewOut = path.join(pack, "png", "preview");
const rarOut = path.join(root, "Dashtock-Logo-Pack.rar");

const iconSizes = [16, 32, 48, 64, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024];
const fullWidths = [320, 480, 640, 800, 1200];

for (const dir of [iconOut, yatayOut, previewOut, publicBrand]) {
    fs.mkdirSync(dir, { recursive: true });
}

const iconBuf = fs.readFileSync(iconSvg);
const fullBuf = fs.readFileSync(fullSvg);
const fullLightBuf = fs.readFileSync(fullLightSvg);

for (const size of iconSizes) {
    const out = path.join(iconOut, `icon-${size}x${size}.png`);
    await sharp(iconBuf)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
    console.log("✓", path.relative(pack, out));
}

for (const w of fullWidths) {
    const h = Math.round(w * 0.25);
    for (const [name, buf] of [
        ["logo-full-dark", fullBuf],
        ["logo-full-light", fullLightBuf],
    ]) {
        const out = path.join(yatayOut, `${name}-${w}w.png`);
        await sharp(buf).resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
        console.log("✓", path.relative(pack, out));
    }
}

await sharp(iconBuf).resize(512, 512).png().toFile(path.join(previewOut, "dashtock-icon-preview.png"));
console.log("✓", path.relative(pack, path.join("png", "preview", "dashtock-icon-preview.png")));

fs.copyFileSync(iconSvg, path.join(publicBrand, "dashtock-logo.svg"));
fs.copyFileSync(fullSvg, path.join(publicBrand, "dashtock-logo-full.svg"));
await sharp(iconBuf).resize(512, 512).png().toFile(path.join(publicBrand, "favicon.png"));
console.log("✓ frontend/public/brand senkronlandı");

const winRarCandidates = [
    process.env.WINRAR || "",
    "C:\\Program Files\\WinRAR\\Rar.exe",
    "C:\\Program Files (x86)\\WinRAR\\Rar.exe",
].filter(Boolean);

let rarExe = winRarCandidates.find((p) => fs.existsSync(p));
if (rarExe) {
    if (fs.existsSync(rarOut)) fs.unlinkSync(rarOut);
    const cmd = `"${rarExe}" a -m5 -r "${rarOut}" "${pack}"`;
    execSync(cmd, { stdio: "inherit", cwd: root, windowsHide: true });
    const stat = fs.statSync(rarOut);
    console.log(`\n✓ RAR: ${rarOut} (${(stat.size / 1024).toFixed(1)} KB)`);
} else {
    console.warn("\n⚠ WinRAR bulunamadi — Dashtock-Logo-Pack.rar olusturulamadi.");
    console.warn("  Klasoru elle sıkıştırın veya WinRAR kurun.");
}

console.log("\nLogo paketi hazir:", pack);
