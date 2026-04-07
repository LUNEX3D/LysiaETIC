/**
 * Debug: Yeni Adım 1b (Parent→Child Fallback) sonuçlarını test et
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { resolveFromUnifiedMap } = require("../services/categoryMappingService");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const tests = [
        { input: "Küpe",      target: "N11" },
        { input: "Küpe",      target: "Trendyol" },
        { input: "Küpe",      target: "ÇiçekSepeti" },
        { input: "Bileklik",  target: "N11" },
        { input: "Bileklik",  target: "ÇiçekSepeti" },
        { input: "Kolye",     target: "N11" },
        { input: "Yüzük",    target: "N11" },
        // Leaf kategoriler — bunlar direkt exact_key ile bulunmalı
        { input: "Çelik Küpe",    target: "N11" },
        { input: "Altın Küpe",    target: "N11" },
        { input: "Pırlanta Küpe", target: "N11" },
    ];

    for (const t of tests) {
        const result = await resolveFromUnifiedMap(t.input, t.target);
        const id = result?.categoryId ?? "null";
        const name = result?.categoryName ?? "—";
        const src = result?.source ?? "—";
        console.log(`"${t.input}" → ${t.target}: ${id} (${name}) [${src}]`);
    }

    await mongoose.disconnect();
    process.exit(0);
})();
