/**
 * ÇiçekSepeti kargo etiketi — CS entegrasyonu (partialNumber) / tedarikçi kargo
 * @see https://ciceksepeti.dev/siparis/sparis-kargo-srecleri/cicek-sepeti-kargo-entegrasyonu
 */

const moment = require("moment");
const ciceksepetiService = require("./ciceksepeti/ciceksepetiService");
const { buildMarketplaceA4LabelResponse, formatFullAddress } = require("./marketplaceA4LabelService");
const logger = require("../config/logger");

const CS_STATUS_YENI = new Set(["yeni", "new", "1"]);
const INVALID_BARCODE = new Set(["yok", "none", "bilinmiyor", "—", "-", "n/a", "null"]);

const sanitizeBarcode = (value) => {
    const s = String(value ?? "").trim();
    if (!s || INVALID_BARCODE.has(s.toLowerCase())) return "";
    return s;
};

const normalizeCsStatus = (status = "") =>
    String(status || "")
        .trim()
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");

const isCsNewOrder = (status) => {
    const k = normalizeCsStatus(status);
    return CS_STATUS_YENI.has(k) || k === "yeni siparis";
};

const parseCargoCodeResponse = (data) => {
    const updates = Array.isArray(data) ? data : [];
    for (const block of updates) {
        const items = block?.orderItems || block?.orderItem || [];
        const list = Array.isArray(items) ? items : [items];
        for (const it of list) {
            if (!it) continue;
            const partial = sanitizeBarcode(it.partialNumber);
            const cargo = String(it.cargoCompany || it["cargoCompany "] || "").trim();
            if (partial) {
                return {
                    partialNumber: partial,
                    cargoCompany: cargo,
                    orderItemId: it.orderItemId,
                };
            }
        }
    }
    return null;
};

async function fetchCiceksepetiOrderLive(credentials, orderNumber, orderItemId) {
    const creds = {
        apiKey: credentials.apiKey,
        sellerId: credentials.sellerId,
        integratorName: credentials.integratorName,
        isTestMode: credentials.isTestMode || false,
    };

    const orderNo = String(orderNumber || "").trim();
    const itemNo = orderItemId != null ? parseInt(orderItemId, 10) : null;

    const params = {
        pageSize: 50,
        page: 0,
        startDate: moment().subtract(30, "days").format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
        endDate: moment().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
    };
    if (orderNo) params.orderNo = parseInt(orderNo, 10) || orderNo;
    if (itemNo) params.orderItemNo = itemNo;

    const result = await ciceksepetiService.getOrders(creds, params);
    if (!result.success || !result.orders?.length) return null;

    if (itemNo) {
        const hit = result.orders.find((o) => Number(o.orderItemId) === itemNo);
        if (hit) return hit;
    }
    if (orderNo) {
        const hit = result.orders.find((o) => String(o.orderId) === orderNo);
        if (hit) return hit;
    }
    return result.orders[0];
}

async function requestCsCargoCode(credentials, orderItemId) {
    const id = parseInt(orderItemId, 10);
    if (!id) return null;

    const creds = {
        apiKey: credentials.apiKey,
        sellerId: credentials.sellerId,
        integratorName: credentials.integratorName,
        isTestMode: credentials.isTestMode || false,
    };

    const cargoResult = await ciceksepetiService.getCargoCode(creds, [{ orderItemIds: [id] }]);
    if (!cargoResult.success) {
        throw new Error(cargoResult.error || "ÇiçekSepeti kargo kodu alınamadı.");
    }
    return parseCargoCodeResponse(cargoResult.data);
}

function mapCsOrderToLabelMeta(live, base = {}) {
    const partial = sanitizeBarcode(
        base.partialNumber ||
            live?.partialNumber ||
            live?.cargoNumber ||
            base.cargoTrackingNumber ||
            base.trackingNumber
    );
    const addr = base.customerAddress || {};
    const fullAddress = formatFullAddress(
        {
            district: live?.receiverDistrict || addr.district,
            city: live?.receiverCity || addr.city,
        },
        live?.receiverAddress || addr.street || base.fullAddress
    );

    const integrationType =
        base.integrationType ||
        (live?.cargoNumber && !String(live.cargoNumber).includes("-") ? "supplier" : "cs");

    return {
        orderNumber: String(base.orderNumber || live?.orderId || "").trim(),
        orderItemId: live?.orderItemId || base.orderItemId,
        customerName:
            base.customerName ||
            live?.receiverName ||
            live?.senderName ||
            "—",
        fullAddress,
        city: live?.receiverCity || addr.city || "",
        district: live?.receiverDistrict || addr.district || "",
        cargoTrackingNumber: partial,
        partialNumber: partial,
        cargoCompany: base.cargoCompany || live?.cargoCompany || "",
        integrationType,
        marketplaceDisplay: "ÇiçekSepeti",
    };
}

/**
 * @param {object} credentials
 * @param {object} opts — orderNumber, orderItemId, db row fields
 */
async function fetchCiceksepetiLabel(credentials, opts = {}) {
    if (!credentials?.apiKey) {
        throw new Error("ÇiçekSepeti API anahtarı eksik.");
    }

    const orderNumber = String(opts.orderNumber || "").trim();
    let orderItemId = opts.orderItemId;
    let live = null;

    try {
        live = await fetchCiceksepetiOrderLive(credentials, orderNumber, orderItemId);
        if (live?.orderItemId) orderItemId = live.orderItemId;
    } catch (e) {
        logger.warn(`[ShippingLabel] CS canlı sipariş: ${e.message}`);
    }

    let meta = mapCsOrderToLabelMeta(live, {
        ...opts,
        orderNumber: orderNumber || live?.orderId,
        orderItemId,
    });

    if (!meta.cargoTrackingNumber && orderItemId && isCsNewOrder(live?.orderProductStatus || opts.status)) {
        try {
            const code = await requestCsCargoCode(credentials, orderItemId);
            if (code?.partialNumber) {
                meta.cargoTrackingNumber = code.partialNumber;
                meta.partialNumber = code.partialNumber;
                if (code.cargoCompany) meta.cargoCompany = code.cargoCompany;
                meta.integrationType = "cs";
            }
        } catch (e) {
            logger.warn(`[ShippingLabel] CS kargo kodu: ${e.message}`);
            throw new Error(
                e.message ||
                    "ÇiçekSepeti kargo kodu henüz oluşmadı. Sipariş «Yeni» statüsünde olmalı; birkaç saniye sonra tekrar deneyin."
            );
        }
    }

    if (!meta.cargoTrackingNumber) {
        const hint = live?.orderProductStatus
            ? ` Sipariş durumu: ${live.orderProductStatus}.`
            : "";
        throw new Error(
            `ÇiçekSepeti kargo kodu (partialNumber) bulunamadı.${hint} ` +
                `CS entegrasyonu için sipariş «Yeni» iken kargo kodu alınır; kargoda ise siparişi yenileyin.`
        );
    }

    return buildMarketplaceA4LabelResponse(meta, "ciceksepeti");
}

module.exports = {
    fetchCiceksepetiLabel,
    fetchCiceksepetiOrderLive,
    requestCsCargoCode,
    mapCsOrderToLabelMeta,
};
