/**
 * marketplaceFinanceEnrichmentService.js
 *
 * Resmi pazaryeri finans API'lerinden sipariş bazlı hak ediş kalemlerini çeker.
 *
 * Trendyol  — Finance CHE API (settlements + otherfinancials + cargo-invoice)
 * Hepsiburada — OMS orders (commission.amount)
 * N11       — delivery/shipmentPackages (commissionRate / commissionAmount)
 * ÇiçekSepeti — Order/GetOrders (commissionRate)
 */

const axios = require("axios");
const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
const { fetchHepsiburadaOrders, fetchN11Orders } = require("./ordersService");
const ciceksepetiService = require("./ciceksepeti/ciceksepetiService");
const logger = require("../config/logger");

const CHUNK_MS = 15 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));
const normOrderNo = (n) => String(n || "").replace(/\D/g, "").trim();

const emptyFinance = () => ({
    grossCredit: 0,
    commission: 0,
    cargo: 0,
    platformFee: 0,
    internationalFee: 0,
    stopaj: 0,
    discount: 0,
    sellerRevenue: 0,
    sources: [],
});

const FINANCE_NUMERIC_KEYS = [
    "grossCredit", "commission", "cargo", "platformFee",
    "internationalFee", "stopaj", "discount", "sellerRevenue",
];

const mergeFinance = (base, patch) => {
    const out = base || emptyFinance();
    for (const k of FINANCE_NUMERIC_KEYS) {
        if (patch[k]) out[k] = round2(out[k] + patch[k]);
    }
    if (patch.sources?.length) {
        out.sources = [...new Set([...(out.sources || []), ...patch.sources])];
    }
    return out;
};

/** Trendyol API Türkçe/İngilizce transactionType eşlemesi */
const isTySale = (tx) => /^sale$|^satış$|^satis$/i.test(String(tx || "").trim());
const isTyReturn = (tx) => /^return$|^iade$/i.test(String(tx || "").trim());
const isTyDiscount = (tx) => /discount|coupon|indirim|kupon|provision/i.test(String(tx || ""));

const categorizeTyDeduction = (rec) => {
    const tx = String(rec.transactionType || rec.description || "").toLowerCase();
    if (/kargo/.test(tx)) return "cargo";
    if (/uluslararası|uluslararasi|international/.test(tx)) return "international";
    if (/platform|hizmet bedeli/.test(tx)) return "platform";
    return "other";
};

const invoiceSerialOf = (rec) =>
    String(rec.id || rec.commissionInvoiceSerialNumber || "").trim();

// ── Trendyol CHE Finance ─────────────────────────────────────────────────────

const getTrendyolAuth = (credentials) => {
    const { sellerId, token: apiToken, apiKey, apiSecret } = credentials || {};
    if (!sellerId) return null;
    let authHeader;
    if (apiToken) {
        authHeader = apiToken.startsWith("Basic ") ? apiToken : "Basic " + apiToken;
    } else if (apiKey && apiSecret) {
        authHeader = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    }
    return authHeader ? { sellerId, authHeader } : null;
};

const fetchTrendyolFinanceChunked = async (auth, startMs, endMs, endpoint, transactionTypes, opts = {}) => {
    const hdrs = { Authorization: auth.authHeader, "Content-Type": "application/json" };
    const baseUrl =
        `https://apigw.trendyol.com/integration/finance/che/sellers/${auth.sellerId}/${endpoint}`;
    let all = [];

    let cur = startMs;
    while (cur < endMs) {
        const chunkEnd = Math.min(cur + CHUNK_MS, endMs);
        for (const txType of transactionTypes) {
            let page = 0;
            let totalPages = 1;
            while (page < totalPages) {
                try {
                    const params = {
                        startDate: cur,
                        endDate: chunkEnd,
                        transactionType: txType,
                        page,
                        size: 500,
                    };
                    if (opts.transactionSubType) params.transactionSubType = opts.transactionSubType;
                    const resp = await axios.get(baseUrl, {
                        headers: hdrs,
                        params,
                        timeout: 30000,
                    });
                    const content = resp.data?.content || [];
                    all = all.concat(content);
                    totalPages = resp.data?.totalPages || 1;
                    page++;
                } catch (e) {
                    if (e.response?.status !== 404) {
                        logger.warn(`[FinanceEnrich] TY ${endpoint}/${txType}: ${e.message}`);
                    }
                    break;
                }
            }
        }
        cur = chunkEnd + 1;
    }
    return all;
};

