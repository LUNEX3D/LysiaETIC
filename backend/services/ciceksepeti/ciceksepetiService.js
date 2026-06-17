const axios = require("axios");
const moment = require("moment");
const logger = require("../../config/logger");

// ═══════════════════════════════════════════════════════════════════════
// 🌸 ÇİÇEKSEPETİ API SERVİSİ
// ═══════════════════════════════════════════════════════════════════════

// API Base URLs
const CICEKSEPETI_PROD_URL = "https://apis.ciceksepeti.com/api/v1";
const CICEKSEPETI_TEST_URL = "https://sandbox-apis.ciceksepeti.com/api/v1";

/**
 * Auth Header Oluştur
 * ÇiçekSepeti Format: x-api-key header + user-agent (SatıcıID - EntegratörAdı)
 * @param {object} credentials - { apiKey, sellerId, integratorName }
 */
const getHeaders = (credentials) => {
    const { apiKey, sellerId, integratorName } = credentials;

    // User-agent: Eğer entegratör varsa "SellerId - IntegratorName", yoksa sadece "SellerId"
    // HTTP header'ları sadece ASCII kabul eder — Türkçe karakterleri temizle
    const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
    const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
    const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : cleanSellerId;

    return {
        "x-api-key": apiKey,
        "user-agent": userAgent || "CicekSepetiIntegration",
        "Content-Type": "application/json"
    };
};

/**
 * API Base URL'i belirle (test/prod)
 * @param {boolean} isTestMode - Test modu aktif mi?
 */
