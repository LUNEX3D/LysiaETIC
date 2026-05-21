const logger = require("../config/logger");
const Marketplace = require("../models/Marketplace");
const Order = require("../models/Order");
const { decryptCredentials } = require("../utils/encryption");
const { getProductProfitAnalysis } = require("../services/financeProfitService");
const { fetchHepsiburadaOrders } = require("../services/ordersService");
const ciceksepetiService = require("../services/ciceksepeti/ciceksepetiService");
const axios = require("axios");


// --- Helpers ---

const toTimestamp = (val) => {
    if (!val) return null;
    const n = typeof val === "string" ? parseInt(val, 10) : val;
    if (!isNaN(n) && n > 1e12) return n;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.getTime();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const isReturnStatus = (status = "") => /cancel|return|refund|iptal|iade/i.test(String(status));

const filterSettlementsInRange = (settlements, start, end) =>
    settlements.filter((s) => {
        const t = new Date(s.transactionDate).getTime();
        return !Number.isNaN(t) && t >= start && t <= end;
    });

const buildSettlementRow = ({
    id, orderNumber, transactionDate, barcode, productName,
    lineTotal, commissionAmount = 0, commissionRate = 0, isReturn = false,
}) => ({
    id: String(id),
    transactionDate,
    barcode: barcode || "-",
    transactionType: isReturn ? "Return" : "Sale",
    description: isReturn ? "Iade" : "Satis",
    debt: isReturn ? lineTotal : 0,
    credit: isReturn ? 0 : lineTotal,
    commissionRate,
    commissionAmount,
    sellerRevenue: isReturn ? -(lineTotal - commissionAmount) : (lineTotal - commissionAmount),
    orderNumber: String(orderNumber || ""),
    paymentDate: null,
    productName: productName || "",
});

const hepsiburadaOrdersToSettlements = (orders = []) => {
    const settlements = [];
    orders.forEach((order) => {
        const orderNum = order.orderNumber || order.id || "hb";
        const txDate = order.orderDate || order.createdDate;
        const isReturn = isReturnStatus(order.status);
        const products = Array.isArray(order.products) ? order.products : [];

        if (products.length === 0) {
            const lineTotal = Number(order.totalPrice) || 0;
            if (lineTotal <= 0) return;
            settlements.push(buildSettlementRow({
                id: `${orderNum}-0`,
                orderNumber: orderNum,
                transactionDate: txDate,
                lineTotal,
                isReturn,
            }));
            return;
        }

        products.forEach((p, idx) => {
            const qty = Number(p.quantity || 1);
            const unit = Number(p.price) || 0;
            const lineTotal = unit > 0 && qty > 1 ? unit * qty : (unit || Number(order.totalPrice) || 0);
            if (lineTotal <= 0) return;
            const commissionAmount = Number(p.commissionAmount || 0);
            settlements.push(buildSettlementRow({
                id: `${orderNum}-${idx}`,
                orderNumber: orderNum,
                transactionDate: txDate,
                barcode: p.barcode || p.sku || "",
                productName: p.productName || p.name || "",
                lineTotal,
                commissionAmount,
                isReturn,
            }));
        });
    });
    return settlements;
};

const cicekSepetiOrderToSettlement = (order) => {
    const totalPrice = Number(order.totalPrice || order.itemPrice || 0);
    const itemPrice = Number(order.itemPrice || order.totalPrice || 0);
    const quantity = Number(order.quantity || 1);
    const lineTotal = itemPrice * quantity || totalPrice;
    if (lineTotal <= 0) return null;

    const commissionRate = Number(order.commissionRate || 0);
    const commissionAmount = commissionRate > 0 ? lineTotal * (commissionRate / 100) : 0;
    const status = String(order.orderProductStatus || order.status || "");
    const isReturn = isReturnStatus(status);

    let transactionDate = null;
    if (order.orderCreateDate && order.orderCreateTime) {
        const parts = String(order.orderCreateDate).split(/[./]/);
        if (parts.length === 3) {
            const pad = (x) => String(x).padStart(2, "0");
            const tStr = String(order.orderCreateTime).trim();
            transactionDate = `${parts[2]}-${pad(parts[1])}-${pad(parts[0])}T${tStr.length === 5 ? `${tStr}:00` : tStr}`;
        } else {
            transactionDate = `${order.orderCreateDate} ${order.orderCreateTime}`;
        }
    } else {
        transactionDate = order.orderDate || order.orderCreateDate || order.createdDate;
    }

    return buildSettlementRow({
        id: order.orderItemId || order.orderId || order.orderNo,
        orderNumber: order.orderId || order.orderNo || order.orderNumber,
        transactionDate,
        barcode: order.barcode || order.productCode || order.code || order.stockCode,
        productName: order.name || order.productName,
        lineTotal,
        commissionRate,
        commissionAmount,
        isReturn,
    });
};

const settlementsFromDbOrders = async (userId, marketplaceName, start, end) => {
    const escaped = String(marketplaceName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const orders = await Order.find({
        user: userId,
        marketplaceName: new RegExp(`^${escaped}$`, "i"),
        orderDate: { $gte: new Date(start), $lte: new Date(end) },
    })
        .select("totalPrice orderDate status orderNumber items trackingNumber")
        .lean();

    const settlements = [];
    orders.forEach((order) => {
        const isReturn = isReturnStatus(order.status) || order.isReturned || order.isCancelled;
        const items = Array.isArray(order.items) ? order.items : [];
        if (items.length === 0) {
            const lineTotal = Number(order.totalPrice) || 0;
            if (lineTotal <= 0) return;
            settlements.push(buildSettlementRow({
                id: `${order.orderNumber || order._id}-0`,
                orderNumber: order.orderNumber || order.trackingNumber,
                transactionDate: order.orderDate,
                lineTotal,
                isReturn,
            }));
            return;
        }
        items.forEach((item, idx) => {
            const qty = Number(item.quantity || 1);
            const lineTotal = (Number(item.price) || 0) * qty;
            if (lineTotal <= 0) return;
            settlements.push(buildSettlementRow({
                id: `${order.orderNumber || order._id}-${idx}`,
                orderNumber: order.orderNumber,
                transactionDate: order.orderDate,
                barcode: item.barcode || item.sku,
                productName: item.productName,
                lineTotal,
                commissionAmount: Number(item.commissionAmount || 0),
                commissionRate: Number(item.commissionRate || 0),
                isReturn,
            }));
        });
    });
    return settlements;
};

const getMarketplaceDecrypted = async (userId, marketplaceId, marketplaceName) => {
    let mp;
    if (marketplaceId) {
        mp = await Marketplace.findOne({ _id: marketplaceId, userId });
    } else if (marketplaceName) {
        mp = await Marketplace.findOne({ userId, marketplaceName: new RegExp("^" + marketplaceName + "$", "i") });
    }
    if (!mp) return null;
    const obj = mp.toObject();
    if (obj.credentials) obj.credentials = decryptCredentials(obj.credentials);
    return obj;
};

const getTrendyolAuth = (credentials) => {
    const { sellerId, token: apiToken, apiKey, apiSecret } = credentials || {};
    if (!sellerId) return null;
    let authHeader;
    if (apiToken) {
        authHeader = apiToken.startsWith("Basic ") ? apiToken : "Basic " + apiToken;
    } else if (apiKey && apiSecret) {
        authHeader = "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64");
    }
    return authHeader ? { sellerId, authHeader } : null;
};

// --- Trendyol: Tum transaction type'lari icin chunk'li veri cekme ---

const TRENDYOL_SETTLEMENT_TYPES = ["Sale", "Return", "Discount", "DiscountCancel", "Coupon", "CouponCancel", "ProvisionPositive", "ProvisionNegative"];
const TRENDYOL_OTHER_TYPES = ["PaymentOrder", "DeductionInvoices", "CashAdvance", "WireTransfer", "IncomingTransfer", "ReturnInvoice", "CommissionAgreementInvoice"];
const CHUNK_MS = 15 * 24 * 60 * 60 * 1000; // 15 gun (Trendyol API limiti)

/**
 * Trendyol settlements/otherfinancials icin 15 gunluk chunk'lar halinde
 * ve her chunk icin tum transactionType'lari paralel cekerek veri toplar.
 */
const fetchTrendyolFinanceData = async (auth, start, end, endpoint, transactionTypes) => {
    const hdrs = { Authorization: auth.authHeader, "Content-Type": "application/json" };
    const baseUrl = "https://apigw.trendyol.com/integration/finance/che/sellers/" + auth.sellerId + "/" + endpoint;
    let allData = [];

    let cur = start;
    while (cur < end) {
        const chunkEnd = Math.min(cur + CHUNK_MS, end);

        // Her transactionType icin paralel istek at
        const promises = transactionTypes.map(async (txType) => {
            try {
                let page = 0;
                let totalPages = 1;
                let chunkData = [];

                while (page < totalPages) {
                    const resp = await axios.get(baseUrl, {
                        headers: hdrs,
                        params: {
                            startDate: cur,
                            endDate: chunkEnd,
                            transactionType: txType,
                            page,
                            size: 500
                        },
                        timeout: 30000
                    });

                    if (resp.data && resp.data.content) {
                        chunkData = chunkData.concat(resp.data.content);
                        totalPages = resp.data.totalPages || 1;
                    }
                    page++;
                }

                return chunkData;
            } catch (e) {
                // 404 = o tip icin veri yok, normal durum
                if (e.response?.status !== 404) {
                    logger.warn("[Finance] Trendyol " + endpoint + " chunk hatasi (" + txType + "): " + e.message);
                }
                return [];
            }
        });

        const results = await Promise.all(promises);
        results.forEach(function(r) { allData = allData.concat(r); });

        cur = chunkEnd + 1;
    }

    return allData;
};

// --- 1. Trendyol Settlements ---

exports.getTrendyolSettlements = async (req, res) => {
    try {
        const userId = req.user._id;
        const { transactionType, startDate, endDate, page = 0, size = 500, marketplaceId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "startDate ve endDate zorunludur." });
        }

        const start = toTimestamp(startDate);
        const end = toTimestamp(endDate);
        if (!start || !end) return res.status(400).json({ success: false, message: "Gecersiz tarih formati." });

        const mp = await getMarketplaceDecrypted(userId, marketplaceId, "Trendyol");
        if (!mp) return res.status(404).json({ success: false, message: "Trendyol entegrasyonu bulunamadi." });

        const auth = getTrendyolAuth(mp.credentials);
        if (!auth) return res.status(400).json({ success: false, message: "Trendyol API kimlik bilgileri eksik." });

        const url = "https://apigw.trendyol.com/integration/finance/che/sellers/" + auth.sellerId + "/settlements";
        const params = { startDate: start, endDate: end, page, size };
        if (transactionType) params.transactionType = transactionType;
        else params.transactionType = "Sale"; // Default: Sale (Trendyol zorunlu kilar)

        const { data } = await axios.get(url, {
            headers: { Authorization: auth.authHeader, "Content-Type": "application/json" },
            params,
            timeout: 30000
        });

        logger.info("[Finance] Trendyol settlements cekildi - " + (data?.content?.length || 0) + " kayit");
        res.json({ success: true, data });
    } catch (err) {
        logger.error("[Finance] Trendyol settlements hatasi:", err.message);
        res.status(err.response?.status || 500).json({ success: false, message: err.message });
    }
};

