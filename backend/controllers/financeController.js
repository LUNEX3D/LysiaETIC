const logger = require("../config/logger");
const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
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

// --- 4. Unified Finance Summary (tek marketplace veya tumu) ---

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
                    const hbFinance = await fetchHepsiburadaFinance(mp, start, end);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, ...hbFinance, supported: hbFinance.supported !== false };

                } else if (/n11/i.test(name)) {
                    const n11Finance = await fetchN11Finance(mp, start, end);
                    results[name] = { marketplaceId: mp._id, marketplaceName: name, ...n11Finance, supported: n11Finance.supported !== false };

                } else if (/[cç]i[cç]eksepeti/i.test(name)) {
                    const csFinance = await fetchCicekSepetiFinance(mp, start, end);
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

const fetchHepsiburadaFinance = async (mp, start, end) => {
    try {
        const { normalizeCredentials, getHeaders, getEndpoints } = require("../services/hepsiburadaService");
        const hbCreds = normalizeCredentials(mp.credentials);
        const { merchantId, secretKey, userAgent } = hbCreds;

        if (!merchantId || !secretKey) {
            return { settlements: [], otherFinancials: [], supported: false, message: "Hepsiburada API kimlik bilgileri eksik (merchantId + secretKey gerekli)." };
        }

        const moment = require("moment");
        const formattedStartDate = moment(start).format("YYYY-MM-DD HH:mm:ss");
        const formattedEndDate = moment(end).format("YYYY-MM-DD HH:mm:ss");

        const headers = getHeaders(merchantId, secretKey, userAgent);
        const ep = getEndpoints(hbCreds);

        // SIT/Production ortamına göre dinamik endpoint — OMS üzerinden sipariş çekme
        // Hepsiburada farklı statüdeki siparişleri farklı endpoint'lerden döner
        // Orders: limit max 100, Packages: limit max 50
        const OMS_BASE = ep.OMS;

        let allOrders = [];
        let apiWorked = false;

        // ── Yardımcı: Bir endpoint'ten pagination ile sipariş çek ──
        const fetchFinanceEndpoint = async (endpointUrl, label, maxLimit) => {
            let offset = 0;
            const limit = maxLimit || 100;
            let hasMore = true;

            while (hasMore) {
                try {
                    const url = endpointUrl.includes('?')
                        ? `${endpointUrl}&offset=${offset}&limit=${limit}`
                        : `${endpointUrl}?offset=${offset}&limit=${limit}`;

                    logger.info("[Finance] Hepsiburada " + label + " offset=" + offset);

                    const resp = await axios.get(url, { headers: headers, timeout: 30000 });
                    const orders = resp.data?.items || resp.data?.orders || resp.data?.data || resp.data?.content || [];
                    if (!Array.isArray(orders) || orders.length === 0) {
                        hasMore = false;
                    } else {
                        // Packages endpoint: her paket içinde items[] var — düzleştir
                        orders.forEach(function(order) {
                            const subItems = order.items || [];
                            if (subItems.length > 0) {
                                // Paket bazlı — her sub-item'ı ayrı order satırı olarak ekle
                                subItems.forEach(function(sub) {
                                    allOrders.push(Object.assign({}, sub, {
                                        orderNumber: sub.orderNumber || order.orderNumber || order.id,
                                        orderDate: sub.orderDate || order.orderDate,
                                        status: sub.status || order.status || label,
                                        cargoCompany: order.cargoCompany || '',
                                        packageNumber: order.packageNumber || ''
                                    }));
                                });
                            } else {
                                allOrders.push(order);
                            }
                        });
                        apiWorked = true;
                        if (orders.length < limit) { hasMore = false; } else { offset += orders.length; }
                        await sleep(300);
                    }
                } catch (e) {
                    if (e.response?.status === 401 || e.response?.status === 403) {
                        logger.warn("[Finance] Hepsiburada " + label + " auth hatasi: " + e.message);
                    } else if (e.response?.status !== 404) {
                        logger.warn("[Finance] Hepsiburada " + label + " hatasi: " + (e.response?.status || e.message));
                    }
                    hasMore = false;
                }
            }
        };

        const encStart = encodeURIComponent(formattedStartDate);
        const encEnd = encodeURIComponent(formattedEndDate);

        // 1) Ödemesi tamamlanmış (Open) — limit max 100
        await fetchFinanceEndpoint(
            `${OMS_BASE}/orders/merchantid/${merchantId}?begindate=${encStart}&enddate=${encEnd}`,
            "Orders", 100
        );

        // 2) Paketlenmiş — timespan=720 (30 gün saat), limit max 50
        await fetchFinanceEndpoint(
            `${OMS_BASE}/packages/merchantid/${merchantId}?timespan=720`,
            "Packages", 50
        );

        // 3) Kargoya verilmiş — son 30 gün
        const shipStart = encodeURIComponent(moment(end).subtract(30, 'days').format("YYYY-MM-DD HH:mm:ss"));
        const shipEnd = encodeURIComponent(moment(end).format("YYYY-MM-DD HH:mm:ss"));
        await fetchFinanceEndpoint(
            `${OMS_BASE}/packages/merchantid/${merchantId}/shipped?begindate=${shipStart}&enddate=${shipEnd}`,
            "Shipped", 50
        );

        // 4) Teslim edilmiş — son 30 gün
        await fetchFinanceEndpoint(
            `${OMS_BASE}/packages/merchantid/${merchantId}/delivered?begindate=${shipStart}&enddate=${shipEnd}`,
            "Delivered", 50
        );

        // 5) İptal edilmiş — son 30 gün
        await fetchFinanceEndpoint(
            `${OMS_BASE}/packages/merchantid/${merchantId}/cancelled?begindate=${shipStart}&enddate=${shipEnd}`,
            "Cancelled", 50
        );

        if (allOrders.length === 0 && !apiWorked) {
            logger.warn("[Finance] Hepsiburada: Hic siparis cekilemedi, tum endpoint'ler basarisiz.");
        }

        // Tekrar eden siparisleri temizle
        const uniqueMap = new Map();
        allOrders.forEach(function(order) {
            const key = order.orderNumber || order.merchantOrderNumber || order.id;
            if (key && !uniqueMap.has(key)) uniqueMap.set(key, order);
        });
        const uniqueOrders = Array.from(uniqueMap.values());

        // Siparisleri settlement formatina donustur
        const settlements = [];
        uniqueOrders.forEach(function(order) {
            // Hepsiburada siparis yapisi: items veya orderItems array'i icerir
            const items = order.items || order.orderItems || [order];
            items.forEach(function(item) {
                const unitPrice = Number(item.price || item.unitPrice || 0);
                const quantity = Number(item.quantity || 1);
                const totalPrice = unitPrice * quantity || Number(order.totalPrice || order.totalAmount || order.grandTotal || 0);
                const commissionRate = Number(item.commissionRate || order.commissionRate || 0);
                const commissionAmount = commissionRate > 0 ? totalPrice * (commissionRate / 100) : 0;
                const status = String(item.status || order.status || "").toUpperCase();
                const isReturn = /CANCEL|RETURN|REFUND|IPTAL|IADE/i.test(status);

                settlements.push({
                    id: (order.orderNumber || order.merchantOrderNumber || order.id) + "-" + (item.sku || item.merchantSku || item.id || "0"),
                    transactionDate: order.orderDate || order.createdDate || order.orderCreatedDate,
                    barcode: item.sku || item.merchantSku || item.barcode || "-",
                    transactionType: isReturn ? "Return" : "Sale",
                    description: isReturn ? "Iade" : "Satis",
                    debt: isReturn ? totalPrice : 0,
                    credit: isReturn ? 0 : totalPrice,
                    commissionRate: commissionRate,
                    commissionAmount: commissionAmount,
                    sellerRevenue: isReturn ? -(totalPrice - commissionAmount) : (totalPrice - commissionAmount),
                    orderNumber: order.orderNumber || order.merchantOrderNumber || order.id,
                    paymentDate: order.paymentDate || null,
                    productName: item.productName || item.name || item.title || ""
                });
            });
        });

        logger.info("[Finance] Hepsiburada verileri cekildi - " + settlements.length + " islem (" + uniqueOrders.length + " siparis)");
        return { settlements: settlements, otherFinancials: [] };
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

const fetchCicekSepetiFinance = async (mp, start, end) => {
    try {
        const { apiKey, sellerId, integratorName } = mp.credentials || {};

        if (!apiKey) {
            return { settlements: [], otherFinancials: [], supported: false, message: "CicekSepeti API kimlik bilgileri eksik (apiKey gerekli)." };
        }

        // HTTP header'lari sadece ASCII kabul eder
        const cleanSellerId = String(sellerId || "").replace(/[^\x00-\x7F]/g, "");
        const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, "") : "";
        const userAgent = cleanIntegrator ? cleanSellerId + " - " + cleanIntegrator : cleanSellerId;

        const headers = {
            "x-api-key": apiKey,
            "user-agent": userAgent || "CicekSepetiIntegration",
            "Content-Type": "application/json"
        };

        // CicekSepeti max 2 hafta tarih araligi destekliyor — chunk'la
        const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
        let allOrders = [];
        let curStart = start;

        while (curStart < end) {
            const chunkEnd = Math.min(curStart + TWO_WEEKS_MS, end);
            const startDateISO = new Date(curStart).toISOString();
            const endDateISO = new Date(chunkEnd).toISOString();

            let page = 0;
            let hasMore = true;

            while (hasMore) {
                try {
                    const resp = await axios.post("https://apis.ciceksepeti.com/api/v1/Order/GetOrders", {
                        startDate: startDateISO,
                        endDate: endDateISO,
                        pageSize: 100,
                        page: page
                    }, {
                        headers: headers,
                        timeout: 30000
                    });

                    const orders = resp.data?.supplierOrderListWithBranch || [];
                    if (orders.length === 0) {
                        hasMore = false;
                    } else {
                        allOrders = allOrders.concat(orders);
                        page++;
                        if (orders.length < 100) hasMore = false;
                    }
                } catch (e) {
                    if (e.response?.status === 401) {
                        logger.error("[Finance] CicekSepeti auth hatasi: " + e.message);
                        return { settlements: [], otherFinancials: [], supported: false, message: "CicekSepeti API Key gecersiz." };
                    }
                    if (e.response?.status === 429) {
                        logger.warn("[Finance] CicekSepeti rate limit, 60sn bekleniyor...");
                        await sleep(60000);
                        continue;
                    }
                    logger.warn("[Finance] CicekSepeti siparis cekme hatasi: " + e.message);
                    hasMore = false;
                }

                // Rate limit: farkli request body ile 5 saniyede 1 kez
                if (hasMore) await sleep(5000);
            }

            curStart = chunkEnd + 1;
        }

        // CicekSepeti siparis yapisini settlement formatina donustur
        // Her siparis bir urun satiri (flat structure)
        const settlements = allOrders.map(function(order) {
            const totalPrice = Number(order.totalPrice || order.itemPrice || 0);
            const itemPrice = Number(order.itemPrice || order.totalPrice || 0);
            const quantity = Number(order.quantity || 1);
            const lineTotal = itemPrice * quantity || totalPrice;
            const commissionRate = Number(order.commissionRate || 0);
            const commissionAmount = commissionRate > 0 ? lineTotal * (commissionRate / 100) : 0;
            const status = String(order.orderProductStatus || order.status || "");
            const isReturn = /iade|iptal|cancel|return|refund/i.test(status);

            // Tarih: orderCreateDate (DD/MM/YYYY) + orderCreateTime (HH:mm)
            let transactionDate = null;
            if (order.orderCreateDate && order.orderCreateTime) {
                // DD/MM/YYYY HH:mm -> ISO
                const parts = order.orderCreateDate.split("/");
                if (parts.length === 3) {
                    transactionDate = parts[2] + "-" + parts[1] + "-" + parts[0] + "T" + order.orderCreateTime + ":00";
                } else {
                    transactionDate = order.orderCreateDate + " " + order.orderCreateTime;
                }
            } else {
                transactionDate = order.orderCreateDate || order.orderDate || order.createdDate;
            }

            return {
                id: String(order.orderItemId || order.orderId || order.orderNo || ""),
                transactionDate: transactionDate,
                barcode: order.barcode || order.productCode || order.code || order.stockCode || "-",
                transactionType: isReturn ? "Return" : "Sale",
                description: isReturn ? "Iade" : "Satis",
                debt: isReturn ? lineTotal : 0,
                credit: isReturn ? 0 : lineTotal,
                commissionRate: commissionRate,
                commissionAmount: commissionAmount,
                sellerRevenue: isReturn ? -(lineTotal - commissionAmount) : (lineTotal - commissionAmount),
                orderNumber: String(order.orderId || order.orderNo || order.orderNumber || ""),
                paymentDate: null,
                productName: order.name || order.productName || ""
            };
        });

        logger.info("[Finance] CicekSepeti verileri cekildi - " + settlements.length + " islem");
        return { settlements: settlements, otherFinancials: [] };
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
            marketplaceId: amzMpId,
            refreshToken,
            clientId,
            clientSecret,
            accessKeyId,
            secretAccessKey,
            sessionToken
        } = mp.credentials || {};

        if (!refreshToken || !clientId || !clientSecret || !accessKeyId || !secretAccessKey) {
            return { settlements: [], otherFinancials: [], supported: false, message: "Amazon API kimlik bilgileri eksik." };
        }

        // LWA Token al
        let accessToken;
        try {
            const qs = require("querystring");
            const tokenBody = qs.stringify({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            });
            const tokenResp = await axios.post("https://api.amazon.com/auth/o2/token", tokenBody, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 15000
            });
            accessToken = tokenResp.data?.access_token;
        } catch (tokenErr) {
            logger.error("[Finance] Amazon LWA token hatasi: " + tokenErr.message);
            return { settlements: [], otherFinancials: [], supported: false, message: "Amazon token alinamadi: " + tokenErr.message };
        }

        if (!accessToken) {
            return { settlements: [], otherFinancials: [], supported: false, message: "Amazon access token alinamadi." };
        }

        const createdAfter = new Date(start).toISOString();
        const createdBefore = new Date(end).toISOString();
        const mpId = amzMpId || process.env.AMAZON_MARKETPLACE_ID || "A33AVAJ2PDY3EV"; // TR marketplace
        const host = process.env.AMAZON_API_HOST || "sellingpartnerapi-eu.amazon.com";
        const region = process.env.AMAZON_REGION || "eu-west-1";

        let aws4;
        try {
            aws4 = require("aws4");
        } catch (e) {
            logger.warn("[Finance] aws4 modulu bulunamadi, Amazon finans desteklenmiyor.");
            return { settlements: [], otherFinancials: [], supported: false, message: "Amazon icin aws4 modulu gerekli." };
        }

        const qs = require("querystring");
        const query = qs.stringify({
            MarketplaceIds: mpId,
            CreatedAfter: createdAfter,
            CreatedBefore: createdBefore
        });
        const path = "/orders/v0/orders?" + query;

        const opts = {
            host: host,
            path: path,
            service: "execute-api",
            region: region,
            method: "GET",
            headers: { "x-amz-access-token": accessToken }
        };
        const signed = aws4.sign(opts, { accessKeyId, secretAccessKey, sessionToken });

        const result = await axios({
            url: "https://" + host + path,
            method: "GET",
            headers: signed.headers,
            timeout: 15000
        });

        const orders = Array.isArray(result.data?.Orders) ? result.data.Orders : [];

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
        return { settlements: settlements, otherFinancials: [] };
    } catch (err) {
        logger.error("[Finance] Amazon finans hatasi: " + err.message);
        return { settlements: [], otherFinancials: [], supported: false, error: err.message };
    }
};
