const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ciceksepetiController = require("../controllers/ciceksepetiController");

// ═══════════════════════════════════════════════════════════════════════
// 🌸 ÇİÇEKSEPETİ API ROUTE'LARI
// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar erişemez
// ═══════════════════════════════════════════════════════════════════════

// Tüm route'lar auth + subscription gerektirir
router.use(authMiddleware, subscriptionMiddleware);

// ─── Siparişler ───
router.post("/orders",                     ciceksepetiController.getOrders);
router.post("/orders/canceled",            ciceksepetiController.getCanceledOrders);

// ─── Kargo ───
router.put("/cargo/cs-integration",        ciceksepetiController.getCargoCode);
router.put("/cargo/supplier-integration",  ciceksepetiController.updateOrderStatus);

// ─── Ürünler ───
router.get("/products",                    ciceksepetiController.getProducts);
router.post("/products",                   ciceksepetiController.createProducts);
router.put("/products",                    ciceksepetiController.updateProducts);
router.put("/products/price-and-stock",    ciceksepetiController.updatePriceAndStock);
router.get("/products/batch-status/:batchId", ciceksepetiController.getBatchStatus);

// ─── Kategoriler ───
router.get("/categories",                  ciceksepetiController.getCategories);
router.get("/categories/:categoryId/attributes", ciceksepetiController.getCategoryAttributes);

// ─── Ürün Soruları ───
router.get("/seller-questions",            ciceksepetiController.getSellerQuestions);
router.put("/seller-questions/:id",        ciceksepetiController.answerSellerQuestion);

// ─── Fatura ───
router.post("/invoice",                    ciceksepetiController.sendInvoice);

// ─── İade ───
router.post("/refund/start",               ciceksepetiController.startRefundProcess);
router.post("/refund/evaluate",            ciceksepetiController.evaluateCancellation);

// ─── Test ───
router.post("/test-credentials",           ciceksepetiController.testCredentials);

module.exports = router;
