const axios = require("axios");
const aws4 = require("aws4");
const qs = require("querystring");
const logger = require("../../config/logger");

// ═══════════════════════════════════════════════════════════════════════
// 🛒 AMAZON SP-API SERVİSİ
// Java Recipe kodlarından Node.js'e çevrildi
// Kaynak: https://developer-docs.amazon.com/sp-api/lang-tr_TR/recipes
// ═══════════════════════════════════════════════════════════════════════

// ── Marketplace ID'leri ──
const MARKETPLACE_IDS = {
    TR: "A33AVAJ2PDY3EV",
    DE: "A1PA6795UKMFR9",
    UK: "A1F83G8C2ARO7P",
    FR: "A13V1IB3VIYZZH",
    IT: "APJ6JRA9NG5V4",
    ES: "A1RKKUPIHCS9HS",
    NL: "A1805IZSGTT6HS",
    SE: "A2NODRKZP88ZB9",
    PL: "A1C3SOZRARQ6R3",
    US: "ATVPDKIKX0DER",
    CA: "A2EUQ1WTGCTBG2",
    MX: "A1AM78C64UM0Y8",
    JP: "A1VC38T7YXB528",
    AU: "A39IBJ37TRP1C6",
    SG: "A19VAU5U5O7RUS",
    AE: "A2VIGQ35RCS4UG",
    SA: "A17E79C6D8DWNP",
    IN: "A21TJRUUN4KGV",
    BR: "A2Q3Y263D00KWC"
};

// ── Region → Host eşleştirmesi ──
const REGION_HOST_MAP = {
    "eu-west-1": "sellingpartnerapi-eu.amazon.com",
    "us-east-1": "sellingpartnerapi-na.amazon.com",
    "us-west-2": "sellingpartnerapi-na.amazon.com",
    "ap-southeast-1": "sellingpartnerapi-fe.amazon.com",
    "ap-northeast-1": "sellingpartnerapi-fe.amazon.com"
};

// ── Marketplace → Region eşleştirmesi ──
const MARKETPLACE_REGION_MAP = {
    // Europe
    A33AVAJ2PDY3EV: "eu-west-1", // TR
    A1PA6795UKMFR9: "eu-west-1", // DE
    A1F83G8C2ARO7P: "eu-west-1", // UK
    A13V1IB3VIYZZH: "eu-west-1", // FR
    APJ6JRA9NG5V4: "eu-west-1",  // IT
    A1RKKUPIHCS9HS: "eu-west-1", // ES
    A1805IZSGTT6HS: "eu-west-1", // NL
    A2NODRKZP88ZB9: "eu-west-1", // SE
    A1C3SOZRARQ6R3: "eu-west-1", // PL
    A2VIGQ35RCS4UG: "eu-west-1", // AE
    A17E79C6D8DWNP: "eu-west-1", // SA
    A21TJRUUN4KGV: "eu-west-1",  // IN
    // North America
    ATVPDKIKX0DER: "us-east-1",  // US
    A2EUQ1WTGCTBG2: "us-east-1", // CA
    A1AM78C64UM0Y8: "us-east-1", // MX
    A2Q3Y263D00KWC: "us-east-1", // BR
    // Far East
    A1VC38T7YXB528: "us-west-2", // JP
    A39IBJ37TRP1C6: "us-west-2", // AU
    A19VAU5U5O7RUS: "us-west-2"  // SG
};

const REQUEST_TIMEOUT = 30000;
const RATE_LIMIT_DELAY = 1000; // 1 saniye bekleme (burst rate koruması)

// ═══════════════════════════════════════════════════════════════════════
// 🔐 AUTH — Login with Amazon (LWA) Token
// ═══════════════════════════════════════════════════════════════════════

/**
 * LWA Access Token al
 * Java karşılığı: ApiUtils.getAccessToken()
 * @param {string} clientId - LWA Client ID
 * @param {string} clientSecret - LWA Client Secret
 * @param {string} refreshToken - LWA Refresh Token
 * @returns {string} access_token
 */
