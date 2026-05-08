const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const controller = require("../controllers/productManagementController");
const variantGroupController = require("../controllers/variantGroupController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ═══════════════════════════════════════════════════════════════
// 📥 EXCEL / CSV IMPORT & EXPORT
// ═══════════════════════════════════════════════════════════════
router.get("/import/template",                                          controller.downloadTemplate);
router.post("/import/preview",  (req, res, next) => { controller.uploadMiddleware(req, res, (err) => { if (err) return res.status(400).json({ error: err.message }); next(); }); }, controller.previewImport);
router.post("/import/execute",  (req, res, next) => { controller.uploadMiddleware(req, res, (err) => { if (err) return res.status(400).json({ error: err.message }); next(); }); }, controller.executeImport);
router.get("/export",                                                   controller.exportProducts);

// ═══════════════════════════════════════════════════════════════
// 📦 ÜRÜN CRUD
// ═══════════════════════════════════════════════════════════════
router.post("/products", controller.createProduct);
router.get("/products", controller.getProducts);
router.get("/products/:productId", controller.getProductDetail);
router.put("/products/:productId", controller.updateProduct);
router.patch("/products/:productId/channel-prices", controller.updateChannelPricesLocal);
router.delete("/products/:productId", controller.deleteProduct);

// ═══════════════════════════════════════════════════════════════
// 🔄 SENKRONİZASYON & DAĞITIM
// ═══════════════════════════════════════════════════════════════
router.get("/sync/job/:jobId", controller.getSyncJobStatus);
router.post("/sync/from-marketplace", controller.syncFromMarketplace);
router.post("/sync/distribute", controller.distributeProduct);
router.post("/sync/bulk-distribute", controller.bulkDistribute);
router.post("/sync/stock", controller.syncStock);
router.post("/sync/price", controller.syncPrice);
router.post("/sync/auto", controller.triggerAutoSync);
router.post("/sync/base-price-sync", controller.basePriceSync);
router.post("/sync/check-pending",   controller.checkPendingTasks);

// ═══════════════════════════════════════════════════════════════
// 🚀 ÜRÜN YÜKLE & DAĞIT
// ═══════════════════════════════════════════════════════════════
router.post("/products/create-and-distribute", controller.createAndDistribute);
router.post(
    "/products/upload-image",
    (req, res, next) => {
        controller.imageUploadMiddleware(req, res, (err) => {
            if (err) return res.status(400).json({ error: err.message });
            next();
        });
    },
    controller.uploadProductImage
);
router.post("/products/suggest-codes",         controller.suggestBarcodeAndSku);
router.post("/products/generate-description",  controller.generateAIDescription);

// ═══════════════════════════════════════════════════════════════
// 📢 BİLDİRİM & LOG
// ═══════════════════════════════════════════════════════════════
router.get("/logs", controller.getSyncLogs);
router.get("/notifications", controller.getUnreadNotifications);
router.put("/notifications/:notificationId/read", controller.markNotificationRead);

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD
// ═══════════════════════════════════════════════════════════════
router.get("/dashboard",   controller.getProductManagementDashboard);

// ═══════════════════════════════════════════════════════════════
// 🔄 TOPLU SYNC & KARŞILAŞTIRMA
// ═══════════════════════════════════════════════════════════════
router.post("/sync/all",                       controller.syncAllMarketplaces);
router.get("/comparison",                      controller.getComparisonMatrix);
router.post("/sync/bulk-distribute-selected",  controller.bulkDistributeSelected);
router.post("/sync/distribute-undistributed",  controller.distributeUndistributed);

// ═══════════════════════════════════════════════════════════════
// 📋 TOPLU ÜRÜN YÖNETİMİ (BULK OPERATIONS)
// ═══════════════════════════════════════════════════════════════
router.post("/bulk/update-prices",  controller.bulkUpdatePrices);
router.post("/bulk/update-stocks",  controller.bulkUpdateStocks);
router.post("/bulk/delete",         controller.bulkDeleteProducts);
router.post("/bulk/update-fields",  controller.bulkUpdateFields);

// ═══════════════════════════════════════════════════════════════
// 🟠 N11 ÖZEL SERVİSLER
// ═══════════════════════════════════════════════════════════════

// Ürün Servisleri
router.post("/n11/products",              controller.n11CreateProduct);
router.get("/n11/products",               controller.n11GetProducts);
router.post("/n11/stock-update",          controller.n11UpdateStock);
router.get("/n11/tasks/:taskId",          controller.n11GetTaskDetails);

// Kategori Servisleri
router.get("/n11/categories",                              controller.n11GetCategories);
router.get("/n11/categories/:categoryId/attributes",       controller.n11GetCategoryAttributes);

// Sipariş Servisleri
router.get("/n11/orders",                    controller.n11GetOrders);
router.put("/n11/orders/update",             controller.n11UpdateOrder);
router.post("/n11/orders/split",             controller.n11SplitPackage);
router.post("/n11/orders/split-by-quantity", controller.n11SplitPackageByQuantity);
router.put("/n11/orders/labor-costs",        controller.n11AddLaborCost);

// ═══════════════════════════════════════════════════════════════
// 🔬 DEBUG (Geliştirme amaçlı)
// ═══════════════════════════════════════════════════════════════
router.get("/n11/debug/raw-products",        controller.n11DebugRawProducts);
router.get("/debug/platform-check",          controller.debugPlatformCheck);

// ═══════════════════════════════════════════════════════════════
// 🏷️ TRENDYOL KATEGORİ ÇEK
// ═══════════════════════════════════════════════════════════════
router.get("/trendyol/categories",           controller.getTrendyolCategories);
router.get("/trendyol/categories/:categoryId/attributes", controller.getTrendyolCategoryAttributesForProduct);
router.get("/trendyol/brands", controller.searchTrendyolBrands);

// ═══════════════════════════════════════════════════════════════
// 🧩 VARYANT GRUPLARI (ürün ailesi — Trendyol productMainId hizalama)
// ═══════════════════════════════════════════════════════════════
router.get("/variant-groups",                      variantGroupController.listVariantGroups);
router.get("/variant-groups/:groupId",             variantGroupController.getVariantGroup);
router.post("/variant-groups",                     variantGroupController.createVariantGroup);
router.patch("/variant-groups/:groupId",           variantGroupController.updateVariantGroup);
router.post("/variant-groups/:groupId/members",    variantGroupController.addVariantGroupMembers);
router.post("/variant-groups/:groupId/members/remove", variantGroupController.removeVariantGroupMembers);
router.delete("/variant-groups/:groupId",         variantGroupController.deleteVariantGroup);

module.exports = router;
