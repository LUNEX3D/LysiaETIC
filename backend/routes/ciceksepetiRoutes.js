const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const ciceksepetiController = require("../controllers/ciceksepetiController");

// ═══════════════════════════════════════════════════════════════════════
// 🌸 ÇİÇEKSEPETİ API ROUTE'LARI
// ═══════════════════════════════════════════════════════════════════════

// ─── Siparişler ───
router.post("/orders",                     authMiddleware, ciceksepetiController.getOrders);
router.post("/orders/canceled",            authMiddleware, ciceksepetiController.getCanceledOrders);

// ─── Kargo ───
router.put("/cargo/cs-integration",        authMiddleware, ciceksepetiController.getCargoCode);
router.put("/cargo/supplier-integration",  authMiddleware, ciceksepetiController.updateOrderStatus);

// ─── Ürünler ───
router.get("/products",                    authMiddleware, ciceksepetiController.getProducts);
router.post("/products",                   authMiddleware, ciceksepetiController.createProducts);
router.put("/products",                    authMiddleware, ciceksepetiController.updateProducts);
router.put("/products/price-and-stock",    authMiddleware, ciceksepetiController.updatePriceAndStock);
router.get("/products/batch-status/:batchId", authMiddleware, ciceksepetiController.getBatchStatus);

// ─── Kategoriler ───
router.get("/categories",                  authMiddleware, ciceksepetiController.getCategories);
router.get("/categories/:categoryId/attributes", authMiddleware, ciceksepetiController.getCategoryAttributes);

// ─── Ürün Soruları ───
router.get("/seller-questions",            authMiddleware, ciceksepetiController.getSellerQuestions);
router.put("/seller-questions/:id",        authMiddleware, ciceksepetiController.answerSellerQuestion);

// ─── Fatura ───
router.post("/invoice",                    authMiddleware, ciceksepetiController.sendInvoice);

// ─── İade ───
router.post("/refund/start",               authMiddleware, ciceksepetiController.startRefundProcess);
router.post("/refund/evaluate",            authMiddleware, ciceksepetiController.evaluateCancellation);

// ─── Test ───
router.post("/test-credentials",           authMiddleware, ciceksepetiController.testCredentials);

module.exports = router;
