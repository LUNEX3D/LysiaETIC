/**
 * trendyolClaimsService.js — Trendyol İade (Claims) API
 *
 * Resmi doküman: https://developers.trendyol.com/docs/category/iade-entegrasyonu
 *  - GET  /integration/order/sellers/{sellerId}/claims               → iade listesi
 *  - PUT  /integration/order/sellers/{sellerId}/claims/{claimId}/items/approve → onay
 *  - POST /integration/order/sellers/{sellerId}/claims/{claimId}/issue        → red (itiraz)
 *  - GET  /integration/order/claim-issue-reasons                     → red sebepleri
 */

const axios = require("axios");
const FormData = require("form-data");
const logger = require("../config/logger");

const TY_BASE = "https://apigw.trendyol.com/integration";

const getTrendyolAuth = (credentials) => {
    const { sellerId, token: apiToken, apiKey, apiSecret, supplierId } = credentials || {};
    const sid = sellerId || supplierId;
    if (!sid) throw new Error("Trendyol sellerId eksik");
    let authHeader;
    if (apiToken) {
        authHeader = apiToken.startsWith("Basic ") ? apiToken : "Basic " + apiToken;
    } else if (apiKey && apiSecret) {
        authHeader = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    }
    if (!authHeader) throw new Error("Trendyol API anahtarları eksik");
    return { sellerId: sid, authHeader };
};

const tyHeaders = (auth) => ({
    Authorization: auth.authHeader,
    "Content-Type": "application/json",
    "User-Agent": `${auth.sellerId} - SelfIntegration`,
    storeFrontCode: "TR",
});

const extractTyError = (err) => {
    const data = err.response?.data;
    if (data?.errors?.length) {
        return data.errors.map((e) => e.message || e.key || JSON.stringify(e)).join("; ");
    }
    if (typeof data?.message === "string") return data.message;
    if (typeof data === "string" && data.length < 300) return data;
    return err.message || "Trendyol Claims API hatası";
};

/** Tekil claim kaydını arayüz için normalize et */
const normalizeClaim = (claim) => {
    const items = [];
    for (const grp of claim.items || []) {
        const orderLine = grp.orderLine || {};
        for (const ci of grp.claimItems || []) {
            items.push({
                claimLineItemId: ci.id,
                productName: orderLine.productName || "",
                barcode: orderLine.barcode || "",
                merchantSku: orderLine.merchantSku || "",
                price: orderLine.price ?? null,
                status: ci.claimItemStatus?.name || "",
                customerReason: ci.customerClaimItemReason?.name || "",
                trendyolReason: ci.trendyolClaimItemReason?.name || "",
                note: ci.note || "",
                customerNote: ci.customerNote || "",
                resolved: !!ci.resolved,
            });
        }
    }
    return {
        marketplace: "Trendyol",
        claimId: claim.id,
        claimNumber: String(claim.id || ""),
        orderNumber: claim.orderNumber || "",
        orderShipmentPackageId: claim.orderShipmentPackageId || null,
        customerName: [claim.customerFirstName, claim.customerLastName].filter(Boolean).join(" "),
        cargoTrackingNumber: claim.cargoTrackingNumber || "",
        cargoProvider: claim.cargoProviderName || "",
        claimDate: claim.claimDate ? new Date(claim.claimDate).toISOString() : null,
        status: items[0]?.status || "",
        items,
        raw: claim,
    };
};

/**
 * İade taleplerini listele
 * @param {object} opts - { claimItemStatus, startDate(ms), endDate(ms), orderNumber, claimIds, page, size }
 */
const fetchClaims = async (credentials, opts = {}) => {
    const auth = getTrendyolAuth(credentials);
    const params = {
        page: opts.page ?? 0,
        size: Math.min(Number(opts.size) || 50, 200),
    };
    if (opts.claimIds) params.claimIds = opts.claimIds;
    if (opts.claimItemStatus) params.claimItemStatus = opts.claimItemStatus;
    if (opts.orderNumber) params.orderNumber = opts.orderNumber;
    if (opts.startDate) params.startDate = Number(opts.startDate);
    if (opts.endDate) params.endDate = Number(opts.endDate);

    try {
        const resp = await axios.get(`${TY_BASE}/order/sellers/${auth.sellerId}/claims`, {
            headers: tyHeaders(auth),
            params,
            timeout: 30000,
        });
        const content = resp.data?.content || [];
        return {
            success: true,
            claims: content.map(normalizeClaim),
            totalElements: resp.data?.totalElements ?? content.length,
            totalPages: resp.data?.totalPages ?? 1,
            page: params.page,
        };
    } catch (err) {
        const msg = extractTyError(err);
        logger.error(`[TY Claims] Liste hatası: ${msg}`);
        return { success: false, error: msg, claims: [] };
    }
};

