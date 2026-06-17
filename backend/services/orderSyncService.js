/**
 * Pazaryeri sipariş senkronizasyonu — controller + cron ortak katmanı
 */

const {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders,
    fetchOzonOrders,
    fetchEbayOrders,
} = require("./ordersService");
const amazonService = require("./amazon/amazonSpApiService");
const Marketplace = require("../models/Marketplace");
const { normalizeMarketplaceName } = Marketplace;
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { marketplaceOrderDateToIsoString } = require("../utils/helpers");

const getIstanbulTimestamp = () =>
    new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();

const CS_MAX_SYNC_DAYS = Math.min(
    90,
    Math.max(7, parseInt(process.env.CS_MAX_SYNC_DAYS || "45", 10) || 45)
);

/** Canlı liste: istenen pencere; sync: genişletilmiş pencere (teslim/kapanmış kaçmasın) */
const resolveCicekSepetiStartMs = (startMs, endMs, { extended = false } = {}) => {
    const end = endMs || Date.now();
    const requested = startMs || end - 14 * 24 * 60 * 60 * 1000;
    if (!extended) {
        const buffer = 2 * 24 * 60 * 60 * 1000;
        const capped = end - CS_MAX_SYNC_DAYS * 24 * 60 * 60 * 1000;
        return Math.max(requested - buffer, capped);
    }
    return Math.min(requested, end - CS_MAX_SYNC_DAYS * 24 * 60 * 60 * 1000);
};

const normalizeFetchResult = (result) => {
    if (Array.isArray(result)) return { orders: result, error: null, authFailed: false };
    if (result && Array.isArray(result.orders)) {
        return {
            orders: result.orders,
            error: result.error || null,
            authFailed: Boolean(result.authFailed),
        };
    }
    return { orders: [], error: null, authFailed: false };
};

const fetchMarketplaceOrders = async (marketplaceName, credentials, startDate, endDate, { csExtended = false } = {}) => {
    switch (normalizeMarketplaceName(marketplaceName)) {
        case "Trendyol":
            return {
                orders: await fetchTrendyolOrders(
                    credentials.sellerId,
                    credentials.apiKey,
                    credentials.apiSecret,
                    startDate,
                    endDate
                ),
            };

        case "Hepsiburada": {
            const { normalizeCredentials: normHb } = require("./hepsiburadaService");
            const hb = normHb(credentials);
            return {
                orders: await fetchHepsiburadaOrders(
                    hb.merchantId,
                    hb.secretKey,
                    startDate,
                    endDate,
                    hb.userAgent,
                    hb.useSit
                ),
            };
        }

        case "N11":
            return {
                orders: await fetchN11Orders(
                    credentials.apiKey,
                    credentials.secretKey,
                    startDate,
                    endDate
                ),
            };

        case "ÇiçekSepeti": {
            const csStart = resolveCicekSepetiStartMs(startDate, endDate, { extended: csExtended });
            return normalizeFetchResult(
                await fetchCicekSepetiOrders(credentials, null, null, csStart, endDate)
            );
        }

        case "Amazon":
        case "Amazon Türkiye":
        case "Amazon Europe":
        case "Amazon USA": {
            try {
                const amazonResult = await amazonService.getAllOrders(credentials, {
                    createdAfter: new Date(startDate).toISOString(),
                    createdBefore: new Date(endDate).toISOString(),
                });
                return {
                    orders: (amazonResult.orders || []).map((order) => ({
                        orderNumber: order.AmazonOrderId,
                        orderDate: marketplaceOrderDateToIsoString(order.PurchaseDate) || order.PurchaseDate,
                        totalPrice: order.OrderTotal?.Amount || "0.00",
                        status: order.OrderStatus,
                        products: [],
                    })),
                };
            } catch (amzErr) {
                return { orders: [], error: amzErr.message };
            }
        }

        case "Ozon":
            return {
                orders: await fetchOzonOrders(
                    credentials.clientId,
                    credentials.apiKey,
                    startDate,
                    endDate,
                    credentials.useSandbox
                ),
            };

        case "eBay":
            return {
                orders: await fetchEbayOrders(
                    credentials.appId,
                    credentials.devId,
                    credentials.certId,
                    credentials.userToken,
                    credentials.siteId || "0",
                    startDate,
                    endDate
                ),
            };

        default:
            return { orders: [], error: "Desteklenmeyen pazaryeri" };
    }
};

