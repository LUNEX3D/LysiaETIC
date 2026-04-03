const axios = require("axios");
const moment = require("moment");
const _ = require("lodash");
const logger = require("../config/logger");

const fetchTrendyolOrders = async (sellerId, apiKey, apiSecret, startDate, endDate) => {
    try {
        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
        const userAgent = `${sellerId} - SelfIntegration`;
        let orders = [];
        let currentStart = startDate;

        while (currentStart < endDate) {
            const currentEnd = Math.min(currentStart + 14 * 24 * 60 * 60 * 1000, endDate);
            let page = 0;
            let totalPages = 1;

            do {
                const apiUrl = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/orders` +
                    `?page=${page}` +
                    `&size=200` +
                    `&startDate=${currentStart}` +
                    `&endDate=${currentEnd}` +
                    `&orderByField=PackageLastModifiedDate` +
                    `&orderByDirection=DESC`;

                const response = await axios.get(apiUrl, {
                    headers: {
                        Authorization: authHeader,
                        "User-Agent": userAgent,
                        "Content-Type": "application/json"
                    }
                });

                if (!response.data || !Array.isArray(response.data.content)) break;

                orders.push(...response.data.content.map(pkg => ({
                    orderNumber: pkg.orderNumber,
                    customerName: pkg.shipmentAddress?.fullName || "Unknown",
                    totalPrice: pkg.grossAmount ? pkg.grossAmount.toFixed(2) : "0.00",
                    status: pkg.status,
                    orderDate: new Date(pkg.orderDate).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
                    orderDateRaw: pkg.orderDate, // epoch ms — sync için
                    products: pkg.lines.map(line => ({
                        productName: line.productName,
                        quantity: line.quantity,
                        price: line.amount || line.price || 0,
                        barcode: line.barcode || line.productBarcode || "",
                        merchantSku: line.merchantSku || line.sku || "",
                        productCode: line.productCode || "",
                        imageUrl: line.imageUrl || "/default-product.jpg",
                        commissionAmount: line.commissionFee || 0
                    }))
                })));

                totalPages = response.data.totalPages;
                page++;
            } while (page < totalPages);

            currentStart = currentEnd + 1;
        }

        return orders;
    } catch (error) {
        logger.error("Trendyol orders error", { error: error.message });
        return [];
    }
};

const fetchHepsiburadaOrders = async (merchantId, serviceKey, startDate, endDate) => {
    try {
        if (!merchantId || !serviceKey) {
            logger.warn("Hepsiburada: MerchantId veya ServiceKey eksik");
            return [];
        }

        logger.info("📦 [Hepsiburada] Marketplace Orders API ile siparişler çekiliyor...", {
            merchantId: merchantId.substring(0, 8) + "...",
            startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
            endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss')
        });

        // Marketplace Orders API için Basic Auth (username:password formatında)
        const credentials = `${merchantId}:${serviceKey}`;
        const authHeader = `Basic ${Buffer.from(credentials, "utf-8").toString("base64")}`;

        const headers = {
            "Authorization": authHeader,
            "User-Agent": "lysiaaccessory_dev", // ⚠️ ÖNEMLİ: Mailden gelen User-Agent
            "Content-Type": "application/json"
        };

        // Tarih formatı: YYYY-MM-DD HH:mm:ss
        const formattedStartDate = moment(startDate).format('YYYY-MM-DD HH:mm:ss');
        const formattedEndDate = moment(endDate).format('YYYY-MM-DD HH:mm:ss');

        const allOrders = [];
        let currentOffset = 0;
        const limit = 200; // Maksimum 200

        // ⚠️ ÖNEMLİ: Ortam seçimi (TEST vs PRODUCTION)
        // TEST ortamı: marketplace-sit.hepsiburada.com
        // PRODUCTION ortamı: marketplace.hepsiburada.com
        const USE_TEST_ENV = false; // false = PRODUCTION (gerçek siparişler için)

        const BASE_URL = USE_TEST_ENV
            ? "https://marketplace-sit.hepsiburada.com"
            : "https://marketplace.hepsiburada.com";

        logger.info(`🌍 [Hepsiburada] Ortam: ${USE_TEST_ENV ? 'TEST (SIT)' : 'PRODUCTION'}`);

        // Pagination ile tüm siparişleri çek
        let hasMorePages = true;

        while (hasMorePages) {
            try {
                const url = `${BASE_URL}/orders?` +
                    `startDate=${encodeURIComponent(formattedStartDate)}` +
                    `&endDate=${encodeURIComponent(formattedEndDate)}` +
                    `&offset=${currentOffset}` +
                    `&limit=${limit}`;

                logger.info(`🔍 [Hepsiburada] Offset ${currentOffset} çekiliyor...`);

                const response = await axios.get(url, { headers, timeout: 30000 });

                if (response.status === 200) {
                    const data = response.data;
                    const orders = data?.orders || data?.data || data?.content || [];

                    if (!Array.isArray(orders) || orders.length === 0) {
                        logger.info(`✅ [Hepsiburada] Daha fazla sipariş yok`);
                        hasMorePages = false;
                        break;
                    }

                    logger.info(`✅ [Hepsiburada] ${orders.length} sipariş bulundu (Offset: ${currentOffset})`);

                    // Siparişleri formatla ve ekle
                    const formattedOrders = orders.map(order => ({
                        orderNumber: order.orderNumber || order.merchantOrderNumber || order.id,
                        orderDate: order.orderDate || order.createdDate || order.orderCreatedDate
                            ? new Date(order.orderDate || order.createdDate || order.orderCreatedDate).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
                            : 'Bilinmiyor',
                        customerName: order.customerName || order.customerId || order.buyerName || 'Hepsiburada Müşteri',
                        totalPrice: order.totalPrice?.toFixed?.(2) ||
                            order.totalAmount?.toFixed?.(2) ||
                            order.grandTotal?.toFixed?.(2) ||
                            Number(order.totalPrice || order.totalAmount || 0).toFixed(2),
                        status: order.status || 'UNKNOWN',
                        trackingNumber: order.trackingNumber || order.cargoTrackingNumber || 'Yok',
                        cargoCompany: order.cargoCompany || order.cargoProviderName || 'Bilinmiyor',
                        products: Array.isArray(order.items) && order.items.length > 0
                            ? order.items.map(item => ({
                                productId: item.sku || item.merchantSku || item.barcode || item.id,
                                productName: item.productName || item.name || item.title || 'Ürün',
                                quantity: item.quantity || 1,
                                price: item.price?.toFixed?.(2) ||
                                    item.unitPrice?.toFixed?.(2) ||
                                    Number(item.price || item.unitPrice || 0).toFixed(2),
                                imageUrl: item.imageUrl || item.image || '/default-product.jpg',
                                sku: item.sku || item.merchantSku
                            }))
                            : Array.isArray(order.orderItems) && order.orderItems.length > 0
                                ? order.orderItems.map(item => ({
                                    productId: item.sku || item.merchantSku || item.barcode || item.id,
                                    productName: item.productName || item.name || 'Ürün',
                                    quantity: item.quantity || 1,
                                    price: item.unitPrice?.toFixed?.(2) || Number(item.unitPrice || 0).toFixed(2),
                                    imageUrl: item.imageUrl || '/default-product.jpg',
                                    sku: item.sku || item.merchantSku
                                }))
                                : [{
                                    productId: order.sku || order.merchantSku,
                                    productName: order.productName || 'Ürün',
                                    quantity: 1,
                                    price: '0.00',
                                    imageUrl: '/default-product.jpg'
                                }]
                    }));

                    allOrders.push(...formattedOrders);

                    // Pagination kontrolü
                    if (orders.length < limit) {
                        hasMorePages = false;
                    } else {
                        currentOffset += limit;
                        // Rate limiting için kısa bekleme
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } else {
                    logger.warn(`⚠️ [Hepsiburada] Beklenmeyen status kodu: ${response.status}`);
                    hasMorePages = false;
                }
            } catch (err) {
                if (err.response?.status === 401) {
                    logger.error("❌ [Hepsiburada] 401 Unauthorized - Credentials hatalı!");
                    throw new Error("Hepsiburada credentials hatalı veya süresi dolmuş");
                } else if (err.response?.status === 404) {
                    logger.info(`ℹ️ [Hepsiburada] Sipariş bulunamadı`);
                    hasMorePages = false;
                } else {
                    logger.error(`❌ [Hepsiburada] API hatası (Offset: ${currentOffset})`, {
                        error: err.message,
                        status: err.response?.status
                    });
                    hasMorePages = false;
                }
            }
        }

        // Tekrar eden siparişleri temizle (orderNumber'a göre unique)
        const uniqueOrders = Array.from(
            new Map(allOrders.map(order => [order.orderNumber, order])).values()
        );

        logger.info(`✅ [Hepsiburada] Toplam ${uniqueOrders.length} benzersiz sipariş çekildi`);

        return uniqueOrders;
    } catch (error) {
        logger.error("❌ [Hepsiburada] Sipariş çekme hatası", {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        return [];
    }
};

const fetchN11Orders = async (apiKey, secretKey, startDate, endDate) => {
    const orders = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
        const url = `https://api.n11.com/rest/delivery/v1/shipmentPackages` +
            `?startDate=${startDate}` +
            `&endDate=${endDate}` +
            `&page=${page}` +
            `&size=100` +
            `&orderByDirection=DESC` +
            `&orderByField=true`;

        try {
            // HTTP header'ları sadece ASCII kabul eder — Türkçe karakterleri temizle
            const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");
            const response = await axios.get(url, {
                headers: {
                    appkey: cleanAscii(apiKey),
                    appsecret: cleanAscii(secretKey),
                    "Content-Type": "application/json"
                }
            });

            const data = response.data?.content || [];
            if (!data.length) break;

            data.forEach(pkg => {
                const totalAmount = pkg.lines.reduce((sum, line) => sum + Number(line.sellerInvoiceAmount || 0), 0);

                orders.push({
                    orderNumber: pkg.orderNumber,
                    orderDate: pkg.packageHistories?.[0]?.createdDate
                        ? moment(pkg.packageHistories[0].createdDate).format("DD-MM-YYYY HH:mm")
                        : "Bilinmiyor",
                    orderDateRaw: pkg.packageHistories?.[0]?.createdDate || null,
                    customerName: pkg.customerfullName,
                    totalPrice: totalAmount.toFixed(2),
                    status: pkg.shipmentPackageStatus,
                    trackingNumber: pkg.cargoTrackingNumber || "Yok",
                    cargoCompany: pkg.cargoProviderName || "Bilinmiyor",
                    products: pkg.lines.map(line => ({
                        productName: line.productName,
                        quantity: line.quantity,
                        price: Number(line.sellerInvoiceAmount || line.price || 0),
                        barcode: line.barcode || line.productBarcode || "",
                        merchantSku: line.merchantSku || line.sku || "",
                        productCode: line.productCode || "",
                        imageUrl: "/default-product.jpg"
                    }))
                });
            });

            totalPages = response.data.totalPages;
            page++;
        } catch (err) {
            logger.error("N11 API error", { error: err.message });
            break;
        }
    }

    return orders;
};

/**
 * ÇiçekSepeti Sipariş Çekme
 * Resmi API: POST /api/v1/Order/GetOrders
 * Header: x-api-key + user-agent (SatıcıID - EntegratörAdı)
 * NOT: Aynı parametrelerle dakikada 1 istek, tarih aralığı max 2 hafta
 * @param {string} apiKey - ÇiçekSepeti API Key (x-api-key)
 * @param {string} sellerId - Satıcı ID (user-agent için)
 * @param {string} integratorName - Entegratör adı (opsiyonel, user-agent için)
 */
const fetchCicekSepetiOrders = async (apiKey, sellerId, integratorName) => {
    const orders = [];
    let page = 0;
    const pageSize = 100;
    let lastRequestTime = 0;

    try {
        const endDate = moment().endOf("day");
        const startDate = moment().subtract(14, "days").startOf("day");

        // Rate limit: farklı request body ile 5 saniyede 1 kez
        const enforceRateLimit = async () => {
            const now = Date.now();
            const elapsed = now - lastRequestTime;
            if (lastRequestTime > 0 && elapsed < 5000) {
                await new Promise(resolve => setTimeout(resolve, 5000 - elapsed));
            }
            lastRequestTime = Date.now();
        };

        // HTTP header'ları sadece ASCII kabul eder — Türkçe karakterleri temizle
        const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
        const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
        const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : cleanSellerId;

        const headers = {
            "x-api-key": apiKey,
            "user-agent": userAgent || "CicekSepetiIntegration",
            "Content-Type": "application/json"
        };

        while (true) {
            await enforceRateLimit();

            const payload = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                pageSize,
                page
            };

            try {
                const response = await axios.post(
                    "https://apis.ciceksepeti.com/api/v1/Order/GetOrders",
                    payload,
                    { headers, timeout: 30000 }
                );

                const items = response.data?.supplierOrderListWithBranch || [];
                const totalCount = response.data?.orderListCount || 0;

                if (!items.length) break;

                orders.push(...items.map(order => ({
                    orderNumber: order.orderId?.toString(),
                    orderItemId: order.orderItemId,
                    orderDate: moment(`${order.orderCreateDate} ${order.orderCreateTime}`, "DD/MM/YYYY HH:mm").isValid()
                        ? moment(`${order.orderCreateDate} ${order.orderCreateTime}`, "DD/MM/YYYY HH:mm").format("DD-MM-YYYY HH:mm")
                        : order.orderCreateDate,
                    customerName: order.receiverName || order.senderName || "Bilinmiyor",
                    totalPrice: (order.totalPrice || 0).toFixed(2),
                    status: order.orderProductStatus || "Bilinmiyor",
                    trackingNumber: order.cargoNumber || "",
                    cargoCompany: order.cargoCompany || "",
                    products: [{
                        productName: order.name || "Ürün",
                        quantity: order.quantity || 1,
                        price: (order.itemPrice || 0).toFixed(2),
                        imageUrl: "/default-product.jpg",
                        barcode: order.barcode || "",
                        productCode: order.productCode || order.code || ""
                    }]
                })));

                logger.info(`[ÇiçekSepeti] Sayfa ${page}: ${items.length} sipariş çekildi (toplam: ${totalCount})`);

                if (items.length < pageSize) break;
                page++;
            } catch (err) {
                if (err.response?.status === 401) {
                    logger.error("[ÇiçekSepeti] API Key geçersiz (401 Unauthorized)");
                    break;
                }
                if (err.response?.status === 429) {
                    logger.warn("[ÇiçekSepeti] Rate limit aşıldı, 60sn bekleniyor...");
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    continue;
                }
                throw err;
            }
        }

        logger.info(`✅ [ÇiçekSepeti] Toplam ${orders.length} sipariş çekildi`);
        return orders;
    } catch (err) {
        logger.error("[ÇiçekSepeti] Sipariş çekme hatası", { error: err.message });
        return [];
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🆕 DİĞER PLATFORMLAR İÇİN SİPARİŞ ÇEKME FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════════════

/**
 * Amazon Türkiye/Europe/USA Siparişleri
 * Amazon SP-API kullanır (MWS deprecated)
 */
const fetchAmazonOrders = async (sellerId, mwsAuthToken, accessKey, secretKey, marketplaceId, startDate, endDate) => {
    try {

        // Amazon SP-API endpoint
        const region = marketplaceId.startsWith('A1') ? 'eu-west-1' : 'us-east-1';
        const endpoint = `https://sellingpartnerapi-${region}.amazon.com`;

        // Tarih formatı: ISO 8601
        const createdAfter = new Date(startDate).toISOString();
        const createdBefore = new Date(endDate).toISOString();

        const url = `${endpoint}/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${createdAfter}&CreatedBefore=${createdBefore}`;

        // Not: Amazon SP-API AWS Signature V4 gerektirir
        // Bu basitleştirilmiş bir örnektir, gerçek implementasyon için aws4 paketi kullanılmalı

        const response = await axios.get(url, {
            headers: {
                'x-amz-access-token': mwsAuthToken,
                'Content-Type': 'application/json'
            }
        });

        const orders = (response.data?.payload?.Orders || []).map(order => ({
            orderNumber: order.AmazonOrderId,
            orderDate: new Date(order.PurchaseDate).toLocaleString('tr-TR'),
            customerName: order.BuyerInfo?.BuyerName || 'Amazon Customer',
            totalPrice: order.OrderTotal?.Amount || '0.00',
            status: order.OrderStatus,
            products: [] // Ürünler için ayrı API çağrısı gerekir
        }));

        return orders;
    } catch (error) {
        logger.error('Amazon API error', { error: error.message });
        return [];
    }
};

/**
 * eBay Siparişleri
 * eBay Trading API kullanır
 */
const fetchEbayOrders = async (appId, devId, certId, userToken, siteId, startDate, endDate) => {
    try {

        const createdFrom = new Date(startDate).toISOString();
        const createdTo = new Date(endDate).toISOString();

        // eBay Trading API XML request
        const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
            <GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
                <RequesterCredentials>
                    <eBayAuthToken>${userToken}</eBayAuthToken>
                </RequesterCredentials>
                <CreateTimeFrom>${createdFrom}</CreateTimeFrom>
                <CreateTimeTo>${createdTo}</CreateTimeTo>
                <OrderRole>Seller</OrderRole>
                <OrderStatus>All</OrderStatus>
            </GetOrdersRequest>`;

        const response = await axios.post('https://api.ebay.com/ws/api.dll', xmlRequest, {
            headers: {
                'X-EBAY-API-SITEID': siteId,
                'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                'X-EBAY-API-CALL-NAME': 'GetOrders',
                'X-EBAY-API-APP-NAME': appId,
                'X-EBAY-API-DEV-NAME': devId,
                'X-EBAY-API-CERT-NAME': certId,
                'Content-Type': 'text/xml'
            }
        });

        // XML parsing gerekir (xml2js paketi kullanılabilir)
        return [];
    } catch (error) {
        logger.error('eBay API error', { error: error.message });
        return [];
    }
};

/**
 * GittiGidiyor Siparişleri (Platform kapatıldı - eski entegrasyonlar için)
 */
const fetchGittiGidiyorOrders = async (apiKey, secretKey, role, nick, startDate, endDate) => {
    try {
        logger.warn('GittiGidiyor platform kapatıldı');
        return [];
    } catch (error) {
        logger.error('GittiGidiyor API error', { error: error.message });
        return [];
    }
};

/**
 * Morhipo Siparişleri
 */
const fetchMorhipoOrders = async (supplierId, apiKey, apiSecret, startDate, endDate) => {
    try {

        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

        const response = await axios.get(`https://api.morhipo.com/v1/suppliers/${supplierId}/orders`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            params: {
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString()
            }
        });

        const orders = (response.data?.orders || []).map(order => ({
            orderNumber: order.orderNumber,
            orderDate: new Date(order.orderDate).toLocaleString('tr-TR'),
            customerName: order.customerName || 'Müşteri',
            totalPrice: order.totalAmount?.toFixed(2) || '0.00',
            status: order.status,
            products: (order.items || []).map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.price?.toFixed(2) || '0.00'
            }))
        }));

        return orders;
    } catch (error) {
        logger.error('Morhipo API error', { error: error.message });
        return [];
    }
};

