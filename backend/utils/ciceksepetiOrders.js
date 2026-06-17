/**

 * ÇiçekSepeti sipariş / iade — resmi API (GetOrders + getcanceledorders)

 * orderItemStatusId: 20–23 = iade akışı

 */

const moment = require("moment");
const { toStatusKey } = require("./orderStatus");

/** ÇiçekSepeti API — Türkiye saati (UTC+3) */
const CS_UTC_OFFSET_MIN = 180;



/** POST /Order/getcanceledorders — orderItemStatusId */

const CS_RETURN_ITEM_STATUS_IDS = [20, 21, 22, 23];



/** GetOrders statusId — aktif + kapanmış (teslim/kargo) statüler */

const CS_GET_ORDERS_STATUS_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];



/** Teslim / kapanmış siparişler için ek statusId sorguları */

const CS_DELIVERED_STATUS_IDS = [7, 8, 9];

/** Kargoda / taşıma — isOrderStatusActive:false tek başına yetmeyebilir */

const CS_SHIPPING_STATUS_IDS = [4, 5, 6, 12];



/** orderItemStatusId / statusId → panel metni (orderProductStatus boşsa) */

const CS_ITEM_STATUS_BY_ID = {

    1: "Yeni",

    2: "Hazırlanıyor",

    3: "Kargoya Verilecek",

    4: "Kargoda",

    5: "Kargoya Verildi",

    6: "Kargoda",

    7: "Teslim Edildi",

    8: "Tamamlandı",

    9: "Tamamlandı",

    10: "Onaylandı",

    11: "Kargoya Verilecek",

    12: "Taşıma Durumunda",

};



const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const MAX_FETCH_DAYS = 90;



const CS_RETURN_STATUS_LABELS = {

    20: "İade Süreci Başladı",

    21: "İade Kargoda",

    22: "İade Tedarikçide",

    23: "İade Tedarikçi Onayı Bekliyor",

};



const includesAny = (value, list) => list.some((x) => value.includes(x));



const formatCsApiDate = (ms) =>
    moment(ms).utcOffset(CS_UTC_OFFSET_MIN).format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");



const isCiceksepetiReturnStatus = (status) => {

    const key = toStatusKey(status);

    if (!key) return false;

    if (key.includes("iade")) return true;

    return includesAny(key, ["ihtilaf", "refund", "returned", "musteriyegonderilecek"]);

};



const resolveCiceksepetiReturnStatus = (item, statusId) => {

    const fromApi =

        item?.orderItemStatusName ||

        item?.orderProductStatus ||

        item?.statusName ||

        item?.status ||

        "";

    if (String(fromApi).trim()) return String(fromApi).trim();

    return CS_RETURN_STATUS_LABELS[statusId] || "İade";

};



const mapCanceledItemToOrder = (item, statusId) => {

    const orderNumber = String(item?.orderId ?? item?.orderNo ?? item?.orderNumber ?? "").trim();

    if (!orderNumber) return null;



    const dStr = item?.orderCreateDate || item?.orderDate;

    const tStr = (item?.orderCreateTime || "00:00:00").trim();



    const itemId = item?.orderItemId != null ? String(item.orderItemId) : "";



    return {

        orderNumber,

        orderItemId: item?.orderItemId,

        packageNumber: orderNumber,

        orderDate: dStr && tStr ? `${dStr} ${tStr}` : dStr,

        orderDateRaw: item?.orderCreateDate || item?.orderDate,

        customerName: item?.receiverName || item?.senderName || "Bilinmiyor",

        totalPrice: Number(item?.totalPrice ?? item?.itemPrice ?? 0).toFixed(2),

        status: resolveCiceksepetiReturnStatus(item, statusId),

        trackingNumber: itemId || item?.cargoNumber || item?.shipmentNumber || "",

        cargoTrackingNumber: item?.partialNumber || item?.cargoNumber || "",

        cargoCompany: item?.cargoCompany || "",

        isReturned: true,

        products: item?.name

            ? [

                  {

                      productName: item.name,

                      quantity: item?.quantity || 1,

                      price: Number(item?.itemPrice ?? item?.totalPrice ?? 0),

                      barcode: item?.barcode || "",

                      sku: item?.productCode || item?.code || "",

                  },

              ]

            : [],

    };

};



/**

 * İade siparişlerini getcanceledorders ile çek (rate limit: çağıran 5sn beklemeli)

 */

