/**
 * FATURA CRON SERVİSİ — Arka Planda Otomatik Faturalama
 *
 * Periyodik olarak (10 dakikada bir) tüm kullanıcıları tarar ve
 * SON 7 GÜN İÇİNDE pazaryerlerinden gelen faturasız siparişlere
 * otomatik e-Arşiv / e-Fatura keser.
 *
 * ⚠️ ÖNEMLİ: Sadece son 7 günlük siparişler işlenir!
 *   Eski/tarihsel siparişler cron tarafından faturalanmaz.
 *   Eski siparişler için "Tümünü Faturala" butonu kullanılmalıdır.
 *
 * ─── Akış ────────────────────────────────────────────────────────────────
 *   1. AutoInvoiceConfig.enabled === true olan kullanıcıları bul
 *   2. Her kullanıcı için SON 7 GÜN içindeki faturasız siparişleri sorgula
 *   3. processAutoInvoice ile QNB üzerinden fatura kes
 *   4. Rate limit: kullanıcılar arası 2sn, faturalar arası 1.5sn bekleme
 *
 * ─── Güvenlik ────────────────────────────────────────────────────────────
 *   - Re-entrancy lock: aynı anda iki cron çalışmaz
 *   - Kullanıcı başına max 25 fatura / döngü (QNB rate limit koruması)
 *   - Ardışık hata limiti (5) aşılırsa kullanıcı otomatik devre dışı
 *   - İptal/iade siparişler atlanır
 *   - 0 TL siparişler atlanır
 *   - Sadece son 7 günlük siparişler (eski tarihsel siparişler atlanır)
 */

const logger = require("../config/logger");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const { processAutoInvoice, normalizeMarketplaceName, getEffectiveTriggerStatuses, getEffectiveInvoiceDelayDays, isOrderPastInvoiceDelay } = require("./autoInvoiceService");

// ── Ayarlar ─────────────────────────────────────────────────────────────────
const CRON_INTERVAL_MS = 10 * 60 * 1000;  // 10 dakika
const MAX_INVOICES_PER_USER = 25;          // Kullanıcı başına döngü limiti
const DELAY_BETWEEN_USERS_MS = 2000;       // Kullanıcılar arası bekleme (ms)
const LOOKBACK_DAYS = 7;                   // Sadece son 7 günlük siparişler

// ── Re-entrancy lock ────────────────────────────────────────────────────────
let _cronRunning = false;

/**
 * Belirli ms kadar bekle
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ana cron fonksiyonu — tüm aktif kullanıcılar için faturasız siparişleri faturala
 */
