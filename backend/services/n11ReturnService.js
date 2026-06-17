/**
 * n11ReturnService.js â€” N11 SoapAPI Ä°ade Talepleri Servisi (ReturnService)
 *
 * WSDL: https://api.n11.com/ws/ReturnService.wsdl
 *  - ClaimReturnList                 â†’ iade taleplerini listele
 *  - ClaimReturnDenyReasonTypes      â†’ ret sebepleri
 *  - ClaimReturnPendingReasonTypes   â†’ erteleme sebepleri
 *  - ClaimReturnApprove              â†’ iade onayla
 *  - ClaimReturnPending              â†’ iade ertele
 *  - ClaimReturnDeny                 â†’ iade reddet
 */

const axios = require("axios");
const logger = require("../config/logger");

const N11_RETURN_URL = "https://api.n11.com/ws/ReturnService";

const escapeXml = (v) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

const soapEnvelope = (inner) =>
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
    <soapenv:Header/>
    <soapenv:Body>
        ${inner}
    </soapenv:Body>
</soapenv:Envelope>`;

const postSoap = async (xml) => {
    const resp = await axios.post(N11_RETURN_URL, xml, {
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
        timeout: 30000,
    });
    return String(resp.data || "");
};

/** Basit XML tag deÄŸeri okuma (tek seviye) */
const tagValue = (xml, tag) => {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : "";
};

/** Tekrarlanan bloklarÄ± Ã§Ä±kar */
const tagBlocks = (xml, tag) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
    const out = [];
    let m;
    while ((m = re.exec(xml)) !== null) out.push(m[1]);
    return out;
};

const checkSoapResult = (responseXml, operation) => {
    const status = tagValue(responseXml, "status");
    if (status === "success") return { ok: true };
    const errorMessage =
        tagValue(responseXml, "errorMessage") ||
        tagValue(responseXml, "faultstring") ||
        `N11 ${operation} baÅŸarÄ±sÄ±z`;
    return { ok: false, error: errorMessage };
};

/** dd/mm/yyyy biÃ§imine Ã§evir */
const toN11Date = (input) => {
    if (!input) return "";
    const d = new Date(Number(input) || input);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
};

const normalizeN11Claim = (block) => ({
    marketplace: "N11",
    claimId: tagValue(block, "claimReturnId"),
    claimNumber: tagValue(block, "claimReturnId"),
    orderNumber: tagValue(block, "orderNumber"),
    status: tagValue(block, "status"),
    executer: tagValue(block, "executer"),
    sender: tagValue(block, "sender"),
    reason: tagValue(block, "returnReasonType"),
    reasonDescription: tagValue(block, "returnReasonDescription"),
    claimDate: tagValue(block, "requestDate"),
    approvedDate: tagValue(block, "approvedDate"),
    deniedDate: tagValue(block, "deniedDate"),
    customerName: tagValue(block, "buyerName"),
    customerEmail: tagValue(block, "buyerEmail"),
    customerPhone: tagValue(block, "buyerPhone"),
    cargoCompany: tagValue(block, "shipmentCompany"),
    cargoTrackingNumber: tagValue(block, "trackingNumber"),
    sellerCampaignNumber: tagValue(block, "sellerCampaignNumber"),
    items: [
        {
            productId: tagValue(block, "productId"),
            productName: tagValue(block, "productName"),
            attributes: tagValue(block, "attributesNames"),
            quantity: Number(tagValue(block, "quantity")) || 1,
            unitPrice: tagValue(block, "unitPrice"),
            finalPrice: tagValue(block, "finalPrice"),
        },
    ],
});

/**
 * Ä°ade taleplerini listele
 * @param {object} opts - { status, orderNumber, startDate(ms), endDate(ms), currentPage }
 *   status: REQUESTED | CANCELLED | DENIED | PENDING | PENDED | APPROVED | MANUAL_REFUND | ALL
 */
const listClaimReturns = async (apiKey, secretKey, opts = {}) => {
    const status = String(opts.status || "ALL").toUpperCase();
    const searchInfoType = opts.orderNumber ? "ORDERID" : "";
    const searchQuery = opts.orderNumber ? String(opts.orderNumber) : "";
    const startDate = toN11Date(opts.startDate);
    const endDate = toN11Date(opts.endDate);

    const xml = soapEnvelope(`<sch:ClaimReturnListRequest>
            <auth>
                <appKey>${escapeXml(apiKey)}</appKey>
                <appSecret>${escapeXml(secretKey)}</appSecret>
            </auth>
            <searchData>
                <status>${escapeXml(status)}</status>
                <executer></executer>
                <searchInfoType>${searchInfoType}</searchInfoType>
                <searchQuery>${escapeXml(searchQuery)}</searchQuery>
                <sender>ALL</sender>
                <period>
                    <startDate>${startDate}</startDate>
                    <endDate>${endDate}</endDate>
                </period>
            </searchData>
            <pagingData>
                <currentPage>${Math.max(0, parseInt(opts.currentPage, 10) || 0)}</currentPage>
            </pagingData>
        </sch:ClaimReturnListRequest>`);

    try {
        const responseXml = await postSoap(xml);
        const check = checkSoapResult(responseXml, "ClaimReturnList");
        if (!check.ok) return { success: false, error: check.error, claims: [] };

        const claims = tagBlocks(responseXml, "claimReturn").map(normalizeN11Claim);
        const paging = tagBlocks(responseXml, "pagingData")[0] || "";
        return {
            success: true,
            claims,
            totalElements: Number(tagValue(paging, "totalCount")) || claims.length,
            totalPages: Number(tagValue(paging, "pageCount")) || 1,
            page: Number(tagValue(paging, "currentPage")) || 0,
        };
    } catch (err) {
        logger.error(`[N11 Returns] Liste hatasÄ±: ${err.message}`);
        return { success: false, error: err.message, claims: [] };
    }
};

const fetchReasonTypes = async (apiKey, secretKey, requestTag, listTag) => {
    const xml = soapEnvelope(`<sch:${requestTag}>
            <auth>
                <appKey>${escapeXml(apiKey)}</appKey>
                <appSecret>${escapeXml(secretKey)}</appSecret>
            </auth>
        </sch:${requestTag}>`);
    try {
        const responseXml = await postSoap(xml);
        const check = checkSoapResult(responseXml, requestTag);
        if (!check.ok) return { success: false, error: check.error, reasons: [] };
        const reasons = tagBlocks(responseXml, listTag).map((b) => ({
            id: Number(tagValue(b, "id")),
            name: tagValue(b, "value"),
        }));
        return { success: true, reasons };
    } catch (err) {
        logger.error(`[N11 Returns] ${requestTag} hatasÄ±: ${err.message}`);
        return { success: false, error: err.message, reasons: [] };
    }
};

/** Ret sebepleri */
const getDenyReasons = (apiKey, secretKey) =>
    fetchReasonTypes(apiKey, secretKey, "ClaimReturnDenyReasonTypesRequest", "denyReasonTypeDataList");

/** Erteleme sebepleri */
const getPendingReasons = (apiKey, secretKey) =>
    fetchReasonTypes(apiKey, secretKey, "ClaimReturnPendingReasonTypesRequest", "pendingReasonTypeDataList");

/**
 * Ä°ade talebini onayla
 * Not: Resmi Ã¶rnek istekte alan adÄ± <claimCancelId> gÃ¶rÃ¼nÃ¼r; ÅŸema reddi durumunda
 * <claimReturnId> ile yeniden denenir.
 */
const approveClaimReturn = async (apiKey, secretKey, claimReturnId) => {
    const id = String(claimReturnId || "").trim();
    if (!id) return { success: false, error: "claimReturnId zorunlu" };

    for (const fieldTag of ["claimCancelId", "claimReturnId"]) {
        const xml = soapEnvelope(`<sch:ClaimReturnApproveRequest>
            <auth>
                <appKey>${escapeXml(apiKey)}</appKey>
                <appSecret>${escapeXml(secretKey)}</appSecret>
            </auth>
            <${fieldTag}>${escapeXml(id)}</${fieldTag}>
        </sch:ClaimReturnApproveRequest>`);
        try {
            const responseXml = await postSoap(xml);
            const check = checkSoapResult(responseXml, "ClaimReturnApprove");
            if (check.ok) {
                logger.info(`[N11 Returns] Ä°ade onaylandÄ±: ${id}`);
                return { success: true, claimReturnId: id };
            }
            // Alan adÄ± hatasÄ±ysa diÄŸer tag ile dene
            if (/claim(Return|Cancel)Id|unmarshal|element/i.test(check.error) && fieldTag === "claimCancelId") {
                continue;
            }
            return { success: false, error: check.error };
        } catch (err) {
            logger.error(`[N11 Returns] Onay hatasÄ± (${id}): ${err.message}`);
            return { success: false, error: err.message };
        }
    }
    return { success: false, error: "N11 iade onayÄ± baÅŸarÄ±sÄ±z" };
};

/**
 * Ä°ade talebini ertele
 */
const pendClaimReturn = async (apiKey, secretKey, { claimReturnId, pendingReasonId, pendingDayCount, pendingReasonNote }) => {
    const id = String(claimReturnId || "").trim();
    if (!id || !pendingReasonId) {
        return { success: false, error: "claimReturnId ve pendingReasonId zorunlu" };
    }
    const xml = soapEnvelope(`<sch:ClaimReturnPendingRequest>
            <auth>
                <appKey>${escapeXml(apiKey)}</appKey>
                <appSecret>${escapeXml(secretKey)}</appSecret>
            </auth>
            <claimReturnId>${escapeXml(id)}</claimReturnId>
            <pendingReasonId>${escapeXml(pendingReasonId)}</pendingReasonId>
            <pendingDayCount>${Math.max(1, parseInt(pendingDayCount, 10) || 1)}</pendingDayCount>
            <pendingReasonNote>${escapeXml(String(pendingReasonNote || "").slice(0, 500))}</pendingReasonNote>
        </sch:ClaimReturnPendingRequest>`);
    try {
        const responseXml = await postSoap(xml);
        const check = checkSoapResult(responseXml, "ClaimReturnPending");
        if (!check.ok) return { success: false, error: check.error };
        logger.info(`[N11 Returns] Ä°ade ertelendi: ${id}`);
        return { success: true, claimReturnId: id };
    } catch (err) {
        logger.error(`[N11 Returns] Erteleme hatasÄ± (${id}): ${err.message}`);
        return { success: false, error: err.message };
    }
};

/**
 * Ä°ade talebini reddet
 * @param {object} opts - {
 *   claimReturnId, denyReasonId, denyReasonNote,
 *   returnShipmentType ("CUSTOM"|"CAMPAIGN"|""), shipmentCompanyId, trackingNumber,
 *   deliveryReceiptNumber, imageFirstUrl, imageSecondUrl, imageThirdUrl, videoUrl
 * }
 */
const denyClaimReturn = async (apiKey, secretKey, opts = {}) => {
    const id = String(opts.claimReturnId || "").trim();
    if (!id || !opts.denyReasonId || !opts.denyReasonNote) {
        return { success: false, error: "claimReturnId, denyReasonId ve denyReasonNote zorunlu" };
    }
    const xml = soapEnvelope(`<sch:ClaimReturnDenyRequest>
            <auth>
                <appKey>${escapeXml(apiKey)}</appKey>
                <appSecret>${escapeXml(secretKey)}</appSecret>
            </auth>
            <claimReturnId>${escapeXml(id)}</claimReturnId>
            <denyReasonId>${escapeXml(opts.denyReasonId)}</denyReasonId>
            <denyReasonNote>${escapeXml(String(opts.denyReasonNote).slice(0, 500))}</denyReasonNote>
            <returnShipmentType>${escapeXml(opts.returnShipmentType || "")}</returnShipmentType>
            <shipmentCompanyId>${escapeXml(opts.shipmentCompanyId || "")}</shipmentCompanyId>
            <trackingNumber>${escapeXml(opts.trackingNumber || "")}</trackingNumber>
            <deliveryReceiptNumber>${escapeXml(opts.deliveryReceiptNumber || "")}</deliveryReceiptNumber>
            <imageFirstUrl>${escapeXml(opts.imageFirstUrl || "")}</imageFirstUrl>
            <imageSecondUrl>${escapeXml(opts.imageSecondUrl || "")}</imageSecondUrl>
            <imageThirdUrl>${escapeXml(opts.imageThirdUrl || "")}</imageThirdUrl>
            <videoUrl>${escapeXml(opts.videoUrl || "")}</videoUrl>
        </sch:ClaimReturnDenyRequest>`);
    try {
        const responseXml = await postSoap(xml);
        const check = checkSoapResult(responseXml, "ClaimReturnDeny");
        if (!check.ok) return { success: false, error: check.error };
        logger.info(`[N11 Returns] Ä°ade reddedildi: ${id}`);
        return { success: true, claimReturnId: id };
    } catch (err) {
        logger.error(`[N11 Returns] Red hatasÄ± (${id}): ${err.message}`);
        return { success: false, error: err.message };
    }
};

module.exports = {
    listClaimReturns,
    getDenyReasons,
    getPendingReasons,
    approveClaimReturn,
    pendClaimReturn,
    denyClaimReturn,
};

