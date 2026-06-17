/**
 * claimsController.js â€” BirleÅŸik Ä°ade/Talep YÃ¶netimi
 *
 * Desteklenen pazaryerleri:
 *  - Trendyol     â†’ Claims API (listele / onayla / reddet + sebepler)
 *  - Hepsiburada  â†’ Talep API  (listele / onayla / reddet)
 *  - N11          â†’ SOAP ReturnService (listele / onayla / ertele / reddet + sebepler)
 *  - Ã‡iÃ§ekSepeti  â†’ GetCanceledOrders + cancelevaluation (listele / onayla / reddet)
 */

const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
const logger = require("../config/logger");

const trendyolClaims = require("../services/trendyolClaimsService");
const hepsiburadaClaims = require("../services/hepsiburadaClaimsService");
const n11Returns = require("../services/n11ReturnService");
const ciceksepetiService = require("../services/ciceksepeti/ciceksepetiService");

/** API mpKey → DB'deki canonical marketplaceName */
const MP_KEY_TO_CANONICAL = {
    trendyol: "Trendyol",
    hepsiburada: "Hepsiburada",
    n11: "N11",
    ciceksepeti: "ÇiçekSepeti",
};

const foldTr = (s) =>
    String(s || "")
        .toLowerCase()
        .trim()
        .replace(/ç/g, "c")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o");

const normalizeMpKey = (name) => {
    const n = foldTr(name);
    if (!n) return null;
    if (n.includes("trendyol")) return "trendyol";
    if (n.includes("hepsi")) return "hepsiburada";
    if (n === "n11") return "n11";
    if (n.includes("ciceksepeti") || n.includes("cicek")) return "ciceksepeti";
    return null;
};

const getCredentials = async (userId, mpKey) => {
    const canonical = MP_KEY_TO_CANONICAL[mpKey];
    if (!canonical) return null;
    const mp = await Marketplace.findOne({ userId, marketplaceName: canonical });
    if (!mp?.credentials) return null;
    return decryptCredentials(mp.credentials);
};

const normalizeCsClaim = (o) => ({
    marketplace: "ÇiçekSepeti",
    claimId: o.orderItemId || o.orderId,
    claimNumber: String(o.orderItemId || o.orderId || ""),
    orderNumber: String(o.orderId || o.orderItemId || ""),
    customerName: o.receiverName || o.senderName || "",
    status: o.orderItemStatusDescription || String(o.orderItemStatusId || ""),
    reason: o.cancellationReason || o.returnReason || "",
    claimDate: o.cancellationRequestDate || o.orderCreateDate || null,
    items: [
        {
            productName: o.name || o.productName || "",
            sku: o.stockCode || "",
            quantity: Number(o.quantity) || 1,
        },
    ],
    raw: o,
});

/**
 * GET /api/claims?marketplace=trendyol&status=&page=&size=&startDate=&endDate=&orderNumber=
 */