const fetchCiceksepetiReturnOrders = async (ciceksepetiService, credentials, startDate, endDate, onPage = null) => {

    const orders = [];

    const creds = { ...credentials };



    for (const orderItemStatusId of CS_RETURN_ITEM_STATUS_IDS) {

        let page = 0;

        while (true) {

            if (onPage) await onPage();



            const result = await ciceksepetiService.getCanceledOrders(creds, {

                orderItemStatusId,

                startDate: startDate instanceof Date ? formatCsApiDate(startDate.getTime()) : startDate,

                endDate: endDate instanceof Date ? formatCsApiDate(endDate.getTime()) : endDate,

                pageSize: 100,

                page,

            });



            if (!result.success) break;

            const items = result.orders || [];

            if (!items.length) break;



            items.forEach((item) => {

                const mapped = mapCanceledItemToOrder(item, orderItemStatusId);

                if (mapped) orders.push(mapped);

            });



            if (items.length < 100) break;

            page += 1;

        }

    }



    return orders;

};



const resolveCsOrderProductStatus = (order) => {

    const fromApi = String(

        order?.orderProductStatus ||

        order?.orderItemStatusName ||

        order?.statusName ||

        order?.status ||

        ""

    ).trim();

    if (fromApi) return fromApi;

    const sid = order?.orderItemStatusId ?? order?.statusId;

    if (sid != null && CS_ITEM_STATUS_BY_ID[sid]) return CS_ITEM_STATUS_BY_ID[sid];

    return "Bilinmiyor";

};



/**

 * GetOrders — 14 günlük chunk, tam sayfalama.

 * Teslim edilmiş / kapanmış siparişler isOrderStatusActive:false ile gelir.

 */

const fetchCiceksepetiOrdersInRange = async (ciceksepetiService, creds, startInput, endInput, mapOrderFn) => {

    let startMs = new Date(startInput).getTime();

    let endMs = new Date(endInput).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {

        endMs = Date.now();

        startMs = endMs - 14 * 24 * 60 * 60 * 1000;

    }

    if (startMs > endMs) [startMs, endMs] = [endMs, startMs];



    const maxStart = endMs - MAX_FETCH_DAYS * 24 * 60 * 60 * 1000;

    if (startMs < maxStart) startMs = maxStart;



    const byKey = new Map();

    let lastApiError = null;



    const ingest = (items) => {

        for (const raw of items || []) {

            const mapped = mapOrderFn(raw);

            const key = String(mapped.orderItemId || mapped.orderNumber || "").trim();

            if (!key) continue;

            byKey.set(key, mapped);

        }

    };



    const fetchChunkQuery = async (chunkStart, chunkEnd, extraParams) => {

        let page = 0;

        while (page < 100) {

            const result = await ciceksepetiService.getOrders(creds, {

                startDate: formatCsApiDate(chunkStart),

                endDate: formatCsApiDate(chunkEnd),

                pageSize: 100,

                page,

                ...extraParams,

            });



            if (!result.success) {

                lastApiError = result.error || lastApiError;

                if (/401|unauthorized|gecersiz|invalid/i.test(String(result.error || ""))) {

                    return "auth";

                }

                break;

            }



            const items = result.orders || [];

            if (!items.length) break;



            ingest(items);



            const totalPages = Number(result.totalPages);

            if (Number.isFinite(totalPages) && totalPages > 0 && page + 1 >= totalPages) break;

            if (items.length < 100) break;

            page += 1;

        }

        return null;

    };



    // Resmi API: aktif + pasif + hedefli statusId (kargo/teslim — pasif tek başına eksik kalabiliyor)
    const queryPlans = [
        { params: { isOrderStatusActive: true } },
        { params: { isOrderStatusActive: false } },
        { params: { statusId: 1 } },
        ...CS_SHIPPING_STATUS_IDS.map((statusId) => ({ params: { statusId } })),
        ...CS_DELIVERED_STATUS_IDS.map((statusId) => ({
            params: { statusId, isOrderStatusActive: false },
        })),
    ];

    for (let chunkStart = startMs; chunkStart <= endMs; chunkStart += TWO_WEEKS_MS) {
        const chunkEnd = Math.min(chunkStart + TWO_WEEKS_MS - 1, endMs);
        for (const { params } of queryPlans) {
            const auth = await fetchChunkQuery(chunkStart, chunkEnd, params);
            if (auth === "auth") {
                return { orders: [], lastApiError, authFailed: true };
            }
        }
    }



    return { orders: Array.from(byKey.values()), lastApiError, authFailed: false };

};



module.exports = {

    CS_RETURN_ITEM_STATUS_IDS,

    CS_RETURN_STATUS_LABELS,

    CS_GET_ORDERS_STATUS_IDS,

    CS_DELIVERED_STATUS_IDS,

    CS_SHIPPING_STATUS_IDS,

    CS_ITEM_STATUS_BY_ID,

    formatCsApiDate,

    isCiceksepetiReturnStatus,

    resolveCiceksepetiReturnStatus,

    resolveCsOrderProductStatus,

    mapCanceledItemToOrder,

    fetchCiceksepetiReturnOrders,

    fetchCiceksepetiOrdersInRange,

};


