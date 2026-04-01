const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const amazonController = require("../controllers/amazonController");

// ═══════════════════════════════════════════════════════════════════════
// 🛒 AMAZON SP-API ROUTES
// Tüm route'lar /api/amazon altında çalışır
// ═══════════════════════════════════════════════════════════════════════

// ── Siparişler ──
router.get("/orders",                     authMiddleware, amazonController.getOrders);
router.get("/orders/all",                 authMiddleware, amazonController.getAllOrders);
router.get("/orders/:orderId",            authMiddleware, amazonController.getOrder);
router.get("/orders/:orderId/items",      authMiddleware, amazonController.getOrderItems);
router.get("/orders/:orderId/address",    authMiddleware, amazonController.getOrderAddress);

// ── Fiyatlandırma ──
router.post("/pricing",                   authMiddleware, amazonController.getPricing);
router.post("/pricing/competitive",       authMiddleware, amazonController.getCompetitivePricing);

// ── Listing Yönetimi ──
router.get("/listings/:sku",              authMiddleware, amazonController.getListingsItem);
router.patch("/listings/:sku/price",      authMiddleware, amazonController.updateListingPrice);
router.patch("/listings/:sku/stock",      authMiddleware, amazonController.updateListingStock);
router.put("/listings/:sku",              authMiddleware, amazonController.putListingsItem);
router.delete("/listings/:sku",           authMiddleware, amazonController.deleteListingsItem);

// ── Katalog ──
router.get("/catalog/search",             authMiddleware, amazonController.searchCatalogItems);
router.get("/catalog/:asin",              authMiddleware, amazonController.getCatalogItem);

// ── Ürün Tipleri ──
router.get("/product-types/search",       authMiddleware, amazonController.searchProductTypes);
router.get("/product-types/:productType", authMiddleware, amazonController.getProductTypeDefinition);

// ── Kargo (Merchant Fulfillment) ──
router.post("/shipping/eligible-services", authMiddleware, amazonController.getEligibleShipmentServices);
router.post("/shipping/create",            authMiddleware, amazonController.createShipment);
router.delete("/shipping/:shipmentId",     authMiddleware, amazonController.cancelShipment);

// ── Envanter ──
router.get("/inventory",                  authMiddleware, amazonController.getInventorySummaries);

// ── Raporlar ──
router.post("/reports",                   authMiddleware, amazonController.createReport);
router.get("/reports/:reportId",          authMiddleware, amazonController.getReport);
router.get("/reports/:reportId/document", authMiddleware, amazonController.getReportDocument);

// ── Kısıtlamalar ──
router.get("/restrictions/:asin",         authMiddleware, amazonController.getListingRestrictions);

// ── Test ──
router.post("/test-credentials",          authMiddleware, amazonController.testCredentials);

module.exports = router;