const getLwaAccessToken = async (clientId, clientSecret, refreshToken) => {
    try {
        const body = qs.stringify({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret
        });

        const response = await axios.post("https://api.amazon.com/auth/o2/token", body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: REQUEST_TIMEOUT
        });

        if (!response.data?.access_token) {
            throw new Error("LWA token yanıtında access_token bulunamadı");
        }

        return response.data.access_token;
    } catch (error) {
        logger.error("[Amazon] LWA token alma hatası", { error: error.message });
        throw new Error(`Amazon LWA token hatası: ${error.message}`);
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🌐 SIGNED REQUEST — AWS Signature V4
// ═══════════════════════════════════════════════════════════════════════

/**
 * Region ve host bilgisini credentials'tan belirle
 */
const resolveEndpoint = (credentials) => {
    const marketplaceId = credentials.marketplaceId || MARKETPLACE_IDS.TR;
    const region = credentials.region
        || MARKETPLACE_REGION_MAP[marketplaceId]
        || process.env.AMAZON_REGION
        || "eu-west-1";
    const host = credentials.host
        || REGION_HOST_MAP[region]
        || process.env.AMAZON_API_HOST
        || "sellingpartnerapi-eu.amazon.com";
    return { region, host, marketplaceId };
};

/**
 * AWS Signature V4 ile imzalı istek at
 * Java karşılığı: ApiUtils sınıfındaki tüm API client oluşturma fonksiyonları
 * @param {object} params - { credentials, path, method, data, query }
 */
const signedRequest = async ({ credentials, path, method = "GET", data = null, query = null }) => {
    const { clientId, clientSecret, refreshToken, accessKeyId, secretAccessKey, sessionToken } = credentials;
    const { region, host } = resolveEndpoint(credentials);

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Amazon AWS credentials (accessKeyId, secretAccessKey) eksik");
    }
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Amazon LWA credentials (clientId, clientSecret, refreshToken) eksik");
    }

    // 1. LWA Access Token al
    const accessToken = await getLwaAccessToken(clientId, clientSecret, refreshToken);

    // 2. Query string ekle
    let fullPath = path;
    if (query) {
        const queryStr = qs.stringify(query);
        fullPath = `${path}?${queryStr}`;
    }

    // 3. AWS Signature V4 ile imzala
    const opts = {
        host,
        path: fullPath,
        service: "execute-api",
        region,
        method,
        headers: {
            "x-amz-access-token": accessToken,
            "Content-Type": "application/json",
            "User-Agent": "LysiaETIC/1.0"
        }
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
        opts.body = JSON.stringify(data);
    }

    const signed = aws4.sign(opts, {
        accessKeyId,
        secretAccessKey,
        sessionToken
    });

    // 4. İstek at
    const response = await axios({
        url: `https://${host}${fullPath}`,
        method,
        headers: signed.headers,
        data: data ? JSON.stringify(data) : undefined,
        timeout: REQUEST_TIMEOUT
    });

    return response.data;
};

/**
 * Rate limit korumalı istek
 */
let lastRequestTime = 0;
const rateLimitedRequest = async (params) => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (lastRequestTime > 0 && elapsed < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
    }
    lastRequestTime = Date.now();
    return signedRequest(params);
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 ORDERS API — Sipariş Yönetimi
// Java karşılığı: RetrieveOrderHandler.java
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sipariş listesi çek
 * GET /orders/v0/orders
 * @param {object} credentials
 * @param {object} params - { createdAfter, createdBefore, orderStatuses, maxResults, nextToken }
 */
const getOrders = async (credentials, params = {}) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const {
            createdAfter,
            createdBefore,
            orderStatuses,
            maxResults = 100,
            nextToken
        } = params;

        const query = {
            MarketplaceIds: marketplaceId,
            MaxResultsPerPage: Math.min(maxResults, 100)
        };

        if (createdAfter) query.CreatedAfter = new Date(createdAfter).toISOString();
        if (createdBefore) query.CreatedBefore = new Date(createdBefore).toISOString();
        if (orderStatuses) query.OrderStatuses = Array.isArray(orderStatuses) ? orderStatuses.join(",") : orderStatuses;
        if (nextToken) query.NextToken = nextToken;

        logger.info("[Amazon] Sipariş listesi çekiliyor", {
            createdAfter: query.CreatedAfter,
            createdBefore: query.CreatedBefore
        });

        const result = await rateLimitedRequest({
            credentials,
            path: "/orders/v0/orders",
            query
        });

        const orders = result?.payload?.Orders || [];
        const next = result?.payload?.NextToken || null;

        logger.info(`[Amazon] ${orders.length} sipariş çekildi`);

        return {
            success: true,
            orders,
            nextToken: next,
            totalCount: orders.length
        };
    } catch (error) {
        logger.error("[Amazon] Sipariş listesi hatası", { error: error.message });
        return { success: false, orders: [], error: error.message };
    }
};

/**
 * Tüm siparişleri sayfalayarak çek
 * @param {object} credentials
 * @param {object} params - { createdAfter, createdBefore, orderStatuses }
 */
const getAllOrders = async (credentials, params = {}) => {
    const allOrders = [];
    let nextToken = null;
    let page = 0;

    try {
        do {
            const result = await getOrders(credentials, { ...params, nextToken });
            if (!result.success) break;

            allOrders.push(...result.orders);
            nextToken = result.nextToken;
            page++;

            // Güvenlik: max 20 sayfa
            if (page >= 20) {
                logger.warn("[Amazon] Max sayfa limitine ulaşıldı (20)");
                break;
            }
        } while (nextToken);

        return { success: true, orders: allOrders, totalCount: allOrders.length };
    } catch (error) {
        logger.error("[Amazon] Tüm siparişleri çekme hatası", { error: error.message });
        return { success: false, orders: allOrders, error: error.message };
    }
};

