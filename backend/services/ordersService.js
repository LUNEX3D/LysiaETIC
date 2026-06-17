const axios = require("axios");
const moment = require("moment");
const _ = require("lodash");
const logger = require("../config/logger");
const { marketplaceOrderDateToIsoString, trendyolOrderDateMsToUtcMs } = require("../utils/helpers");
const {
    resolveHepsiburadaOrderKey,
    normalizeHbOmsItem,
    fetchHbOrderByOrderNumber,
    mapHbOrderDetailToEntry,
    computeHbLineCustomerAmount,
    computeHbLineUnitCustomerPrice,
    normalizeCredentials: normalizeHbCredentials,
    getEndpoints: getHbEndpoints,
    getHeadersForGet: getHbHeadersForGet,
    resolveHbUseSitAuto,
    splitHbDateRange,
    formatHbOmsDateTime,
    HB_OMS_ORDERS_MAX_DAYS,
    HB_OMS_PACKAGES_MAX_DAYS
} = require("./hepsiburadaService");

/** HB OMS yanıtından sipariş/paket listesi çıkar */
const extractHbOmsList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    for (const key of ["items", "orders", "packages", "content", "data", "orderList"]) {
        const v = data[key];
        if (Array.isArray(v) && v.length) return v;
    }
    return [];
};
const { pickPreferredOrderRecord, resolveBestOrderStatus } = require("../utils/orderStatus");
const { fetchCiceksepetiReturnOrders, fetchCiceksepetiOrdersInRange, resolveCsOrderProductStatus } = require("../utils/ciceksepetiOrders");
const ciceksepetiService = require("./ciceksepeti/ciceksepetiService");
const { requestWithRetry } = require("../utils/apiRetry");

/** Aynı sipariş no için birden fazla paket satırını tek kayıtta birleştir (en ileri statü) */
const mergeOrdersByOrderNumber = (orders, marketplaceName) => {
    const map = new Map();
    const mp = String(marketplaceName || "");
    const isCs = /cicek|çiçek/i.test(mp);
    for (const order of orders) {
        const no = isCs
            ? String(order.orderItemId || order.orderNumber || "").trim()
            : String(order.orderNumber || "").trim();
        if (!no) continue;
        const prev = map.get(no);
        if (!prev) {
            map.set(no, order);
            continue;
        }
        const bestStatus = resolveBestOrderStatus(prev.status, order.status, mp);
        const preferred = pickPreferredOrderRecord(
            { status: prev.status, marketplaceName: mp, orderDate: prev.orderDate },
            { status: order.status, marketplaceName: mp, orderDate: order.orderDate }
        );
        const base = preferred.status === order.status ? order : prev;
        // CS: birleştirme anahtarı orderItemId olabilir; parent orderNumber korunmalı
        map.set(no, { ...base, status: bestStatus });
    }
    return Array.from(map.values());
};

/**
 * Trendyol paket yanıtından brüt, satıcı/TY indirimi ve faturalanacak (packageTotalPrice) tutarları.
 */