// --- 2. Trendyol Other Financials ---

exports.getTrendyolOtherFinancials = async (req, res) => {
    try {
        const userId = req.user._id;
        const { transactionType, startDate, endDate, page = 0, size = 500, marketplaceId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "startDate ve endDate zorunludur." });
        }

        const start = toTimestamp(startDate);
        const end = toTimestamp(endDate);
        if (!start || !end) return res.status(400).json({ success: false, message: "Gecersiz tarih formati." });

        const mp = await getMarketplaceDecrypted(userId, marketplaceId, "Trendyol");
        if (!mp) return res.status(404).json({ success: false, message: "Trendyol entegrasyonu bulunamadi." });

        const auth = getTrendyolAuth(mp.credentials);
        if (!auth) return res.status(400).json({ success: false, message: "Trendyol API kimlik bilgileri eksik." });

        const url = "https://apigw.trendyol.com/integration/finance/che/sellers/" + auth.sellerId + "/otherfinancials";
        const params = { startDate: start, endDate: end, page, size };
        if (transactionType) params.transactionType = transactionType;
        else params.transactionType = "PaymentOrder"; // Default (Trendyol zorunlu kilar)

        const { data } = await axios.get(url, {
            headers: { Authorization: auth.authHeader, "Content-Type": "application/json" },
            params,
            timeout: 30000
        });

        logger.info("[Finance] Trendyol otherfinancials cekildi - " + (data?.content?.length || 0) + " kayit");
        res.json({ success: true, data });
    } catch (err) {
        logger.error("[Finance] Trendyol otherfinancials hatasi:", err.message);
        res.status(err.response?.status || 500).json({ success: false, message: err.message });
    }
};

