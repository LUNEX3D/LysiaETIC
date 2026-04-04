const express = require("express");
const router = express.Router();
const advancedProductController = require("../controllers/advancedProductController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");

// ✅ Tüm route'lar için auth + subscription gerekli
router.use(authMiddleware, subscriptionMiddleware);

// ═══════════════════════════════════════════════════════════════
// ÜRÜN ÇEKME İŞLEMLERİ
// ═══════════════════════════════════════════════════════════════

// Tüm pazaryerlerinden ürünleri çek (asenkron)
router.post("/pull-all", advancedProductController.pullAllProducts);

// Tek bir pazaryerinden ürünleri çek
router.post("/pull", advancedProductController.pullProductsFromMarketplace);

// Kategorileri çek
router.post("/pull-categories", advancedProductController.pullCategories);

// ═══════════════════════════════════════════════════════════════
// İŞLEM DURUMU
// ═══════════════════════════════════════════════════════════════

// İşlem durumunu sorgula
router.get("/job/:jobId", advancedProductController.getJobStatus);

// Aktif işlemleri listele
router.get("/jobs/active", advancedProductController.getActiveJobs);

// Tamamlanan işlemleri listele
router.get("/jobs/completed", advancedProductController.getCompletedJobs);

// ═══════════════════════════════════════════════════════════════
// PAZARYERİ KARŞILAŞTIRMA
// ═══════════════════════════════════════════════════════════════

// Pazaryerlerini karşılaştır
router.get("/compare", advancedProductController.compareMarketplaces);

// ═══════════════════════════════════════════════════════════════
// ÜRÜN LİSTELEME
// ═══════════════════════════════════════════════════════════════

// Kullanıcının ürünlerini listele
router.get("/products", advancedProductController.getUserProducts);

// Ürün detayını getir
router.get("/products/:productId", advancedProductController.getProductDetail);

// ═══════════════════════════════════════════════════════════════
// KATEGORİ LİSTELEME
// ═══════════════════════════════════════════════════════════════

// Kullanıcının kategorilerini listele
router.get("/categories", advancedProductController.getUserCategories);

// Kategori detayını getir
router.get("/categories/:categoryId", advancedProductController.getCategoryDetail);

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

// Dashboard verileri
router.get("/dashboard", advancedProductController.getDashboardData);

module.exports = router;
