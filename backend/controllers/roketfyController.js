/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ROKETFY CONTROLLER V4 — BİREBİR ROKETFY KLONU API
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Trendyol pazar istihbaratı API endpoint'leri.
 * Roketfy'ın birebir aynısı — Trendyol'daki TÜM ürünleri analiz eder.
 *
 * Endpoints:
 *   GET  /dashboard                    — Genel bakış
 *   GET  /history                      — Analiz geçmişi
 *   GET  /categories                   — Trendyol kategori listesi
 *
 *   POST /research/products            — Ürün araştırması (Trendyol pazar verisi)
 *   GET  /research/best-sellers        — En çok satanlar
 *   POST /research/keywords            — Anahtar kelime araştırması
 *
 *   POST /competitor/analyze           — Rakip analizi (ürün/mağaza)
 *
 *   POST /listing/analyze              — Listeleme analizi (kendi ürünü)
 *   POST /listing/analyze-all          — Toplu listeleme analizi
 *
 *   POST /content/title                — AI başlık üretimi
 *   POST /content/description          — AI açıklama üretimi
 *
 *   POST /reviews/analyze              — Yorum analizi (Trendyol yorumları)
 *
 *   POST /price/suggest                — Fiyat önerisi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const roketfyService = require("../services/roketfyService");
const logger = require("../config/logger");

const uid = (req) => req.user?._id || req.user?.id;

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD & GENEL
// ═════════════════════════════════════════════════════════════════════════════