function extractTrendyolPackageMoney(pkg, lineFallbackTotal) {
    const n = (v) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
    };
    const lines = Array.isArray(pkg.lines) ? pkg.lines : [];
    let lineGrossSum = 0;
    let lineSellerSum = 0;
    let lineTySum = 0;
    for (const line of lines) {
        const qty = Math.max(1, n(line.quantity));
        const lg = n(line.lineGrossAmount);
        const amt = n(line.amount || line.price);
        const unitGross = lg > 0 ? lg : amt;
        lineGrossSum += unitGross * qty;
        lineSellerSum += n(line.lineSellerDiscount);
        lineTySum += n(line.lineTyDiscount || line.tyDiscount);
    }
    let sellerDisc = n(pkg.packageSellerDiscount);
    let tyDisc = n(pkg.packageTyDiscount || pkg.totalTyDiscount);
    if (sellerDisc <= 0 && lineSellerSum > 0) sellerDisc = lineSellerSum;
    if (tyDisc <= 0 && lineTySum > 0) tyDisc = lineTySum;

    const grossPkg = n(pkg.packageGrossAmount || pkg.grossAmount);
    const grossFinal = grossPkg > 0 ? grossPkg : (lineGrossSum > 0 ? lineGrossSum : n(lineFallbackTotal));

    let invoicePkg = n(pkg.packageTotalPrice);
    if (invoicePkg <= 0 && grossFinal > 0 && (sellerDisc > 0 || tyDisc > 0)) {
        invoicePkg = Math.max(0, grossFinal - sellerDisc - tyDisc);
    }
    if (invoicePkg <= 0) {
        invoicePkg = n(pkg.totalPrice);
    }
    if (invoicePkg <= 0 && grossFinal > 0) {
        invoicePkg = grossFinal;
    }

    return {
        grossOrderAmount: grossFinal,
        sellerDiscountTotal: sellerDisc,
        tyDiscountTotal: tyDisc,
        invoiceAmount: invoicePkg,
    };
}

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
                    },
                    timeout: 90000
                });

                if (!response.data || !Array.isArray(response.data.content)) break;

                orders.push(...response.data.content.map(pkg => {
                    const lineTotal = Array.isArray(pkg.lines)
                        ? pkg.lines.reduce((sum, line) => sum + (Number(line.amount || line.price || line.lineGrossAmount || 0) * Number(line.quantity || 1)), 0)
                        : 0;
                    const money = extractTrendyolPackageMoney(pkg, lineTotal);
                    const finalTotal =
                        money.invoiceAmount > 0
                            ? money.invoiceAmount
                            : (money.grossOrderAmount > 0 ? money.grossOrderAmount : lineTotal);

                    const tyOrderMsUtc = trendyolOrderDateMsToUtcMs(pkg.orderDate);
                    const tyOrderForParse =
                        tyOrderMsUtc != null && Number.isFinite(tyOrderMsUtc) ? tyOrderMsUtc : pkg.orderDate;

                    return {
                        orderNumber: pkg.orderNumber,
                        cargoTrackingNumber: pkg.cargoTrackingNumber != null ? String(pkg.cargoTrackingNumber) : "",
                        cargoCompany: pkg.cargoProviderName || pkg.cargoCompany || "",
                        shipmentPackageId: pkg.shipmentPackageId != null ? String(pkg.shipmentPackageId) : (pkg.id != null ? String(pkg.id) : ""),
                        cargoTrackingLink: pkg.cargoTrackingLink || "",
                        customerName: pkg.shipmentAddress?.fullName || (pkg.customerFirstName && pkg.customerLastName ? (pkg.customerFirstName + " " + pkg.customerLastName).trim() : (pkg.customerFirstName || "Unknown")),
                        customerFirstName: pkg.customerFirstName || "",
                        customerLastName: pkg.customerLastName || "",
                        customerEmail: pkg.customerEmail || "",
                        totalPrice: finalTotal > 0 ? finalTotal.toFixed(2) : "0.00",
                        grossOrderAmount: money.grossOrderAmount,
                        sellerDiscountTotal: money.sellerDiscountTotal,
                        tyDiscountTotal: money.tyDiscountTotal,
                        invoiceAmount: money.invoiceAmount,
                        status: pkg.status,
                        orderDate: marketplaceOrderDateToIsoString(tyOrderForParse) || undefined,
                        orderDateRaw: tyOrderForParse,
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
                            taxNumber: pkg.invoiceAddress.taxNumber || pkg.taxNumber || "",
                            taxOffice: pkg.invoiceAddress.taxOffice || "",
                            company: pkg.invoiceAddress.company || "",
                        } : (pkg.taxNumber ? { taxNumber: pkg.taxNumber } : {}),
                        // ── Pazaryeri fatura bilgileri (Trendyol getShipmentPackages) ──
                        // X kullanıcı LysiaETIC'ten ÖNCE paneli üzerinden fatura yüklediyse
                        // bu alanlar dolu gelir; sync sırasında okuyup Order'a yazıyoruz.
                        invoiceLink: pkg.invoiceLink || "",
                        commercialInvoice: !!pkg.commercial,
                        microExport: !!pkg.micro,
                        etgbNo: pkg.etgbNo || "",
                        etgbDate: pkg.etgbDate || null,
                        products: pkg.lines.map(line => {
                            let img =
                                line.imageUrl ||
                                line.productImageUrl ||
                                line.pictureUrl ||
                                line.coverImageUrl ||
                                line.thumbnail ||
                                line.variantImage ||
                                line.colorImageUrl ||
                                "";
                            if (!img && Array.isArray(line.images) && line.images.length) {
                                const fi = line.images[0];
                                img = typeof fi === "string" ? fi : (fi && (fi.url || fi.imageUrl || fi.image)) || "";
                            }
                            if (!img || img.includes("default-product.jpg")) {
                                img = "";
                            }
                            const msku = line.merchantSku || line.sku || "";
                            return {
                                productName: line.productName,
                                quantity: line.quantity,
                                price: line.amount || line.price || line.lineGrossAmount || 0,
                                barcode: line.barcode || line.productBarcode || "",
                                sku: msku,
                                merchantSku: msku,
                                productCode: line.productCode || "",
                                imageUrl: img,
                                commissionAmount: line.commissionFee || 0
                            };
                        })
                    };
                }));

                totalPages = response.data.totalPages;
                page++;
            } while (page < totalPages);

            currentStart = currentEnd + 1;
        }

        return mergeOrdersByOrderNumber(orders, "Trendyol");
    } catch (error) {
        logger.error("Trendyol orders error", { error: error.message });
        return [];
    }
};

