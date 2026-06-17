#!/usr/bin/env node
"use strict";

/**
 * Shopify Dawn temasını GitHub'dan indirir.
 * node backend/scripts/sync-dawn-from-github.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TARGET = path.join(__dirname, "../theme-builder-v3/dawn-source");
const REPO = "https://github.com/Shopify/dawn.git";

function run(cmd) {
    execSync(cmd, { stdio: "inherit", cwd: path.dirname(TARGET) });
}

if (fs.existsSync(path.join(TARGET, ".git"))) {
    console.log("Dawn güncelleniyor...");
    run(`git -C "${TARGET}" pull --depth 1`);
} else {
    console.log("Dawn klonlanıyor...");
    run(`git clone --depth 1 ${REPO} "${TARGET}"`);
}

const templates = fs.readdirSync(path.join(TARGET, "templates")).filter((f) => f.endsWith(".json"));
const sections = fs.readdirSync(path.join(TARGET, "sections")).length;
console.log(`OK — Dawn ${templates.length} şablon, ${sections} section dosyası hazır.`);
