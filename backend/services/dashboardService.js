const axios = require("axios");
const aws4 = require("aws4");
const qs = require("querystring");
const Marketplace = require("../models/Marketplace");
const Order = require("../models/Order");
const Product = require("../models/Product");
const logger = require("../config/logger");
// ✅ FIX: Credential'ları decrypt et — DB'de şifreli saklanıyor
const { decryptCredentials } = require("../utils/encryption");

const REQUEST_TIMEOUT_MS = 15000; // 15 saniye timeout
const RETRY_LIMIT = 3;
const CACHE_TTL_MS = 10000; // 10 saniye cache - Daha sık güncelleme
const MAX_SUMMARY_PAGE_SIZE = 200; // Daha fazla sipariş çek

// userId -> { timestamp, data }
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const normalizeName = (name = "") => name.toLowerCase().trim();

const todayWindow = () => {
    const now = new Date();
    const start = new Date(now);
    // 1.5 hafta = 10.5 gün geriye git
    start.setDate(start.getDate() - 10);
    start.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: now.getTime() };
};

const shouldRetry = (error) => {
    const status = error?.response?.status;
    return status === 429 || (status >= 500 && status < 600) || error.code === "ECONNABORTED";
};

const requestWithControls = async (config) => {
    let attempt = 0;
    let lastError = null;
    while (attempt < RETRY_LIMIT) {
        try {
            const response = await axios({ timeout: REQUEST_TIMEOUT_MS, ...config });
            return { ok: true, response };
        } catch (error) {
            lastError = error;
            if (!shouldRetry(error) || attempt === RETRY_LIMIT - 1) {
                return { ok: false, error, status: error?.response?.status };
            }
            attempt += 1;
            await sleep(300 * attempt);
        }
    }
    return { ok: false, error: lastError, status: lastError?.response?.status };
};

const summarizeOrders = (orders = []) => {
    const orderCount = orders.length;
    const revenue = orders.reduce((sum, order) => sum + Number(order.totalPrice || order.price || 0), 0);

    // Status bazlı gruplandırma
    const statusGroups = {
        new: 0,           // Yeni siparişler
        processing: 0,    // İşleme alınan
        shipping: 0,      // Kargoda
        delivered: 0,     // Teslim edildi
        cancelled: 0,     // İptal
        returned: 0       // İade
    };

    const ordersByStatus = [];

    orders.forEach(order => {
        const status = String(order.status || "").toLowerCase();

        // Her siparişi detaylı olarak kaydet
        ordersByStatus.push({
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            totalPrice: order.totalPrice,
            status: order.status,
            statusNormalized: status
        });

        // Status gruplarına say
        if (status.includes('created') || status.includes('yeni') || status.includes('new')) {
            statusGroups.new++;
        } else if (status.includes('processing') || status.includes('işlem') || status.includes('hazırlan') || status.includes('picking') || status.includes('packing')) {
            statusGroups.processing++;
        } else if (status.includes('shipping') || status.includes('shipped') || status.includes('kargo') || status.includes('taşı') || status.includes('transit')) {
            statusGroups.shipping++;
        } else if (status.includes('delivered') || status.includes('teslim')) {
            statusGroups.delivered++;
        } else if (status.includes('cancel') || status.includes('iptal')) {
            statusGroups.cancelled++;
        } else if (status.includes('return') || status.includes('iade') || status.includes('refund')) {
            statusGroups.returned++;
        } else {
            // Bilinmeyen statuslar processing'e ekle
            statusGroups.processing++;
        }
    });

    // Pending: Sadece Yeni ve İşleme Alınan siparişler (Kargoda olanlar hariç)
    const pending = statusGroups.new + statusGroups.processing;

    const lastDate = orders.reduce((latest, order) => {
        const date = order.orderDate ? new Date(order.orderDate) : null;
        if (!date || Number.isNaN(date.getTime())) return latest;
        return !latest || date > latest ? date : latest;
    }, null);

    const result = {
        orderCount,
        revenue,
        pending,
        lastOrderDate: lastDate ? lastDate.toISOString() : null,
        statusGroups,           // Yeni: Status bazlı sayılar
        ordersByStatus,         // Yeni: Tüm siparişlerin detayları
        orderDetails: orders    // Yeni: Ham sipariş verileri
    };

    return result;
};