const getBaseUrl = (isTestMode = false) => {
    return isTestMode ? CICEKSEPETI_TEST_URL : CICEKSEPETI_PROD_URL;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRateLimitWaitMs = (message = "") => {
    const m = String(message).match(/Kalan Süre:\s*(\d+)\s*saniye/i);
    if (!m) return 5000;
    return (Number(m[1]) + 1) * 1000;
};

// ═══════════════════════════════════════════════════════════════════════
// ⏳ RATE-LIMIT THROTTLE (resmi ÇiçekSepeti API limitleri)
// ───────────────────────────────────────────────────────────────────────
// ÇiçekSepeti'nin çoğu endpoint'i "farklı istek 5 saniyede 1 kez" kuralı uygular.
// Bütün çağıranlar (dashboard sync, auto-order, kargo, finans) bu servisi
// kullandığından, throttle'ı MERKEZİ olarak burada uyguluyoruz: endpoint + apiKey
// bazlı SERİ kuyruk + minimum aralık. Böylece eşzamanlı akışlar bile aynı
// endpoint'e limit içinde istek atamaz; 400 "Limit aşımı" hataları önlenir.
// ═══════════════════════════════════════════════════════════════════════
const CS_DEFAULT_MIN_INTERVAL_MS = parseInt(process.env.CICEKSEPETI_MIN_INTERVAL_MS || "5500", 10); // 5sn + tampon
const CS_FAST_MIN_INTERVAL_MS = parseInt(process.env.CICEKSEPETI_FAST_INTERVAL_MS || "1500", 10);   // "saniyede 1" endpointler
const CS_MAX_RETRIES = parseInt(process.env.CICEKSEPETI_MAX_RETRIES || "4", 10);

const _csThrottle = new Map(); // `${endpoint}::${apiKey}` -> { chain, lastAt }

const isCsRateLimit = (err) => {
    const status = err?.response?.status;
    const msg = err?.response?.data?.Message || err?.response?.data?.message || err?.message || "";
    return status === 429 || (status === 400 && /limit a[şs][ıi]m[ıi]|rate\s?limit|too many/i.test(msg));
};

/**
 * ÇiçekSepeti isteğini endpoint+apiKey bazlı seri kuyrukta, minimum aralığı koruyarak
 * ve rate-limit (400/429) durumunda otomatik bekleyip tekrar deneyerek çalıştırır.
 * @param {string} apiKey
 * @param {string} endpointKey - kuyruk anahtarı (örn. "Order/GetOrders")
 * @param {Function} doRequest - axios çağrısını döndüren fonksiyon
 * @param {number} minIntervalMs
 */
const csThrottledRequest = (apiKey, endpointKey, doRequest, minIntervalMs = CS_DEFAULT_MIN_INTERVAL_MS) => {
    const key = `${endpointKey}::${apiKey || "anon"}`;
    const slot = _csThrottle.get(key) || { chain: Promise.resolve(), lastAt: 0 };

    const run = slot.chain.then(async () => {
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const waitMs = slot.lastAt + minIntervalMs - Date.now();
            if (waitMs > 0) await sleep(waitMs);
            try {
                const res = await doRequest();
                slot.lastAt = Date.now();
                return res;
            } catch (err) {
                slot.lastAt = Date.now();
                if (isCsRateLimit(err) && attempt < CS_MAX_RETRIES) {
                    attempt++;
                    const msg = err.response?.data?.Message || err.response?.data?.message || "";
                    const backoff = Math.max(parseRateLimitWaitMs(msg), minIntervalMs);
                    logger.warn(`[ÇiçekSepeti] ${endpointKey} rate-limit — deneme ${attempt}/${CS_MAX_RETRIES}, ${backoff}ms bekleniyor`);
                    await sleep(backoff);
                    continue;
                }
                throw err;
            }
        }
    });

    // Hata bir sonraki isteğin kuyruğunu kırmasın
    slot.chain = run.then(() => {}, () => {});
    _csThrottle.set(key, slot);
    return run;
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 SİPARİŞ YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sipariş Listesi Çek (GetOrders)
 * POST /api/v1/Order/GetOrders
 * NOT: Aynı parametrelerle dakikada 1 istek atılmalı
 * @param {object} credentials - API credentials
 * @param {object} params - { startDate, endDate, pageSize, page, statusId, orderNo, orderItemNo }
 */
const getOrders = async (credentials, params = {}) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const {
            startDate,
            endDate,
            pageSize = 100, // Max 100
            page = 0,
            statusId,
            orderNo,
            orderItemNo,
            isOrderStatusActive
        } = params;

        const requestBody = {
            startDate: startDate || moment().subtract(14, 'days').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
            endDate: endDate || moment().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
            pageSize: Math.min(pageSize, 100),
            page
        };

        // Opsiyonel parametreler
        if (statusId) requestBody.statusId = statusId;
        if (orderNo) requestBody.orderNo = orderNo;
        if (orderItemNo) requestBody.orderItemNo = orderItemNo;
        if (typeof isOrderStatusActive === 'boolean') requestBody.isOrderStatusActive = isOrderStatusActive;

        logger.info(`[ÇiçekSepeti] Sipariş listesi çekiliyor`, {
            startDate: requestBody.startDate,
            endDate: requestBody.endDate,
            page: requestBody.page
        });

        const response = await csThrottledRequest(credentials.apiKey, "Order/GetOrders", () =>
            axios.post(`${baseUrl}/Order/GetOrders`, requestBody, { headers, timeout: 30000 })
        );

        if (response.data && response.data.supplierOrderListWithBranch) {
            logger.info(`[ÇiçekSepeti] ${response.data.orderListCount} sipariş bulundu`);
            return {
                success: true,
                orders: response.data.supplierOrderListWithBranch,
                totalCount: response.data.orderListCount,
                totalPages: response.data.totalPages ?? response.data.totalPage ?? null,
            };
        }

        return { success: true, orders: [], totalCount: 0 };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Sipariş listesi hatası", {
            error: error.message,
            response: error.response?.data
        });
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            orders: [],
            totalCount: 0
        };
    }
};

/**
 * İade/İptal Siparişleri Çek (GetCanceledOrders)
 * POST /api/v1/Order/getcanceledorders
 * @param {object} credentials - API credentials
 * @param {object} params - { orderItemStatusId, pageSize, page, startDate, endDate }
 */
