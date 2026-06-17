/**
 * Eksikleri Dağıt — önizleme, kategori merkezi çözümlemesi, job ile canlı ilerleme
 */
const Marketplace = require("../models/Marketplace");
const ProductMapping = require("../models/ProductMapping");
const logger = require("../config/logger");
const { normalizeMarketplaceName, distributeProductToMarketplaces } = require("./productSyncService");
const { normalizeDistributeCategory } = require("../utils/normalizeDistributeCategory");
const {
    resolveCategoryForDistribute,
    getMissingPlatformsForProduct,
    isMarketplaceMappingListed,
} = require("./categoryCenterResolveService");

const BATCH_SIZE = 2;

const { getJob } = require("../utils/syncProgressStore");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Duraklat / iptal isteklerini kontrol et */
const waitForJobControl = async (jobId) => {
    if (!jobId) return { cancelled: false };
    const j = getJob(jobId);
    if (!j) return { cancelled: false };
    if (j.cancelRequested) return { cancelled: true };
    if (j.pauseRequested) {
        j.status = "paused";
        j.message = "Duraklatıldı — devam etmek için pencereyi açıp «Devam et»e basın";
        while (true) {
            await sleep(800);
            const cur = getJob(jobId);
            if (!cur) return { cancelled: false };
            if (cur.cancelRequested) return { cancelled: true };
            if (!cur.pauseRequested) {
                cur.status = "running";
                return { cancelled: false };
            }
        }
    }
    return { cancelled: false };
};

const collectActiveTargets = async (userId, targetMarketplaces = []) => {
    const activeMarketplaces = await Marketplace.find({ userId }).lean();
    if (!activeMarketplaces.length) {
        return { error: "Aktif pazaryeri entegrasyonu bulunamadı", targets: [], activeMarketplaces: [] };
    }
    const activePlatformNames = activeMarketplaces.map((m) => m.marketplaceName);
    const targets =
        targetMarketplaces.length > 0
            ? targetMarketplaces.filter((t) =>
                  activePlatformNames.some((ap) => ap.toLowerCase() === String(t).toLowerCase())
              )
            : activePlatformNames;
    if (!targets.length) {
        return { error: "Hedef pazaryeri bulunamadı", targets: [], activeMarketplaces };
    }
    return { error: null, targets, activeMarketplaces };
};

/**
 * Ürün × platform eksik listesi (önizleme + job planı)
 * @param {boolean} options.fast — kategori DB sorgusu yok (önizleme / hızlı job planı)
 * @param {boolean} options.summaryOnly — sadece sayılar, items dizisi boş
 * @param {number} options.maxItemsPerPlatform — önizleme örnek listesi üst sınırı (0 = örnek yok)
 */