/**
 * Sipariş detayı çek
 * GET /orders/v0/orders/{orderId}
 * Java karşılığı: ordersApi.getOrder(orderId)
 */
const getOrder = async (credentials, orderId) => {
    try {
        const result = await rateLimitedRequest({
            credentials,
            path: `/orders/v0/orders/${orderId}`
        });

        return { success: true, order: result?.payload };
    } catch (error) {
        logger.error("[Amazon] Sipariş detay hatası", { error: error.message, orderId });
        return { success: false, error: error.message };
    }
};

/**
 * Sipariş ürünlerini çek
 * GET /orders/v0/orders/{orderId}/orderItems
 * Java karşılığı: ordersApi.getOrderItems(orderId)
 */
const getOrderItems = async (credentials, orderId) => {
    try {
        const result = await rateLimitedRequest({
            credentials,
            path: `/orders/v0/orders/${orderId}/orderItems`
        });

        const items = result?.payload?.OrderItems || [];
        return {
            success: true,
            items: items.map(item => ({
                orderItemId: item.OrderItemId,
                asin: item.ASIN,
                sku: item.SellerSKU,
                title: item.Title,
                quantity: item.QuantityOrdered,
                quantityShipped: item.QuantityShipped,
                price: item.ItemPrice?.Amount ? Number(item.ItemPrice.Amount) : 0,
                currency: item.ItemPrice?.CurrencyCode || "TRY",
                tax: item.ItemTax?.Amount ? Number(item.ItemTax.Amount) : 0
            }))
        };
    } catch (error) {
        logger.error("[Amazon] Sipariş ürünleri hatası", { error: error.message, orderId });
        return { success: false, items: [], error: error.message };
    }
};

/**
 * Sipariş adres bilgisi çek
 * GET /orders/v0/orders/{orderId}/address
 */
const getOrderAddress = async (credentials, orderId) => {
    try {
        const result = await rateLimitedRequest({
            credentials,
            path: `/orders/v0/orders/${orderId}/address`
        });

        const addr = result?.payload?.ShippingAddress || {};
        return {
            success: true,
            address: {
                name: addr.Name,
                line1: addr.AddressLine1,
                line2: addr.AddressLine2,
                line3: addr.AddressLine3,
                city: addr.City,
                state: addr.StateOrRegion,
                postalCode: addr.PostalCode,
                country: addr.CountryCode,
                phone: addr.Phone
            }
        };
    } catch (error) {
        logger.error("[Amazon] Sipariş adres hatası", { error: error.message, orderId });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 💰 PRICING API — Fiyat Yönetimi
// Java karşılığı: FetchPriceHandler.java, CalculateNewPriceHandler.java
// ═══════════════════════════════════════════════════════════════════════

/**
 * SKU bazlı fiyat bilgisi çek
 * GET /products/pricing/v0/price
 * Java karşılığı: pricingApi.getPricing(marketplaceId, "Sku", null, skus, null, null)
 * @param {object} credentials
 * @param {string[]} skus - SKU listesi (max 20)
 */
const getPricing = async (credentials, skus) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);

        // Max 20 SKU per request
        const skuBatch = skus.slice(0, 20);

        const query = {
            MarketplaceId: marketplaceId,
            ItemType: "Sku",
            Skus: skuBatch.join(",")
        };

        const result = await rateLimitedRequest({
            credentials,
            path: "/products/pricing/v0/price",
            query
        });

        const prices = (result?.payload || []).map(item => {
            const offer = item.Product?.Offers?.[0];
            const buyingPrice = offer?.BuyingPrice || {};
            return {
                sku: item.SellerSKU || item.SKU,
                asin: item.ASIN,
                status: item.status,
                listingPrice: {
                    amount: buyingPrice.ListingPrice?.Amount ? Number(buyingPrice.ListingPrice.Amount) : 0,
                    currency: buyingPrice.ListingPrice?.CurrencyCode || "TRY"
                },
                shippingPrice: {
                    amount: buyingPrice.Shipping?.Amount ? Number(buyingPrice.Shipping.Amount) : 0,
                    currency: buyingPrice.Shipping?.CurrencyCode || "TRY"
                },
                landedPrice: {
                    amount: buyingPrice.LandedPrice?.Amount ? Number(buyingPrice.LandedPrice.Amount) : 0,
                    currency: buyingPrice.LandedPrice?.CurrencyCode || "TRY"
                }
            };
        });

        return { success: true, prices };
    } catch (error) {
        logger.error("[Amazon] Fiyat çekme hatası", { error: error.message });
        return { success: false, prices: [], error: error.message };
    }
};

/**
 * Rekabetçi fiyat bilgisi çek
 * GET /products/pricing/v0/competitivePrice
 * @param {object} credentials
 * @param {string[]} asins - ASIN listesi (max 20)
 */