const buildHealthStatus = (status) => {
    if (status === 401) return "auth";
    if (status === 429) return "rate-limit";
    if (status && status >= 500) return "service-issue";
    if (status) return "warning";
    return "healthy";
};

// --- Marketplace adapters ---------------------------------------------------

const fetchTrendyolOrders = async (credentials, start, end) => {
    const { sellerId, apiKey, apiSecret } = credentials || {};
    if (!sellerId || !apiKey || !apiSecret) {
        throw Object.assign(new Error("Trendyol credentials missing"), { status: 401 });
    }

    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;

    // Trendyol API timestamp (milisaniye) bekliyor
    const startTimestamp = typeof start === 'number' ? start : new Date(start).getTime();
    const endTimestamp = typeof end === 'number' ? end : new Date(end).getTime();

    // TÜM siparişleri çekmek için status parametresini kaldırıyoruz
    const params = {
        page: 0,
        size: MAX_SUMMARY_PAGE_SIZE,
        startDate: startTimestamp,
        endDate: endTimestamp,
        orderByField: "PackageLastModifiedDate",
        orderByDirection: "DESC"
    };

    // Trendyol API request

    const result = await requestWithControls({
        url: `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/orders`,
        method: "GET",
        params,
        headers: {
            Authorization: authHeader,
            "User-Agent": `${sellerId} - Dashboard`,
            "Content-Type": "application/json"
        }
    });

    if (!result.ok) {
        logger.error("Trendyol API Error", {
            status: result.status,
            error: result.error?.message
        });
        const error = new Error("Trendyol orders failed");
        error.status = result.status;
        throw error;
    }

    const content = Array.isArray(result.response?.data?.content) ? result.response.data.content : [];

    const orders = content.map(pkg => ({
        orderNumber: pkg.orderNumber,
        orderDate: pkg.orderDate,
        totalPrice: pkg.grossAmount,
        status: pkg.status
    }));

    const summary = summarizeOrders(orders);
    return { ...summary, errorCount: 0, healthStatus: "healthy", pendingSync: 0 };
};

const fetchHepsiburadaOrders = async (credentials, start, end) => {
    const { merchantId, apiKey } = credentials || {};
    if (!merchantId || !apiKey) {
        throw Object.assign(new Error("Hepsiburada credentials missing"), { status: 401 });
    }

    logger.info("📦 [Hepsiburada Dashboard] Radium API ile siparişler çekiliyor...");

    const headers = {
        Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`,
        "User-Agent": "lysia-dashboard",
        "Content-Type": "application/json"
    };

    // Tarih formatı: Y-m-d H:i:s (Radium API formatı)
    const moment = require("moment");
    const formattedStartDate = moment(start).format('YYYY-MM-DD HH:mm:ss');
    const formattedEndDate = moment(end).format('YYYY-MM-DD HH:mm:ss');

    const allOrders = [];
    const pageSize = 200; // Maksimum 200

    // Sadece önemli statusları çek (dashboard için)
    const statuses = ['OPEN', 'APPROVED', 'SHIPPED', 'DELIVERED'];

    for (const status of statuses) {
        try {
            const url = `https://radium.hepsiburada.com/api/order/order_status?` +
                `startDate=${encodeURIComponent(formattedStartDate)}` +
                `&endDate=${encodeURIComponent(formattedEndDate)}` +
                `&status=${status}` +
                `&page=0` +
                `&size=${pageSize}`;

            const result = await requestWithControls({
                url,
                method: "GET",
                headers
            });

            if (result.ok) {
                const data = result.response?.data;
                const orders = data?.orders || data?.data || data?.content || [];

                if (Array.isArray(orders) && orders.length > 0) {
                    allOrders.push(...orders.map(order => ({
                        orderNumber: order.orderNumber || order.merchantOrderNumber || order.id,
                        orderDate: order.orderDate || order.createdDate || order.orderCreatedDate,
                        totalPrice: order.totalPrice || order.totalAmount || order.grandTotal || 0,
                        status: order.status || status
                    })));
                }
            }
        } catch (err) {
            logger.warn(`⚠️ [Hepsiburada Dashboard] ${status} statusu çekilemedi:`, err.message);
        }
    }

    // Tekrar eden siparişleri temizle
    const uniqueOrders = Array.from(
        new Map(allOrders.map(order => [order.orderNumber, order])).values()
    );

    const summary = summarizeOrders(uniqueOrders);
    return { ...summary, errorCount: 0, healthStatus: "healthy", pendingSync: 0 };
};

