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

                orders.push(...response.data.content.map(pkg => {
                    // ✅ FIX: Tutar hesaplama — grossAmount, totalPrice, packageTotalPrice, packageGrossAmount veya line toplamı
                    const lineTotal = Array.isArray(pkg.lines)
                        ? pkg.lines.reduce((sum, line) => sum + (Number(line.amount || line.price || line.lineGrossAmount || 0) * Number(line.quantity || 1)), 0)
                        : 0;
                    const rawTotal = Number(pkg.grossAmount || pkg.totalPrice || pkg.packageTotalPrice || pkg.packageGrossAmount || 0);
                    const finalTotal = rawTotal > 0 ? rawTotal : lineTotal;

                    return {
                        orderNumber: pkg.orderNumber,
                        customerName: pkg.shipmentAddress?.fullName || pkg.customerFirstName && pkg.customerLastName ? (pkg.customerFirstName + " " + pkg.customerLastName).trim() : "Unknown",
                        customerFirstName: pkg.customerFirstName || "",
                        customerLastName: pkg.customerLastName || "",
                        customerEmail: pkg.customerEmail || "",
                        totalPrice: finalTotal > 0 ? finalTotal.toFixed(2) : "0.00",
                        status: pkg.status,
                        orderDate: new Date(pkg.orderDate).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
                        orderDateRaw: pkg.orderDate, // epoch ms — sync için
                        // ── Müşteri adres bilgileri (fatura için) ──
                        shipmentAddress: pkg.shipmentAddress ? {
                            fullName: pkg.shipmentAddress.fullName || "",
                            city: pkg.shipmentAddress.city || "",
                            district: pkg.shipmentAddress.district || "",
                            fullAddress: pkg.shipmentAddress.fullAddress || pkg.shipmentAddress.address1 || "",
                            phone: pkg.shipmentAddress.phone || "",
                            country: pkg.shipmentAddress.countryCode || "Turkiye",
                        } : {},
                        invoiceAddress: pkg.invoiceAddress ? {
                            fullName: pkg.invoiceAddress.fullName || "",
                            city: pkg.invoiceAddress.city || "",
                            district: pkg.invoiceAddress.district || "",
                            fullAddress: pkg.invoiceAddress.fullAddress || pkg.invoiceAddress.address1 || "",
                            taxNumber: pkg.invoiceAddress.taxNumber || "",
                            taxOffice: pkg.invoiceAddress.taxOffice || "",
                            company: pkg.invoiceAddress.company || "",
                        } : {},
                        products: pkg.lines.map(line => ({
                            productName: line.productName,
                            quantity: line.quantity,
                            price: line.amount || line.price || line.lineGrossAmount || 0,
                            barcode: line.barcode || line.productBarcode || "",
                            merchantSku: line.merchantSku || line.sku || "",
                            productCode: line.productCode || "",
                            imageUrl: line.imageUrl || "/default-product.jpg",
                            commissionAmount: line.commissionFee || 0
                        }))
                    };
                }));

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