/** Resmi doküman: DeductionInvoices kaydındaki id = cargo-invoice seri no */
const fetchTyInvoiceItems = async (auth, serial) => {
    const hdrs = { Authorization: auth.authHeader, "Content-Type": "application/json" };
    const base = `https://apigw.trendyol.com/integration/finance/che/sellers/${auth.sellerId}/cargo-invoice`;
    const items = [];
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
        const resp = await axios.get(`${base}/${serial}/items`, {
            headers: hdrs,
            params: { page, size: 500 },
            timeout: 30000,
        });
        items.push(...(resp.data?.content || []));
        totalPages = resp.data?.totalPages || 1;
        page++;
    }
    return items;
};

const aggregateTrendyolSettlements = (records) => {
    const map = new Map();
    for (const rec of records) {
        const key = normOrderNo(rec.orderNumber);
        if (!key) continue;
        const tx = String(rec.transactionType || "");
        const agg = map.get(key) || emptyFinance();

        const comm = Number(rec.commissionAmount) || 0;
        const credit = Number(rec.credit) || 0;
        const debt = Number(rec.debt) || 0;
        const rev = Number(rec.sellerRevenue) || 0;

        if (isTySale(tx)) {
            mergeFinance(agg, {
                grossCredit: credit,
                commission: comm,
                sellerRevenue: rev,
                sources: comm > 0 ? ["ty_settlement_commission"] : [],
            });
            if (rev > 0) agg.sources.push("ty_settlement_revenue");
        } else if (isTyReturn(tx)) {
            mergeFinance(agg, {
                grossCredit: -debt,
                commission: -comm,
                sellerRevenue: rev,
                sources: ["ty_settlement_return"],
            });
        } else if (isTyDiscount(tx)) {
            mergeFinance(agg, { discount: debt || credit, sources: ["ty_settlement_discount"] });
        } else if (/commission/i.test(tx)) {
            mergeFinance(agg, { commission: comm, sources: ["ty_settlement_commission_adj"] });
        } else if (/sellerrevenue|hakediş|hakedis/i.test(tx)) {
            mergeFinance(agg, { sellerRevenue: rev, sources: ["ty_settlement_revenue_adj"] });
        } else {
            mergeFinance(agg, { commission: comm, sellerRevenue: rev, grossCredit: credit - debt });
        }
        map.set(key, agg);
    }
    return map;
};

/**
 * DeductionInvoices (kargo / platform / uluslararası) → cargo-invoice/{id}/items ile sipariş bazlı kesinti
 * Trendyol panelindeki "Kargo Kesintisi", "Platform Hizmet Bedeli", "Uluslararası Hizmet Bedeli"
 */