const getCompetitivePricing = async (credentials, asins) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);

        const query = {
            MarketplaceId: marketplaceId,
            ItemType: "Asin",
            Asins: asins.slice(0, 20).join(",")
        };

        const result = await rateLimitedRequest({
            credentials,
            path: "/products/pricing/v0/competitivePrice",
            query
        });

        const prices = (result?.payload || []).map(item => {
            const compPrices = item.Product?.CompetitivePricing?.CompetitivePrices || [];
            return {
                asin: item.ASIN,
                status: item.status,
                competitivePrices: compPrices.map(cp => ({
                    condition: cp.condition,
                    belongsToRequester: cp.belongsToRequester,
                    price: {
                        listingPrice: Number(cp.Price?.ListingPrice?.Amount || 0),
                        shippingPrice: Number(cp.Price?.Shipping?.Amount || 0),
                        landedPrice: Number(cp.Price?.LandedPrice?.Amount || 0),
                        currency: cp.Price?.LandedPrice?.CurrencyCode || "TRY"
                    }
                }))
            };
        });

        return { success: true, prices };
    } catch (error) {
        logger.error("[Amazon] Rekabetçi fiyat hatası", { error: error.message });
        return { success: false, prices: [], error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📋 LISTINGS API — Ürün Listeleme & Güncelleme
// Java karşılığı: SubmitPriceHandler.java (Listings API kullanır)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Listing bilgisi çek
 * GET /listings/2021-08-01/items/{sellerId}/{sku}
 * Java karşılığı: listingsApi.getListingsItem(sellerId, itemSku, marketplaceIds, issueLocale, includedData)
 */
const getListingsItem = async (credentials, sku) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const sellerId = credentials.sellerId;

        if (!sellerId) throw new Error("Amazon sellerId eksik");

        const query = {
            marketplaceIds: marketplaceId,
            issueLocale: "tr_TR",
            includedData: "summaries,attributes,issues,offers,fulfillmentAvailability"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
            query
        });

        return { success: true, listing: result };
    } catch (error) {
        logger.error("[Amazon] Listing çekme hatası", { error: error.message, sku });
        return { success: false, error: error.message };
    }
};

/**
 * Listing fiyat güncelle (PATCH)
 * PATCH /listings/2021-08-01/items/{sellerId}/{sku}
 * Java karşılığı: listingsApi.patchListingsItem() — SubmitPriceHandler.java
 * @param {object} credentials
 * @param {string} sku
 * @param {number} newPrice - Yeni fiyat (vergi dahil)
 * @param {string} productType - Ürün tipi (default: "PRODUCT")
 */
const updateListingPrice = async (credentials, sku, newPrice, productType = "PRODUCT") => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const sellerId = credentials.sellerId;

        if (!sellerId) throw new Error("Amazon sellerId eksik");

        // Java'daki getPatchListingsRequestBody() fonksiyonunun Node.js karşılığı
        const patchBody = {
            productType,
            patches: [
                {
                    op: "replace",
                    path: "/attributes/purchasable_offer",
                    value: [
                        {
                            marketplace_id: marketplaceId,
                            currency: credentials.currency || "TRY",
                            our_price: [
                                {
                                    schedule: [
                                        { value_with_tax: newPrice }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const query = {
            marketplaceIds: marketplaceId,
            issueLocale: "tr_TR"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
            method: "PATCH",
            data: patchBody,
            query
        });

        logger.info(`[Amazon] Fiyat güncellendi: ${sku} → ${newPrice}`);
        return { success: true, result };
    } catch (error) {
        logger.error("[Amazon] Fiyat güncelleme hatası", { error: error.message, sku });
        return { success: false, error: error.message };
    }
};

/**
 * Listing stok güncelle (PATCH)
 * PATCH /listings/2021-08-01/items/{sellerId}/{sku}
 * @param {object} credentials
 * @param {string} sku
 * @param {number} quantity - Yeni stok miktarı
 * @param {string} fulfillmentChannelCode - "DEFAULT" (MFN) veya "AMAZON_NA"/"AMAZON_EU" (FBA)
 */
const updateListingStock = async (credentials, sku, quantity, fulfillmentChannelCode = "DEFAULT") => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const sellerId = credentials.sellerId;

        if (!sellerId) throw new Error("Amazon sellerId eksik");

        const patchBody = {
            productType: "PRODUCT",
            patches: [
                {
                    op: "replace",
                    path: "/attributes/fulfillment_availability",
                    value: [
                        {
                            fulfillment_channel_code: fulfillmentChannelCode,
                            quantity,
                            marketplace_id: marketplaceId
                        }
                    ]
                }
            ]
        };

        const query = {
            marketplaceIds: marketplaceId,
            issueLocale: "tr_TR"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
            method: "PATCH",
            data: patchBody,
            query
        });

        logger.info(`[Amazon] Stok güncellendi: ${sku} → ${quantity}`);
        return { success: true, result };
    } catch (error) {
        logger.error("[Amazon] Stok güncelleme hatası", { error: error.message, sku });
        return { success: false, error: error.message };
    }
};

/**
 * Yeni listing oluştur (PUT)
 * PUT /listings/2021-08-01/items/{sellerId}/{sku}
 * @param {object} credentials
 * @param {string} sku
 * @param {object} attributes - Ürün attribute'ları
 * @param {string} productType - Ürün tipi
 */
const putListingsItem = async (credentials, sku, attributes, productType) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const sellerId = credentials.sellerId;

        if (!sellerId) throw new Error("Amazon sellerId eksik");

        const body = {
            productType,
            requirements: "LISTING",
            attributes
        };

        const query = {
            marketplaceIds: marketplaceId,
            issueLocale: "tr_TR"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
            method: "PUT",
            data: body,
            query
        });

        logger.info(`[Amazon] Listing oluşturuldu: ${sku}`);
        return { success: true, result };
    } catch (error) {
        logger.error("[Amazon] Listing oluşturma hatası", { error: error.message, sku });
        return { success: false, error: error.message };
    }
};

