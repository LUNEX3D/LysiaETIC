/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KEYWORD EXTRACTION SERVICE — LysiaRadar PRO v2 (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcının mevcut ürünlerinden, kategorilerinden ve harici kaynaklardan
 * anahtar kelime çıkarır. Bu kelimeler fırsat aramasının temelini oluşturur.
 *
 * Kaynaklar:
 *   1. Kullanıcının ürün isimleri → mevcut niş
 *   2. Kullanıcının kategorileri → genişleme alanları
 *   3. Google Trends yükselen aramalar (YENİ)
 *   4. Amazon best seller kategorileri (YENİ)
 *   5. Sabit trend havuzu → mevsimsel ve genel trendler
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const ProductMapping = require("../../models/ProductMapping");
const googleTrendsService = require("./googleTrendsService");
const amazonRadarService = require("./amazonRadarService");

/** Deterministic shuffle — aynı gün aynı kullanıcıya “tek tip liste” üretmez; SerpAPI çağrısından bağımsız çeşitlilik */
function hashString32(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function deterministicShuffle(arr, seedStr) {
    const out = [...arr];
    const rand = mulberry32(hashString32(seedStr));
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// ── Türkçe stop words ──
const STOP_WORDS = new Set([
    "ve", "ile", "için", "bir", "bu", "da", "de", "den", "dan", "mi", "mu",
    "mı", "mü", "çok", "var", "yok", "olan", "olarak", "gibi", "daha",
    "en", "her", "ama", "fakat", "ancak", "hem", "ya", "veya", "ne",
    "adet", "set", "kadın", "erkek", "çocuk", "bebek", "unisex",
    "the", "and", "for", "with", "from", "that", "this",
    "renk", "beden", "numara", "boy", "ebat",
]);

// ── Mevsimsel trend havuzu ──
const SEASONAL_TRENDS = {
    0: ["kışlık mont", "polar", "termal içlik", "kar botu", "bere atkı set"],
    1: ["sevgililer günü hediye", "parfüm", "çikolata kutusu", "takı seti"],
    2: ["bahar ceket", "trençkot", "spor ayakkabı", "bahçe malzemeleri"],
    3: ["yağmurluk", "bahar elbise", "piknik seti", "outdoor ekipman"],
    4: ["yazlık elbise", "sandalet", "güneş gözlüğü", "mayo bikini"],
    5: ["plaj havlusu", "deniz şortu", "güneş kremi", "terlik"],
    6: ["tatil valizi", "şnorkel seti", "kamp çadırı", "okul çantası"],
    7: ["okul kırtasiye", "sırt çantası", "okul forması", "defter kalem"],
    8: ["sonbahar ceket", "bot", "kazak", "eşofman takımı"],
    9: ["halloween kostüm", "sonbahar mont", "yün çorap", "şal"],
    10: ["kışlık bot", "kaban", "polar battaniye", "termos"],
    11: ["yılbaşı hediye", "noel süsü", "kışlık pijama", "hediye kutusu"],
};

// ── Evergreen kategoriler ──
const EVERGREEN_KEYWORDS = [
    "telefon kılıfı", "kulaklık", "powerbank", "organik şampuan",
    "protein tozu", "yoga matı", "led aydınlatma", "mutfak robotu",
    "kahve makinesi", "akıllı saat", "bluetooth hoparlör",
    "cilt bakım seti", "vitamin takviye", "spor çanta",
];

/**
 * Kullanıcının ürünlerinden + harici kaynaklardan anahtar kelime çıkar
 * @param {string} userId
 * @param {object} [opts] - { includeGoogleTrends, includeAmazon }
 * @returns {Promise<object>}
 */
async function extractKeywords(userId, opts = {}) {
    try {
        // ── 1. Kullanıcının ürünlerini çek ──
        const products = await ProductMapping.find(
            { userId },
            { "masterProduct.name": 1, "masterProduct.category": 1, "masterProduct.brand": 1 }
        ).lean();

        // ── 2. Ürün isimlerinden kelime çıkar ──
        const wordFreq = {};
        const categories = new Set();
        const brands = new Set();

        for (const pm of products) {
            const name = (pm.masterProduct?.name || "").toLowerCase();
            const cat = pm.masterProduct?.category || "";
            const brand = pm.masterProduct?.brand || "";

            if (cat) categories.add(cat);
            if (brand && brand.length > 1) brands.add(brand);

            const words = name
                .replace(/[^\wçğıöşüÇĞİÖŞÜ\s-]/g, " ")
                .split(/[\s-]+/)
                .filter(w => w.length > 2 && !STOP_WORDS.has(w));

            for (const w of words) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
            }
        }

        const topWords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([w]) => w);

        // ── 3. Kullanıcı keyword'leri (2-gram) ──
        const userKeywords = generateNGrams(products.map(p => p.masterProduct?.name || ""), topWords);

        // ── 4. Kategori bazlı keyword'ler ──
        const categoryKeywords = generateCategoryKeywords([...categories]);

        // ── 5. Mevsimsel trend keyword'leri ──
        const currentMonth = new Date().getMonth();
        const trendKeywords = [
            ...(SEASONAL_TRENDS[currentMonth] || []),
            ...(SEASONAL_TRENDS[(currentMonth + 1) % 12] || []).slice(0, 2),
        ];

        // ── 6. Evergreen — önce haftalık karıştır (tüm kullanıcılarda aynı sıra gelmesin) ──
        const weekBucket = Math.floor(Date.now() / (7 * 86400000));
        const evergreenShuffled = deterministicShuffle([...EVERGREEN_KEYWORDS], `ew-${weekBucket}-v1`);
        const relevantEvergreen = evergreenShuffled.filter(kw => {
            const kwLower = kw.toLowerCase();
            return [...categories].some(cat =>
                cat.toLowerCase().split(/[\s>/]+/).some(w => kwLower.includes(w) || w.length > 3)
            ) || topWords.some(w => kwLower.includes(w));
        });

        // ── 7. Google Trends yükselen aramalar (YENİ) ──
        let googleTrendKeywords = [];
        if (opts.includeGoogleTrends !== false) {
            try {
                const trending = await googleTrendsService.getTrendingSearches("TR");
                // Kullanıcının kategorileriyle ilişkili olanları filtrele
                googleTrendKeywords = filterRelevantTrends(trending, [...categories], topWords);
                logger.debug(`[KeywordService] Google Trends: ${googleTrendKeywords.length} ilişkili keyword bulundu`);
            } catch (e) {
                logger.debug(`[KeywordService] Google Trends keyword hatası: ${e.message}`);
            }
        }

        // ── 8. Amazon best seller keyword'leri (YENİ) ──
        let amazonKeywords = [];
        if (opts.includeAmazon !== false) {
            try {
                const bestSellers = await amazonRadarService.getAmazonBestSellers("", "TR");
                amazonKeywords = bestSellers
                    .map(p => extractKeywordFromProductName(p.name))
                    .filter(Boolean)
                    .slice(0, 10);
                logger.debug(`[KeywordService] Amazon: ${amazonKeywords.length} keyword bulundu`);
            } catch (e) {
                logger.debug(`[KeywordService] Amazon keyword hatası: ${e.message}`);
            }
        }

        // ── 9. Birleştir: önce kullanıcıya özel çekirdek, sonra harici havuzu kullanıcı+gün+tuz ile karıştır ──
        const dayKey = new Date().toISOString().slice(0, 10);
        const shuffleSalt = opts.shuffleSalt != null ? String(opts.shuffleSalt) : "";
        const seed = `${userId}|${dayKey}|${shuffleSalt}|radar-kw-v2`;

        const prioritizedCore = [...new Set([...userKeywords, ...categoryKeywords])];
        const exploratoryPool = [...new Set([
            ...trendKeywords,
            ...relevantEvergreen,
            ...googleTrendKeywords,
            ...amazonKeywords,
        ])].filter(k => k && !prioritizedCore.includes(k));

        const exploratoryShuffled = deterministicShuffle(exploratoryPool, seed);
        const allKeywords = [...new Set([...prioritizedCore, ...exploratoryShuffled])].slice(0, 45);

        logger.info(
            `[KeywordService] User ${String(userId).slice(-6)} — ` +
            `${userKeywords.length} user, ${categoryKeywords.length} category, ` +
            `${trendKeywords.length} seasonal, ${relevantEvergreen.length} evergreen, ` +
            `${googleTrendKeywords.length} google, ${amazonKeywords.length} amazon → ` +
            `${allKeywords.length} toplam keyword`
        );

        return {
            userKeywords: userKeywords.slice(0, 10),
            categoryKeywords: categoryKeywords.slice(0, 10),
            trendKeywords: trendKeywords.slice(0, 10),
            evergreenKeywords: relevantEvergreen.slice(0, 5),
            googleTrendKeywords: googleTrendKeywords.slice(0, 10),
            amazonKeywords: amazonKeywords.slice(0, 10),
            allKeywords,
            userCategories: [...categories],
            userBrands: [...brands],
        };
    } catch (err) {
        logger.warn(`[KeywordService] Keyword çıkarma hatası (${userId}): ${err.message}`);
        return {
            userKeywords: [],
            categoryKeywords: [],
            trendKeywords: SEASONAL_TRENDS[new Date().getMonth()] || [],
            evergreenKeywords: EVERGREEN_KEYWORDS.slice(0, 5),
            googleTrendKeywords: [],
            amazonKeywords: [],
            allKeywords: deterministicShuffle(
                [...new Set([
                    ...(SEASONAL_TRENDS[new Date().getMonth()] || []),
                    ...EVERGREEN_KEYWORDS.slice(0, 8),
                ])],
                `fallback-${userId}-${Date.now()}`
            ).slice(0, 20),
            userCategories: [],
            userBrands: [],
        };
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Google Trends'ten gelen keyword'leri kullanıcının kategorileriyle filtrele
 */
function filterRelevantTrends(trendingKeywords, userCategories, topWords) {
    if (!trendingKeywords || trendingKeywords.length === 0) return [];

    const catWords = new Set();
    for (const cat of userCategories) {
        cat.toLowerCase().split(/[\s>/]+/).filter(w => w.length > 2).forEach(w => catWords.add(w));
    }
    topWords.forEach(w => catWords.add(w));

    // E-ticaret ile ilgili genel keyword'ler (haber/spor/politika hariç)
    const ecommerceSignals = [
        "fiyat", "indirim", "kampanya", "ürün", "satış", "hediye",
        "alışveriş", "moda", "trend", "yeni", "çıktı", "model",
    ];

    return trendingKeywords.filter(kw => {
        const kwLower = kw.toLowerCase();
        // Kullanıcının kategorileriyle eşleşme
        const catMatch = [...catWords].some(w => kwLower.includes(w));
        // E-ticaret sinyali
        const ecomMatch = ecommerceSignals.some(s => kwLower.includes(s));
        return catMatch || ecomMatch;
    }).slice(0, 10);
}

/**
 * Ürün isminden arama keyword'ü çıkar
 */
function extractKeywordFromProductName(name) {
    if (!name) return "";
    const words = name.toLowerCase()
        .replace(/[^\wçğıöşüÇĞİÖŞÜ\s-]/g, " ")
        .split(/[\s-]+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    // İlk 2-3 anlamlı kelimeyi birleştir
    return words.slice(0, 3).join(" ").trim();
}

function generateNGrams(productNames, topWords) {
    const ngrams = {};

    for (const name of productNames) {
        const words = (name || "").toLowerCase()
            .replace(/[^\wçğıöşüÇĞİÖŞÜ\s-]/g, " ")
            .split(/[\s-]+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));

        for (let i = 0; i < words.length - 1; i++) {
            const gram = `${words[i]} ${words[i + 1]}`;
            if (gram.length > 5) {
                ngrams[gram] = (ngrams[gram] || 0) + 1;
            }
        }
    }

    return Object.entries(ngrams)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([gram]) => gram);
}

function generateCategoryKeywords(categories) {
    const keywords = [];

    for (const cat of categories) {
        const parts = cat.split(/[>/]+/).map(p => p.trim().toLowerCase()).filter(p => p.length > 2);

        if (parts.length > 0) {
            keywords.push(parts[parts.length - 1]);
        }

        if (parts.length >= 2) {
            keywords.push(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
        }
    }

    return [...new Set(keywords)];
}

module.exports = {
    extractKeywords,
    SEASONAL_TRENDS,
    EVERGREEN_KEYWORDS,
};
