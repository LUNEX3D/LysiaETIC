const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const ciceksepetiService = require("../services/ciceksepeti/ciceksepetiService");
// ✅ FIX: Credential'ları decrypt ederek kullan
const { decryptCredentials } = require("../utils/encryption");

// ═══════════════════════════════════════════════════════════════════════
// 🌸 ÇİÇEKSEPETİ CONTROLLER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Helper: Kullanıcının ÇiçekSepeti entegrasyonunu bul
 */
const findCiceksepetiIntegration = async (userId) => {
    const marketplace = await Marketplace.findOne({
        userId,
        marketplaceName: { $regex: /^[çc][ıi][çc]eksepeti$/i }
    });
    if (marketplace) {
        // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
        marketplace.credentials = decryptCredentials(marketplace.credentials);
    }
    return marketplace;
};

// ─────────────────────────────────────────────────────────────────────
// 📦 SİPARİŞLER
// ─────────────────────────────────────────────────────────────────────

/**
 * Sipariş Listesi
 * POST /api/ciceksepeti/orders
 */
exports.getOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { apiKey, sellerId } = marketplace.credentials;
        if (!apiKey) {
            return res.status(400).json({ success: false, error: "ÇiçekSepeti API Key eksik" });
        }

        const result = await ciceksepetiService.getOrders(marketplace.credentials, req.body);

        return res.json({
            success: result.success,
            marketplace: "ÇiçekSepeti",
            orders: result.orders,
            totalCount: result.totalCount,
            error: result.error
        });

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Sipariş listesi hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * İade/İptal Siparişleri
 * POST /api/ciceksepeti/orders/canceled
 */
exports.getCanceledOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const result = await ciceksepetiService.getCanceledOrders(marketplace.credentials, req.body);

        return res.json({
            success: result.success,
            marketplace: "ÇiçekSepeti",
            orders: result.orders,
            error: result.error
        });

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] İade siparişleri hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 🚚 KARGO
// ─────────────────────────────────────────────────────────────────────

/**
 * Kargo Kodu Al (ÇiçekSepeti Kargo Entegrasyonu)
 * PUT /api/ciceksepeti/cargo/cs-integration
 */
exports.getCargoCode = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { orderItemsGroup } = req.body;
        if (!orderItemsGroup || !Array.isArray(orderItemsGroup)) {
            return res.status(400).json({ success: false, error: "orderItemsGroup gerekli (array)" });
        }

        const result = await ciceksepetiService.getCargoCode(marketplace.credentials, orderItemsGroup);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Kargo kodu alma hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Sipariş Durumu Güncelle (Kendi Kargo Entegrasyonu)
 * PUT /api/ciceksepeti/cargo/supplier-integration
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { orderItems } = req.body;
        if (!orderItems || !Array.isArray(orderItems)) {
            return res.status(400).json({ success: false, error: "orderItems gerekli (array)" });
        }

        const result = await ciceksepetiService.updateOrderStatus(marketplace.credentials, orderItems);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Sipariş durumu güncelleme hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 📦 ÜRÜNLER
// ─────────────────────────────────────────────────────────────────────

/**
 * Ürün Listesi
 * GET /api/ciceksepeti/products
 */
exports.getProducts = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const result = await ciceksepetiService.getProducts(marketplace.credentials, req.query);

        return res.json({
            success: result.success,
            marketplace: "ÇiçekSepeti",
            products: result.products,
            totalCount: result.totalCount,
            error: result.error
        });

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Ürün listesi hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Ürün Yükle
 * POST /api/ciceksepeti/products
 */
exports.createProducts = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { products } = req.body;
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, error: "products gerekli (array)" });
        }

        const result = await ciceksepetiService.createProducts(marketplace.credentials, products);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Ürün yükleme hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Ürün Güncelle
 * PUT /api/ciceksepeti/products
 */
exports.updateProducts = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { products } = req.body;
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, error: "products gerekli (array)" });
        }

        const result = await ciceksepetiService.updateProducts(marketplace.credentials, products);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Ürün güncelleme hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Stok ve Fiyat Güncelle
 * PUT /api/ciceksepeti/products/price-and-stock
 */
exports.updatePriceAndStock = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: "items gerekli (array)" });
        }

        const result = await ciceksepetiService.updatePriceAndStock(marketplace.credentials, items);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Stok/fiyat güncelleme hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Batch İşlem Durumu Sorgula
 * GET /api/ciceksepeti/products/batch-status/:batchId
 */