const fetchTrendyolDeductionsByOrder = async (auth, startMs, endMs) => {
    const map = new Map();
    const deductions = await fetchTrendyolFinanceChunked(
        auth, startMs, endMs, "otherfinancials", ["DeductionInvoices"]
    );

    const serialCategory = new Map();
    for (const d of deductions) {
        const serial = invoiceSerialOf(d);
        if (!serial) continue;
        serialCategory.set(serial, categorizeTyDeduction(d));
    }

    const serials = [...serialCategory.keys()];
    const BATCH = 5;
    for (let i = 0; i < serials.length; i += BATCH) {
        const batch = serials.slice(i, i + BATCH);
        await Promise.all(batch.map(async (serial) => {
            const category = serialCategory.get(serial) || "other";
            if (category === "other") return;
            try {
                const items = await fetchTyInvoiceItems(auth, serial);
                for (const item of items) {
                    const key = normOrderNo(item.orderNumber);
                    if (!key) continue;
                    const amt = Number(item.amount) || 0;
                    if (amt <= 0) continue;
                    const prev = map.get(key) || emptyFinance();
                    if (category === "cargo") {
                        mergeFinance(prev, { cargo: amt, sources: ["ty_cargo_invoice"] });
                    } else if (category === "platform") {
                        mergeFinance(prev, { platformFee: amt, sources: ["ty_platform_fee"] });
                    } else if (category === "international") {
                        mergeFinance(prev, { internationalFee: amt, sources: ["ty_international_fee"] });
                    }
                    map.set(key, prev);
                }
            } catch (e) {
                logger.warn(`[FinanceEnrich] TY fatura detay ${serial} (${category}): ${e.message}`);
            }
        }));
    }

    logger.info(`[FinanceEnrich] TY kesinti faturaları: ${serials.length} fatura, ${map.size} sipariş`);
    return map;
};

/** E-ticaret Stopajı — transactionType=Stoppage (7524 sayılı kanun) */
const fetchTrendyolStopajByOrder = async (auth, startMs, endMs) => {
    const map = new Map();
    const records = await fetchTrendyolFinanceChunked(
        auth, startMs, endMs, "otherfinancials", ["Stoppage"]
    );
    for (const rec of records) {
        const key = normOrderNo(rec.orderNumber);
        if (!key) continue;
        const debt = Number(rec.debt) || 0;
        const credit = Number(rec.credit) || 0;
        const amt = debt > 0 ? debt : credit;
        if (amt <= 0) continue;
        const isCancel = /iptal|cancel/i.test(String(rec.transactionType || rec.description || ""));
        const prev = map.get(key) || emptyFinance();
        mergeFinance(prev, {
            stopaj: isCancel ? -amt : amt,
            sources: ["ty_stoppage"],
        });
        map.set(key, prev);
    }
    return map;
};

const fetchTrendyolOrderFinanceMap = async (userId, start, end) => {
    const map = new Map();
    try {
        const mp = await Marketplace.findOne({ userId, marketplaceName: /^trendyol$/i });
        if (!mp) return map;
        const auth = getTrendyolAuth(mp.credentials ? decryptCredentials(mp.credentials) : null);
        if (!auth) return map;

        const startMs = start.getTime();
        const endMs = end.getTime();

        const settlementTypes = [
            "Sale", "Return", "Discount", "DiscountCancel", "Coupon", "CouponCancel",
            "ProvisionPositive", "ProvisionNegative",
            "SellerRevenuePositive", "SellerRevenueNegative",
            "CommissionPositive", "CommissionNegative",
            "SellerRevenuePositiveCancel", "SellerRevenueNegativeCancel",
            "CommissionPositiveCancel", "CommissionNegativeCancel",
        ];
        const [settlements, deductionMap, stopajMap] = await Promise.all([
            fetchTrendyolFinanceChunked(auth, startMs, endMs, "settlements", settlementTypes),
            fetchTrendyolDeductionsByOrder(auth, startMs, endMs),
            fetchTrendyolStopajByOrder(auth, startMs, endMs),
        ]);
        const settlementMap = aggregateTrendyolSettlements(settlements);

        for (const [key, fin] of settlementMap) map.set(key, fin);
        for (const [key, fin] of deductionMap) map.set(key, mergeFinance(map.get(key), fin));
        for (const [key, fin] of stopajMap) map.set(key, mergeFinance(map.get(key), fin));

        logger.info(
            `[FinanceEnrich] Trendyol: ${map.size} sipariş ` +
            `(settlement:${settlements.length}, kesinti:${deductionMap.size}, stopaj:${stopajMap.size})`
        );
    } catch (err) {
        logger.warn(`[FinanceEnrich] Trendyol hatası: ${err.message}`);
    }
    return map;
};

