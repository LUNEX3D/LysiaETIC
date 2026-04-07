const axios = require("axios");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");

const MAX_RETRY = 3;
const PAGE_SIZE = 200;
const MAX_DAYS_PER_REQUEST = 14; // Trendyol API en fazla 14 günlük sorgu yapıyor

const getIstanbulTimestamp = (date = new Date()) => {
    return new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();
};

const convertToGMT3Timestamp = (dateStr, isStart = true) => {
    if (!dateStr) return NaN;
    const timePart = isStart ? "T00:00:00+03:00" : "T23:59:59+03:00";
    return new Date(`${dateStr}${timePart}`).getTime();
};

exports.getCargoTrackingOrders = async (req, res) => {
    try {
        // ✅ FIX H1: IDOR — req.params.userId yerine req.user._id kullanılıyor
        const userId = req.user._id;
        let { startDate, endDate, marketplace } = req.query;

        const now = getIstanbulTimestamp();
        const defaultStartDate = now - 90 * 24 * 60 * 60 * 1000;

        let convertedStartDate = startDate
            ? convertToGMT3Timestamp(startDate, true)
            : defaultStartDate;
        let convertedEndDate = endDate
            ? convertToGMT3Timestamp(endDate, false)
            : now;

        startDate = convertedStartDate;
        endDate = convertedEndDate;

        if (endDate - startDate > 90 * 24 * 60 * 60 * 1000) {
            return res.status(400).json({ error: "❌ Maksimum 3 aylık geçmiş sorgulanabilir!" });
        }

        // Marketplace filtresi varsa sadece o pazaryerini çek
        let query = { userId };
        if (marketplace && marketplace !== "all") {
            query.marketplaceName = marketplace;
        }

        const integrations = await Marketplace.find(query);
        if (!integrations.length) {
            return res.status(404).json({ error: "❌ Entegrasyon bulunamadı!" });
        }

        // **Sadece takip numarası olan ve kargoya verilmiş siparişleri almak için**
        const statusParam = "Shipped,Delivered,UnDelivered,Returned";

        // Trendyol için kargo çekme fonksiyonu
        const fetchTrendyolCargo = async (sellerId, apiKey, apiSecret, startDate, endDate) => {
            let cargoOrdersFetched = [];
            const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
            const userAgent = `${sellerId} - SelfIntegration`;

            let currentStart = startDate;
            while (currentStart < endDate) {
                let currentEnd = Math.min(currentStart + MAX_DAYS_PER_REQUEST * 24 * 60 * 60 * 1000, endDate);
                let page = 0;
                let totalPages = 1;
                let retryCount = 0;

                do {
                    const apiUrl = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/orders?page=${page}&size=${PAGE_SIZE}&orderByField=PackageLastModifiedDate&orderByDirection=DESC&startDate=${currentStart}&endDate=${currentEnd}&status=${statusParam}`;

                    try {
                        const response = await axios.get(apiUrl, {
                            headers: {
                                Authorization: authHeader,
                                "User-Agent": userAgent,
                                "Content-Type": "application/json"
                            },
                            timeout: 20000
                        });

                        if (!response.data?.content) break;
                        totalPages = response.data.totalPages;

                        const filteredOrders = response.data.content
                            .filter(pkg => pkg.cargoTrackingNumber && pkg.cargoTrackingNumber !== "Yok")
                            .filter(pkg => {
                                const orderTimestamp = new Date(pkg.orderDate).getTime();
                                return orderTimestamp >= startDate && orderTimestamp <= endDate;
                            });

                        const newCargoOrders = filteredOrders.map(pkg => ({
                            uniqueId: pkg.id,
                            orderNumber: pkg.orderNumber,
                            timestamp: new Date(pkg.orderDate).getTime(),
                            orderDate: new Date(pkg.orderDate).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
                            customerName: pkg.shipmentAddress?.fullName || "Bilinmiyor",
                            status: pkg.status,
                            trackingNumber: pkg.cargoTrackingNumber || "Yok",
                            cargoProviderName: pkg.cargoProviderName || "Bilinmiyor",
                            cargoTrackingLink: pkg.cargoTrackingLink || "",
                            marketplace: "Trendyol",
                            products: pkg.lines.map(line => ({
                                productName: line.productName,
                                quantity: line.quantity,
                                barcode: line.barcode,
                                imageUrl: line.imageUrl || "/default-image.jpg"
                            }))
                        }));

                        cargoOrdersFetched.push(...newCargoOrders);
                        page++;
                    } catch (error) {
                        logger.error(`Trendyol Cargo API error for seller ${sellerId}`, { error: error.message });
                        retryCount++;
                        if (retryCount >= MAX_RETRY) break;
                    }
                } while (page < totalPages);

                currentStart = currentEnd + 1;
            }

            return cargoOrdersFetched;
        };

        // N11 için kargo çekme fonksiyonu
        const fetchN11Cargo = async (apiKey, secretKey, startDate, endDate) => {
            let cargoOrdersFetched = [];
            let page = 0;
            let totalPages = 1;

            try {
                while (page < totalPages) {
                    const url = `https://api.n11.com/rest/delivery/v1/shipmentPackages` +
                        `?startDate=${startDate}` +
                        `&endDate=${endDate}` +
                        `&page=${page}` +
                        `&size=100` +
                        `&orderByDirection=DESC` +
                        `&orderByField=true`;

                    const response = await axios.get(url, {
                        headers: {
                            appkey: apiKey,
                            appsecret: secretKey,
                            "Content-Type": "application/json"
                        },
                        timeout: 20000
                    });

                    const data = response.data?.content || [];
                    if (!data.length) break;

                    // Sadece kargoya verilmiş siparişleri filtrele
                    const filteredOrders = data.filter(pkg =>
                        pkg.cargoTrackingNumber &&
                        pkg.cargoTrackingNumber !== "Yok" &&
                        (pkg.shipmentPackageStatus === "Shipped" ||
                         pkg.shipmentPackageStatus === "Delivered" ||
                         pkg.shipmentPackageStatus === "Returned" ||
                         pkg.shipmentPackageStatus === "UnDelivered")
                    );

                    const newCargoOrders = filteredOrders.map(pkg => ({
                        uniqueId: pkg.id,
                        orderNumber: pkg.orderNumber,
                        timestamp: pkg.packageHistories?.[0]?.createdDate
                            ? new Date(pkg.packageHistories[0].createdDate).getTime()
                            : Date.now(),
                        orderDate: pkg.packageHistories?.[0]?.createdDate
                            ? new Date(pkg.packageHistories[0].createdDate).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
                            : "Bilinmiyor",
                        customerName: pkg.customerfullName || "Bilinmiyor",
                        status: pkg.shipmentPackageStatus,
                        trackingNumber: pkg.cargoTrackingNumber || "Yok",
                        cargoProviderName: pkg.cargoProviderName || "Bilinmiyor",
                        cargoTrackingLink: pkg.cargoTrackingLink || "",
                        marketplace: "N11",
                        products: pkg.lines.map(line => ({
                            productName: line.productName,
                            quantity: line.quantity,
                            barcode: line.barcode || "",
                            imageUrl: "/default-image.jpg"
                        }))
                    }));

                    cargoOrdersFetched.push(...newCargoOrders);
                    totalPages = response.data.totalPages || 1;
                    page++;

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                return cargoOrdersFetched;
            } catch (error) {
                logger.error("N11 Cargo API error", { error: error.message });
                return [];
            }
        };

        // Hepsiburada için kargo çekme fonksiyonu
        // Hepsiburada OMS API: oms-external.hepsiburada.com
        // Dokümantasyon: https://developers.hepsiburada.com/hepsiburada/reference/siparis-entegrasyonu-onemli-bilgiler
        //
        // Strateji:
        //   1) Paket Bilgilerini Listeleme → tüm paketler (barcode, cargoCompany, packageNumber, items)
        //   2) Her paket için Kargo Bilgilerini Listeleme → trackingInfoCode, trackingInfoUrl, status
        //
        // Parametreler (dokümantasyondan):
        //   - beginDate & endDate: 24 saatlik aralıklar (zorunlu)
        //   - VEYA timespan: saat cinsinden (tek başına max 24)
        //   - limit: max 10 (limit-offset ile birlikte)
        //   - offset: pagination
        const fetchHepsiburadaCargo = async (merchantId, authUser, authPass, startDate, endDate) => {
            let cargoOrdersFetched = [];

            try {
                if (!merchantId || !authUser || !authPass) {
                    logger.warn("[Hepsiburada Cargo] MerchantId veya Auth bilgileri eksik");
                    return [];
                }

                // Debug: credential'ların gelip gelmediğini logla (değerleri değil, varlığını)
                logger.info(`🔑 [Hepsiburada Cargo] Auth — merchantId: ${merchantId?.substring(0, 6)}..., authUser: ${authUser?.substring(0, 6)}..., authPass: ${authPass ? "***(" + authPass.length + " chars)" : "MISSING"}`);

                const authHeader = `Basic ${Buffer.from(`${authUser}:${authPass}`, "utf-8").toString("base64")}`;
                const headers = {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                    "User-Agent": "LysiaETIC"
                };

                const OMS_BASE = "https://oms-external.hepsiburada.com";
                const seenPackages = new Set();

                // ── Tarih aralığını 24 saatlik dilimlere böl ──
                // stockCronService 2 saatlik dilim kullanıyor, biz 90 güne kadar çektiğimiz için 24h
                const ONE_DAY_MS = 24 * 60 * 60 * 1000;
                const timeWindows = [];
                let windowStart = startDate;
                while (windowStart < endDate) {
                    const windowEnd = Math.min(windowStart + ONE_DAY_MS, endDate);
                    timeWindows.push({ begin: windowStart, end: windowEnd });
                    windowStart = windowEnd;
                }

                logger.info(`📦 [Hepsiburada Cargo] OMS Packages API — ${timeWindows.length} adet 24h dilim ile çekilecek`);

                // ── 1) Her 24 saatlik dilim için paketleri çek ──
                for (const window of timeWindows) {
                    const beginDate = new Date(window.begin).toISOString();
                    const endDateStr = new Date(window.end).toISOString();

                    let offset = 0;
                    const limit = 50; // stockCronService ile aynı limit
                    let hasMore = true;

                    while (hasMore) {
                        try {
                            const url = `${OMS_BASE}/packages/merchantid/${merchantId}` +
                                `?startDate=${encodeURIComponent(beginDate)}` +
                                `&endDate=${encodeURIComponent(endDateStr)}` +
                                `&limit=${limit}&offset=${offset}`;

                            const response = await axios.get(url, { headers, timeout: 20000 });

                            // Response header'dan totalCount alınabilir
                            const rawData = response.data;
                            // API array veya object dönebilir
                            const packages = Array.isArray(rawData) ? rawData : (rawData?.packages || rawData?.content || []);

                            if (!Array.isArray(packages) || packages.length === 0) {
                                hasMore = false;
                                break;
                            }

                            for (const pkg of packages) {
                                const packageNumber = String(pkg.packageNumber || pkg.id || "");
                                if (!packageNumber || seenPackages.has(packageNumber)) continue;
                                seenPackages.add(packageNumber);

                                // Paket bilgilerinden kargo verilerini çıkar
                                const barcode = pkg.barcode || "";
                                const cargoCompany = pkg.cargoCompany || "Bilinmiyor";
                                const orderNumber = String(pkg.orderNumber || packageNumber);
                                const recipientName = pkg.recipientName || pkg.customerName || pkg.customerId || "Hepsiburada Müşteri";
                                const pkgStatus = pkg.status || "Open";

                                const orderTimestamp = pkg.orderDate
                                    ? new Date(pkg.orderDate).getTime()
                                    : Date.now();

                                // Ürün bilgileri (items array)
                                const products = (pkg.items || pkg.lines || []).map(item => ({
                                    productName: item.productName || item.name || "Ürün",
                                    quantity: item.quantity || 1,
                                    barcode: item.merchantSku || item.hepsiburadaSku || item.sku || item.productBarcode || "",
                                    imageUrl: item.imageUrl || "/default-image.jpg"
                                }));

                                cargoOrdersFetched.push({
                                    uniqueId: packageNumber,
                                    orderNumber,
                                    packageNumber,
                                    timestamp: orderTimestamp,
                                    orderDate: new Date(orderTimestamp).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
                                    customerName: recipientName,
                                    status: pkgStatus,
                                    trackingNumber: barcode, // Kargo barkodu — detay aşamasında trackingInfoCode ile güncellenecek
                                    cargoProviderName: cargoCompany,
                                    cargoTrackingLink: "",
                                    marketplace: "Hepsiburada",
                                    products: products.length > 0 ? products : [{ productName: "Ürün", quantity: 1, barcode: "", imageUrl: "/default-image.jpg" }]
                                });
                            }

                            if (packages.length < limit) {
                                hasMore = false;
                            } else {
                                offset += limit;
                                await new Promise(resolve => setTimeout(resolve, 200));
                            }
                        } catch (err) {
                            if (err.response?.status === 401) {
                                logger.error("❌ [Hepsiburada Cargo] OMS 401 Unauthorized — credentials hatalı", {
                                    responseData: err.response?.data,
                                    responseHeaders: err.response?.headers,
                                    requestUrl: err.config?.url?.replace(/merchantid\/[^/]+/, "merchantid/***")
                                });
                                // 401 ise diğer dilimleri de denemeye gerek yok
                                return cargoOrdersFetched;
                            } else if (err.response?.status === 404) {
                                logger.info(`ℹ️ [Hepsiburada Cargo] Bu dilimde paket bulunamadı`);
                            } else {
                                logger.error(`❌ [Hepsiburada Cargo] OMS API hatası (offset: ${offset})`, {
                                    error: err.message,
                                    status: err.response?.status,
                                    data: err.response?.data
                                });
                            }
                            hasMore = false;
                        }
                    }

                    // Rate limiting — dilimler arası bekleme
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                logger.info(`✅ [Hepsiburada Cargo] OMS'den ${cargoOrdersFetched.length} paket çekildi`);

                // ── 2) Her paket için kargo takip bilgilerini çek ──
                // Endpoint: GET /packages/merchantid/{merchantId}/packagenumber/{packageNumber}
                // Response: { packageNumber, barcode, status, cargoCompany, trackingInfoCode, trackingInfoUrl }
                if (cargoOrdersFetched.length > 0) {
                    logger.info(`🔍 [Hepsiburada Cargo] ${cargoOrdersFetched.length} paket için kargo takip detayları çekiliyor...`);

                    let trackingFetched = 0;
                    for (const cargo of cargoOrdersFetched) {
                        if (!cargo.packageNumber) continue;

                        try {
                            const trackUrl = `${OMS_BASE}/packages/merchantid/${merchantId}/packagenumber/${cargo.packageNumber}`;
                            const trackResponse = await axios.get(trackUrl, { headers, timeout: 10000 });
                            const trackData = trackResponse.data;

                            if (trackData) {
                                // trackingInfoCode = kargo takip numarası
                                if (trackData.trackingInfoCode) {
                                    cargo.trackingNumber = trackData.trackingInfoCode;
                                }
                                // trackingInfoUrl = kargo takip linki
                                if (trackData.trackingInfoUrl) {
                                    cargo.cargoTrackingLink = trackData.trackingInfoUrl;
                                }
                                // Kargo durumu güncelle (InTransit, Delivered vb.)
                                if (trackData.status) {
                                    cargo.status = trackData.status;
                                }
                                // Kargo firması güncelle
                                if (trackData.cargoCompany) {
                                    cargo.cargoProviderName = trackData.cargoCompany;
                                }
                                trackingFetched++;
                            }
                        } catch (trackErr) {
                            // 404 = henüz kargo bilgisi yok, normal durum
                            if (trackErr.response?.status !== 404) {
                                logger.warn(`⚠️ [Hepsiburada Cargo] Paket ${cargo.packageNumber} kargo detayı alınamadı: ${trackErr.message}`);
                            }
                        }

                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    logger.info(`✅ [Hepsiburada Cargo] ${trackingFetched}/${cargoOrdersFetched.length} paket için kargo takip detayı alındı`);
                }

                // Takip numarası olmayan paketleri filtrele (barcode bile yoksa kargo bilgisi yok demektir)
                cargoOrdersFetched = cargoOrdersFetched.filter(c =>
                    c.trackingNumber && c.trackingNumber !== "Yok" && c.trackingNumber !== ""
                );

                logger.info(`✅ [Hepsiburada Cargo] Toplam ${cargoOrdersFetched.length} kargo kaydı döndürülüyor`);

            } catch (error) {
                logger.error("❌ [Hepsiburada Cargo] Genel hata", { error: error.message });
            }

            return cargoOrdersFetched;
        };

        // ÇiçekSepeti için kargo çekme fonksiyonu
        const fetchCiceksepetiCargo = async (apiKey, sellerId, integratorName, startDate, endDate) => {
            try {
                const ciceksepetiService = require("../services/ciceksepeti/ciceksepetiService");
                const credentials = { apiKey, sellerId, integratorName, isTestMode: false };

                // Sipariş listesini çek (kargoya verilmiş siparişler: statusId=5 veya 11)
                const result = await ciceksepetiService.getOrders(credentials, {
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    pageSize: 100,
                    page: 0,
                    statusId: 5 // 5: Kargoya Verildi, 11: Kargoya Verilecek
                });

                if (!result.success || !result.orders) {
                    logger.warn("ÇiçekSepeti kargo verisi alınamadı");
                    return [];
                }

                return result.orders.map(order => ({
                    orderNumber: order.orderId?.toString() || order.orderItemId?.toString(),
                    customerName: order.receiverName || "Bilinmiyor",
                    cargoCompany: order.cargoCompany || "Bilinmiyor",
                    trackingNumber: order.cargoNumber || order.partialNumber || "",
                    trackingUrl: order.shipmentTrackingUrl || "",
                    status: order.orderProductStatus || "Kargoda",
                    date: order.orderCreateDate || new Date().toLocaleDateString("tr-TR"),
                    timestamp: order.orderModifyDate ? new Date(order.orderModifyDate).getTime() : Date.now(),
                    marketplace: "ÇiçekSepeti",
                    products: [{
                        name: order.name || "Ürün",
                        quantity: order.quantity || 1
                    }]
                }));

            } catch (error) {
                logger.error("ÇiçekSepeti Cargo API error", { error: error.message });
                return [];
            }
        };

        let allCargoOrders = [];
        for (const integration of integrations) {
            // ✅ FIX H5: Credential'ları decrypt et
            integration.credentials = decryptCredentials(integration.credentials);
            const marketplaceName = integration.marketplaceName.toLowerCase();

            try {
                let cargoOrders = [];

                switch (marketplaceName) {
                    case "trendyol":
                        const { apiKey, apiSecret, sellerId } = integration.credentials;
                        if (sellerId) {
                            cargoOrders = await fetchTrendyolCargo(sellerId, apiKey, apiSecret, startDate, endDate);
                        }
                        break;

                    case "n11":
                        const { apiKey: n11ApiKey, secretKey: n11SecretKey } = integration.credentials;
                        if (n11ApiKey && n11SecretKey) {
                            cargoOrders = await fetchN11Cargo(n11ApiKey, n11SecretKey, startDate, endDate);
                        }
                        break;

                    case "hepsiburada":
                        // ✅ Hepsiburada Auth: Basic base64(merchantId:serviceKey)
                        // hepsiburadaService.js ve marketplaceController.js ile aynı format
                        // merchantId = URL'de ve auth user olarak kullanılır
                        // serviceKey = auth password (DB'de serviceKey, apiKey veya password olarak kayıtlı olabilir)
                        const {
                            merchantId,
                            serviceKey: hbServiceKey, apiKey: hbApiKey,
                            password: hbPass, apiSecret: hbApiSecret
                        } = integration.credentials;
                        const hbAuthPass = hbServiceKey || hbApiKey || hbPass || hbApiSecret;
                        if (merchantId && hbAuthPass) {
                            cargoOrders = await fetchHepsiburadaCargo(merchantId, merchantId, hbAuthPass, startDate, endDate);
                        } else {
                            logger.warn(`[Hepsiburada Cargo] Credential eksik — merchantId: ${!!merchantId}, serviceKey: ${!!hbAuthPass}`);
                        }
                        break;

                    case "çiçeksepeti":
                    case "ciceksepeti":
                        const { apiKey: csApiKey, sellerId: csSellerId, integratorName: csIntName } = integration.credentials;
                        if (csApiKey) {
                            cargoOrders = await fetchCiceksepetiCargo(csApiKey, csSellerId, csIntName, startDate, endDate);
                        }
                        break;

                    case "amazon":
                    case "amazon türkiye":
                    case "amazon europe":
                    case "amazon usa":
                        try {
                            const amazonService = require("../services/amazon/amazonSpApiService");
                            const amzResult = await amazonService.getAllOrders(integration.credentials, {
                                createdAfter: new Date(startDate).toISOString(),
                                createdBefore: new Date(endDate).toISOString(),
                                orderStatuses: "Shipped,Delivered,Unshipped"
                            });
                            if (amzResult.success && amzResult.orders) {
                                cargoOrders = amzResult.orders
                                    .filter(o => o.OrderStatus === "Shipped" || o.OrderStatus === "Delivered")
                                    .map(order => ({
                                        uniqueId: order.AmazonOrderId,
                                        orderNumber: order.AmazonOrderId,
                                        timestamp: new Date(order.PurchaseDate).getTime(),
                                        orderDate: new Date(order.PurchaseDate).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
                                        customerName: order.BuyerInfo?.BuyerName || "Amazon Müşteri",
                                        status: order.OrderStatus,
                                        trackingNumber: order.FulfillmentInstruction?.FulfillmentSupplySourceId || "",
                                        cargoProviderName: order.ShipServiceLevel || "Amazon Kargo",
                                        cargoTrackingLink: "",
                                        marketplace: "Amazon",
                                        products: []
                                    }));
                            }
                        } catch (amzErr) {
                            logger.error("Amazon kargo çekme hatası", { error: amzErr.message });
                        }
                        break;

                    default:
                        logger.warn(`Desteklenmeyen pazaryeri: ${marketplaceName}`);
                }

                allCargoOrders.push(...cargoOrders);
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                logger.error(`${integration.marketplaceName} kargo çekme hatası`, { error: error.message });
            }
        }

        // En yakın tarihten en eskiye sıralama yap
        allCargoOrders.sort((a, b) => b.timestamp - a.timestamp);

        return res.status(200).json({
            total: allCargoOrders.length,
            orders: allCargoOrders,
            marketplace: marketplace || "all"
        });
    } catch (error) {
        logger.error("Cargo tracking orders error", { error: error.message });
        return res.status(500).json({ error: "Kargo takip siparişleri alınamadı!" });
    }
};