// --- 3. Trendyol Cargo Invoice Items ---

exports.getTrendyolCargoInvoiceItems = async (req, res) => {
    try {
        const userId = req.user._id;
        const { invoiceSerialNumber, marketplaceId } = req.query;

        if (!invoiceSerialNumber) {
            return res.status(400).json({ success: false, message: "invoiceSerialNumber zorunludur." });
        }

        const mp = await getMarketplaceDecrypted(userId, marketplaceId, "Trendyol");
        if (!mp) return res.status(404).json({ success: false, message: "Trendyol entegrasyonu bulunamadi." });

        const auth = getTrendyolAuth(mp.credentials);
        if (!auth) return res.status(400).json({ success: false, message: "Trendyol API kimlik bilgileri eksik." });

        const url = "https://apigw.trendyol.com/integration/finance/che/sellers/" + auth.sellerId + "/cargo-invoice/" + invoiceSerialNumber + "/items";
        const { data } = await axios.get(url, {
            headers: { Authorization: auth.authHeader, "Content-Type": "application/json" },
            timeout: 30000
        });

        res.json({ success: true, data });
    } catch (err) {
        logger.error("[Finance] Kargo faturasi hatasi:", err.message);
        res.status(err.response?.status || 500).json({ success: false, message: err.message });
    }
};