const getCanceledOrders = async (credentials, params = {}) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const {
            orderItemStatusId, // 20: İade Süreci Başladı, 21: İade Kargoda, 22: İade Tedarikçide, 23: İade Tedarikçi Onayı Bekliyor
            pageSize = 10,
            page = 0,
            startDate,
            endDate
        } = params;

        const requestBody = {
            pageSize: Math.min(pageSize, 100),
            page
        };

        if (orderItemStatusId) requestBody.orderItemStatusId = orderItemStatusId;
        if (startDate) requestBody.startDate = startDate;
        if (endDate) requestBody.endDate = endDate;

        const response = await csThrottledRequest(credentials.apiKey, "Order/getcanceledorders", () =>
            axios.post(`${baseUrl}/Order/getcanceledorders`, requestBody, { headers, timeout: 30000 })
        );

        if (response.data && response.data.orderItemList) {
            return {
                success: true,
                orders: response.data.orderItemList
            };
        }

        return { success: true, orders: [] };

    } catch (error) {
        logger.error("[ÇiçekSepeti] İade siparişleri hatası", { error: error.message });
        return { success: false, error: error.message, orders: [] };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🚚 KARGO YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Kargo Kodu Al (ÇiçekSepeti Kargo Entegrasyonu)
 * PUT /api/v1/Order/readyforcargowithcsintegration
 * NOT: 5 saniyede 1 kez farklı request body ile istek atılabilir
 * @param {object} credentials - API credentials
 * @param {array} orderItemsGroup - [{ orderItemIds: [123456, 78901] }]
 */
const getCargoCode = async (credentials, orderItemsGroup) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await csThrottledRequest(credentials.apiKey, "Order/readyforcargowithcsintegration", () =>
            axios.put(`${baseUrl}/Order/readyforcargowithcsintegration`, { orderItemsGroup }, { headers, timeout: 30000 })
        );

        if (response.data && response.data.statusUpdateResponse) {
            return {
                success: true,
                data: response.data.statusUpdateResponse
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Kargo kodu alma hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

/**
 * Sipariş Durumu Güncelle (Kendi Kargo Entegrasyonu)
 * PUT /api/v1/Order/statusupdatewithsupplierintegration
 * @param {object} credentials - API credentials
 * @param {array} orderItems - Sipariş güncellemeleri
 */
const updateOrderStatus = async (credentials, orderItems) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await csThrottledRequest(credentials.apiKey, "Order/statusupdatewithsupplierintegration", () =>
            axios.put(`${baseUrl}/Order/statusupdatewithsupplierintegration`, { orderItems }, { headers, timeout: 30000 })
        );

        if (response.data && response.data.orderItems) {
            return {
                success: true,
                data: response.data.orderItems
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Sipariş durumu güncelleme hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 ÜRÜN YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ürün Listesi Çek
 * GET /api/v1/Products
 * NOT: Aynı request body ile 10 dakikada 1, farklı request body ile 5 saniyede 1 istek
 * @param {object} credentials - API credentials
 * @param {object} params - { ProductStatus, PageSize, Page, SortMethod, StockCode, variantName }
 */
const getProducts = async (credentials, params = {}) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const {
            ProductStatus, // 2: Onay Bekleyen, 3: Satışta, 4: Reddedilen, 5: Satışa Kapalı, 7: Stoğu Tükenen, 8: Kilitli
            PageSize = 60,
            Page = 1,
            SortMethod, // 1-8 arası
            StockCode,
            variantName
        } = params;

        const queryParams = new URLSearchParams();
        if (ProductStatus) queryParams.append('ProductStatus', ProductStatus);
        if (PageSize) queryParams.append('PageSize', Math.min(PageSize, 60));
        if (Page) queryParams.append('Page', Page);
        if (SortMethod) queryParams.append('SortMethod', SortMethod);
        if (StockCode) queryParams.append('StockCode', StockCode);
        if (variantName) queryParams.append('variantName', variantName);

        const url = `${baseUrl}/Products${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

        const response = await csThrottledRequest(credentials.apiKey, "Products:GET", () =>
            axios.get(url, { headers, timeout: 30000 })
        );

        if (response.data && response.data.products) {
            return {
                success: true,
                products: response.data.products,
                totalCount: response.data.totalCount
            };
        }

        return { success: true, products: [], totalCount: 0 };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Ürün listesi hatası", { error: error.message });
        return { success: false, error: error.message, products: [], totalCount: 0 };
    }
};

/**
 * Ürün Yükle
 * POST /api/v1/Products
 * NOT: 5 saniyede 1 kez farklı request body, tek istekte max 1000 item
 * @param {object} credentials - API credentials
 * @param {array} products - Ürün listesi
 */
const createProducts = async (credentials, products) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        // Max 1000 item kontrolü
        if (products.length > 1000) {
            return {
                success: false,
                error: "Tek istekte maksimum 1000 ürün gönderilebilir"
            };
        }

        const response = await csThrottledRequest(credentials.apiKey, "Products:POST", () =>
            axios.post(`${baseUrl}/Products`, { products }, { headers, timeout: 60000 })
        );

        // Response'da batchId dönüyor
        if (response.data && response.data.batchId) {
            return {
                success: true,
                batchId: response.data.batchId,
                message: `${products.length} ürün kuyruğa alındı`
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Ürün yükleme hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

/**
 * Ürün Bilgilerini Güncelle
 * PUT /api/v1/Products
 * NOT: Saniyede 1 kez farklı request body, tek istekte max 200 item
 * @param {object} credentials - API credentials
 * @param {array} products - Güncellenecek ürünler
 */
const updateProducts = async (credentials, products) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        if (products.length > 200) {
            return {
                success: false,
                error: "Tek istekte maksimum 200 ürün gönderilebilir"
            };
        }

        const response = await csThrottledRequest(
            credentials.apiKey,
            "Products:PUT",
            () => axios.put(`${baseUrl}/Products`, { products }, { headers, timeout: 60000 }),
            CS_FAST_MIN_INTERVAL_MS
        );

        if (response.data && response.data.batchId) {
            return {
                success: true,
                batchId: response.data.batchId,
                message: `${products.length} ürün güncelleme kuyruğa alındı`
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Ürün güncelleme hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

/**
 * Stok ve Fiyat Güncelle
 * PUT /api/v1/Products/price-and-stock
 * NOT: Saniyede 1 kez farklı request body, tek istekte max 200 item
 * @param {object} credentials - API credentials
 * @param {array} items - [{ stockCode, stockQuantity, listPrice, salesPrice }]
 */
const updatePriceAndStock = async (credentials, items) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        if (items.length > 200) {
            return {
                success: false,
                error: "Tek istekte maksimum 200 item gönderilebilir"
            };
        }

        const response = await csThrottledRequest(
            credentials.apiKey,
            "Products/price-and-stock",
            () => axios.put(`${baseUrl}/Products/price-and-stock`, { items }, { headers, timeout: 60000 }),
            CS_FAST_MIN_INTERVAL_MS
        );

        if (response.data && response.data.batchId) {
            return {
                success: true,
                batchId: response.data.batchId,
                message: `${items.length} ürün stok/fiyat güncelleme kuyruğa alındı`
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Stok/fiyat güncelleme hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

/**
 * Batch İşlem Durumu Sorgula
 * GET /api/v1/Products/batch-status/{batchId}
 * NOT: Aynı request body ile dakikada 1, saniyede max 5 farklı request
 * @param {object} credentials - API credentials
 * @param {string} batchId - Batch ID
 */
const getBatchStatus = async (credentials, batchId) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.get(
            `${baseUrl}/Products/batch-status/${batchId}`,
            { headers, timeout: 30000 }
        );

        if (response.data) {
            return {
                success: true,
                data: response.data
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Batch status hatası", { error: error.message });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📂 KATEGORİ YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Kategori Listesi Çek
 * GET /api/v1/Categories
 * @param {object} credentials - API credentials
 */
const getCategories = async (credentials) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.get(
            `${baseUrl}/Categories`,
            { headers, timeout: 30000 }
        );

        if (response.data && response.data.categories) {
            return {
                success: true,
                categories: response.data.categories
            };
        }

        return { success: true, categories: [] };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Kategori listesi hatası", { error: error.message });
        return { success: false, error: error.message, categories: [] };
    }
};

/**
 * Kategori Özellikleri Çek
 * GET /api/v1/Categories/{categoryId}/attributes
 * @param {object} credentials - API credentials
 * @param {number} categoryId - Kategori ID
 */
const getCategoryAttributes = async (credentials, categoryId) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.get(
            `${baseUrl}/Categories/${categoryId}/attributes`,
            { headers, timeout: 30000 }
        );

        if (response.data) {
            return {
                success: true,
                data: response.data
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Kategori özellikleri hatası", { error: error.message });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 💬 ÜRÜN SORULARI
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ürün Sorularını Çek
 * GET /api/v1/sellerquestions
 * NOT: Aynı request body ile 10 saniyede 1, farklı request body ile 5 saniyede 1 istek
 * @param {object} credentials - API credentials
 * @param {object} params - Filtreler
 */
const getSellerQuestions = async (credentials, params = {}) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                queryParams.append(key, params[key]);
            }
        });

        const url = `${baseUrl}/sellerquestions${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

        const response = await axios.get(url, { headers, timeout: 30000 });

        if (response.data && response.data.items) {
            return {
                success: true,
                items: response.data.items,
                hasNextPage: response.data.hasNextPage
            };
        }

        return { success: true, items: [], hasNextPage: false };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Ürün soruları hatası", { error: error.message });
        return { success: false, error: error.message, items: [], hasNextPage: false };
    }
};

/**
 * Ürün Sorusuna Cevap Ver
 * PUT /api/v1/sellerquestions/{id}
 * @param {object} credentials - API credentials
 * @param {string} questionId - Soru ID
 * @param {object} answerData - { answer, branchActionId, branchActionDetailId, branchDescription }
 */
const answerSellerQuestion = async (credentials, questionId, answerData) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.put(
            `${baseUrl}/sellerquestions/${questionId}`,
            answerData,
            { headers, timeout: 30000 }
        );

        return { success: true, data: response.data };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Soru cevaplama hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📧 FATURA GÖNDERİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fatura Gönder
 * POST /Branch/SendInvoiceMail
 * @param {object} credentials - API credentials
 * @param {array} items - [{ orderItemId, document, documentUrl }]
 */
const sendInvoice = async (credentials, items) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.post(
            `${baseUrl}/Branch/SendInvoiceMail`,
            { items },
            { headers, timeout: 30000 }
        );

        return { success: true, data: response.data };

    } catch (error) {
        logger.error("[ÇiçekSepeti] Fatura gönderimi hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🔄 İADE YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * İade Süreci Başlat
 * POST /api/v1/Order/refundprocessstartreceivedprocess
 * @param {object} credentials - API credentials
 * @param {array} orderItemIds - Alt sipariş numaraları
 */
const startRefundProcess = async (credentials, orderItemIds) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.post(
            `${baseUrl}/Order/refundprocessstartreceivedprocess`,
            { orderItemIds },
            { headers, timeout: 30000 }
        );

        if (response.data && response.data.orderItems) {
            return {
                success: true,
                data: response.data.orderItems
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] İade süreci başlatma hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

/**
 * İade Onay/Red
 * POST /api/v1/Order/cancelevaluation
 * @param {object} credentials - API credentials
 * @param {number} orderItemId - Alt sipariş numarası
 * @param {number} process - 1: Onay, 3: Red
 */
const evaluateCancellation = async (credentials, orderItemId, process) => {
    try {
        const baseUrl = getBaseUrl(credentials.isTestMode);
        const headers = getHeaders(credentials);

        const response = await axios.post(
            `${baseUrl}/Order/cancelevaluation`,
            { orderItemId, process },
            { headers, timeout: 30000 }
        );

        if (response.data) {
            return {
                success: response.data.isSuccess,
                message: response.data.message
            };
        }

        return { success: false, error: "Beklenmeyen yanıt formatı" };

    } catch (error) {
        logger.error("[ÇiçekSepeti] İade değerlendirme hatası", { error: error.message });
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    // Sipariş
    getOrders,
    getCanceledOrders,

    // Kargo
    getCargoCode,
    updateOrderStatus,

    // Ürün
    getProducts,
    createProducts,
    updateProducts,
    updatePriceAndStock,
    getBatchStatus,

    // Kategori
    getCategories,
    getCategoryAttributes,

    // Ürün Soruları
    getSellerQuestions,
    answerSellerQuestion,

    // Fatura
    sendInvoice,

    // İade
    startRefundProcess,
    evaluateCancellation
};