const runInvoiceCron = async () => {
    if (_cronRunning) {
        logger.warn("[INVOICE CRON] ⚠️ Önceki döngü hâlâ çalışıyor — bu döngü atlanıyor");
        return;
    }
    _cronRunning = true;

    const cronStart = Date.now();
    let totalUsers = 0;
    let totalInvoiced = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    try {
        // ── 1. Aktif config'leri bul ────────────────────────────────────────
        const activeConfigs = await AutoInvoiceConfig.find({
            enabled: true,
            "supplier.vkn": { $ne: "" },
            "stats.consecutiveErrors": { $lt: 5 }
        }).lean();

        if (activeConfigs.length === 0) {
            logger.info("[INVOICE CRON] Aktif otomatik fatura kullanıcısı yok — atlanıyor");
            return;
        }

        logger.info("[INVOICE CRON] 🔄 Başlatıldı — " + activeConfigs.length + " aktif kullanıcı taranacak");

        // ── 2. Her kullanıcı için faturasız siparişleri bul ve faturala ─────
        for (const config of activeConfigs) {
            const userId = config.userId;

            try {
                // Sadece son LOOKBACK_DAYS gün içindeki faturasız siparişleri bul
                // Eski tarihsel siparişler cron tarafından faturalanmaz
                const lookbackDate = new Date();
                lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

                // ✅ FIX: "error" durumundaki siparişleri cron'da tekrar deneme
                // Hatalı siparişler sürekli tekrar denenip aynı hatayı alıyordu
                // Sadece henüz hiç denenmemiş (invoiceStatus: "") siparişleri al
                const cronFilter = {
                    user: userId,
                    invoiceId: { $exists: false },
                    invoiceStatus: { $nin: ["created", "pending", "error"] },
                    isCancelled: false,
                    isReturned: false,
                    totalPrice: { $gt: 0 },
                    createdAt: { $gte: lookbackDate },  // ⚠️ Sadece son 7 gün
                };

                // ── Mükerrer fatura koruması: autoInvoiceStartDate ──────
                // Bu tarihten önce oluşan siparişler otomatik faturalanmaz.
                // Kullanıcı sistemi aktif etmeden önce manuel kestiği
                // faturaların tekrar kesilmesini engeller.
                if (config.autoInvoiceStartDate) {
                    cronFilter.orderDate = { $gte: config.autoInvoiceStartDate };
                }

                const uninvoicedOrders = await Order.find(cronFilter)
                    .sort({ orderDate: -1 }).limit(MAX_INVOICES_PER_USER).lean();

                if (uninvoicedOrders.length === 0) {
                    continue; // Bu kullanıcıda faturasız sipariş yok
                }

                // Pazaryeri aktif mi kontrolü (normalize ederek karşılaştır)
                const enabledMps = (config.enabledMarketplaces || []).map(m => normalizeMarketplaceName(m));

                // Marketplace'e göre grupla + pazaryerine özel durum filtresi uygula
                const byMarketplace = {};
                uninvoicedOrders.forEach(o => {
                    const mp = normalizeMarketplaceName(o.marketplaceName || "Diğer");

                    // enabledMarketplaces boşsa tümü aktif, doluysa sadece listedekiler
                    if (enabledMps.length > 0 && !enabledMps.includes(mp)) {
                        return; // Bu pazaryeri aktif değil
                    }

                    // Gecikme günü (otomatik yol): henüz vadesi gelmemiş siparişleri cron kuyruğuna alma
                    const delayDays = getEffectiveInvoiceDelayDays(config, mp);
                    if (!isOrderPastInvoiceDelay(o.orderDate, delayDays)) {
                        return;
                    }

                    // Pazaryerine özel durum filtresi
                    const triggerStatuses = getEffectiveTriggerStatuses(config, mp);
                    const status = (o.status || "").toLowerCase();
                    const isEligible = triggerStatuses.some(ts => status.includes(ts.toLowerCase()));

                    if (isEligible) {
                        if (!byMarketplace[mp]) byMarketplace[mp] = [];
                        byMarketplace[mp].push(o._id);
                    }
                });

                const totalEligible = Object.values(byMarketplace).reduce((sum, ids) => sum + ids.length, 0);
                if (totalEligible === 0) {
                    continue;
                }

                logger.info("[INVOICE CRON] 📋 userId=" + userId + " — " + totalEligible + " faturasız sipariş bulundu");
                totalUsers++;

                // Her marketplace grubu için fatura kes
                for (const [mp, orderIds] of Object.entries(byMarketplace)) {
                    try {
                        const result = await processAutoInvoice(userId, mp, orderIds);
                        totalInvoiced += result.invoiced;
                        totalErrors += result.errors;
                        totalSkipped += result.skipped;

                        if (result.invoiced > 0) {
                            logger.info("[INVOICE CRON] ✅ " + mp + ": " + result.invoiced + " fatura kesildi (userId=" + userId + ")");
                        }
                        if (result.errors > 0) {
                            logger.warn("[INVOICE CRON] ⚠️ " + mp + ": " + result.errors + " hata (userId=" + userId + ")");
                        }
                    } catch (mpErr) {
                        totalErrors++;
                        logger.error("[INVOICE CRON] ❌ " + mp + " hatası (userId=" + userId + "): " + mpErr.message);
                    }
                }

                // Kullanıcılar arası bekleme (QNB rate limit koruması)
                await sleep(DELAY_BETWEEN_USERS_MS);

            } catch (userErr) {
                totalErrors++;
                logger.error("[INVOICE CRON] ❌ Kullanıcı hatası (userId=" + userId + "): " + userErr.message);
            }
        }

    } catch (error) {
        logger.error("[INVOICE CRON] ❌ Genel hata: " + error.message);
    } finally {
        _cronRunning = false;

        const elapsed = ((Date.now() - cronStart) / 1000).toFixed(1);
        if (totalUsers > 0 || totalInvoiced > 0) {
            logger.info(
                "[INVOICE CRON] ✅ Tamamlandı — " + elapsed + "sn" +
                " | " + totalUsers + " kullanıcı" +
                " | " + totalInvoiced + " fatura kesildi" +
                " | " + totalSkipped + " atlandı" +
                " | " + totalErrors + " hata"
            );
        }
    }
};

// ── Cron başlat / durdur ────────────────────────────────────────────────────
let cronInterval = null;

const startInvoiceCron = () => {
    if (cronInterval) return;

    logger.info("[INVOICE CRON] 🔄 Otomatik faturalama cron'u başlatıldı (" + (CRON_INTERVAL_MS / 60000) + "dk aralık)");

    // İlk çalıştırma: 30sn sonra (sunucu başlangıcında DB bağlantısı stabilize olsun)
    setTimeout(() => {
        runInvoiceCron().catch(err => {
            logger.error("[INVOICE CRON] İlk çalıştırma hatası: " + err.message);
        });
    }, 30 * 1000);

    // Periyodik çalıştırma
    cronInterval = setInterval(runInvoiceCron, CRON_INTERVAL_MS);
};

const stopInvoiceCron = () => {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
        logger.info("[INVOICE CRON] ⏹ Otomatik faturalama cron'u durduruldu");
    }
};

module.exports = {
    startInvoiceCron,
    stopInvoiceCron,
    runInvoiceCron,
};
