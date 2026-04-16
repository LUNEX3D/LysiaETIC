/**
 * autoOrderService.js — LysiaETIC
 * ═══════════════════════════════════════════════════════════════
 * Otomatik Sipariş İşleme Servisi
 *
 * Her pazaryerinden "Yeni" statüsündeki siparişleri çeker,
 * kullanıcının ayarladığı kargo şirketini seçerek
 * "İşlemde" (Processing) statüsüne taşır.
 *
 * Birincil kargo başarısız olursa yedek kargo ile tekrar dener.
 *
 * Desteklenen Pazaryerleri:
 *   - Trendyol: PUT /integration/order/sellers/{sellerId}/shipment-packages
 *   - Hepsiburada: PUT /packages/merchantid/{merchantId}/packagenumber/{packageNumber}
 *   - ÇiçekSepeti: PUT /Order/readyforcargowithcsintegration
 *   - N11: (sipariş onaylama API'si)
 * ═══════════════════════════════════════════════════════════════
 */
const axios = require("axios");
const logger = require("../config/logger");

// ═══════════════════════════════════════════════════════════════
// 📋 KARGO ŞİRKETİ LİSTELERİ
// ═══════════════════════════════════════════════════════════════

/**
 * Trendyol Kargo Şirketleri
 * GET /integration/order/sellers/{sellerId}/cargo-companies
 */