// ── N11 shipmentPackages ───────────────────────────────────────────────────

const fetchN11OrderFinanceMap = async (userId, start, end) => {
    const map = new Map();
    try {
        const mp = await Marketplace.findOne({ userId, marketplaceName: /^n11$/i });
        if (!mp?.credentials) return map;
        const creds = decryptCredentials(mp.credentials);
        const packages = await fetchN11Orders(creds.apiKey, creds.secretKey, start.getTime(), end.getTime());

        for (const pkg of packages) {
            const lines = pkg.products || [];
            const agg = emptyFinance();

            if (lines.length === 0) {
                const total = Number(pkg.totalPrice) || 0;
                mergeFinance(agg, { grossCredit: total, sellerRevenue: total, sources: ["n11_package"] });
            } else {
                for (const line of lines) {
                    const lineTotal = Number(line.price) || 0;
                    const qty = Number(line.quantity) || 1;
                    const revenue = lineTotal * qty;
                    const commRate = Number(line.commissionRate) || 0;
                    const comm = Number(line.commissionAmount) || (commRate > 0 ? revenue * (commRate / 100) : 0);
                    mergeFinance(agg, {
                        grossCredit: revenue,
                        commission: comm,
                        sellerRevenue: revenue - comm,
                        sources: comm > 0 ? ["n11_commission"] : ["n11_api"],
                    });
                }
            }
            const keys = [
                normOrderNo(pkg.orderNumber),
                normOrderNo(pkg.trackingNumber),
                normOrderNo(pkg.cargoTrackingNumber),
            ].filter(Boolean);
            for (const key of keys) {
                map.set(key, mergeFinance(map.get(key), agg));
            }
        }
        logger.info(`[FinanceEnrich] N11: ${map.size} sipariş`);
    } catch (err) {
        logger.warn(`[FinanceEnrich] N11 hatası: ${err.message}`);
    }
    return map;
};

// ── Hepsiburada OMS ──────────────────────────────────────────────────────────

const fetchHepsiburadaOrderFinanceMap = async (userId, start, end) => {
    const map = new Map();
    try {
        const mp = await Marketplace.findOne({ userId, marketplaceName: /hepsi/i });
        if (!mp?.credentials) return map;
        const creds = decryptCredentials(mp.credentials);
        const { normalizeCredentials } = require("./hepsiburadaService");
        const hb = normalizeCredentials(creds);
        if (!hb.merchantId || !hb.secretKey) return map;

        const orders = await fetchHepsiburadaOrders(
            hb.merchantId, hb.secretKey, start, end, hb.userAgent, hb.useSit
        );

        for (const order of orders) {
            const key = normOrderNo(order.orderNumber || order.trackingNumber);
            if (!key) continue;
            const products = order.products || [];
            const agg = map.get(key) || emptyFinance();

            if (products.length === 0) {
                const total = Number(order.totalPrice) || 0;
                mergeFinance(agg, { grossCredit: total, sellerRevenue: total, sources: ["hb_order"] });
            } else {
                for (const p of products) {
                    const qty = Number(p.quantity) || 1;
                    const unit = Number(p.price) || 0;
                    const revenue = unit * qty;
                    const comm = Number(p.commissionAmount) || 0;
                    mergeFinance(agg, {
                        grossCredit: revenue,
                        commission: comm,
                        sellerRevenue: revenue - comm,
                        sources: comm > 0 ? ["hb_commission"] : ["hb_order"],
                    });
                }
            }
            map.set(key, agg);
            const altKey = normOrderNo(order.trackingNumber || order.cargoTrackingNumber);
            if (altKey && altKey !== key) {
                map.set(altKey, mergeFinance(map.get(altKey), agg));
            }
        }
        logger.info(`[FinanceEnrich] Hepsiburada: ${map.size} sipariş`);
    } catch (err) {
        logger.warn(`[FinanceEnrich] HB hatası: ${err.message}`);
    }
    return map;
};

