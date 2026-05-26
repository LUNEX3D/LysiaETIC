/**
 * Ana sayfa sipariş modalı — canlı API + DB (24s), hayalet kayıt filtresi
 */

const {
    classifyOrderStatus,
    pickPreferredOrderRecord,
    resolveBestOrderStatus,
    bucketPriority,
    countActiveOrders,
} = require("../utils/orderStatus");
const { isHbInternalId, resolveHepsiburadaOrderNumber } = require("./hepsiburadaService");

const normalizeName = (name = "") => String(name || "").toLowerCase().trim();

const TERMINAL_BUCKETS = new Set(["shipping", "delivered", "cancelled", "returned"]);

const displayMp = (name = "") => {
    const k = normalizeName(name);
    if (k === "trendyol") return "Trendyol";
    if (k === "hepsiburada") return "Hepsiburada";
    if (k === "n11") return "N11";
    if (k === "çiçeksepeti" || k === "ciceksepeti") return "ÇiçekSepeti";
    return String(name || "").trim() || "—";
};

const toRow = (o, marketplaceKey) => {
    const mp = normalizeName(o.marketplaceName || marketplaceKey);
    let orderNumber = String(o.orderNumber || o.trackingNumber || "").trim();
    if (mp.includes("hepsi")) {
        orderNumber = resolveHepsiburadaOrderNumber(o) || orderNumber;
    }
    return {
        orderNumber,
        orderDate: o.orderDate,
        updatedAt: o.updatedAt,
        totalPrice: Number(o.totalPrice || 0),
        status: o.status || "Created",
        marketplaceName: o.marketplaceName || marketplaceKey,
        _id: o._id,
        packageNumber: o.packageNumber || "",
        cargoTrackingNumber: o.cargoTrackingNumber || o.trackingNumber || "",
        shipmentPackageId: o.shipmentPackageId || "",
        cargoTrackingLink: o.cargoTrackingLink || "",
        orderItemId: o.orderItemId || "",
        marketplaceId: o.marketplaceId,
    };
};

const dedupeRows = (rows) => {
    const map = new Map();
    rows.forEach((row) => {
        const mp = normalizeName(row.marketplaceName);
        const orderNo = row.orderNumber;
        if (!mp || !orderNo || isHbInternalId(orderNo)) return;
        const key = `${mp}::${orderNo}`;
        map.set(key, pickPreferredOrderRecord(map.get(key), row));
    });
    return Array.from(map.values());
};

const summarizeForMarketplace = (rows, marketplaceKey) => {
    const unique = dedupeRows(rows);
    const statusGroups = { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 };
    const orderDetails = unique.map((row) => {
        const mp = row.marketplaceName || marketplaceKey;
        const bucket = classifyOrderStatus(row.status, mp);
        if (statusGroups[bucket] !== undefined) statusGroups[bucket]++;
        return {
            orderNumber: row.orderNumber,
            orderDate: row.orderDate,
            totalPrice: row.totalPrice,
            status: row.status,
            statusNormalized: bucket,
            marketplaceName: mp,
            _id: row._id,
            packageNumber: row.packageNumber,
            cargoTrackingNumber: row.cargoTrackingNumber,
            shipmentPackageId: row.shipmentPackageId,
            cargoTrackingLink: row.cargoTrackingLink,
            orderItemId: row.orderItemId,
            marketplaceId: row.marketplaceId,
        };
    });
    const revenue = unique.reduce((s, r) => s + r.totalPrice, 0);
    return {
        orderCount: unique.length,
        revenue,
        statusGroups,
        orderDetails,
        ordersByStatus: orderDetails,
        pending: statusGroups.new + statusGroups.processing,
    };
};

/**
 * DB birleştir — canlı API snapshot varsa yeni/işlemde hayalet DB satırı ekleme
 */
