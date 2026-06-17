/**
 * hepsiburadaClaimsService.js â€” Hepsiburada Talep (Ä°ade/DeÄŸiÅŸim) API
 *
 * Resmi dokÃ¼man: https://developers.hepsiburada.com (Talep Entegrasyonu)
 *  - Liste: OMS  GET /claims/merchantid/{merchantId}   (fallback: Radium GET /api/claims/list)
 *  - Red:   OMS  POST /claims/number/{claimNumber}/reject
 *  - Onay:  OMS  POST /claims/number/{claimNumber}/approve (bazÄ± hesaplarda /accept)
 *
 * Auth: HTTP Basic (merchantId:secretKey) + User-Agent (developer username)
 */

const axios = require("axios");
const logger = require("../config/logger");
const { normalizeCredentials } = require("./hepsiburadaService");

const omsBase = (useSit) =>
    useSit ? "https://oms-external-sit.hepsiburada.com" : "https://oms-external.hepsiburada.com";
const radiumBase = () => process.env.HB_RADIUM_BASE_URL || "https://radium.hepsiburada.com";

const hbHeaders = (hb) => ({
    Authorization:
        "Basic " + Buffer.from(`${hb.merchantId}:${hb.secretKey}`, "utf-8").toString("base64"),
    "User-Agent": hb.userAgent || "LysiaETIC",
    Accept: "application/json",
    "Content-Type": "application/json",
});

const extractHbError = (err) => {
    const data = err.response?.data;
    if (typeof data === "string" && data.length < 300) return data;
    if (data?.message) return data.message;
    if (data?.title) return data.title;
    if (Array.isArray(data?.errors)) return data.errors.map((e) => e.message || e).join("; ");
    return err.message || "Hepsiburada Talep API hatasÄ±";
};

const normalizeHbClaim = (c) => ({
    marketplace: "Hepsiburada",
    claimId: c.claimNumber || c.ClaimNumber || c.id || "",
    claimNumber: String(c.claimNumber || c.ClaimNumber || c.id || ""),
    orderNumber: String(c.orderNumber || c.OrderNumber || ""),
    customerName: c.customerName || c.CustomerName || "",
    status: c.status || c.Status || c.claimStatus || "",
    type: c.type || c.Type || "",
    reason: c.reason || c.Reason || "",
    claimDate: c.createdDate || c.CreatedDate || c.createdAt || null,
    items: (c.items || c.Items || []).map((it) => ({
        sku: it.sku || it.Sku || "",
        productName: it.productName || it.ProductName || "",
        quantity: Number(it.quantity || it.Quantity) || 1,
    })),
    raw: c,
});

/**
 * Talep listesi â€” Ã¶nce OMS, baÅŸarÄ±sÄ±zsa Radium
 * @param {object} opts - { page, size, claimNumber }
 */
const fetchClaims = async (credentials, opts = {}) => {
    const hb = normalizeCredentials(credentials);
    if (!hb.merchantId || !hb.secretKey) {
        return { success: false, error: "Hepsiburada merchantId/secretKey eksik", claims: [] };
    }
    const headers = hbHeaders(hb);
    const page = Math.max(0, parseInt(opts.page, 10) || 0);
    const size = Math.min(100, parseInt(opts.size, 10) || 50);

    // 1) OMS claims listesi
    try {
        const url = `${omsBase(hb.useSit)}/claims/merchantid/${hb.merchantId}`;
        const resp = await axios.get(url, {
            headers,
            params: { offset: page * size, limit: size },
            timeout: 25000,
        });
        const list = Array.isArray(resp.data)
            ? resp.data
            : resp.data?.items || resp.data?.claims || resp.data?.content || [];
        return {
            success: true,
            claims: list.map(normalizeHbClaim),
            totalElements: resp.data?.totalCount ?? list.length,
            source: "oms",
        };
    } catch (omsErr) {
        logger.warn(`[HB Claims] OMS listesi baÅŸarÄ±sÄ±z (${omsErr.response?.status || omsErr.message}) â€” Radium deneniyor`);
    }

    // 2) Radium fallback
    try {
        const params = { page: page + 1, size };
        if (opts.claimNumber) params.claimNumber = opts.claimNumber;
        const resp = await axios.get(`${radiumBase()}/api/claims/list`, {
            headers,
            params,
            timeout: 25000,
        });
        const list = resp.data?.data || resp.data?.claims || resp.data?.items ||
            (Array.isArray(resp.data) ? resp.data : []);
        return {
            success: true,
            claims: list.map(normalizeHbClaim),
            totalElements: resp.data?.totalCount ?? list.length,
            source: "radium",
        };
    } catch (err) {
        const msg = extractHbError(err);
        logger.error(`[HB Claims] Liste hatasÄ±: ${msg}`);
        return { success: false, error: msg, claims: [] };
    }
};

/**
 * Talep onaylama â€” POST /claims/number/{claimNumber}/approve (fallback /accept)
 */
const approveClaim = async (credentials, claimNumber) => {
    const hb = normalizeCredentials(credentials);
    const cn = String(claimNumber || "").trim();
    if (!cn) return { success: false, error: "claimNumber zorunlu" };
    const headers = hbHeaders(hb);

    for (const action of ["approve", "accept"]) {
        try {
            await axios.post(
                `${omsBase(hb.useSit)}/claims/number/${cn}/${action}`,
                {},
                { headers, timeout: 25000 }
            );
            logger.info(`[HB Claims] Talep onaylandÄ±: ${cn} (${action})`);
            return { success: true, claimNumber: cn };
        } catch (err) {
            if (err.response?.status === 404 && action === "approve") continue;
            const msg = extractHbError(err);
            logger.error(`[HB Claims] Onay hatasÄ± (${cn}): ${msg}`);
            return { success: false, error: msg };
        }
    }
    return { success: false, error: "Hepsiburada onay endpoint'i bulunamadÄ± (approve/accept)" };
};

/**
 * Talep reddetme â€” POST /claims/number/{claimNumber}/reject
 * @param {object} opts - { rejectionReason, merchantStatement, reportUrls: string[] }
 */
const rejectClaim = async (credentials, claimNumber, opts = {}) => {
    const hb = normalizeCredentials(credentials);
    const cn = String(claimNumber || "").trim();
    if (!cn) return { success: false, error: "claimNumber zorunlu" };
    if (!opts.rejectionReason) {
        return { success: false, error: "rejectionReason (red sebebi) zorunlu" };
    }

    try {
        await axios.post(
            `${omsBase(hb.useSit)}/claims/number/${cn}/reject`,
            {
                ClaimRejectionReason: String(opts.rejectionReason),
                MerchantStatement: String(opts.merchantStatement || "").slice(0, 1000),
                Reports: [],
                UploadedReportsUrls: Array.isArray(opts.reportUrls) ? opts.reportUrls : [],
            },
            { headers: hbHeaders(hb), timeout: 25000 }
        );
        logger.info(`[HB Claims] Talep reddedildi: ${cn}`);
        return { success: true, claimNumber: cn };
    } catch (err) {
        const msg = extractHbError(err);
        logger.error(`[HB Claims] Red hatasÄ± (${cn}): ${msg}`);
        return { success: false, error: msg };
    }
};

module.exports = {
    fetchClaims,
    approveClaim,
    rejectClaim,
};