/**
 * PttAVM Siparişleri
 */
const fetchPttAVMOrders = async (merchantCode, apiKey, apiSecret, startDate, endDate) => {
    try {

        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

        const response = await axios.get(`https://api.pttavm.com/v1/merchants/${merchantCode}/orders`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            params: {
                startDate: moment(startDate).format('YYYY-MM-DD'),
                endDate: moment(endDate).format('YYYY-MM-DD')
            }
        });

        const orders = (response.data?.data || []).map(order => ({
            orderNumber: order.orderNumber,
            orderDate: new Date(order.createdAt).toLocaleString('tr-TR'),
            customerName: order.shippingAddress?.fullName || 'Müşteri',
            totalPrice: order.totalPrice?.toFixed(2) || '0.00',
            status: order.orderStatus,
            products: (order.orderItems || []).map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.unitPrice?.toFixed(2) || '0.00'
            }))
        }));

        return orders;
    } catch (error) {
        logger.error('PttAVM API error', { error: error.message });
        return [];
    }
};

/**
 * Teknosa Siparişleri
 */
const fetchTeknosaOrders = async (supplierId, apiKey, apiPassword, startDate, endDate) => {
    try {

        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiPassword}`).toString('base64')}`;

        const response = await axios.get(`https://api.teknosa.com/marketplace/v1/suppliers/${supplierId}/orders`, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            params: {
                startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
                endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss')
            }
        });

        const orders = (response.data?.orders || []).map(order => ({
            orderNumber: order.orderNumber,
            orderDate: new Date(order.orderDate).toLocaleString('tr-TR'),
            customerName: order.customerInfo?.name || 'Müşteri',
            totalPrice: order.totalAmount?.toFixed(2) || '0.00',
            status: order.orderStatus,
            products: (order.orderLines || []).map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.unitPrice?.toFixed(2) || '0.00'
            }))
        }));

        return orders;
    } catch (error) {
        logger.error('Teknosa API error', { error: error.message });
        return [];
    }
};