const fetchHepsiburadaOrders = async (merchantId, serviceKey, startDate, endDate, userAgent, useSit = false) => {
    try {
        if (!merchantId || !serviceKey) {
            logger.warn("Hepsiburada: MerchantId veya ServiceKey eksik");
            return [];
        }

        logger.info("📦 [Hepsiburada] OMS Orders API ile siparişler çekiliyor...", {
            merchantId: merchantId.substring(0, 8) + "...",
            startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
            endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss'),
            useSit
        });

        // Hepsiburada Auth: Basic base64(merchantId:secretKey)
        const credentials = `${merchantId}:${serviceKey}`;
        const authHeader = `Basic ${Buffer.from(credentials, "utf-8").toString("base64")}`;

        // User-Agent: Hepsiburada'nın satıcıya verdiği developer username
        const headers = {
            "Authorization": authHeader,
            "User-Agent": userAgent || "LysiaETIC",
            "Content-Type": "application/json"
        };

        // SIT/Production ortamına göre dinamik endpoint
        const { getEndpoints } = require("./hepsiburadaService");
        const ep = getEndpoints({ useSit });
        const BASE_URL = ep.OMS;

        // ═══════════════════════════════════════════════════════════════
        // Hepsiburada OMS API — Farklı statüdeki siparişler FARKLI
        // endpoint'lerden çekilir. Tek bir endpoint tüm siparişleri vermez.
        //
        // 1. /orders/merchantid/{id}                    → Ödemesi tamamlanmış (Open/Unpacked)
        // 2. /packages/merchantid/{id}                  → Paketlenmiş (kargoya hazır)
        // 3. /packages/merchantid/{id}/shipped           → Kargoya verilmiş
        // 4. /packages/merchantid/{id}/delivered         → Teslim edilmiş
        // 5. /packages/merchantid/{id}/cancelled         → İptal edilmiş
        //
        // Limit: max 100 (orders), max 50 (packages — shipped/delivered/cancelled)
        // Offset + Limit birlikte zorunlu
        // begindate/enddate: YYYY-MM-DD HH:mm:ss formatında
        // Packages endpoint'leri: begindate/enddate veya timespan parametresi
        // Shipped/Delivered/Cancelled: son 1 aylık data, limit max 50
        // ═══════════════════════════════════════════════════════════════

        const allOrderMap = new Map(); // orderNumber → order (tüm kaynaklardan birleştir)

        // ── Yardımcı: OMS item'larını orderMap'e ekle ──
        const addItemsToMap = (items, defaultStatus) => {
            items.forEach(item => {
                const orderNum = item.orderNumber || item.orderId || item.id;
                if (!orderNum) return;

                if (!allOrderMap.has(orderNum)) {
                    allOrderMap.set(orderNum, {
                        orderNumber: orderNum,
                        orderDate: item.orderDate,
                        customerName: item.customerName || item.shippingAddress?.name || item.shippingAddressDetail?.name || item.recipientName || item.invoice?.address?.name || 'Hepsiburada Müşteri',
                        customerEmail: item.invoice?.address?.email || item.shippingAddress?.email || item.email || '',
                        customerPhone: item.shippingAddress?.phoneNumber || item.invoice?.address?.phoneNumber || item.phoneNumber || '',
                        totalPrice: 0,
                        status: item.status || defaultStatus || 'Open',
                        trackingNumber: item.barcode || item.trackingInfoCode || 'Yok',
                        cargoCompany: item.cargoCompany || item.cargoCompanyModel?.name || 'Bilinmiyor',
                        packageNumber: item.packageNumber || '',
                        shippingAddress: item.shippingAddress ? {
                            fullName: item.shippingAddress.name || item.customerName || item.recipientName || '',
                            city: item.shippingAddress.city || item.shippingCity || '',
                            district: item.shippingAddress.district || item.shippingDistrict || '',
                            fullAddress: item.shippingAddress.address || item.shippingAddress.addressDetail || item.shippingAddressDetail || '',
                            phone: item.shippingAddress.phoneNumber || item.phoneNumber || '',
                            country: item.shippingAddress.countryCode || item.shippingCountryCode || 'Turkiye',
                        } : {
                            fullName: item.recipientName || item.customerName || '',
                            city: item.shippingCity || '',
                            district: item.shippingDistrict || '',
                            fullAddress: item.shippingAddressDetail || '',
                            phone: item.phoneNumber || '',
                            country: item.shippingCountryCode || 'Turkiye',
                        },
                        invoiceAddress: item.invoice?.address ? {
                            fullName: item.invoice.address.name || item.companyName || '',
                            city: item.invoice.address.city || item.billingCity || '',
                            district: item.invoice.address.district || item.billingDistrict || '',
                            fullAddress: item.invoice.address.address || item.billingAddress || '',
                            taxNumber: item.invoice.taxNumber || item.taxNumber || '',
                            taxOffice: item.invoice.taxOffice || item.taxOffice || '',
                            company: item.invoice.address.name || item.companyName || '',
                        } : {
                            fullName: item.companyName || '',
                            city: item.billingCity || '',
                            district: item.billingDistrict || '',
                            fullAddress: item.billingAddress || '',
                            taxNumber: item.taxNumber || '',
                            taxOffice: item.taxOffice || '',
                            company: item.companyName || '',
                        },
                        products: []
                    });
                }

                const orderEntry = allOrderMap.get(orderNum);

                // Fiyat: totalPrice obje { amount, currency } veya düz sayı olabilir
                const itemTotalPrice = Number(item.totalPrice?.amount || item.totalPrice || 0);
                const itemUnitPrice = Number(item.unitPrice?.amount || item.unitPrice || item.price?.amount || item.price || 0);
                const qty = Number(item.quantity || 1);
                const lineTotal = itemTotalPrice > 0 ? itemTotalPrice : (itemUnitPrice * qty);
                orderEntry.totalPrice += lineTotal;

                // Packages endpoint'i items[] array'i içinde kalemler döner
                // Orders endpoint'i her satırı ayrı item olarak döner
                const subItems = item.items || [];
                if (subItems.length > 0) {
                    // Packages response — items içinde kalemler var
                    subItems.forEach(sub => {
                        orderEntry.products.push({
                            productId: sub.hbSku || sub.sku || sub.merchantSku || sub.lineItemId || '',
                            productName: sub.productName || sub.name || 'Ürün',
                            quantity: Number(sub.quantity || 1),
                            price: Number(sub.totalPrice?.amount || sub.totalPrice || sub.price?.amount || sub.price || sub.merchantTotalPrice || 0),
                            imageUrl: sub.imageUrl || sub.productImageUrl || '/default-product.jpg',
                            sku: sub.hbSku || sub.sku || sub.merchantSku || '',
                            barcode: sub.merchantSku || sub.productBarcode || sub.sku || '',
                            commissionAmount: Number(sub.commission?.amount || 0)
                        });
                    });
                } else {
                    // Orders response — her satır bir kalem
                    orderEntry.products.push({
                        productId: item.sku || item.merchantSku || item.hbSku || item.id,
                        productName: item.productName || item.name || 'Ürün',
                        quantity: qty,
                        price: lineTotal > 0 ? lineTotal.toFixed(2) : itemUnitPrice.toFixed(2),
                        imageUrl: item.imageUrl || item.productImageUrl || '/default-product.jpg',
                        sku: item.sku || item.merchantSku || '',
                        barcode: item.merchantSku || item.productBarcode || item.sku || '',
                        commissionAmount: Number(item.commission?.amount || 0)
                    });
                }
            });
        };

        // ── Yardımcı: Pagination ile bir endpoint'ten tüm item'ları çek ──
        const fetchAllFromEndpoint = async (endpointUrl, label, maxLimit) => {
            let offset = 0;
            const limit = maxLimit || 100;
            let hasMore = true;
            let totalFetched = 0;

            while (hasMore) {
                try {
                    const url = endpointUrl.includes('?')
                        ? `${endpointUrl}&offset=${offset}&limit=${limit}`
                        : `${endpointUrl}?offset=${offset}&limit=${limit}`;

                    const response = await axios.get(url, { headers, timeout: 30000 });

                    if (response.status === 200) {
                        const data = response.data;
                        const items = data?.items || data?.orders || data?.data || data?.content || [];

                        if (!Array.isArray(items) || items.length === 0) {
                            hasMore = false;
                            break;
                        }

                        totalFetched += items.length;
                        return { items, totalCount: data?.totalCount || totalFetched };
                    } else {
                        hasMore = false;
                    }
                } catch (err) {
                    if (err.response?.status === 401) {
                        logger.error(`❌ [Hepsiburada ${label}] 401 Unauthorized`);
                    } else if (err.response?.status === 404) {
                        // 404 = bu statüde sipariş yok — normal durum
                    } else {
                        logger.warn(`⚠️ [Hepsiburada ${label}] API hatası: ${err.response?.status || err.message}`, {
                            responseData: typeof err.response?.data === 'string' ? err.response.data.substring(0, 500) : JSON.stringify(err.response?.data || '').substring(0, 500)
                        });
                    }
                    hasMore = false;
                }
            }
            return { items: [], totalCount: 0 };
        };

        // Tarih formatı: YYYY-MM-DD HH:mm:ss
        const fmtStart = moment(startDate).format('YYYY-MM-DD HH:mm:ss');
        const fmtEnd = moment(endDate).format('YYYY-MM-DD HH:mm:ss');
        const encStart = encodeURIComponent(fmtStart);
        const encEnd = encodeURIComponent(fmtEnd);

        // ═══════════════════════════════════════════════════════════════
        // 1) Ödemesi Tamamlanmış Siparişler (Open/Unpacked) — limit max 100
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 1: Ödemesi tamamlanmış siparişler çekiliyor...`);
        try {
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                const url = `${BASE_URL}/orders/merchantid/${merchantId}?begindate=${encStart}&enddate=${encEnd}&offset=${offset}&limit=${limit}`;
                try {
                    const resp = await axios.get(url, { headers, timeout: 30000 });
                    const items = resp.data?.items || [];
                    if (!Array.isArray(items) || items.length === 0) { hasMore = false; break; }
                    logger.info(`✅ [Hepsiburada Orders] ${items.length} kalem (offset=${offset})`);
                    addItemsToMap(items, 'Open');
                    if (items.length < limit) { hasMore = false; } else { offset += items.length; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 404) { hasMore = false; }
                    else if (err.response?.status === 401) {
                        logger.error(`❌ [Hepsiburada Orders] 401 Unauthorized — credentials hatalı veya ortam uyumsuz (useSit=${useSit})`);
                        hasMore = false;
                    } else {
                        logger.warn(`⚠️ [Hepsiburada Orders] Hata: ${err.response?.status || err.message}`, {
                            responseBody: JSON.stringify(err.response?.data || '').substring(0, 500)
                        });
                        hasMore = false;
                    }
                }
            }
        } catch (e) { logger.warn(`[Hepsiburada Orders] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 2) Paketlenmiş Siparişler (Packages) — timespan=720 (30 gün saat)
        //    HB Docs: Packages limit max 10, timespan tek başına max 24h
        //    timespan + limit + offset birlikte kullanımda timespan > 24h olabilir
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 2: Paketlenmiş siparişler çekiliyor...`);
        try {
            let offset = 0;
            const limit = 10;
            let hasMore = true;
            while (hasMore) {
                const url = `${BASE_URL}/packages/merchantid/${merchantId}?timespan=720&offset=${offset}&limit=${limit}`;
                try {
                    const resp = await axios.get(url, { headers, timeout: 30000 });
                    const items = resp.data?.items || resp.data || [];
                    const arr = Array.isArray(items) ? items : [];
                    if (arr.length === 0) { hasMore = false; break; }
                    logger.info(`✅ [Hepsiburada Packages] ${arr.length} paket (offset=${offset})`);
                    addItemsToMap(arr, 'Packaged');
                    if (arr.length < 10) { hasMore = false; } else { offset += arr.length; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 404 || err.response?.status === 401) { hasMore = false; }
                    else {
                        logger.warn(`⚠️ [Hepsiburada Packages] Hata: ${err.response?.status || err.message}`);
                        hasMore = false;
                    }
                }
            }
        } catch (e) { logger.warn(`[Hepsiburada Packages] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 3) Kargoya Verilmiş Siparişler — son 1 ay, limit max 50
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 3: Kargoya verilmiş siparişler çekiliyor...`);
        try {
            let offset = 0;
            const limit = 50;
            let hasMore = true;
            // Son 30 gün — API max 1 ay
            const shipStart = encodeURIComponent(moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss'));
            const shipEnd = encodeURIComponent(moment().format('YYYY-MM-DD HH:mm:ss'));
            while (hasMore) {
                const url = `${BASE_URL}/packages/merchantid/${merchantId}/shipped?begindate=${shipStart}&enddate=${shipEnd}&offset=${offset}&limit=${limit}`;
                try {
                    const resp = await axios.get(url, { headers, timeout: 30000 });
                    const items = resp.data?.items || resp.data || [];
                    const arr = Array.isArray(items) ? items : [];
                    if (arr.length === 0) { hasMore = false; break; }
                    logger.info(`✅ [Hepsiburada Shipped] ${arr.length} sipariş (offset=${offset})`);
                    addItemsToMap(arr, 'Shipped');
                    if (arr.length < limit) { hasMore = false; } else { offset += arr.length; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 404 || err.response?.status === 401) { hasMore = false; }
                    else {
                        logger.warn(`⚠️ [Hepsiburada Shipped] Hata: ${err.response?.status || err.message}`);
                        hasMore = false;
                    }
                }
            }
        } catch (e) { logger.warn(`[Hepsiburada Shipped] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 4) Teslim Edilmiş Siparişler — son 1 ay, limit max 50
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 4: Teslim edilmiş siparişler çekiliyor...`);
        try {
            let offset = 0;
            const limit = 50;
            let hasMore = true;
            const delStart = encodeURIComponent(moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss'));
            const delEnd = encodeURIComponent(moment().format('YYYY-MM-DD HH:mm:ss'));
            while (hasMore) {
                const url = `${BASE_URL}/packages/merchantid/${merchantId}/delivered?begindate=${delStart}&enddate=${delEnd}&offset=${offset}&limit=${limit}`;
                try {
                    const resp = await axios.get(url, { headers, timeout: 30000 });
                    const items = resp.data?.items || resp.data || [];
                    const arr = Array.isArray(items) ? items : [];
                    if (arr.length === 0) { hasMore = false; break; }
                    logger.info(`✅ [Hepsiburada Delivered] ${arr.length} sipariş (offset=${offset})`);
                    addItemsToMap(arr, 'Delivered');
                    if (arr.length < limit) { hasMore = false; } else { offset += arr.length; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 404 || err.response?.status === 401) { hasMore = false; }
                    else {
                        logger.warn(`⚠️ [Hepsiburada Delivered] Hata: ${err.response?.status || err.message}`);
                        hasMore = false;
                    }
                }
            }
        } catch (e) { logger.warn(`[Hepsiburada Delivered] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 5) İptal Edilmiş Siparişler — son 1 ay, limit max 50
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 5: İptal edilmiş siparişler çekiliyor...`);
        try {
            let offset = 0;
            const limit = 50;
            let hasMore = true;
            const canStart = encodeURIComponent(moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss'));
            const canEnd = encodeURIComponent(moment().format('YYYY-MM-DD HH:mm:ss'));
            while (hasMore) {
                const url = `${BASE_URL}/packages/merchantid/${merchantId}/cancelled?begindate=${canStart}&enddate=${canEnd}&offset=${offset}&limit=${limit}`;
                try {
                    const resp = await axios.get(url, { headers, timeout: 30000 });
                    const items = resp.data?.items || resp.data || [];
                    const arr = Array.isArray(items) ? items : [];
                    if (arr.length === 0) { hasMore = false; break; }
                    logger.info(`✅ [Hepsiburada Cancelled] ${arr.length} sipariş (offset=${offset})`);
                    addItemsToMap(arr, 'Cancelled');
                    if (arr.length < limit) { hasMore = false; } else { offset += arr.length; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 404 || err.response?.status === 401) { hasMore = false; }
                    else {
                        logger.warn(`⚠️ [Hepsiburada Cancelled] Hata: ${err.response?.status || err.message}`);
                        hasMore = false;
                    }
                }
            }
        } catch (e) { logger.warn(`[Hepsiburada Cancelled] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // Tüm siparişleri formatla
        // ═══════════════════════════════════════════════════════════════
        const uniqueOrders = Array.from(allOrderMap.values()).map(order => {
            return {
                ...order,
                orderDate: order.orderDate
                    ? new Date(order.orderDate).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
                    : 'Bilinmiyor',
                orderDateRaw: order.orderDate,
                totalPrice: order.totalPrice > 0 ? order.totalPrice.toFixed(2) : '0.00',
            };
        });

        logger.info(`✅ [Hepsiburada] Toplam ${uniqueOrders.length} benzersiz sipariş çekildi (orderMap)`);

        return uniqueOrders;
    } catch (error) {
        logger.error("❌ [Hepsiburada] Sipariş çekme hatası", {
            error: error.message,
            status: error.response?.status,
            data: JSON.stringify(error.response?.data || '').substring(0, 500)
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
                    customerName: pkg.customerfullName || "",
                    customerEmail: pkg.customerEmail || "",
                    totalPrice: totalAmount.toFixed(2),
                    status: pkg.shipmentPackageStatus,
                    trackingNumber: pkg.cargoTrackingNumber || "Yok",
                    cargoCompany: pkg.cargoProviderName || "Bilinmiyor",
                    // ── Müşteri adres bilgileri (fatura için) ──
                    shippingAddress: pkg.shippingAddress ? {
                        fullName: pkg.shippingAddress.fullName || pkg.customerfullName || "",
                        city: pkg.shippingAddress.city || "",
                        district: pkg.shippingAddress.district || "",
                        fullAddress: pkg.shippingAddress.address || pkg.shippingAddress.fullAddress || "",
                        phone: pkg.shippingAddress.phone || "",
                        country: pkg.shippingAddress.country || "Turkiye",
                    } : {},
                    invoiceAddress: pkg.invoiceAddress ? {
                        fullName: pkg.invoiceAddress.fullName || "",
                        city: pkg.invoiceAddress.city || "",
                        district: pkg.invoiceAddress.district || "",
                        fullAddress: pkg.invoiceAddress.address || pkg.invoiceAddress.fullAddress || "",
                        taxNumber: pkg.invoiceAddress.taxNumber || pkg.invoiceAddress.vkn || "",
                        taxOffice: pkg.invoiceAddress.taxOffice || "",
                        company: pkg.invoiceAddress.company || "",
                    } : {},
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
                    customerPhone: order.receiverPhone || "",
                    totalPrice: (order.totalPrice || 0).toFixed(2),
                    status: order.orderProductStatus || "Bilinmiyor",
                    trackingNumber: order.cargoNumber || "",
                    cargoCompany: order.cargoCompany || "",
                    // ── Müşteri adres bilgileri (fatura için) ──
                    shippingAddress: {
                        fullName: order.receiverName || "",
                        city: order.receiverCity || order.accountCityName || "",
                        district: order.receiverDistrict || order.accountDistrictName || "",
                        fullAddress: order.receiverAddress || "",
                        phone: order.receiverPhone || "",
                        country: "Turkiye",
                    },
                    invoiceAddress: {
                        fullName: order.accountCode || order.receiverName || "",
                        city: order.accountCityName || order.receiverCity || "",
                        district: order.accountDistrictName || order.receiverDistrict || "",
                        fullAddress: order.receiverAddress || "",
                        taxNumber: "",
                        taxOffice: "",
                        company: "",
                    },
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
