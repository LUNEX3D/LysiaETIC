/**
 * ÜRÜN YÖNETİM CONTROLLER
 *
 * Ürün yükleme, eşitleme, dağıtım, stok senkronizasyonu ve Excel import/export
 */

const ProductMapping = require("../models/ProductMapping");
const StockSyncLog = require("../models/StockSyncLog");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const {
    syncProductsFromMarketplace,
    importSingleProductFromMarketplace,
    distributeProductToMarketplaces,
    checkPendingN11Tasks,
    checkPendingHepsiburadaUploads,
    checkPendingTrendyolBatches,
    deleteProductFromMarketplaces,
    fetchTrendyolCategoryAttributes,
    fetchTrendyolBrands,
    normalizeMarketplaceName
} = require("../services/productSyncService");
const { decryptCredentials } = require("../utils/encryption");
const { manualStockSync, autoStockSync, syncStockToAllMarketplaces } = require("../services/stockSyncService");
const n11Service = require("../services/n11Service");
const xlsx = require("xlsx");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const duplicateGuard = require("../utils/productDuplicateGuard");
const VariantGroup = require("../models/VariantGroup");
const {
    extractPlatformSnapshotFromMp,
    applyPlatformValueToMaster,
    applyFieldDriftToMarketplaceMapping,
    refreshAllFieldDriftsForMapping,
    alignMarketplaceIdentityFromMaster,
    alignPlatformSnapshotFromMaster,
    resolveTrendyolListingBarcode,
    isMarketplaceMappingVisibleForProductUi,
    FIELD_DEFS
} = require("../utils/productFieldCompare");
const { normalizeDistributeCategory } = require("../utils/normalizeDistributeCategory");
const {
    resolveCategoryForDistribute,
    getMissingPlatformsForProduct,
    isMarketplaceMappingListed,
} = require("../services/categoryCenterResolveService");
const {
    isHepsiburadaMappingListedForUi,
    isHepsiburadaMappingVisibleForProductUi,
    loadHepsiburadaListableCategoryIdSet,
    normalizeCredentials: normalizeHbCredentials,
    validateCredentials: validateHbCredentials,
    getEndpoints: getHbEndpoints,
    HB_SIT_ENDPOINTS
} = require("../services/hepsiburadaService");
const { buildProductCategoryFieldOverview } = require("../services/categoryFieldOverviewService");

const normMpLabel = (name) => {
    if (!name) return "";
    const n = String(name).trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return String(name).trim();
};

/** Aynı barkod/SKU ile başka kayıtta olan platform eşlemeleri (birleştirme ipucu) */
async function findSiblingPlatformHints(userId, productDoc) {
    const bc = productDoc.masterProduct?.barcode;
    const sk = productDoc.masterProduct?.sku;
    if (!bc && !sk) return [];

    const or = [];
    if (bc) {
        or.push({ "masterProduct.barcode": bc });
        or.push({ "marketplaceMappings.marketplaceBarcode": bc });
    }
    if (sk) {
        or.push({ "masterProduct.sku": sk });
        or.push({ "marketplaceMappings.marketplaceSku": sk });
    }
    if (or.length === 0) return [];

    const currentPlatforms = new Set(
        (productDoc.marketplaceMappings || []).map((m) => normMpLabel(m.marketplaceName)).filter(Boolean)
    );

    const siblings = await ProductMapping.find({
        userId,
        _id: { $ne: productDoc._id },
        $or: or
    })
        .select("masterProduct.name masterProduct.barcode masterProduct.sku marketplaceMappings")
        .lean();

    const hints = [];
    const seen = new Set();
    for (const sib of siblings) {
        for (const mp of sib.marketplaceMappings || []) {
            const pl = normMpLabel(mp.marketplaceName);
            if (!pl || currentPlatforms.has(pl)) continue;
            const key = `${pl}|${sib._id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            hints.push({
                marketplaceName: pl,
                syncStatus: mp.syncStatus || null,
                siblingProductId: String(sib._id),
                siblingName: sib.masterProduct?.name || "",
                siblingBarcode: sib.masterProduct?.barcode || "",
                siblingSku: sib.masterProduct?.sku || "",
                reason: "Aynı barkod/SKU ile başka ürün kaydında bu platform eşlemesi var."
            });
        }
    }
    return hints;
}
const {
    scheduleMarketplacePull,
    scheduleAutoStockSync,
    scheduleSyncAllMarketplaces,
    scheduleMissingDistribution,
    getJobForStatus,
    assertJobForUser,
    pauseSyncJob: pauseSyncJobRunner,
    resumeSyncJob: resumeSyncJobRunner,
    cancelSyncJob: cancelSyncJobRunner,
} = require("../utils/syncJobRunner");
const {
    buildMissingDistributionPlan,
    distributeOneSlot,
    collectActiveTargets,
} = require("../services/missingDistributionService");

// Multer — memory storage (dosyayı diske yazmadan RAM'de tut)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv"
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error("Sadece .xlsx, .xls veya .csv dosyaları kabul edilir"), false);
        }
    }
});
exports.uploadMiddleware = upload.single("file");

const productImageUploadDir = path.join(__dirname, "..", "uploads", "product-images");
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            fs.mkdirSync(productImageUploadDir, { recursive: true });
            cb(null, productImageUploadDir);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".mp4"].includes(ext)
            ? ext
            : file?.mimetype === "video/mp4"
              ? ".mp4"
              : ".jpg";
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    }
});
const imageUpload = multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok =
            file?.mimetype?.startsWith("image/") ||
            file?.mimetype === "video/mp4" ||
            file?.mimetype === "image/heic";
        if (ok) return cb(null, true);
        return cb(new Error("Sadece gorsel (.jpg, .png, .webp, .heic) veya .mp4 kabul edilir"), false);
    }
});
exports.imageUploadMiddleware = imageUpload.single("image");

exports.uploadProductImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Dosya bulunamadi" });
        }
        const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
        const fileUrl = `${baseUrl}/uploads/product-images/${req.file.filename}`;
        const isVideo = req.file.mimetype === "video/mp4" || req.file.filename.endsWith(".mp4");
        return res.status(200).json({
            success: true,
            url: fileUrl,
            filename: req.file.filename,
            kind: isVideo ? "video" : "image",
        });
    } catch (error) {
        logger.error("[PRODUCT IMAGE UPLOAD] Hata:", error.message);
        return res.status(500).json({ error: "Dosya yuklenemedi", details: error.message });
    }
};

const productImageAiService = require("../services/productImageAiService");

exports.productImageAiEdit = async (req, res) => {
    try {
        const { imageUrl, action, maskBase64 } = req.body || {};
        if (!imageUrl) return res.status(400).json({ error: "Görsel URL gerekli" });
        const allowed = new Set(["remove_bg", "upscale", "remove_object"]);
        if (!allowed.has(action)) return res.status(400).json({ error: "Geçersiz işlem" });

        const result = await productImageAiService.processImageEdit(req, {
            imageUrl,
            action,
            maskBase64,
        });
        if (result.error) return res.status(400).json({ error: result.error });
        return res.json({ success: true, ...result });
    } catch (error) {
        logger.error("[PRODUCT IMAGE AI]", error.message);
        return res.status(500).json({ error: "Görsel işlenemedi", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📦 ÜRÜN YÜKLEME
// ═══════════════════════════════════════════════════════════════

/**
 * Yeni ürün oluştur (Master Product)
 */
exports.createProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const {
            name, barcode, sku, description, images,
            price, listPrice, stock, category, brand,
            attributes, marketplaceMappings
        } = req.body;

        // Zorunlu alan kontrolü
        if (!name || !barcode || !sku || !price) {
            return res.status(400).json({
                error: "Zorunlu alanlar eksik",
                required: ["name", "barcode", "sku", "price"]
            });
        }

        // 🛡️ Duplike kontrolü (Barkod + SKU + İsim)
        const duplicateCheck = await duplicateGuard.checkDuplicates(userId, { barcode, sku, name });
        if (!duplicateCheck.isValid) {
            return res.status(409).json({
                error: duplicateCheck.message,
                type: duplicateCheck.type,
                conflicts: duplicateCheck.conflicts
            });
        }

        // Ürün oluştur
        const productMapping = new ProductMapping({
            userId,
            masterProduct: {
                name,
                barcode,
                sku,
                description: description || "",
                images: images || [],
                price,
                listPrice: listPrice || price,
                stock: stock || 0,
                category: category || "",
                brand: brand || "",
                attributes: attributes || {}
            },
            marketplaceMappings: marketplaceMappings || [],
            stockTracking: {
                totalStock: stock || 0,
                availableStock: stock || 0,
                lowStockThreshold: 10
            }
        });

        productMapping.updateStockStatus();
        await productMapping.save();

        // Log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "product_created",
            product: {
                productMappingId: productMapping._id,
                barcode,
                sku,
                name
            },
            status: "success",
            notification: { priority: "low" }
        });

        logger.info(`[PRODUCT] Yeni ürün oluşturuldu: ${name} (${barcode})`);

        return res.status(201).json({
            success: true,
            message: "Ürün başarıyla oluşturuldu",
            product: productMapping
        });

    } catch (error) {
        logger.error("[PRODUCT CREATE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün oluşturulamadı", details: error.message });
    }
};

/**
 * userId'yi güvenli şekilde ObjectId'ye çevir
 */
const toObjectId = (id) => {
    const mongoose = require("mongoose");
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

/** @param {object|null} job */
const jobEtaSeconds = (job) => {
    if (!job || job.status !== "running") return null;
    const p = Number(job.progressPercent) || 0;
    if (p < 3 || p >= 100) return null;
    const elapsed = (Date.now() - job.startedAt) / 1000;
    if (elapsed < 0.5) return null;
    const totalEst = elapsed / (p / 100);
    return Math.max(0, Math.round(totalEst - elapsed));
};

/**
 * Tüm ürünleri listele
 */
exports.getProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, limit = 20, search, category, marketplace, stockStatus, mpFilter, mpFilterStatus, ungroupedOnly } = req.query;
        const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
        const safePage = Math.max(0, parseInt(page, 10) || 0);

        const filter = { userId };

        if (ungroupedOnly === "1" || ungroupedOnly === "true") {
            filter.variantGroupId = null;
        }

        // Arama filtresi
        if (search) {
            // SEC: Kullanıcı girdisini escape et — ReDoS koruması
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { "masterProduct.name": { $regex: escapedSearch, $options: "i" } },
                { "masterProduct.barcode": { $regex: escapedSearch, $options: "i" } },
                { "masterProduct.sku": { $regex: escapedSearch, $options: "i" } },
                { "marketplaceMappings.marketplaceBarcode": { $regex: escapedSearch, $options: "i" } },
                { "marketplaceMappings.marketplaceSku": { $regex: escapedSearch, $options: "i" } },
                { "masterProduct.attributes.model": { $regex: escapedSearch, $options: "i" } },
                { "masterProduct.attributes.productMainId": { $regex: escapedSearch, $options: "i" } }
            ];
        }

        // Kategori filtresi
        if (category) {
            // SEC: Kullanıcı girdisini escape et — ReDoS koruması
            const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter["masterProduct.category"] = { $regex: escapedCategory, $options: "i" };
        }

        // Pazaryeri filtresi (case-insensitive — DB'de "n11" veya "N11" olabilir)
        if (marketplace) {
            const normalizedMP = normalizeMarketplaceName(marketplace);
            filter["marketplaceMappings.marketplaceName"] = new RegExp(`^${normalizedMP}$`, "i");
        }

        // Gelişmiş Pazaryeri Filtreleme (mpFilter: "Trendyol", mpFilterStatus: "not_listed")
        if (mpFilter) {
            const normalizedMP = normalizeMarketplaceName(mpFilter);
            if (mpFilterStatus === "listed") {
                filter.marketplaceMappings = {
                    $elemMatch: {
                        marketplaceName: new RegExp(`^${normalizedMP}$`, "i"),
                        syncStatus: { $ne: "error" }
                    }
                };
            } else if (mpFilterStatus === "not_listed") {
                filter.marketplaceMappings = {
                    $not: {
                        $elemMatch: {
                            marketplaceName: new RegExp(`^${normalizedMP}$`, "i"),
                            syncStatus: { $ne: "error" }
                        }
                    }
                };
            }
        }

        // Stok durumu filtresi
        if (stockStatus === "outOfStock") {
            filter["stockTracking.isOutOfStock"] = true;
        } else if (stockStatus === "lowStock") {
            filter["stockTracking.isLowStock"] = true;
        } else if (stockStatus === "inStock") {
            filter["stockTracking.totalStock"] = { $gt: 0 };
        }

        const total = await ProductMapping.countDocuments(filter);
        const products = await ProductMapping.find(filter)
            .sort({ updatedAt: -1 })
            .skip(safePage * safeLimit)
            .limit(safeLimit)
            .lean();

        // ── PLATFORM DOĞRULAMA ──
        // ⚠️ ESKİ (YANLIŞ): Cross-reference ile başka DB kayıtlarının platform mapping'leri
        //   bu ürüne enjekte ediliyordu → 1 platformda olan ürün 2 platformda görünüyordu
        //   Örn: Ürün A (Trendyol, barcode X) + Ürün B (N11, barcode X) → Ürün A'ya N11 badge ekleniyor
        // ✅ YENİ (DOĞRU): Cross-reference KALDIRILDI. Her ürün SADECE kendi marketplaceMappings'ini gösterir.
        //   Bir ürün bir platformda varsa, o platformun mapping'i doğrudan o ürünün kaydında olmalıdır.
        //   Hepsiburada: MPOP "İncelenecek" (listingReady=false / pending) panelde görünür — mapping'i gizleme.
        for (const p of products) {
            if (p.marketplaceMappings && p.marketplaceMappings.length > 0) {
                p.marketplaceMappings = p.marketplaceMappings.filter(
                    (m) => m && isMarketplaceMappingVisibleForProductUi(m)
                );
            }
        }

        const groupIds = [...new Set(products.map((p) => p.variantGroupId).filter(Boolean).map(String))];
        if (groupIds.length > 0) {
            const VariantGroup = require("../models/VariantGroup");
            const groupOids = groupIds.map((id) => toObjectId(id)).filter(Boolean);
            const groups = await VariantGroup.find({
                userId,
                _id: { $in: groupOids }
            }).select("name trendyolProductMainId").lean();
            const groupMap = Object.fromEntries(groups.map((g) => [String(g._id), g]));
            for (const p of products) {
                if (p.variantGroupId) {
                    const g = groupMap[String(p.variantGroupId)];
                    if (g) {
                        p.variantGroup = {
                            _id: g._id,
                            name: g.name,
                            trendyolProductMainId: g.trendyolProductMainId || ""
                        };
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            total,
            page: safePage,
            limit: safeLimit,
            totalPages: Math.ceil(total / safeLimit) || 0,
            products
        });

    } catch (error) {
        logger.error("[PRODUCT LIST] Hata:", error.message);
        return res.status(500).json({ error: "Ürünler alınamadı", details: error.message });
    }
};



/**
 * Tek ürün detayı
 */
exports.getProductDetail = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;

        const productDoc = await ProductMapping.findOne({ _id: productId, userId }).lean();
        if (!productDoc) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        let categoryFieldOverview = [];
        try {
            categoryFieldOverview = await buildProductCategoryFieldOverview(userId, productDoc);
        } catch (ovErr) {
            logger.warn(`[PRODUCT DETAIL] Kategori özeti atlandı: ${ovErr.message}`);
        }

        // ── PLATFORM DOĞRULAMA ──
        // ⚠️ ESKİ (YANLIŞ): Cross-reference ile başka DB kayıtlarının platform mapping'leri
        //   bu ürüne enjekte ediliyordu → 1 platformda olan ürün 2 platformda görünüyordu
        // ✅ YENİ (DOĞRU): Cross-reference KALDIRILDI. Her ürün SADECE kendi marketplaceMappings'ini gösterir.
        let visibleMappings = productDoc.marketplaceMappings || [];
        if (visibleMappings.length > 0) {
            visibleMappings = visibleMappings.filter((m) => m && isMarketplaceMappingVisibleForProductUi(m));
        }

        const fieldAuditSummary = {
            hasAnyDrift: false,
            hasCritical: false,
            platforms: []
        };
        for (const mp of visibleMappings) {
            const fd = mp.fieldDrift;
            if (fd?.hasDrift) {
                fieldAuditSummary.hasAnyDrift = true;
                if (fd.hasCritical) fieldAuditSummary.hasCritical = true;
                fieldAuditSummary.platforms.push({
                    marketplaceName: mp.marketplaceName,
                    hasCritical: !!fd.hasCritical,
                    driftCount: (fd.drifts || []).length,
                    drifts: fd.drifts || [],
                    lastCheckedAt: fd.lastCheckedAt
                });
            }
        }

        const product = {
            ...productDoc,
            marketplaceMappings: visibleMappings,
            categoryFieldOverview,
            fieldAuditSummary,
            fieldAuditFields: FIELD_DEFS.map((f) => ({ key: f.key, label: f.label, severity: f.severity })),
            siblingPlatformHints: await findSiblingPlatformHints(userId, productDoc)
        };

        const activePlatforms = (product.marketplaceMappings || []).map(m => m.marketplaceName).filter(Boolean);
        logger.info(`[PRODUCT DETAIL] "${product.masterProduct?.name}" → platforms: [${activePlatforms.join(", ")}]`);

        return res.status(200).json({ success: true, product });

    } catch (error) {
        logger.error("[PRODUCT DETAIL] Hata:", error.message);
        return res.status(500).json({ error: "Ürün detayı alınamadı", details: error.message });
    }
};

/**
 * Ürün güncelle
 */
exports.updateProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;
        const updates = req.body;

        const product = await ProductMapping.findOne({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        // Master product alanlarını güncelle
        if (updates.name) product.masterProduct.name = updates.name;
        if (updates.barcode) product.masterProduct.barcode = String(updates.barcode).trim();
        if (updates.sku) product.masterProduct.sku = String(updates.sku).trim();
        if (updates.description) product.masterProduct.description = updates.description;
        if (updates.images) product.masterProduct.images = updates.images;
        if (updates.price) product.masterProduct.price = updates.price;
        if (updates.listPrice) product.masterProduct.listPrice = updates.listPrice;
        if (updates.category) product.masterProduct.category = updates.category;
        if (updates.brand) product.masterProduct.brand = updates.brand;
        if (updates.attributes) product.masterProduct.attributes = { ...product.masterProduct.attributes, ...updates.attributes };

        // 🛡️ Güvenlik stoğu güncelleme
        if (updates.safetyStock !== undefined) {
            product.stockTracking.safetyStock = Math.max(0, Number(updates.safetyStock));
        }

        // Stok güncelleme
        let syncResults = [];
        if (updates.stock !== undefined) {
            const oldStock = product.stockTracking.totalStock;
            const newStock = Number(updates.stock);
            product.masterProduct.stock = newStock;
            product.stockTracking.totalStock = newStock;
            product.updateStockStatus();

            // 🛡️ Güvenlik stoğu düşülmüş stoku hesapla
            const marketplaceStock = product.getMarketplaceStock();

            // ✅ Fiyat güncelleme varsa hazırla
            const priceUpdate = (updates.price || updates.listPrice)
                ? {
                    salePrice: updates.price ? parseFloat(updates.price) : undefined,
                    listPrice: updates.listPrice ? parseFloat(updates.listPrice) : undefined
                  }
                : null;

            // ✅ Tüm pazaryerlerinde stoku senkronize et (güvenlik stoğu düşülmüş)
            try {
                syncResults = await syncStockToAllMarketplaces(userId, product, marketplaceStock, null, priceUpdate);
                logger.info(`[PRODUCT UPDATE] Stok senkronize edildi — ${product.masterProduct.name}: ${oldStock} → ${newStock} | platformlara: ${marketplaceStock} (güvenlik: ${product.stockTracking.safetyStock || 0})`);
            } catch (syncError) {
                logger.error(`[PRODUCT UPDATE] Stok senkronizasyon hatası: ${syncError.message}`);
            }

            // Log oluştur
            await StockSyncLog.create({
                userId,
                actionType: "stock_update",
                product: {
                    productMappingId: product._id,
                    barcode: product.masterProduct.barcode,
                    sku: product.masterProduct.sku,
                    name: product.masterProduct.name
                },
                changes: {
                    field: "stock",
                    oldValue: oldStock,
                    newValue: newStock,
                    difference: newStock - oldStock
                },
                status: "success",
                affectedMarketplaces: syncResults,
                notification: {
                    priority: newStock === 0 ? "critical" : newStock <= product.stockTracking.lowStockThreshold ? "high" : "low"
                }
            });
        } else if (updates.safetyStock !== undefined) {
            // Sadece güvenlik stoğu değiştiyse de platformlara push et
            const marketplaceStock = product.getMarketplaceStock();
            try {
                syncResults = await syncStockToAllMarketplaces(userId, product, marketplaceStock);
                logger.info(`[PRODUCT UPDATE] Güvenlik stoğu güncellendi — ${product.masterProduct.name} | platformlara: ${marketplaceStock} (güvenlik: ${product.stockTracking.safetyStock})`);
            } catch (syncError) {
                logger.error(`[PRODUCT UPDATE] Güvenlik stoğu sync hatası: ${syncError.message}`);
            }
        }

        const identityTouched =
            updates.name ||
            updates.barcode ||
            updates.sku ||
            updates.brand ||
            updates.category ||
            updates.attributes ||
            updates.price;
        if (identityTouched) {
            refreshAllFieldDriftsForMapping(product);
        }

        await product.save();

        const mpSuccess = syncResults.filter(m => m.syncStatus === "success").length;
        const mpError   = syncResults.filter(m => m.syncStatus === "error").length;
        const marketplaceStock = product.getMarketplaceStock();

        return res.status(200).json({
            success: true,
            message: `Ürün güncellendi${syncResults.length > 0 ? `. ${mpSuccess} pazaryerinde senkronize edildi${mpError > 0 ? `, ${mpError} hata` : ""}` : ""}`,
            product,
            marketplaceStock,
            safetyStock: product.stockTracking.safetyStock || 0,
            marketplaces: syncResults
        });

    } catch (error) {
        logger.error("[PRODUCT UPDATE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün güncellenemedi", details: error.message });
    }
};

/**
 * Pazaryeri bazlı satış / liste fiyatını yalnızca veritabanında güncelle (API'ye push yok)
 * PATCH /product-management/products/:productId/channel-prices
 * Body: { channels: [ { marketplaceName: "Trendyol", price: 99.9, listPrice: 119 } ] }
 */
exports.updateChannelPricesLocal = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;
        const { channels } = req.body || {};
        if (!Array.isArray(channels) || channels.length === 0) {
            return res.status(400).json({ error: "channels dizisi gerekli" });
        }

        const doc = await ProductMapping.findOne({ _id: productId, userId });
        if (!doc) return res.status(404).json({ error: "Ürün bulunamadı" });

        const results = [];
        for (const ch of channels) {
            const rawName = ch.marketplaceName || ch.platform;
            const canon = normalizeMarketplaceName(rawName);
            if (!canon) {
                results.push({ marketplace: rawName, status: "error", message: "Geçersiz platform" });
                continue;
            }

            const sale = ch.price != null && ch.price !== "" ? parseFloat(ch.price) : null;
            const listRaw = ch.listPrice != null && ch.listPrice !== "" ? parseFloat(ch.listPrice) : null;

            if (sale != null && (Number.isNaN(sale) || sale <= 0)) {
                return res.status(400).json({ error: `${canon} için geçersiz satış fiyatı` });
            }
            if (listRaw != null && (Number.isNaN(listRaw) || listRaw <= 0)) {
                return res.status(400).json({ error: `${canon} için geçersiz liste fiyatı` });
            }

            const mpMapping = doc.marketplaceMappings.find(
                (m) => normalizeMarketplaceName(m.marketplaceName) === canon
            );
            if (!mpMapping) {
                results.push({ marketplace: canon, status: "skipped", message: "Bu platformda listeleme yok" });
                continue;
            }

            const listPrice = listRaw != null ? listRaw : (sale != null ? sale : null);
            if (sale != null) mpMapping.price = sale;
            if (listPrice != null) mpMapping.listPrice = listPrice;
            if (sale != null && listRaw == null) mpMapping.listPrice = sale;

            results.push({ marketplace: canon, status: "ok" });
        }

        await doc.save();
        return res.status(200).json({
            success: true,
            message: "Pazaryeri fiyatları güncellendi",
            results,
            product: doc
        });
    } catch (error) {
        logger.error("[CHANNEL PRICES LOCAL] Hata:", error.message);
        return res.status(500).json({ error: "Fiyatlar güncellenemedi", details: error.message });
    }
};

/**
 * Ürün sil (pazaryerlerinden de zorunlu kaldırır)
 *
 * DELETE /product-management/products/:productId
 * Query params:
 *   deleteFromMarketplaces=false — sadece yerel kaydı sil (default: true — her yerden siler)
 *   platforms=Trendyol,N11       — sadece belirli platformlardan kaldır (virgülle ayrılmış)
 */
exports.deleteProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;
        // Default: true — ürün silinince pazaryerlerinden de kaldırılır
        const deleteFromMarketplaces = req.query.deleteFromMarketplaces !== "false";
        const platforms = req.query.platforms ? req.query.platforms.split(",").map(p => p.trim()).filter(Boolean) : [];

        // Ürünü bul (silmeden önce marketplace bilgilerine ihtiyacımız var)
        const product = await ProductMapping.findOne({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        const productName = product.masterProduct?.name || "İsimsiz";
        let marketplaceResults = [];

        // Pazaryerlerinden kaldır
        if (deleteFromMarketplaces && product.marketplaceMappings?.length > 0) {
            logger.info(`[PRODUCT DELETE] "${productName}" — pazaryerlerinden kaldırılıyor (${platforms.length > 0 ? platforms.join(", ") : "tümü"})...`);
            marketplaceResults = await deleteProductFromMarketplaces(userId, product, platforms);
            logger.info(`[PRODUCT DELETE] "${productName}" — pazaryeri sonuçları: ${JSON.stringify(marketplaceResults)}`);
        }

        // Yerel kaydı sil
        await ProductMapping.findOneAndDelete({ _id: productId, userId });

        // Log oluştur (hata olursa silme işlemini engellemesin)
        try {
            await StockSyncLog.create({
                userId,
                actionType: "product_deleted",
                product: {
                    productMappingId: product._id,
                    barcode: product.masterProduct?.barcode,
                    sku: product.masterProduct?.sku,
                    name: productName
                },
                changes: {
                    field: "delete",
                    oldValue: 1,
                    newValue: 0
                },
                status: "success",
                affectedMarketplaces: marketplaceResults.map(r => ({
                    name: r.name,
                    syncStatus: r.status === "success" ? "success" : r.status === "skipped" ? "skipped" : "error",
                    syncedAt: r.status === "success" ? new Date() : undefined,
                    error: r.status === "error" ? r.message : undefined
                })),
                notification: { priority: "high" }
            });
        } catch (logErr) {
            logger.warn(`[PRODUCT DELETE] Log kaydı oluşturulamadı: ${logErr.message}`);
        }

        const mpSuccessCount = marketplaceResults.filter(r => r.status === "success").length;
        const mpErrorCount = marketplaceResults.filter(r => r.status === "error").length;
        logger.info(`[PRODUCT DELETE] ✅ "${productName}" silindi${marketplaceResults.length > 0 ? ` | Pazaryeri: ${mpSuccessCount} başarılı, ${mpErrorCount} hata` : " (sadece yerel)"}`);

        return res.status(200).json({
            success: true,
            message: marketplaceResults.length > 0
                ? `Ürün silindi ve ${mpSuccessCount} pazaryerinden kaldırıldı${mpErrorCount > 0 ? ` (${mpErrorCount} hata)` : ""}`
                : "Ürün silindi",
            marketplaceResults
        });

    } catch (error) {
        logger.error("[PRODUCT DELETE] Hata:", error.message || error);
        logger.error("[PRODUCT DELETE] Stack:", error.stack);
        return res.status(500).json({ error: "Ürün silinemedi", details: error.message || String(error) });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 ÜRÜN EŞİTLEME & DAĞITIM
// ═══════════════════════════════════════════════════════════════

/**
 * GET /product-management/sync/job/:jobId — uzun senkron işinin durumu (ilerleme + tahmini kalan süre)
 */
exports.getSyncJobStatus = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { jobId } = req.params;
        const job = await getJobForStatus(jobId);
        if (!job || !assertJobForUser(job, userId)) {
            return res.status(404).json({ error: "İş bulunamadı" });
        }

        const etaSeconds = jobEtaSeconds(job);

        return res.status(200).json({
            success: true,
            job: {
                id: job.id,
                type: job.type,
                status: job.status,
                phase: job.phase,
                progressPercent: Math.round(Number(job.progressPercent) * 10) / 10,
                current: job.current,
                total: job.total,
                message: job.message,
                startedAt: job.startedAt,
                updatedAt: job.updatedAt,
                etaSeconds,
                ...(job.status === "completed" ? { result: job.result } : {}),
                ...(job.status === "cancelled" ? { result: job.result } : {}),
                ...(job.status === "failed" ? { error: job.error } : {}),
                ...(job.platformStats ? { platformStats: job.platformStats } : {}),
                ...(job.pendingCount != null ? { pendingCount: job.pendingCount } : {})
            }
        });
    } catch (error) {
        logger.error("[SYNC JOB STATUS] Hata:", error.message);
        return res.status(500).json({ error: "Durum alınamadı", details: error.message });
    }
};

/** POST /product-management/sync/job/:jobId/pause */
exports.pauseSyncJob = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });
        const result = await pauseSyncJobRunner(req.params.jobId, userId);
        if (!result.ok) return res.status(400).json({ error: result.error });
        return res.status(200).json({ success: true, message: "İş duraklatılıyor…" });
    } catch (error) {
        logger.error("[SYNC JOB PAUSE] Hata:", error.message);
        return res.status(500).json({ error: "Duraklatılamadı", details: error.message });
    }
};

/** POST /product-management/sync/job/:jobId/resume */
exports.resumeSyncJob = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });
        const result = await resumeSyncJobRunner(req.params.jobId, userId);
        if (!result.ok) return res.status(400).json({ error: result.error });
        return res.status(200).json({ success: true, message: "İş devam ediyor…" });
    } catch (error) {
        logger.error("[SYNC JOB RESUME] Hata:", error.message);
        return res.status(500).json({ error: "Devam ettirilemedi", details: error.message });
    }
};

/** POST /product-management/sync/job/:jobId/cancel */
exports.cancelSyncJob = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });
        const result = await cancelSyncJobRunner(req.params.jobId, userId);
        if (!result.ok) return res.status(400).json({ error: result.error });
        return res.status(200).json({ success: true, message: "İptal isteği gönderildi" });
    } catch (error) {
        logger.error("[SYNC JOB CANCEL] Hata:", error.message);
        return res.status(500).json({ error: "İptal edilemedi", details: error.message });
    }
};

/**
 * Pazaryerinden ürünleri çek ve eşleştir
 * Trendyol'dan tek ürün içe aktar (barkod veya stok kodu) — listede görünmeyen ürünler için
 */
exports.importMarketplaceProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceName = "Trendyol", barcode, sku } = req.body || {};
        const result = await importSingleProductFromMarketplace(userId, marketplaceName, { barcode, sku });

        return res.status(200).json({
            success: true,
            message:
                result.action === "created"
                    ? "Ürün Trendyol'dan içe aktarıldı"
                    : "Ürün güncellendi ve barkod hizalandı",
            ...result
        });
    } catch (error) {
        logger.error("[IMPORT MARKETPLACE PRODUCT]", error.message);
        return res.status(400).json({
            error: error.message || "İçe aktarım başarısız"
        });
    }
};

exports.syncFromMarketplace = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceId, marketplaceName } = req.body;
        const asyncMode = req.body.async === true || req.body.async === "true";

        if (!marketplaceId || !marketplaceName) {
            return res.status(400).json({ error: "Pazaryeri bilgisi eksik" });
        }

        logger.info(`[SYNC] ${marketplaceName} senkronizasyonu başlatılıyor...`);

        if (asyncMode) {
            const jobId = await scheduleMarketplacePull(userId, marketplaceId, marketplaceName);
            return res.status(202).json({
                success: true,
                async: true,
                jobId,
                message: `${marketplaceName} senkronizasyonu arka planda başlatıldı`
            });
        }

        const stats = await syncProductsFromMarketplace(userId, marketplaceId, marketplaceName);

        return res.status(200).json({
            success: true,
            message: `${marketplaceName} senkronizasyonu tamamlandı`,
            stats
        });

    } catch (error) {
        logger.error("[SYNC FROM MARKETPLACE] Hata:", error.message);

        // Kullanıcı dostu hata mesajı
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || "Senkronizasyon başarısız";

        return res.status(statusCode).json({
            error: errorMessage,
            details: process.env.NODE_ENV === "development" ? error.originalError?.message : undefined
        });
    }
};

/**
 * Ürünü seçili pazaryerlerine dağıt
 */
exports.distributeProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productMappingId, targetMarketplaces, category, categoryData } = req.body;
        const normalizedCategory =
            normalizeDistributeCategory(category) ||
            normalizeDistributeCategory(categoryData);

        if (!productMappingId || !targetMarketplaces || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Ürün ID ve hedef pazaryerleri gerekli" });
        }

        const hbTarget = (targetMarketplaces || []).some((t) => /hepsiburada/i.test(String(t || "")));
        const hbCategoryId = normalizedCategory?.id ? String(normalizedCategory.id).trim() : "";
        if (hbTarget && hbCategoryId) {
            try {
                const hbMp = await Marketplace.findOne({
                    userId,
                    marketplaceName: { $regex: /^hepsiburada$/i }
                }).lean();
                if (hbMp) {
                    const hbCreds = normalizeHbCredentials(decryptCredentials(hbMp.credentials));
                    const hbVal = validateHbCredentials(hbCreds, "kategori doğrulama");
                    if (hbVal.valid && typeof loadHepsiburadaListableCategoryIdSet === "function") {
                        const useSit = getHbEndpoints(hbCreds).MPOP === HB_SIT_ENDPOINTS.MPOP;
                        const listableIds = await loadHepsiburadaListableCategoryIdSet(
                            hbCreds.merchantId,
                            hbCreds.secretKey,
                            hbCreds.userAgent,
                            useSit
                        );
                        if (listableIds instanceof Set && listableIds.size > 0 && !listableIds.has(hbCategoryId)) {
                            return res.status(400).json({
                                error: "Hepsiburada kategori geçersiz",
                                details:
                                    `Kategori ID ${hbCategoryId} ürün listelemeye uygun değil (kampanya reyonu veya kapalı kategori). ` +
                                    "Kategori aramasında yaprak (listelenebilir) bir katalog kategorisi seçin."
                            });
                        }
                    }
                }
            } catch (hbPreErr) {
                logger.warn(`[DISTRIBUTE] HB kategori ön kontrolü atlandı: ${hbPreErr?.message || hbPreErr}`);
            }
        }

        const mappingOid = toObjectId(productMappingId);
        if (!mappingOid) {
            return res.status(400).json({ error: "Geçersiz ürün ID", details: String(productMappingId || "") });
        }

        const results = await distributeProductToMarketplaces(userId, mappingOid, targetMarketplaces, normalizedCategory);

        return res.status(200).json({
            success: true,
            message: "Dağıtım tamamlandı",
            results
        });

    } catch (error) {
        const errMsg =
            error?.message ||
            (typeof error === "string" ? error : "") ||
            error?.toString?.() ||
            "Bilinmeyen dağıtım hatası";
        logger.error(`[DISTRIBUTE] Hata: ${errMsg}`);
        if (error?.stack) {
            logger.error(`[DISTRIBUTE] Stack: ${error.stack}`);
        }
        return res.status(500).json({ error: "Dağıtım başarısız", details: errMsg });
    }
};

/**
 * Toplu ürün dağıtımı - Bir pazaryerindeki tüm ürünleri diğerlerine dağıt
 */
exports.bulkDistribute = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { sourceMarketplace, targetMarketplaces } = req.body;

        if (!sourceMarketplace || !targetMarketplaces || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Kaynak ve hedef pazaryerleri gerekli" });
        }

        const normSource = normalizeMarketplaceName(sourceMarketplace);
        logger.info(`[BULK DISTRIBUTE] ${normSource} -> ${targetMarketplaces.join(", ")}`);

        // Kaynak pazaryerindeki ürünleri bul (isim büyük/küçük harf toleranslı)
        const products = await ProductMapping.find({
            userId,
            marketplaceMappings: {
                $elemMatch: {
                    marketplaceName: new RegExp(`^${normSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
                }
            }
        });

        const results = {
            total: products.length,
            distributed: 0,
            skipped: 0,
            errors: 0,
            details: []
        };

        // ⚡ Paralel dağıtım — 3'erli batch ile (API rate limit koruması)
        const BATCH_SIZE = 3;
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (product) => {
                try {
                    // Her hedef pazaryeri için kontrol et
                    const missingMarketplaces = targetMarketplaces.filter((target) => {
                        const normT = normalizeMarketplaceName(target);
                        const m = (product.marketplaceMappings || []).find(
                            (x) => normalizeMarketplaceName(x.marketplaceName) === normT
                        );
                        if (!m) return true;
                        if (m.syncStatus === "error") return true;
                        if (m.syncStatus === "pending") return false;
                        return !m.marketplaceProductId;
                    });

                    if (missingMarketplaces.length === 0) {
                        return {
                            barcode: product.masterProduct.barcode,
                            name: product.masterProduct.name,
                            status: "skipped",
                            message: "Tüm hedef pazaryerlerinde mevcut",
                            _skipped: true
                        };
                    }

                    // Eksik pazaryerlerine dağıt
                    const distResults = await distributeProductToMarketplaces(
                        userId,
                        product._id,
                        missingMarketplaces
                    );

                    const okish = distResults.filter(
                        (r) => r.status === "success" || r.status === "pending" || r.status === "skipped"
                    ).length;
                    return {
                        barcode: product.masterProduct.barcode,
                        name: product.masterProduct.name,
                        status: okish > 0 ? "success" : "error",
                        marketplaces: distResults,
                        _distributed: okish > 0,
                        _hasError: distResults.some((r) => r.status === "error")
                    };

                } catch (error) {
                    return {
                        barcode: product.masterProduct.barcode,
                        name: product.masterProduct.name,
                        status: "error",
                        message: error.message,
                        _hasError: true
                    };
                }
            }));

            for (const br of batchResults) {
                if (br._skipped)     results.skipped++;
                if (br._distributed) results.distributed++;
                if (br._hasError)    results.errors++;
                // Temizle — iç flagleri response'a gönderme
                const { _skipped, _distributed, _hasError, ...detail } = br;
                results.details.push(detail);
            }
        }

        // Toplu log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: {
                barcode: "BULK",
                name: `Toplu dağıtım: ${sourceMarketplace} -> ${targetMarketplaces.join(", ")}`
            },
            changes: {
                field: "distribution",
                oldValue: sourceMarketplace,
                newValue: targetMarketplaces
            },
            status: results.errors > 0 ? "partial" : "success",
            notification: {
                priority: "high"
            }
        });

        return res.status(200).json({
            success: true,
            message: "Toplu dağıtım tamamlandı",
            results
        });

    } catch (error) {
        logger.error("[BULK DISTRIBUTE] Hata:", error.message);
        return res.status(500).json({ error: "Toplu dağıtım başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 STOK SENKRONİZASYON
// ═══════════════════════════════════════════════════════════════

/**
 * Manuel stok senkronizasyonu (fiyat güncelleme opsiyonel)
 */
exports.syncStock = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productMappingId, newStock, salePrice, listPrice } = req.body;

        if (!productMappingId || newStock === undefined) {
            return res.status(400).json({ error: "Ürün ID ve yeni stok miktarı gerekli" });
        }
        if (newStock < 0) {
            return res.status(400).json({ error: "Stok miktarı 0 veya üzeri olmalıdır" });
        }

        // Fiyat güncelleme varsa hazırla
        const priceUpdate = (salePrice !== undefined || listPrice !== undefined)
            ? {
                salePrice: salePrice !== undefined ? parseFloat(salePrice) : undefined,
                listPrice: listPrice !== undefined ? parseFloat(listPrice) : undefined
              }
            : null;

        const result = await manualStockSync(userId, productMappingId, Number(newStock), priceUpdate);

        const mpSuccess = (result.marketplaces || []).filter(m => m.syncStatus === "success").length;
        const mpError   = (result.marketplaces || []).filter(m => m.syncStatus === "error").length;

        return res.status(200).json({
            success: true,
            message: `Stok ${newStock} olarak güncellendi${priceUpdate?.salePrice ? `, fiyat ${priceUpdate.salePrice} TL olarak güncellendi` : ""}. ${mpSuccess} pazaryerinde senkronize edildi${mpError > 0 ? `, ${mpError} hata` : ""}.`,
            result
        });

    } catch (error) {
        logger.error("[STOCK SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Stok senkronizasyonu başarısız", details: error.message });
    }
};