/**
 * Listing sil
 * DELETE /listings/2021-08-01/items/{sellerId}/{sku}
 */
const deleteListingsItem = async (credentials, sku) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const sellerId = credentials.sellerId;

        if (!sellerId) throw new Error("Amazon sellerId eksik");

        const query = {
            marketplaceIds: marketplaceId,
            issueLocale: "tr_TR"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`,
            method: "DELETE",
            query
        });

        logger.info(`[Amazon] Listing silindi: ${sku}`);
        return { success: true, result };
    } catch (error) {
        logger.error("[Amazon] Listing silme hatası", { error: error.message, sku });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 CATALOG API — Ürün Arama & Detay
// Java karşılığı: Listings Recipe — Search for Products in the Catalog
// ═══════════════════════════════════════════════════════════════════════

/**
 * Katalogda ürün ara
 * GET /catalog/2022-04-01/items
 * @param {object} credentials
 * @param {object} params - { keywords, identifiers, identifiersType, pageSize, pageToken }
 */
const searchCatalogItems = async (credentials, params = {}) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const { keywords, identifiers, identifiersType, pageSize = 20, pageToken } = params;

        const query = {
            marketplaceIds: marketplaceId,
            includedData: "summaries,images,salesRanks",
            pageSize: Math.min(pageSize, 20)
        };

        if (keywords) query.keywords = keywords;
        if (identifiers) query.identifiers = Array.isArray(identifiers) ? identifiers.join(",") : identifiers;
        if (identifiersType) query.identifiersType = identifiersType; // ASIN, EAN, UPC, ISBN
        if (pageToken) query.pageToken = pageToken;

        const result = await rateLimitedRequest({
            credentials,
            path: "/catalog/2022-04-01/items",
            query
        });

        const items = (result?.items || []).map(item => ({
            asin: item.asin,
            title: item.summaries?.[0]?.itemName,
            brand: item.summaries?.[0]?.brand,
            manufacturer: item.summaries?.[0]?.manufacturer,
            productType: item.summaries?.[0]?.productType,
            images: item.images?.[0]?.images?.map(img => ({
                url: img.link,
                variant: img.variant,
                width: img.width,
                height: img.height
            })) || []
        }));

        return {
            success: true,
            items,
            totalCount: result?.numberOfResults || items.length,
            nextPageToken: result?.pagination?.nextToken
        };
    } catch (error) {
        logger.error("[Amazon] Katalog arama hatası", { error: error.message });
        return { success: false, items: [], error: error.message };
    }
};

/**
 * Katalog ürün detayı
 * GET /catalog/2022-04-01/items/{asin}
 */
const getCatalogItem = async (credentials, asin) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);

        const query = {
            marketplaceIds: marketplaceId,
            includedData: "summaries,attributes,images,salesRanks,dimensions"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/catalog/2022-04-01/items/${asin}`,
            query
        });

        return { success: true, item: result };
    } catch (error) {
        logger.error("[Amazon] Katalog detay hatası", { error: error.message, asin });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🏷️ PRODUCT TYPE DEFINITIONS — Ürün Tipi Şemaları
// Java karşılığı: Listings Recipe — Search Product Types / Get Schema
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ürün tipi ara
 * GET /definitions/2020-09-01/productTypes
 * @param {object} credentials
 * @param {string} keywords - Arama kelimesi
 */
const searchProductTypes = async (credentials, keywords) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);

        const query = {
            marketplaceIds: marketplaceId,
            keywords
        };

        const result = await rateLimitedRequest({
            credentials,
            path: "/definitions/2020-09-01/productTypes",
            query
        });

        return {
            success: true,
            productTypes: (result?.productTypes || []).map(pt => ({
                name: pt.name,
                displayName: pt.displayName,
                marketplaceIds: pt.marketplaceIds
            }))
        };
    } catch (error) {
        logger.error("[Amazon] Ürün tipi arama hatası", { error: error.message });
        return { success: false, productTypes: [], error: error.message };
    }
};