const buildMissingDistributionPlan = async (userId, options = {}) => {
    const {
        targetMarketplaces = [],
        onlyFullyUndistributed = false,
        onlyInStock = false,
        fast = false,
        summaryOnly = false,
        maxItemsPerPlatform = 50,
    } = options;
    const { error, targets } = await collectActiveTargets(userId, targetMarketplaces);
    if (error) return { error, platforms: [], items: [], stats: {} };

    const allProducts = await ProductMapping.find({ userId }).lean();
    const platformMap = new Map();
    for (const t of targets) {
        platformMap.set(normalizeMarketplaceName(t), {
            platform: t,
            missingCount: 0,
            readyCount: 0,
            noCategoryCount: 0,
            items: [],
        });
    }

    const flatItems = [];
    const sampleCap = summaryOnly ? 0 : Math.max(0, Number(maxItemsPerPlatform) || 0);

    for (const product of allProducts) {
        // Sadece stoklu ürünler isteniyorsa, stoğu 0/negatif olanları atla
        if (onlyInStock) {
            const stockQty = Number(
                product.stockTracking?.totalStock ?? product.masterProduct?.stock ?? 0
            );
            if (!(stockQty > 0)) continue;
        }

        let missingPlatforms = getMissingPlatformsForProduct(product, targets);

        if (onlyFullyUndistributed) {
            const anyListed = (product.marketplaceMappings || []).some((m) =>
                targets.some(
                    (t) =>
                        normalizeMarketplaceName(m.marketplaceName) === normalizeMarketplaceName(t) &&
                        isMarketplaceMappingListed(m, t)
                )
            );
            if (anyListed || missingPlatforms.length === 0) continue;
            missingPlatforms = [...targets];
        }

        if (!missingPlatforms.length) continue;

        for (const platform of missingPlatforms) {
            let hasCategory = false;
            let categoryMessage = null;
            let masterPath = null;
            let platformCategoryPath = null;

            if (!fast) {
                const resolution = await resolveCategoryForDistribute(product, platform);
                hasCategory = !!(resolution.resolved && resolution.platformCategory?.categoryId);
                categoryMessage = hasCategory
                    ? null
                    : resolution.message || "Kategori merkezinde bu platform için kategori ID yok";
                masterPath = resolution.master?.masterPath || null;
                platformCategoryPath = resolution.platformCategory?.categoryPath || null;
            }

            const row = {
                productId: String(product._id),
                name: product.masterProduct?.name || "İsimsiz",
                barcode: product.masterProduct?.barcode || "",
                sku: product.masterProduct?.sku || "",
                platform,
                reason: fast ? "pending" : hasCategory ? "ready" : "no_category",
                categoryMessage,
                masterCategoryHint: product.masterProduct?.category || null,
                masterPath,
                platformCategoryPath,
            };

            const bucket = platformMap.get(normalizeMarketplaceName(platform));
            if (bucket) {
                bucket.missingCount += 1;
                if (!fast) {
                    if (hasCategory) bucket.readyCount += 1;
                    else bucket.noCategoryCount += 1;
                    if (sampleCap > 0 && bucket.items.length < sampleCap) {
                        bucket.items.push(row);
                    }
                } else if (sampleCap > 0 && bucket.items.length < sampleCap) {
                    bucket.items.push(row);
                }
            }
            if (!summaryOnly) {
                flatItems.push(row);
            }
        }
    }

    const platforms = targets.map((t) => platformMap.get(normalizeMarketplaceName(t))).filter(Boolean);
    const totalMissingSlots = summaryOnly
        ? platforms.reduce((n, p) => n + p.missingCount, 0)
        : flatItems.length;

    return {
        error: null,
        targets,
        platforms,
        items: flatItems,
        categoryCheckDeferred: fast,
        stats: {
            totalProducts: allProducts.length,
            totalMissingSlots,
            readyCount: fast ? null : flatItems.filter((i) => i.reason === "ready").length,
            noCategoryCount: fast ? null : flatItems.filter((i) => i.reason === "no_category").length,
            platformCount: platforms.filter((p) => p.missingCount > 0).length,
            categoryCheckDeferred: fast,
        },
    };
};

