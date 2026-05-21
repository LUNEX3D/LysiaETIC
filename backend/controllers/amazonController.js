const amazonService = require("../services/amazon/amazonSpApiService");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
// ✅ FIX: Credential'ları decrypt ederek kullan
const { decryptCredentials } = require("../utils/encryption");

// ═══════════════════════════════════════════════════════════════════════
// 🛒 AMAZON SP-API CONTROLLER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Kullanıcının Amazon credentials'ını al
 */
const getAmazonCredentials = async (req) => {
    const userId = req.user?.id || req.user?._id;
    const marketplaceId = req.params.marketplaceId || req.body.marketplaceId || req.query.marketplaceId;

    let marketplace;
    if (marketplaceId) {
        marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
    } else {
        marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^amazon/i }
        });
    }

    if (!marketplace) {
        const error = new Error("Amazon entegrasyonu bulunamadı");
        error.status = 404;
        throw error;
    }

    const { normalizeAmazonCredentials } = require("../services/amazon/amazonCredentialService");
    return normalizeAmazonCredentials(
        decryptCredentials(marketplace.credentials),
        marketplace.marketplaceName
    );
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 SİPARİŞLER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sipariş listesi çek
 * GET /api/amazon/orders
 * Query: ?createdAfter=&createdBefore=&orderStatuses=&maxResults=
 */
const getOrders = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { createdAfter, createdBefore, orderStatuses, maxResults, nextToken } = req.query;

        const result = await amazonService.getOrders(credentials, {
            createdAfter: createdAfter || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            createdBefore: createdBefore || new Date().toISOString(),
            orderStatuses,
            maxResults: maxResults ? parseInt(maxResults) : 100,
            nextToken
        });

        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Sipariş listesi hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Tüm siparişleri çek (sayfalama ile)
 * GET /api/amazon/orders/all
 * Query: ?createdAfter=&createdBefore=&orderStatuses=
 */
const getAllOrders = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { createdAfter, createdBefore, orderStatuses } = req.query;

        const result = await amazonService.getAllOrders(credentials, {
            createdAfter: createdAfter || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            createdBefore: createdBefore || new Date().toISOString(),
            orderStatuses
        });

        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Tüm siparişler hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Sipariş detayı
 * GET /api/amazon/orders/:orderId
 */
const getOrder = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId gerekli" });
        }

        const result = await amazonService.getOrder(credentials, orderId);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Sipariş detay hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Sipariş ürünleri
 * GET /api/amazon/orders/:orderId/items
 */
const getOrderItems = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId gerekli" });
        }

        const result = await amazonService.getOrderItems(credentials, orderId);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Sipariş ürünleri hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Sipariş adresi
 * GET /api/amazon/orders/:orderId/address
 */
const getOrderAddress = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId gerekli" });
        }

        const result = await amazonService.getOrderAddress(credentials, orderId);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Sipariş adres hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 💰 FİYATLANDIRMA
// ═══════════════════════════════════════════════════════════════════════

/**
 * SKU bazlı fiyat çek
 * POST /api/amazon/pricing
 * Body: { skus: ["SKU1", "SKU2"] }
 */
const getPricing = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { skus } = req.body;

        if (!skus || !Array.isArray(skus) || skus.length === 0) {
            return res.status(400).json({ success: false, message: "skus dizisi gerekli (max 20)" });
        }

        const result = await amazonService.getPricing(credentials, skus);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Fiyat çekme hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Rekabetçi fiyat çek
 * POST /api/amazon/pricing/competitive
 * Body: { asins: ["ASIN1", "ASIN2"] }
 */
const getCompetitivePricing = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { asins } = req.body;

        if (!asins || !Array.isArray(asins) || asins.length === 0) {
            return res.status(400).json({ success: false, message: "asins dizisi gerekli (max 20)" });
        }

        const result = await amazonService.getCompetitivePricing(credentials, asins);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Rekabetçi fiyat hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📋 LİSTİNG YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Listing bilgisi çek
 * GET /api/amazon/listings/:sku
 */
const getListingsItem = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { sku } = req.params;

        if (!sku) {
            return res.status(400).json({ success: false, message: "sku gerekli" });
        }

        const result = await amazonService.getListingsItem(credentials, sku);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Listing çekme hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Listing fiyat güncelle
 * PATCH /api/amazon/listings/:sku/price
 * Body: { price, productType }
 */