/**
 * Ürün tipi şeması çek (JSON Schema)
 * GET /definitions/2020-09-01/productTypes/{productType}
 */
const getProductTypeDefinition = async (credentials, productType) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);

        const query = {
            marketplaceIds: marketplaceId,
            requirements: "LISTING",
            locale: "tr_TR"
        };

        const result = await rateLimitedRequest({
            credentials,
            path: `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType)}`,
            query
        });

        return { success: true, schema: result?.schema, requirements: result?.requirements };
    } catch (error) {
        logger.error("[Amazon] Ürün tipi şema hatası", { error: error.message, productType });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🚚 MERCHANT FULFILLMENT API — Kargo Yönetimi
// Java karşılığı: EligibleShipmentHandler.java, CreateShipmentHandler.java
// ═══════════════════════════════════════════════════════════════════════

/**
 * Uygun kargo servislerini çek
 * POST /mfn/v0/eligibleShippingServices
 * Java karşılığı: mfnApi.getEligibleShipmentServices(request)
 */
const getEligibleShipmentServices = async (credentials, shipmentDetails) => {
    try {
        const {
            orderId,
            items,
            shipFromAddress,
            packageDimensions,
            weight
        } = shipmentDetails;

        const body = {
            ShipmentRequestDetails: {
                AmazonOrderId: orderId,
                ItemList: items.map(item => ({
                    OrderItemId: item.orderItemId,
                    Quantity: item.quantity
                })),
                ShipFromAddress: {
                    Name: shipFromAddress.name,
                    AddressLine1: shipFromAddress.line1,
                    City: shipFromAddress.city,
                    StateOrProvinceCode: shipFromAddress.state,
                    PostalCode: shipFromAddress.postalCode,
                    CountryCode: shipFromAddress.country,
                    Phone: shipFromAddress.phone,
                    Email: shipFromAddress.email
                },
                PackageDimensions: {
                    Length: packageDimensions.length,
                    Width: packageDimensions.width,
                    Height: packageDimensions.height,
                    Unit: packageDimensions.unit || "CENTIMETERS"
                },
                Weight: {
                    Value: weight.value,
                    Unit: weight.unit || "G"
                },
                ShippingServiceOptions: {
                    DeliveryExperience: "DeliveryConfirmationWithoutSignature",
                    CarrierWillPickUp: false
                }
            }
        };

        const result = await rateLimitedRequest({
            credentials,
            path: "/mfn/v0/eligibleShippingServices",
            method: "POST",
            data: body
        });

        const services = (result?.payload?.ShippingServiceList || []).map(svc => ({
            shippingServiceId: svc.ShippingServiceId,
            shippingServiceOfferId: svc.ShippingServiceOfferId,
            shippingServiceName: svc.ShippingServiceName,
            carrierName: svc.CarrierName,
            rate: {
                amount: Number(svc.Rate?.Amount || 0),
                currency: svc.Rate?.CurrencyCode || "TRY"
            },
            earliestDelivery: svc.EarliestEstimatedDeliveryDate,
            latestDelivery: svc.LatestEstimatedDeliveryDate
        }));

        return { success: true, services };
    } catch (error) {
        logger.error("[Amazon] Kargo servisleri hatası", { error: error.message });
        return { success: false, services: [], error: error.message };
    }
};

/**
 * En uygun kargo servisini seç
 * Java karşılığı: SelectShipmentHandler.java
 * @param {Array} services - getEligibleShipmentServices sonucu
 * @param {string} preference - "cheapest" veya "fastest"
 */
const selectBestShippingService = (services, preference = "cheapest") => {
    if (!services || services.length === 0) return null;

    const sorted = [...services].sort((a, b) => {
        if (preference === "cheapest") {
            return a.rate.amount - b.rate.amount;
        } else {
            // fastest: en erken teslimat
            return new Date(a.earliestDelivery) - new Date(b.earliestDelivery);
        }
    });

    return sorted[0];
};

/**
 * Kargo oluştur
 * POST /mfn/v0/shipments
 * Java karşılığı: mfnApi.createShipment(request) — CreateShipmentHandler.java
 */
const createShipment = async (credentials, shipmentDetails, shippingService) => {
    try {
        const {
            orderId,
            items,
            shipFromAddress,
            packageDimensions,
            weight
        } = shipmentDetails;

        const body = {
            ShipmentRequestDetails: {
                AmazonOrderId: orderId,
                ItemList: items.map(item => ({
                    OrderItemId: item.orderItemId,
                    Quantity: item.quantity
                })),
                ShipFromAddress: {
                    Name: shipFromAddress.name,
                    AddressLine1: shipFromAddress.line1,
                    City: shipFromAddress.city,
                    StateOrProvinceCode: shipFromAddress.state,
                    PostalCode: shipFromAddress.postalCode,
                    CountryCode: shipFromAddress.country,
                    Phone: shipFromAddress.phone,
                    Email: shipFromAddress.email
                },
                PackageDimensions: {
                    Length: packageDimensions.length,
                    Width: packageDimensions.width,
                    Height: packageDimensions.height,
                    Unit: packageDimensions.unit || "CENTIMETERS"
                },
                Weight: {
                    Value: weight.value,
                    Unit: weight.unit || "G"
                },
                ShippingServiceOptions: {
                    DeliveryExperience: "DeliveryConfirmationWithoutSignature",
                    CarrierWillPickUp: false
                }
            },
            ShippingServiceId: shippingService.shippingServiceId,
            ShippingServiceOfferId: shippingService.shippingServiceOfferId
        };

        const result = await rateLimitedRequest({
            credentials,
            path: "/mfn/v0/shipments",
            method: "POST",
            data: body
        });

        const shipment = result?.payload;
        return {
            success: true,
            shipmentId: shipment?.ShipmentId,
            trackingId: shipment?.TrackingId,
            label: shipment?.Label ? {
                format: shipment.Label.LabelFormat,
                dimensions: shipment.Label.Dimensions,
                fileContents: shipment.Label.FileContents
            } : null
        };
    } catch (error) {
        logger.error("[Amazon] Kargo oluşturma hatası", { error: error.message });
        return { success: false, error: error.message };
    }
};

/**
 * Kargo iptal et
 * DELETE /mfn/v0/shipments/{shipmentId}
 */
const cancelShipment = async (credentials, shipmentId) => {
    try {
        await rateLimitedRequest({
            credentials,
            path: `/mfn/v0/shipments/${shipmentId}`,
            method: "DELETE"
        });

        logger.info(`[Amazon] Kargo iptal edildi: ${shipmentId}`);
        return { success: true };
    } catch (error) {
        logger.error("[Amazon] Kargo iptal hatası", { error: error.message, shipmentId });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📊 INVENTORY API — Envanter/Stok Yönetimi
// Java karşılığı: InventoryCheckHandler.java
// ═══════════════════════════════════════════════════════════════════════

/**
 * FBA envanter özeti çek
 * GET /fba/inventory/v1/summaries
 * @param {object} credentials
 * @param {object} params - { skus, startDateTime, granularityType, granularityId }
 */
const getInventorySummaries = async (credentials, params = {}) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const {
            skus,
            startDateTime,
            granularityType = "Marketplace",
            granularityId,
            nextToken
        } = params;

        const query = {
            marketplaceIds: marketplaceId,
            granularityType,
            granularityId: granularityId || marketplaceId,
            details: true
        };

        if (skus && skus.length > 0) query.sellerSkus = skus.join(",");
        if (startDateTime) query.startDateTime = new Date(startDateTime).toISOString();
        if (nextToken) query.nextToken = nextToken;

        const result = await rateLimitedRequest({
            credentials,
            path: "/fba/inventory/v1/summaries",
            query
        });

        const summaries = (result?.payload?.inventorySummaries || []).map(inv => ({
            asin: inv.asin,
            sku: inv.sellerSku,
            fnSku: inv.fnSku,
            productName: inv.productName,
            condition: inv.condition,
            totalQuantity: inv.totalQuantity || 0,
            fulfillableQuantity: inv.inventoryDetails?.fulfillableQuantity || 0,
            inboundWorkingQuantity: inv.inventoryDetails?.inboundWorkingQuantity || 0,
            inboundShippedQuantity: inv.inventoryDetails?.inboundShippedQuantity || 0,
            inboundReceivingQuantity: inv.inventoryDetails?.inboundReceivingQuantity || 0,
            reservedQuantity: inv.inventoryDetails?.reservedQuantity?.totalReservedQuantity || 0,
            unfulfillableQuantity: inv.inventoryDetails?.unfulfillableQuantity?.totalUnfulfillableQuantity || 0,
            lastUpdated: inv.lastUpdatedTime
        }));

        return {
            success: true,
            summaries,
            nextToken: result?.pagination?.nextToken
        };
    } catch (error) {
        logger.error("[Amazon] Envanter çekme hatası", { error: error.message });
        return { success: false, summaries: [], error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📈 REPORTS API — Rapor Oluşturma & İndirme
// ═══════════════════════════════════════════════════════════════════════

/**
 * Rapor oluştur
 * POST /reports/2021-06-30/reports
 * @param {object} credentials
 * @param {string} reportType - Rapor tipi (örn: "GET_MERCHANT_LISTINGS_ALL_DATA")
 * @param {object} params - { startDate, endDate }
 */
const createReport = async (credentials, reportType, params = {}) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);

        const body = {
            reportType,
            marketplaceIds: [marketplaceId]
        };

        if (params.startDate) body.dataStartTime = new Date(params.startDate).toISOString();
        if (params.endDate) body.dataEndTime = new Date(params.endDate).toISOString();

        const result = await rateLimitedRequest({
            credentials,
            path: "/reports/2021-06-30/reports",
            method: "POST",
            data: body
        });

        return { success: true, reportId: result?.reportId };
    } catch (error) {
        logger.error("[Amazon] Rapor oluşturma hatası", { error: error.message });
        return { success: false, error: error.message };
    }
};

/**
 * Rapor durumu kontrol et
 * GET /reports/2021-06-30/reports/{reportId}
 */
const getReport = async (credentials, reportId) => {
    try {
        const result = await rateLimitedRequest({
            credentials,
            path: `/reports/2021-06-30/reports/${reportId}`
        });

        return {
            success: true,
            status: result?.processingStatus,
            reportDocumentId: result?.reportDocumentId,
            report: result
        };
    } catch (error) {
        logger.error("[Amazon] Rapor durumu hatası", { error: error.message, reportId });
        return { success: false, error: error.message };
    }
};

/**
 * Rapor dokümanı indir
 * GET /reports/2021-06-30/documents/{reportDocumentId}
 */
const getReportDocument = async (credentials, reportDocumentId) => {
    try {
        const result = await rateLimitedRequest({
            credentials,
            path: `/reports/2021-06-30/documents/${reportDocumentId}`
        });

        // Doküman URL'sinden içeriği indir
        if (result?.url) {
            const docResponse = await axios.get(result.url, { timeout: REQUEST_TIMEOUT });
            return { success: true, data: docResponse.data, compressionAlgorithm: result.compressionAlgorithm };
        }

        return { success: true, data: result };
    } catch (error) {
        logger.error("[Amazon] Rapor indirme hatası", { error: error.message, reportDocumentId });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🔍 LISTING RESTRICTIONS — Listeleme Kısıtlamaları
// Java karşılığı: Listings Recipe — Get the restrictions for Listing an Item
// ═══════════════════════════════════════════════════════════════════════

/**
 * Listeleme kısıtlamalarını kontrol et
 * GET /listings/2021-08-01/restrictions
 */
const getListingRestrictions = async (credentials, asin) => {
    try {
        const { marketplaceId } = resolveEndpoint(credentials);
        const sellerId = credentials.sellerId;

        const query = {
            marketplaceIds: marketplaceId,
            asin,
            conditionType: "new_new",
            sellerId
        };

        const result = await rateLimitedRequest({
            credentials,
            path: "/listings/2021-08-01/restrictions",
            query
        });

        const restrictions = (result?.restrictions || []).map(r => ({
            marketplaceId: r.marketplaceId,
            conditionType: r.conditionType,
            reasons: r.reasons?.map(reason => ({
                message: reason.message,
                reasonCode: reason.reasonCode,
                links: reason.links
            })) || []
        }));

        return { success: true, restrictions };
    } catch (error) {
        logger.error("[Amazon] Kısıtlama kontrolü hatası", { error: error.message, asin });
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🧪 TEST — Credential Doğrulama
// ═══════════════════════════════════════════════════════════════════════

/**
 * Amazon credentials test et
 * LWA token alıp basit bir API çağrısı yapar
 */
const testCredentials = async (credentials) => {
    try {
        const { clientId, clientSecret, refreshToken, accessKeyId, secretAccessKey } = credentials;

        if (!clientId || !clientSecret || !refreshToken) {
            return { success: false, message: "LWA credentials eksik (clientId, clientSecret, refreshToken)" };
        }
        if (!accessKeyId || !secretAccessKey) {
            return { success: false, message: "AWS credentials eksik (accessKeyId, secretAccessKey)" };
        }

        // 1. LWA token test
        const accessToken = await getLwaAccessToken(clientId, clientSecret, refreshToken);
        if (!accessToken) {
            return { success: false, message: "LWA token alınamadı" };
        }

        // 2. Basit API çağrısı test (sipariş listesi)
        const result = await getOrders(credentials, {
            createdAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            maxResults: 1
        });

        if (result.success) {
            return { success: true, message: "Amazon SP-API bağlantısı başarılı" };
        } else {
            return { success: false, message: `API çağrısı başarısız: ${result.error}` };
        }
    } catch (error) {
        return { success: false, message: `Bağlantı hatası: ${error.message}` };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    // Constants
    MARKETPLACE_IDS,
    MARKETPLACE_REGION_MAP,

    // Auth
    getLwaAccessToken,

    // Orders
    getOrders,
    getAllOrders,
    getOrder,
    getOrderItems,
    getOrderAddress,

    // Pricing
    getPricing,
    getCompetitivePricing,

    // Listings
    getListingsItem,
    updateListingPrice,
    updateListingStock,
    putListingsItem,
    deleteListingsItem,

    // Catalog
    searchCatalogItems,
    getCatalogItem,

    // Product Types
    searchProductTypes,
    getProductTypeDefinition,

    // Merchant Fulfillment (Kargo)
    getEligibleShipmentServices,
    selectBestShippingService,
    createShipment,
    cancelShipment,

    // Inventory
    getInventorySummaries,

    // Reports
    createReport,
    getReport,
    getReportDocument,

    // Restrictions
    getListingRestrictions,

    // Test
    testCredentials
};
