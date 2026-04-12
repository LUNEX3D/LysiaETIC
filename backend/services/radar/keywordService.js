/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KEYWORD EXTRACTION SERVICE — LysiaRadar PRO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kullanıcının mevcut ürünlerinden ve kategorilerinden anahtar kelime çıkarır.
 * Bu kelimeler fırsat aramasının temelini oluşturur.
 *
 * Kaynaklar:
 *   1. Kullanıcının ürün isimleri → mevcut niş
 *   2. Kullanıcının kategorileri → genişleme alanları
 *   3. Trendyol kategori ağacı → komşu kategoriler
 *   4. Sabit trend havuzu → mevsimsel ve genel trendler
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const ProductMapping = require("../../models/ProductMapping");

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
    // Ay bazlı (0=Ocak, 11=Aralık)
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

// ── Evergreen (her zaman trend) kategoriler ──
const EVERGREEN_KEYWORDS = [
    "telefon kılıfı", "kulaklık", "powerbank", "organik şampuan",
    "protein tozu", "yoga matı", "led aydınlatma", "mutfak robotu",
    "kahve makinesi", "akıllı saat", "bluetooth hoparlör",
    "cilt bakım seti", "vitamin takviye", "spor çanta",
];

/**
 * Kullanıcının ürünlerinden anahtar kelime çıkar
 * @param {string} userId
 * @returns {Promise<object>} { userKeywords, categoryKeywords, trendKeywords, allKeywords }
 */
async function extractKeywords(userId) {
    try {
        // 1. Kullanıcının ürünlerini çek
        const products = await ProductMapping.find(
            { userId },
            { "masterProduct.name": 1, "masterProduct.category": 1, "masterProduct.brand": 1 }
        ).lean();

        // 2. Ürün isimlerinden kelime çıkar
        const wordFreq = {};
        const categories = new Set();
        const brands = new Set();

        for (const pm of products) {
            const name = (pm.masterProduct?.name || "").toLowerCase();
            const cat = pm.masterProduct?.category || "";
            const brand = pm.masterProduct?.brand || "";

            if (cat) categories.add(cat);
            if (brand && brand.length > 1) brands.add(brand);

            // İsimden anlamlı kelimeler çıkar
            const words = name
                .replace(/[^\wçğıöşüÇĞİÖŞÜ\s-]/g, " ")
                .split(/[\s-]+/)
                .filter(w => w.length > 2 && !STOP_WORDS.has(w));

            for (const w of words) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
            }
        }

        // En sık geçen kelimelerden keyword'ler oluştur
        const topWords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([w]) => w);

        // 3. Kullanıcı keyword'leri (ürün isimlerinden 2-gram)
        const userKeywords = generateNGrams(products.map(p => p.masterProduct?.name || ""), topWords);

        // 4. Kategori bazlı keyword'ler
        const categoryKeywords = generateCategoryKeywords([...categories]);

        // 5. Mevsimsel trend keyword'leri
        const currentMonth = new Date().getMonth();
        const trendKeywords = [
            ...(SEASONAL_TRENDS[currentMonth] || []),
            ...(SEASONAL_TRENDS[(currentMonth + 1) % 12] || []).slice(0, 2), // Gelecek ay
        ];

        // 6. Evergreen keyword'ler (kullanıcının kategorisine yakın olanlar)
        const relevantEvergreen = EVERGREEN_KEYWORDS.filter(kw => {
            const kwLower = kw.toLowerCase();
            return [...categories].some(cat =>
                cat.toLowerCase().split(/[\s>/]+/).some(w => kwLower.includes(w) || w.length > 3)
            ) || topWords.some(w => kwLower.includes(w));
        });

        // 7. Tüm keyword'leri birleştir ve deduplicate
        const allKeywordsSet = new Set([
            ...userKeywords,
            ...categoryKeywords,
            ...trendKeywords,
            ...relevantEvergreen,
        ]);

        const allKeywords = [...allKeywordsSet].slice(0, 30); // Max 30 keyword

        logger.info(
            `[KeywordService] User ${String(userId).slice(-6)} — ` +
            `${userKeywords.length} user, ${categoryKeywords.length} category, ` +
            `${trendKeywords.length} trend, ${relevantEvergreen.length} evergreen → ` +
            `${allKeywords.length} toplam keyword`
        );

        return {
            userKeywords: userKeywords.slice(0, 10),
            categoryKeywords: categoryKeywords.slice(0, 10),
            trendKeywords: trendKeywords.slice(0, 10),
            evergreenKeywords: relevantEvergreen.slice(0, 5),
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
            allKeywords: [
                ...(SEASONAL_TRENDS[new Date().getMonth()] || []),
                ...EVERGREEN_KEYWORDS.slice(0, 5),
            ],
            userCategories: [],
            userBrands: [],
        };
    }
}

/**
 * Ürün isimlerinden 2-gram keyword'ler oluştur
 */
function generateNGrams(productNames, topWords) {
    const ngrams = {};

    for (const name of productNames) {
        const words = (name || "").toLowerCase()
            .replace(/[^\wçğıöşüÇĞİÖŞÜ\s-]/g, " ")
            .split(/[\s-]+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));

        // 2-gram
        for (let i = 0; i < words.length - 1; i++) {
            const gram = `${words[i]} ${words[i + 1]}`;
            if (gram.length > 5) {
                ngrams[gram] = (ngrams[gram] || 0) + 1;
            }
        }
    }

    return Object.entries(ngrams)
        .filter(([, count]) => count >= 2) // En az 2 kez geçen
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([gram]) => gram);
}

/**
 * Kategori isimlerinden arama keyword'leri oluştur
 */
function generateCategoryKeywords(categories) {
    const keywords = [];

    for (const cat of categories) {
        // Kategori yolunu parçala: "Kadın > Elbise > Günlük Elbise" → ["günlük elbise", "elbise"]
        const parts = cat.split(/[>/]+/).map(p => p.trim().toLowerCase()).filter(p => p.length > 2);

        // Son parça (en spesifik)
        if (parts.length > 0) {
            keywords.push(parts[parts.length - 1]);
        }

        // Son iki parçanın kombinasyonu
        if (parts.length >= 2) {
            keywords.push(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
        }
    }

    // Deduplicate
    return [...new Set(keywords)];
}

module.exports = {
    extractKeywords,
    SEASONAL_TRENDS,
    EVERGREEN_KEYWORDS,
};