const getTrendyolCargoCompanies = async (sellerId, apiKey, apiSecret) => {
    try {
        if (!sellerId || !apiKey || !apiSecret) {
            logger.warn(`[AutoOrder] Trendyol kargo: credentials eksik — sellerId: ${!!sellerId}, apiKey: ${!!apiKey}, apiSecret: ${!!apiSecret}`);
            return getTrendyolStaticCargoCompanies();
        }

        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
        const url = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/cargo-companies`;

        const response = await axios.get(url, {
            headers: {
                Authorization: authHeader,
                "User-Agent": `${sellerId} - SelfIntegration`,
                "Content-Type": "application/json"
            },
            timeout: 15000
        });

        // Trendyol kargo şirketleri: [{ id: 10, name: "Trendyol Express", code: "TRENDYOLEXPRESS" }, ...]
        const companies = response.data || [];
        if (companies.length === 0) {
            logger.warn("[AutoOrder] Trendyol API boş kargo listesi döndü, statik liste kullanılıyor");
            return getTrendyolStaticCargoCompanies();
        }
        return companies.map(c => ({
            id: String(c.id),
            name: c.name || c.code || "Bilinmiyor",
            code: c.code || ""
        }));
    } catch (error) {
        const status = error.response?.status || "N/A";
        const detail = error.response?.data ? JSON.stringify(error.response.data).substring(0, 300) : error.message;
        logger.error(`[AutoOrder] Trendyol kargo şirketleri çekme hatası: status=${status} detail=${detail}`);
        // API başarısız olursa statik listeyi dön
        return getTrendyolStaticCargoCompanies();
    }
};

/**
 * Trendyol statik kargo şirketleri (API başarısız olursa fallback)
 */
const getTrendyolStaticCargoCompanies = () => {
    return [
        { id: "10", name: "Trendyol Express", code: "TRENDYOLEXPRESS" },
        { id: "19", name: "HepsiJet", code: "HEPSIJET" },
        { id: "4", name: "Yurtiçi Kargo", code: "YURTICI" },
        { id: "7", name: "Aras Kargo", code: "ARASKARGO" },
        { id: "9", name: "MNG Kargo", code: "MNGKARGO" },
        { id: "14", name: "PTT Kargo", code: "PTTKARGO" },
        { id: "6", name: "Sürat Kargo", code: "SURATKARGO" },
        { id: "17", name: "Sendeo", code: "SENDEO" },
        { id: "30", name: "Kolay Gelsin", code: "KOLAYGELSIN" },
        { id: "20", name: "Horoz Lojistik", code: "HOROZLOJISTIK" },
        { id: "8", name: "UPS Kargo", code: "UPSKARGO" },
        { id: "5", name: "Ceva Lojistik", code: "CEVALOJISTIK" },
    ];
};

/**
 * Hepsiburada Kargo Şirketleri
 * Hepsiburada'da kargo şirketleri sabit listedir
 */
const getHepsiburadaCargoCompanies = () => {
    return [
        { id: "YURTICI_KARGO", name: "Yurtiçi Kargo", code: "YURTICI_KARGO" },
        { id: "ARAS_KARGO", name: "Aras Kargo", code: "ARAS_KARGO" },
        { id: "MNG_KARGO", name: "MNG Kargo", code: "MNG_KARGO" },
        { id: "PTT_KARGO", name: "PTT Kargo", code: "PTT_KARGO" },
        { id: "SURAT_KARGO", name: "Sürat Kargo", code: "SURAT_KARGO" },
        { id: "UPS_KARGO", name: "UPS Kargo", code: "UPS_KARGO" },
        { id: "HOROZ_LOJISTIK", name: "Horoz Lojistik", code: "HOROZ_LOJISTIK" },
        { id: "CEVA_LOJISTIK", name: "Ceva Lojistik", code: "CEVA_LOJISTIK" },
        { id: "TRENDYOL_EXPRESS", name: "Trendyol Express", code: "TRENDYOL_EXPRESS" },
        { id: "HEPSİJET", name: "HepsiJet", code: "HEPSIJET" },
        { id: "KARGOIST", name: "Kargoİst", code: "KARGOIST" },
        { id: "SENDEO", name: "Sendeo", code: "SENDEO" },
        { id: "DIGER", name: "Diğer", code: "DIGER" },
    ];
};

/**
 * ÇiçekSepeti Kargo Şirketleri
 * ÇiçekSepeti kendi kargo entegrasyonunu kullanır (CS Integration)
 * Satıcı kendi kargo entegrasyonu kullanıyorsa farklı şirketler seçilebilir
 */
const getCiceksepetiCargoCompanies = () => {
    return [
        { id: "CS_INTEGRATION", name: "ÇiçekSepeti Entegrasyonu", code: "CS_INTEGRATION" },
        { id: "YURTICI_KARGO", name: "Yurtiçi Kargo", code: "YURTICI_KARGO" },
        { id: "ARAS_KARGO", name: "Aras Kargo", code: "ARAS_KARGO" },
        { id: "MNG_KARGO", name: "MNG Kargo", code: "MNG_KARGO" },
        { id: "PTT_KARGO", name: "PTT Kargo", code: "PTT_KARGO" },
        { id: "SURAT_KARGO", name: "Sürat Kargo", code: "SURAT_KARGO" },
        { id: "UPS_KARGO", name: "UPS Kargo", code: "UPS_KARGO" },
        { id: "SENDEO", name: "Sendeo", code: "SENDEO" },
    ];
};

/**
 * N11 Kargo Şirketleri
 */
const getN11CargoCompanies = () => {
    return [
        { id: "YURTICI_KARGO", name: "Yurtiçi Kargo", code: "yurtici" },
        { id: "ARAS_KARGO", name: "Aras Kargo", code: "aras" },
        { id: "MNG_KARGO", name: "MNG Kargo", code: "mng" },
        { id: "PTT_KARGO", name: "PTT Kargo", code: "ptt" },
        { id: "SURAT_KARGO", name: "Sürat Kargo", code: "surat" },
        { id: "UPS_KARGO", name: "UPS Kargo", code: "ups" },
        { id: "SENDEO", name: "Sendeo", code: "sendeo" },
    ];
};

/**
 * Pazaryerine göre kargo şirketlerini getir
 */
const getCargoCompanies = async (marketplaceName, credentials) => {
    const creds = credentials || {};
    const name = (marketplaceName || "").toLowerCase();
    switch (name) {
        case "trendyol":
            return await getTrendyolCargoCompanies(
                creds.sellerId || creds.supplierId || "",
                creds.apiKey || "",
                creds.apiSecret || ""
            );
        case "hepsiburada":
            return getHepsiburadaCargoCompanies();
        case "çiçeksepeti":
        case "ciceksepeti":
            return getCiceksepetiCargoCompanies();
        case "n11":
            return getN11CargoCompanies();
        default:
            return [];
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 SİPARİŞ İŞLEME — Yeni → İşlemde
// ═══════════════════════════════════════════════════════════════

/**
 * Trendyol: Yeni siparişleri "İşlemde" statüsüne al
 *
 * Trendyol Sipariş Statüleri:
 *   Created → Picking → Invoiced → Shipped → Delivered
 *
 * Paket onaylama (picking):
 *   PUT /integration/order/sellers/{sellerId}/shipment-packages/{shipmentPackageId}
 *   Body: { status: "Picking", cargoCompany: cargoCompanyId }
 *
 * Alternatif — toplu onaylama:
 *   PUT /integration/order/sellers/{sellerId}/shipment-packages
 *   Body: { shipmentPackages: [{ id, status: "Picking", params: { cargoCompany } }] }
 */
const processTrendyolOrders = async (credentials, cargoId, cargoName) => {
    const { sellerId, apiKey, apiSecret } = credentials;
    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
    const userAgent = `${sellerId} - SelfIntegration`;
    const results = [];

    try {
        // 1) Yeni (Created) siparişleri çek
        const now = Date.now();
        const startDate = now - 7 * 24 * 60 * 60 * 1000; // Son 7 gün
        const url = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/orders` +
            `?status=Created&startDate=${startDate}&endDate=${now}&page=0&size=200` +
            `&orderByField=PackageLastModifiedDate&orderByDirection=DESC`;

        const response = await axios.get(url, {
            headers: { Authorization: authHeader, "User-Agent": userAgent, "Content-Type": "application/json" },
            timeout: 20000
        });

        const packages = response.data?.content || [];
        if (packages.length === 0) {
            logger.info("[AutoOrder] Trendyol: İşlenecek yeni sipariş yok");
            return { processed: 0, success: 0, failed: 0, results: [] };
        }

        logger.info(`[AutoOrder] Trendyol: ${packages.length} yeni sipariş bulundu, işleniyor...`);

        // 2) Her paketi "Picking" statüsüne al
        for (const pkg of packages) {
            const shipmentPackageId = pkg.shipmentPackageId || pkg.id;
            const orderNumber = pkg.orderNumber;

            if (!shipmentPackageId) {
                results.push({ orderNumber, status: "failed", error: "shipmentPackageId bulunamadı", cargoUsed: cargoName });
                continue;
            }

            try {
                // Trendyol paket onaylama — her paketi ayrı ayrı
                const pickUrl = `https://apigw.trendyol.com/integration/order/sellers/${sellerId}/shipment-packages/${shipmentPackageId}`;
                const pickBody = {
                    status: "Picking",
                    params: {}
                };

                // Kargo şirketi ID'si varsa ekle
                if (cargoId) {
                    pickBody.params.cargoCompany = parseInt(cargoId) || cargoId;
                }

                await axios.put(pickUrl, pickBody, {
                    headers: { Authorization: authHeader, "User-Agent": userAgent, "Content-Type": "application/json" },
                    timeout: 15000
                });

                results.push({ orderNumber, status: "success", cargoUsed: cargoName });
                logger.info(`[AutoOrder] Trendyol ✅ ${orderNumber} → Picking (${cargoName})`);

                // Rate limiting
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                const errMsg = err.response?.data?.errors?.[0]?.message ||
                    err.response?.data?.message ||
                    err.message;
                results.push({ orderNumber, status: "failed", error: errMsg, cargoUsed: cargoName });
                logger.warn(`[AutoOrder] Trendyol ❌ ${orderNumber}: ${errMsg}`);
            }
        }
    } catch (error) {
        logger.error("[AutoOrder] Trendyol sipariş çekme hatası:", error.message);
    }

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;
    return { processed: results.length, success, failed, results };
};

