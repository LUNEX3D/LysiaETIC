/**
 * KATEGORİ HATA MERKEZİ ROUTE'LARI
 *
 * Prefix: /api/category-errors
 *
 * Ürün dağıtımında kategori hatası alan ürünlerin yönetimi:
 *   - Hata listesi (platform filtreli)
 *   - Platform kategorilerini arama (açılır-kapanır ağaç)
 *   - Kategori seçimi + kaydet + tekrar gönder
 *   - İstatistikler
 */

const express = require("express");
const router  = express.Router();
const { authMiddleware }         = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const ctrl = require("../controllers/categoryErrorController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula
router.use(authMiddleware, subscriptionMiddleware);

// ── Hata Listesi & İstatistikler ─────────────────────────────────────────────
router.get("/",                    ctrl.getCategoryErrors);
router.get("/stats",               ctrl.getCategoryErrorStats);

// ── Platform Kategorileri (Arama + Ağaç) ─────────────────────────────────────
router.get("/platform-categories", ctrl.searchPlatformCategories);

// ── Çözümleme & Tekrar Gönderim ─────────────────────────────────────────────
router.post("/resolve",            ctrl.resolveCategoryError);
router.post("/retry",              ctrl.retrySend);

// ── Silme & Temizleme ────────────────────────────────────────────────────────
router.delete("/clear/resolved",   ctrl.clearResolved);
router.delete("/:id",              ctrl.deleteCategoryError);

module.exports = router;