/**
 * ePttAVM Siparişleri
 */
const fetchEPttAVMOrders = async (merchantId, apiKey, apiSecret, startDate, endDate) => {
    try {

        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

        const response = await axios.get(`https://api.epttavm.com/v1/orders`, {
            headers: {
                'Authorization': authHeader,
                'X-Merchant-Id': merchantId,
                'Content-Type': 'application/json'
            },
            params: {
                startDate: moment(startDate).format('YYYY-MM-DD'),
                endDate: moment(endDate).format('YYYY-MM-DD')
            }
        });

        const orders = (response.data?.orders || []).map(order => ({
            orderNumber: order.orderNumber,
            orderDate: new Date(order.orderDate).toLocaleString('tr-TR'),
            customerName: order.customerName || 'Müşteri',
            totalPrice: order.totalPrice?.toFixed(2) || '0.00',
            status: order.status,
            products: (order.items || []).map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.price?.toFixed(2) || '0.00'
            }))
        }));

        return orders;
    } catch (error) {
        logger.error('ePttAVM API error', { error: error.message });
        return [];
    }
};

module.exports = {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders,
    fetchAmazonOrders,
    fetchEbayOrders,
    fetchGittiGidiyorOrders,
    fetchMorhipoOrders,
    fetchPttAVMOrders,
    fetchTeknosaOrders,
    fetchEPttAVMOrders
};