const fetchN11Orders = async (credentials, start, end) => {
    const { apiKey, secretKey } = credentials || {};
    if (!apiKey || !secretKey) {
        throw Object.assign(new Error("N11 credentials missing"), { status: 401 });
    }

    const params = {
        startDate: start,
        endDate: end,
        page: 0,
        size: MAX_SUMMARY_PAGE_SIZE,
        orderByDirection: "DESC",
        orderByField: true
    };

    // N11 API request

    const result = await requestWithControls({
        url: "https://api.n11.com/rest/delivery/v1/shipmentPackages",
        method: "GET",
        params,
        headers: {
            appkey: String(apiKey || "").replace(/[^\x20-\x7E]/g, ""),
            appsecret: String(secretKey || "").replace(/[^\x20-\x7E]/g, ""),
            "Content-Type": "application/json"
        }
    });

    if (!result.ok) {
        logger.error("N11 API Error", { status: result.status, error: result.error?.message });
        const error = new Error("N11 orders failed");
        error.status = result.status;
        throw error;
    }

    const content = Array.isArray(result.response?.data?.content) ? result.response.data.content : [];

    const orders = content.map(pkg => {
        const totalAmount = Array.isArray(pkg.lines)
            ? pkg.lines.reduce((sum, line) => sum + Number(line.sellerInvoiceAmount || 0), 0)
            : 0;
        return {
            orderNumber: pkg.orderNumber,
            orderDate: pkg.packageHistories?.[0]?.createdDate,
            totalPrice: totalAmount,
            status: pkg.shipmentPackageStatus
        };
    });

    const summary = summarizeOrders(orders);
    return { ...summary, errorCount: 0, healthStatus: "healthy", pendingSync: 0 };
};

const getAmazonLwaToken = async (clientId, clientSecret, refreshToken) => {
    const body = qs.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
    });
    const resp = await axios.post("https://api.amazon.com/auth/o2/token", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: REQUEST_TIMEOUT_MS
    });
    return resp.data?.access_token;
};

const fetchAmazonSigned = async ({ credentials, path, method = "GET" }) => {
    const {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        region = process.env.AMAZON_REGION || "eu-west-1"
    } = credentials || {};

    if (!accessKeyId || !secretAccessKey) {
        const error = new Error("Amazon AWS keys missing");
        error.status = 401;
        throw error;
    }

    const host = process.env.AMAZON_API_HOST || "sellingpartnerapi-eu.amazon.com";
    const opts = {
        host,
        path,
        service: "execute-api",
        region,
        method
    };
    const signed = aws4.sign(opts, {
        accessKeyId,
        secretAccessKey,
        sessionToken
    });

    const headers = {
        ...signed.headers
    };

    const response = await axios({
        url: `https://${host}${path}`,
        method,
        headers,
        timeout: REQUEST_TIMEOUT_MS
    });
    return response.data;
};

