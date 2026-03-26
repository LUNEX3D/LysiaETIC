const axios = require("axios");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");

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
        const { userId } = req.params;
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

        // Hepsiburada için kargo çekme fonksiyonu (placeholder - API eklendiğinde doldurulacak)
        const fetchHepsiburadaCargo = async (merchantId, serviceKey, startDate, endDate) => {
            logger.info("Hepsiburada kargo API henüz entegre edilmedi");
            return [];
        };

        let allCargoOrders = [];
        for (const integration of integrations) {
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
                        const { merchantId, apiKey: hbApiKey } = integration.credentials;
                        if (merchantId && hbApiKey) {
                            cargoOrders = await fetchHepsiburadaCargo(merchantId, hbApiKey, startDate, endDate);
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