/** Red (itiraz) sebepleri */
const getClaimIssueReasons = async (credentials) => {
    const auth = getTrendyolAuth(credentials);
    try {
        const resp = await axios.get(`${TY_BASE}/order/claim-issue-reasons`, {
            headers: tyHeaders(auth),
            timeout: 20000,
        });
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.content || [];
        return { success: true, reasons: list.map((r) => ({ id: r.id, name: r.name })) };
    } catch (err) {
        const msg = extractTyError(err);
        logger.error(`[TY Claims] Sebep listesi hatası: ${msg}`);
        return { success: false, error: msg, reasons: [] };
    }
};

/**
 * İade onayı — yalnızca WaitingInAction statüsündeki kalemler
 * @param {string} claimId
 * @param {string[]} claimLineItemIdList
 */
const approveClaimLineItems = async (credentials, claimId, claimLineItemIdList) => {
    const auth = getTrendyolAuth(credentials);
    if (!claimId || !Array.isArray(claimLineItemIdList) || claimLineItemIdList.length === 0) {
        return { success: false, error: "claimId ve claimLineItemIdList zorunlu" };
    }
    try {
        await axios.put(
            `${TY_BASE}/order/sellers/${auth.sellerId}/claims/${claimId}/items/approve`,
            { claimLineItemIdList, params: {} },
            { headers: tyHeaders(auth), timeout: 30000 }
        );
        logger.info(`[TY Claims] İade onaylandı: ${claimId} (${claimLineItemIdList.length} kalem)`);
        return { success: true, claimId };
    } catch (err) {
        const msg = extractTyError(err);
        logger.error(`[TY Claims] Onay hatası (${claimId}): ${msg}`);
        return { success: false, error: msg };
    }
};

/** Dosya eki gerektirmeyen red sebepleri (resmi doküman) */
const TY_NO_ATTACHMENT_REASONS = new Set([1651, 451]);

/**
 * İade reddi (itiraz oluşturma)
 * @param {object} opts - {
 *   claimIssueReasonId, claimItemIdList: string[], description,
 *   file: { buffer, filename, contentType }  // 1651 ve 451 dışındaki sebeplerde zorunlu
 * }
 */
const createClaimIssue = async (credentials, claimId, opts = {}) => {
    const auth = getTrendyolAuth(credentials);
    const reasonId = parseInt(opts.claimIssueReasonId, 10);
    const itemIds = Array.isArray(opts.claimItemIdList) ? opts.claimItemIdList : [];

    if (!claimId || !reasonId || itemIds.length === 0) {
        return { success: false, error: "claimId, claimIssueReasonId ve claimItemIdList zorunlu" };
    }
    const needsFile = !TY_NO_ATTACHMENT_REASONS.has(reasonId);
    if (needsFile && !opts.file?.buffer) {
        return {
            success: false,
            error:
                "Bu red sebebi için kanıt dosyası (pdf/jpeg) zorunlu. " +
                "Yalnızca 'İade paketi elime ulaşmadı' (1651) ve 'Diğer/analiz' (451) sebeplerinde dosya gerekmez.",
        };
    }

    const params = new URLSearchParams();
    params.set("claimIssueReasonId", String(reasonId));
    params.set("claimItemIdList", itemIds.join(","));
    if (opts.description) params.set("description", String(opts.description).slice(0, 500));

    const url = `${TY_BASE}/order/sellers/${auth.sellerId}/claims/${claimId}/issue?${params.toString()}`;

    try {
        const form = new FormData();
        if (opts.file?.buffer) {
            form.append("files", opts.file.buffer, {
                filename: opts.file.filename || "evidence.jpg",
                contentType: opts.file.contentType || "image/jpeg",
            });
        }
        await axios.post(url, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: auth.authHeader,
                "User-Agent": `${auth.sellerId} - SelfIntegration`,
                storeFrontCode: "TR",
            },
            timeout: 45000,
            maxBodyLength: 25 * 1024 * 1024,
        });
        logger.info(`[TY Claims] İade itirazı oluşturuldu: ${claimId} (sebep ${reasonId})`);
        return { success: true, claimId };
    } catch (err) {
        const msg = extractTyError(err);
        logger.error(`[TY Claims] Red/itiraz hatası (${claimId}): ${msg}`);
        return { success: false, error: msg };
    }
};

module.exports = {
    fetchClaims,
    getClaimIssueReasons,
    approveClaimLineItems,
    createClaimIssue,
    getTrendyolAuth,
};