const fetchAmazonOrders = async (credentials, start, end) => {
    const {
        marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "A33AVAJ2PDY3EV", // TR marketplace
        refreshToken = process.env.AMAZON_REFRESH_TOKEN,
        clientId = process.env.AMAZON_LWA_CLIENT_ID,
        clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET
    } = credentials || {};

    if (!marketplaceId || !refreshToken || !clientId || !clientSecret) {
        const error = new Error("Amazon credentials missing");
        error.status = 401;
        throw error;
    }

    // Amazon API request

    const accessToken = await getAmazonLwaToken(clientId, clientSecret, refreshToken);
    if (!accessToken) {
        logger.error("Amazon LWA token failed");
        const error = new Error("Amazon LWA token failed");
        error.status = 401;
        throw error;
    }

    const createdAfter = new Date(start).toISOString();
    const createdBefore = new Date(end).toISOString();
    const query = qs.stringify({
        MarketplaceIds: marketplaceId,
        CreatedAfter: createdAfter,
        CreatedBefore: createdBefore
    });

    const host = process.env.AMAZON_API_HOST || "sellingpartnerapi-eu.amazon.com";
    const region = process.env.AMAZON_REGION || "eu-west-1";
    const path = `/orders/v0/orders?${query}`;

    // Sign request
    const {
        accessKeyId,
        secretAccessKey,
        sessionToken
    } = credentials;
    if (!accessKeyId || !secretAccessKey) {
        logger.error("Amazon AWS keys missing");
        const error = new Error("Amazon AWS keys missing");
        error.status = 401;
        throw error;
    }
    const opts = {
        host,
        path,
        service: "execute-api",
        region,
        method: "GET",
        headers: {
            "x-amz-access-token": accessToken
        }
    };
    const signed = aws4.sign(opts, { accessKeyId, secretAccessKey, sessionToken });

    const result = await axios({
        url: `https://${host}${path}`,
        method: "GET",
        headers: signed.headers,
        timeout: REQUEST_TIMEOUT_MS
    });

    const orders = Array.isArray(result.data?.Orders) ? result.data.Orders : [];

    const mapped = orders.map(o => ({
        orderNumber: o.AmazonOrderId,
        orderDate: o.PurchaseDate,
        totalPrice: Number(o.OrderTotal?.Amount || 0),
        status: o.OrderStatus
    }));

    const summary = summarizeOrders(mapped);
    return { ...summary, errorCount: 0, healthStatus: "healthy", pendingSync: 0 };
};

// ─── ÇiçekSepeti Dashboard Sipariş Çekme ───
const fetchCiceksepetiOrders = async (credentials, start, end) => {
    const { apiKey, sellerId, integratorName } = credentials || {};

    if (!apiKey) {
        const error = new Error("ÇiçekSepeti API Key eksik");
        error.status = 401;
        throw error;
    }

    // HTTP header'ları sadece ASCII kabul eder — Türkçe karakterleri temizle
    const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
    const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
    const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : cleanSellerId;

    const headers = {
        "x-api-key": apiKey,
        "user-agent": userAgent || "CicekSepetiIntegration",
        "Content-Type": "application/json"
    };

    const allOrders = [];
    let page = 0;
    const pageSize = 100;

    // ÇiçekSepeti max 2 hafta tarih aralığı destekliyor
    const startDate = new Date(start).toISOString();
    const endDate = new Date(end).toISOString();

    try {
        while (true) {
            const result = await requestWithControls({
                method: "POST",
                url: `https://apis.ciceksepeti.com/api/v1/Order/GetOrders`,
                headers,
                data: { startDate, endDate, pageSize, page }
            });

            if (!result.ok) {
                if (result.status === 401) {
                    const error = new Error("ÇiçekSepeti API Key geçersiz");
                    error.status = 401;
                    throw error;
                }
                break;
            }

            const items = result.response.data?.supplierOrderListWithBranch || [];
            if (!items.length) break;

            allOrders.push(...items.map(order => ({
                orderNumber: order.orderId?.toString(),
                orderDate: order.orderCreateDate && order.orderCreateTime
                    ? `${order.orderCreateDate} ${order.orderCreateTime}`
                    : order.orderCreateDate,
                totalPrice: Number(order.totalPrice || 0),
                status: order.orderProductStatus || "Bilinmiyor"
            })));

            if (items.length < pageSize) break;
            page++;

            // Rate limit: 5 saniyede 1 istek
            await sleep(5000);
        }
    } catch (err) {
        if (err.status) throw err;
        logger.error("[ÇiçekSepeti Dashboard] Sipariş çekme hatası", { error: err.message });
        throw err;
    }

    const summary = summarizeOrders(allOrders);
    return { ...summary, errorCount: 0, healthStatus: "healthy", pendingSync: 0 };
};