/**
 * Fiyat senkronizasyonu — tüm veya belirli pazaryerine fiyat güncelle
 * targetMarketplace gönderilirse sadece o platforma, gönderilmezse tümüne push eder
 */
exports.syncPrice = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productMappingId, salePrice, listPrice, targetMarketplace } = req.body;

        if (!productMappingId) {
            return res.status(400).json({ error: "Ürün ID gerekli" });
        }
        if (!salePrice || parseFloat(salePrice) <= 0) {
            return res.status(400).json({ error: "Geçerli bir satış fiyatı girin" });
        }

        const mapping = await ProductMapping.findOne({ _id: productMappingId, userId });
        if (!mapping) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        const oldPrice     = mapping.masterProduct.price;
        const oldListPrice = mapping.masterProduct.listPrice;
        const newSalePrice = parseFloat(salePrice);
        const newListPrice = listPrice ? parseFloat(listPrice) : newSalePrice;

        const priceUpdate = { salePrice: newSalePrice, listPrice: newListPrice };

        // ✅ targetMarketplace varsa: sadece o platformun fiyatını güncelle (master product'ı değiştirme)
        if (targetMarketplace) {
            const mpName = normalizeMarketplaceName(targetMarketplace);
            const mpMapping = mapping.marketplaceMappings.find(
                m => normalizeMarketplaceName(m.marketplaceName) === mpName
            );

            if (!mpMapping) {
                return res.status(404).json({ error: `${targetMarketplace} eşleştirmesi bulunamadı` });
            }

            // Pazaryeri entegrasyonunu al
            const marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(`^${mpName}$`, "i") }
            });

            if (!marketplace) {
                return res.status(404).json({ error: `${mpName} entegrasyonu bulunamadı` });
            }

            // Doğru productId belirle
            let productIdForMP;
            switch (mpName) {
                case "Trendyol": {
                    const masterBc = String(mapping.masterProduct?.barcode || "").trim();
                    const mpBc = String(mpMapping.marketplaceBarcode || "").trim();
                    if (masterBc && mpBc && masterBc !== mpBc) {
                        alignMarketplaceIdentityFromMaster(mpMapping, mapping.masterProduct);
                    }
                    productIdForMP = resolveTrendyolListingBarcode(mapping.masterProduct, mpMapping) || mapping.masterProduct.sku;
                    break;
                }
                case "N11":
                    productIdForMP = mpMapping.marketplaceSku || mpMapping.marketplaceBarcode || mapping.masterProduct.sku || mapping.masterProduct.barcode;
                    break;
                case "Hepsiburada":
                    productIdForMP = mpMapping.marketplaceSku || mpMapping.marketplaceProductId || mapping.masterProduct.sku || mapping.masterProduct.barcode;
                    break;
                default:
                    productIdForMP = mpMapping.marketplaceSku || mpMapping.marketplaceProductId || mapping.masterProduct.barcode || mapping.masterProduct.sku;
            }

            const { updateStockOnMarketplace } = require("../services/stockSyncService");
            const marketplaceStock = mapping.getMarketplaceStock();
            const updateResult = await updateStockOnMarketplace(marketplace, productIdForMP, marketplaceStock, priceUpdate);

            if (updateResult.success) {
                mpMapping.price = newSalePrice;
                mpMapping.listPrice = newListPrice;
                mpMapping.lastSyncDate = new Date();
                mpMapping.syncStatus = "synced";
            }

            await mapping.save();

            return res.status(200).json({
                success: true,
                message: `${mpName} fiyatı ${newSalePrice} TL olarak güncellendi.`,
                targetMarketplace: mpName,
                oldPrice: mpMapping.price || oldPrice,
                newPrice: newSalePrice,
                syncStatus: updateResult.success ? "success" : "error",
                error: updateResult.error || null
            });
        }

        // ✅ targetMarketplace yoksa: master product + tüm platformlara push (eski davranış)
        // Master product fiyatını güncelle
        mapping.masterProduct.price = newSalePrice;
        mapping.masterProduct.listPrice = newListPrice;

        // 🛡️ Güvenlik stoğu düşülmüş stoku hesapla
        const marketplaceStock = mapping.getMarketplaceStock();

        // Tüm pazaryerlerinde fiyat + stok senkronize et
        const syncResults = await syncStockToAllMarketplaces(userId, mapping, marketplaceStock, null, priceUpdate);

        // Fiyat log oluştur
        if (newSalePrice !== oldPrice) {
            await StockSyncLog.create({
                userId,
                actionType: "price_update",
                product: {
                    productMappingId: mapping._id,
                    barcode: mapping.masterProduct.barcode,
                    sku: mapping.masterProduct.sku,
                    name: mapping.masterProduct.name
                },
                changes: {
                    field: "price",
                    oldValue: oldPrice,
                    newValue: newSalePrice,
                    difference: newSalePrice - oldPrice
                },
                status: "success",
                affectedMarketplaces: syncResults,
                notification: { priority: "low" }
            });
        }

        await mapping.save();

        return res.status(200).json({
            success: true,
            message: `Fiyat ${newSalePrice} TL olarak güncellendi. ${(syncResults || []).filter(m => m.syncStatus === "success").length} pazaryerinde senkronize edildi.`,
            oldPrice,
            newPrice: newSalePrice,
            oldListPrice,
            newListPrice,
            marketplaces: syncResults
        });

    } catch (error) {
        logger.error("[PRICE SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Fiyat senkronizasyonu başarısız", details: error.message });
    }
};

