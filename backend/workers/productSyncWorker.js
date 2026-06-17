/**
 * Ürün senkron BullMQ worker — ayrı süreçte çalıştırın: npm run worker:sync
 *
 * Gereksinim: MONGO_URI, REDIS_URL, SYNC_USE_BULLMQ=true
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const connectDB = require("../config/db");
const logger = require("../config/logger");
const {
    isBullEnabled,
    getBullConnection,
    createProductSyncWorker,
    QUEUE_NAME
} = require("../services/syncBullQueue");
const {
    syncProductsFromMarketplace,
    normalizeMarketplaceName
} = require("../services/productSyncService");
const { autoStockSync } = require("../services/stockSyncService");
const Marketplace = require("../models/Marketplace");
const { runMissingDistributionJob } = require("../services/missingDistributionService");

if (!isBullEnabled() || !getBullConnection()) {
    logger.error("[SyncWorker] REDIS_URL ve SYNC_USE_BULLMQ=true gerekli.");
    process.exit(1);
}

async function main() {
    await connectDB();
    logger.info(`[SyncWorker] ${QUEUE_NAME} dinleniyor...`);

    const worker = createProductSyncWorker(async (job) => {
        const { userId, type, meta } = job.data || {};
        if (!userId || !type) {
            throw new Error("Geçersiz iş verisi (userId / type)");
        }

        if (type === "marketplace_pull") {
            const { marketplaceId, marketplaceName } = meta || {};
            const stats = await syncProductsFromMarketplace(userId, marketplaceId, marketplaceName, async (evt) => {
                await job.updateProgress({
                    phase: evt.phase,
                    progressPercent: evt.progressPercent,
                    current: evt.current,
                    total: evt.total,
                    message: evt.message
                });
            });
            return { stats };
        }

        if (type === "marketplace_pull_all") {
            const marketplaces = await Marketplace.find({ userId }).lean();
            const n = marketplaces.length;
            const results = [];
            for (let idx = 0; idx < n; idx++) {
                const mp = marketplaces[idx];
                const mpName = normalizeMarketplaceName(mp.marketplaceName);
                const base = (idx / n) * 100;
                const span = n > 0 ? 100 / n : 100;
                try {
                    const stats = await syncProductsFromMarketplace(
                        userId,
                        mp._id.toString(),
                        mp.marketplaceName,
                        async (evt) => {
                            const local = (evt.progressPercent || 0) / 100;
                            await job.updateProgress({
                                progressPercent: Math.min(99.9, base + local * span),
                                phase: evt.phase,
                                current: evt.current,
                                total: evt.total,
                                message: `[${idx + 1}/${n}] ${mpName}: ${evt.message || ""}`.trim()
                            });
                        }
                    );
                    results.push({ marketplace: mpName, success: true, stats });
                } catch (err) {
                    results.push({ marketplace: mpName, success: false, error: err.message });
                }
            }
            const totalNew = results.reduce((s, r) => s + (r.stats?.new || 0), 0);
            const totalUpdated = results.reduce((s, r) => s + (r.stats?.updated || 0), 0);
            const totalErrors = results.filter((r) => !r.success).length;
            return {
                results,
                summary: {
                    totalNew,
                    totalUpdated,
                    totalErrors,
                    marketplaceCount: n
                }
            };
        }

        if (type === "auto_stock_sync") {
            const results = await autoStockSync(userId, async (evt) => {
                await job.updateProgress({
                    phase: evt.phase,
                    progressPercent: evt.progressPercent,
                    current: evt.current,
                    total: evt.total,
                    message: evt.message
                });
            });
            return { results };
        }

        if (type === "missing_distribution") {
            const options = (meta && meta.options) || {};
            return runMissingDistributionJob(userId, async (evt) => {
                await job.updateProgress({
                    phase: evt.phase,
                    progressPercent: evt.progressPercent,
                    current: evt.current,
                    total: evt.total,
                    message: evt.message,
                    platformStats: evt.platformStats,
                    pendingCount: evt.pendingCount
                });
            }, options);
        }

        throw new Error(`Bilinmeyen iş tipi: ${type}`);
    });

    if (!worker) {
        logger.error("[SyncWorker] Worker oluşturulamadı.");
        process.exit(1);
    }

    worker.on("completed", (j) => logger.info(`[SyncWorker] Tamamlandı: ${j.id}`));
    worker.on("failed", (j, err) => logger.error(`[SyncWorker] Hata: ${j?.id} — ${err.message}`));
}

main().catch((e) => {
    logger.error(`[SyncWorker] ${e.message}`);
    process.exit(1);
});
