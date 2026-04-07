/**
 * WEBHOOK ROUTES — Pazaryeri Anlık Bildirim Endpoint'leri
 *
 * ✅ FIX #3: Webhook desteği eklendi
 *
 * ⚠️ ÖNEMLİ: Bu endpoint'ler AUTH GEREKTİRMEZ!
 * Pazaryerleri (Trendyol, N11, Hepsiburada, ÇiçekSepeti) doğrudan bu
 * endpoint'lere POST isteği atar. Her endpoint kendi doğrulama mekanizmasını
 * kullanır (API key, HMAC signature, sellerId eşleştirme vb.)
 *
 * Rate limiter'dan da muaf tutulmalıdır — pazaryeri sunucuları erişmeli.
 *
 * KULLANIM:
 *   1. Trendyol Seller Panel → Entegrasyon → Webhook URL:
 *      https://yourdomain.com/api/webhooks/trendyol
 *
 *   2. N11 Seller Panel → API Ayarları → Webhook URL:
 *      https://yourdomain.com/api/webhooks/n11
 *
 *   3. Hepsiburada Merchant Panel → Entegrasyon → Webhook URL:
 *      https://yourdomain.com/api/webhooks/hepsiburada
 *
 *   4. ÇiçekSepeti Seller Panel → API Ayarları → Webhook URL:
 *      https://yourdomain.com/api/webhooks/ciceksepeti
 */

const express = require("express");
const router = express.Router();

const {
    trendyolWebhook,
    n11Webhook,
    hepsiburadaWebhook,
    ciceksepetiWebhook,
    webhookHealth
} = require("../controllers/webhookController");

// ─── Health Check ──────────────────────────────────────────────────────────────
// GET /api/webhooks/health — Webhook endpoint'lerinin aktif olduğunu doğrula
router.get("/health", webhookHealth);

// ─── Trendyol Webhook ──────────────────────────────────────────────────────────
// POST /api/webhooks/trendyol — Trendyol sipariş bildirimi
router.post("/trendyol", trendyolWebhook);

// ─── N11 Webhook ───────────────────────────────────────────────────────────────
// POST /api/webhooks/n11 — N11 sipariş bildirimi
router.post("/n11", n11Webhook);

// ─── Hepsiburada Webhook ───────────────────────────────────────────────────────
// POST /api/webhooks/hepsiburada — Hepsiburada paket/sipariş bildirimi
router.post("/hepsiburada", hepsiburadaWebhook);

// ─── ÇiçekSepeti Webhook ──────────────────────────────────────────────────────
// POST /api/webhooks/ciceksepeti — ÇiçekSepeti sipariş bildirimi
router.post("/ciceksepeti", ciceksepetiWebhook);

module.exports = router;