/**
 * Otomatik stok senkronizasyonu tetikle
 */
exports.triggerAutoSync = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const asyncMode = req.body.async === true || req.body.async === "true";

        if (asyncMode) {
            const jobId = await scheduleAutoStockSync(userId);
            return res.status(202).json({
                success: true,
                async: true,
                jobId,
                message: "Otomatik stok senkronu arka planda başlatıldı"
            });
        }

        const results = await autoStockSync(userId);

        return res.status(200).json({
            success: true,
            message: "Otomatik senkronizasyon tamamlandı",
            results
        });

    } catch (error) {
        logger.error("[AUTO SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Otomatik senkronizasyon başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📢 BİLDİRİM & LOG SİSTEMİ
// ═══════════════════════════════════════════════════════════════

/** Stok ile ilgili log tipleri */
const STOCK_RELATED_ACTIONS = [
    "stock_update",
    "order_placed",
    "auto_sync",
    "manual_sync",
    "webhook_order",
    "bulk_update",
];

const ACTION_TYPE_LABELS = {
    stock_update: "Stok güncelleme",
    price_update: "Fiyat güncelleme",
    product_created: "Yeni ürün",
    product_pending: "Ürün kuyrukta",
    product_deleted: "Ürün silindi",
    product_synced: "Pazaryerinden çekildi",
    product_field_drift: "Katalog alan farkı",
    order_placed: "Sipariş (stok düşüşü)",
    auto_sync: "Otomatik stok push",
    manual_sync: "Manuel stok push",
    webhook_order: "Webhook sipariş",
    bulk_update: "Toplu güncelleme",
    bulk_delete: "Toplu silme",
};

const SOURCE_LABELS = {
    order: "Sipariş",
    manual: "Manuel (panel)",
    cron: "Arka plan (cron)",
    bulk: "Toplu işlem",
    webhook: "Webhook",
    sync: "Senkronizasyon",
    catalog: "Katalog denetimi",
    system: "Sistem",
};

function inferLogSource(log) {
    if (log.order?.orderId || log.order?.orderNumber) return "order";
    if (log.actionType === "manual_sync") return "manual";
    if (log.actionType === "auto_sync") return "cron";
    if (log.actionType === "bulk_update" || log.actionType === "bulk_delete") return "bulk";
    if (log.actionType === "webhook_order") return "webhook";
    if (log.actionType === "product_synced") return "sync";
    if (log.actionType === "product_field_drift") return "catalog";
    return "system";
}

function formatSyncLogForClient(log) {
    const oldV = log.changes?.oldValue;
    const newV = log.changes?.newValue;
    const stockDelta =
        log.changes?.field === "stock" && oldV != null && newV != null
            ? Number(newV) - Number(oldV)
            : log.changes?.difference != null
                ? Number(log.changes.difference)
                : null;

    const source = inferLogSource(log);
    const mpErrors = (log.affectedMarketplaces || []).filter(m => m.syncStatus === "error");

    return {
        ...log,
        actionLabel: ACTION_TYPE_LABELS[log.actionType] || log.actionType,
        source,
        sourceLabel: SOURCE_LABELS[source] || SOURCE_LABELS.system,
        stockDelta,
        isStockEvent:
            log.changes?.field === "stock" ||
            STOCK_RELATED_ACTIONS.includes(log.actionType),
        isZeroStock: log.changes?.field === "stock" && Number(newV) === 0,
        isStockIncrease: stockDelta != null && stockDelta > 0,
        isStockDecrease: stockDelta != null && stockDelta < 0,
        marketplaceSummary: (log.affectedMarketplaces || [])
            .map(m => `${m.name}:${m.syncStatus || "?"}`)
            .join(", "),
        hasMarketplaceErrors: mpErrors.length > 0,
        marketplaceErrors: mpErrors.map(m => ({ name: m.name, error: m.error || "" })),
    };
}

/**
 * Senkronizasyon loglarını getir (+ stok defteri özeti)
 * Query: page, limit, actionType, status, priority, hours (24), stockOnly, search, barcode
 */
exports.getSyncLogs = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const {
            page = 0,
            limit = 50,
            actionType,
            status,
            priority,
            hours,
            stockOnly,
            search,
            barcode,
            source,
        } = req.query;

        const filter = { userId };

        const hoursNum = hours != null && hours !== "" ? Number(hours) : null;
        if (hoursNum && hoursNum > 0) {
            filter.timestamp = { $gte: new Date(Date.now() - hoursNum * 60 * 60 * 1000) };
        }

        if (actionType) filter.actionType = actionType;
        if (status) filter.status = status;
        if (priority) filter["notification.priority"] = priority;

        if (barcode && String(barcode).trim()) {
            filter["product.barcode"] = String(barcode).trim();
        }

        if (search && String(search).trim()) {
            const q = String(search).trim();
            const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [
                { "product.barcode": regex },
                { "product.sku": regex },
                { "product.name": regex },
            ];
        }

        const stockOnlyOn =
            stockOnly === "1" ||
            stockOnly === "true" ||
            stockOnly === true;

        if (stockOnlyOn) {
            const stockClause = {
                $or: [
                    { "changes.field": "stock" },
                    { actionType: { $in: STOCK_RELATED_ACTIONS } },
                ],
            };
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, stockClause];
                delete filter.$or;
            } else {
                Object.assign(filter, stockClause);
            }
        }

        if (source && String(source).trim()) {
            const src = String(source).trim().toLowerCase();
            let sourceClause = null;
            if (src === "order") {
                sourceClause = {
                    $or: [
                        { actionType: "order_placed" },
                        { actionType: "webhook_order" },
                        { "order.orderId": { $exists: true, $ne: "" } },
                    ],
                };
            } else if (src === "manual") {
                filter.actionType = "manual_sync";
            } else if (src === "cron") {
                filter.actionType = "auto_sync";
            } else if (src === "bulk") {
                filter.actionType = "bulk_update";
            } else if (src === "catalog") {
                filter.actionType = "product_field_drift";
            }
            if (sourceClause) {
                if (filter.$and) {
                    filter.$and.push(sourceClause);
                } else if (filter.$or) {
                    filter.$and = [{ $or: filter.$or }, sourceClause];
                    delete filter.$or;
                } else {
                    Object.assign(filter, sourceClause);
                }
            }
        }

        const [total, logsRaw, summaryAgg] = await Promise.all([
            StockSyncLog.countDocuments(filter),
            StockSyncLog.find(filter)
                .sort({ timestamp: -1 })
                .skip(Number(page) * Number(limit))
                .limit(Math.min(Number(limit) || 50, 200))
                .lean(),
            StockSyncLog.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalEvents: { $sum: 1 },
                        uniqueBarcodes: { $addToSet: "$product.barcode" },
                        wentToZero: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$changes.field", "stock"] },
                                            { $eq: ["$changes.newValue", 0] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        increased: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$changes.field", "stock"] },
                                            { $gt: [{ $subtract: [{ $toDouble: "$changes.newValue" }, { $toDouble: "$changes.oldValue" }] }, 0] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        decreased: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$changes.field", "stock"] },
                                            { $lt: [{ $subtract: [{ $toDouble: "$changes.newValue" }, { $toDouble: "$changes.oldValue" }] }, 0] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        orderRelated: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [
                                            "$actionType",
                                            ["order_placed", "webhook_order"],
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        errors: {
                            $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
                        },
                        byAction: { $push: "$actionType" },
                    },
                },
            ]),
        ]);

        const logs = logsRaw.map(formatSyncLogForClient);

        const agg = summaryAgg[0] || {};
        const byActionType = {};
        (agg.byAction || []).forEach((t) => {
            byActionType[t] = (byActionType[t] || 0) + 1;
        });

        const summary = {
            windowHours: hoursNum || null,
            totalEvents: agg.totalEvents || 0,
            uniqueProducts: (agg.uniqueBarcodes || []).filter(Boolean).length,
            wentToZero: agg.wentToZero || 0,
            stockIncreased: agg.increased || 0,
            stockDecreased: agg.decreased || 0,
            orderRelated: agg.orderRelated || 0,
            errors: agg.errors || 0,
            byActionType: Object.entries(byActionType).map(([type, count]) => ({
                type,
                label: ACTION_TYPE_LABELS[type] || type,
                count,
            })).sort((a, b) => b.count - a.count),
        };

        return res.status(200).json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            logs,
            summary,
            filters: {
                hours: hoursNum,
                stockOnly: stockOnlyOn,
                search: search || "",
                barcode: barcode || "",
                actionType: actionType || "",
                source: source || "",
            },
        });

    } catch (error) {
        logger.error("[SYNC LOGS] Hata:", error.message);
        return res.status(500).json({ error: "Loglar alınamadı", details: error.message });
    }
};

/**
 * Okunmamış bildirimleri getir
 */
exports.getUnreadNotifications = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const notifications = await StockSyncLog.find({
            userId,
            "notification.read": false
        })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        const counts = {
            total: notifications.length,
            critical: notifications.filter(n => n.notification.priority === "critical").length,
            high: notifications.filter(n => n.notification.priority === "high").length,
            medium: notifications.filter(n => n.notification.priority === "medium").length,
            low: notifications.filter(n => n.notification.priority === "low").length
        };

        return res.status(200).json({
            success: true,
            counts,
            notifications
        });

    } catch (error) {
        logger.error("[NOTIFICATIONS] Hata:", error.message);
        return res.status(500).json({ error: "Bildirimler alınamadı", details: error.message });
    }
};

/**
 * Bildirimi okundu olarak işaretle
 */
exports.markNotificationRead = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { notificationId } = req.params;

        if (notificationId === "all") {
            await StockSyncLog.updateMany(
                { userId, "notification.read": false },
                { $set: { "notification.read": true, "notification.readAt": new Date() } }
            );
            return res.status(200).json({ success: true, message: "Tüm bildirimler okundu" });
        }

        const log = await StockSyncLog.findOne({ _id: notificationId, userId });
        if (!log) {
            return res.status(404).json({ error: "Bildirim bulunamadı" });
        }

        await log.markAsRead();

        return res.status(200).json({ success: true, message: "Bildirim okundu" });

    } catch (error) {
        logger.error("[MARK READ] Hata:", error.message);
        return res.status(500).json({ error: "İşlem başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD & İSTATİSTİKLER
// ═══════════════════════════════════════════════════════════════

// NOT: getProductManagementDashboard aşağıda (satır ~1479) tanımlıdır — buradaki eski versiyon kaldırıldı.

// ═══════════════════════════════════════════════════════════════
// 🟠 N11 ÖZEL SERVİSLER
// ═══════════════════════════════════════════════════════════════

/**
 * N11 Ürün Yükleme (CreateProduct)
 * POST /product-management/n11/products
 */
exports.n11CreateProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { products, integrator } = req.body;
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (products.length > 1000) {
            return res.status(400).json({ error: "Tek seferde maksimum 1000 ürün yüklenebilir" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı. Lütfen önce N11 entegrasyonunu ekleyin." });
        }

        const result = await n11Service.createProduct(
            marketplace.credentials,
            products,
            integrator || "LysiaETIC"
        );

        // n11Service artık throw etmiyor — success kontrolü yap
        if (!result.success) {
            logger.error(`[N11 CREATE] Başarısız: ${result.error}`);
            return res.status(400).json({
                success: false,
                error: result.error || "N11 ürün yükleme başarısız"
            });
        }

        logger.info(`[N11 CREATE] ${products.length} ürün yükleme task'ı: ${result.taskId}`);

        return res.status(200).json({
            success: true,
            message: `${products.length} ürün N11 kuyruğuna alındı`,
            taskId: result.taskId,
            status: result.status,
            reasons: result.reasons
        });

    } catch (error) {
        logger.error("[N11 CREATE PRODUCT] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 ürün oluşturma hatası" });
    }
};

/**
 * N11 Fiyat & Stok Güncelleme (UpdateProductPriceAndStock)
 * POST /product-management/n11/stock-update
 */
exports.n11UpdateStock = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { updates, integrator } = req.body;
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: "Güncelleme listesi boş olamaz" });
        }
        if (updates.length > 1000) {
            return res.status(400).json({ error: "Tek seferde maksimum 1000 SKU güncellenebilir" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.updateProductPriceAndStock(
            marketplace.credentials,
            updates,
            integrator || "LysiaETIC"
        );

        // n11Service artık throw etmiyor — success kontrolü yap
        if (!result.success) {
            logger.error(`[N11 STOCK UPDATE] Başarısız: ${result.error}`);
            return res.status(400).json({
                success: false,
                error: result.error || "N11 stok güncelleme başarısız"
            });
        }

        logger.info(`[N11 STOCK UPDATE] ${updates.length} SKU güncelleme task'ı: ${result.taskId}`);

        return res.status(200).json({
            success: true,
            message: `${updates.length} SKU güncelleme kuyruğuna alındı`,
            taskId: result.taskId,
            status: result.status,
            reasons: result.reasons
        });

    } catch (error) {
        logger.error("[N11 STOCK UPDATE] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 stok güncelleme hatası" });
    }
};

/**
 * N11 Task Detay Sorgulama (TaskDetails)
 * GET /product-management/n11/tasks/:taskId
 */
exports.n11GetTaskDetails = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { taskId } = req.params;
        if (!taskId) return res.status(400).json({ error: "Task ID gerekli" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getTaskDetails(marketplace.credentials, taskId);

        return res.status(200).json({
            success: true,
            taskId,
            data: result.data
        });

    } catch (error) {
        logger.error("[N11 TASK DETAILS] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 task detay hatası" });
    }
};

/**
 * N11 Ürün Listesi (GetProductQuery)
 * GET /product-management/n11/products
 */
exports.n11GetProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, size = 100 } = req.query;

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getProducts(
            marketplace.credentials,
            { page: Number(page), size: Number(size) }
        );

        return res.status(200).json({
            success: true,
            total: result.total,
            products: result.products
        });

    } catch (error) {
        logger.error("[N11 GET PRODUCTS] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 ürün listesi hatası" });
    }
};

/**
 * N11 Kategori Ağacı (GetCategories)
 * GET /product-management/n11/categories
 */
exports.n11GetCategories = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getCategories(marketplace.credentials);

        return res.status(200).json({
            success: true,
            categories: result.categories
        });

    } catch (error) {
        logger.error("[N11 GET CATEGORIES] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 kategori listesi hatası" });
    }
};

/**
 * N11 Kategori Özellikleri (GetCategoryAttributesList)
 * GET /product-management/n11/categories/:categoryId/attributes
 */
exports.n11GetCategoryAttributes = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { categoryId } = req.params;
        if (!categoryId) return res.status(400).json({ error: "Kategori ID gerekli" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getCategoryAttributes(
            marketplace.credentials,
            categoryId
        );

        return res.status(200).json({
            success: true,
            categoryId,
            attributes: result.attributes
        });

    } catch (error) {
        logger.error("[N11 CATEGORY ATTRIBUTES] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 kategori özellikleri hatası" });
    }
};

/**
 * N11 Sipariş Listesi (GetShipmentPackages)
 * GET /product-management/n11/orders
 */
exports.n11GetOrders = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { status, startDate, endDate, page = 0, size = 100 } = req.query;

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getOrders(
            marketplace.credentials,
            { status, startDate, endDate, page: Number(page), size: Number(size) }
        );

        return res.status(200).json({
            success: true,
            orders: result.orders
        });

    } catch (error) {
        logger.error("[N11 GET ORDERS] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 sipariş listesi hatası" });
    }
};

/**
 * N11 Sipariş Güncelleme (UpdateOrder — Picking)
 * PUT /product-management/n11/orders/update
 */
exports.n11UpdateOrder = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { lineIds, status } = req.body;
        if (!lineIds || !Array.isArray(lineIds) || lineIds.length === 0) {
            return res.status(400).json({ error: "lineIds dizisi boş olamaz" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.updateOrderStatus(
            marketplace.credentials,
            lineIds,
            status || "Picking"
        );

        return res.status(200).json({
            success: true,
            message: `${lineIds.length} sipariş kalemi güncellendi`,
            results: result.results
        });

    } catch (error) {
        logger.error("[N11 UPDATE ORDER] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 sipariş güncelleme hatası" });
    }
};

/**
 * N11 Paket Bölme (SplitPackages)
 * POST /product-management/n11/orders/split
 */
exports.n11SplitPackage = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { splitGroups } = req.body;
        if (!splitGroups || !Array.isArray(splitGroups) || splitGroups.length === 0) {
            return res.status(400).json({ error: "splitGroups dizisi boş olamaz" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.splitPackage(marketplace.credentials, splitGroups);

        return res.status(200).json({
            success: true,
            code: result.code,
            message: result.message || "Paket bölme işlemi başarılı"
        });

    } catch (error) {
        logger.error("[N11 SPLIT PACKAGE] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 paket bölme hatası" });
    }
};

/**
 * N11 Miktar Bazlı Paket Bölme & İptal (SplitPackagesByQuantity)
 * POST /product-management/n11/orders/split-by-quantity
 */
exports.n11SplitPackageByQuantity = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { splitPackages, cancelledItems } = req.body;
        if (!splitPackages || !Array.isArray(splitPackages) || splitPackages.length === 0) {
            return res.status(400).json({ error: "splitPackages dizisi boş olamaz" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.splitPackageByQuantity(
            marketplace.credentials,
            { splitPackages, cancelledItems: cancelledItems || [] }
        );

        return res.status(200).json({
            success: true,
            code: result.code,
            message: result.message || "Miktar bazlı paket bölme başarılı"
        });

    } catch (error) {
        logger.error("[N11 SPLIT BY QUANTITY] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 miktar bazlı bölme hatası" });
    }
};

/**
 * N11 İşçilik Bedeli Ekleme
 * PUT /product-management/n11/orders/labor-costs
 */
