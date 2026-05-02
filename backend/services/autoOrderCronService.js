/**
 * AUTO ORDER CRON SERVİSİ — Arka Planda Otomatik Sipariş İşleme
 *
 * Periyodik olarak (5 dakikada bir) tüm kullanıcıları tarar ve
 * pazaryerlerinden gelen yeni siparişleri otomatik olarak
 * kargo şirketi seçip "İşlemde" statüsüne alır.
 *
 * ─── Akış ────────────────────────────────────────────────────────────────
 *   1. AutoOrderConfig.enabled === true olan kullanıcı+pazaryeri çiftlerini bul
 *   2. Her biri için pazaryeri API'sinden yeni siparişleri çek
 *   3. Birincil kargo ile işle, başarısız olursa yedek kargo ile tekrar dene
 *   4. Config istatistiklerini güncelle
 *
 * ─── Güvenlik ────────────────────────────────────────────────────────────
 *   - Re-entrancy lock: aynı anda iki cron çalışmaz
 *   - Kullanıcılar arası 2sn bekleme (API rate limit koruması)
 *   - Marketplace'ler arası 1sn bekleme
 */

const mongoose = require("mongoose");
const logger = require("../config/logger");
const AutoOrderConfig = require("../models/AutoOrderConfig");
const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
const { processOrders } = require("./autoOrderService");

// ── Ayarlar ─────────────────────────────────────────────────────────────────
const CRON_INTERVAL_MS = 5 * 60 * 1000;        // 5 dakika
const DELAY_BETWEEN_USERS_MS = 2000;            // Kullanıcılar arası bekleme (ms)
const DELAY_BETWEEN_MARKETPLACES_MS = 1000;     // Marketplace'ler arası bekleme (ms)

// ── Re-entrancy lock ────────────────────────────────────────────────────────
let _cronRunning = false;

/** Aynı yetim config için uyarı spam'ini azalt (pazaryeri silindi / pasif) */
const ORPHAN_LOG_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const _orphanConfigLoggedAt = new Map();

/**
 * Belirli ms kadar bekle
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ana cron fonksiyonu — tüm aktif kullanıcılar için yeni siparişleri işle
 */
