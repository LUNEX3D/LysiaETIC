/**
 * autoOrderController.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════════
 * Otomatik Sipariş İşleme Controller
 *
 * Endpoints:
 *   GET    /api/auto-order/configs              → Kullanıcının tüm config'lerini getir
 *   GET    /api/auto-order/configs/:marketplaceId → Tek config getir
 *   PUT    /api/auto-order/configs/:marketplaceId → Config güncelle (kargo ayarları)
 *   POST   /api/auto-order/process/:marketplaceId → Manuel tetikleme (tek pazaryeri)
 *   POST   /api/auto-order/process-all           → Tüm aktif pazaryerlerini işle
 *   GET    /api/auto-order/cargo-companies/:marketplaceId → Kargo şirketleri listesi
 *   GET    /api/auto-order/status                → Genel durum özeti
 * ═══════════════════════════════════════════════════════════════
 */
const AutoOrderConfig = require("../models/AutoOrderConfig");
const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
const { ok, badRequest, notFound, serverError } = require("../utils/apiResponse");
const { getCargoCompanies, processOrders } = require("../services/autoOrderService");
const logger = require("../config/logger");

// ═══════════════════════════════════════════════════════════════
// 📋 CONFIG CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auto-order/configs
 * Kullanıcının tüm pazaryerleri için auto-order config'lerini getir
 * Eğer config yoksa, her aktif pazaryeri için boş config oluştur
 */