// Pending sync placeholders — can be wired to real queues later
const fetchPendingSync = async (normalizedName, credentials) => {
    try {
        if (normalizedName === "amazon") {
            const {
                marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "A33AVAJ2PDY3EV",
                refreshToken = process.env.AMAZON_REFRESH_TOKEN,
                clientId = process.env.AMAZON_LWA_CLIENT_ID,
                clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET
            } = credentials || {};
            if (!marketplaceId || !refreshToken || !clientId || !clientSecret) return 0;
            const accessToken = await getAmazonLwaToken(clientId, clientSecret, refreshToken);
            const host = process.env.AMAZON_API_HOST || "sellingpartnerapi-eu.amazon.com";
            const region = process.env.AMAZON_REGION || "eu-west-1";
            const {
                accessKeyId,
                secretAccessKey,
                sessionToken
            } = credentials || {};
            if (!accessKeyId || !secretAccessKey) return 0;
            const path = "/feeds/2021-06-30/feeds?processingStatuses=IN_QUEUE,IN_PROGRESS";
            const opts = {
                host,
                path,
                service: "execute-api",
                region,
                method: "GET",
                headers: { "x-amz-access-token": accessToken }
            };
            const signed = aws4.sign(opts, { accessKeyId, secretAccessKey, sessionToken });
            const resp = await axios({
                url: `https://${host}${path}`,
                method: "GET",
                headers: signed.headers,
                timeout: REQUEST_TIMEOUT_MS
            });
            const feeds = Array.isArray(resp.data?.feeds) ? resp.data.feeds : [];
            return feeds.length;
        }
        // For other marketplaces, placeholder until queue endpoints are wired
        return 0;
    } catch (err) {
        return 0;
    }
};

