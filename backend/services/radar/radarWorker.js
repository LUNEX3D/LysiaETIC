/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR WORKER — LysiaRadar PRO v2 Arka Plan İşçisi (REVISED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Belirli aralıklarla tüm aktif kullanıcılar için fırsat analizi çalıştırır.
 *
 * Görevler:
 *   1. Her 6 saatte tüm kullanıcılar için fırsat analizi
 *   2. Eski/expire fırsatları temizle
 *   3. Skorları güncelle
 *   4. Google Trends yükselen aramaları topla (YENİ)
 *   5. TrendSignal zaman serisi verilerini temizle (YENİ)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const User = require("../../models/User");
const ProductMapping = require("../../models/ProductMapping");
const OpportunityResult = require("../../models/OpportunityResult");
const TrendSignal = require("../../models/TrendSignal");
const opportunityEngine = require("./opportunityEngine");
const googleTrendsService = require("./googleTrendsService");

// ── Konfigürasyon ──
const RADAR_INTERVAL_MS = 6 * 60 * 60 * 1000;  // 6 saat
const INITIAL_DELAY_MS = 5 * 60 * 1000;         // 5 dakika (sunucu başlangıcında bekle)
const USER_DELAY_MS = 10000;                      // 10s — kullanıcılar arası bekleme
const CLEANUP_DAYS = 7;                           // 7 günden eski expire fırsatları sil
const SIGNAL_CLEANUP_DAYS = 14;                   // 14 günden eski TrendSignal'ları sil

let radarInterval = null;
let isRunning = false;

let workerStats = {
    totalCycles: 0,
    lastCycleAt: null,
    lastDurationMs: 0,
    usersProcessed: 0,
    opportunitiesGenerated: 0,
    trendSignalsCollected: 0,
    isActive: false,
    startedAt: null,
    dataSources: {
        googleTrends: 0,
        socialMedia: 0,
        amazon: 0,
        trendyol: 0,
    },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Aktif kullanıcıları getir (ürünü olan)
 */
async function getRadarUsers() {
    const userIdsWithProducts = await ProductMapping.distinct("userId");
    return userIdsWithProducts;
}

/**
 * Tek bir kullanıcı için radar döngüsü
 */
async function processUser(userId) {
    try {
        const result = await opportunityEngine.analyzeOpportunities(userId, {
            forceRefresh: false,
            maxKeywords: 12,     // Worker'da biraz daha az keyword (kaynak tasarrufu)
        });

        if (result.fromCache) {
            return { skipped: true, reason: "cache_fresh" };
        }

        return {
            success: true,
            opportunities: result.stats?.total || 0,
            durationMs: result.stats?.durationMs || 0,
            dataSources: result.stats?.dataSources || {},
        };
    } catch (err) {
        logger.warn(`[RadarWorker] User ${String(userId).slice(-6)} hatası: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * Google Trends yükselen aramaları topla (YENİ)
 * Tüm kullanıcılar için ortak veri — günde 1 kez yeterli
 */
async function collectGlobalTrends() {
    try {
        logger.info("[RadarWorker] 🌍 Global trend verileri toplanıyor...");

        // Türkiye yükselen aramalar
        const trendingTR = await googleTrendsService.getTrendingSearches("TR");

        // ABD yükselen aramalar (global e-ticaret sinyali)
        const trendingUS = await googleTrendsService.getTrendingSearches("US");

        const allTrending = [...new Set([...trendingTR, ...trendingUS])];

        // TrendSignal olarak kaydet
        let savedCount = 0;
        for (const keyword of allTrending.slice(0, 30)) {
            try {
                await TrendSignal.findOneAndUpdate(
                    { keyword: keyword.toLowerCase(), source: "google_trends" },
                    {
                        $set: {
                            keyword: keyword.toLowerCase(),
                            source: "google_trends",
                            googleTrends: {
                                interestOverTime: 80, // Trending = yüksek ilgi
                                interestChange: 50,
                                isBreakout: true,
                                geo: trendingTR.includes(keyword) ? "TR" : "US",
                            },
                            compositeScore: 75,
                            trendDirection: "rising",
                            confidenceLevel: 60,
                            dataSourceCount: 1,
                            collectedAt: new Date(),
                            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 gün
                        },
                    },
                    { upsert: true }
                );
                savedCount++;
            } catch (e) {
                // Duplicate key veya diğer hatalar — atla
            }
        }

        logger.info(`[RadarWorker] 🌍 ${savedCount} global trend sinyali kaydedildi`);
        return savedCount;
    } catch (err) {
        logger.warn(`[RadarWorker] Global trend toplama hatası: ${err.message}`);
        return 0;
    }
}

/**
 * Ana radar döngüsü — tüm kullanıcılar
 */
async function runRadarCycle() {
    if (isRunning) {
        logger.warn("[RadarWorker] Önceki döngü hâlâ çalışıyor, atlanıyor...");
        return;
    }

    isRunning = true;
    const cycleStart = Date.now();
    let processed = 0;
    let totalOpps = 0;
    let skipped = 0;
    let failed = 0;
    let totalDataSources = { googleTrends: 0, socialMedia: 0, amazon: 0, trendyol: 0 };

    try {
        // ── 0. Global trend verileri topla (her döngüde) ──
        const trendSignals = await collectGlobalTrends();

        // ── 1. Aktif kullanıcıları getir ──
        const userIds = await getRadarUsers();
        if (userIds.length === 0) {
            logger.info("[RadarWorker] Aktif kullanıcı yok, döngü atlanıyor");
            isRunning = false;
            return;
        }

        logger.info(
            `🔭 [RadarWorker] Radar döngüsü #${workerStats.totalCycles + 1} başlıyor — ` +
            `${userIds.length} kullanıcı, ${trendSignals} global trend`
        );

        // ── 2. Her kullanıcı için analiz ──
        for (const userId of userIds) {
            try {
                const result = await processUser(userId);

                if (result.skipped) {
                    skipped++;
                } else if (result.success) {
                    processed++;
                    totalOpps += result.opportunities || 0;

                    // Veri kaynağı istatistikleri
                    if (result.dataSources) {
                        totalDataSources.googleTrends += result.dataSources.googleTrends || 0;
                        totalDataSources.socialMedia += result.dataSources.socialMedia || 0;
                        totalDataSources.amazon += result.dataSources.amazon || 0;
                        totalDataSources.trendyol += result.dataSources.trendyol || 0;
                    }
                } else {
                    failed++;
                }

                // Kullanıcılar arası bekleme
                if (userIds.indexOf(userId) < userIds.length - 1) {
                    await sleep(USER_DELAY_MS);
                }
            } catch (err) {
                failed++;
                logger.error(`[RadarWorker] User ${String(userId).slice(-6)} kritik hata: ${err.message}`);
            }
        }

        // ── 3. Temizlik ──
        await cleanupExpiredOpportunities();
        await cleanupOldTrendSignals();

        // ── 4. İstatistikleri güncelle ──
        const duration = Date.now() - cycleStart;
        workerStats.totalCycles++;
        workerStats.lastCycleAt = new Date();
        workerStats.lastDurationMs = duration;
        workerStats.usersProcessed = processed;
        workerStats.opportunitiesGenerated = totalOpps;
        workerStats.trendSignalsCollected = trendSignals;
        workerStats.dataSources = totalDataSources;

        logger.info(
            `🔭 [RadarWorker] ✅ Radar döngüsü #${workerStats.totalCycles} tamamlandı — ` +
            `${processed} işlendi, ${skipped} atlandı, ${failed} hata, ` +
            `${totalOpps} fırsat — ${(duration / 1000).toFixed(1)}s ` +
            `[G:${totalDataSources.googleTrends} S:${totalDataSources.socialMedia} ` +
            `A:${totalDataSources.amazon} T:${totalDataSources.trendyol}]`
        );
    } catch (err) {
        logger.error(`[RadarWorker] Döngü genel hata: ${err.message}`);
    } finally {
        isRunning = false;
    }
}

/**
 * Eski fırsatları temizle
 */
async function cleanupExpiredOpportunities() {
    try {
        const cutoff = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);
        const result = await OpportunityResult.deleteMany({
            status: { $in: ["expired", "dismissed"] },
            updatedAt: { $lt: cutoff },
        });
        if (result.deletedCount > 0) {
            logger.info(`[RadarWorker] ${result.deletedCount} eski fırsat temizlendi`);
        }
    } catch (err) {
        logger.warn(`[RadarWorker] Fırsat temizlik hatası: ${err.message}`);
    }
}

/**
 * Eski TrendSignal'ları temizle (YENİ)
 */
async function cleanupOldTrendSignals() {
    try {
        const cutoff = new Date(Date.now() - SIGNAL_CLEANUP_DAYS * 24 * 60 * 60 * 1000);
        const result = await TrendSignal.deleteMany({
            collectedAt: { $lt: cutoff },
        });
        if (result.deletedCount > 0) {
            logger.info(`[RadarWorker] ${result.deletedCount} eski trend sinyali temizlendi`);
        }
    } catch (err) {
        logger.warn(`[RadarWorker] TrendSignal temizlik hatası: ${err.message}`);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// START / STOP
// ═════════════════════════════════════════════════════════════════════════════

function startRadarWorker() {
    if (radarInterval) {
        logger.warn("[RadarWorker] Zaten çalışıyor, tekrar başlatma isteği yoksayıldı");
        return;
    }

    workerStats.isActive = true;
    workerStats.startedAt = new Date();

    // İlk çalışma — 5 dakika sonra
    setTimeout(() => {
        logger.info("🔭 [RadarWorker] LysiaRadar PRO v2 fırsat tarama döngüsü başlatıldı");
        runRadarCycle();
    }, INITIAL_DELAY_MS);

    // Periyodik çalışma — her 6 saatte
    radarInterval = setInterval(runRadarCycle, RADAR_INTERVAL_MS);

    logger.info(
        `🔭 [RadarWorker] LysiaRadar PRO v2 Worker başlatıldı — ` +
        `her ${RADAR_INTERVAL_MS / 3600000} saatte bir (ilk çalışma ${INITIAL_DELAY_MS / 1000}s sonra) ` +
        `[Google Trends + Sosyal Medya + Amazon + Trendyol]`
    );
}

function stopRadarWorker() {
    if (radarInterval) {
        clearInterval(radarInterval);
        radarInterval = null;
    }
    workerStats.isActive = false;
    logger.info("🔭 [RadarWorker] LysiaRadar PRO v2 Worker durduruldu");
}

function getRadarWorkerStatus() {
    return { ...workerStats, isRunning };
}

module.exports = {
    startRadarWorker,
    stopRadarWorker,
    getRadarWorkerStatus,
    runRadarCycle,
};
