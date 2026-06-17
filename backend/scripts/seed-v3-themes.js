"use strict";

/** Açık kaynak tema mağazası seed — Bookly, FreshCart, QuickCart, Dawn */
require("dotenv").config();
const mongoose = require("mongoose");
const { ensureMarketplaceThemes, OPENSOURCE_THEME_CATALOG } = require("../theme-builder-v3/services/themeMarketplaceSeedService");

async function main() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const count = await ensureMarketplaceThemes();
    console.log(`OK — ${count} açık kaynak tema aktif:`, OPENSOURCE_THEME_CATALOG.map((t) => t.slug).join(", "));
    await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