const fetchStockMismatch = async (name, credentials, productMap) => {
    try {
        if (!productMap || productMap.size === 0) return 0;
        const normalized = normalizeName(name);
        if (normalized === "trendyol") {
            const { supplierId, apiKey, apiSecret } = credentials || {};
            if (!supplierId || !apiKey || !apiSecret) return 0;
            const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
            const result = await requestWithControls({
                url: `https://api.trendyol.com/sapigw/suppliers/${supplierId}/products`,
                method: "GET",
                params: { approved: true, page: 0, size: MAX_SUMMARY_PAGE_SIZE },
                headers: {
                    Authorization: `Basic ${auth}`,
                    "User-Agent": `${supplierId} - Dashboard`,
                    "Content-Type": "application/json"
                }
            });
            if (!result.ok) return 0;
            const items = Array.isArray(result.response?.data?.content) ? result.response.data.content : [];
            let mismatches = 0;
            items.forEach(item => {
                const sku = item.barcode || item.stockCode;
                const marketplaceStock = item.quantity || item.availableStock || item.stock || 0;
                if (sku && productMap.has(sku)) {
                    const local = Number(productMap.get(sku));
                    if (Number(marketplaceStock) !== local) mismatches += 1;
                }
            });
            return mismatches;
        }
        if (normalized === "hepsiburada") {
            const { merchantId, apiKey } = credentials || {};
            if (!merchantId || !apiKey) return 0;
            const result = await requestWithControls({
                url: `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}`,
                method: "GET",
                params: { offset: 0, limit: MAX_SUMMARY_PAGE_SIZE },
                headers: {
                    Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`,
                    "User-Agent": "lysia-dashboard",
                    "Content-Type": "application/json"
                }
            });
            if (!result.ok) return 0;
            const items = Array.isArray(result.response?.data?.items) ? result.response.data.items : [];
            let mismatches = 0;
            items.forEach(item => {
                const sku = item.sku || item.barcode;
                const marketplaceStock = item.availableStock || item.stock || item.quantity || 0;
                if (sku && productMap.has(sku)) {
                    const local = Number(productMap.get(sku));
                    if (Number(marketplaceStock) !== local) mismatches += 1;
                }
            });
            return mismatches;
        }
        return 0;
    } catch (err) {
        return 0;
    }
};

const collectMarketplaceMetrics = async (marketplace, windowStart, windowEnd, productMap) => {
    const name = marketplace.marketplaceName;
    const normalized = normalizeName(name);
    // ✅ FIX: Credential'ları decrypt et — DB'de AES-256-GCM ile şifreli saklanıyor
    const credentials = decryptCredentials(marketplace.credentials);
    try {
        let metrics;
        switch (normalized) {
            case "trendyol":
                metrics = await fetchTrendyolOrders(credentials, windowStart, windowEnd);
                break;
            case "hepsiburada":
                metrics = await fetchHepsiburadaOrders(credentials, windowStart, windowEnd);
                break;
            case "n11":
                metrics = await fetchN11Orders(credentials, windowStart, windowEnd);
                break;
            case "amazon":
                metrics = await fetchAmazonOrders(credentials, windowStart, windowEnd);
                break;
            case "çiçeksepeti":
            case "ciceksepeti":
                metrics = await fetchCiceksepetiOrders(credentials, windowStart, windowEnd);
                break;
            default: {
                logger.warn(`Unsupported marketplace: ${name}`);
                const error = new Error(`Unsupported marketplace: ${name}`);
                error.status = 400;
                throw error;
            }
        }
        const stockMismatch = await fetchStockMismatch(name, credentials, productMap);
        const pendingSync = await fetchPendingSync(normalized, credentials);

        const result = {
            marketplaceId: marketplace._id,
            marketplaceName: name,
            pendingSync,
            stockMismatch,
            ...metrics
        };

        return result;
    } catch (error) {
        logger.error(`${name} marketplace error: ${error.message}`);
        return {
            marketplaceId: marketplace._id,
            marketplaceName: name,
            orderCount: 0,
            revenue: 0,
            pending: 0,
            pendingSync: 0,
            lastOrderDate: null,
            stockMismatch: 0,
            errorCount: 1,
            healthStatus: buildHealthStatus(error?.status || error?.response?.status)
        };
    }
};

const buildTrendsFromDb = (orders, days = 7) => {
    const byDay = new Map();
    orders.forEach(order => {
        const orderDate = order.orderDate ? new Date(order.orderDate) : null;
        if (!orderDate || Number.isNaN(orderDate.getTime())) return;
        const key = orderDate.toISOString().slice(0, 10);
        const current = byDay.get(key) || { count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += Number(order.totalPrice || 0);
        byDay.set(key, current);
    });

    const labels = [];
    const orderCounts = [];
    const revenueTotals = [];
    const today = new Date();

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const day = new Date(today);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - offset);
        const key = day.toISOString().slice(0, 10);
        const metrics = byDay.get(key) || { count: 0, revenue: 0 };
        labels.push(day.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }));
        orderCounts.push(metrics.count);
        revenueTotals.push(metrics.revenue);
    }

    return { labels, orderCounts, revenueTotals };
};

// Main entry
exports.getDashboardData = async (userId) => {
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    const { start, end } = todayWindow();

    const marketplaces = await Marketplace.find({ userId }).lean();

    const ordersFromDb = await Order.find({ user: userId, orderDate: { $gte: new Date(start), $lte: new Date(end) } })
        .select("totalPrice status orderDate")
        .lean();

    const products = await Product.find({ userId }).select("barcode stock").lean();

    const productMap = new Map(products.map(p => [p.barcode, p.stock]));

    const [totalProducts, activeProducts] = await Promise.all([
        Product.countDocuments({ userId }),
        Product.countDocuments({ userId, stock: { $gt: 0 } })
    ]);

    const marketplaceResults = await Promise.allSettled(
        marketplaces.map(mp => collectMarketplaceMetrics(mp, start, end, productMap))
    );

    const metrics = marketplaceResults.map(result =>
        result.status === "fulfilled" ? result.value : {
            marketplaceId: null,
            marketplaceName: "unknown",
            orderCount: 0,
            revenue: 0,
            pending: 0,
            pendingSync: 0,
            lastOrderDate: null,
            stockMismatch: 0,
            errorCount: 1,
            healthStatus: "error"
        }
    );

    const todayOrders = metrics.reduce((sum, m) => sum + (m.orderCount || 0), 0);
    const todayRevenue = metrics.reduce((sum, m) => sum + (m.revenue || 0), 0);
    const pendingSync = metrics.reduce((sum, m) => sum + (m.pendingSync || 0), 0);
    const stockMismatchCount = metrics.reduce((sum, m) => sum + (m.stockMismatch || 0), 0);
    const errorCount = metrics.reduce((sum, m) => sum + (m.errorCount || 0), 0);
    const lastOrderDate = metrics.reduce((latest, m) => {
        const date = m.lastOrderDate ? new Date(m.lastOrderDate) : null;
        if (!date || Number.isNaN(date.getTime())) return latest;
        return !latest || date > latest ? date : latest;
    }, null);
    const activeMarketplaces = metrics.filter(m => m.healthStatus === "healthy").length;

    const marketplaceStatus = {};
    const todayBreakdown = [];
    metrics.forEach((m, idx) => {
        const key = normalizeName(m.marketplaceName) || "unknown";
        const healthStatus = m.healthStatus || "warning";

        // Status belirleme: healthy -> active, diğerleri -> slow veya error
        let status = "active";
        if (healthStatus === "healthy") {
            status = "active";
        } else if (healthStatus === "warning" || healthStatus === "rate-limit") {
            status = "slow";
        } else {
            status = "error";
        }

        marketplaceStatus[key] = {
            health: healthStatus,
            status: status,
            orders: m.orderCount || 0,
            revenue: m.revenue || 0,
            pendingSync: m.pendingSync || 0,
            errors: m.errorCount || 0,
            stockMismatch: m.stockMismatch || 0,
            updatedAt: new Date().toISOString(),
            // Yeni: Detaylı sipariş bilgileri
            statusGroups: m.statusGroups || { new: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0 },
            ordersByStatus: m.ordersByStatus || [],
            orderDetails: m.orderDetails || []
        };
        todayBreakdown.push({
            marketplace: m.marketplaceName,
            orders: m.orderCount || 0,
            revenue: m.revenue || 0
        });
    });

    const summary = {
        totalProducts,
        activeProducts,
        passiveProducts: Math.max(totalProducts - activeProducts, 0),
        todayOrders,
        todayRevenue,
        pendingSync,
        errorCount,
        stockMismatchCount,
        totalMarketplaces: marketplaces.length,
        activeMarketplaces,
        missingCredentials: marketplaces.length - activeMarketplaces,
        lastOrderDate: lastOrderDate ? lastOrderDate.toISOString() : null,
        lastIntegrationUpdate: marketplaces.reduce((latest, mp) => {
            const updated = mp.updatedAt ? new Date(mp.updatedAt) : null;
            if (!updated || Number.isNaN(updated.getTime())) return latest;
            return !latest || updated > latest ? updated : latest;
        }, null)?.toISOString() || null
    };

    const table = marketplaces.map(mp => {
        const metric = metrics.find(m => m.marketplaceId?.toString?.() === mp._id.toString());
        return {
            id: mp._id,
            marketplaceName: mp.marketplaceName,
            sellerId: mp.credentials?.sellerId || mp.credentials?.merchantId || mp.credentials?.supplierId || "",
            status: metric?.healthStatus === "healthy" ? "active" : "incomplete",
            requiredCredentialCount: Object.keys(mp.credentials || {}).length,
            providedCredentialCount: Object.values(mp.credentials || {}).filter(Boolean).length,
            missingCredentialCount: 0,
            createdAt: mp.createdAt || null,
            updatedAt: mp.updatedAt || null,
            healthStatus: metric?.healthStatus || "warning",
            errorCount: metric?.errorCount || 0,
            pendingSync: metric?.pendingSync || 0,
            stockMismatch: metric?.stockMismatch || 0,
            orderCount: metric?.orderCount || 0,
            revenue: metric?.revenue || 0
        };
    });

    const trends = buildTrendsFromDb(
        await Order.find({ user: userId }).select("totalPrice status orderDate").lean(),
        7
    );

    const data = {
        summary,
        table,
        trends,
        diagnostics: {
            marketplaces: metrics.map(m => ({
                name: m.marketplaceName,
                health: m.healthStatus,
                errors: m.errorCount,
                stockMismatch: m.stockMismatch,
                pendingSync: m.pendingSync
            })),
            pendingSyncTotal: pendingSync,
            errorCount,
            stockMismatchCount
        },
        todayBreakdown,
        // Structure required by spec
        totalProducts,
        activeProducts,
        todayOrders,
        todayRevenue,
        pendingSync,
        errorCount,
        stockMismatchCount,
        marketplaceStatus
    };

    cache.set(userId, { timestamp: Date.now(), data });
    return data;
};