exports.n11AddLaborCost = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { laborCostDetails } = req.body;
        if (!laborCostDetails || !Array.isArray(laborCostDetails) || laborCostDetails.length === 0) {
            return res.status(400).json({ error: "laborCostDetails dizisi boş olamaz" });
        }

        // Validasyon: her item için zorunlu alanlar
        for (const item of laborCostDetails) {
            if (!item.orderLineId) {
                return res.status(400).json({ error: "Her kalem için orderLineId zorunludur" });
            }
            if (item.totalLaborCostExcludingVAT === undefined || item.totalLaborCostExcludingVAT < 0) {
                return res.status(400).json({ error: "Geçerli bir işçilik bedeli girin" });
            }
            // laborVatRate: 0, 1, 10, 20 — default 20
            if (item.laborVatRate !== undefined && ![0, 1, 10, 20].includes(item.laborVatRate)) {
                return res.status(400).json({ error: "laborVatRate 0, 1, 10 veya 20 olmalıdır" });
            }
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.addLaborCost(marketplace.credentials, laborCostDetails);

        return res.status(200).json({
            success: true,
            message: `${laborCostDetails.length} kaleme işçilik bedeli eklendi`,
            results: result.results
        });

    } catch (error) {
        logger.error("[N11 LABOR COST] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ success: false, message: "N11 işçilik bedeli hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔬 N11 DEBUG — Ham API Yanıtını Göster
// ═══════════════════════════════════════════════════════════════

/**
 * N11 API'den ham yanıtı döndür — hangi alanda ürünler geliyor görmek için
 * GET /product-management/n11/debug/raw-products
 */
exports.n11DebugRawProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({
                error: "N11 entegrasyonu bulunamadı",
                hint: "Entegrasyon ayarlarından N11 ekleyin. marketplaceName 'N11' veya 'n11' olmalı."
            });
        }

        const { apiKey, secretKey } = marketplace.credentials || {};
        if (!apiKey || !secretKey) {
            return res.status(400).json({
                error: "N11 credentials eksik",
                hint: "marketplace.credentials içinde 'apiKey' ve 'secretKey' alanları olmalı",
                credentialKeys: Object.keys(marketplace.credentials || {})
            });
        }

        // Axios ile doğrudan ham yanıtı al
        const axios = require("axios");
        let rawResponse = null;
        let rawError    = null;

        try {
            const response = await axios.get(
                "https://api.n11.com/ms/product-query",
                {
                    headers: {
                        appkey:           apiKey,
                        appsecret:        secretKey,
                        "Content-Type":   "application/json",
                        "User-Agent":     "LysiaETIC"
                    },
                    params: { page: 0, size: 10 },
                    timeout: 20000
                }
            );
            rawResponse = {
                status:   response.status,
                headers:  response.headers,
                dataType: typeof response.data,
                isArray:  Array.isArray(response.data),
                topLevelKeys: response.data && typeof response.data === "object"
                    ? Object.keys(response.data)
                    : null,
                // İlk 3 ürünü göster (varsa)
                sampleProducts: Array.isArray(response.data)
                    ? response.data.slice(0, 3)
                    : response.data?.products?.slice(0, 3)
                        || response.data?.productList?.slice(0, 3)
                        || response.data?.content?.slice(0, 3)
                        || response.data?.data?.products?.slice(0, 3)
                        || response.data?.result?.productList?.slice(0, 3)
                        || null,
                fullData: response.data   // Tüm ham yanıt
            };
        } catch (err) {
            rawError = {
                message:    err.message,
                statusCode: err.response?.status,
                data:       err.response?.data,
                code:       err.code
            };
        }

        return res.status(200).json({
            success:     !rawError,
            credentials: { apiKey: apiKey.substring(0, 6) + "***", secretKey: "***" },
            rawResponse,
            rawError,
            hint: rawError
                ? "API isteği başarısız. rawError alanını inceleyin."
                : "API isteği başarılı. topLevelKeys ve sampleProducts alanlarını inceleyin — ürünlerin hangi anahtar altında geldiğini göreceksiniz."
        });

    } catch (error) {
        logger.error("[N11 DEBUG] Hata:", error.message);
        return res.status(500).json({ success: false, message: "N11 debug hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔬 DEBUG: Platform eşleşme kontrolü
// ═══════════════════════════════════════════════════════════════
exports.debugPlatformCheck = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        // Toplam kayıt sayısı
        const totalMappings = await ProductMapping.countDocuments({ userId });

        // Platform bazlı dağılım — her marketplaceMappings içindeki marketplaceName'leri say
        const allProducts = await ProductMapping.find({ userId })
            .select("masterProduct.name masterProduct.barcode masterProduct.sku marketplaceMappings.marketplaceName marketplaceMappings.marketplaceProductId marketplaceMappings.syncStatus")
            .lean();

        const platformCounts = {};
        const productsWithMultiplePlatforms = [];
        const n11Products = [];

        for (const p of allProducts) {
            const platforms = (p.marketplaceMappings || []).map(m => m.marketplaceName);
            for (const pl of platforms) {
                platformCounts[pl] = (platformCounts[pl] || 0) + 1;
            }
            if (platforms.length > 1) {
                productsWithMultiplePlatforms.push({
                    name: p.masterProduct?.name,
                    barcode: p.masterProduct?.barcode,
                    sku: p.masterProduct?.sku,
                    platforms
                });
            }
            // N11 içeren kayıtları topla
            const hasN11 = platforms.some(pl => pl && pl.toLowerCase().includes("n11"));
            if (hasN11) {
                n11Products.push({
                    id: p._id,
                    name: p.masterProduct?.name,
                    barcode: p.masterProduct?.barcode,
                    sku: p.masterProduct?.sku,
                    platforms,
                    mappings: (p.marketplaceMappings || []).map(m => ({
                        name: m.marketplaceName,
                        productId: m.marketplaceProductId,
                        syncStatus: m.syncStatus
                    }))
                });
            }
        }

        // İlk 5 ürünün detayı
        const first5 = allProducts.slice(0, 5).map(p => ({
            name: p.masterProduct?.name,
            barcode: p.masterProduct?.barcode,
            sku: p.masterProduct?.sku,
            platforms: (p.marketplaceMappings || []).map(m => m.marketplaceName),
            mappingCount: (p.marketplaceMappings || []).length
        }));

        return res.status(200).json({
            success: true,
            totalProductMappings: totalMappings,
            platformDistribution: platformCounts,
            productsWithMultiplePlatforms: productsWithMultiplePlatforms.slice(0, 10),
            n11ProductsInDB: n11Products.slice(0, 10),
            n11TotalCount: n11Products.length,
            first5Products: first5
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Platform kontrol hatası" });
    }
};

// 🏷️ TRENDYOL KATEGORİ ÇEKME
// ═══════════════════════════════════════════════════════════════

/**
 * Trendyol kategori ağacını çek
 * GET /product-management/trendyol/categories?search=telefon
 */
exports.getTrendyolCategories = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { search } = req.query;

        // Trendyol entegrasyonunu bul
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^trendyol$/i }
        });

        if (!marketplace) {
            return res.status(404).json({ error: "Trendyol entegrasyonu bulunamadı. Lütfen önce Trendyol entegrasyonunu ekleyin." });
        }

        const { apiKey, apiSecret, sellerId, supplierId } = marketplace.credentials || {};
        const actualSellerId = sellerId || supplierId;

        if (!apiKey || !apiSecret || !actualSellerId) {
            return res.status(400).json({ error: "Trendyol credentials eksik (apiKey, apiSecret, sellerId)" });
        }

        const axios = require("axios");
        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

        // Trendyol kategori API'si
        const response = await axios.get(
            "https://apigw.trendyol.com/integration/product/product-categories",
            {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${actualSellerId} - LysiaETIC`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        let categories = response.data?.categories || [];

        // Düz listeye çevir (nested tree → flat list)
        const flattenCategories = (cats, parentPath = []) => {
            let result = [];
            for (const cat of cats) {
                const path = [...parentPath, cat.name];
                result.push({
                    id: cat.id,
                    name: cat.name,
                    path: path.join(" > "),
                    parentId: cat.parentId || null,
                    hasChildren: !!(cat.subCategories && cat.subCategories.length > 0)
                });
                if (cat.subCategories && cat.subCategories.length > 0) {
                    result = result.concat(flattenCategories(cat.subCategories, path));
                }
            }
            return result;
        };

        let flatCategories = flattenCategories(categories);

        // Arama filtresi
        if (search) {
            const q = search.toLowerCase();
            flatCategories = flatCategories.filter(c =>
                c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)
            );
        }

        // Sadece yaprak kategorileri göster (ürün yüklenebilir olanlar)
        const leafCategories = flatCategories.filter(c => !c.hasChildren);

        return res.status(200).json({
            success: true,
            total: leafCategories.length,
            totalAll: flatCategories.length,
            categories: search ? leafCategories.slice(0, 100) : leafCategories.slice(0, 200)
        });

    } catch (error) {
        logger.error("[TRENDYOL CATEGORIES] Hata:", error.message);
        return res.status(500).json({ error: "Trendyol kategorileri alınamadı", details: error.message });
    }
};

/**
 * Trendyol kategori özellikleri (createProducts attributes için)
 * GET /product-management/trendyol/categories/:categoryId/attributes
 */
exports.getTrendyolCategoryAttributesForProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const rawId = req.params.categoryId;
        if (rawId == null || !/^\d+$/.test(String(rawId).trim())) {
            return res.status(400).json({ error: "Geçerli categoryId gerekli (sayısal, leaf kategori)" });
        }
        const categoryId = parseInt(String(rawId).trim(), 10);

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^trendyol$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "Trendyol entegrasyonu bulunamadı" });
        }

        const creds = decryptCredentials(marketplace.credentials);
        const { apiKey, apiSecret, sellerId, supplierId } = creds;
        const actualSellerId = sellerId || supplierId;
        if (!apiKey || !apiSecret || !actualSellerId) {
            return res.status(400).json({ error: "Trendyol API bilgileri eksik" });
        }

        const data = await fetchTrendyolCategoryAttributes(creds, categoryId, actualSellerId);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        const st = error.response?.status;
        const body = error.response?.data;
        const msg = body?.errors?.[0]?.message || body?.message || error.message;
        logger.error("[TRENDYOL CAT ATTR] Hata:", msg);
        return res.status(st && st >= 400 && st < 600 ? st : 500).json({
            error: msg || "Trendyol kategori özellikleri alınamadı"
        });
    }
};

/**
 * Trendyol marka arama / sayfalı liste (createProducts brandId)
 * GET /product-management/trendyol/brands?name=&page=&size=
 */
exports.searchTrendyolBrands = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const name = String(req.query.name || req.query.q || "").trim();
        const page = Math.max(0, parseInt(String(req.query.page || "0"), 10) || 0);
        const size = Math.min(100, Math.max(1, parseInt(String(req.query.size || "40"), 10) || 40));

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^trendyol$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "Trendyol entegrasyonu bulunamadı" });
        }

        const creds = decryptCredentials(marketplace.credentials);
        const { apiKey, apiSecret, sellerId, supplierId } = creds;
        const actualSellerId = sellerId || supplierId;
        if (!apiKey || !apiSecret || !actualSellerId) {
            return res.status(400).json({ error: "Trendyol API bilgileri eksik" });
        }

        const brands = await fetchTrendyolBrands(creds, actualSellerId, { name, page, size });
        return res.status(200).json({
            success: true,
            data: { brands, query: { name, page, size } }
        });
    } catch (error) {
        const st = error.response?.status;
        const body = error.response?.data;
        const msg = body?.errors?.[0]?.message || body?.message || error.message;
        logger.error("[TRENDYOL BRANDS] Hata:", msg);
        return res.status(st && st >= 400 && st < 600 ? st : 500).json({
            error: msg || "Trendyol marka listesi alınamadı"
        });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD & İSTATİSTİKLER
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün yönetimi dashboard verileri
 */
exports.getProductManagementDashboard = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        // Toplam ürün sayıları
        const totalProducts = await ProductMapping.countDocuments({ userId });
        const outOfStock = await ProductMapping.countDocuments({ userId, "stockTracking.isOutOfStock": true });
        const lowStock = await ProductMapping.countDocuments({ userId, "stockTracking.isLowStock": true });

        // Pazaryeri bazlı dağılım
        // ÖNEMLİ: DB'deki Marketplace kaydı "n11" (küçük) olabilir ama
        // ürünlerdeki marketplaceMappings "N11" (normalize) olarak kaydedilir.
        // Bu yüzden hem DB ismi hem normalize ismi ile case-insensitive arama yapıyoruz.
        const marketplaces = await Marketplace.find({ userId }).lean();
        const marketplaceStats = [];

        for (const mp of marketplaces) {
            const normalizedName = normalizeMarketplaceName(mp.marketplaceName);
            // Case-insensitive regex ile hem "n11" hem "N11" eşleşsin
            const nameRegex = new RegExp(`^${normalizedName}$`, "i");

            const count = await ProductMapping.countDocuments({
                userId,
                "marketplaceMappings.marketplaceName": nameRegex
            });
            const syncedCount = await ProductMapping.countDocuments({
                userId,
                "marketplaceMappings": {
                    $elemMatch: {
                        marketplaceName: nameRegex,
                        syncStatus: "synced"
                    }
                }
            });

            // Hatalı ürün sayısı
            const errorCount = await ProductMapping.countDocuments({
                userId,
                "marketplaceMappings": {
                    $elemMatch: {
                        marketplaceName: nameRegex,
                        syncStatus: "error"
                    }
                }
            });

            marketplaceStats.push({
                name: normalizedName,
                totalProducts: count,
                syncedProducts: syncedCount,
                unsyncedProducts: count - syncedCount,
                errorProducts: errorCount
            });
        }

        // Son senkronizasyon logları
        const recentLogs = await StockSyncLog.find({ userId })
            .sort({ timestamp: -1 })
            .limit(20)
            .lean();

        // Okunmamış bildirim sayısı
        const unreadNotifications = await StockSyncLog.countDocuments({
            userId,
            "notification.read": false
        });

        const productsWithFieldDrift = await ProductMapping.countDocuments({
            userId,
            "marketplaceMappings.fieldDrift.hasDrift": true
        });
        const criticalFieldDrift = await ProductMapping.countDocuments({
            userId,
            "marketplaceMappings.fieldDrift.hasCritical": true
        });

        return res.status(200).json({
            success: true,
            dashboard: {
                products: {
                    total: totalProducts,
                    outOfStock,
                    lowStock,
                    healthy: totalProducts - outOfStock - lowStock,
                    withFieldDrift: productsWithFieldDrift,
                    criticalFieldDrift
                },
                marketplaces: marketplaceStats,
                recentLogs,
                unreadNotifications
            }
        });

    } catch (error) {
        logger.error("[PM DASHBOARD] Hata:", error.message);
        return res.status(500).json({ error: "Dashboard verileri alınamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 TÜM PAZARYERLERİNDEN TOPLU SYNC
// ═══════════════════════════════════════════════════════════════

/**
 * Kullanıcının tüm entegre pazaryerlerinden ürünleri arka planda çek
 * POST /product-management/sync/all
 */
exports.syncAllMarketplaces = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const marketplaces = await Marketplace.find({ userId }).lean();
        if (!marketplaces.length) {
            return res.status(404).json({ error: "Hiç pazaryeri entegrasyonu bulunamadı" });
        }

        const asyncMode = req.body.async === true || req.body.async === "true";

        if (asyncMode) {
            const jobId = await scheduleSyncAllMarketplaces(userId);
            logger.info(`[SYNC ALL] ${marketplaces.length} pazaryeri için arka plan senkronizasyonu (job ${jobId})...`);
            return res.status(202).json({
                success: true,
                async: true,
                jobId,
                message: `${marketplaces.length} pazaryeri için toplu çekme arka planda başlatıldı`
            });
        }

        logger.info(`[SYNC ALL] ${marketplaces.length} pazaryeri için PARALEL senkronizasyon başlatılıyor...`);

        // ⚡ Tüm pazaryerlerini paralel çek — sıralı yerine Promise.allSettled
        // Her biri bağımsız API çağrısı, birbirini beklemeye gerek yok
        const promises = marketplaces.map(async (mp) => {
            const mpName = normalizeMarketplaceName(mp.marketplaceName);
            try {
                logger.info(`[SYNC ALL] ${mpName} senkronize ediliyor...`);
                const stats = await syncProductsFromMarketplace(userId, mp._id.toString(), mp.marketplaceName);
                logger.info(`[SYNC ALL] ${mpName} tamamlandı — Yeni: ${stats.new}, Güncellenen: ${stats.updated}`);
                return { marketplace: mpName, success: true, stats };
            } catch (err) {
                logger.error(`[SYNC ALL] ${mpName} hatası: ${err.message}`);
                return { marketplace: mpName, success: false, error: err.message };
            }
        });

        const results = await Promise.all(promises);

        const totalNew     = results.reduce((s, r) => s + (r.stats?.new     || 0), 0);
        const totalUpdated = results.reduce((s, r) => s + (r.stats?.updated || 0), 0);
        const totalErrors  = results.filter(r => !r.success).length;

        return res.status(200).json({
            success: true,
            message: `${marketplaces.length} pazaryeri senkronize edildi — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`,
            results,
            summary: { totalNew, totalUpdated, totalErrors, marketplaceCount: marketplaces.length }
        });

    } catch (error) {
        logger.error("[SYNC ALL] Genel hata:", error.message);
        return res.status(500).json({ error: "Toplu senkronizasyon başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 💰 BAZ PLATFORM FİYAT SENKRONİZASYONU
// ═══════════════════════════════════════════════════════════════

/**
 * Baz platformdan fiyat alıp hedef platformlara dağıt (TÜM ürünler — server-side)
 * POST /product-management/sync/base-price-sync
 */
exports.basePriceSync = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { baseMarketplace, targetMarketplaces, margin = 0, roundTo = "" } = req.body;

        if (!baseMarketplace || !targetMarketplaces || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Baz ve hedef pazaryerleri gerekli" });
        }

        const baseMPName = normalizeMarketplaceName(baseMarketplace);
        const targetMPNames = targetMarketplaces.map(t => normalizeMarketplaceName(t));

        logger.info(`[BASE PRICE SYNC] ${baseMPName} → ${targetMPNames.join(", ")} | margin: ${margin}% | roundTo: ${roundTo}`);

        // Baz platformda eşleştirmesi olan TÜM ürünleri çek
        const products = await ProductMapping.find({
            userId,
            "marketplaceMappings.marketplaceName": new RegExp(`^${baseMPName}$`, "i")
        });

        const results = { total: products.length, updated: 0, skipped: 0, errors: 0, details: [] };

        // 3'erli batch ile paralel işle
        const BATCH_SIZE = 3;
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (product) => {
                try {
                    const baseMapping = product.marketplaceMappings.find(
                        m => normalizeMarketplaceName(m.marketplaceName) === baseMPName
                    );
                    const basePrice = baseMapping?.price || product.masterProduct.price || 0;
                    if (!basePrice || basePrice <= 0) {
                        return { barcode: product.masterProduct.barcode, status: "skipped", reason: "Baz fiyat yok" };
                    }

                    // Yeni fiyat hesapla
                    let newPrice = basePrice * (1 + (parseFloat(margin) || 0) / 100);
                    if (roundTo) {
                        const decimal = parseFloat(roundTo);
                        newPrice = Math.floor(newPrice) + decimal;
                    }
                    newPrice = Math.round(newPrice * 100) / 100; // 2 ondalık

                    // Her hedef platforma ayrı ayrı gönder
                    let mpOk = 0, mpErr = 0;
                    for (const targetMP of targetMPNames) {
                        const mpMapping = product.marketplaceMappings.find(
                            m => normalizeMarketplaceName(m.marketplaceName) === targetMP
                        );
                        if (!mpMapping) continue;

                        const marketplace = await Marketplace.findOne({
                            userId,
                            marketplaceName: { $regex: new RegExp(`^${targetMP}$`, "i") }
                        });
                        if (!marketplace) { mpErr++; continue; }

                        let productIdForMP;
                        switch (targetMP) {
                            case "Trendyol":
                                productIdForMP = resolveTrendyolListingBarcode(
                                    product.masterProduct,
                                    mpMapping
                                ) || mpMapping.marketplaceSku || product.masterProduct.barcode;
                                break;
                            case "N11":
                                productIdForMP = mpMapping.marketplaceSku || mpMapping.marketplaceBarcode || product.masterProduct.sku;
                                break;
                            case "Hepsiburada":
                                productIdForMP = mpMapping.marketplaceSku || mpMapping.marketplaceProductId || product.masterProduct.sku;
                                break;
                            default:
                                productIdForMP = mpMapping.marketplaceSku || mpMapping.marketplaceProductId || product.masterProduct.barcode;
                        }

                        const { updateStockOnMarketplace } = require("../services/stockSyncService");
                        const marketplaceStock = product.getMarketplaceStock();
                        const priceUpdate = { salePrice: newPrice, listPrice: newPrice };
                        const updateResult = await updateStockOnMarketplace(marketplace, productIdForMP, marketplaceStock, priceUpdate);

                        if (updateResult.success) {
                            mpMapping.price = newPrice;
                            mpMapping.listPrice = newPrice;
                            mpMapping.lastSyncDate = new Date();
                            mpMapping.syncStatus = "synced";
                            mpOk++;
                        } else {
                            mpErr++;
                        }
                    }

                    await product.save();
                    return {
                        barcode: product.masterProduct.barcode,
                        name: product.masterProduct.name,
                        basePrice,
                        newPrice,
                        status: mpOk > 0 ? "success" : "error",
                        platformsUpdated: mpOk,
                        platformErrors: mpErr
                    };
                } catch (error) {
                    return { barcode: product.masterProduct?.barcode, status: "error", error: error.message };
                }
            }));

            for (const br of batchResults) {
                if (br.status === "success") results.updated++;
                else if (br.status === "skipped") results.skipped++;
                else results.errors++;
                results.details.push(br);
            }
        }

        // Log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: {
                barcode: "BASE_PRICE_SYNC",
                name: `Baz fiyat sync: ${baseMPName} → ${targetMPNames.join(", ")}`
            },
            changes: {
                field: "price",
                oldValue: baseMPName,
                newValue: targetMPNames.join(", ")
            },
            status: results.errors > 0 ? "partial" : "success",
            notification: { priority: "medium" }
        });

        logger.info(`[BASE PRICE SYNC] Tamamlandı — ${results.updated} güncellendi, ${results.skipped} atlandı, ${results.errors} hata`);

        return res.status(200).json({
            success: true,
            message: `Baz fiyat senkronizasyonu tamamlandı — ${results.updated} ürün güncellendi`,
            results
        });

    } catch (error) {
        logger.error("[BASE PRICE SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Baz fiyat senkronizasyonu başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 ÜRÜN KARŞILAŞTIRMA MATRİSİ
// ═══════════════════════════════════════════════════════════════

/**
 * Hangi ürün hangi pazaryerinde var/yok — karşılaştırma matrisi
 * GET /product-management/comparison
 */
exports.getComparisonMatrix = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, limit = 50, search, missingOnly } = req.query;

        // Kullanıcının tüm pazaryerlerini al (normalize edilmiş isimlerle)
        const marketplaces = await Marketplace.find({ userId }).lean();
        const mpNames = marketplaces.map(m => normalizeMarketplaceName(m.marketplaceName));

        if (!mpNames.length) {
            return res.status(200).json({ success: true, matrix: [], marketplaces: [], total: 0 });
        }

        // Ürün filtresi
        const filter = { userId };
        if (search) {
            filter.$or = [
                { "masterProduct.name":    { $regex: search, $options: "i" } },
                { "masterProduct.barcode": { $regex: search, $options: "i" } },
                { "masterProduct.sku":     { $regex: search, $options: "i" } }
            ];
        }

        // ── Özet istatistikleri MongoDB aggregation ile hesapla (hızlı) ──
        // Sadece gerekli alanları çek (projection ile RAM tasarrufu)
        const allProducts = await ProductMapping.find(filter)
            .select("masterProduct.name masterProduct.barcode masterProduct.sku masterProduct.price masterProduct.stock stockTracking.totalStock marketplaceMappings.marketplaceName marketplaceMappings.syncStatus marketplaceMappings.stock marketplaceMappings.price updatedAt")
            .sort({ updatedAt: -1 })
            .lean();

        // ── Tek geçişte hem matrix hem summary hesapla (O(N) — eskisi O(N×M×3) idi) ──
        let fullyDistributed = 0;
        let partiallyMissing = 0;
        let notDistributed   = 0;
        const perMarketplace = {};
        for (const mpName of mpNames) {
            perMarketplace[mpName] = { present: 0, missing: 0 };
        }

        const matrix = [];
        for (const product of allProducts) {
            const presence = {};
            let existsCount = 0;

            for (const mpName of mpNames) {
                const mapping = (product.marketplaceMappings || []).find(
                    m => m.marketplaceName?.toLowerCase() === mpName.toLowerCase()
                );
                if (mapping) {
                    presence[mpName] = { exists: true, syncStatus: mapping.syncStatus || "pending", stock: mapping.stock, price: mapping.price };
                    existsCount++;
                    perMarketplace[mpName].present++;
                } else {
                    presence[mpName] = { exists: false };
                    perMarketplace[mpName].missing++;
                }
            }

            const missingCount = mpNames.length - existsCount;

            // Summary sayaçları
            if (missingCount === 0) fullyDistributed++;
            else if (existsCount > 0) partiallyMissing++;
            else notDistributed++;

            // missingOnly filtresi — erken atlama
            if (missingOnly === "true" && missingCount === 0) continue;

            let hasFieldDrift = false;
            let hasCriticalFieldDrift = false;
            for (const mm of product.marketplaceMappings || []) {
                if (mm.fieldDrift?.hasDrift) hasFieldDrift = true;
                if (mm.fieldDrift?.hasCritical) hasCriticalFieldDrift = true;
            }

            matrix.push({
                _id:      product._id,
                name:     product.masterProduct?.name,
                barcode:  product.masterProduct?.barcode,
                sku:      product.masterProduct?.sku,
                price:    product.masterProduct?.price,
                stock:    product.stockTracking?.totalStock ?? product.masterProduct?.stock ?? 0,
                presence,
                existsCount,
                missingCount,
                missingMarketplaces: mpNames.filter(mp => !presence[mp]?.exists),
                hasFieldDrift,
                hasCriticalFieldDrift
            });
        }

        // Sayfalama
        const total    = matrix.length;
        const pageNum  = Number(page);
        const limitNum = Number(limit);
        const paged    = matrix.slice(pageNum * limitNum, (pageNum + 1) * limitNum);

        const summary = {
            totalProducts:    allProducts.length,
            fullyDistributed,
            partiallyMissing,
            notDistributed,
            perMarketplace
        };

        return res.status(200).json({
            success: true,
            marketplaces: mpNames,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            matrix: paged,
            summary
        });

    } catch (error) {
        logger.error("[COMPARISON MATRIX] Hata:", error.message);
        return res.status(500).json({ error: "Karşılaştırma matrisi alınamadı", details: error.message });
    }
};

/**
 * Alan denetimi listesi — barkod, SKU, ad, model vb. master vs platform farkları
 * GET /product-management/field-audit?driftOnly=true&criticalOnly=false&page=0&limit=50
 */
exports.getFieldAuditList = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, limit = 50, search, driftOnly = "true", criticalOnly = "false" } = req.query;
        const filter = { userId };
        if (search) {
            filter.$or = [
                { "masterProduct.name": { $regex: search, $options: "i" } },
                { "masterProduct.barcode": { $regex: search, $options: "i" } },
                { "masterProduct.sku": { $regex: search, $options: "i" } }
            ];
        }

        const products = await ProductMapping.find(filter)
            .select("masterProduct.name masterProduct.barcode masterProduct.sku marketplaceMappings.marketplaceName marketplaceMappings.fieldDrift marketplaceMappings.platformSnapshot")
            .sort({ updatedAt: -1 })
            .lean();

        const items = [];
        for (const p of products) {
            const platformRows = [];
            for (const mp of p.marketplaceMappings || []) {
                const fd = mp.fieldDrift;
                if (!fd?.hasDrift) continue;
                if (criticalOnly === "true" && !fd.hasCritical) continue;
                platformRows.push({
                    marketplaceName: mp.marketplaceName,
                    hasCritical: !!fd.hasCritical,
                    drifts: fd.drifts || [],
                    lastCheckedAt: fd.lastCheckedAt,
                    platformSnapshot: mp.platformSnapshot || null
                });
            }
            if (driftOnly === "true" && platformRows.length === 0) continue;
            items.push({
                _id: p._id,
                name: p.masterProduct?.name,
                barcode: p.masterProduct?.barcode,
                sku: p.masterProduct?.sku,
                platforms: platformRows,
                driftPlatformCount: platformRows.length,
                hasCritical: platformRows.some((r) => r.hasCritical)
            });
        }

        const total = items.length;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const paged = items.slice(pageNum * limitNum, (pageNum + 1) * limitNum);

        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 0,
            items: paged,
            trackedFields: FIELD_DEFS,
            summary: {
                productsWithDrift: items.length,
                criticalProducts: items.filter((i) => i.hasCritical).length
            }
        });
    } catch (error) {
        logger.error("[FIELD AUDIT] Hata:", error.message);
        return res.status(500).json({ error: "Alan denetimi listesi alınamadı", details: error.message });
    }
};

/**
 * Tek ürün alan denetimi
 * GET /product-management/products/:productId/field-audit
 */
exports.getProductFieldAudit = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const product = await ProductMapping.findOne({ _id: req.params.productId, userId }).lean();
        if (!product) return res.status(404).json({ error: "Ürün bulunamadı" });

        const platforms = (product.marketplaceMappings || []).map((mp) => ({
            marketplaceName: mp.marketplaceName,
            platformSnapshot: mp.platformSnapshot || extractPlatformSnapshotFromMp(mp),
            fieldDrift: mp.fieldDrift || { hasDrift: false, drifts: [] },
            syncStatus: mp.syncStatus,
            syncError: mp.syncError
        }));

        return res.status(200).json({
            success: true,
            productId: product._id,
            master: {
                name: product.masterProduct?.name,
                barcode: product.masterProduct?.barcode,
                sku: product.masterProduct?.sku,
                modelNumber: product.masterProduct?.attributes?.model || "",
                brand: product.masterProduct?.brand,
                category: product.masterProduct?.category,
                price: product.masterProduct?.price,
                stock: product.stockTracking?.totalStock ?? product.masterProduct?.stock
            },
            platforms,
            trackedFields: FIELD_DEFS
        });
    } catch (error) {
        logger.error("[FIELD AUDIT DETAIL] Hata:", error.message);
        return res.status(500).json({ error: "Alan denetimi alınamadı", details: error.message });
    }
};

/**
 * Platformdaki değeri master'a uygula (kullanıcı onayı)
 * POST /product-management/products/:productId/apply-platform-field
 * Body: { marketplaceName, field }
 */
exports.applyPlatformField = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceName, field } = req.body;
        if (!marketplaceName || !field) {
            return res.status(400).json({ error: "marketplaceName ve field gerekli" });
        }
        if (field === "barcode" || field === "sku") {
            return res.status(400).json({
                error: "Barkod ve stok kodu platformdan master'a kopyalanamaz (yanlış varyanta bağlanır). " +
                    "Bunun yerine «Master'ı platforma uygula» kullanın."
            });
        }

        const product = await ProductMapping.findOne({ _id: req.params.productId, userId });
        if (!product) return res.status(404).json({ error: "Ürün bulunamadı" });

        const norm = normalizeMarketplaceName(marketplaceName);
        const mpIdx = (product.marketplaceMappings || []).findIndex(
            (m) => normalizeMarketplaceName(m.marketplaceName) === norm
        );
        if (mpIdx < 0) {
            return res.status(404).json({ error: "Bu pazaryeri eşleştirmesi bulunamadı" });
        }

        const mp = product.marketplaceMappings[mpIdx];
        const snap = mp.platformSnapshot || extractPlatformSnapshotFromMp(mp);
        const platformValue = snap[field];
        if (platformValue === undefined || platformValue === "") {
            return res.status(400).json({ error: "Platformda bu alan için değer yok" });
        }

        const ok = applyPlatformValueToMaster(product.masterProduct, field, platformValue);
        if (!ok) {
            return res.status(400).json({ error: "Geçersiz veya desteklenmeyen alan", field });
        }

        if (field === "barcode" || field === "sku") {
            mp.marketplaceBarcode = field === "barcode" ? String(platformValue) : mp.marketplaceBarcode;
            mp.marketplaceSku = field === "sku" ? String(platformValue) : mp.marketplaceSku;
        }

        applyFieldDriftToMarketplaceMapping(mp, product.masterProduct, {
            name: snap.name,
            barcode: snap.barcode,
            sku: snap.sku,
            attributes: { model: snap.modelNumber },
            brand: snap.brand,
            category: snap.category,
            price: snap.price,
            stock: snap.stock,
            marketplaceProductId: snap.marketplaceProductId
        }, product.stockTracking);

        product.syncMasterStockFields?.();
        await product.save();

        return res.status(200).json({
            success: true,
            message: `${field} master kayda uygulandı`,
            fieldDrift: mp.fieldDrift
        });
    } catch (error) {
        logger.error("[APPLY PLATFORM FIELD] Hata:", error.message);
        return res.status(500).json({ error: "Alan uygulanamadı", details: error.message });
    }
};

/**
 * Master barkod/SKU → pazaryeri mapping (stok/fiyat yanlış ürüne gitmesin)
 * POST /product-management/products/:productId/apply-master-to-platform
 * Body: { marketplaceName, fields?: ["barcode","sku"] }
 */
exports.applyMasterToPlatformField = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceName, fields } = req.body;
        if (!marketplaceName) {
            return res.status(400).json({ error: "marketplaceName gerekli" });
        }

        const product = await ProductMapping.findOne({ _id: req.params.productId, userId });
        if (!product) return res.status(404).json({ error: "Ürün bulunamadı" });

        const norm = normalizeMarketplaceName(marketplaceName);
        const mpIdx = (product.marketplaceMappings || []).findIndex(
            (m) => normalizeMarketplaceName(m.marketplaceName) === norm
        );
        if (mpIdx < 0) {
            return res.status(404).json({ error: "Bu pazaryeri eşleştirmesi bulunamadı" });
        }

        const mp = product.marketplaceMappings[mpIdx];
        const allowed = Array.isArray(fields) && fields.length > 0
            ? fields.filter((f) => f === "barcode" || f === "sku")
            : ["barcode", "sku"];
        const align = alignMarketplaceIdentityFromMaster(mp, product.masterProduct);
        if (!align.changed && allowed.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Kimlik alanları zaten master ile uyumlu",
                fieldDrift: mp.fieldDrift
            });
        }

        alignPlatformSnapshotFromMaster(mp, product);
        product.markModified("marketplaceMappings");
        await product.save();

        return res.status(200).json({
            success: true,
            message: `${norm}: master barkod/SKU pazaryeri kaydına uygulandı`,
            previousBarcode: align.previousBarcode,
            previousSku: align.previousSku,
            marketplaceBarcode: mp.marketplaceBarcode,
            marketplaceSku: mp.marketplaceSku,
            fieldDrift: mp.fieldDrift
        });
    } catch (error) {
        logger.error("[APPLY MASTER TO PLATFORM] Hata:", error.message);
        return res.status(500).json({ error: "Master platforma uygulanamadı", details: error.message });
    }
};

/**
 * Kayıtlı snapshot ile master'ı yeniden karşılaştır (API çağrısı yok)
 * POST /product-management/products/:productId/refresh-field-audit
 */
exports.refreshProductFieldAudit = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const product = await ProductMapping.findOne({ _id: req.params.productId, userId });
        if (!product) return res.status(404).json({ error: "Ürün bulunamadı" });

        let checked = 0;
        for (const mp of product.marketplaceMappings || []) {
            const snap = extractPlatformSnapshotFromMp(mp);
            if (!snap.barcode && !snap.sku && !snap.name) continue;
            applyFieldDriftToMarketplaceMapping(
                mp,
                product.masterProduct,
                {
                    name: snap.name,
                    barcode: snap.barcode,
                    sku: snap.sku,
                    attributes: { model: snap.modelNumber },
                    brand: snap.brand,
                    category: snap.category,
                    price: snap.price,
                    stock: snap.stock,
                    marketplaceProductId: snap.marketplaceProductId
                },
                product.stockTracking
            );
            checked++;
        }

        await product.save();

        return res.status(200).json({
            success: true,
            message: `${checked} platform yeniden denetlendi`,
            marketplaceMappings: product.marketplaceMappings.map((m) => ({
                marketplaceName: m.marketplaceName,
                fieldDrift: m.fieldDrift
            }))
        });
    } catch (error) {
        logger.error("[REFRESH FIELD AUDIT] Hata:", error.message);
        return res.status(500).json({ error: "Denetim yenilenemedi", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 TOPLU DAĞITIM (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════

/**
 * Seçili ürünleri seçili pazaryerlerine toplu dağıt
 * POST /product-management/sync/bulk-distribute-selected
 */
exports.bulkDistributeSelected = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productIds, targetMarketplaces } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (!targetMarketplaces || !Array.isArray(targetMarketplaces) || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Hedef pazaryeri listesi boş olamaz" });
        }

        logger.info(`[BULK DIST SELECTED] ${productIds.length} ürün → ${targetMarketplaces.join(", ")}`);

        const results = { success: 0, skipped: 0, error: 0, details: [] };

        // ⚡ Paralel dağıtım — 3'erli batch ile (API rate limit koruması)
        const BATCH_SIZE = 3;
        for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
            const batch = productIds.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(async (productId) => {
                    try {
                        const distResults = await distributeProductToMarketplaces(userId, productId, targetMarketplaces);
                        const ok =
                            distResults.filter((r) => r.status === "success" || r.status === "pending").length;
                        const skipped = distResults.filter((r) => r.status === "skipped").length;
                        const err = distResults.filter((r) => r.status === "error").length;
                        return { productId, ok, skipped, err, distResults };
                    } catch (err) {
                        return { productId, ok: 0, skipped: 0, err: 1, error: err.message };
                    }
                })
            );

            for (const br of batchResults) {
                if (br.ok > 0)      results.success++;
                if (br.skipped > 0) results.skipped++;
                if (br.err > 0)     results.error++;
                results.details.push(br.error
                    ? { productId: br.productId, error: br.error }
                    : { productId: br.productId, results: br.distResults }
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: `Toplu dağıtım tamamlandı — Başarılı: ${results.success}, Atlanan: ${results.skipped}, Hata: ${results.error}`,
            results
        });

    } catch (error) {
        logger.error("[BULK DIST SELECTED] Hata:", error.message);
        return res.status(500).json({ error: "Toplu dağıtım başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 DAĞITILMAMIŞ ÜRÜNLERİ DAĞIT
// ═══════════════════════════════════════════════════════════════

/**
 * Henüz hiçbir pazaryerine dağıtılmamış veya bazı platformlarda eksik olan ürünleri
 * otomatik olarak tüm aktif pazaryerlerine dağıtır.
 *
 * POST /product-management/sync/distribute-undistributed
 * Body (opsiyonel):
 *   targetMarketplaces: [String] — boş = tüm aktif platformlar
 *   onlyFullyUndistributed: Boolean — true = sadece hiçbir yere dağıtılmamışlar (default: false)
 */
exports.distributeUndistributed = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { targetMarketplaces = [], onlyFullyUndistributed = false } = req.body || {};

        // 1) Kullanıcının aktif pazaryerlerini bul
        const activeMarketplaces = await Marketplace.find({ userId }).lean();
        if (activeMarketplaces.length === 0) {
            return res.status(400).json({ error: "Aktif pazaryeri entegrasyonu bulunamadı" });
        }

        const activePlatformNames = activeMarketplaces.map(m => m.marketplaceName);
        const targets = targetMarketplaces.length > 0
            ? targetMarketplaces.filter(t => activePlatformNames.some(ap => ap.toLowerCase() === t.toLowerCase()))
            : activePlatformNames;

        if (targets.length === 0) {
            return res.status(400).json({ error: "Hedef pazaryeri bulunamadı" });
        }

        logger.info(`[DIST UNDISTRIBUTED] Başlatılıyor — userId: ${userId}, hedefler: ${targets.join(", ")}, sadece dağıtılmamış: ${onlyFullyUndistributed}`);

        // 2) Tüm ürünleri getir
        const allProducts = await ProductMapping.find({ userId }).lean();

        if (allProducts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Dağıtılacak ürün bulunamadı",
                stats: { total: 0, distributed: 0, skipped: 0, error: 0 }
            });
        }

        // 3) Eksik platformları filtrele (listelenmemiş / hata / kayıt yok)
        const undistributed = [];
        for (const product of allProducts) {
            const missingPlatforms = getMissingPlatformsForProduct(product, targets);

            if (onlyFullyUndistributed) {
                const anyListed = (product.marketplaceMappings || []).some((m) =>
                    targets.some(
                        (t) =>
                            normalizeMarketplaceName(m.marketplaceName) ===
                            normalizeMarketplaceName(t)
                    ) && isMarketplaceMappingListed(m, t)
                );
                if (!anyListed && missingPlatforms.length > 0) {
                    undistributed.push({ product, missingPlatforms: targets });
                }
            } else if (missingPlatforms.length > 0) {
                undistributed.push({ product, missingPlatforms });
            }
        }

        if (undistributed.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Tüm ürünler zaten tüm platformlara dağıtılmış",
                stats: { total: allProducts.length, distributed: 0, skipped: allProducts.length, error: 0 }
            });
        }

        logger.info(`[DIST UNDISTRIBUTED] ${undistributed.length}/${allProducts.length} ürün dağıtılacak`);

        // 4) Sıralı dağıtım (rate limit koruması — 3'erli batch)
        const stats = {
            total: undistributed.length,
            distributed: 0,
            skipped: 0,
            error: 0,
            noCategory: 0,
            details: [],
        };
        const BATCH_SIZE = 2;

        for (let i = 0; i < undistributed.length; i += BATCH_SIZE) {
            const batch = undistributed.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(async ({ product, missingPlatforms }) => {
                    const perPlatform = [];
                    let ok = 0;
                    let err = 0;
                    let noCat = 0;

                    for (const platform of missingPlatforms) {
                        try {
                            const resolution = await resolveCategoryForDistribute(product, platform);
                            if (!resolution.resolved || !resolution.platformCategory?.categoryId) {
                                noCat++;
                                perPlatform.push({
                                    marketplace: platform,
                                    status: "error",
                                    message:
                                        resolution.message ||
                                        "Kategori merkezinde bu platform için kategori ID yok",
                                });
                                continue;
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

                            const catNorm = normalizeDistributeCategory({
                                id: pc.categoryId,
                                path: pathStr,
                                name: leafName || pc.categoryId,
                            });

                            const distResults = await distributeProductToMarketplaces(
                                userId,
                                product._id,
                                [platform],
                                catNorm
                            );
                            perPlatform.push(...distResults);
                            const hit = distResults.find(
                                (r) => r.status === "success" || r.status === "pending"
                            );
                            const fail = distResults.find((r) => r.status === "error");
                            if (hit) ok++;
                            else if (fail) err++;
                        } catch (platformErr) {
                            err++;
                            perPlatform.push({
                                marketplace: platform,
                                status: "error",
                                message: platformErr.message,
                            });
                        }
                    }

                    return {
                        productId: product._id,
                        name: product.masterProduct?.name || "İsimsiz",
                        platforms: missingPlatforms,
                        ok,
                        err,
                        noCategory: noCat,
                        results: perPlatform,
                    };
                })
            );

            for (const br of batchResults) {
                if (br.ok > 0) stats.distributed++;
                if (br.err > 0) stats.error += br.err;
                if (br.noCategory > 0) stats.noCategory += br.noCategory;
                if (br.ok === 0 && br.err === 0 && br.noCategory > 0) stats.skipped++;
                else if (br.ok === 0 && br.err === 0) stats.skipped++;
                stats.details.push({
                    productId: br.productId,
                    name: br.name,
                    platforms: br.platforms,
                    success: br.ok,
                    error: br.err,
                    noCategory: br.noCategory,
                    results: br.results,
                });
            }
        }

        logger.info(
            `[DIST UNDISTRIBUTED] ✅ Tamamlandı — Dağıtılan: ${stats.distributed}, Hata: ${stats.error}, Kategori yok: ${stats.noCategory}, Atlanan: ${stats.skipped}`
        );

        let message = `${stats.distributed} ürün-platform yüklemesi başlatıldı`;
        if (stats.noCategory > 0) message += `, ${stats.noCategory} kategori eşleşmesi yok`;
        if (stats.error > 0) message += `, ${stats.error} hata`;

        return res.status(200).json({
            success: true,
            message,
            stats,
        });

    } catch (error) {
        logger.error("[DIST UNDISTRIBUTED] Hata:", error.message);
        logger.error("[DIST UNDISTRIBUTED] Stack:", error.stack);
        return res.status(500).json({ error: "Dağıtım başarısız", details: error.message });
    }
};

/**
 * GET /product-management/sync/missing-distribution-preview
 * Platform bazlı eksik ürün listesi (kategori merkezi durumu ile)
 */
exports.getMissingDistributionPreview = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        let targetMarketplaces = [];
        if (req.query.targetMarketplaces) {
            targetMarketplaces = String(req.query.targetMarketplaces)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
        const onlyFullyUndistributed = req.query.onlyFullyUndistributed === "true";
        const onlyInStock = req.query.onlyInStock === "true";
        const detailed = req.query.detailed === "true";

        const plan = await buildMissingDistributionPlan(userId, {
            targetMarketplaces,
            onlyFullyUndistributed,
            onlyInStock,
            fast: !detailed,
            maxItemsPerPlatform: detailed ? 50 : 40,
        });
        if (plan.error) {
            return res.status(400).json({ error: plan.error });
        }

        return res.status(200).json({
            success: true,
            platforms: plan.platforms,
            stats: plan.stats,
            targets: plan.targets,
            categoryCheckDeferred: plan.categoryCheckDeferred,
        });
    } catch (error) {
        logger.error("[MISSING DIST PREVIEW] Hata:", error.message);
        return res.status(500).json({ error: "Önizleme alınamadı", details: error.message });
    }
};

/**
 * POST /product-management/sync/missing-distribution-job
 * Canlı takip için arka plan işi başlatır
 */
exports.startMissingDistributionJob = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { targetMarketplaces = [], onlyFullyUndistributed = false, onlyInStock = false } = req.body || {};

        const { error: targetError } = await collectActiveTargets(userId, targetMarketplaces);
        if (targetError) {
            return res.status(400).json({ error: targetError });
        }

        const quick = await buildMissingDistributionPlan(userId, {
            targetMarketplaces,
            onlyFullyUndistributed,
            onlyInStock,
            fast: true,
            summaryOnly: true,
        });
        if (quick.error) {
            return res.status(400).json({ error: quick.error });
        }
        if (quick.stats.totalMissingSlots === 0) {
            return res.status(200).json({
                success: true,
                message: "Tüm ürünler seçili platformlarda mevcut",
                jobId: null,
                stats: quick.stats,
                platforms: quick.platforms,
            });
        }

        const jobId = await scheduleMissingDistribution(userId, {
            targetMarketplaces,
            onlyFullyUndistributed,
            onlyInStock,
        });

        return res.status(202).json({
            success: true,
            jobId,
            message: "Eksikleri dağıt işlemi başlatıldı",
            stats: quick.stats,
            platforms: quick.platforms,
            categoryCheckDeferred: true,
        });
    } catch (error) {
        logger.error("[MISSING DIST JOB] Hata:", error.message);
        return res.status(500).json({ error: "İş başlatılamadı", details: error.message });
    }
};

/**
 * POST /product-management/sync/distribute-missing-item
 * Tek ürün + platform — manuel kategori ile veya kategori merkezi
 */
exports.distributeMissingItem = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId, platform, category } = req.body || {};
        if (!productId || !platform) {
            return res.status(400).json({ error: "productId ve platform zorunlu" });
        }

        const product = await ProductMapping.findOne({ _id: productId, userId });
        if (!product) return res.status(404).json({ error: "Ürün bulunamadı" });

        const out = await distributeOneSlot(
            userId,
            product,
            platform,
            category && category.id ? category : null
        );

        if (out.status === "success") {
            return res.status(200).json({
                success: true,
                status: "success",
                results: out.results,
            });
        }
        if (out.status === "no_category") {
            return res.status(422).json({
                success: false,
                status: "no_category",
                message: out.message,
            });
        }
        return res.status(422).json({
            success: false,
            status: out.status,
            message: out.message || "Dağıtım başarısız",
            results: out.results,
        });
    } catch (error) {
        logger.error("[DIST MISSING ITEM] Hata:", error.message);
        return res.status(500).json({ error: "Dağıtım başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// ⏳ N11 PENDING TASK CHECKER
// ═══════════════════════════════════════════════════════════════

/**
 * N11'de "pending" durumundaki ürünlerin task sonuçlarını kontrol et
 * POST /product-management/sync/check-pending
 */
exports.checkPendingTasks = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        logger.info(`[CHECK PENDING] Kullanıcı ${userId} — N11 + HB + Trendyol batch kontrolü başlatılıyor`);
        const n11 = await checkPendingN11Tasks(userId);
        const hepsiburada = await checkPendingHepsiburadaUploads(userId);
        const trendyol = await checkPendingTrendyolBatches(userId);

        return res.status(200).json({
            success: true,
            message:
                `N11: ${n11.checked} kontrol, ${n11.updated} kesinleşen, ${n11.failed} başarısız — ` +
                `Hepsiburada: ${hepsiburada.checked} kontrol, ${hepsiburada.updated} kesinleşen, ${hepsiburada.failed} başarısız, ${hepsiburada.inProgress || 0} işlemde — ` +
                `Trendyol batch: ${trendyol.checked} kontrol, ${trendyol.updated} kesinleşen, ${trendyol.failed} başarısız, ${trendyol.inProgress || 0} işlemde`,
            n11,
            hepsiburada,
            trendyol
        });
    } catch (error) {
        logger.error("[CHECK PENDING] Hata:", error.message);
        return res.status(500).json({ error: "Pending task kontrolü başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📥 EXCEL / CSV IMPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Excel/CSV şablonu indir
 * GET /product-management/import/template
 */
exports.downloadTemplate = async (req, res) => {
    try {
        // Şablon sütunları
        const headers = [
            "Ürün Adı*", "Barkod*", "SKU*", "Açıklama",
            "Kategori", "Marka", "Fiyat*", "Liste Fiyatı",
            "Stok*", "KDV Oranı", "Renk", "Beden",
            "Görsel URL 1", "Görsel URL 2", "Görsel URL 3"
        ];

        // Örnek satırlar
        const sampleRows = [
            [
                "Örnek Ürün Adı", "1234567890123", "SKU-001", "Ürün açıklaması buraya",
                "Giyim > T-Shirt", "Nike", "299.90", "399.90",
                "50", "18", "Kırmızı", "M",
                "https://example.com/img1.jpg", "", ""
            ],
            [
                "İkinci Ürün", "9876543210987", "SKU-002", "İkinci ürün açıklaması",
                "Ayakkabı > Spor", "Adidas", "599.90", "799.90",
                "30", "18", "Siyah", "42",
                "https://example.com/img2.jpg", "https://example.com/img2b.jpg", ""
            ]
        ];

        const wb = xlsx.utils.book_new();
        const wsData = [headers, ...sampleRows];
        const ws = xlsx.utils.aoa_to_sheet(wsData);

        // Sütun genişlikleri
        ws["!cols"] = headers.map((h, i) => ({
            wch: [25, 18, 15, 30, 25, 15, 12, 12, 8, 10, 12, 8, 40, 40, 40][i] || 20
        }));

        // Başlık satırı stili (xlsx community edition'da sınırlı)
        xlsx.utils.book_append_sheet(wb, ws, "Ürünler");

        // Açıklama sayfası
        const infoData = [
            ["Alan", "Zorunlu", "Açıklama", "Örnek"],
            ["Ürün Adı*", "EVET", "Ürünün tam adı", "Nike Air Max 90"],
            ["Barkod*", "EVET", "Benzersiz barkod (EAN/GTIN)", "1234567890123"],
            ["SKU*", "EVET", "Stok kodu (benzersiz)", "SKU-001"],
            ["Açıklama", "Hayır", "Ürün açıklaması", "Rahat ve şık..."],
            ["Kategori", "Hayır", "Kategori yolu", "Giyim > T-Shirt"],
            ["Marka", "Hayır", "Marka adı", "Nike"],
            ["Fiyat*", "EVET", "Satış fiyatı (TL)", "299.90"],
            ["Liste Fiyatı", "Hayır", "Piyasa fiyatı (TL)", "399.90"],
            ["Stok*", "EVET", "Stok adedi", "50"],
            ["KDV Oranı", "Hayır", "KDV % (varsayılan: 18)", "18"],
            ["Renk", "Hayır", "Renk özelliği", "Kırmızı"],
            ["Beden", "Hayır", "Beden özelliği", "M / 42"],
            ["Görsel URL 1-3", "Hayır", "Ürün görseli URL'leri", "https://..."],
        ];
        const wsInfo = xlsx.utils.aoa_to_sheet(infoData);
        wsInfo["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 40 }, { wch: 30 }];
        xlsx.utils.book_append_sheet(wb, wsInfo, "Açıklama");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Disposition", "attachment; filename=urun_yukleme_sablonu.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);

    } catch (error) {
        logger.error("[TEMPLATE DOWNLOAD] Hata:", error.message);
        return res.status(500).json({ error: "Şablon oluşturulamadı", details: error.message });
    }
};

/**
 * Excel/CSV dosyasını parse et — önizleme için (kaydetmez)
 * POST /product-management/import/preview
 */
exports.previewImport = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

        const { rows, errors } = parseExcelBuffer(req.file.buffer);

        if (rows.length === 0 && errors.length > 0) {
            return res.status(400).json({ error: "Dosya okunamadı veya geçerli satır bulunamadı", errors });
        }

        // Barkod çakışma kontrolü
        const barcodes = rows.map(r => r.barcode).filter(Boolean);
        const existingProducts = await ProductMapping.find({
            userId,
            "masterProduct.barcode": { $in: barcodes }
        }).lean();
        const existingBarcodes = new Set(existingProducts.map(p => p.masterProduct.barcode));

        const preview = rows.map((row, idx) => ({
            rowNumber: idx + 2,
            ...row,
            status: existingBarcodes.has(row.barcode) ? "update" : "new",
            validationErrors: validateRow(row)
        }));

        const stats = {
            total:   preview.length,
            new:     preview.filter(r => r.status === "new").length,
            update:  preview.filter(r => r.status === "update").length,
            invalid: preview.filter(r => r.validationErrors.length > 0).length
        };

        return res.status(200).json({
            success: true,
            stats,
            preview,
            parseErrors: errors
        });

    } catch (error) {
        logger.error("[IMPORT PREVIEW] Hata:", error.message);
        return res.status(500).json({ error: "Dosya önizleme başarısız", details: error.message });
    }
};

/**
 * Excel/CSV dosyasını içe aktar ve kaydet
 * POST /product-management/import/execute
 */
exports.executeImport = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

        const { skipErrors = "true", updateExisting = "true" } = req.body;
        const shouldSkipErrors    = skipErrors === "true";
        const shouldUpdateExisting = updateExisting === "true";

        const { rows, errors: parseErrors } = parseExcelBuffer(req.file.buffer);

        if (rows.length === 0) {
            return res.status(400).json({ error: "Dosyada geçerli ürün satırı bulunamadı", parseErrors });
        }

        const results = {
            total:   rows.length,
            created: 0,
            updated: 0,
            skipped: 0,
            errors:  0,
            details: []
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            // Validasyon
            const validationErrors = validateRow(row);
            if (validationErrors.length > 0) {
                if (shouldSkipErrors) {
                    results.skipped++;
                    results.details.push({ rowNumber: rowNum, status: "skipped", name: row.name, barcode: row.barcode, errors: validationErrors });
                    continue;
                } else {
                    results.errors++;
                    results.details.push({ rowNumber: rowNum, status: "error", name: row.name, barcode: row.barcode, errors: validationErrors });
                    continue;
                }
            }

            try {
                // 🛡️ Mevcut ürün kontrolü — Barkod VEYA SKU ile eşleştir
                const existing = await ProductMapping.findOne({
                    userId,
                    $or: [
                        { "masterProduct.barcode": row.barcode },
                        ...(row.sku ? [{ "masterProduct.sku": row.sku }] : [])
                    ]
                });

                if (existing) {
                    if (!shouldUpdateExisting) {
                        const matchField = existing.masterProduct.barcode === row.barcode ? "Stok kodu" : "Model kodu";
                        results.skipped++;
                        results.details.push({ rowNumber: rowNum, status: "skipped", name: row.name, barcode: row.barcode, reason: `${matchField} zaten mevcut (${existing.masterProduct.name}), güncelleme devre dışı` });
                        continue;
                    }

                    // Güncelle
                    existing.masterProduct.name        = row.name;
                    existing.masterProduct.barcode     = row.barcode; // Barkod güncelle (SKU ile eşleştiyse eski barkod kalmasın)
                    existing.masterProduct.sku         = row.sku || existing.masterProduct.sku;
                    existing.masterProduct.description = row.description || existing.masterProduct.description;
                    existing.masterProduct.price       = row.price;
                    existing.masterProduct.listPrice   = row.listPrice || row.price;
                    existing.masterProduct.category    = row.category || existing.masterProduct.category;
                    existing.masterProduct.brand       = row.brand || existing.masterProduct.brand;
                    if (row.images.length > 0) existing.masterProduct.images = row.images;
                    if (row.color || row.size) {
                        existing.masterProduct.attributes = {
                            ...existing.masterProduct.attributes,
                            color: row.color || existing.masterProduct.attributes?.color,
                            size:  row.size  || existing.masterProduct.attributes?.size
                        };
                    }
                    if (row.stock !== undefined) {
                        existing.masterProduct.stock         = row.stock;
                        existing.stockTracking.totalStock    = row.stock;
                        existing.stockTracking.availableStock = row.stock;
                        existing.updateStockStatus();
                    }

                    await existing.save();
                    results.updated++;
                    results.details.push({ rowNumber: rowNum, status: "updated", name: row.name, barcode: row.barcode, id: existing._id });

                } else {
                    // 🛡️ Yeni ürün oluşturmadan önce son duplike kontrolü
                    const dupCheck = await duplicateGuard.checkDuplicates(userId, {
                        barcode: row.barcode,
                        sku: row.sku,
                        name: row.name
                    });

                    if (!dupCheck.isValid) {
                        results.skipped++;
                        results.details.push({ rowNumber: rowNum, status: "skipped", name: row.name, barcode: row.barcode, reason: dupCheck.message });
                        continue;
                    }

                    // Yeni ürün oluştur
                    const stockVal = row.stock || 0;
                    const newProduct = new ProductMapping({
                        userId,
                        masterProduct: {
                            name:        row.name,
                            barcode:     row.barcode,
                            sku:         row.sku,
                            description: row.description || "",
                            images:      row.images,
                            price:       row.price,
                            listPrice:   row.listPrice || row.price,
                            stock:       stockVal,
                            category:    row.category || "",
                            brand:       row.brand || "",
                            attributes: {
                                color: row.color || "",
                                size:  row.size  || ""
                            }
                        },
                        marketplaceMappings: [],
                        stockTracking: {
                            totalStock:        stockVal,
                            availableStock:    stockVal,
                            lowStockThreshold: 10
                        }
                    });
                    newProduct.updateStockStatus();
                    await newProduct.save();

                    results.created++;
                    results.details.push({ rowNumber: rowNum, status: "created", name: row.name, barcode: row.barcode, id: newProduct._id });
                }

            } catch (err) {
                logger.error(`[IMPORT] Satır ${rowNum} hatası:`, err.message);
                results.errors++;
                results.details.push({ rowNumber: rowNum, status: "error", name: row.name, barcode: row.barcode, error: err.message });
            }
        }

        // Toplu import logu
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: { barcode: "IMPORT", name: `Excel import: ${results.created} yeni, ${results.updated} güncellendi` },
            changes:  { field: "import", oldValue: 0, newValue: results.created + results.updated },
            status:   results.errors > 0 ? "partial" : "success",
            notification: { priority: "medium" }
        });

        logger.info(`[IMPORT] Tamamlandı — Oluşturulan: ${results.created}, Güncellenen: ${results.updated}, Atlanan: ${results.skipped}, Hata: ${results.errors}`);

        return res.status(200).json({
            success: true,
            message: `İçe aktarma tamamlandı — ${results.created} yeni ürün, ${results.updated} güncellendi`,
            results,
            parseErrors
        });

    } catch (error) {
        logger.error("[IMPORT EXECUTE] Hata:", error.message);
        return res.status(500).json({ error: "İçe aktarma başarısız", details: error.message });
    }
};

/**
 * Ürünleri Excel olarak dışa aktar
 * GET /product-management/export
 */
exports.exportProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { search, category, marketplace, stockStatus } = req.query;

        const filter = { userId };
        if (search) {
            filter.$or = [
                { "masterProduct.name":    { $regex: search, $options: "i" } },
                { "masterProduct.barcode": { $regex: search, $options: "i" } },
                { "masterProduct.sku":     { $regex: search, $options: "i" } }
            ];
        }
        if (category)    filter["masterProduct.category"]    = { $regex: category, $options: "i" };
        if (marketplace) filter["marketplaceMappings.marketplaceName"] = marketplace;
        if (stockStatus === "outOfStock") filter["stockTracking.isOutOfStock"] = true;
        if (stockStatus === "lowStock")   filter["stockTracking.isLowStock"]   = true;

        const products = await ProductMapping.find(filter).lean();

        // Pazaryeri listesi
        const allMarketplaces = await Marketplace.find({ userId }).lean();
        const mpNames = allMarketplaces.map(m => m.marketplaceName);

        // Başlık satırı
        const headers = [
            "Ürün Adı", "Barkod", "SKU", "Açıklama", "Kategori", "Marka",
            "Fiyat", "Liste Fiyatı", "Stok", "Renk", "Beden",
            "Görsel URL 1", "Görsel URL 2",
            "Stok Durumu", "Oluşturulma Tarihi",
            ...mpNames.map(mp => `${mp} Durumu`),
            ...mpNames.map(mp => `${mp} Stok`),
            ...mpNames.map(mp => `${mp} Fiyat`)
        ];

        const rows = products.map(p => {
            const mp = p.masterProduct || {};
            const st = p.stockTracking  || {};
            const attrs = mp.attributes || {};

            const stockLabel = st.isOutOfStock ? "Stok Yok" : st.isLowStock ? "Düşük Stok" : "Normal";

            const mpPresence = mpNames.map((mpName) => {
                const m = (p.marketplaceMappings || []).find((x) => x.marketplaceName?.toLowerCase() === mpName.toLowerCase());
                if (!m) return "Yok";
                const live = isHepsiburadaMappingListedForUi(m);
                const visible = isHepsiburadaMappingVisibleForProductUi(m);
                if (live) return "Aktif";
                if (visible && /^hepsiburada$/i.test(String(mpName || ""))) {
                    if (m.syncStatus === "error") return "Hata";
                    return "Onay bekliyor";
                }
                return "Bekliyor";
            });
            const mpStock = mpNames.map(mpName => {
                const m = (p.marketplaceMappings || []).find(x => x.marketplaceName?.toLowerCase() === mpName.toLowerCase());
                return m?.stock ?? "";
            });
            const mpPrice = mpNames.map(mpName => {
                const m = (p.marketplaceMappings || []).find(x => x.marketplaceName?.toLowerCase() === mpName.toLowerCase());
                return m?.price ?? "";
            });

            return [
                mp.name || "", mp.barcode || "", mp.sku || "",
                mp.description || "", mp.category || "", mp.brand || "",
                mp.price || 0, mp.listPrice || 0, st.totalStock ?? mp.stock ?? 0,
                attrs.color || "", attrs.size || "",
                (mp.images || [])[0] || "", (mp.images || [])[1] || "",
                stockLabel,
                p.createdAt ? new Date(p.createdAt).toLocaleDateString("tr-TR") : "",
                ...mpPresence, ...mpStock, ...mpPrice
            ];
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = headers.map(() => ({ wch: 20 }));
        xlsx.utils.book_append_sheet(wb, ws, "Ürünler");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        const filename = `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);

    } catch (error) {
        logger.error("[EXPORT] Hata:", error.message);
        return res.status(500).json({ error: "Dışa aktarma başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

/**
 * Excel/CSV buffer'ı parse et
 */
const parseExcelBuffer = (buffer) => {
    const rows   = [];
    const errors = [];

    try {
        const wb = xlsx.read(buffer, { type: "buffer" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (raw.length < 2) {
            errors.push("Dosyada veri satırı bulunamadı (en az 1 başlık + 1 veri satırı gerekli)");
            return { rows, errors };
        }

        // Başlık satırını normalize et
        const headerRow = raw[0].map(h => String(h || "").trim().toLowerCase()
            .replace(/\*/g, "")
            .replace(/\s+/g, " ")
        );

        // Sütun indekslerini bul (esnek eşleştirme)
        const colMap = {
            name:        findCol(headerRow, ["ürün adı", "urun adi", "name", "title", "ad"]),
            barcode:     findCol(headerRow, ["barkod", "barcode", "ean", "gtin"]),
            sku:         findCol(headerRow, ["sku", "stok kodu", "stock code", "kod"]),
            description: findCol(headerRow, ["açıklama", "aciklama", "description", "desc"]),
            category:    findCol(headerRow, ["kategori", "category"]),
            brand:       findCol(headerRow, ["marka", "brand"]),
            price:       findCol(headerRow, ["fiyat", "price", "satış fiyatı", "satis fiyati"]),
            listPrice:   findCol(headerRow, ["liste fiyatı", "liste fiyati", "list price", "listprice"]),
            stock:       findCol(headerRow, ["stok", "stock", "adet", "quantity"]),
            vatRate:     findCol(headerRow, ["kdv", "vat", "kdv oranı", "vat rate"]),
            color:       findCol(headerRow, ["renk", "color", "colour"]),
            size:        findCol(headerRow, ["beden", "size", "numara"]),
            image1:      findCol(headerRow, ["görsel url 1", "gorsel url 1", "image1", "image url 1", "resim 1"]),
            image2:      findCol(headerRow, ["görsel url 2", "gorsel url 2", "image2", "image url 2", "resim 2"]),
            image3:      findCol(headerRow, ["görsel url 3", "gorsel url 3", "image3", "image url 3", "resim 3"])
        };

        // Veri satırlarını işle (satır 1'den başla, 0 başlık)
        for (let i = 1; i < raw.length; i++) {
            const row = raw[i];

            // Tamamen boş satırı atla
            if (row.every(cell => !cell && cell !== 0)) continue;

            const get = (col) => col !== -1 ? String(row[col] || "").trim() : "";
            const getNum = (col) => {
                if (col === -1) return undefined;
                const v = parseFloat(String(row[col] || "").replace(",", "."));
                return isNaN(v) ? undefined : v;
            };

            const images = [get(colMap.image1), get(colMap.image2), get(colMap.image3)].filter(Boolean);

            rows.push({
                name:        get(colMap.name),
                barcode:     get(colMap.barcode),
                sku:         get(colMap.sku) || get(colMap.barcode),
                description: get(colMap.description),
                category:    get(colMap.category),
                brand:       get(colMap.brand),
                price:       getNum(colMap.price) || 0,
                listPrice:   getNum(colMap.listPrice),
                stock:       getNum(colMap.stock) !== undefined ? Math.round(getNum(colMap.stock)) : 0,
                vatRate:     getNum(colMap.vatRate) || 18,
                color:       get(colMap.color),
                size:        get(colMap.size),
                images
            });
        }

    } catch (err) {
        errors.push(`Dosya okuma hatası: ${err.message}`);
    }

    return { rows, errors };
};

/**
 * Sütun adını esnek şekilde bul
 */
const findCol = (headers, candidates) => {
    for (const candidate of candidates) {
        const idx = headers.findIndex(h => h.includes(candidate));
        if (idx !== -1) return idx;
    }
    return -1;
};

/**
 * Satır validasyonu
 */
const validateRow = (row) => {
    const errors = [];
    if (!row.name || row.name.length < 2)    errors.push("Ürün adı en az 2 karakter olmalı");
    if (!row.barcode || row.barcode.length < 3) errors.push("Barkod en az 3 karakter olmalı");
    if (!row.sku || row.sku.length < 1)      errors.push("SKU boş olamaz");
    if (!row.price || row.price <= 0)        errors.push("Fiyat 0'dan büyük olmalı");
    if (row.stock < 0)                       errors.push("Stok negatif olamaz");
    return errors;
};

// ═══════════════════════════════════════════════════════════════
// 📋 TOPLU ÜRÜN YÖNETİMİ (BULK OPERATIONS)
// ═══════════════════════════════════════════════════════════════

/**
 * Toplu fiyat güncelleme
 * POST /product-management/bulk/update-prices
 *
 * Body:
 *   productIds: [String]          — Güncellenecek ürün ID'leri
 *   mode: "fixed"|"percent"|"round" — Güncelleme modu
 *   value: Number                 — Sabit fiyat veya yüzde değeri
 *   roundTo: String               — Yuvarlama (ör: "0.90", "0.99")
 *   applyToListPrice: Boolean     — Liste fiyatına da uygula
 *   syncToMarketplaces: Boolean   — Platformlara da push et
 */
exports.bulkUpdatePrices = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productIds, mode, value, roundTo, applyToListPrice = true, syncToMarketplaces = false } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (!mode || !["fixed", "percent", "round"].includes(mode)) {
            return res.status(400).json({ error: "Geçersiz mod. fixed, percent veya round olmalı" });
        }
        if (mode !== "round" && (value === undefined || value === null)) {
            return res.status(400).json({ error: "Değer gerekli" });
        }

        logger.info(`[BULK PRICE] ${productIds.length} ürün — mod: ${mode}, değer: ${value}, roundTo: ${roundTo}`);

        const results = { total: productIds.length, updated: 0, errors: 0, synced: 0, details: [] };

        const BATCH_SIZE = 5;
        for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
            const batch = productIds.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (pid) => {
                try {
                    const product = await ProductMapping.findOne({ _id: pid, userId });
                    if (!product) return { id: pid, status: "error", error: "Ürün bulunamadı" };

                    const oldPrice = product.masterProduct.price || 0;
                    let newPrice;

                    switch (mode) {
                        case "fixed":
                            newPrice = parseFloat(value);
                            break;
                        case "percent":
                            // Pozitif = artış, negatif = azalış
                            newPrice = oldPrice * (1 + parseFloat(value) / 100);
                            break;
                        case "round":
                            newPrice = oldPrice;
                            break;
                        default:
                            newPrice = oldPrice;
                    }

                    // Yuvarlama uygula
                    if (roundTo) {
                        const decimal = parseFloat(roundTo);
                        newPrice = Math.floor(newPrice) + decimal;
                    }

                    newPrice = Math.round(Math.max(0.01, newPrice) * 100) / 100;

                    product.masterProduct.price = newPrice;
                    if (applyToListPrice) {
                        // Liste fiyatı da aynı oranda güncelle
                        const oldList = product.masterProduct.listPrice || oldPrice;
                        if (mode === "fixed") {
                            product.masterProduct.listPrice = newPrice;
                        } else if (mode === "percent") {
                            product.masterProduct.listPrice = Math.round(Math.max(0.01, oldList * (1 + parseFloat(value) / 100)) * 100) / 100;
                        } else {
                            product.masterProduct.listPrice = roundTo ? Math.floor(oldList) + parseFloat(roundTo) : oldList;
                        }
                    }

                    await product.save();

                    // Platformlara sync
                    let syncCount = 0;
                    if (syncToMarketplaces) {
                        try {
                            const marketplaceStock = product.getMarketplaceStock();
                            const priceUpdate = { salePrice: newPrice, listPrice: product.masterProduct.listPrice || newPrice };
                            const syncResults = await syncStockToAllMarketplaces(userId, product, marketplaceStock, null, priceUpdate);
                            syncCount = (syncResults || []).filter(r => r.syncStatus === "success").length;
                        } catch (syncErr) {
                            logger.warn(`[BULK PRICE] Sync hatası (${product.masterProduct.barcode}): ${syncErr.message}`);
                        }
                    }

                    return {
                        id: pid,
                        name: product.masterProduct.name,
                        barcode: product.masterProduct.barcode,
                        oldPrice,
                        newPrice,
                        status: "success",
                        syncedPlatforms: syncCount
                    };
                } catch (err) {
                    return { id: pid, status: "error", error: err.message };
                }
            }));

            for (const br of batchResults) {
                if (br.status === "success") { results.updated++; results.synced += (br.syncedPlatforms || 0); }
                else results.errors++;
                results.details.push(br);
            }
        }

        // Log
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: { barcode: "BULK_PRICE", name: `Toplu fiyat: ${mode} — ${results.updated} ürün` },
            changes: { field: "price", oldValue: mode, newValue: value },
            status: results.errors > 0 ? "partial" : "success",
            notification: { priority: "medium" }
        });

        return res.status(200).json({
            success: true,
            message: `${results.updated} ürün fiyatı güncellendi${results.synced > 0 ? `, ${results.synced} platform senkronize edildi` : ""}`,
            results
        });

    } catch (error) {
        logger.error("[BULK PRICE] Hata:", error.message);
        return res.status(500).json({ error: "Toplu fiyat güncelleme başarısız", details: error.message });
    }
};