/**
 * Hepsiburada: Yeni siparişleri "İşlemde" statüsüne al
 *
 * HB Sipariş Statüleri:
 *   Open → Packaged → Shipped → Delivered
 *
 * Paket onaylama:
 *   PUT /packages/merchantid/{merchantId}/packagenumber/{packageNumber}
 *   Body: { status: "Packaged", cargoCompany: "YURTICI_KARGO" }
 */
const processHepsiburadaOrders = async (credentials, cargoId, cargoName) => {
    const { normalizeCredentials, getEndpoints, getHeaders } = require("./hepsiburadaService");
    const hbCreds = normalizeCredentials(credentials);
    const { merchantId, secretKey, userAgent, useSit } = hbCreds;
    const results = [];

    if (!merchantId || !secretKey) {
        logger.warn("[AutoOrder] Hepsiburada: Credentials eksik");
        return { processed: 0, success: 0, failed: 0, results: [] };
    }

    try {
        const ep = getEndpoints({ useSit });
        const headers = getHeaders(merchantId, secretKey, userAgent);

        // 1) Open (yeni) siparişleri çek
        const moment = require("moment");
        const encStart = encodeURIComponent(moment().subtract(7, "days").format("YYYY-MM-DD HH:mm:ss"));
        const encEnd = encodeURIComponent(moment().format("YYYY-MM-DD HH:mm:ss"));

        let offset = 0;
        const limit = 100;
        const openOrders = [];

        let hasMore = true;
        while (hasMore) {
            try {
                const url = `${ep.OMS}/orders/merchantid/${merchantId}?begindate=${encStart}&enddate=${encEnd}&offset=${offset}&limit=${limit}`;
                const resp = await axios.get(url, { headers, timeout: 30000 });
                const items = resp.data?.items || [];
                if (!Array.isArray(items) || items.length === 0) { hasMore = false; break; }
                openOrders.push(...items);
                if (items.length < limit) hasMore = false;
                else offset += items.length;
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                if (err.response?.status === 404 || err.response?.status === 401) hasMore = false;
                else {
                    logger.warn(`[AutoOrder] Hepsiburada sipariş çekme hatası: ${err.response?.status || err.message}`, {
                        url: `${ep.OMS}/orders/merchantid/${merchantId}?begindate=...&enddate=...&offset=${offset}&limit=${limit}`,
                        responseBody: JSON.stringify(err.response?.data || '').substring(0, 500)
                    });
                    hasMore = false;
                }
            }
        }

        if (openOrders.length === 0) {
            logger.info("[AutoOrder] Hepsiburada: İşlenecek yeni sipariş yok");
            return { processed: 0, success: 0, failed: 0, results: [] };
        }

        logger.info(`[AutoOrder] Hepsiburada: ${openOrders.length} yeni sipariş bulundu, işleniyor...`);

        // 2) Paketleri çek ve onaylama yap
        // Önce paketlenmiş olmayan paketleri bul
        let pkgOffset = 0;
        const allPackages = [];
        let pkgHasMore = true;
        while (pkgHasMore) {
            try {
                const pkgUrl = `${ep.OMS}/packages/merchantid/${merchantId}?timespan=168&offset=${pkgOffset}&limit=10`;
                const pkgResp = await axios.get(pkgUrl, { headers, timeout: 30000 });
                const pkgs = pkgResp.data?.items || pkgResp.data || [];
                const arr = Array.isArray(pkgs) ? pkgs : [];
                if (arr.length === 0) { pkgHasMore = false; break; }
                allPackages.push(...arr);
                if (arr.length < 10) pkgHasMore = false;
                else pkgOffset += arr.length;
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                pkgHasMore = false;
            }
        }

        // Open/Unpacked paketleri filtrele
        const unpackedPackages = allPackages.filter(p => {
            const st = (p.status || "").toLowerCase();
            return st === "open" || st === "unpacked" || st === "new";
        });

        if (unpackedPackages.length === 0) {
            logger.info("[AutoOrder] Hepsiburada: Paketlenecek paket yok");
            return { processed: 0, success: 0, failed: 0, results: [] };
        }

        logger.info(`[AutoOrder] Hepsiburada: ${unpackedPackages.length} paket onaylanacak`);

        // 3) Her paketi onayla
        for (const pkg of unpackedPackages) {
            const packageNumber = pkg.packageNumber || pkg.id;
            const orderNumber = pkg.orderNumber || packageNumber;

            if (!packageNumber) {
                results.push({ orderNumber, status: "failed", error: "packageNumber bulunamadı", cargoUsed: cargoName });
                continue;
            }

            try {
                const packUrl = `${ep.OMS}/packages/merchantid/${merchantId}/packagenumber/${packageNumber}`;
                const packBody = {
                    status: "Packaged",
                    cargoCompany: cargoId || "YURTICI_KARGO"
                };

                await axios.put(packUrl, packBody, { headers, timeout: 15000 });

                results.push({ orderNumber, status: "success", cargoUsed: cargoName });
                logger.info(`[AutoOrder] Hepsiburada ✅ ${orderNumber} → Packaged (${cargoName})`);

                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                const errMsg = err.response?.data?.message ||
                    err.response?.data?.errors?.[0]?.message ||
                    err.message;
                results.push({ orderNumber, status: "failed", error: errMsg, cargoUsed: cargoName });
                logger.warn(`[AutoOrder] Hepsiburada ❌ ${orderNumber}: ${errMsg}`);
            }
        }
    } catch (error) {
        logger.error("[AutoOrder] Hepsiburada genel hata:", error.message);
    }

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;
    return { processed: results.length, success, failed, results };
};