// --- 4. Ürün bazlı kâr/zarar (sipariş + maliyet + komisyon + kargo + paketleme) ---

exports.getProductProfitAnalysis = async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate, marketplaceId, sortBy, limit } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "startDate ve endDate zorunludur." });
        }

        const start = new Date(Number(startDate) || startDate);
        const end = new Date(Number(endDate) || endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: "Gecersiz tarih formati." });
        }
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        const data = await getProductProfitAnalysis(userId, start, end, {
            marketplaceId,
            sortBy,
            limit,
        });

        res.json({ success: true, data });
    } catch (err) {
        logger.error("[Finance] Product profit analysis hatasi:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- 5. Unified Finance Summary (tek marketplace veya tumu) ---

exports.getFinanceSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate, marketplaceId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "startDate ve endDate zorunludur." });
        }

        const start = toTimestamp(startDate);
        const end = toTimestamp(endDate);
        if (!start || !end) return res.status(400).json({ success: false, message: "Gecersiz tarih formati." });

        // Eger marketplaceId verilmisse sadece o marketplace'i cek
        let marketplaces;
        if (marketplaceId) {
            const single = await Marketplace.findOne({ _id: marketplaceId, userId });
            marketplaces = single ? [single] : [];
        } else {
            marketplaces = await Marketplace.find({ userId });
        }

        if (marketplaces.length === 0) {
            return res.json({ success: true, data: {} });
        }

        const results = {};

        for (const rawMp of marketplaces) {
            const mp = rawMp.toObject();
            if (mp.credentials) mp.credentials = decryptCredentials(mp.credentials);
            const name = mp.marketplaceName;

            try {
                if (/trendyol/i.test(name)) {
                    const auth = getTrendyolAuth(mp.credentials);
                    if (!auth) {
                        results[name] = { marketplaceId: mp._id, marketplaceName: name, settlements: [], otherFinancials: [], supported: false, message: "API kimlik bilgileri eksik." };
                        continue;
                    }

                    // Settlements — tum transaction type'lari paralel cek
                    const allSettlements = await fetchTrendyolFinanceData(auth, start, end, "settlements", TRENDYOL_SETTLEMENT_TYPES);

                    // Other financials — tum transaction type'lari paralel cek
                    const allOthers = await fetchTrendyolFinanceData(auth, start, end, "otherfinancials", TRENDYOL_OTHER_TYPES);

                    logger.info("[Finance] Trendyol verileri cekildi - settlements: " + allSettlements.length + ", others: " + allOthers.length);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, settlements: allSettlements, otherFinancials: allOthers, supported: true };

                } else if (/hepsiburada/i.test(name)) {
                    const hbFinance = await fetchHepsiburadaFinance(mp, start, end, userId);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, ...hbFinance, supported: hbFinance.supported !== false };

                } else if (/n11/i.test(name)) {
                    const n11Finance = await fetchN11Finance(mp, start, end);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, ...n11Finance, supported: n11Finance.supported !== false };

                } else if (/[cç]i[cç]eksepeti/i.test(name)) {
                    const csFinance = await fetchCicekSepetiFinance(mp, start, end, userId);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, ...csFinance, supported: csFinance.supported !== false };

                } else if (/amazon/i.test(name)) {
                    const amzFinance = await fetchAmazonFinance(mp, start, end);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, ...amzFinance, supported: amzFinance.supported !== false };

                } else {
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, settlements: [], otherFinancials: [], supported: false, message: name + " finans API henuz desteklenmiyor." };
                }
            } catch (mpErr) {
                logger.error("[Finance] " + name + " hatasi: " + mpErr.message);
                results[name] = { marketplaceId: mp._id, marketplaceName: name, settlements: [], otherFinancials: [], supported: false, error: mpErr.message };
            }
        }

        logger.info("[Finance] Summary cekildi - " + Object.keys(results).length + " marketplace");
        res.json({ success: true, data: results });
    } catch (err) {
        logger.error("[Finance] Summary hatasi:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════
// HEPSIBURADA — Siparis bazli finans hesaplama
// Endpoint: oms-external.hepsiburada.com/orders/merchantid/{merchantId}
// Auth: Basic base64(merchantId:secretKey)
// Credentials: { merchantId, secretKey, userAgent }
// ═══════════════════════════════════════════════════════════════════════

const fetchHepsiburadaFinance = async (mp, start, end, userId) => {
    try {
        const { normalizeCredentials } = require("../services/hepsiburadaService");
        const hbCreds = normalizeCredentials(mp.credentials);
        const { merchantId, secretKey, userAgent, useSit } = hbCreds;

        if (!merchantId || !secretKey) {
            return { settlements: [], otherFinancials: [], supported: false, message: "Hepsiburada API kimlik bilgileri eksik (merchantId + secretKey gerekli)." };
        }

        let settlements = [];
        let source = "api";

        try {
            const orders = await fetchHepsiburadaOrders(
                merchantId,
                secretKey,
                start,
                end,
                userAgent,
                !!useSit
            );
            settlements = filterSettlementsInRange(
                hepsiburadaOrdersToSettlements(orders),
                start,
                end
            );
        } catch (apiErr) {
            logger.warn("[Finance] Hepsiburada API: " + apiErr.message);
        }

        if (settlements.length === 0 && userId) {
            settlements = await settlementsFromDbOrders(userId, mp.marketplaceName || "Hepsiburada", start, end);
            if (settlements.length > 0) source = "database";
        }

        logger.info("[Finance] Hepsiburada — " + settlements.length + " islem (kaynak: " + source + ")");
        return { settlements, otherFinancials: [], source };
    } catch (err) {
        logger.error("[Finance] Hepsiburada finans hatasi: " + err.message);
        return { settlements: [], otherFinancials: [], supported: false, error: err.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// N11 — Siparis bazli finans hesaplama
// Endpoint: api.n11.com/rest/delivery/v1/shipmentPackages
// Auth: Headers — appkey + appsecret
// Credentials: { apiKey, secretKey }
// N11 response: content[].lines[].sellerInvoiceAmount, grossAmount
// ═══════════════════════════════════════════════════════════════════════

const fetchN11Finance = async (mp, start, end) => {
    try {
        const { apiKey, secretKey } = mp.credentials || {};
        const aKey = apiKey;
        const sKey = secretKey;

        if (!aKey || !sKey) {
            return { settlements: [], otherFinancials: [], supported: false, message: "N11 API kimlik bilgileri eksik (apiKey + secretKey gerekli)." };
        }

        const cleanAscii = function(str) { return String(str || "").replace(/[^\x20-\x7E]/g, ""); };
        const headers = {
            appkey: cleanAscii(aKey),
            appsecret: cleanAscii(sKey),
            "Content-Type": "application/json",
            "User-Agent": "LysiaETIC"
        };

        // N11 tarih formati: timestamp (ordersService.js ile ayni)
        // ordersService.js'de direkt timestamp kullaniliyor: ?startDate=${startDate}
        const startDate = start; // zaten timestamp
        const endDate = end;     // zaten timestamp

        // N11 status parametresi tek deger alir — her status icin ayri istek
        const statuses = ["New", "Approved", "Rejected", "Shipped", "Delivered", "Completed"];
        let allPackages = [];

        for (const status of statuses) {
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                try {
                    // ordersService.js ile ayni URL yapisi
                    const url = "https://api.n11.com/rest/delivery/v1/shipmentPackages" +
                        "?startDate=" + startDate +
                        "&endDate=" + endDate +
                        "&status=" + status +
                        "&page=" + page +
                        "&size=100" +
                        "&orderByDirection=DESC" +
                        "&orderByField=true";

                    const resp = await axios.get(url, {
                        headers: headers,
                        timeout: 20000
                    });

                    const packages = resp.data?.content || [];
                    if (packages.length === 0) {
                        hasMore = false;
                    } else {
                        allPackages = allPackages.concat(packages);
                        page++;
                        if (packages.length < 100) hasMore = false;
                        // N11 totalPages kontrolu
                        const totalPages = resp.data?.totalPages || 1;
                        if (page >= totalPages) hasMore = false;
                    }
                } catch (e) {
                    if (e.response?.status === 401 || e.response?.status === 403) {
                        logger.error("[Finance] N11 auth hatasi: " + e.message);
                        return { settlements: [], otherFinancials: [], supported: false, message: "N11 API kimlik bilgileri gecersiz." };
                    }
                    if (e.response?.status !== 404 && e.response?.status !== 400) {
                        logger.warn("[Finance] N11 siparis cekme hatasi (" + status + "): " + e.message);
                    }
                    hasMore = false;
                }
            }
        }

        // Tekrar eden paketleri temizle (orderNumber bazli)
        const uniqueMap = new Map();
        allPackages.forEach(function(pkg) {
            const key = pkg.orderNumber || pkg.id;
            if (key && !uniqueMap.has(key)) uniqueMap.set(key, pkg);
        });
        const uniquePackages = Array.from(uniqueMap.values());

        // Paketleri settlement formatina donustur
        // N11 response yapisi: { orderNumber, shipmentPackageStatus, grossAmount, lines: [{ sellerInvoiceAmount, ... }] }
        const settlements = [];
        uniquePackages.forEach(function(pkg) {
            const lines = pkg.lines || [];
            const pkgStatus = String(pkg.shipmentPackageStatus || pkg.status || "").toLowerCase();
            const isReturn = /reject|cancel|return|iade|iptal/i.test(pkgStatus);
            const orderDate = pkg.packageHistories && pkg.packageHistories.length > 0
                ? pkg.packageHistories[0].createdDate
                : pkg.orderDate || pkg.createdDate;

            if (lines.length > 0) {
                lines.forEach(function(line) {
                    const totalPrice = Number(line.sellerInvoiceAmount || line.grossAmount || line.totalPrice || line.price || 0);
                    const commissionRate = Number(line.commissionRate || 0);
                    const commissionAmount = commissionRate > 0 ? totalPrice * (commissionRate / 100) : Number(line.commissionAmount || 0);

                    settlements.push({
                        id: (pkg.orderNumber || pkg.id) + "-" + (line.id || line.orderLineId || "0"),
                        transactionDate: orderDate,
                        barcode: line.barcode || line.stockCode || line.sku || line.productSellerCode || "-",
                        transactionType: isReturn ? "Return" : "Sale",
                        description: isReturn ? "Iade" : "Satis",
                        debt: isReturn ? totalPrice : 0,
                        credit: isReturn ? 0 : totalPrice,
                        commissionRate: commissionRate,
                        commissionAmount: commissionAmount,
                        sellerRevenue: isReturn ? -(totalPrice - commissionAmount) : (totalPrice - commissionAmount),
                        orderNumber: pkg.orderNumber || pkg.id,
                        paymentDate: null,
                        productName: line.productName || line.title || ""
                    });
                });
            } else {
                // lines bos ise paket seviyesinde kayit olustur
                const totalPrice = Number(pkg.grossAmount || pkg.totalPrice || 0);
                settlements.push({
                    id: pkg.orderNumber || pkg.id,
                    transactionDate: orderDate,
                    barcode: "-",
                    transactionType: isReturn ? "Return" : "Sale",
                    description: isReturn ? "Iade" : "Satis",
                    debt: isReturn ? totalPrice : 0,
                    credit: isReturn ? 0 : totalPrice,
                    commissionRate: 0,
                    commissionAmount: 0,
                    sellerRevenue: isReturn ? -totalPrice : totalPrice,
                    orderNumber: pkg.orderNumber || pkg.id,
                    paymentDate: null,
                    productName: ""
                });
            }
        });

        logger.info("[Finance] N11 verileri cekildi - " + settlements.length + " islem (" + uniquePackages.length + " paket)");
        return { settlements: settlements, otherFinancials: [] };
    } catch (err) {
        logger.error("[Finance] N11 finans hatasi: " + err.message);
        return { settlements: [], otherFinancials: [], supported: false, error: err.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// CICEKSEPETI — Siparis bazli finans hesaplama
// Endpoint: POST apis.ciceksepeti.com/api/v1/Order/GetOrders
// Auth: x-api-key header + user-agent (SaticiID - EntegratorAdi)
// Credentials: { apiKey, sellerId, integratorName }
// Max 2 hafta tarih araligi, ayni parametrelerle dakikada 1 istek
// Response: { supplierOrderListWithBranch: [...], orderListCount }
// Order fields: orderId, orderCreateDate, orderCreateTime, totalPrice,
//   itemPrice, orderProductStatus, name, barcode, quantity, productCode
// ═══════════════════════════════════════════════════════════════════════

const fetchCicekSepetiFinance = async (mp, start, end, userId) => {
    try {
        const { apiKey, sellerId, integratorName, isTestMode } = mp.credentials || {};

        if (!apiKey) {
            return { settlements: [], otherFinancials: [], supported: false, message: "CicekSepeti API kimlik bilgileri eksik (apiKey gerekli)." };
        }

        const creds = { apiKey, sellerId, integratorName, isTestMode: !!isTestMode };
        let allOrders = [];
        let curStart = start;

        while (curStart < end) {
            const chunkEnd = Math.min(curStart + TWO_WEEKS_MS, end);
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const result = await ciceksepetiService.getOrders(creds, {
                    startDate: new Date(curStart).toISOString(),
                    endDate: new Date(chunkEnd).toISOString(),
                    pageSize: 100,
                    page,
                });

                if (!result.success) {
                    if (/gecersiz|invalid|401|unauthorized/i.test(String(result.error || ""))) {
                        return { settlements: [], otherFinancials: [], supported: false, message: "CicekSepeti API Key gecersiz." };
                    }
                    logger.warn("[Finance] CicekSepeti: " + (result.error || "bilinmeyen hata"));
                    hasMore = false;
                    break;
                }

                const orders = result.orders || [];
                if (orders.length === 0) {
                    hasMore = false;
                } else {
                    allOrders = allOrders.concat(orders);
                    page += 1;
                    if (orders.length < 100) hasMore = false;
                    else await sleep(5000);
                }
            }

            curStart = chunkEnd + 1;
            if (curStart < end) await sleep(5000);
        }

        let settlements = filterSettlementsInRange(
            allOrders.map(cicekSepetiOrderToSettlement).filter(Boolean),
            start,
            end
        );

        let source = "api";
        if (settlements.length === 0 && userId) {
            settlements = await settlementsFromDbOrders(userId, mp.marketplaceName || "ÇiçekSepeti", start, end);
            if (settlements.length > 0) source = "database";
        }

        logger.info("[Finance] CicekSepeti — " + settlements.length + " islem (kaynak: " + source + ")");
        return { settlements, otherFinancials: [], source };
    } catch (err) {
        logger.error("[Finance] CicekSepeti finans hatasi: " + err.message);
        return { settlements: [], otherFinancials: [], supported: false, error: err.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// AMAZON — Siparis bazli finans hesaplama
// SP-API: /orders/v0/orders
// Credentials: { marketplaceId, refreshToken, clientId, clientSecret,
//                accessKeyId, secretAccessKey, sessionToken }
// ═══════════════════════════════════════════════════════════════════════

const fetchAmazonFinance = async (mp, start, end) => {
    try {
        const {
            normalizeAmazonCredentials,
            validateAmazonCredentials
        } = require("../services/amazon/amazonCredentialService");
        const amazonSpApi = require("../services/amazon/amazonSpApiService");

        const creds = normalizeAmazonCredentials(mp.credentials, mp.marketplaceName);
        const validation = validateAmazonCredentials(creds);
        if (!validation.valid) {
            return {
                settlements: [],
                otherFinancials: [],
                supported: false,
                message: validation.message
            };
        }

        const createdAfter = new Date(start).toISOString();
        const createdBefore = new Date(end).toISOString();

        const result = await amazonSpApi.getAllOrders(creds, { createdAfter, createdBefore });
        if (!result.success) {
            return {
                settlements: [],
                otherFinancials: [],
                supported: false,
                message: result.error || "Amazon sipariş verisi alınamadı"
            };
        }

        const orders = Array.isArray(result.orders) ? result.orders : [];

        const settlements = orders.map(function(o) {
            const totalPrice = Number(o.OrderTotal?.Amount || 0);
            const status = String(o.OrderStatus || "");
            const isReturn = /Cancel|Return|Refund/i.test(status);

            return {
                id: o.AmazonOrderId || o.OrderId || "",
                transactionDate: o.PurchaseDate,
                barcode: "-",
                transactionType: isReturn ? "Return" : "Sale",
                description: isReturn ? "Iade" : "Satis",
                debt: isReturn ? totalPrice : 0,
                credit: isReturn ? 0 : totalPrice,
                commissionRate: 0,
                commissionAmount: 0,
                sellerRevenue: isReturn ? -totalPrice : totalPrice,
                orderNumber: o.AmazonOrderId || o.OrderId || "",
                paymentDate: null,
                productName: ""
            };
        });

        logger.info("[Finance] Amazon verileri cekildi - " + settlements.length + " islem");
        return { settlements, otherFinancials: [], supported: true };
    } catch (err) {
        logger.error("[Finance] Amazon finans hatasi: " + err.message);
        return { settlements: [], otherFinancials: [], supported: false, error: err.message };
    }
};