const distributeOneSlot = async (userId, product, platform, manualCategory = null) => {
    let catNorm = null;
    if (manualCategory?.id) {
        const pathStr = manualCategory.path || manualCategory.name || "";
        const leafName = pathStr.includes(">")
            ? pathStr
                  .split(/\s*>\s*/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .pop()
            : pathStr;
        catNorm = normalizeDistributeCategory({
            id: manualCategory.id,
            path: pathStr,
            name: leafName || manualCategory.name || manualCategory.id,
        });
    } else {
        const resolution = await resolveCategoryForDistribute(product, platform);
        if (!resolution.resolved || !resolution.platformCategory?.categoryId) {
            return {
                status: "no_category",
                message: resolution.message || "Kategori merkezinde eşleşme yok",
                resolution,
            };
        }
        const pc = resolution.platformCategory;
        const pathStr = pc.categoryPath || "";
        const leafName = pathStr.includes(">")
            ? pathStr
                  .split(/\s*>\s*/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .pop()
            : pathStr;
        catNorm = normalizeDistributeCategory({
            id: pc.categoryId,
            path: pathStr,
            name: leafName || pc.categoryId,
        });
    }

    const distResults = await distributeProductToMarketplaces(userId, product._id, [platform], catNorm);
    const hit = distResults.find((r) => r.status === "success" || r.status === "pending");
    const fail = distResults.find((r) => r.status === "error");
    if (hit) {
        return { status: "success", results: distResults };
    }
    return {
        status: fail ? "error" : "skipped",
        message: fail?.message || "Dağıtım başarısız",
        results: distResults,
    };
};

/**
 * Job ile çalıştırılır — sadece reason=ready olanları otomatik dağıtır; no_category pending'e düşer
 */
const runMissingDistributionJob = async (userId, onProgress, options = {}) => {
    const { jobId, ...planOptions } = options;
    const plan = await buildMissingDistributionPlan(userId, {
        ...planOptions,
        fast: true,
        summaryOnly: false,
        maxItemsPerPlatform: 0,
    });
    if (plan.error) throw new Error(plan.error);

    const toProcess = plan.items;
    const pendingItems = [];

    const platformStats = plan.platforms.map((p) => ({
        platform: p.platform,
        missingCount: p.missingCount,
        readyCount: 0,
        noCategoryCount: 0,
        success: 0,
        error: 0,
        skipped: 0,
        processing: false,
        done: false,
    }));

    const total = toProcess.length;
    let processed = 0;
    let success = 0;
    let error = 0;

    const bumpPlatform = (platform, field) => {
        const ps = platformStats.find(
            (x) => normalizeMarketplaceName(x.platform) === normalizeMarketplaceName(platform)
        );
        if (ps) ps[field] = (ps[field] || 0) + 1;
    };

    onProgress({
        phase: "distributing",
        progressPercent: total ? 0 : 100,
        current: 0,
        total,
        message: total ? "Dağıtım başlıyor…" : "Dağıtılacak hazır ürün yok",
        platformStats,
        pendingCount: pendingItems.length,
    });

    if (total === 0) {
        return {
            platformStats,
            pendingItems,
            summary: { total: 0, success: 0, error: 0, noCategory: pendingItems.length, skipped: 0 },
        };
    }

    const productCache = new Map();
    const loadProduct = async (id) => {
        if (productCache.has(id)) return productCache.get(id);
        const doc = await ProductMapping.findOne({ _id: id, userId }).lean();
        productCache.set(id, doc);
        return doc;
    };

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const ctrl = await waitForJobControl(jobId);
        if (ctrl.cancelled) {
            return {
                cancelled: true,
                platformStats,
                pendingItems,
                summary: {
                    total,
                    success,
                    error,
                    noCategory: pendingItems.filter((p) => p.reason === "no_category").length,
                    skipped: 0,
                    processed,
                },
            };
        }

        const batch = toProcess.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(async (slot) => {
                const ps = platformStats.find(
                    (x) => normalizeMarketplaceName(x.platform) === normalizeMarketplaceName(slot.platform)
                );
                if (ps) ps.processing = true;

                onProgress({
                    phase: "distributing",
                    progressPercent: Math.min(99, Math.round((processed / total) * 100)),
                    current: processed,
                    total,
                    message: `${slot.platform}: ${slot.name}`,
                    platformStats,
                    pendingCount: pendingItems.length,
                });

                try {
                    const product = await loadProduct(slot.productId);
                    if (!product) {
                        error++;
                        bumpPlatform(slot.platform, "error");
                        pendingItems.push({
                            productId: slot.productId,
                            name: slot.name,
                            platform: slot.platform,
                            reason: "error",
                            message: "Ürün bulunamadı",
                        });
                        return;
                    }
                    const out = await distributeOneSlot(userId, product, slot.platform);
                    if (out.status === "success") {
                        success++;
                        bumpPlatform(slot.platform, "success");
                    } else if (out.status === "no_category") {
                        bumpPlatform(slot.platform, "skipped");
                        pendingItems.push({
                            productId: slot.productId,
                            name: slot.name,
                            barcode: slot.barcode,
                            sku: slot.sku,
                            platform: slot.platform,
                            reason: "no_category",
                            message: out.message,
                            masterCategoryHint: slot.masterCategoryHint,
                        });
                    } else {
                        error++;
                        bumpPlatform(slot.platform, "error");
                        pendingItems.push({
                            productId: slot.productId,
                            name: slot.name,
                            barcode: slot.barcode,
                            sku: slot.sku,
                            platform: slot.platform,
                            reason: "error",
                            message: out.message || "Dağıtım hatası",
                        });
                    }
                } catch (err) {
                    error++;
                    bumpPlatform(slot.platform, "error");
                    pendingItems.push({
                        productId: slot.productId,
                        name: slot.name,
                        platform: slot.platform,
                        reason: "error",
                        message: err.message,
                    });
                } finally {
                    if (ps) {
                        ps.processing = false;
                        const handled = (ps.success || 0) + (ps.error || 0) + (ps.skipped || 0);
                        ps.done = handled >= (ps.missingCount || 0);
                    }
                    processed++;
                }
            })
        );

        onProgress({
            phase: "distributing",
            progressPercent: Math.min(99, Math.round((processed / total) * 100)),
            current: processed,
            total,
            message: `İşlenen: ${processed}/${total}`,
            platformStats,
            pendingCount: pendingItems.length,
        });
    }

    for (const ps of platformStats) {
        ps.done = true;
        ps.processing = false;
    }

    return {
        platformStats,
        pendingItems,
        summary: {
            total,
            success,
            error,
            noCategory: pendingItems.filter((p) => p.reason === "no_category").length,
            skipped: 0,
        },
    };
};

module.exports = {
    buildMissingDistributionPlan,
    runMissingDistributionJob,
    distributeOneSlot,
    collectActiveTargets,
};