/**
 * Toplu stok güncelleme
 * POST /product-management/bulk/update-stocks
 *
 * Body:
 *   productIds: [String]
 *   mode: "fixed"|"increase"|"decrease"
 *   value: Number
 *   syncToMarketplaces: Boolean
 */
exports.bulkUpdateStocks = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productIds, mode, value, syncToMarketplaces = false } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (!mode || !["fixed", "increase", "decrease"].includes(mode)) {
            return res.status(400).json({ error: "Geçersiz mod. fixed, increase veya decrease olmalı" });
        }
        if (value === undefined || value === null || isNaN(Number(value))) {
            return res.status(400).json({ error: "Geçerli bir değer girin" });
        }

        logger.info(`[BULK STOCK] ${productIds.length} ürün — mod: ${mode}, değer: ${value}`);

        const results = { total: productIds.length, updated: 0, errors: 0, synced: 0, details: [] };

        const BATCH_SIZE = 5;
        for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
            const batch = productIds.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (pid) => {
                try {
                    const product = await ProductMapping.findOne({ _id: pid, userId });
                    if (!product) return { id: pid, status: "error", error: "Ürün bulunamadı" };

                    const oldStock = product.stockTracking.totalStock || 0;
                    let newStock;

                    switch (mode) {
                        case "fixed":
                            newStock = Math.max(0, Math.round(Number(value)));
                            break;
                        case "increase":
                            newStock = Math.max(0, oldStock + Math.round(Number(value)));
                            break;
                        case "decrease":
                            newStock = Math.max(0, oldStock - Math.round(Number(value)));
                            break;
                        default:
                            newStock = oldStock;
                    }

                    product.masterProduct.stock = newStock;
                    product.stockTracking.totalStock = newStock;
                    product.updateStockStatus();
                    await product.save();

                    // Platformlara sync
                    let syncCount = 0;
                    if (syncToMarketplaces) {
                        try {
                            const marketplaceStock = product.getMarketplaceStock();
                            const syncResults = await syncStockToAllMarketplaces(userId, product, marketplaceStock);
                            syncCount = (syncResults || []).filter(r => r.syncStatus === "success").length;
                        } catch (syncErr) {
                            logger.warn(`[BULK STOCK] Sync hatası (${product.masterProduct.barcode}): ${syncErr.message}`);
                        }
                    }

                    return {
                        id: pid,
                        name: product.masterProduct.name,
                        barcode: product.masterProduct.barcode,
                        oldStock,
                        newStock,
                        status: "success",
                        syncedPlatforms: syncCount
                    };
                } catch (err) {
                    return { id: pid, status: "error", error: err.message };
                }
            }));

            for (const br of batchResults) {
                if (br.status === "success") { results.updated++; results.synced += (br.syncedPlatforms || 0); }
                else results.errors++;
                results.details.push(br);
            }
        }

        // Log
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: { barcode: "BULK_STOCK", name: `Toplu stok: ${mode} — ${results.updated} ürün` },
            changes: { field: "stock", oldValue: mode, newValue: value },
            status: results.errors > 0 ? "partial" : "success",
            notification: { priority: results.details.some(d => d.newStock === 0) ? "high" : "medium" }
        });

        return res.status(200).json({
            success: true,
            message: `${results.updated} ürün stoğu güncellendi${results.synced > 0 ? `, ${results.synced} platform senkronize edildi` : ""}`,
            results
        });

    } catch (error) {
        logger.error("[BULK STOCK] Hata:", error.message);
        return res.status(500).json({ error: "Toplu stok güncelleme başarısız", details: error.message });
    }
};