const listClaims = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const mpKey = normalizeMpKey(req.query.marketplace);
        if (!mpKey) {
            return res.status(400).json({
                success: false,
                message: "Geçerli bir marketplace parametresi gerekli (trendyol, hepsiburada, n11, ciceksepeti)",
            });
        }
        const creds = await getCredentials(userId, mpKey);
        if (!creds) {
            return res.status(404).json({ success: false, message: `${mpKey} entegrasyonu bulunamadı` });
        }

        const page = Math.max(0, parseInt(req.query.page, 10) || 0);
        const size = Math.min(100, parseInt(req.query.size, 10) || 50);
        const now = Date.now();
        const startDate = req.query.startDate ? Number(new Date(req.query.startDate)) : now - 30 * 24 * 60 * 60 * 1000;
        const endDate = req.query.endDate ? Number(new Date(req.query.endDate)) : now;

        let result;
        switch (mpKey) {
            case "trendyol":
                result = await trendyolClaims.fetchClaims(creds, {
                    claimItemStatus: req.query.status || undefined,
                    orderNumber: req.query.orderNumber || undefined,
                    startDate,
                    endDate,
                    page,
                    size,
                });
                break;
            case "hepsiburada":
                result = await hepsiburadaClaims.fetchClaims(creds, {
                    page,
                    size,
                    claimNumber: req.query.orderNumber || undefined,
                });
                break;
            case "n11":
                result = await n11Returns.listClaimReturns(creds.apiKey, creds.secretKey, {
                    status: req.query.status || "ALL",
                    orderNumber: req.query.orderNumber || undefined,
                    startDate,
                    endDate,
                    currentPage: page,
                });
                break;
            case "ciceksepeti": {
                const csResult = await ciceksepetiService.getCanceledOrders(creds, {
                    pageSize: size,
                    page,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                });
                result = {
                    success: csResult.success,
                    error: csResult.error,
                    claims: (csResult.orders || []).map(normalizeCsClaim),
                    totalElements: (csResult.orders || []).length,
                };
                break;
            }
        }

        return res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        logger.error("[Claims] Liste hatasÄ±:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/claims/reasons?marketplace=trendyol|n11&type=reject|pending
 */
const listReasons = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const mpKey = normalizeMpKey(req.query.marketplace);
        const type = String(req.query.type || "reject").toLowerCase();

        const creds = await getCredentials(userId, mpKey);
        if (!creds) {
            return res.status(404).json({ success: false, message: "Entegrasyon bulunamadı" });
        }

        let result;
        if (mpKey === "trendyol") {
            result = await trendyolClaims.getClaimIssueReasons(creds);
        } else if (mpKey === "n11") {
            result =
                type === "pending"
                    ? await n11Returns.getPendingReasons(creds.apiKey, creds.secretKey)
                    : await n11Returns.getDenyReasons(creds.apiKey, creds.secretKey);
        } else if (mpKey === "hepsiburada") {
            // HB red sebepleri serbest metin â€” bilinen enum listesi
            result = {
                success: true,
                reasons: [
                    { id: "ProductIsNotDamaged", name: "ÃœrÃ¼n hasarlÄ± deÄŸil" },
                    { id: "ProductIsUsed", name: "ÃœrÃ¼n kullanÄ±lmÄ±ÅŸ" },
                    { id: "ProductIsNotDefective", name: "ÃœrÃ¼n kusurlu deÄŸil" },
                    { id: "MissingPartOrAccessory", name: "Eksik parÃ§a/aksesuar" },
                    { id: "WrongProductReturned", name: "YanlÄ±ÅŸ Ã¼rÃ¼n iade edildi" },
                    { id: "PackageNotReceived", name: "Ä°ade paketi ulaÅŸmadÄ±" },
                ],
            };
        } else {
            return res.status(400).json({ success: false, message: "Bu pazaryeri iÃ§in sebep listesi yok" });
        }

        return res.json(result);
    } catch (error) {
        logger.error("[Claims] Sebep listesi hatasÄ±:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/claims/approve
 * Body: { marketplace, claimId, lineItemIds?: string[] }
 */
const approveClaim = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { marketplace, claimId, lineItemIds } = req.body || {};
        const mpKey = normalizeMpKey(marketplace);
        if (!mpKey || !claimId) {
            return res.status(400).json({ success: false, message: "marketplace ve claimId zorunlu" });
        }
        const creds = await getCredentials(userId, mpKey);
        if (!creds) {
            return res.status(404).json({ success: false, message: "Entegrasyon bulunamadı" });
        }

        let result;
        switch (mpKey) {
            case "trendyol":
                if (!Array.isArray(lineItemIds) || lineItemIds.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Trendyol için lineItemIds (claimLineItemIdList) zorunlu",
                    });
                }
                result = await trendyolClaims.approveClaimLineItems(creds, claimId, lineItemIds);
                break;
            case "hepsiburada":
                result = await hepsiburadaClaims.approveClaim(creds, claimId);
                break;
            case "n11":
                result = await n11Returns.approveClaimReturn(creds.apiKey, creds.secretKey, claimId);
                break;
            case "ciceksepeti":
                result = await ciceksepetiService.evaluateCancellation(creds, parseInt(claimId, 10), 1);
                break;
        }

        if (!result?.success) {
            return res.status(502).json(result);
        }

        const { cancelInvoiceAfterReturnApproval } = require("../services/returnInvoiceCancelService");
        const orderNumber = req.body?.orderNumber || result.orderNumber || "";
        const invoiceCancel = await cancelInvoiceAfterReturnApproval({
            userId,
            marketplace: mpKey,
            orderNumber,
            claimId,
        });

        return res.status(200).json({
            ...result,
            invoiceCancel,
            message: invoiceCancel.cancelled
                ? (result.message || "İade onaylandı") + " — ilgili e-Arşiv faturası iptal edildi."
                : (result.message || "İade onaylandı") + (invoiceCancel.message ? " (" + invoiceCancel.message + ")" : ""),
        });
    } catch (error) {
        logger.error("[Claims] Onay hatasÄ±:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/claims/reject
 * Body: { marketplace, claimId, reasonId, description, lineItemIds, ...n11 alanlarÄ± }
 * Trendyol dosya eki: multipart form-data â†’ req.file (opsiyonel)
 */
const rejectClaim = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const body = req.body || {};
        const { marketplace, claimId, reasonId, description, lineItemIds } = body;
        const mpKey = normalizeMpKey(marketplace);
        if (!mpKey || !claimId) {
            return res.status(400).json({ success: false, message: "marketplace ve claimId zorunlu" });
        }
        const creds = await getCredentials(userId, mpKey);
        if (!creds) {
            return res.status(404).json({ success: false, message: "Entegrasyon bulunamadı" });
        }

        let result;
        switch (mpKey) {
            case "trendyol": {
                const itemIds = Array.isArray(lineItemIds)
                    ? lineItemIds
                    : String(lineItemIds || "").split(",").map((s) => s.trim()).filter(Boolean);
                const file = req.file
                    ? { buffer: req.file.buffer, filename: req.file.originalname, contentType: req.file.mimetype }
                    : null;
                result = await trendyolClaims.createClaimIssue(creds, claimId, {
                    claimIssueReasonId: reasonId,
                    claimItemIdList: itemIds,
                    description,
                    file,
                });
                break;
            }
            case "hepsiburada":
                result = await hepsiburadaClaims.rejectClaim(creds, claimId, {
                    rejectionReason: reasonId || body.rejectionReason,
                    merchantStatement: description,
                    reportUrls: body.reportUrls,
                });
                break;
            case "n11":
                result = await n11Returns.denyClaimReturn(creds.apiKey, creds.secretKey, {
                    claimReturnId: claimId,
                    denyReasonId: reasonId,
                    denyReasonNote: description,
                    returnShipmentType: body.returnShipmentType,
                    shipmentCompanyId: body.shipmentCompanyId,
                    trackingNumber: body.trackingNumber,
                    deliveryReceiptNumber: body.deliveryReceiptNumber,
                    imageFirstUrl: body.imageFirstUrl,
                    imageSecondUrl: body.imageSecondUrl,
                    imageThirdUrl: body.imageThirdUrl,
                    videoUrl: body.videoUrl,
                });
                break;
            case "ciceksepeti":
                result = await ciceksepetiService.evaluateCancellation(creds, parseInt(claimId, 10), 3);
                break;
        }

        return res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        logger.error("[Claims] Red hatasÄ±:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/claims/pend â€” yalnÄ±zca N11
 * Body: { claimId, reasonId, dayCount, note }
 */
const pendClaim = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { claimId, reasonId, dayCount, note } = req.body || {};
        const creds = await getCredentials(userId, "n11");
        if (!creds) {
            return res.status(404).json({ success: false, message: "N11 entegrasyonu bulunamadÄ±" });
        }
        const result = await n11Returns.pendClaimReturn(creds.apiKey, creds.secretKey, {
            claimReturnId: claimId,
            pendingReasonId: reasonId,
            pendingDayCount: dayCount,
            pendingReasonNote: note,
        });
        return res.status(result.success ? 200 : 502).json(result);
    } catch (error) {
        logger.error("[Claims] Erteleme hatasÄ±:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    listClaims,
    listReasons,
    approveClaim,
    rejectClaim,
    pendClaim,
};

