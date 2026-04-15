const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const amazonController = require("../controllers/amazonController");

// ═══════════════════════════════════════════════════════════════════════
// 🛒 AMAZON SP-API ROUTES
// Tüm route'lar /api/amazon altında çalışır
// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar erişemez
// ═══════════════════════════════════════════════════════════════════════

// Tüm route'lar auth + subscription gerektirir
router.use(authMiddleware, subscriptionMiddleware);

// ── Siparişler ──
router.get("/orders",                     amazonController.getOrders);
router.get("/orders/all",                 amazonController.getAllOrders);
router.get("/orders/:orderId",            amazonController.getOrder);
router.get("/orders/:orderId/items",      amazonController.getOrderItems);
router.get("/orders/:orderId/address",    amazonController.getOrderAddress);

// ── Fiyatlandırma ──
router.post("/pricing",                   amazonController.getPricing);
router.post("/pricing/competitive",       amazonController.getCompetitivePricing);

// ── Listing Yönetimi ──
router.get("/listings/:sku",              amazonController.getListingsItem);
router.patch("/listings/:sku/price",      amazonController.updateListingPrice);
router.patch("/listings/:sku/stock",      amazonController.updateListingStock);
router.put("/listings/:sku",              amazonController.putListingsItem);
router.delete("/listings/:sku",           amazonController.deleteListingsItem);

// ── Katalog ──
router.get("/catalog/search",             amazonController.searchCatalogItems);
router.get("/catalog/:asin",              amazonController.getCatalogItem);

// ── Ürün Tipleri ──
router.get("/product-types/search",       amazonController.searchProductTypes);
router.get("/product-types/:productType", amazonController.getProductTypeDefinition);

// ── Kargo (Merchant Fulfillment) ──
router.post("/shipping/eligible-services", amazonController.getEligibleShipmentServices);
router.post("/shipping/create",            amazonController.createShipment);
router.delete("/shipping/:shipmentId",     amazonController.cancelShipment);

// ── Envanter ──
router.get("/inventory",                  amazonController.getInventorySummaries);

// ── Raporlar ──
router.post("/reports",                   amazonController.createReport);
router.get("/reports/:reportId",          amazonController.getReport);
router.get("/reports/:reportId/document", amazonController.getReportDocument);

// ── Kısıtlamalar ──
router.get("/restrictions/:asin",         amazonController.getListingRestrictions);

// ── Test ──
router.post("/test-credentials",          amazonController.testCredentials);

module.exports = router;