/**
 * Toplu ürün silme (pazaryerlerinden de zorunlu kaldırır)
 * POST /product-management/bulk/delete
 *
 * Body:
 *   productIds: [String]
 *   deleteFromMarketplaces: Boolean (opsiyonel, default: true — her yerden siler)
 *   platforms: [String] (opsiyonel — boş = tümü)
 */
exports.bulkDeleteProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productIds, deleteFromMarketplaces = true, platforms = [] } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }

        logger.info(`[BULK DELETE] ${productIds.length} ürün silinecek${deleteFromMarketplaces ? " (pazaryerlerinden de)" : ""}`);

        // Silinecek ürünlerin bilgilerini al (marketplace silme + log için)
        const toDelete = await ProductMapping.find({ _id: { $in: productIds }, userId });

        // Pazaryerlerinden kaldır (sıralı — rate limit'e takılmamak için)
        let allMarketplaceResults = [];
        if (deleteFromMarketplaces) {
            for (const product of toDelete) {
                if (product.marketplaceMappings?.length > 0) {
                    const productName = product.masterProduct?.name || "İsimsiz";
                    logger.info(`[BULK DELETE] "${productName}" — pazaryerlerinden kaldırılıyor...`);
                    try {
                        const mpResults = await deleteProductFromMarketplaces(userId, product, platforms);
                        allMarketplaceResults.push({
                            productId: product._id,
                            name: productName,
                            barcode: product.masterProduct?.barcode,
                            results: mpResults
                        });
                    } catch (mpErr) {
                        logger.error(`[BULK DELETE] "${productName}" pazaryeri silme hatası: ${mpErr.message}`);
                        allMarketplaceResults.push({
                            productId: product._id,
                            name: productName,
                            barcode: product.masterProduct?.barcode,
                            results: [{ name: "Genel", status: "error", message: mpErr.message }]
                        });
                    }
                }
            }
        }

        // Yerel kayıtları sil
        const result = await ProductMapping.deleteMany({
            _id: { $in: productIds },
            userId
        });

        // Log (hata olursa silme işlemini engellemesin)
        try {
            await StockSyncLog.create({
                userId,
                actionType: "bulk_delete",
                product: { barcode: "BULK_DELETE", name: `Toplu silme: ${result.deletedCount} ürün` },
                changes: { field: "delete", oldValue: productIds.length, newValue: result.deletedCount },
                status: "success",
                affectedMarketplaces: allMarketplaceResults.length > 0
                    ? allMarketplaceResults.flatMap(r => (r.results || []).map(x => ({
                        name: x.name,
                        syncStatus: x.status === "success" ? "success" : x.status === "skipped" ? "skipped" : "error",
                        syncedAt: x.status === "success" ? new Date() : undefined,
                        error: x.status === "error" ? x.message : undefined
                    })))
                    : undefined,
                notification: { priority: "high" }
            });
        } catch (logErr) {
            logger.warn(`[BULK DELETE] Log kaydı oluşturulamadı: ${logErr.message}`);
        }

        // İstatistik hesapla
        const mpSuccessCount = allMarketplaceResults.reduce((sum, r) =>
            sum + (r.results || []).filter(x => x.status === "success").length, 0);
        const mpErrorCount = allMarketplaceResults.reduce((sum, r) =>
            sum + (r.results || []).filter(x => x.status === "error").length, 0);

        logger.info(`[BULK DELETE] ✅ ${result.deletedCount} ürün silindi | Pazaryeri: ${mpSuccessCount} başarılı, ${mpErrorCount} hata`);

        return res.status(200).json({
            success: true,
            message: allMarketplaceResults.length > 0
                ? `${result.deletedCount} ürün silindi ve pazaryerlerinden kaldırıldı${mpErrorCount > 0 ? ` (${mpErrorCount} hata)` : ""}`
                : `${result.deletedCount} ürün silindi`,
            deletedCount: result.deletedCount,
            deletedProducts: toDelete.map(p => ({ name: p.masterProduct?.name, barcode: p.masterProduct?.barcode })),
            marketplaceResults: allMarketplaceResults.length > 0 ? allMarketplaceResults : undefined,
            marketplaceStats: { success: mpSuccessCount, error: mpErrorCount }
        });

    } catch (error) {
        logger.error("[BULK DELETE] Hata:", error.message || error);
        logger.error("[BULK DELETE] Stack:", error.stack);
        return res.status(500).json({ error: "Toplu silme başarısız", details: error.message || String(error) });
    }
};