exports.getConfigs = async (req, res) => {
    try {
        const userId = req.user._id;

        // Kullanıcının aktif pazaryerlerini çek
        const marketplaces = await Marketplace.find({ userId, isActive: { $ne: false } }).lean();

        // Mevcut config'leri çek
        const configs = await AutoOrderConfig.find({ user: userId }).lean();
        const configMap = new Map(configs.map(c => [String(c.marketplace), c]));

        // Her pazaryeri için config döndür (yoksa varsayılan)
        const result = marketplaces.map(mp => {
            const existing = configMap.get(String(mp._id));
            if (existing) {
                return {
                    ...existing,
                    marketplaceId: mp._id,
                    marketplaceName: mp.marketplaceName,
                    isActive: mp.isActive !== false
                };
            }
            return {
                _id: null,
                marketplace: mp._id,
                marketplaceId: mp._id,
                marketplaceName: mp.marketplaceName,
                enabled: false,
                primaryCargo: { id: "", name: "" },
                fallbackCargo: { id: "", name: "" },
                stats: { lastRun: null, totalProcessed: 0, totalSuccess: 0, totalFailed: 0, totalFallbackUsed: 0, lastError: "" },
                recentOrders: [],
                isActive: mp.isActive !== false
            };
        });

        return ok(res, "Otomatik sipariş ayarları getirildi", { configs: result });
    } catch (error) {
        logger.error("[AutoOrder] getConfigs hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * GET /api/auto-order/configs/:marketplaceId
 * Tek bir pazaryeri için config getir
 */
exports.getConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplaceId } = req.params;

        const marketplace = await Marketplace.findOne({ _id: marketplaceId, userId }).lean();
        if (!marketplace) return notFound(res, "Pazaryeri bulunamadı");

        let config = await AutoOrderConfig.findOne({ user: userId, marketplace: marketplaceId }).lean();

        if (!config) {
            config = {
                _id: null,
                marketplace: marketplaceId,
                marketplaceId: marketplaceId,
                marketplaceName: marketplace.marketplaceName,
                enabled: false,
                primaryCargo: { id: "", name: "" },
                fallbackCargo: { id: "", name: "" },
                stats: { lastRun: null, totalProcessed: 0, totalSuccess: 0, totalFailed: 0, totalFallbackUsed: 0, lastError: "" },
                recentOrders: []
            };
        } else {
            config.marketplaceId = marketplaceId;
            config.marketplaceName = marketplace.marketplaceName;
        }

        return ok(res, "Config getirildi", { config });
    } catch (error) {
        logger.error("[AutoOrder] getConfig hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * PUT /api/auto-order/configs/:marketplaceId
 * Config güncelle veya oluştur (upsert)
 * Body: { enabled, primaryCargo: { id, name }, fallbackCargo: { id, name } }
 */
exports.updateConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplaceId } = req.params;
        const { enabled, primaryCargo, fallbackCargo } = req.body;

        logger.info(`[AutoOrder] updateConfig çağrıldı — mpId: ${marketplaceId}, body: ${JSON.stringify({ enabled, primaryCargo, fallbackCargo })}`);

        const marketplace = await Marketplace.findOne({ _id: marketplaceId, userId }).lean();
        if (!marketplace) return notFound(res, "Pazaryeri bulunamadı");

        // Enabled açılıyorsa birincil kargo zorunlu
        if (enabled && (!primaryCargo || !primaryCargo.id)) {
            return badRequest(res, "Otomatik işleme açmak için birincil kargo şirketi seçilmelidir");
        }

        // Mevcut config'i bul
        let config = await AutoOrderConfig.findOne({ user: userId, marketplace: marketplace._id });

        if (config) {
            // Güncelle
            if (typeof enabled === "boolean") config.enabled = enabled;
            if (primaryCargo) {
                config.primaryCargo = { id: primaryCargo.id || "", name: primaryCargo.name || "" };
            }
            if (fallbackCargo) {
                config.fallbackCargo = { id: fallbackCargo.id || "", name: fallbackCargo.name || "" };
            }
            config.marketplaceName = marketplace.marketplaceName;
            await config.save();
        } else {
            // Yeni oluştur
            config = new AutoOrderConfig({
                user: userId,
                marketplace: marketplace._id,
                marketplaceName: marketplace.marketplaceName,
                enabled: typeof enabled === "boolean" ? enabled : false,
                primaryCargo: primaryCargo ? { id: primaryCargo.id || "", name: primaryCargo.name || "" } : { id: "", name: "" },
                fallbackCargo: fallbackCargo ? { id: fallbackCargo.id || "", name: fallbackCargo.name || "" } : { id: "", name: "" },
            });
            await config.save();
        }

        logger.info(`[AutoOrder] Config güncellendi — ${marketplace.marketplaceName} | enabled: ${config.enabled} | primary: ${config.primaryCargo?.name} | fallback: ${config.fallbackCargo?.name}`);

        return ok(res, "Ayarlar kaydedildi", { config });
    } catch (error) {
        logger.error(`[AutoOrder] updateConfig hatası: ${error.message}\n${error.stack}`);
        return serverError(res, error);
    }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 SİPARİŞ İŞLEME
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auto-order/process/:marketplaceId
 * Tek bir pazaryeri için siparişleri işle (manuel tetikleme)
 */
exports.processMarketplace = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplaceId } = req.params;

        // Marketplace ve config'i çek
        const marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
        if (!marketplace) return notFound(res, "Pazaryeri bulunamadı");

        const config = await AutoOrderConfig.findOne({ user: userId, marketplace: marketplaceId });
        if (!config || !config.primaryCargo?.id) {
            return badRequest(res, "Önce kargo şirketi ayarlarını yapın");
        }

        const credentials = decryptCredentials(marketplace.credentials);

        // Siparişleri işle
        logger.info(`[AutoOrder] Manuel tetikleme — ${marketplace.marketplaceName}`);
        const result = await processOrders(
            marketplace.marketplaceName,
            credentials,
            config.primaryCargo,
            config.fallbackCargo
        );

        // Config istatistiklerini güncelle
        const updateData = {
            "stats.lastRun": new Date(),
            "stats.lastError": result.failed > 0 ? (result.results.find(r => r.status === "failed")?.error || "") : ""
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
                    $slice: -50 // Son 50 kayıt tut
                }
            }
        });

        return ok(res, `${marketplace.marketplaceName}: ${result.success} sipariş işlendi, ${result.failed} başarısız`, {
            marketplace: marketplace.marketplaceName,
            ...result
        });
    } catch (error) {
        logger.error("[AutoOrder] processMarketplace hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * POST /api/auto-order/process-all
 * Tüm aktif ve enabled pazaryerlerini işle
 */
exports.processAll = async (req, res) => {
    try {
        const userId = req.user._id;

        // Aktif ve enabled config'leri çek
        const configs = await AutoOrderConfig.find({ user: userId, enabled: true });
        if (configs.length === 0) {
            return ok(res, "Otomatik işleme aktif pazaryeri bulunamadı", { results: [] });
        }

        const allResults = [];

        for (const config of configs) {
            try {
                const marketplace = await Marketplace.findOne({ _id: config.marketplace, userId });
                if (!marketplace || marketplace.isActive === false) continue;

                const credentials = decryptCredentials(marketplace.credentials);

                logger.info(`[AutoOrder] Toplu işleme — ${marketplace.marketplaceName}`);
                const result = await processOrders(
                    marketplace.marketplaceName,
                    credentials,
                    config.primaryCargo,
                    config.fallbackCargo
                );

                // Config istatistiklerini güncelle
                const updateData = {
                    "stats.lastRun": new Date(),
                    "stats.lastError": result.failed > 0 ? (result.results.find(r => r.status === "failed")?.error || "") : ""
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

                allResults.push({
                    marketplace: marketplace.marketplaceName,
                    ...result
                });
            } catch (mpErr) {
                logger.error(`[AutoOrder] ${config.marketplaceName} işleme hatası:`, mpErr.message);
                allResults.push({
                    marketplace: config.marketplaceName,
                    processed: 0, success: 0, failed: 0, fallbackUsed: 0,
                    error: mpErr.message
                });
            }
        }

        const totalSuccess = allResults.reduce((s, r) => s + (r.success || 0), 0);
        const totalFailed = allResults.reduce((s, r) => s + (r.failed || 0), 0);

        return ok(res, `Toplam ${totalSuccess} sipariş işlendi, ${totalFailed} başarısız`, { results: allResults });
    } catch (error) {
        logger.error("[AutoOrder] processAll hatası:", error.message);
        return serverError(res, error);
    }
};

// ═══════════════════════════════════════════════════════════════
// 📦 KARGO ŞİRKETLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auto-order/cargo-companies/:marketplaceId
 * Pazaryerine göre kullanılabilir kargo şirketlerini getir
 */
exports.getCargoCompanies = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplaceId } = req.params;

        const marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
        if (!marketplace) return notFound(res, "Pazaryeri bulunamadı");

        const credentials = decryptCredentials(marketplace.credentials);
        const companies = await getCargoCompanies(marketplace.marketplaceName, credentials);

        return ok(res, `${marketplace.marketplaceName} kargo şirketleri`, {
            marketplace: marketplace.marketplaceName,
            companies
        });
    } catch (error) {
        logger.error("[AutoOrder] getCargoCompanies hatası:", error.message);
        return serverError(res, error);
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 DURUM ÖZETİ
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auto-order/status
 * Tüm pazaryerleri için genel durum özeti
 */
exports.getStatus = async (req, res) => {
    try {
        const userId = req.user._id;

        const configs = await AutoOrderConfig.find({ user: userId })
            .select("marketplaceName enabled primaryCargo fallbackCargo stats")
            .lean();

        const marketplaces = await Marketplace.find({ userId, isActive: { $ne: false } })
            .select("marketplaceName")
            .lean();

        const summary = {
            totalMarketplaces: marketplaces.length,
            enabledCount: configs.filter(c => c.enabled).length,
            totalProcessed: configs.reduce((s, c) => s + (c.stats?.totalProcessed || 0), 0),
            totalSuccess: configs.reduce((s, c) => s + (c.stats?.totalSuccess || 0), 0),
            totalFailed: configs.reduce((s, c) => s + (c.stats?.totalFailed || 0), 0),
            totalFallbackUsed: configs.reduce((s, c) => s + (c.stats?.totalFallbackUsed || 0), 0),
            configs: configs.map(c => ({
                marketplaceName: c.marketplaceName,
                enabled: c.enabled,
                primaryCargo: c.primaryCargo?.name || "-",
                fallbackCargo: c.fallbackCargo?.name || "-",
                lastRun: c.stats?.lastRun,
                lastError: c.stats?.lastError || ""
            }))
        };

        return ok(res, "Durum özeti", { summary });
    } catch (error) {
        logger.error("[AutoOrder] getStatus hatası:", error.message);
        return serverError(res, error);
    }
};