const updateListingPrice = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { sku } = req.params;
        const { price, productType } = req.body;

        if (!sku) {
            return res.status(400).json({ success: false, message: "sku gerekli" });
        }
        if (price === undefined || price === null) {
            return res.status(400).json({ success: false, message: "price gerekli" });
        }

        const result = await amazonService.updateListingPrice(credentials, sku, Number(price), productType);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Fiyat güncelleme hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Listing stok güncelle
 * PATCH /api/amazon/listings/:sku/stock
 * Body: { quantity, fulfillmentChannelCode }
 */
const updateListingStock = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { sku } = req.params;
        const { quantity, fulfillmentChannelCode } = req.body;

        if (!sku) {
            return res.status(400).json({ success: false, message: "sku gerekli" });
        }
        if (quantity === undefined || quantity === null) {
            return res.status(400).json({ success: false, message: "quantity gerekli" });
        }

        const result = await amazonService.updateListingStock(credentials, sku, Number(quantity), fulfillmentChannelCode);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Stok güncelleme hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Yeni listing oluştur
 * PUT /api/amazon/listings/:sku
 * Body: { attributes, productType }
 */
const putListingsItem = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { sku } = req.params;
        const { attributes, productType } = req.body;

        if (!sku || !attributes || !productType) {
            return res.status(400).json({ success: false, message: "sku, attributes ve productType gerekli" });
        }

        const result = await amazonService.putListingsItem(credentials, sku, attributes, productType);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Listing oluşturma hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Listing sil
 * DELETE /api/amazon/listings/:sku
 */
const deleteListingsItem = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { sku } = req.params;

        if (!sku) {
            return res.status(400).json({ success: false, message: "sku gerekli" });
        }

        const result = await amazonService.deleteListingsItem(credentials, sku);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Listing silme hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 KATALOG
// ═══════════════════════════════════════════════════════════════════════

/**
 * Katalogda ürün ara
 * GET /api/amazon/catalog/search
 * Query: ?keywords=&identifiers=&identifiersType=&pageSize=&pageToken=
 */
const searchCatalogItems = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { keywords, identifiers, identifiersType, pageSize, pageToken } = req.query;

        if (!keywords && !identifiers) {
            return res.status(400).json({ success: false, message: "keywords veya identifiers gerekli" });
        }

        const result = await amazonService.searchCatalogItems(credentials, {
            keywords,
            identifiers,
            identifiersType,
            pageSize: pageSize ? parseInt(pageSize) : 20,
            pageToken
        });

        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Katalog arama hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Katalog ürün detayı
 * GET /api/amazon/catalog/:asin
 */
const getCatalogItem = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { asin } = req.params;

        if (!asin) {
            return res.status(400).json({ success: false, message: "asin gerekli" });
        }

        const result = await amazonService.getCatalogItem(credentials, asin);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Katalog detay hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🏷️ ÜRÜN TİPLERİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ürün tipi ara
 * GET /api/amazon/product-types/search
 * Query: ?keywords=
 */
const searchProductTypes = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { keywords } = req.query;

        if (!keywords) {
            return res.status(400).json({ success: false, message: "keywords gerekli" });
        }

        const result = await amazonService.searchProductTypes(credentials, keywords);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Ürün tipi arama hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Ürün tipi şeması
 * GET /api/amazon/product-types/:productType
 */
const getProductTypeDefinition = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { productType } = req.params;

        if (!productType) {
            return res.status(400).json({ success: false, message: "productType gerekli" });
        }

        const result = await amazonService.getProductTypeDefinition(credentials, productType);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Ürün tipi şema hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🚚 KARGO
// ═══════════════════════════════════════════════════════════════════════

/**
 * Uygun kargo servislerini çek
 * POST /api/amazon/shipping/eligible-services
 * Body: { orderId, items, shipFromAddress, packageDimensions, weight }
 */
const getEligibleShipmentServices = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const shipmentDetails = req.body;

        if (!shipmentDetails.orderId || !shipmentDetails.items) {
            return res.status(400).json({ success: false, message: "orderId ve items gerekli" });
        }

        const result = await amazonService.getEligibleShipmentServices(credentials, shipmentDetails);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Kargo servisleri hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Kargo oluştur
 * POST /api/amazon/shipping/create
 * Body: { shipmentDetails, shippingService, preference }
 */