const runAutoOrderCron = async () => {
    if (_cronRunning) {
        logger.warn("[AUTO-ORDER CRON] ⚠️ Önceki döngü hâlâ çalışıyor — bu döngü atlanıyor");
        return;
    }
    _cronRunning = true;

    const cronStart = Date.now();
    let totalUsers = 0;
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalFallback = 0;

    try {
        // ── 1. Aktif config'leri bul ────────────────────────────────────────
        const activeConfigs = await AutoOrderConfig.find({ enabled: true }).lean();

        if (activeConfigs.length === 0) {
            return; // Sessizce çık — aktif config yoksa log spam yapma
        }

        logger.info("[AUTO-ORDER CRON] 🔄 Başlatıldı — " + activeConfigs.length + " aktif config taranacak");

        // ── 2. Kullanıcı bazında grupla ─────────────────────────────────────
        const byUser = {};
        for (const config of activeConfigs) {
            const uid = String(config.user);
            if (!byUser[uid]) byUser[uid] = [];
            byUser[uid].push(config);
        }

        // ── 3. Her kullanıcı için işle ──────────────────────────────────────
        for (const [userId, configs] of Object.entries(byUser)) {
            totalUsers++;

            try {
                for (const config of configs) {
                    try {
                        // Marketplace bilgisini çek (ObjectId ile — string userId uyumu)
                        let ownerOid;
                        try {
                            ownerOid = new mongoose.Types.ObjectId(userId);
                        } catch {
                            ownerOid = userId;
                        }
                        const marketplace = await Marketplace.findOne({
                            _id: config.marketplace,
                            userId: ownerOid,
                            isActive: { $ne: false }
                        });

                        if (!marketplace) {
                            const cid = String(config._id);
                            const now = Date.now();
                            const last = _orphanConfigLoggedAt.get(cid) || 0;
                            if (now - last >= ORPHAN_LOG_COOLDOWN_MS) {
                                logger.warn(
                                    "[AUTO-ORDER CRON] Marketplace bulunamadı veya deaktif — configId=" + cid +
                                    " userId=" + userId +
                                    " (Pazaryeri silinmiş veya pasif olabilir; otomatik sipariş ayarında kapatın veya entegrasyonu yeniden bağlayın.)"
                                );
                                _orphanConfigLoggedAt.set(cid, now);
                                await AutoOrderConfig.findByIdAndUpdate(config._id, {
                                    $set: {
                                        "stats.lastError": "Pazaryeri bulunamadı veya pasif — otomatik işlem atlandı.",
                                    }
                                }).catch(() => {});
                            }
                            continue;
                        }

                        // Kargo ayarları kontrol
                        if (!config.primaryCargo || !config.primaryCargo.id) {
                            logger.warn("[AUTO-ORDER CRON] Birincil kargo ayarlanmamış — " + marketplace.marketplaceName + " userId=" + userId);
                            continue;
                        }

                        const credentials = decryptCredentials(marketplace.credentials);

                        logger.info("[AUTO-ORDER CRON] 📦 " + marketplace.marketplaceName + " işleniyor — userId=" + userId + " kargo=" + config.primaryCargo.name);

                        const result = await processOrders(
                            marketplace.marketplaceName,
                            credentials,
                            config.primaryCargo,
                            config.fallbackCargo || { id: "", name: "" }
                        );

                        // Config istatistiklerini güncelle
                        const updateData = {
                            "stats.lastRun": new Date(),
                            "stats.lastError": result.failed > 0
                                ? (result.results.find(r => r.status === "failed")?.error || "")
                                : ""
                        };

                        await AutoOrderConfig.findByIdAndUpdate(config._id, {
                            $set: updateData,
                            $inc: {
                                "stats.totalProcessed": result.processed,
                                "stats.totalSuccess": result.success,
                                "stats.totalFailed": result.failed,
                                "stats.totalFallbackUsed": result.fallbackUsed || 0
                            },
                            $push: {
                                recentOrders: {
                                    $each: result.results.slice(0, 20).map(r => ({
                                        orderNumber: r.orderNumber,
                                        status: r.status,
                                        cargoUsed: r.cargoUsed,
                                        error: r.error || "",
                                        processedAt: new Date()
                                    })),
                                    $slice: -50
                                }
                            }
                        });

                        totalProcessed += result.processed;
                        totalSuccess += result.success;
                        totalFailed += result.failed;
                        totalFallback += result.fallbackUsed || 0;

                        if (result.success > 0) {
                            logger.info("[AUTO-ORDER CRON] ✅ " + marketplace.marketplaceName + ": " + result.success + " sipariş işlendi (userId=" + userId + ")");
                        }
                        if (result.failed > 0) {
                            logger.warn("[AUTO-ORDER CRON] ⚠️ " + marketplace.marketplaceName + ": " + result.failed + " başarısız (userId=" + userId + ")");
                        }

                        // Marketplace'ler arası bekleme
                        await sleep(DELAY_BETWEEN_MARKETPLACES_MS);

                    } catch (mpErr) {
                        totalFailed++;
                        logger.error("[AUTO-ORDER CRON] ❌ " + (config.marketplaceName || "?") + " hatası (userId=" + userId + "): " + mpErr.message);
                    }
                }

                // Kullanıcılar arası bekleme
                await sleep(DELAY_BETWEEN_USERS_MS);

            } catch (userErr) {
                logger.error("[AUTO-ORDER CRON] ❌ Kullanıcı hatası (userId=" + userId + "): " + userErr.message);
            }
        }

    } catch (error) {
        logger.error("[AUTO-ORDER CRON] ❌ Genel hata: " + error.message);
    } finally {
        _cronRunning = false;

        const elapsed = ((Date.now() - cronStart) / 1000).toFixed(1);
        if (totalProcessed > 0 || totalUsers > 0) {
            logger.info(
                "[AUTO-ORDER CRON] ✅ Tamamlandı — " + elapsed + "sn" +
                " | " + totalUsers + " kullanıcı" +
                " | " + totalProcessed + " işlendi" +
                " | " + totalSuccess + " başarılı" +
                " | " + totalFailed + " başarısız" +
                " | " + totalFallback + " yedek kargo"
            );
        }
    }
};

// ── Cron başlat / durdur ────────────────────────────────────────────────────
let cronInterval = null;

const startAutoOrderCron = () => {
    if (cronInterval) return;

    logger.info("[AUTO-ORDER CRON] 🔄 Otomatik sipariş işleme cron'u başlatıldı (" + (CRON_INTERVAL_MS / 60000) + "dk aralık)");

    // İlk çalıştırma: 45sn sonra (sunucu başlangıcında DB bağlantısı stabilize olsun)
    setTimeout(() => {
        runAutoOrderCron().catch(err => {
            logger.error("[AUTO-ORDER CRON] İlk çalıştırma hatası: " + err.message);
        });
    }, 45 * 1000);

    // Periyodik çalıştırma
    cronInterval = setInterval(runAutoOrderCron, CRON_INTERVAL_MS);
};

const stopAutoOrderCron = () => {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
        logger.info("[AUTO-ORDER CRON] ⏹ Otomatik sipariş işleme cron'u durduruldu");
    }
};

module.exports = {
    startAutoOrderCron,
    stopAutoOrderCron,
    runAutoOrderCron,
};