const fetchHepsiburadaOrders = async (merchantId, serviceKey, startDate, endDate, userAgent, useSit = false) => {
    try {
        const hb = normalizeHbCredentials({ merchantId, secretKey: serviceKey, userAgent, useSit });
        merchantId = hb.merchantId;
        serviceKey = hb.secretKey;
        userAgent = hb.userAgent;

        if (!merchantId || !serviceKey) {
            logger.warn("Hepsiburada: MerchantId veya ServiceKey eksik");
            return [];
        }

        const effectiveSit = await resolveHbUseSitAuto({ ...hb, useSitRaw: useSit });
        const ep = getHbEndpoints({ useSit: effectiveSit });
        const BASE_URL = ep.OMS;
        const headers = getHbHeadersForGet(merchantId, serviceKey, userAgent);
        const isSit = BASE_URL.includes("-sit");

        logger.info("📦 [Hepsiburada] OMS Orders API ile siparişler çekiliyor...", {
            merchantId: merchantId.substring(0, 8) + "...",
            startDate: moment(startDate).format("YYYY-MM-DD HH:mm:ss"),
            endDate: moment(endDate).format("YYYY-MM-DD HH:mm:ss"),
            ortam: isSit ? "SIT" : "PROD",
        });

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

        const allOrderMap = new Map(); // sipariş anahtarı → order

        const ensureHbOrderEntry = (mapKey, orderNum, item, defaultStatus) => {
            if (!allOrderMap.has(mapKey)) {
                allOrderMap.set(mapKey, {
                    orderNumber: orderNum,
                    lineItemId: String(item.id || item.lineItemId || "").trim(),
                    orderDate: item.orderDate,
                    customerName: item.customerName || item.shippingAddress?.name || item.shippingAddressDetail?.name || item.recipientName || item.invoice?.address?.name || "Hepsiburada Müşteri",
                    customerEmail: item.invoice?.address?.email || item.shippingAddress?.email || item.email || "",
                    customerPhone: item.shippingAddress?.phoneNumber || item.invoice?.address?.phoneNumber || item.phoneNumber || "",
                    totalPrice: 0,
                    status: item.status || defaultStatus || "Open",
                    trackingNumber: item.barcode || item.trackingInfoCode || item.packageNumber || orderNum || "Yok",
                    cargoCompany: item.cargoCompany || item.cargoCompanyModel?.name || "Bilinmiyor",
                    packageNumber: item.packageNumber || "",
                    shippingAddress: item.shippingAddress
                        ? {
                              fullName: item.shippingAddress.name || item.customerName || item.recipientName || "",
                              city: item.shippingAddress.city || item.shippingCity || "",
                              district: item.shippingAddress.district || item.shippingDistrict || "",
                              fullAddress: item.shippingAddress.address || item.shippingAddress.addressDetail || item.shippingAddressDetail || "",
                              phone: item.shippingAddress.phoneNumber || item.phoneNumber || "",
                              country: item.shippingAddress.countryCode || item.shippingCountryCode || "Turkiye",
                          }
                        : {
                              fullName: item.recipientName || item.customerName || "",
                              city: item.shippingCity || "",
                              district: item.shippingDistrict || "",
                              fullAddress: item.shippingAddressDetail || "",
                              phone: item.phoneNumber || "",
                              country: item.shippingCountryCode || "Turkiye",
                          },
                    invoiceAddress: item.invoice?.address
                        ? {
                              fullName: item.invoice.address.name || item.companyName || "",
                              city: item.invoice.address.city || item.billingCity || "",
                              district: item.invoice.address.district || item.billingDistrict || "",
                              fullAddress: item.invoice.address.address || item.billingAddress || "",
                              taxNumber: item.invoice.taxNumber || item.taxNumber || "",
                              taxOffice: item.invoice.taxOffice || item.taxOffice || "",
                              company: item.invoice.address.name || item.companyName || "",
                          }
                        : {
                              fullName: item.companyName || "",
                              city: item.billingCity || "",
                              district: item.billingDistrict || "",
                              fullAddress: item.billingAddress || "",
                              taxNumber: item.taxNumber || "",
                              taxOffice: item.taxOffice || "",
                              company: item.companyName || "",
                          },
                    products: [],
                });
            }
            return allOrderMap.get(mapKey);
        };

        const pushHbProductLine = (orderEntry, lineItem) => {
            const qty = Number(lineItem.quantity || 1);
            const lineTotal = computeHbLineCustomerAmount(lineItem);
            const unitPaid = computeHbLineUnitCustomerPrice(lineItem);
            orderEntry.totalPrice += lineTotal;
            orderEntry.products.push({
                productId: lineItem.sku || lineItem.merchantSku || lineItem.hbSku || lineItem.id,
                productName: lineItem.productName || lineItem.name || "Ürün",
                quantity: qty,
                price: unitPaid > 0 ? unitPaid.toFixed(2) : lineTotal > 0 ? (lineTotal / qty).toFixed(2) : "0.00",
                imageUrl: (() => {
                    const u = lineItem.imageUrl || lineItem.productImageUrl || lineItem.pictureUrl || "";
                    if (!u || u.includes("default-product.jpg")) return "";
                    return u;
                })(),
                sku: lineItem.sku || lineItem.merchantSku || "",
                barcode: lineItem.merchantSku || lineItem.productBarcode || lineItem.sku || "",
                commissionAmount: Number(lineItem.commission?.amount || 0),
            });
        };

        /** HB OMS satırlarını sipariş anahtarına göre grupla — paket içi farklı siparişler birleşmesin */
        const addItemsToMap = (items, defaultStatus) => {
            const { shouldUpgradeHepsiburadaStatus } = require("../utils/orderStatus");

            for (const rawItem of items || []) {
                const item = normalizeHbOmsItem(rawItem);
                const subItems = item.items || [];

                const ingestOne = (lineItem, parent, statusLabel) => {
                    const orderNum = resolveHepsiburadaOrderKey(lineItem, parent);
                    if (!orderNum) {
                        logger.warn("[Hepsiburada] Sipariş anahtarı çözülemedi — satır atlandı", {
                            status: statusLabel,
                            lineId: lineItem.id,
                            packageNumber: lineItem.packageNumber || parent?.packageNumber,
                        });
                        return;
                    }
                    const mapKey = orderNum;
                    const orderEntry = ensureHbOrderEntry(mapKey, orderNum, lineItem.packageNumber ? lineItem : parent || lineItem, statusLabel);
                    const incomingStatus = lineItem.status || parent?.status || statusLabel || "Open";
                    if (shouldUpgradeHepsiburadaStatus(orderEntry.status, incomingStatus)) {
                        orderEntry.status = incomingStatus;
                    }
                    if (!orderEntry.lineItemId && lineItem.id) orderEntry.lineItemId = String(lineItem.id);
                    if (!orderEntry.packageNumber && (lineItem.packageNumber || parent?.packageNumber)) {
                        orderEntry.packageNumber = lineItem.packageNumber || parent?.packageNumber || "";
                    }
                    pushHbProductLine(orderEntry, lineItem);
                };

                if (subItems.length > 0) {
                    const grouped = new Map();
                    for (const rawSub of subItems) {
                        const sub = normalizeHbOmsItem(rawSub);
                        const key = resolveHepsiburadaOrderKey(sub, item);
                        if (!key) continue;
                        if (!grouped.has(key)) grouped.set(key, []);
                        grouped.get(key).push(sub);
                    }
                    for (const [, subs] of grouped) {
                        for (const sub of subs) ingestOne(sub, item, defaultStatus);
                    }
                } else {
                    ingestOne(item, null, defaultStatus);
                }
            }
        };

        // ── Yardımcı: Pagination ile bir endpoint'ten tüm item'ları çek ──
        // ✅ FIX: İlk sayfadan sonra return yerine tüm sayfaları çekip birleştir
        const fetchAllFromEndpoint = async (endpointUrl, label, maxLimit) => {
            let offset = 0;
            const limit = maxLimit || 100;
            let hasMore = true;
            const allItems = [];

            while (hasMore) {
                try {
                    const url = endpointUrl.includes('?')
                        ? `${endpointUrl}&offset=${offset}&limit=${limit}`
                        : `${endpointUrl}?offset=${offset}&limit=${limit}`;

                    const response = await requestWithRetry(
                        () => axios.get(url, { headers, timeout: 30000 }),
                        { label: `HB ${label}`, throttleKey: `hb-oms:${merchantId}` }
                    );

                    if (response.status === 200) {
                        const data = response.data;
                        const items = data?.items || data?.orders || data?.data || data?.content || [];

                        if (!Array.isArray(items) || items.length === 0) {
                            hasMore = false;
                            break;
                        }

                        allItems.push(...items);
                        if (items.length < limit) {
                            hasMore = false;
                        } else {
                            offset += items.length;
                        }
                        await new Promise(r => setTimeout(r, 300));
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
            return { items: allItems, totalCount: allItems.length };
        };

        /** Tarihsiz açık siparişler — HB panelindeki "yeni" kalemler çoğu zaman burada */
        const fetchOrdersOpenOffsetOnly = async () => {
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                const url = `${BASE_URL}/orders/merchantid/${merchantId}?offset=${offset}&limit=${limit}`;
                try {
                    const resp = await requestWithRetry(
                        () => axios.get(url, { headers, timeout: 30000 }),
                        { label: "HB Orders-open", throttleKey: `hb-oms:${merchantId}` }
                    );
                    const items = extractHbOmsList(resp.data);
                    if (!items.length) {
                        hasMore = false;
                        break;
                    }
                    logger.info(`✅ [Hepsiburada Orders-open] ${items.length} kalem (offset=${offset})`);
                    addItemsToMap(items, "Open");
                    if (items.length < limit) hasMore = false;
                    else offset += items.length;
                    await new Promise((r) => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 401) {
                        logger.error(`❌ [Hepsiburada Orders-open] 401 Unauthorized (ortam=${isSit ? "SIT" : "PROD"})`);
                    } else if (err.response?.status !== 404) {
                        logger.warn(`⚠️ [Hepsiburada Orders-open] Hata: ${err.response?.status || err.message}`);
                    }
                    hasMore = false;
                }
            }
        };

        const fetchOrdersOpenForRange = async (rangeStart, rangeEnd) => {
            const encStart = encodeURIComponent(formatHbOmsDateTime(rangeStart));
            const encEnd = encodeURIComponent(formatHbOmsDateTime(rangeEnd));
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                const url = `${BASE_URL}/orders/merchantid/${merchantId}?begindate=${encStart}&enddate=${encEnd}&offset=${offset}&limit=${limit}`;
                try {
                    const resp = await requestWithRetry(
                        () => axios.get(url, { headers, timeout: 30000 }),
                        { label: "HB Orders", throttleKey: `hb-oms:${merchantId}` }
                    );
                    const items = extractHbOmsList(resp.data);
                    if (!items.length) { hasMore = false; break; }
                    logger.info(`✅ [Hepsiburada Orders] ${items.length} kalem (offset=${offset}, ${encStart} → ${encEnd})`);
                    addItemsToMap(items, "Open");
                    if (items.length < limit) { hasMore = false; } else { offset += items.length; }
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.response?.status === 404) { hasMore = false; }
                    else if (err.response?.status === 401) {
                        logger.error(`❌ [Hepsiburada Orders] 401 Unauthorized — credentials hatalı veya ortam uyumsuz (useSit=${useSit})`);
                        hasMore = false;
                    } else {
                        logger.warn(`⚠️ [Hepsiburada Orders] Hata: ${err.response?.status || err.message}`, {
                            responseBody: JSON.stringify(err.response?.data || "").substring(0, 500)
                        });
                        hasMore = false;
                    }
                }
            }
        };

        const fetchPackagesByDatePath = async (pathSuffix, label, maxLimit = 50) => {
            const chunks = splitHbDateRange(startDate, endDate, HB_OMS_PACKAGES_MAX_DAYS);
            const ranges = chunks.length > 0 ? chunks : [{ start: moment(startDate), end: moment(endDate) }];
            for (const range of ranges) {
                const encStart = encodeURIComponent(formatHbOmsDateTime(range.start));
                const encEnd = encodeURIComponent(formatHbOmsDateTime(range.end));
                let offset = 0;
                const limit = maxLimit;
                let hasMore = true;
                while (hasMore) {
                    const base = pathSuffix
                        ? `${BASE_URL}/packages/merchantid/${merchantId}/${pathSuffix}`
                        : `${BASE_URL}/packages/merchantid/${merchantId}`;
                    const url = `${base}?begindate=${encStart}&enddate=${encEnd}&offset=${offset}&limit=${limit}`;
                    try {
                        const resp = await requestWithRetry(
                            () => axios.get(url, { headers, timeout: 30000 }),
                            { label: `HB ${label}`, throttleKey: `hb-oms:${merchantId}` }
                        );
                        const arr = extractHbOmsList(resp.data);
                        if (arr.length === 0) { hasMore = false; break; }
                        logger.info(`✅ [Hepsiburada ${label}] ${arr.length} kayıt (offset=${offset})`);
                        addItemsToMap(arr, label);
                        if (arr.length < limit) { hasMore = false; } else { offset += arr.length; }
                        await new Promise(r => setTimeout(r, 300));
                    } catch (err) {
                        if (err.response?.status === 404 || err.response?.status === 401) { hasMore = false; }
                        else {
                            logger.warn(`⚠️ [Hepsiburada ${label}] Hata: ${err.response?.status || err.message}`);
                            hasMore = false;
                        }
                    }
                }
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // 0) Tarihsiz açık siparişler (offset/limit)
        // ═══════════════════════════════════════════════════════════════
        if (!isSit) {
            logger.info(`🔍 [Hepsiburada] Adım 0: Açık siparişler (tarihsiz) çekiliyor...`);
            try {
                await fetchOrdersOpenOffsetOnly();
            } catch (e) {
                logger.warn(`[Hepsiburada Orders-open] Genel hata: ${e.message}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 1) Ödemesi Tamamlanmış (Open) — HB çoğu hesapta ≤2 günlük aralık ister
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 1: Ödemesi tamamlanmış siparişler çekiliyor...`);
        try {
            const orderChunks = splitHbDateRange(startDate, endDate, HB_OMS_ORDERS_MAX_DAYS);
            const ranges = orderChunks.length > 0 ? orderChunks : [{ start: moment(startDate), end: moment(endDate) }];
            for (const range of ranges) {
                await fetchOrdersOpenForRange(range.start, range.end);
            }
        } catch (e) { logger.warn(`[Hepsiburada Orders] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 1.5) İşlemde / paketlenmemiş — resmi path: /status/unpacked (+ legacy yedek)
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 1.5: İşlemde (unpacked) siparişler çekiliyor...`);
        try {
            await fetchPackagesByDatePath("status/unpacked", "Status-Unpacked", 50);
        } catch (e) { logger.warn(`[Hepsiburada Status-Unpacked] Genel hata: ${e.message}`); }
        try {
            await fetchPackagesByDatePath("unpacked", "Unpacked-legacy", 50);
        } catch (e) { logger.warn(`[Hepsiburada Unpacked] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 1.6) Tarih aralığıyla paketlenmiş (gönderime hazır) — işlemde statüsü
        // ═══════════════════════════════════════════════════════════════
        logger.info(`🔍 [Hepsiburada] Adım 1.6: Tarih aralığıyla paketler çekiliyor...`);
        try {
            await fetchPackagesByDatePath("", "Packages-dated", 50);
        } catch (e) { logger.warn(`[Hepsiburada Packages-dated] Genel hata: ${e.message}`); }

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
                    const resp = await requestWithRetry(
                        () => axios.get(url, { headers, timeout: 30000 }),
                        { label: "HB Packages", throttleKey: `hb-oms:${merchantId}` }
                    );
                    const arr = extractHbOmsList(resp.data);
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
            await fetchPackagesByDatePath("shipped", "Shipped", 50);
        } catch (e) { logger.warn(`[Hepsiburada Shipped] Genel hata: ${e.message}`); }

        logger.info(`🔍 [Hepsiburada] Adım 4: Teslim edilmiş siparişler çekiliyor...`);
        try {
            await fetchPackagesByDatePath("delivered", "Delivered", 50);
        } catch (e) { logger.warn(`[Hepsiburada Delivered] Genel hata: ${e.message}`); }

        logger.info(`🔍 [Hepsiburada] Adım 5: İptal edilmiş siparişler çekiliyor...`);
        try {
            await fetchPackagesByDatePath("cancelled", "Cancelled", 50);
        } catch (e) { logger.warn(`[Hepsiburada Cancelled] Genel hata: ${e.message}`); }

        // ═══════════════════════════════════════════════════════════════
        // 6) Sipariş detayı — shipped listesi yalnızca OrderNumber/PackageNumber verir
        //    GET /orders/merchantid/{id}/ordernumber/{orderNumber}
        // ═══════════════════════════════════════════════════════════════
        const needsDetail = [...allOrderMap.entries()].filter(([, o]) => {
            const name = String(o.customerName || "");
            const noRealName = !name || name === "Hepsiburada Müşteri";
            const noProducts = !Array.isArray(o.products) || o.products.length === 0;
            const noPrice = Number(o.totalPrice || 0) <= 0;
            return noRealName || noProducts || noPrice;
        });
        if (needsDetail.length) {
            logger.info(`🔍 [Hepsiburada] Adım 6: ${needsDetail.length} sipariş detayı zenginleştiriliyor...`);
            for (const [orderNum, entry] of needsDetail) {
                try {
                    const detail = await fetchHbOrderByOrderNumber(
                        merchantId,
                        serviceKey,
                        userAgent,
                        orderNum,
                        effectiveSit
                    );
                    if (detail) {
                        allOrderMap.set(orderNum, mapHbOrderDetailToEntry(detail, entry));
                    }
                    await new Promise((r) => setTimeout(r, 250));
                } catch (e) {
                    logger.warn(`[Hepsiburada Detail] ${orderNum}: ${e.message}`);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // Tüm siparişleri formatla
        // ═══════════════════════════════════════════════════════════════
        const uniqueOrders = Array.from(allOrderMap.values()).map(order => {
            return {
                ...order,
                orderDate: marketplaceOrderDateToIsoString(order.orderDate) || (order.orderDate ? String(order.orderDate) : "Bilinmiyor"),
                orderDateRaw: order.orderDate,
                totalPrice: order.totalPrice > 0 ? order.totalPrice.toFixed(2) : '0.00',
            };
        });

        logger.info(`✅ [Hepsiburada] Toplam ${uniqueOrders.length} benzersiz sipariş çekildi (ortam=${isSit ? "SIT" : "PROD"})`);
        if (uniqueOrders.length === 0) {
            logger.warn(
                `[Hepsiburada] API'den sipariş dönmedi. Kontrol: merchantId + secretKey, User-Agent (developer username), ` +
                    `ortam (useSit=${effectiveSit}). Loglarda 401 varsa kimlik bilgilerini veya SIT/PROD seçimini düzeltin.`
            );
        }

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

const mapN11PackageToOrder = (pkg) => {
    const lines = Array.isArray(pkg.lines) ? pkg.lines : [];
    const totalAmount = lines.reduce((sum, line) => sum + Number(line.sellerInvoiceAmount || 0), 0);
    return {
        orderNumber: pkg.orderNumber,
        orderDate: pkg.packageHistories?.[0]?.createdDate
            ? moment(pkg.packageHistories[0].createdDate).format("DD-MM-YYYY HH:mm")
            : "Bilinmiyor",
        orderDateRaw: pkg.packageHistories?.[0]?.createdDate || null,
        customerName: pkg.customerfullName || "",
        customerEmail: pkg.customerEmail || "",
        totalPrice: totalAmount.toFixed(2),
        status: pkg.shipmentPackageStatus,
        trackingNumber: pkg.cargoTrackingNumber || pkg.orderNumber || "Yok",
        cargoTrackingNumber: pkg.cargoTrackingNumber != null ? String(pkg.cargoTrackingNumber) : "",
        cargoCompany: pkg.cargoProviderName || "Bilinmiyor",
        shipmentPackageId: pkg.id != null ? String(pkg.id) : "",
        cargoTrackingLink: pkg.cargoTrackingLink || "",
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
        products: lines.map((line) => {
            // N11 sipariş yanıtının "lines" bloğunda görsel alanı YOKTUR.
            // Görsel, ordersController zenginleştirme adımında stockCode/sku
            // eşleşmesiyle ürün kataloğundan doldurulur — bu yüzden satıcı stok
            // kodunun doğru alandan (N11: "stockCode") okunması şarttır.
            let img = line.imageUrl || line.productImageUrl || line.productImage || "";
            if (!img || img.includes("default-product.jpg")) img = "";
            // N11 satır alanları: satıcı stok kodu "stockCode", ürün kodu "productId"
            const stockCode = String(
                line.stockCode || line.merchantSku || line.sku || ""
            ).trim();
            const qty = Number(line.quantity) || 1;
            const unitPrice = Number(line.sellerInvoiceAmount || line.price || 0);
            const lineRevenue = unitPrice * qty;
            const commissionRate = Number(line.commissionRate) || 0;
            const commissionAmount = Number(line.commissionAmount) ||
                (commissionRate > 0 ? lineRevenue * (commissionRate / 100) : 0);
            return {
                productName: line.productName,
                quantity: qty,
                price: unitPrice,
                commissionRate,
                commissionAmount,
                barcode: line.barcode || line.productBarcode || "",
                sku: stockCode,
                merchantSku: stockCode,
                stockCode: stockCode,
                productCode: String(line.productId || line.productCode || "").trim(),
                imageUrl: img,
            };
        }),
    };
};

/**
 * N11 REST geçerli statü değerleri (v9.0 dokümanı + canlı API teyidi):
 *   Created (Yeni) → Picking (Onaylandı/Hazırlanıyor) → Shipped → Delivered
 *   | Cancelled | UnPacked | UnSupplied
 * ⚠️ Eski "New/Approved/Completed/Rejected" değerleri GEÇERSİZ — N11 boş döner.
 * status parametresi tek değer alır; her statü için ayrı sorgu atılır.
 */
const N11_FETCH_STATUSES = ["Created", "Picking", "Shipped", "Cancelled", "Delivered", "UnPacked", "UnSupplied"];

const fetchN11Orders = async (apiKey, secretKey, startDate, endDate) => {
    const orders = [];
    const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");
    const headers = {
        appkey: cleanAscii(apiKey),
        appsecret: cleanAscii(secretKey),
        "Content-Type": "application/json",
    };

    for (const statusFilter of N11_FETCH_STATUSES) {
        let page = 0;
        let totalPages = 1;

        while (page < totalPages) {
            const url =
                `https://api.n11.com/rest/delivery/v1/shipmentPackages` +
                `?startDate=${startDate}` +
                `&endDate=${endDate}` +
                `&status=${statusFilter}` +
                `&page=${page}` +
                `&size=100` +
                `&orderByDirection=DESC` +
                `&orderByField=true`;

            try {
                const response = await axios.get(url, { headers, timeout: 60000 });
                const data = response.data?.content || [];
                if (!data.length) break;

                data.forEach((pkg) => orders.push(mapN11PackageToOrder(pkg)));

                totalPages = response.data?.totalPages || 1;
                page++;
            } catch (err) {
                if (err.response?.status !== 400 && err.response?.status !== 404) {
                    logger.error("N11 API error", { status: statusFilter, error: err.message });
                }
                break;
            }
        }
    }

    return mergeOrdersByOrderNumber(orders, "N11");
};

const mapCiceksepetiApiOrder = (order) => {
    const statusLabel = resolveCsOrderProductStatus(order);
    const isDelivered = /teslim|tamamlandi|tamamland/i.test(statusLabel);
    const dStr = isDelivered
        ? (order.orderModifyDate || order.orderCreateDate)
        : (order.orderCreateDate || order.orderModifyDate);
    const tStr = (
        (isDelivered
            ? (order.orderModifyTime || order.orderCreateTime)
            : (order.orderCreateTime || order.orderModifyTime)) || "00:00:00"
    ).trim();
    const p = String(dStr || "").split(/[./]/);
    let csIsoRaw = null;
    if (p.length === 3 && !String(p[0]).includes("-")) {
        const [dd, mm, yy] = p;
        const pad = (x) => String(x).padStart(2, "0");
        csIsoRaw = `${yy}-${pad(mm)}-${pad(dd)}T${tStr.length === 5 ? `${tStr}:00` : tStr}+03:00`;
    } else if (dStr) {
        const isoCandidate = tStr && !String(dStr).includes("T")
            ? `${dStr}T${tStr.length === 5 ? `${tStr}:00` : tStr}+03:00`
            : dStr;
        csIsoRaw = isoCandidate;
    }
    const parentOrderId = order.orderId?.toString() || "";
    const itemId = order.orderItemId != null ? String(order.orderItemId) : "";
    const cargoCode = String(order.partialNumber || order.cargoNumber || "").trim();

    return {
        orderNumber: parentOrderId,
        orderItemId: order.orderItemId,
        packageNumber: parentOrderId,
        orderDate: marketplaceOrderDateToIsoString(csIsoRaw) || undefined,
        orderDateRaw: csIsoRaw || (dStr && tStr ? `${dStr} ${tStr}` : order.orderCreateDate),
        customerName: order.receiverName || order.senderName || "Bilinmiyor",
        customerPhone: order.receiverPhone || "",
        totalPrice: (order.totalPrice || 0).toFixed(2),
        status: resolveCsOrderProductStatus(order),
        orderItemStatusId: order.orderItemStatusId,
        trackingNumber: itemId || parentOrderId,
        cargoTrackingNumber: cargoCode,
        cargoCompany: String(order.cargoCompany || "").trim(),
        cargoTrackingLink: order.shipmentTrackingUrl || "",
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
        products: (() => {
            const qty = Number(order.quantity) || 1;
            const unitPrice = Number(order.itemPrice || order.totalPrice || 0);
            const lineRevenue = unitPrice * qty;
            const commissionRate = Number(order.commissionRate) || 0;
            const commissionAmount = commissionRate > 0 ? lineRevenue * (commissionRate / 100) : 0;
            return [
                {
                    productName: order.name || "Ürün",
                    quantity: qty,
                    price: unitPrice.toFixed(2),
                    commissionRate,
                    commissionAmount,
                    imageUrl: (() => {
                        const u = order.imageUrl || order.productImageUrl || "";
                        if (!u || u.includes("default-product.jpg")) return "";
                        return u;
                    })(),
                    barcode: order.barcode || "",
                    sku: order.productCode || order.code || "",
                    productCode: order.productCode || order.code || "",
                },
            ];
        })(),
    };
};

/**
 * ÇiçekSepeti Sipariş Çekme
 * Resmi API: POST /api/v1/Order/GetOrders — aktif + pasif (teslim/kapanmış) tam sayfalama
 */
const fetchCicekSepetiOrders = async (apiKeyOrCreds, sellerIdOrStart, integratorNameOrEnd, startDateMs, endDateMs) => {
    const creds =
        typeof apiKeyOrCreds === "object" && apiKeyOrCreds !== null && !Array.isArray(apiKeyOrCreds)
            ? {
                apiKey: apiKeyOrCreds.apiKey,
                sellerId: apiKeyOrCreds.sellerId,
                integratorName: apiKeyOrCreds.integratorName,
                isTestMode: apiKeyOrCreds.isTestMode === true,
            }
            : {
                apiKey: apiKeyOrCreds,
                sellerId: sellerIdOrStart,
                integratorName: integratorNameOrEnd,
                isTestMode: false,
            };

    if (!creds.apiKey) {
        logger.error("[ÇiçekSepeti] API Key eksik — sipariş çekilemedi");
        return { orders: [], error: "API Key eksik", authFailed: true };
    }

    let rangeStart = startDateMs;
    let rangeEnd = endDateMs;
    if (rangeStart == null && typeof sellerIdOrStart === "number") rangeStart = sellerIdOrStart;
    if (rangeEnd == null && typeof integratorNameOrEnd === "number") rangeEnd = integratorNameOrEnd;
    if (rangeStart == null) rangeStart = moment().subtract(14, "days").startOf("day").valueOf();
    if (rangeEnd == null) rangeEnd = moment().endOf("day").valueOf();

    try {
        const { orders, lastApiError, authFailed } = await fetchCiceksepetiOrdersInRange(
            ciceksepetiService,
            creds,
            rangeStart,
            rangeEnd,
            mapCiceksepetiApiOrder
        );

        if (authFailed) {
            return { orders: [], error: lastApiError || "Yetkilendirme hatası", authFailed: true };
        }

        const returnOrders = await fetchCiceksepetiReturnOrders(
            ciceksepetiService,
            creds,
            new Date(rangeStart),
            new Date(rangeEnd),
            null
        );
        if (returnOrders.length) {
            logger.info(`[ÇiçekSepeti] ${returnOrders.length} iade/iptal kaydı birleştiriliyor`);
            orders.push(...returnOrders);
        }

        const merged = mergeOrdersByOrderNumber(orders, "ÇiçekSepeti");
        if (merged.length === 0 && lastApiError) {
            logger.error("[ÇiçekSepeti] Sipariş bulunamadı — son API hatası", { error: lastApiError });
        } else {
            logger.info(`✅ [ÇiçekSepeti] Toplam ${merged.length} sipariş (${Math.ceil((rangeEnd - rangeStart) / (24 * 60 * 60 * 1000))}g pencere)`);
        }
        return { orders: merged, error: lastApiError || null, authFailed: false };
    } catch (err) {
        logger.error("[ÇiçekSepeti] Sipariş çekme hatası", { error: err.message });
        return { orders: [], error: err.message, authFailed: false };
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

const extractEbayXmlValue = (block, tag) => {
    if (!block) return "";
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    const m = String(block).match(re);
    return m ? m[1].trim() : "";
};

const parseEbayGetOrdersResponse = (xml) => {
    if (!xml || typeof xml !== "string") return [];
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
        const err =
            extractEbayXmlValue(xml, "LongMessage") ||
            extractEbayXmlValue(xml, "ShortMessage") ||
            "eBay API Failure";
        throw new Error(err);
    }

    const orders = [];
    const orderBlocks = xml.match(/<Order>[\s\S]*?<\/Order>/gi) || [];
    for (const block of orderBlocks) {
        const orderId = extractEbayXmlValue(block, "OrderID");
        const created = extractEbayXmlValue(block, "CreatedTime");
        const status = extractEbayXmlValue(block, "OrderStatus");
        const amountPaid = extractEbayXmlValue(block, "AmountPaid") || extractEbayXmlValue(block, "Total");
        const buyerBlock = block.match(/<Buyer>[\s\S]*?<\/Buyer>/i)?.[0] || "";
        const products = [];
        const txBlocks = block.match(/<Transaction>[\s\S]*?<\/Transaction>/gi) || [];
        for (const tx of txBlocks) {
            const itemBlock = tx.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] || "";
            const qty = parseInt(extractEbayXmlValue(tx, "QuantityPurchased"), 10) || 1;
            const price = extractEbayXmlValue(tx, "TransactionPrice") || "0";
            products.push({
                productName: extractEbayXmlValue(itemBlock, "Title") || extractEbayXmlValue(tx, "Title") || "Ürün",
                quantity: qty,
                price: parseFloat(price) || 0,
                sku: extractEbayXmlValue(itemBlock, "SKU") || "",
            });
        }
        const total =
            parseFloat(amountPaid) ||
            products.reduce((sum, p) => sum + (Number(p.price) || 0) * (p.quantity || 1), 0);

        orders.push({
            orderNumber: orderId,
            orderDate: created ? new Date(created).toISOString() : new Date().toISOString(),
            customerName: extractEbayXmlValue(buyerBlock, "UserID") || "eBay müşteri",
            totalPrice: total.toFixed(2),
            status: status || "Unknown",
            products,
        });
    }
    return orders;
};

/**
 * eBay Siparişleri
 * eBay Trading API kullanır
 */
const fetchEbayOrders = async (appId, devId, certId, userToken, siteId, startDate, endDate) => {
    try {
        if (!appId || !devId || !certId || !userToken) {
            throw new Error("eBay App ID, Dev ID, Cert ID ve User Token zorunludur");
        }

        const createdFrom = new Date(startDate).toISOString();
        const createdTo = new Date(endDate).toISOString();

        const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${userToken}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${createdFrom}</CreateTimeFrom>
  <CreateTimeTo>${createdTo}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetOrdersRequest>`;

        const response = await axios.post("https://api.ebay.com/ws/api.dll", xmlRequest, {
            headers: {
                "X-EBAY-API-SITEID": String(siteId || "0"),
                "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "GetOrders",
                "X-EBAY-API-APP-NAME": appId,
                "X-EBAY-API-DEV-NAME": devId,
                "X-EBAY-API-CERT-NAME": certId,
                "Content-Type": "text/xml",
            },
            timeout: 45000,
        });

        const orders = parseEbayGetOrdersResponse(response.data);
        logger.info(`[eBay] ${orders.length} sipariş çekildi`);
        return orders;
    } catch (error) {
        logger.error("eBay API error", { error: error.message });
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

const fetchOzonOrders = async (clientId, apiKey, startDate, endDate, useSandbox = false) => {
    const { fetchOzonOrders: fetchOzon } = require("./ozon/ozonService");
    try {
        return await fetchOzon(
            { clientId, apiKey, useSandbox },
            startDate,
            endDate
        );
    } catch (error) {
        logger.error("[Ozon] Sipariş çekme hatası: " + error.message);
        return [];
    }
};

module.exports = {
    extractTrendyolPackageMoney,
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders,
    fetchAmazonOrders,
    fetchEbayOrders,
    fetchPttAVMOrders,
    fetchOzonOrders,
};