/**
 * ÇiçekSepeti: Yeni siparişleri "Kargoya Hazır" statüsüne al
 *
 * CS Sipariş Statüleri:
 *   1: Yeni, 2: Hazırlanıyor, 3: Kargoya Verilecek, 5: Kargoya Verildi
 *
 * CS Entegrasyonu ile kargo kodu alma:
 *   PUT /Order/readyforcargowithcsintegration
 *   Body: { orderItemsGroup: [{ orderItemIds: [123, 456] }] }
 *
 * Kendi kargo entegrasyonu:
 *   PUT /Order/statusupdatewithsupplierintegration
 *   Body: { orderItems: [{ orderItemId, statusId, cargoCompany, trackingNumber }] }
 */
const processCiceksepetiOrders = async (credentials, cargoId, cargoName) => {
    const results = [];

    try {
        const ciceksepetiService = require("./ciceksepeti/ciceksepetiService");
        const creds = {
            apiKey: credentials.apiKey,
            sellerId: credentials.sellerId,
            integratorName: credentials.integratorName,
            isTestMode: credentials.isTestMode || false
        };

        // 1) Yeni siparişleri çek (statusId=1: Yeni)
        const orderResult = await ciceksepetiService.getOrders(creds, {
            statusId: 1,
            pageSize: 100,
            page: 0
        });

        if (!orderResult.success || !orderResult.orders || orderResult.orders.length === 0) {
            logger.info("[AutoOrder] ÇiçekSepeti: İşlenecek yeni sipariş yok");
            return { processed: 0, success: 0, failed: 0, results: [] };
        }

        const orders = orderResult.orders;
        logger.info(`[AutoOrder] ÇiçekSepeti: ${orders.length} yeni sipariş bulundu, işleniyor...`);

        // 2) CS Entegrasyonu mu yoksa kendi kargo mu?
        if (cargoId === "CS_INTEGRATION") {
            // CS kendi kargo entegrasyonu — toplu gönder
            const orderItemIds = orders.map(o => o.orderItemId).filter(Boolean);
            if (orderItemIds.length === 0) {
                return { processed: 0, success: 0, failed: 0, results: [] };
            }

            try {
                const cargoResult = await ciceksepetiService.getCargoCode(creds, [{ orderItemIds }]);
                if (cargoResult.success) {
                    orderItemIds.forEach(id => {
                        results.push({ orderNumber: String(id), status: "success", cargoUsed: "ÇiçekSepeti Entegrasyonu" });
                    });
                    logger.info(`[AutoOrder] ÇiçekSepeti ✅ ${orderItemIds.length} sipariş CS entegrasyonu ile işlendi`);
                } else {
                    orderItemIds.forEach(id => {
                        results.push({ orderNumber: String(id), status: "failed", error: cargoResult.error, cargoUsed: "ÇiçekSepeti Entegrasyonu" });
                    });
                }
            } catch (err) {
                orderItemIds.forEach(id => {
                    results.push({ orderNumber: String(id), status: "failed", error: err.message, cargoUsed: "ÇiçekSepeti Entegrasyonu" });
                });
            }
        } else {
            // Kendi kargo entegrasyonu — her sipariş için ayrı güncelle
            for (const order of orders) {
                const orderItemId = order.orderItemId;
                const orderNumber = order.orderId?.toString() || String(orderItemId);

                if (!orderItemId) {
                    results.push({ orderNumber, status: "failed", error: "orderItemId bulunamadı", cargoUsed: cargoName });
                    continue;
                }

                try {
                    const updateResult = await ciceksepetiService.updateOrderStatus(creds, [{
                        orderItemId: orderItemId,
                        statusId: 3, // Kargoya Verilecek
                        cargoCompany: cargoName || cargoId,
                        trackingNumber: "" // Takip numarası sonra eklenecek
                    }]);

                    if (updateResult.success) {
                        results.push({ orderNumber, status: "success", cargoUsed: cargoName });
                        logger.info(`[AutoOrder] ÇiçekSepeti ✅ ${orderNumber} → Kargoya Verilecek (${cargoName})`);
                    } else {
                        results.push({ orderNumber, status: "failed", error: updateResult.error, cargoUsed: cargoName });
                    }

                    // Rate limiting — 5 saniyede 1 farklı request
                    await new Promise(r => setTimeout(r, 5100));
                } catch (err) {
                    results.push({ orderNumber, status: "failed", error: err.message, cargoUsed: cargoName });
                    logger.warn(`[AutoOrder] ÇiçekSepeti ❌ ${orderNumber}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        logger.error("[AutoOrder] ÇiçekSepeti genel hata:", error.message);
    }

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;
    return { processed: results.length, success, failed, results };
};

/**
 * N11: Yeni siparişleri onaylama
 *
 * N11 Sipariş Statüleri:
 *   New → Approved → Rejected → Shipped → Delivered
 *
 * Sipariş onaylama:
 *   PUT /rest/delivery/v1/shipmentPackages/{id}/approve
 */
const processN11Orders = async (credentials, cargoId, cargoName) => {
    const results = [];

    try {
        const { apiKey, secretKey } = credentials;
        // HTTP header'ları sadece ASCII kabul eder
        const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");

        const headers = {
            appkey: cleanAscii(apiKey),
            appsecret: cleanAscii(secretKey),
            "Content-Type": "application/json"
        };

        // 1) Yeni siparişleri çek
        const now = Date.now();
        const startDate = now - 7 * 24 * 60 * 60 * 1000;
        const url = `https://api.n11.com/rest/delivery/v1/shipmentPackages` +
            `?startDate=${startDate}&endDate=${now}&page=0&size=100` +
            `&orderByDirection=DESC&orderByField=true`;

        const response = await axios.get(url, { headers, timeout: 20000 });
        const packages = response.data?.content || [];

        // Sadece "New" statüsündeki paketleri filtrele
        const newPackages = packages.filter(p =>
            (p.shipmentPackageStatus || "").toLowerCase() === "new" ||
            (p.shipmentPackageStatus || "").toLowerCase() === "approved" === false
        );

        if (newPackages.length === 0) {
            logger.info("[AutoOrder] N11: İşlenecek yeni sipariş yok");
            return { processed: 0, success: 0, failed: 0, results: [] };
        }

        logger.info(`[AutoOrder] N11: ${newPackages.length} yeni sipariş bulundu, işleniyor...`);

        // 2) Her paketi onayla
        for (const pkg of newPackages) {
            const packageId = pkg.id;
            const orderNumber = pkg.orderNumber || String(packageId);

            if (!packageId) {
                results.push({ orderNumber, status: "failed", error: "packageId bulunamadı", cargoUsed: cargoName });
                continue;
            }

            try {
                const approveUrl = `https://api.n11.com/rest/delivery/v1/shipmentPackages/${packageId}/approve`;
                const approveBody = {
                    cargoCompanyId: cargoId || "yurtici",
                    cargoCompanyName: cargoName || "Yurtiçi Kargo"
                };

                await axios.put(approveUrl, approveBody, { headers, timeout: 15000 });

                results.push({ orderNumber, status: "success", cargoUsed: cargoName });
                logger.info(`[AutoOrder] N11 ✅ ${orderNumber} → Approved (${cargoName})`);

                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                const errMsg = err.response?.data?.message || err.message;
                results.push({ orderNumber, status: "failed", error: errMsg, cargoUsed: cargoName });
                logger.warn(`[AutoOrder] N11 ❌ ${orderNumber}: ${errMsg}`);
            }
        }
    } catch (error) {
        logger.error("[AutoOrder] N11 genel hata:", error.message);
    }

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;
    return { processed: results.length, success, failed, results };
};

// ═══════════════════════════════════════════════════════════════
// 🚀 ANA İŞLEM FONKSİYONU — Fallback destekli
// ═══════════════════════════════════════════════════════════════

/**
 * Bir pazaryeri için siparişleri işle (birincil + yedek kargo)
 * @param {string} marketplaceName - Pazaryeri adı
 * @param {object} credentials - Decrypted credentials
 * @param {object} primaryCargo - { id, name }
 * @param {object} fallbackCargo - { id, name }
 * @returns {object} İşlem sonucu
 */
const processOrders = async (marketplaceName, credentials, primaryCargo, fallbackCargo) => {
    const name = (marketplaceName || "").toLowerCase();
    let processFn;

    switch (name) {
        case "trendyol":
            processFn = processTrendyolOrders;
            break;
        case "hepsiburada":
            processFn = processHepsiburadaOrders;
            break;
        case "çiçeksepeti":
        case "ciceksepeti":
            processFn = processCiceksepetiOrders;
            break;
        case "n11":
            processFn = processN11Orders;
            break;
        default:
            return { processed: 0, success: 0, failed: 0, fallbackUsed: 0, results: [], error: `Desteklenmeyen pazaryeri: ${marketplaceName}` };
    }

    // 1) Birincil kargo ile dene
    logger.info(`[AutoOrder] ${marketplaceName}: Birincil kargo ile işleniyor → ${primaryCargo.name}`);
    const primaryResult = await processFn(credentials, primaryCargo.id, primaryCargo.name);

    // 2) Başarısız olanlar varsa ve yedek kargo tanımlıysa, yedek ile tekrar dene
    let fallbackUsed = 0;
    if (fallbackCargo && fallbackCargo.id && primaryResult.failed > 0) {
        const failedOrders = primaryResult.results.filter(r => r.status === "failed");
        logger.info(`[AutoOrder] ${marketplaceName}: ${failedOrders.length} başarısız sipariş yedek kargo ile denenecek → ${fallbackCargo.name}`);

        const fallbackResult = await processFn(credentials, fallbackCargo.id, fallbackCargo.name);

        // Fallback sonuçlarını birleştir
        for (const fr of fallbackResult.results) {
            const idx = primaryResult.results.findIndex(r => r.orderNumber === fr.orderNumber && r.status === "failed");
            if (idx !== -1) {
                if (fr.status === "success") {
                    primaryResult.results[idx] = { ...fr, status: "fallback_success", cargoUsed: fallbackCargo.name };
                    primaryResult.success++;
                    primaryResult.failed--;
                    fallbackUsed++;
                } else {
                    primaryResult.results[idx] = { ...fr, status: "fallback_failed", cargoUsed: fallbackCargo.name };
                }
            }
        }
    }

    return {
        ...primaryResult,
        fallbackUsed
    };
};

module.exports = {
    getCargoCompanies,
    getTrendyolCargoCompanies,
    getTrendyolStaticCargoCompanies,
    getHepsiburadaCargoCompanies,
    getCiceksepetiCargoCompanies,
    getN11CargoCompanies,
    processOrders,
    processTrendyolOrders,
    processHepsiburadaOrders,
    processCiceksepetiOrders,
    processN11Orders
};