/**
 * Toplu ürün bilgisi güncelleme (kategori, marka, güvenlik stoğu vb.)
 * POST /product-management/bulk/update-fields
 *
 * Body:
 *   productIds: [String]
 *   fields: { category?, brand?, safetyStock?, lowStockThreshold? }
 */
exports.bulkUpdateFields = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productIds, fields } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
            return res.status(400).json({ error: "Güncellenecek alan belirtilmedi" });
        }

        logger.info(`[BULK FIELDS] ${productIds.length} ürün — alanlar: ${Object.keys(fields).join(", ")}`);

        // MongoDB $set objesi oluştur
        const updateSet = {};
        const changedFields = [];

        if (fields.category !== undefined) {
            updateSet["masterProduct.category"] = fields.category;
            changedFields.push("kategori");
        }
        if (fields.brand !== undefined) {
            updateSet["masterProduct.brand"] = fields.brand;
            changedFields.push("marka");
        }
        if (fields.safetyStock !== undefined) {
            updateSet["stockTracking.safetyStock"] = Math.max(0, Number(fields.safetyStock));
            changedFields.push("güvenlik stoğu");
        }
        if (fields.lowStockThreshold !== undefined) {
            updateSet["stockTracking.lowStockThreshold"] = Math.max(0, Number(fields.lowStockThreshold));
            changedFields.push("düşük stok eşiği");
        }

        if (Object.keys(updateSet).length === 0) {
            return res.status(400).json({ error: "Geçerli güncellenecek alan bulunamadı" });
        }

        updateSet["updatedAt"] = new Date();

        const result = await ProductMapping.updateMany(
            { _id: { $in: productIds }, userId },
            { $set: updateSet }
        );

        // Güvenlik stoğu değiştiyse platformlara sync gerekebilir
        let syncedCount = 0;
        if (fields.safetyStock !== undefined) {
            const products = await ProductMapping.find({ _id: { $in: productIds }, userId });
            for (const product of products) {
                product.updateStockStatus();
                await product.save();
            }
        }

        // Log
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: { barcode: "BULK_FIELDS", name: `Toplu alan güncelleme: ${changedFields.join(", ")}` },
            changes: { field: changedFields.join(", "), oldValue: productIds.length, newValue: result.modifiedCount },
            status: "success",
            notification: { priority: "low" }
        });

        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} ürünün ${changedFields.join(", ")} alanları güncellendi`,
            modifiedCount: result.modifiedCount,
            fields: changedFields
        });

    } catch (error) {
        logger.error("[BULK FIELDS] Hata:", error.message);
        return res.status(500).json({ error: "Toplu alan güncelleme başarısız", details: error.message });
    }
};

/**
 * Ürün oluştur ve platformlara dağıt (tek adımda)
 * POST /product-management/products/create-and-distribute
 */
exports.createAndDistribute = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const {
            name, barcode, sku, description, images,
            price, listPrice, stock, category, brand,
            attributes, targetMarketplaces, platformCategories,
            vatRate, dimensionalWeight, marketplaceExtras,
            n11ShipmentTemplate, productMainId
        } = req.body;

        const n11ShipTpl =
            typeof n11ShipmentTemplate === "string" ? n11ShipmentTemplate.trim() : "";

        // Zorunlu alan kontrolü
        if (!name || !barcode || !sku || price === undefined || price === null || price === "") {
            return res.status(400).json({
                error: "Zorunlu alanlar eksik",
                required: ["name", "barcode", "sku", "price"]
            });
        }
        const priceNum = Number(price);
        if (Number.isNaN(priceNum) || priceNum <= 0) {
            return res.status(400).json({ error: "Satış fiyatı 0'dan büyük sayısal bir değer olmalıdır." });
        }

        // 🛡️ Duplike kontrolü (Barkod + SKU + İsim)
        const duplicateCheck = await duplicateGuard.checkDuplicates(userId, { barcode, sku, name });
        if (!duplicateCheck.isValid) {
            return res.status(409).json({
                error: duplicateCheck.message,
                type: duplicateCheck.type,
                conflicts: duplicateCheck.conflicts
            });
        }

        // Ürün oluştur
        const stockVal = stock || 0;
        const listPriceNum = listPrice != null && listPrice !== "" ? Number(listPrice) : priceNum;
        const attrObj = attributes && typeof attributes === "object" ? { ...attributes } : {};
        if (dimensionalWeight != null && dimensionalWeight !== "") {
            const dw = Number(dimensionalWeight);
            if (!Number.isNaN(dw)) attrObj.weight = dw;
        }
        const mainIdTrim = productMainId != null && String(productMainId).trim() !== ""
            ? String(productMainId).trim()
            : "";
        if (mainIdTrim) attrObj.productMainId = mainIdTrim;

        const productMapping = new ProductMapping({
            userId,
            masterProduct: {
                name,
                barcode,
                sku,
                description: description || "",
                images: images || [],
                price: priceNum,
                listPrice: !Number.isNaN(listPriceNum) && listPriceNum > 0 ? listPriceNum : priceNum,
                stock: stockVal,
                vatRate: vatRate != null && vatRate !== "" ? Number(vatRate) : 20,
                category: category || "",
                brand: brand || "",
                attributes: attrObj
            },
            marketplaceMappings: [],
            stockTracking: {
                totalStock: stockVal,
                availableStock: stockVal,
                lowStockThreshold: 10
            }
        });

        productMapping.updateStockStatus();
        if (n11ShipTpl) {
            productMapping.masterProduct.shipmentTemplate = n11ShipTpl;
            productMapping.markModified("masterProduct");
        }
        await productMapping.save();

        logger.info(`[PRODUCT] Yeni ürün oluşturuldu: ${name} (${barcode})`);

        // Platformlara dağıt
        // - Body'de targetMarketplaces: [] gönderildiyse → yalnızca kayıt, dağıtım yok (sihirbaz "Kaydet").
        // - Alan hiç yoksa (eski istemciler) ve liste boşsa → aktif entegrasyonların tamamına gönder.
        const distributeResults = [];
        const hasTargetsKey = Object.prototype.hasOwnProperty.call(req.body, "targetMarketplaces");
        const rawTargetsArr = Array.isArray(targetMarketplaces) ? targetMarketplaces : [];
        let targets = [...new Set(rawTargetsArr.map((t) => String(t || "").trim()).filter(Boolean))];
        const explicitEmptyList = hasTargetsKey && rawTargetsArr.length === 0;

        if (explicitEmptyList) {
            targets = [];
            logger.info(`[PRODUCT] targetMarketplaces=[] — dağıtım atlanıyor (yalnızca kayıt): ${name} / ${barcode}`);
        } else if (targets.length === 0) {
            const integrations = await Marketplace.find({ userId, isActive: { $ne: false } })
                .select("marketplaceName")
                .lean();
            targets = [...new Set(integrations.map((r) => r.marketplaceName).filter(Boolean))];
            if (targets.length > 0) {
                logger.info(
                    `[PRODUCT] targetMarketplaces belirtilmedi — ${targets.length} aktif entegrasyona otomatik dağıtım: ${targets.join(", ")}`
                );
            } else {
                logger.info(
                    `[PRODUCT] Dağıtım yok — bağlı aktif pazaryeri bulunamadı (create-and-distribute: ${name} / ${barcode})`
                );
            }
        }

        const uploadSupported = new Set(["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti"]);
        const skippedUnsupported = targets.filter((t) => !uploadSupported.has(String(t || "").trim()));
        targets = targets.filter((t) => uploadSupported.has(String(t || "").trim()));
        if (skippedUnsupported.length > 0) {
            logger.info(
                `[PRODUCT] Ürün yüklemesi desteklenmeyen pazaryerleri atlandı: ${skippedUnsupported.join(", ")}`
            );
        }

        if (targets.length > 0) {
            for (const target of targets) {
                try {
                    const rawCategory = (() => {
                        if (!platformCategories || typeof platformCategories !== "object") return null;
                        if (platformCategories[target]) return platformCategories[target];
                        const wanted = String(target || "").trim().toLowerCase();
                        const matchedKey = Object.keys(platformCategories).find(
                            (k) => String(k || "").trim().toLowerCase() === wanted
                        );
                        return matchedKey ? platformCategories[matchedKey] : null;
                    })();
                    const normalizedCategory = rawCategory && (rawCategory.categoryId || rawCategory.id)
                        ? {
                            id: String(rawCategory.categoryId || rawCategory.id),
                            name: rawCategory.categoryName || rawCategory.name || "",
                            path: rawCategory.categoryPath || rawCategory.path || rawCategory.categoryName || rawCategory.name || ""
                        }
                        : null;
                    logger.info(
                        `[PRODUCT DISTRIBUTE] ${target} kategori baglami: ` +
                        `${normalizedCategory ? `id=${normalizedCategory.id}, name=${normalizedCategory.name || "-"}` : "YOK"}`
                    );

                    const distResult = await distributeProductToMarketplaces(
                        userId, productMapping._id, [target], normalizedCategory,
                        marketplaceExtras && typeof marketplaceExtras === "object"
                            ? { marketplaceExtras }
                            : null
                    );
                    const items = Array.isArray(distResult) ? distResult : [];
                    const errItem = items.find((i) => i.status === "error");
                    const iterationOk = items.length > 0 && !errItem;

                    distributeResults.push({
                        marketplace: target,
                        success: iterationOk,
                        result: distResult,
                        error: errItem ? (errItem.message || "Yükleme başarısız") : undefined
                    });
                } catch (distErr) {
                    distributeResults.push({
                        marketplace: target,
                        success: false,
                        error: distErr.message
                    });
                    logger.warn(`[PRODUCT DISTRIBUTE] ${target} dağıtım hatası: ${distErr.message}`);
                }
            }
        }

        // Log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "product_created",
            product: { productMappingId: productMapping._id, barcode, sku, name },
            status: "success",
            notification: { priority: "low" }
        });

        const distOk = distributeResults.filter((r) => r.success);
        const distBad = distributeResults.filter((r) => !r.success);
        let summaryMessage = "Ürün oluşturuldu";
        if (distributeResults.length === 0) {
            summaryMessage =
                "Ürün oluşturuldu (bağlı aktif pazaryeri yok — sadece programda kayıtlı; entegrasyon ekledikten sonra dağıtabilirsiniz)";
        } else if (distBad.length === 0) {
            summaryMessage = `Ürün oluşturuldu; ${distOk.length} pazaryerine yükleme tamamlandı veya kuyrukta`;
        } else if (distOk.length === 0) {
            summaryMessage =
                "Ürün oluşturuldu ancak seçilen pazaryerlerine yüklenemedi: " +
                distBad.map((b) => `${b.marketplace}: ${b.error || "bilinmeyen hata"}`).join("; ");
        } else {
            summaryMessage =
                `Ürün oluşturuldu. Başarılı: ${distOk.map((o) => o.marketplace).join(", ")}. ` +
                `Hata: ${distBad.map((b) => `${b.marketplace}: ${b.error || "?"}`).join("; ")}`;
        }

        return res.status(201).json({
            success: true,
            message: summaryMessage,
            product: productMapping,
            distributeResults,
            distributeSummary: {
                attempted: distributeResults.length,
                succeeded: distOk.length,
                failed: distBad.length
            }
        });

    } catch (error) {
        logger.error("[PRODUCT CREATE & DISTRIBUTE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün oluşturulamadı", details: error.message });
    }
};

/**
 * Varyantlı ürün ailesi — ortak productMainId, her satır ayrı barkod/SKU
 * POST /product-management/products/create-variants-and-distribute
 */
exports.createVariantsAndDistribute = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const {
            productMainId,
            baseName,
            description = "",
            images = [],
            brand = "",
            variants = [],
            targetMarketplaces,
            platformCategories,
            marketplaceExtras,
            vatRate,
            dimensionalWeight,
            n11ShipmentTemplate,
            createVariantGroup = true,
            variantGroupName
        } = req.body;

        const mainId = String(productMainId || "").trim();
        const base = String(baseName || "").trim();
        if (!mainId || mainId.length < 2) {
            return res.status(400).json({ error: "Ortak model kodu (productMainId) zorunludur — tüm varyantlar Trendyol'da aynı sayfada görünür" });
        }
        if (!base) {
            return res.status(400).json({ error: "baseName (ürün ailesi adı) zorunludur" });
        }
        if (!Array.isArray(variants) || variants.length < 2) {
            return res.status(400).json({ error: "En az 2 varyant satırı gerekir (renk/beden)" });
        }

        const variantResults = [];
        const memberIds = [];

        for (let i = 0; i < variants.length; i++) {
            const v = variants[i] || {};
            const barcode = String(v.barcode || "").trim();
            const sku = String(v.sku || "").trim();
            const priceNum = Number(v.price);
            if (!barcode || !sku) {
                return res.status(400).json({ error: `Varyant ${i + 1}: barkod ve stok kodu (SKU) zorunlu` });
            }
            if (Number.isNaN(priceNum) || priceNum <= 0) {
                return res.status(400).json({ error: `Varyant ${i + 1}: geçerli fiyat gerekli` });
            }

            const suffix = [v.color, v.size, v.nameSuffix].filter(Boolean).join(" ");
            const name = String(v.name || "").trim() || (suffix ? `${base} — ${suffix}` : `${base} — Varyant ${i + 1}`);

            const duplicateCheck = await duplicateGuard.checkDuplicates(userId, { barcode, sku, name });
            if (!duplicateCheck.isValid) {
                return res.status(409).json({
                    error: `Varyant ${i + 1}: ${duplicateCheck.message}`,
                    type: duplicateCheck.type,
                    conflicts: duplicateCheck.conflicts
                });
            }

            const stockVal = Number(v.stock) || 0;
            const listPriceNum = v.listPrice != null && v.listPrice !== "" ? Number(v.listPrice) : priceNum;
            const attrObj = {
                productMainId: mainId,
                ...(v.color ? { color: String(v.color).trim(), webColor: String(v.color).trim() } : {}),
                ...(v.size ? { size: String(v.size).trim() } : {})
            };
            if (dimensionalWeight != null && dimensionalWeight !== "") {
                const dw = Number(dimensionalWeight);
                if (!Number.isNaN(dw)) attrObj.weight = dw;
            }

            const productMapping = new ProductMapping({
                userId,
                masterProduct: {
                    name,
                    barcode,
                    sku,
                    description: description || "",
                    images: Array.isArray(v.images) && v.images.length > 0 ? v.images : images || [],
                    price: priceNum,
                    listPrice: !Number.isNaN(listPriceNum) && listPriceNum > 0 ? listPriceNum : priceNum,
                    stock: stockVal,
                    vatRate: vatRate != null && vatRate !== "" ? Number(vatRate) : 20,
                    category: "",
                    brand: brand || "",
                    attributes: attrObj
                },
                marketplaceMappings: [],
                stockTracking: {
                    totalStock: stockVal,
                    availableStock: stockVal,
                    lowStockThreshold: 10
                }
            });
            productMapping.updateStockStatus();
            if (n11ShipmentTemplate) {
                productMapping.masterProduct.shipmentTemplate = String(n11ShipmentTemplate).trim();
                productMapping.markModified("masterProduct");
            }
            await productMapping.save();
            memberIds.push(productMapping._id);

            const distributeResults = [];
            const rawTargets = Array.isArray(targetMarketplaces) ? targetMarketplaces : [];
            let targets = [...new Set(rawTargets.map((t) => String(t || "").trim()).filter(Boolean))];
            if (targets.length === 0) {
                const integrations = await Marketplace.find({ userId, isActive: { $ne: false } })
                    .select("marketplaceName")
                    .lean();
                targets = [...new Set(integrations.map((r) => r.marketplaceName).filter(Boolean))];
            }
            const uploadSupported = new Set(["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti"]);
            targets = targets.filter((t) => uploadSupported.has(String(t || "").trim()));

            for (const target of targets) {
                try {
                    const rawCategory = (() => {
                        if (!platformCategories || typeof platformCategories !== "object") return null;
                        if (platformCategories[target]) return platformCategories[target];
                        const wanted = String(target || "").trim().toLowerCase();
                        const matchedKey = Object.keys(platformCategories).find(
                            (k) => String(k || "").trim().toLowerCase() === wanted
                        );
                        return matchedKey ? platformCategories[matchedKey] : null;
                    })();
                    const normalizedCategory = rawCategory && (rawCategory.categoryId || rawCategory.id)
                        ? {
                            id: String(rawCategory.categoryId || rawCategory.id),
                            name: rawCategory.categoryName || rawCategory.name || "",
                            path: rawCategory.categoryPath || rawCategory.path || rawCategory.categoryName || rawCategory.name || ""
                        }
                        : null;

                    const distResult = await distributeProductToMarketplaces(
                        userId,
                        productMapping._id,
                        [target],
                        normalizedCategory,
                        marketplaceExtras && typeof marketplaceExtras === "object"
                            ? { marketplaceExtras }
                            : null
                    );
                    const items = Array.isArray(distResult) ? distResult : [];
                    const errItem = items.find((item) => item.status === "error");
                    distributeResults.push({
                        marketplace: target,
                        success: items.length > 0 && !errItem,
                        error: errItem ? (errItem.message || "Yükleme başarısız") : undefined
                    });
                } catch (distErr) {
                    distributeResults.push({
                        marketplace: target,
                        success: false,
                        error: distErr.message
                    });
                }
            }

            variantResults.push({
                index: i,
                productMappingId: productMapping._id,
                name,
                barcode,
                sku,
                distributeResults
            });
        }

        let group = null;
        if (createVariantGroup !== false && memberIds.length > 0) {
            group = await VariantGroup.create({
                userId,
                name: String(variantGroupName || base).trim().slice(0, 200),
                trendyolProductMainId: mainId,
                memberIds,
                notes: "Sihirbaz — varyantlı yükleme",
                dimensionHint: { colorLabel: "Renk", sizeLabel: "Beden" }
            });
            await ProductMapping.updateMany(
                { _id: { $in: memberIds }, userId },
                { $set: { variantGroupId: group._id } }
            );
        }

        return res.status(201).json({
            success: true,
            message: `${variantResults.length} varyant oluşturuldu (ortak model: ${mainId})`,
            productMainId: mainId,
            variants: variantResults,
            variantGroup: group
        });
    } catch (error) {
        logger.error("[VARIANT CREATE & DISTRIBUTE] Hata:", error.message);
        return res.status(500).json({ error: "Varyantlı yükleme başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔤 BARKOD & SKU ÖNERİSİ
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün adına göre barkod ve SKU önerisi üret
 * POST /product-management/products/suggest-codes
 * Body: { productName, brand?, category? }
 */
exports.suggestBarcodeAndSku = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productName, brand, category } = req.body;
        if (!productName) return res.status(400).json({ error: "productName gerekli" });

        // Türkçe karakter dönüşümü
        const trMap = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
        const toAscii = (str) => str.replace(/[çğıöşüÇĞİÖŞÜ]/g, c => trMap[c] || c);

        // Ürün adından kısaltma oluştur
        const words = toAscii(productName.trim()).split(/\s+/).filter(w => w.length > 0);
        const prefix = words.map(w => w[0].toUpperCase()).join("").slice(0, 4);
        const brandPrefix = brand ? toAscii(brand.trim()).slice(0, 3).toUpperCase() : "";
        const catPrefix = category ? toAscii(category.split(">").pop().trim()).slice(0, 3).toUpperCase() : "";

        // Benzersiz sayı üret (timestamp son 6 hane + random 4 hane) — ✅ SEC: crypto.randomInt kullanımı
        const crypto = require("crypto");
        const ts = Date.now().toString().slice(-6);
        const rnd = crypto.randomInt(1000, 10000).toString();
        const rnd2 = crypto.randomInt(100, 1000).toString();

        // Mevcut barkod sayısını al (sıralı numara için)
        const existingCount = await ProductMapping.countDocuments({ userId });
        const seq = String(existingCount + 1).padStart(4, "0");

        // Öneriler oluştur
        const suggestions = {
            barcodes: [
                `LYS${ts}${rnd}`,                                          // LYS + timestamp + random
                `${prefix}${ts}${rnd2}`,                                    // Kısaltma + timestamp + random
                `869${ts}${rnd.slice(0, 3)}`,                               // 869 (TR) + timestamp + random
                brandPrefix ? `${brandPrefix}${prefix}${rnd}` : null,       // Marka + kısaltma + random
            ].filter(Boolean).slice(0, 4),
            skus: [
                `${prefix}-${seq}`,                                         // Kısaltma-sıra
                `${brandPrefix || "PRD"}-${prefix}-${rnd2}`,                // Marka-kısaltma-random
                catPrefix ? `${catPrefix}-${prefix}-${seq}` : `SKU-${prefix}-${seq}`, // Kategori-kısaltma-sıra
                `LYS-${seq}-${rnd2}`,                                       // LYS-sıra-random
            ].filter(Boolean).slice(0, 4),
        };

        // Benzersizlik kontrolü — mevcut barkodlarla çakışma var mı?
        const existingBarcodes = await ProductMapping.find({
            userId,
            "masterProduct.barcode": { $in: suggestions.barcodes }
        }).select("masterProduct.barcode").lean();
        const usedBarcodes = new Set(existingBarcodes.map(p => p.masterProduct.barcode));
        suggestions.barcodes = suggestions.barcodes.map(b => ({
            value: b,
            available: !usedBarcodes.has(b)
        }));

        const existingSkus = await ProductMapping.find({
            userId,
            "masterProduct.sku": { $in: suggestions.skus.map(s => typeof s === "string" ? s : s.value) }
        }).select("masterProduct.sku").lean();
        const usedSkus = new Set(existingSkus.map(p => p.masterProduct.sku));
        suggestions.skus = suggestions.skus.map(s => {
            const val = typeof s === "string" ? s : s.value;
            return { value: val, available: !usedSkus.has(val) };
        });

        return res.status(200).json({ success: true, suggestions });
    } catch (error) {
        logger.error("[SUGGEST CODES] Hata:", error.message);
        return res.status(500).json({ success: false, message: "Kod önerisi hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🤖 AI AÇIKLAMA ÜRETİCİ
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün bilgilerine göre profesyonel açıklama üret
 * POST /product-management/products/generate-description
 * Body: { productName, category?, brand?, price?, attributes? }
 */
exports.generateAIDescription = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productName, category, brand, price, attributes, tone } = req.body;
        if (!productName) return res.status(400).json({ error: "productName gerekli" });

        // Kategori anahtar kelimeleri
        const catWords = (category || "").toLowerCase();
        const brandText = brand && brand !== "Diğer" && brand !== "Genel" ? brand : "";

        // Ton seçimi
        const toneStyle = tone || "professional"; // professional, friendly, luxury, minimal

        // Akıllı açıklama şablonları
        const templates = {
            professional: () => {
                const parts = [];
                parts.push(`${productName}${brandText ? ` — ${brandText}` : ""}`);
                parts.push("");

                if (catWords.includes("mutfak") || catWords.includes("ev")) {
                    parts.push(`Evinizin vazgeçilmezi olacak ${productName}, üstün kalite malzemelerden üretilmiştir. Günlük kullanımda dayanıklılığı ve şık tasarımıyla öne çıkar.`);
                } else if (catWords.includes("giyim") || catWords.includes("moda") || catWords.includes("kıyafet")) {
                    parts.push(`Şıklığınızı tamamlayacak ${productName}, özenle seçilmiş kumaşlardan üretilmiştir. Hem rahat hem de modern bir görünüm sunar.`);
                } else if (catWords.includes("elektronik") || catWords.includes("teknoloji") || catWords.includes("bilgisayar")) {
                    parts.push(`Yüksek performanslı ${productName}, en son teknolojiyle donatılmıştır. Günlük kullanımdan profesyonel ihtiyaçlara kadar geniş bir yelpazede hizmet verir.`);
                } else if (catWords.includes("kozmetik") || catWords.includes("bakım") || catWords.includes("güzellik")) {
                    parts.push(`Cildinize özen gösteren ${productName}, doğal içeriklerle formüle edilmiştir. Günlük bakım rutininizin vazgeçilmez parçası olacak.`);
                } else if (catWords.includes("spor") || catWords.includes("fitness")) {
                    parts.push(`Aktif yaşam tarzınıza uygun ${productName}, dayanıklı ve ergonomik tasarımıyla performansınızı artırır.`);
                } else if (catWords.includes("oyuncak") || catWords.includes("çocuk") || catWords.includes("bebek")) {
                    parts.push(`Çocuğunuzun gelişimine katkı sağlayan ${productName}, güvenli malzemelerden üretilmiştir. Eğlenceli ve eğitici özellikleriyle dikkat çeker.`);
                } else if (catWords.includes("takı") || catWords.includes("aksesuar") || catWords.includes("mücevher")) {
                    parts.push(`Zarif tasarımıyla göz kamaştıran ${productName}, özel anlarınızda şıklığınızı tamamlar. Kaliteli işçilik ve estetik detaylarla öne çıkar.`);
                } else {
                    parts.push(`Yüksek kaliteli ${productName}${brandText ? `, ${brandText} güvencesiyle` : ""} sizlerle. Titizlikle üretilmiş bu ürün, beklentilerinizi karşılayacak performans ve dayanıklılık sunar.`);
                }

                parts.push("");

                // Özellikler
                if (attributes && Object.keys(attributes).length > 0) {
                    parts.push("📋 Ürün Özellikleri:");
                    for (const [key, val] of Object.entries(attributes)) {
                        if (val && val !== "null" && val !== "undefined") {
                            parts.push(`• ${key}: ${val}`);
                        }
                    }
                    parts.push("");
                }

                // Kategori bazlı ek bilgiler
                parts.push("✅ Öne Çıkan Özellikler:");
                parts.push(`• Yüksek kalite malzeme ve işçilik`);
                parts.push(`• Hızlı ve güvenli kargo ile kapınıza teslim`);
                if (brandText) parts.push(`• ${brandText} markasının güvencesi`);
                parts.push(`• Kolay iade ve değişim imkanı`);
                parts.push("");

                if (price) {
                    parts.push(`💰 Özel fiyat avantajıyla şimdi sipariş verin!`);
                }

                return parts.join("\n");
            },
            friendly: () => {
                const parts = [];
                parts.push(`🎉 ${productName}${brandText ? ` by ${brandText}` : ""}`);
                parts.push("");
                parts.push(`Merhaba! Bu harika ürünü keşfettiğiniz için çok mutluyuz! ${productName}, tam da aradığınız şey olabilir.`);
                parts.push("");
                parts.push(`Neden bu ürünü seveceksiniz?`);
                parts.push(`✨ Kaliteli malzeme ve özenli üretim`);
                parts.push(`🚀 Hızlı kargo ile hemen kapınızda`);
                parts.push(`💯 Müşteri memnuniyeti garantisi`);
                if (brandText) parts.push(`🏷️ ${brandText} kalitesi`);
                parts.push("");
                parts.push(`Hemen sepetinize ekleyin, fırsatı kaçırmayın! 🛒`);
                return parts.join("\n");
            },
            luxury: () => {
                const parts = [];
                parts.push(`${productName}${brandText ? ` | ${brandText}` : ""}`);
                parts.push("");
                parts.push(`Seçkin zevklere hitap eden ${productName}, üstün kalite ve zarif tasarımın buluşma noktasıdır.`);
                parts.push("");
                parts.push(`Her detayında mükemmellik arayışını yansıtan bu eşsiz ürün, yaşam alanınıza sofistike bir dokunuş katacaktır.`);
                parts.push("");
                if (attributes && Object.keys(attributes).length > 0) {
                    parts.push("Detaylar:");
                    for (const [key, val] of Object.entries(attributes)) {
                        if (val && val !== "null" && val !== "undefined") {
                            parts.push(`  ◆ ${key}: ${val}`);
                        }
                    }
                    parts.push("");
                }
                parts.push(`Kendinize veya sevdiklerinize özel bir hediye olarak tercih edebilirsiniz.`);
                return parts.join("\n");
            },
            minimal: () => {
                const parts = [];
                parts.push(productName);
                if (brandText) parts.push(`Marka: ${brandText}`);
                if (category) parts.push(`Kategori: ${category}`);
                parts.push("");
                parts.push("Özellikler:");
                parts.push("- Kaliteli malzeme");
                parts.push("- Hızlı kargo");
                parts.push("- Kolay iade");
                if (attributes && Object.keys(attributes).length > 0) {
                    for (const [key, val] of Object.entries(attributes)) {
                        if (val && val !== "null" && val !== "undefined") {
                            parts.push(`- ${key}: ${val}`);
                        }
                    }
                }
                return parts.join("\n");
            }
        };

        const generator = templates[toneStyle] || templates.professional;
        const description = generator();

        return res.status(200).json({
            success: true,
            description,
            tone: toneStyle,
            availableTones: ["professional", "friendly", "luxury", "minimal"]
        });
    } catch (error) {
        logger.error("[AI DESCRIPTION] Hata:", error.message);
        return res.status(500).json({ success: false, message: "AI açıklama üretme hatası" });
    }
};


