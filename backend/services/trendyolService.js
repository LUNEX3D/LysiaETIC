const axios = require("axios");
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

const fetchTrendyolOrders = async (sellerId, apiKey, apiSecret, startDate, endDate) => {
    try {
        // 1. Kimlik Doğrulama
        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
        const userAgent = `${sellerId} - SelfIntegration`;

        // 2. Tarihleri GMT+3'e çevirme
        const convertedStartDate = convertToGMT3Timestamp(startDate, true);
        const convertedEndDate = convertToGMT3Timestamp(endDate, false);

        // 3. Değişkenler
        let ordersFetched = [];
        let currentStart = convertedStartDate;

        // 4. Tarih Aralığını Parçalara Bölme
        while (currentStart < convertedEndDate) {
            const currentEnd = Math.min(
                currentStart + MAX_DAYS_PER_REQUEST * 24 * 60 * 60 * 1000,
                convertedEndDate
            );
            let page = 0;
            let totalPages = 1;

            // 5. Sayfalama
            do {
                let retryCount = 0;
                // API URL Oluşturma
                const apiUrl = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/orders` +
                    `?page=${page}` +
                    `&size=${PAGE_SIZE}` +
                    `&orderByField=OrderDate` + // Güncellenme tarihi yerine sipariş tarihi kullanıldı
                    `&orderByDirection=DESC` +
                    `&startDate=${currentStart}` +
                    `&endDate=${currentEnd}`;

                logger.debug(`🌐 [${sellerId}] API İsteği (sayfa ${page}): ${apiUrl}`);

                try {
                    // API İsteği
                    const response = await axios.get(apiUrl, {
                        headers: {
                            Authorization: authHeader,
                            "User-Agent": userAgent,
                            "Content-Type": "application/json"
                        },
                        timeout: 20000
                    });

                    // 6. Veri Kontrolü
                    if (!response.data?.content) break;
                    totalPages = response.data.totalPages;

                    // 7. Veri Dönüşümü (Çift filtreleme kaldırıldı, API zaten doğru verileri döndürüyor)
                    ordersFetched.push(...response.data.content.map(pkg => ({
                        uniqueId: pkg.id,
                        orderNumber: pkg.orderNumber,
                        timestamp: new Date(pkg.orderDate).getTime(),
                        orderDate: new Date(pkg.orderDate).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
                        customerName: pkg.shipmentAddress?.fullName || "Bilinmiyor",
                        totalPrice: pkg.grossAmount.toFixed(2),
                        status: pkg.status,
                        trackingNumber: pkg.cargoTrackingNumber || "Yok",
                        products: pkg.lines.map(line => ({
                            productName: line.productName,
                            quantity: line.quantity,
                            barcode: line.barcode,
                            imageUrl: line.imageUrl || "/default-image.jpg"
                        }))
                    })));

                    page++;
                } catch (error) {
                    logger.error(`🚫 [${sellerId}] API Hatası (sayfa ${page}):`, { error: error.response?.data || error.message });
                    retryCount++;
                    if (retryCount >= MAX_RETRY) break;
                }
            } while (page < totalPages);

            // 9. Sonraki tarih aralığına geç
            currentStart = currentEnd + 1;
        }

        logger.info(`✅ [${sellerId}] Toplam ${ordersFetched.length} sipariş paketi çekildi.`);
        return ordersFetched;

    } catch (error) {
        logger.error(`🚫 [${sellerId}] Kritik Hata:`, { error: error.message });
        return [];
    }
};

module.exports = { fetchTrendyolOrders };
