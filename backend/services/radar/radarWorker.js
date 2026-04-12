/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RADAR WORKER — LysiaRadar PRO Arka Plan İşçisi
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Belirli aralıklarla tüm aktif kullanıcılar için fırsat analizi çalıştırır.
 *
 * Görevler:
 *   1. Her 6 saatte tüm kullanıcılar için fırsat analizi
 *   2. Eski/expire fırsatları temizle
 *   3. Skorları güncelle
 *
 * Entegrasyon:
 *   aiBackgroundWorker.js içinden çağrılır veya bağımsız çalışır.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const User = require("../../models/User");
const ProductMapping = require("../../models/ProductMapping");
const OpportunityResult = require("../../models/OpportunityResult");
const opportunityEngine = require("./opportunityEngine");

// ── Konfigürasyon ──
const RADAR_INTERVAL_MS = 6 * 60 * 60 * 1000;  // 6 saat
const INITIAL_DELAY_MS = 5 * 60 * 1000;         // 5 dakika (sunucu başlangıcında bekle)
const USER_DELAY_MS = 10000;                      // 10s — kullanıcılar arası bekleme
const CLEANUP_DAYS = 7;                           // 7 günden eski expire fırsatları sil

let radarInterval = null;
let isRunning = false;

let workerStats = {
    totalCycles: 0,
    lastCycleAt: null,
    lastDurationMs: 0,
    usersProcessed: 0,
    opportunitiesGenerated: 0,
    isActive: false,
    startedAt: null,
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
            forceRefresh: false, // Cache varsa kullan
            maxKeywords: 10,     // Worker'da daha az keyword (kaynak tasarrufu)
        });

        if (result.fromCache) {
            return { skipped: true, reason: "cache_fresh" };
        }

        return {
            success: true,
            opportunities: result.stats?.total || 0,
            durationMs: result.stats?.durationMs || 0,
        };
    } catch (err) {
        logger.warn(`[RadarWorker] User ${String(userId).slice(-6)} hatası: ${err.message}`);
        return { success: false, error: err.message };
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

    try {
        const userIds = await getRadarUsers();
        if (userIds.length === 0) {
            logger.info("[RadarWorker] Aktif kullanıcı yok, döngü atlanıyor");
            isRunning = false;
            return;
        }

        logger.info(`🔭 [RadarWorker] Radar döngüsü #${workerStats.totalCycles + 1} başlıyor — ${userIds.length} kullanıcı`);

        for (const userId of userIds) {
            try {
                const result = await processUser(userId);

                if (result.skipped) {
                    skipped++;
                } else if (result.success) {
                    processed++;
                    totalOpps += result.opportunities || 0;
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

        // Eski fırsatları temizle
        await cleanupExpiredOpportunities();

        const duration = Date.now() - cycleStart;
        workerStats.totalCycles++;
        workerStats.lastCycleAt = new Date();
        workerStats.lastDurationMs = duration;
        workerStats.usersProcessed = processed;
        workerStats.opportunitiesGenerated = totalOpps;

        logger.info(
            `🔭 [RadarWorker] ✅ Radar döngüsü #${workerStats.totalCycles} tamamlandı — ` +
            `${processed} işlendi, ${skipped} atlandı, ${failed} hata, ` +
            `${totalOpps} fırsat — ${(duration / 1000).toFixed(1)}s`
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
        logger.warn(`[RadarWorker] Temizlik hatası: ${err.message}`);
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
        logger.info("🔭 [RadarWorker] LysiaRadar PRO fırsat tarama döngüsü başlatıldı");
        runRadarCycle();
    }, INITIAL_DELAY_MS);

    // Periyodik çalışma — her 6 saatte
    radarInterval = setInterval(runRadarCycle, RADAR_INTERVAL_MS);

    logger.info(
        `🔭 [RadarWorker] LysiaRadar PRO Worker başlatıldı — ` +
        `her ${RADAR_INTERVAL_MS / 3600000} saatte bir (ilk çalışma ${INITIAL_DELAY_MS / 1000}s sonra)`
    );
}

function stopRadarWorker() {
    if (radarInterval) {
        clearInterval(radarInterval);
        radarInterval = null;
    }
    workerStats.isActive = false;
    logger.info("🔭 [RadarWorker] LysiaRadar PRO Worker durduruldu");
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
