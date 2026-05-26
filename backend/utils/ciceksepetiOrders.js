/**
 * ÇiçekSepeti sipariş / iade — resmi API (GetOrders + getcanceledorders)
 * orderItemStatusId: 20–23 = iade akışı
 */
const { toStatusKey } = require("./orderStatus");

/** POST /Order/getcanceledorders — orderItemStatusId */
const CS_RETURN_ITEM_STATUS_IDS = [20, 21, 22, 23];

const CS_RETURN_STATUS_LABELS = {
    20: "İade Süreci Başladı",
    21: "İade Kargoda",
    22: "İade Tedarikçide",
    23: "İade Tedarikçi Onayı Bekliyor",
};

const includesAny = (value, list) => list.some((x) => value.includes(x));

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
                startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
                endDate: endDate instanceof Date ? endDate.toISOString() : endDate,
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

module.exports = {
    CS_RETURN_ITEM_STATUS_IDS,
    CS_RETURN_STATUS_LABELS,
    isCiceksepetiReturnStatus,
    resolveCiceksepetiReturnStatus,
    mapCanceledItemToOrder,
    fetchCiceksepetiReturnOrders,
};