const createShipment = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { shipmentDetails, shippingService, preference } = req.body;

        if (!shipmentDetails) {
            return res.status(400).json({ success: false, message: "shipmentDetails gerekli" });
        }

        let selectedService = shippingService;

        // Eğer servis belirtilmemişse, en uygununu seç
        if (!selectedService) {
            const eligibleResult = await amazonService.getEligibleShipmentServices(credentials, shipmentDetails);
            if (!eligibleResult.success || eligibleResult.services.length === 0) {
                return res.status(400).json({ success: false, message: "Uygun kargo servisi bulunamadı" });
            }
            selectedService = amazonService.selectBestShippingService(eligibleResult.services, preference || "cheapest");
        }

        const result = await amazonService.createShipment(credentials, shipmentDetails, selectedService);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Kargo oluşturma hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Kargo iptal et
 * DELETE /api/amazon/shipping/:shipmentId
 */
const cancelShipment = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { shipmentId } = req.params;

        if (!shipmentId) {
            return res.status(400).json({ success: false, message: "shipmentId gerekli" });
        }

        const result = await amazonService.cancelShipment(credentials, shipmentId);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Kargo iptal hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📊 ENVANTER
// ═══════════════════════════════════════════════════════════════════════

/**
 * FBA envanter özeti
 * GET /api/amazon/inventory
 * Query: ?skus=SKU1,SKU2&startDateTime=
 */
const getInventorySummaries = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { skus, startDateTime, nextToken } = req.query;

        const result = await amazonService.getInventorySummaries(credentials, {
            skus: skus ? skus.split(",") : undefined,
            startDateTime,
            nextToken
        });

        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Envanter hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📈 RAPORLAR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Rapor oluştur
 * POST /api/amazon/reports
 * Body: { reportType, startDate, endDate }
 */
const createReport = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { reportType, startDate, endDate } = req.body;

        if (!reportType) {
            return res.status(400).json({ success: false, message: "reportType gerekli" });
        }

        const result = await amazonService.createReport(credentials, reportType, { startDate, endDate });
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Rapor oluşturma hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Rapor durumu
 * GET /api/amazon/reports/:reportId
 */
const getReport = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { reportId } = req.params;

        const result = await amazonService.getReport(credentials, reportId);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Rapor durumu hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

/**
 * Rapor dokümanı indir
 * GET /api/amazon/reports/:reportId/document
 */
const getReportDocument = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { reportId } = req.params;

        // Önce rapor durumunu kontrol et
        const reportResult = await amazonService.getReport(credentials, reportId);
        if (!reportResult.success || !reportResult.reportDocumentId) {
            return res.status(400).json({ success: false, message: "Rapor henüz hazır değil veya bulunamadı" });
        }

        const result = await amazonService.getReportDocument(credentials, reportResult.reportDocumentId);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Rapor indirme hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🔍 KISITLAMALAR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Listeleme kısıtlamaları
 * GET /api/amazon/restrictions/:asin
 */
const getListingRestrictions = async (req, res) => {
    try {
        const credentials = await getAmazonCredentials(req);
        const { asin } = req.params;

        if (!asin) {
            return res.status(400).json({ success: false, message: "asin gerekli" });
        }

        const result = await amazonService.getListingRestrictions(credentials, asin);
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Kısıtlama hatası", { error: error.message });
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🧪 TEST
// ═══════════════════════════════════════════════════════════════════════

/**
 * Credential test
 * POST /api/amazon/test-credentials
 * Body: { clientId, clientSecret, refreshToken, accessKeyId, secretAccessKey, ... }
 */
const testCredentials = async (req, res) => {
    try {
        const { marketplaceName, ...credentialFields } = req.body || {};
        const result = await amazonService.testCredentials(
            credentialFields,
            marketplaceName || req.query.marketplaceName || ""
        );
        res.json(result);
    } catch (error) {
        logger.error("[Amazon Controller] Test hatası", { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    // Orders
    getOrders,
    getAllOrders,
    getOrder,
    getOrderItems,
    getOrderAddress,

    // Pricing
    getPricing,
    getCompetitivePricing,

    // Listings
    getListingsItem,
    updateListingPrice,
    updateListingStock,
    putListingsItem,
    deleteListingsItem,

    // Catalog
    searchCatalogItems,
    getCatalogItem,

    // Product Types
    searchProductTypes,
    getProductTypeDefinition,

    // Shipping
    getEligibleShipmentServices,
    createShipment,
    cancelShipment,

    // Inventory
    getInventorySummaries,

    // Reports
    createReport,
    getReport,
    getReportDocument,

    // Restrictions
    getListingRestrictions,

    // Test
    testCredentials
};