// ── ÇiçekSepeti GetOrders ────────────────────────────────────────────────────

const fetchCicekSepetiOrderFinanceMap = async (userId, start, end) => {
    const map = new Map();
    try {
        const mp = await Marketplace.findOne({ userId, marketplaceName: "ÇiçekSepeti" });
        if (!mp?.credentials) return map;
        const creds = decryptCredentials(mp.credentials);
        if (!creds.apiKey) return map;

        let cur = start.getTime();
        const endMs = end.getTime();
        const allOrders = [];

        while (cur < endMs) {
            const chunkEnd = Math.min(cur + TWO_WEEKS_MS, endMs);
            let page = 0;
            let hasMore = true;
            while (hasMore) {
                const result = await ciceksepetiService.getOrders(creds, {
                    startDate: new Date(cur).toISOString(),
                    endDate: new Date(chunkEnd).toISOString(),
                    pageSize: 100,
                    page,
                });
                if (!result.success) break;
                const batch = result.orders || [];
                if (!batch.length) { hasMore = false; break; }
                allOrders.push(...batch);
                page++;
                if (batch.length < 100) hasMore = false;
            }
            cur = chunkEnd + 1;
        }

        for (const order of allOrders) {
            const qty = Number(order.quantity) || 1;
            const itemPrice = Number(order.itemPrice || order.totalPrice) || 0;
            const revenue = itemPrice * qty;
            const commRate = Number(order.commissionRate) || 0;
            const comm = commRate > 0 ? revenue * (commRate / 100) : 0;
            const fin = {
                grossCredit: revenue,
                commission: comm,
                sellerRevenue: revenue - comm,
                sources: commRate > 0 ? ["cs_commission_rate"] : ["cs_order"],
            };
            const keys = [
                normOrderNo(order.orderItemId),
                normOrderNo(order.orderId),
            ].filter(Boolean);
            for (const key of keys) {
                map.set(key, mergeFinance(map.get(key), fin));
            }
        }
        logger.info(`[FinanceEnrich] ÇiçekSepeti: ${map.size} sipariş`);
    } catch (err) {
        logger.warn(`[FinanceEnrich] CS hatası: ${err.message}`);
    }
    return map;
};

/**
 * Tüm aktif pazaryerlerinden resmi API ile sipariş bazlı finans haritası çeker.
 * @returns {Promise<{ trendyol: Map, n11: Map, hepsiburada: Map, ciceksepeti: Map }>}
 */
const buildMarketplaceFinanceMaps = async (userId, start, end) => {
    const [trendyol, n11, hepsiburada, ciceksepeti] = await Promise.all([
        fetchTrendyolOrderFinanceMap(userId, start, end),
        fetchN11OrderFinanceMap(userId, start, end),
        fetchHepsiburadaOrderFinanceMap(userId, start, end),
        fetchCicekSepetiOrderFinanceMap(userId, start, end),
    ]);
    return { trendyol, n11, hepsiburada, ciceksepeti };
};

const getFinanceForOrder = (maps, platformKey, orderNo, altNos = []) => {
    if (!maps || !platformKey) return null;
    const platformMap = maps[platformKey];
    if (!platformMap) return null;
    const keys = [orderNo, ...(Array.isArray(altNos) ? altNos : [])]
        .map(normOrderNo)
        .filter(Boolean);
    for (const key of keys) {
        const fin = platformMap.get(key);
        if (fin && (
            fin.commission > 0 || fin.cargo > 0 || fin.platformFee > 0 ||
            fin.internationalFee > 0 || fin.stopaj > 0 ||
            fin.sellerRevenue > 0 || fin.grossCredit > 0
        )) {
            return fin;
        }
    }
    return null;
};

module.exports = {
    buildMarketplaceFinanceMaps,
    getFinanceForOrder,
    normOrderNo,
    fetchTrendyolOrderFinanceMap,
    getTrendyolAuth,
    fetchTrendyolFinanceChunked,
};