const mergeDbIntoMarketplaceStatus = (marketplaceStatus, dbOrders = [], options = {}) => {
    const { respectLiveSnapshot = true } = options;
    const grouped = new Map();
    dbOrders.forEach((o) => {
        const row = toRow(o, o.marketplaceName);
        const key = normalizeName(row.marketplaceName);
        if (!key || !row.orderNumber || isHbInternalId(row.orderNumber)) return;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    });

    grouped.forEach((dbRows, key) => {
        const prev = marketplaceStatus[key] || {};
        const apiDetails = Array.isArray(prev.orderDetails) ? prev.orderDetails : [];
        const hadLiveSnapshot = respectLiveSnapshot && apiDetails.length > 0;
        const liveOrderIds = new Set(apiDetails.map((o) => String(o.orderNumber || "").trim()).filter(Boolean));

        const mergedMap = new Map();
        apiDetails.forEach((o) => {
            if (o?.orderNumber) mergedMap.set(String(o.orderNumber), toRow(o, key));
        });

        dbRows.forEach((row) => {
            const id = row.orderNumber;
            const existing = mergedMap.get(id);
            if (!existing) {
                const bucket = classifyOrderStatus(row.status, key);
                const isHb = key.includes("hepsi");
                const isCs = key.includes("cicek");
                if (
                    hadLiveSnapshot &&
                    !liveOrderIds.has(id) &&
                    !TERMINAL_BUCKETS.has(bucket) &&
                    ((isHb && (bucket === "new" || bucket === "processing")) ||
                        (isCs && (bucket === "new" || bucket === "processing")))
                ) {
                    return;
                }
                mergedMap.set(id, row);
                return;
            }
            const bestStatus = resolveBestOrderStatus(existing.status, row.status, key);
            const keepRow =
                bucketPriority(row.status, key) > bucketPriority(existing.status, key) ||
                (bucketPriority(row.status, key) === bucketPriority(existing.status, key) &&
                    new Date(row.orderDate || 0) >= new Date(existing.orderDate || 0))
                    ? row
                    : existing;
            mergedMap.set(id, { ...keepRow, status: bestStatus });
        });

        const summary = summarizeForMarketplace(Array.from(mergedMap.values()), key);
        marketplaceStatus[key] = {
            health: prev.health || "healthy",
            status: prev.status || "active",
            orders: summary.orderCount,
            revenue: summary.revenue,
            pendingSync: prev.pendingSync || 0,
            errors: prev.errors || 0,
            stockMismatch: prev.stockMismatch || 0,
            updatedAt: new Date().toISOString(),
            statusGroups: summary.statusGroups,
            ordersByStatus: summary.ordersByStatus,
            orderDetails: summary.orderDetails,
            dataSource: apiDetails.length > 0 ? "live_api+database" : "database",
        };
    });
    return marketplaceStatus;
};

const buildOrdersModalPayload = (marketplaceStatus = {}, marketplaces = []) => {
    const statusCounts = { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 };
    const mpIdByKey = new Map();
    (marketplaces || []).forEach((mp) => {
        const key = normalizeName(mp.marketplaceName);
        if (key) mpIdByKey.set(key, mp._id);
    });
    const all = [];

    Object.entries(marketplaceStatus).forEach(([mpKey, st]) => {
        (st.orderDetails || []).forEach((o) => {
            const mp = o.marketplaceName || mpKey;
            const bucket = o.statusNormalized || classifyOrderStatus(o.status, mp);
            if (statusCounts[bucket] !== undefined) statusCounts[bucket]++;
            all.push({
                orderNumber: o.orderNumber,
                orderDate: o.orderDate,
                totalPrice: o.totalPrice,
                status: o.status,
                statusNormalized: bucket,
                marketplace: displayMp(mp),
                _id: o._id,
                packageNumber: o.packageNumber || "",
                cargoTrackingNumber: o.cargoTrackingNumber || "",
                shipmentPackageId: o.shipmentPackageId || "",
                cargoTrackingLink: o.cargoTrackingLink || "",
                orderItemId: o.orderItemId || "",
                marketplaceId: o.marketplaceId || mpIdByKey.get(normalizeName(mp)) || mpIdByKey.get(mpKey),
            });
        });
    });

    all.sort((a, b) => {
        const ta = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        const tb = b.orderDate ? new Date(b.orderDate).getTime() : 0;
        return tb - ta;
    });

    const byStatus = { all };
    ["new", "processing", "shipping", "delivered", "cancelled", "returned"].forEach((k) => {
        byStatus[k] = all.filter((o) => o.statusNormalized === k);
    });

    const activeOrderCount = countActiveOrders(statusCounts);

    return { total: all.length, activeOrderCount, statusCounts, orders: all, byStatus };
};

const initMarketplaceStatusShells = (marketplaces = []) => {
    const status = {};
    marketplaces.forEach((mp) => {
        const key = normalizeName(mp.marketplaceName);
        if (!key) return;
        status[key] = {
            health: "healthy",
            status: "active",
            orders: 0,
            revenue: 0,
            pendingSync: 0,
            errors: 0,
            stockMismatch: 0,
            updatedAt: new Date().toISOString(),
            statusGroups: { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 },
            ordersByStatus: [],
            orderDetails: [],
            dataSource: "database",
        };
    });
    return status;
};

/** Teslim / iptal / iade — geçmiş sekmeler için (canlıda yok) */
const filterHistoricalPipelineOrders = (orders = []) =>
    orders.filter((o) => {
        const bucket = classifyOrderStatus(o.status, o.marketplaceName);
        return TERMINAL_BUCKETS.has(bucket);
    });

module.exports = {
    normalizeName,
    displayMp,
    toRow,
    dedupeRows,
    summarizeForMarketplace,
    mergeDbIntoMarketplaceStatus,
    buildOrdersModalPayload,
    initMarketplaceStatusShells,
    filterHistoricalPipelineOrders,
};