const isCiceksepetiMarketplace = (name) => /cicek|çiçek/i.test(String(name || ""));

/**
 * Tek kullanıcı + pazaryeri sync (DB yazımı controller'daki syncOrdersBackground ile)
 * @param {Function} syncOrdersBackground — ordersController'dan enjekte edilir (döngüsel import önlenir)
 */
const syncMarketplaceOrdersForUser = async (userId, rawMp, startDate, endDate, syncOrdersBackground) => {
    const mp = rawMp.toObject ? rawMp.toObject() : rawMp;
    const credentials = decryptCredentials(mp.credentials);
    const marketplaceName = mp.marketplaceName;

    try {
        const { orders, error, authFailed } = await fetchMarketplaceOrders(
            marketplaceName,
            credentials,
            startDate,
            endDate,
            { csExtended: true }
        );

        if (authFailed) {
            return {
                marketplace: marketplaceName,
                fetched: 0,
                synced: 0,
                skipped: 0,
                error: error || "ÇiçekSepeti yetkilendirme hatası",
            };
        }

        const syncResult = await syncOrdersBackground(userId, marketplaceName, orders || []);
        return {
            marketplace: marketplaceName,
            fetched: (orders || []).length,
            synced: syncResult.synced,
            skipped: syncResult.skipped,
            error: error || undefined,
        };
    } catch (mpErr) {
        logger.error("[OrderSync] " + marketplaceName + " hatasi: " + mpErr.message);
        return {
            marketplace: marketplaceName,
            fetched: 0,
            synced: 0,
            skipped: 0,
            error: mpErr.message,
        };
    }
};

/**
 * Tüm aktif pazaryerleri — CS varsa sıralı (rate limit), diğerleri paralel veya sıralı
 */
const syncAllMarketplacesForUser = async (userId, startDate, endDate, syncOrdersBackground, { parallel = false } = {}) => {
    const marketplaces = await Marketplace.find({ userId, isActive: { $ne: false } }).lean();
    if (!marketplaces.length) return [];

    const hasCs = marketplaces.some((m) => isCiceksepetiMarketplace(m.marketplaceName));
    const useParallel = parallel && !hasCs;

    if (useParallel) {
        const settled = await Promise.allSettled(
            marketplaces.map((rawMp) =>
                syncMarketplaceOrdersForUser(userId, rawMp, startDate, endDate, syncOrdersBackground)
            )
        );
        return settled.map((r, idx) => {
            if (r.status === "fulfilled" && r.value) return r.value;
            const name = marketplaces[idx]?.marketplaceName || "unknown";
            return {
                marketplace: name,
                fetched: 0,
                synced: 0,
                skipped: 0,
                error: r.status === "rejected" ? r.reason?.message : "Sync başarısız",
            };
        });
    }

    const results = [];
    for (const rawMp of marketplaces) {
        const row = await syncMarketplaceOrdersForUser(
            userId,
            rawMp,
            startDate,
            endDate,
            syncOrdersBackground
        );
        if (row) results.push(row);
    }
    return results;
};

/** Tüm kullanıcılar — arka plan cron */
const syncRecentOrdersForAllUsers = async (syncOrdersBackground, { windowDays = 7 } = {}) => {
    const now = getIstanbulTimestamp();
    const startDate = now - windowDays * 24 * 60 * 60 * 1000;
    const endDate = now;

    const userIds = await Marketplace.distinct("userId", { isActive: { $ne: false } });
    let totalSynced = 0;

    for (const userId of userIds) {
        try {
            const results = await syncAllMarketplacesForUser(
                userId,
                startDate,
                endDate,
                syncOrdersBackground,
                { parallel: false }
            );
            const userSynced = results.reduce((s, r) => s + (r.synced || 0), 0);
            totalSynced += userSynced;
            if (userSynced > 0) {
                try {
                    const { invalidateDashboardCache } = require("./dashboardService");
                    invalidateDashboardCache(userId);
                } catch (_) { /* optional */ }
            }
        } catch (err) {
            logger.warn(`[OrderSync Cron] userId=${userId} hata: ${err.message}`);
        }
    }

    return { users: userIds.length, totalSynced };
};

module.exports = {
    getIstanbulTimestamp,
    resolveCicekSepetiStartMs,
    fetchMarketplaceOrders,
    syncMarketplaceOrdersForUser,
    syncAllMarketplacesForUser,
    syncRecentOrdersForAllUsers,
    isCiceksepetiMarketplace,
};
