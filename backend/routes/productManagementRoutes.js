const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const controller = require("../controllers/productManagementController");

// ═══════════════════════════════════════════════════════════════
// 📥 EXCEL / CSV IMPORT & EXPORT
// ═══════════════════════════════════════════════════════════════
router.get("/import/template",                                          authMiddleware, controller.downloadTemplate);
router.post("/import/preview",  authMiddleware, (req, res, next) => { controller.uploadMiddleware(req, res, (err) => { if (err) return res.status(400).json({ error: err.message }); next(); }); }, controller.previewImport);
router.post("/import/execute",  authMiddleware, (req, res, next) => { controller.uploadMiddleware(req, res, (err) => { if (err) return res.status(400).json({ error: err.message }); next(); }); }, controller.executeImport);
router.get("/export",                                                   authMiddleware, controller.exportProducts);

// ═══════════════════════════════════════════════════════════════
// 📦 ÜRÜN CRUD
// ═══════════════════════════════════════════════════════════════
router.post("/products", authMiddleware, controller.createProduct);
router.get("/products", authMiddleware, controller.getProducts);
router.get("/products/:productId", authMiddleware, controller.getProductDetail);
router.put("/products/:productId", authMiddleware, controller.updateProduct);
router.delete("/products/:productId", authMiddleware, controller.deleteProduct);

// ═══════════════════════════════════════════════════════════════
// 🔄 SENKRONİZASYON & DAĞITIM
// ═══════════════════════════════════════════════════════════════
router.post("/sync/from-marketplace", authMiddleware, controller.syncFromMarketplace);
router.post("/sync/distribute", authMiddleware, controller.distributeProduct);
router.post("/sync/bulk-distribute", authMiddleware, controller.bulkDistribute);
router.post("/sync/stock", authMiddleware, controller.syncStock);
router.post("/sync/price", authMiddleware, controller.syncPrice);
router.post("/sync/auto", authMiddleware, controller.triggerAutoSync);

// ═══════════════════════════════════════════════════════════════
// 📋 KATEGORİ YÖNETİMİ
// ═══════════════════════════════════════════════════════════════
router.get("/categories", authMiddleware, controller.getCategoryMappings);
router.post("/categories", authMiddleware, controller.upsertCategoryMapping);
router.put("/products/:productId/category", authMiddleware, controller.updateProductCategoryMapping);

// ═══════════════════════════════════════════════════════════════
// 📢 BİLDİRİM & LOG
// ═══════════════════════════════════════════════════════════════
router.get("/logs", authMiddleware, controller.getSyncLogs);
router.get("/notifications", authMiddleware, controller.getUnreadNotifications);
router.put("/notifications/:notificationId/read", authMiddleware, controller.markNotificationRead);

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD
// ═══════════════════════════════════════════════════════════════
router.get("/dashboard",   authMiddleware, controller.getProductManagementDashboard);

// ═══════════════════════════════════════════════════════════════
// 🔄 TOPLU SYNC & KARŞILAŞTIRMA
// ═══════════════════════════════════════════════════════════════
router.post("/sync/all",                       authMiddleware, controller.syncAllMarketplaces);
router.get("/comparison",                      authMiddleware, controller.getComparisonMatrix);
router.post("/sync/bulk-distribute-selected",  authMiddleware, controller.bulkDistributeSelected);

// ═══════════════════════════════════════════════════════════════
// 🟠 N11 ÖZEL SERVİSLER
// ═══════════════════════════════════════════════════════════════

// Ürün Servisleri
router.post("/n11/products",              authMiddleware, controller.n11CreateProduct);
router.get("/n11/products",               authMiddleware, controller.n11GetProducts);
router.post("/n11/stock-update",          authMiddleware, controller.n11UpdateStock);
router.get("/n11/tasks/:taskId",          authMiddleware, controller.n11GetTaskDetails);

// Kategori Servisleri
router.get("/n11/categories",                              authMiddleware, controller.n11GetCategories);
router.get("/n11/categories/:categoryId/attributes",       authMiddleware, controller.n11GetCategoryAttributes);

// Sipariş Servisleri
router.get("/n11/orders",                    authMiddleware, controller.n11GetOrders);
router.put("/n11/orders/update",             authMiddleware, controller.n11UpdateOrder);
router.post("/n11/orders/split",             authMiddleware, controller.n11SplitPackage);
router.post("/n11/orders/split-by-quantity", authMiddleware, controller.n11SplitPackageByQuantity);
router.put("/n11/orders/labor-costs",        authMiddleware, controller.n11AddLaborCost);

// ═══════════════════════════════════════════════════════════════
// 🔬 DEBUG (Geliştirme amaçlı — N11 ham API yanıtını göster)
// ═══════════════════════════════════════════════════════════════
router.get("/n11/debug/raw-products",        authMiddleware, controller.n11DebugRawProducts);

module.exports = router;
