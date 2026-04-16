#!/usr/bin/env node
/**
 * build-mobile.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════
 * Mobile build script for Capacitor (Android/iOS)
 *
 * Usage:
 *   node scripts/build-mobile.js android     → Build & sync Android
 *   node scripts/build-mobile.js ios         → Build & sync iOS
 *   node scripts/build-mobile.js all         → Build & sync both
 *   node scripts/build-mobile.js android --open  → Build, sync & open Android Studio
 *   node scripts/build-mobile.js ios --open      → Build, sync & open Xcode
 * ═══════════════════════════════════════════════════════════
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const platform = args[0] || "all";
const shouldOpen = args.includes("--open");

function run(cmd, label) {
    console.log(`\n🔧 ${label}...`);
    console.log(`   $ ${cmd}\n`);
    try {
        execSync(cmd, { cwd: ROOT, stdio: "inherit" });
        console.log(`   ✅ ${label} — tamamlandı\n`);
    } catch (err) {
        console.error(`   ❌ ${label} — hata!\n`);
        process.exit(1);
    }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  📱 LysiaETIC — Mobile Build");
console.log(`  Platform: ${platform}`);
console.log(`  Open IDE: ${shouldOpen ? "Evet" : "Hayır"}`);
console.log("═══════════════════════════════════════════════════════════");

// Step 1: React production build
run("npx react-scripts build", "React Production Build");

// Step 2: Sync with Capacitor
if (platform === "android" || platform === "all") {
    run("npx cap sync android", "Capacitor Sync → Android");
    if (shouldOpen) {
        run("npx cap open android", "Android Studio Açılıyor");
    }
}

if (platform === "ios" || platform === "all") {
    run("npx cap sync ios", "Capacitor Sync → iOS");
    if (shouldOpen) {
        run("npx cap open ios", "Xcode Açılıyor");
    }
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  ✅ Mobile build tamamlandı!");
console.log("");
if (!shouldOpen) {
    if (platform === "android" || platform === "all") {
        console.log("  📱 Android Studio'da açmak için:");
        console.log("     npx cap open android");
    }
    if (platform === "ios" || platform === "all") {
        console.log("  🍎 Xcode'da açmak için:");
        console.log("     npx cap open ios");
    }
}
console.log("");
console.log("  🔄 Sadece web değişikliklerini sync etmek için:");
console.log("     npx cap sync");
console.log("═══════════════════════════════════════════════════════════\n");