exports.getBatchStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { batchId } = req.params;
        if (!batchId) {
            return res.status(400).json({ success: false, error: "batchId gerekli" });
        }

        const result = await ciceksepetiService.getBatchStatus(marketplace.credentials, batchId);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Batch status hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 📂 KATEGORİLER
// ─────────────────────────────────────────────────────────────────────

/**
 * Kategori Listesi
 * GET /api/ciceksepeti/categories
 */
exports.getCategories = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const result = await ciceksepetiService.getCategories(marketplace.credentials);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Kategori listesi hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Kategori Özellikleri
 * GET /api/ciceksepeti/categories/:categoryId/attributes
 */
exports.getCategoryAttributes = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { categoryId } = req.params;
        if (!categoryId) {
            return res.status(400).json({ success: false, error: "categoryId gerekli" });
        }

        const result = await ciceksepetiService.getCategoryAttributes(marketplace.credentials, categoryId);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Kategori özellikleri hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 💬 ÜRÜN SORULARI
// ─────────────────────────────────────────────────────────────────────

/**
 * Ürün Sorularını Çek
 * GET /api/ciceksepeti/seller-questions
 */
exports.getSellerQuestions = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const result = await ciceksepetiService.getSellerQuestions(marketplace.credentials, req.query);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Ürün soruları hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Ürün Sorusuna Cevap Ver
 * PUT /api/ciceksepeti/seller-questions/:id
 */
exports.answerSellerQuestion = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { id } = req.params;
        const result = await ciceksepetiService.answerSellerQuestion(marketplace.credentials, id, req.body);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Soru cevaplama hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 📧 FATURA
// ─────────────────────────────────────────────────────────────────────

/**
 * Fatura Gönder
 * POST /api/ciceksepeti/invoice
 */
exports.sendInvoice = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: "items gerekli (array)" });
        }

        const result = await ciceksepetiService.sendInvoice(marketplace.credentials, items);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Fatura gönderimi hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 🔄 İADE
// ─────────────────────────────────────────────────────────────────────

/**
 * İade Süreci Başlat
 * POST /api/ciceksepeti/refund/start
 */
exports.startRefundProcess = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { orderItemIds } = req.body;
        if (!orderItemIds || !Array.isArray(orderItemIds)) {
            return res.status(400).json({ success: false, error: "orderItemIds gerekli (array)" });
        }

        const result = await ciceksepetiService.startRefundProcess(marketplace.credentials, orderItemIds);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] İade süreci başlatma hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * İade Onay/Red
 * POST /api/ciceksepeti/refund/evaluate
 */
exports.evaluateCancellation = async (req, res) => {
    try {
        const userId = req.user._id;
        const marketplace = await findCiceksepetiIntegration(userId);

        if (!marketplace) {
            return res.status(404).json({ success: false, error: "ÇiçekSepeti entegrasyonu bulunamadı" });
        }

        const { orderItemId, process } = req.body;
        if (!orderItemId || !process) {
            return res.status(400).json({ success: false, error: "orderItemId ve process (1: Onay, 3: Red) gerekli" });
        }

        const result = await ciceksepetiService.evaluateCancellation(marketplace.credentials, orderItemId, process);

        return res.json(result);

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] İade değerlendirme hatası", { error: error.message });
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────
// 🧪 TEST
// ─────────────────────────────────────────────────────────────────────

/**
 * ÇiçekSepeti Credential Test
 * POST /api/ciceksepeti/test-credentials
 */
exports.testCredentials = async (req, res) => {
    try {
        const { apiKey, sellerId, integratorName } = req.body;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                message: "❌ API Key gerekli!"
            });
        }

        // Basit bir API çağrısı ile test et — Kategori listesi çek
        const credentials = { apiKey, sellerId, integratorName, isTestMode: false };
        const result = await ciceksepetiService.getCategories(credentials);

        if (result.success && result.categories && result.categories.length > 0) {
            return res.json({
                success: true,
                message: "✅ ÇiçekSepeti API bağlantısı başarılı!",
                categoryCount: result.categories.length
            });
        }

        // Kategori boş geldiyse ama hata yoksa
        if (result.success) {
            return res.json({
                success: true,
                message: "✅ API bağlantısı başarılı (kategori verisi boş olabilir)"
            });
        }

        return res.json({
            success: false,
            message: "❌ API bağlantısı başarısız!",
            error: result.error
        });

    } catch (error) {
        logger.error("[ÇiçekSepeti Controller] Credential test hatası", { error: error.message });
        return res.status(500).json({
            success: false,
            message: "❌ Sunucu hatası!",
            error: error.message
        });
    }
};