exports.getDashboard = async (req, res) => {
    try {
        const result = await roketfyService.getDashboard(uid(req));
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[Roketfy] Dashboard hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Dashboard yüklenemedi", error: err.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const { type, limit = 20, page = 0 } = req.query;
        const result = await roketfyService.getAnalysisHistory(uid(req), {
            type, limit: parseInt(limit), page: parseInt(page),
        });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[Roketfy] Geçmiş hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Geçmiş yüklenemedi", error: err.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = roketfyService.getCategories();
        res.json({ success: true, categories });
    } catch (err) {
        logger.error(`[Roketfy] Kategori hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Kategoriler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// ÜRÜN ARAŞTIRMASI — Trendyol pazar verisi
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /research/products — Trendyol'da ürün araştırması
 * Body: { query?, categoryName?, sort?, page?, limit? }
 */
exports.researchProducts = async (req, res) => {
    try {
        const { query, categoryName, sort, page, limit } = req.body;
        if (!query && !categoryName) {
            return res.status(400).json({ success: false, message: "Arama kelimesi veya kategori gerekli" });
        }
        const result = await roketfyService.researchProducts(uid(req), {
            query: query || "", categoryName: categoryName || "",
            sort: sort || "BEST_SELLER", page: page || 1,
            limit: parseInt(limit) || 100,
        });
        res.json({ success: true, research: result });
    } catch (err) {
        logger.error(`[Roketfy] Ürün araştırması hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürün araştırması başarısız", error: err.message });
    }
};

/**
 * GET /research/best-sellers — En çok satanlar
 * Query: ?category=elektronik&limit=20
 */
exports.getBestSellers = async (req, res) => {
    try {
        const { category, limit, sort } = req.query;
        const result = await roketfyService.getBestSellers(uid(req), {
            categoryKey: category || "",
            limit: parseInt(limit) || 100,
            sort: sort || "BEST_SELLER",
        });
        res.json({ success: true, bestSellers: result });
    } catch (err) {
        logger.error(`[Roketfy] En çok satanlar hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "En çok satanlar yüklenemedi", error: err.message });
    }
};

/**
 * POST /research/keywords — Anahtar kelime araştırması
 * Body: { seedKeyword }
 */
exports.researchKeywords = async (req, res) => {
    try {
        const { seedKeyword } = req.body;
        if (!seedKeyword) {
            return res.status(400).json({ success: false, message: "Anahtar kelime gerekli" });
        }
        const result = await roketfyService.researchKeywords(uid(req), { seedKeyword });
        res.json({ success: true, keywords: result });
    } catch (err) {
        logger.error(`[Roketfy] Anahtar kelime hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Anahtar kelime araştırması başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// RAKİP ARAŞTIRMASI
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /competitor/analyze — Rakip analizi
 * Body: { productUrl?, searchQuery?, categoryName?, barcode? }
 */
exports.analyzeCompetitor = async (req, res) => {
    try {
        const { productUrl, searchQuery, categoryName, barcode } = req.body;
        const result = await roketfyService.analyzeCompetitor(uid(req), {
            productUrl: productUrl || "",
            searchQuery: searchQuery || "",
            categoryName: categoryName || "",
            barcode: barcode || "",
        });
        res.json({ success: true, competitor: result });
    } catch (err) {
        logger.error(`[Roketfy] Rakip analizi hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Rakip analizi başarısız", error: err.message });
    }
};

/**
 * GET /competitor/my-products — Kullanıcının kendi ürünlerini listele (rakip analizi için)
 * Hafif veri: sadece ad, barkod, fiyat, görsel, kategori, stok
 */
exports.getMyProducts = async (req, res) => {
    try {
        const { search, limit } = req.query;
        const result = await roketfyService.getMyProducts(uid(req), {
            search: search || "",
            limit: parseInt(limit) || 500,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[Roketfy] Ürünlerim hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Ürünler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// LİSTELEME ANALİSTİ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /listing/analyze — Tek ürün listeleme analizi
 * Body: { barcode }
 */
exports.analyzeListing = async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) return res.status(400).json({ success: false, message: "Barkod gerekli" });
        const result = await roketfyService.analyzeListingByBarcode(uid(req), barcode);
        res.json({ success: true, analysis: result });
    } catch (err) {
        logger.error(`[Roketfy] Listeleme analizi hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Listeleme analizi başarısız", error: err.message });
    }
};

/**
 * POST /listing/analyze-all — Toplu listeleme analizi
 */
exports.analyzeAllListings = async (req, res) => {
    try {
        const result = await roketfyService.analyzeAllListings(uid(req));
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[Roketfy] Toplu analiz hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Toplu analiz başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// AI İÇERİK YAZARI
// ═════════════════════════════════════════════════════════════════════════════

exports.generateTitle = async (req, res) => {
    try {
        const { barcode, keywords, productInfo } = req.body;
        if (!barcode && !productInfo && (!keywords || keywords.length === 0)) {
            return res.status(400).json({ success: false, message: "Barkod, anahtar kelimeler veya ürün bilgisi gerekli" });
        }
        const result = await roketfyService.generateTitle(uid(req), {
            barcode, keywords: keywords || [], productInfo: productInfo || "",
        });
        res.json({ success: true, content: result });
    } catch (err) {
        logger.error(`[Roketfy] Başlık üretimi hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Başlık üretimi başarısız", error: err.message });
    }
};

exports.generateDescription = async (req, res) => {
    try {
        const { barcode, keywords, productInfo } = req.body;
        if (!barcode && !productInfo && (!keywords || keywords.length === 0)) {
            return res.status(400).json({ success: false, message: "Barkod, anahtar kelimeler veya ürün bilgisi gerekli" });
        }
        const result = await roketfyService.generateDescription(uid(req), {
            barcode, keywords: keywords || [], productInfo: productInfo || "",
        });
        res.json({ success: true, content: result });
    } catch (err) {
        logger.error(`[Roketfy] Açıklama üretimi hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Açıklama üretimi başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// YORUM ANALİZİ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /reviews/analyze — Yorum analizi
 * Body: { contentId?, productUrl?, barcode? }
 */
exports.analyzeReviews = async (req, res) => {
    try {
        const { contentId, productUrl, barcode } = req.body;
        if (!contentId && !productUrl && !barcode) {
            return res.status(400).json({ success: false, message: "Content ID, ürün URL'si veya barkod gerekli" });
        }
        const result = await roketfyService.analyzeReviews(uid(req), {
            contentId: contentId || "",
            productUrl: productUrl || "",
            barcode: barcode || "",
        });
        res.json({ success: true, reviews: result });
    } catch (err) {
        logger.error(`[Roketfy] Yorum analizi hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Yorum analizi başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// FİYAT ÖNERİSİ
// ═════════════════════════════════════════════════════════════════════════════

exports.suggestPrice = async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) return res.status(400).json({ success: false, message: "Barkod gerekli" });
        const result = await roketfyService.suggestPrice(uid(req), { barcode });
        res.json({ success: true, pricing: result });
    } catch (err) {
        logger.error(`[Roketfy] Fiyat önerisi hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Fiyat önerisi başarısız", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// FLAŞ ÜRÜNLER — Anlık yüksek indirimli ürünler
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /research/flash-products — Flaş ürünler (yüksek indirimli)
 * Query: ?category=elektronik&limit=20
 */
exports.getFlashProducts = async (req, res) => {
    try {
        const { category, limit } = req.query;
        const result = await roketfyService.getFlashProducts(uid(req), {
            categoryKey: category || "", limit: parseInt(limit) || 100,
        });
        res.json({ success: true, flashProducts: result });
    } catch (err) {
        logger.error(`[Roketfy] Flaş ürünler hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Flaş ürünler yüklenemedi", error: err.message });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// GELİŞMİŞ KATEGORİ — Alt kategori desteği
// ═════════════════════════════════════════════════════════════════════════════

exports.getDetailedCategories = async (req, res) => {
    try {
        const categories = roketfyService.getDetailedCategories();
        res.json({ success: true, categories });
    } catch (err) {
        logger.error(`[Roketfy] Detaylı kategori hatası: ${err.message}`);
        res.status(500).json({ success: false, message: "Kategoriler yüklenemedi", error: err.message });
    }
};
