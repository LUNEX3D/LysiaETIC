/**
 * Ürün kimlik koruyucu — tüm kullanıcılar için otomatik onarım
 *
 * - marketplaceBarcode / marketplaceSku her zaman master ile hizalanır (pre-save + bu servis)
 * - Sunucu açılışında ve stok cron'da periyodik tarama
 */

const ProductMapping = require("../models/ProductMapping");
const logger = require("../config/logger");
const { alignAllMarketplaceIdentitiesFromMaster } = require("../utils/productFieldCompare");

const BATCH_SIZE = Math.max(50, parseInt(process.env.IDENTITY_REPAIR_BATCH_SIZE || "200", 10) || 200);
const STARTUP_MAX_BATCHES = Math.max(1, parseInt(process.env.IDENTITY_REPAIR_STARTUP_MAX_BATCHES || "50", 10) || 50);
const STARTUP_DELAY_MS = Math.max(0, parseInt(process.env.IDENTITY_REPAIR_STARTUP_DELAY_MS || "30000", 10) || 30000);

let _repairCursor = null;
let _startupRepairRunning = false;

/**
 * Tek kayıt — kimlik sapması varsa düzeltir
 * @returns {Promise<{ fixed: number, saved: boolean }>}
 */
const repairProductMappingDocument = async (doc) => {
    if (!doc?.masterProduct) return { fixed: 0, saved: false };
    const { fixed } = alignAllMarketplaceIdentitiesFromMaster(doc);
    if (fixed <= 0) return { fixed: 0, saved: false };
    await doc.save();
    return { fixed, saved: true };
};

/**
 * Kullanıcı veya global — bir parti kayıt tarar (round-robin _id)
 */
const runIdentityRepairBatch = async (options = {}) => {
    const { userId, limit = BATCH_SIZE } = options;
    const query = userId ? { userId } : {};
    if (_repairCursor) {
        query._id = { $gt: _repairCursor };
    }

    const docs = await ProductMapping.find(query)
        .sort({ _id: 1 })
        .limit(limit)
        .exec();

    if (!docs.length) {
        _repairCursor = null;
        return { scanned: 0, repaired: 0, wrapped: true };
    }

    let repaired = 0;
    for (const doc of docs) {
        const r = await repairProductMappingDocument(doc);
        if (r.saved) repaired += 1;
    }

    _repairCursor = docs[docs.length - 1]._id;
    const wrapped = docs.length < limit;

    if (wrapped) {
        _repairCursor = null;
    }

    if (repaired > 0) {
        logger.info(
            `[IDENTITY GUARD] Parti tamamlandı — taranan: ${docs.length}, düzeltilen: ${repaired}` +
                (userId ? ` (user: ${userId})` : "")
        );
    }

    return { scanned: docs.length, repaired, wrapped };
};

/**
 * Sunucu açılışında arka planda tüm DB'yi kademeli tarar
 */
const startBackgroundIdentityRepair = () => {
    if (process.env.IDENTITY_REPAIR_ON_STARTUP === "false") {
        logger.info("[IDENTITY GUARD] Startup onarımı devre dışı (IDENTITY_REPAIR_ON_STARTUP=false)");
        return;
    }
    if (_startupRepairRunning) return;
    _startupRepairRunning = true;

    setTimeout(async () => {
        let totalRepaired = 0;
        try {
            for (let i = 0; i < STARTUP_MAX_BATCHES; i++) {
                const batch = await runIdentityRepairBatch();
                totalRepaired += batch.repaired;
                if (batch.wrapped) break;
                await new Promise((r) => setTimeout(r, 400));
            }
            if (totalRepaired > 0) {
                logger.info(`[IDENTITY GUARD] Startup onarımı bitti — toplam düzeltilen kayıt: ${totalRepaired}`);
            }
        } catch (err) {
            logger.warn(`[IDENTITY GUARD] Startup onarım hatası: ${err.message}`);
        } finally {
            _startupRepairRunning = false;
        }
    }, STARTUP_DELAY_MS);
};

module.exports = {
    repairProductMappingDocument,
    runIdentityRepairBatch,
    startBackgroundIdentityRepair
};
