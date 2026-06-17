/**
 * Auto Invoice Controller — LysiaETIC
 *
 * Otomatik fatura kesme ayarları CRUD + manuel tetikleme + fatura listesi
 */

const mongoose = require("mongoose");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const User = require("../models/User");
const { processManualBatchInvoice, processAllUninvoiced, normalizeMarketplaceName, MARKETPLACE_STATUS_MAP, releaseStalePendingOrders, buildUninvoicedOrderFilter, buildUninvoicedListFilter, getUninvoicedStartDate, getUninvoicedListStartDate } = require("../services/autoInvoiceService");
const qnbService = require("../services/qnbEInvoiceService");
const sovosService = require("../services/sovosEInvoiceService");
const sovosEArchiveService = require("../services/sovosEArchiveService");
const sovosEDespatchService = require("../services/sovosEDespatchService");
const { isValidGbIdentifier } = require("../utils/sovosApiGuard");
const { isSovosInactiveModuleError } = require("../utils/sovosSoapFault");
const { decompressZipEntry } = require("../utils/sovosUblZip");
const { sniffContentType } = require("../utils/sovosBinaryData");
const { mapSovosEArchiveStatus } = require("../constants/sovosEArchiveStatuses");
const { resolveInvoiceTotals, extractTotalsFromUblXml } = require("../utils/invoiceTotals");
const logger = require("../config/logger");

const PROVIDER_ID_MAP = {
    "qnb-esolutions": "qnb",
    qnb: "qnb",
    sovos: "sovos",
    trendyol: "trendyol",
    "trendyol-efaturam": "trendyol",
    parasut: "parasut",
    odeal: "odeal",
};

const clearQnbCredentialFields = () => ({
    "qnbCredentials.username": "",
    "qnbCredentials.password": "",
    "qnbCredentials.earsivUsername": "",
    "qnbCredentials.earsivPassword": "",
    "qnbCredentials.efaturaUsername": "",
    "qnbCredentials.efaturaPassword": "",
});

const clearSovosCredentialFields = () => ({
    "sovosCredentials.username": "",
    "sovosCredentials.password": "",
    "sovosCredentials.vknTckn": "",
    "sovosCredentials.senderIdentifier": "",
    "sovosCredentials.receiverIdentifier": "",
    "sovosCredentials.branch": "default",
});

const clearUserQnbFields = () => ({
    "companyInfo.qnb.username": "",
    "companyInfo.qnb.password": "",
    "companyInfo.qnb.earsivUsername": "",
    "companyInfo.qnb.earsivPassword": "",
    "companyInfo.qnb.efaturaUsername": "",
    "companyInfo.qnb.efaturaPassword": "",
});

/**
 * QNB HTML'ine <base> tag ekle — blob: URL'den açıldığında relative kaynaklar çözülsün
 * @param {string} html - QNB'den gelen HTML string
 * @param {string} env - "test" veya "production"
 * @returns {string} <base> tag eklenmiş HTML
 */
const injectBaseTag = (html, env) => {
    if (!html || typeof html !== "string" || html.includes("<base")) return html;
    const baseUrl = env === "production"
        ? "https://earsiv.qnbesolutions.com.tr/"
        : "https://earsivtest.qnbesolutions.com.tr/";
    return html.replace(/(<head[^>]*>)/i, '$1<base href="' + baseUrl + '" />');
};

// ═══════════════════════════════════════════════════════════════════════════
//  YARDIMCI: User.companyInfo ↔ AutoInvoiceConfig senkronizasyonu
//  Firma bilgileri ve QNB credential'ları User.companyInfo'da TEK KAYNAK
//  olarak tutulur. AutoInvoiceConfig kaydedilirken User'a da yazılır,
//  config okunurken User'dan da doldurulur.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AutoInvoiceConfig'deki supplier + qnbCredentials → User.companyInfo'ya yaz
 */
const syncConfigToUser = async (userId, supplier, qnbCredentials) => {
    try {
        const update = {};
        if (supplier) {
            if (supplier.vkn) update["companyInfo.vkn"] = supplier.vkn;
            if (supplier.name) update["companyInfo.companyName"] = supplier.name;
            if (supplier.taxOffice) update["companyInfo.taxOffice"] = supplier.taxOffice;
            if (supplier.firstName) update["companyInfo.firstName"] = supplier.firstName;
            if (supplier.lastName) update["companyInfo.lastName"] = supplier.lastName;
            if (supplier.street) update["companyInfo.street"] = supplier.street;
            if (supplier.district) update["companyInfo.district"] = supplier.district;
            if (supplier.city) update["companyInfo.city"] = supplier.city;
            if (supplier.country) update["companyInfo.country"] = supplier.country;
            if (supplier.phone) update["companyInfo.phone"] = supplier.phone;
            if (supplier.email) update["companyInfo.email"] = supplier.email;
            // Eski profile alanlarını da güncelle (geriye uyumluluk)
            if (supplier.name) update["profile.company"] = supplier.name;
            if (supplier.vkn) update["profile.taxInfo.taxNumber"] = supplier.vkn;
            if (supplier.taxOffice) update["profile.taxInfo.taxOffice"] = supplier.taxOffice;
        }
        if (qnbCredentials) {
            if (qnbCredentials.earsivUsername) update["companyInfo.qnb.earsivUsername"] = qnbCredentials.earsivUsername;
            if (qnbCredentials.earsivPassword) update["companyInfo.qnb.earsivPassword"] = qnbCredentials.earsivPassword;
            if (qnbCredentials.efaturaUsername) update["companyInfo.qnb.efaturaUsername"] = qnbCredentials.efaturaUsername;
            if (qnbCredentials.efaturaPassword) update["companyInfo.qnb.efaturaPassword"] = qnbCredentials.efaturaPassword;
            if (qnbCredentials.env) update["companyInfo.qnb.env"] = qnbCredentials.env;
        }
        if (Object.keys(update).length > 0) {
            await User.updateOne({ _id: userId }, { $set: update });
            logger.info("[AutoInvoice] User.companyInfo senkronize edildi — userId=" + userId);
        }
    } catch (err) {
        logger.warn("[AutoInvoice] User.companyInfo senkronizasyon hatası: " + err.message);
    }
};

/**
 * User.companyInfo'dan AutoInvoiceConfig'e eksik alanları doldur
 * Kullanıcı daha önce profil sayfasından firma bilgisi girdiyse,
 * fatura ayarlarına ilk girişte otomatik dolar.
 */
const fillConfigFromUser = async (userId, config) => {
    try {
        const user = await User.findById(userId).select("companyInfo profile").lean();
        if (!user) return;

        const ci = user.companyInfo || {};
        const profile = user.profile || {};

        // supplier alanlarını doldur (boş olanları)
        if (!config.supplier.vkn && ci.vkn) config.supplier.vkn = ci.vkn;
        if (!config.supplier.name && ci.companyName) config.supplier.name = ci.companyName;
        if (!config.supplier.taxOffice && ci.taxOffice) config.supplier.taxOffice = ci.taxOffice;
        if (!config.supplier.firstName && ci.firstName) config.supplier.firstName = ci.firstName;
        if (!config.supplier.lastName && ci.lastName) config.supplier.lastName = ci.lastName;
        if (!config.supplier.street && ci.street) config.supplier.street = ci.street;
        if (!config.supplier.district && ci.district) config.supplier.district = ci.district;
        if (!config.supplier.city && ci.city) config.supplier.city = ci.city;
        if (!config.supplier.country && ci.country) config.supplier.country = ci.country;
        if (!config.supplier.phone && (ci.phone || profile.phone)) config.supplier.phone = ci.phone || profile.phone;
        if (!config.supplier.email && ci.email) config.supplier.email = ci.email;

        // Eski profile.taxInfo'dan da doldur (geriye uyumluluk)
        if (!config.supplier.vkn && profile.taxInfo?.taxNumber) config.supplier.vkn = profile.taxInfo.taxNumber;
        if (!config.supplier.taxOffice && profile.taxInfo?.taxOffice) config.supplier.taxOffice = profile.taxInfo.taxOffice;
        if (!config.supplier.name && profile.company) config.supplier.name = profile.company;

        // qnbCredentials doldur (boş olanları)
        const qnb = ci.qnb || {};
        if (!config.qnbCredentials.earsivUsername && qnb.earsivUsername) config.qnbCredentials.earsivUsername = qnb.earsivUsername;
        if (!config.qnbCredentials.earsivPassword && qnb.earsivPassword) config.qnbCredentials.earsivPassword = qnb.earsivPassword;
        if (!config.qnbCredentials.efaturaUsername && qnb.efaturaUsername) config.qnbCredentials.efaturaUsername = qnb.efaturaUsername;
        if (!config.qnbCredentials.efaturaPassword && qnb.efaturaPassword) config.qnbCredentials.efaturaPassword = qnb.efaturaPassword;
        if (qnb.env) config.qnbCredentials.env = qnb.env;

        const sovos = config.sovosCredentials || {};
        if (!sovos.username && config.provider === "sovos") {
            /* billing panelinden bağlandıysa config'de zaten var */
        }
        if (!config.supplier.vkn && sovos.vknTckn) config.supplier.vkn = sovos.vknTckn;
    } catch (err) {
        logger.warn("[AutoInvoice] fillConfigFromUser hatası: " + err.message);
    }
};

/**
 * e-Arşiv credential çözümleme — tüm endpoint'ler için ortak
 * Öncelik: config.qnbCredentials > User.companyInfo.qnb
 * Kullanıcı adı QNB'den verildiği formatta olduğu gibi kullanılır
 *
 * @returns {{ earsivUsername, earsivPassword, env, vkn, credSource } | null}
 */
const resolveEarsivCredentials = async (userId, configOverride) => {
    const config = configOverride || await AutoInvoiceConfig.findOne({ userId }).lean();
    const configCreds = config?.qnbCredentials || {};
    const env = configCreds.env || "test";

    let userQnb = {};
    try {
        const user = await User.findById(userId).select("companyInfo.qnb").lean();
        userQnb = user?.companyInfo?.qnb || {};
    } catch (e) { /* ignore */ }

    let earsivUsername = "";
    let earsivPassword = "";
    let credSource = "";

    if (configCreds.earsivUsername && configCreds.earsivPassword) {
        earsivUsername = configCreds.earsivUsername;
        earsivPassword = configCreds.earsivPassword;
        credSource = "AutoInvoiceConfig";
    } else if (userQnb.earsivUsername && userQnb.earsivPassword) {
        earsivUsername = userQnb.earsivUsername;
        earsivPassword = userQnb.earsivPassword;
        credSource = "User.companyInfo.qnb";
    }

    if (!earsivUsername || !earsivPassword) {
        logger.warn("[AutoInvoice] e-Arşiv credentials eksik — userId=" + userId +
            " config.earsivUsername=" + (configCreds.earsivUsername ? "'" + configCreds.earsivUsername + "'" : "(boş)") +
            " user.earsivUsername=" + (userQnb.earsivUsername ? "'" + userQnb.earsivUsername + "'" : "(boş)"));
        return null;
    }

    const vkn = config?.supplier?.vkn || earsivUsername.split(".")[0] || "";

    logger.info("[AutoInvoice] e-Arşiv credentials çözümlendi — kaynak: " + credSource +
        " user=" + earsivUsername + " vkn=" + vkn + " env=" + env);

    return { earsivUsername, earsivPassword, env, vkn, credSource };
};

const findInvoiceForUser = async (userId, invoiceId) => {
    if (!invoiceId) return null;
    const id = String(invoiceId);
    if (mongoose.Types.ObjectId.isValid(id)) {
        const byId = await Invoice.findOne({ _id: id, userId }).lean();
        if (byId) return byId;
    }
    return Invoice.findOne({
        userId,
        $or: [{ uuid: id }, { invoiceNumber: id }],
    }).lean();
};

const resolveSovosCredentials = async (userId, configOverride) => {
    const config = configOverride || await AutoInvoiceConfig.findOne({ userId }).lean();
    const sc = config?.sovosCredentials || {};
    if (!sc.username || !sc.password || !sc.vknTckn) {
        return null;
    }
    return {
        ...sc,
        env: sc.env || "test",
        vkn: config?.supplier?.vkn || sc.vknTckn,
    };
};

const persistSovosCapability = async (userId, sessionId, capabilityKey, value) => {
    if (!userId || !capabilityKey) return;
    const patch = { [`sovosCredentials.capabilities.${capabilityKey}`]: value };
    await AutoInvoiceConfig.updateOne({ userId }, { $set: patch }).catch(() => {});
    if (sessionId) {
        sovosService.patchSessionCapabilities(sessionId, { [capabilityKey]: value });
    }
};

const resolveSovosInvoiceDirection = (invoice, creds) => {
    if (invoice.direction === "incoming") {
        return { type: "INBOUND", identifierKey: "receiver" };
    }
    if (invoice.direction === "outgoing") {
        return { type: "OUTBOUND", identifierKey: "sender" };
    }
    const ourVkn = String(creds.vknTckn || invoice.customer?.vkn || "").replace(/\D/g, "");
    const supplierVkn = String(invoice.supplier?.vkn || "").replace(/\D/g, "");
    if (supplierVkn && ourVkn && supplierVkn !== ourVkn) {
        return { type: "INBOUND", identifierKey: "receiver" };
    }
    return { type: "OUTBOUND", identifierKey: "sender" };
};

const fileDisposition = (baseName, ext, inline = true) => {
    const mode = inline ? "inline" : "attachment";
    const safe = String(baseName || "fatura").replace(/[^\w.-]+/g, "_");
    return `${mode}; filename="${ext ? safe + "." + ext : safe}"`;
};

const resolveDocBuffer = (data) => {
    if (!data) return null;
    if (data.buffer && Buffer.isBuffer(data.buffer)) return data.buffer;
    if (data.base64) return Buffer.from(data.base64, "base64");
    return null;
};

const sendDocumentBuffer = (res, invoice, data, inline = true) => {
    const buf = resolveDocBuffer(data);
    if (!buf || !buf.length) return false;

    const contentType = sniffContentType(buf, data.contentType || "application/octet-stream");
    let ext = "bin";
    if (contentType.includes("pdf")) ext = "pdf";
    else if (contentType.includes("html")) ext = "html";
    else if (contentType.includes("xml")) ext = "xml";
    else if (contentType.includes("zip")) ext = "zip";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", fileDisposition(invoice.invoiceNumber || invoice.uuid, ext, inline));
    if (contentType.includes("html")) {
        res.send(buf.toString("utf8"));
    } else {
        res.send(buf);
    }
    return true;
};

const parseSovosInvResponseStatus = (raw) => {
    const text = JSON.stringify(raw || {}).toUpperCase();
    if (text.includes("KABUL") || text.includes("ACCEPT")) return { status: "accepted", detail: "Kabul edildi" };
    if (text.includes("\"RED\"") || text.includes("REJECT")) return { status: "rejected", detail: "Reddedildi" };
    return { status: "sent", detail: "Yanıt bekleniyor" };
};

const streamSovosView = async (sessionId, invoice, direction, format) => {
    return sovosService.getInvoiceView({
        sessionId,
        uuid: invoice.uuid,
        custInvId: invoice.custInvId || invoice.orderNumber || "",
        type: direction.type,
        viewFormat: format,
        identifierKey: direction.identifierKey,
    });
};

const isSovosEArchiveProfile = (profileId) => {
    const profileUpper = String(profileId || "").toUpperCase();
    if (profileUpper.includes("EARSIV")) return true;
    if (profileUpper.includes("TICARI") || profileUpper.includes("TEMEL") || profileUpper.includes("KAMU")) return false;
    if (profileUpper.includes("IHRACAT") || profileUpper.includes("YOLCUBERABER") || profileUpper.includes("IRSALIYE") || profileUpper.includes("İRSALİYE")) {
        return false;
    }
    // Profil kaydı yoksa Sovos e-Arşiv varsay (yalnızca e-Arşiv kullanan hesaplar)
    return !profileUpper;
};

const streamSovosUblZip = async (res, sessionId, invoice, direction, inline = true, { requirePdf = false } = {}) => {
    const ublResult = await sovosService.getUBL({
        sessionId,
        uuid: invoice.uuid,
        docType: "INVOICE",
        type: direction.type,
        identifierKey: direction.identifierKey,
        parameters: ["zip"],
    });
    if (!ublResult.success || !ublResult.data?.zipEntries?.length) {
        return false;
    }
    const zipBuf = Buffer.from(ublResult.data.zipEntries[0].base64, "base64");
    const baseName = invoice.invoiceNumber || invoice.uuid || "fatura";
    try {
        const inner = decompressZipEntry(zipBuf);
        if (inner.length > 4 && inner[0] === 0x25 && inner[1] === 0x50 && inner[2] === 0x44 && inner[3] === 0x46) {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", fileDisposition(baseName, "pdf", inline));
            res.send(inner);
            return true;
        }
        if (requirePdf) return false;
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Content-Disposition", fileDisposition(baseName, "xml", inline));
        res.send(inner);
        return true;
    } catch {
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", fileDisposition(baseName, "zip", inline));
        res.send(zipBuf);
        return true;
    }
};

const streamSovosDocumentBuffer = async (res, invoice, creds) => {
    const session = await sovosService.restoreSession(creds);
    if (!session.success) {
        res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
        return false;
    }

    const sessionId = session.sessionId;
    const vkn = invoice.supplier?.vkn || creds.vknTckn;
    const profileUpper = String(invoice.profileId || "").toUpperCase();
    const isEArchive = isSovosEArchiveProfile(invoice.profileId);
    const isDespatch = profileUpper.includes("IRSALIYE") || profileUpper.includes("İRSALİYE");
    const lookupParams = {
        sessionId,
        vkn,
        uuid: invoice.uuid,
        invoiceNumber: invoice.invoiceNumber,
        custInvID: invoice.custInvId || invoice.orderNumber || "",
        orderNumber: invoice.orderNumber || "",
    };

    try {
        if (isDespatch) {
            const direction = resolveSovosInvoiceDirection(invoice, creds);
            const tryDesView = async (format) =>
                sovosEDespatchService.getDesView({
                    sessionId,
                    uuid: invoice.uuid,
                    custInvId: invoice.custInvId || invoice.orderNumber || "",
                    type: direction.type,
                    viewFormat: format,
                    identifierKey: direction.identifierKey,
                });

            let viewResult = await tryDesView("PDF");
            if (!viewResult.success || !viewResult.data?.base64) {
                viewResult = await tryDesView("HTML");
                if (viewResult.success && viewResult.data?.base64 && sendDocumentBuffer(res, invoice, viewResult.data)) {
                    return true;
                }
                const ublResult = await sovosEDespatchService.getDesUBL({
                    sessionId,
                    uuid: invoice.uuid,
                    type: direction.type,
                    identifierKey: direction.identifierKey,
                });
                if (ublResult.success && ublResult.data?.zipEntries?.length) {
                    const zipBuf = Buffer.from(ublResult.data.zipEntries[0].base64, "base64");
                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader("Content-Disposition", fileDisposition(invoice.invoiceNumber, "zip"));
                    res.send(zipBuf);
                    return true;
                }
                res.status(404).json({ success: false, message: viewResult.error || "Sovos e-İrsaliye belgesi alınamadı" });
                return false;
            }
            if (sendDocumentBuffer(res, invoice, viewResult.data)) return true;
            res.status(404).json({ success: false, message: "Sovos e-İrsaliye belgesi işlenemedi" });
            return false;
        }

        if (isEArchive) {
            const docResult = await sovosEArchiveService.getInvoiceDocument({
                ...lookupParams,
                outputType: "PDF",
            });
            if (docResult.success && docResult.data && sendDocumentBuffer(res, invoice, docResult.data)) {
                return true;
            }
            const htmlResult = await sovosEArchiveService.getInvoiceDocument({
                ...lookupParams,
                outputType: "HTML",
            });
            if (htmlResult.success && htmlResult.data && sendDocumentBuffer(res, invoice, htmlResult.data)) {
                return true;
            }
            res.status(404).json({ success: false, message: docResult.error || htmlResult?.error || "Sovos e-Arşiv belgesi alınamadı" });
            return false;
        }

        const direction = resolveSovosInvoiceDirection(invoice, creds);
        const viewDirections = [
            direction,
            direction.type === "OUTBOUND"
                ? { type: "INBOUND", identifierKey: "receiver" }
                : { type: "OUTBOUND", identifierKey: "sender" },
        ];
        const tryView = async (format, dir) => streamSovosView(sessionId, invoice, dir, format);

        let viewResult = null;
        for (const dir of viewDirections) {
            for (const format of ["PDF", "HTML"]) {
                const attempt = await tryView(format, dir);
                if (attempt.success && attempt.data?.base64) {
                    viewResult = attempt;
                    break;
                }
                viewResult = attempt;
            }
            if (viewResult?.success && viewResult.data?.base64) break;
        }

        if (viewResult?.success && viewResult.data?.base64) {
            if (sendDocumentBuffer(res, invoice, viewResult.data)) return true;
        }

        const eArchiveDoc = await sovosEArchiveService.getInvoiceDocument({
            ...lookupParams,
            outputType: "PDF",
        });
        if (eArchiveDoc.success && eArchiveDoc.data && sendDocumentBuffer(res, invoice, eArchiveDoc.data)) {
            return true;
        }
        const eArchiveHtml = await sovosEArchiveService.getInvoiceDocument({
            ...lookupParams,
            outputType: "HTML",
        });
        if (eArchiveHtml.success && eArchiveHtml.data && sendDocumentBuffer(res, invoice, eArchiveHtml.data)) {
            return true;
        }

        if (await streamSovosUblZip(res, sessionId, invoice, direction, true, { requirePdf: true })) {
            return true;
        }
        res.status(404).json({
            success: false,
            message: viewResult?.error || eArchiveDoc.error || "Sovos fatura görüntüsü alınamadı",
        });
        return false;
    } finally {
        await sovosService.logout({ sessionId }).catch(() => {});
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  AYAR YÖNETİMİ (Config CRUD)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/disconnect-provider
 * Sağlayıcı bağlantısını kes — DB credential'larını temizler (sayfa yenilemede geri gelmesin)
 */
exports.disconnectProvider = async (req, res) => {
    try {
        const userId = req.user._id;
        const { providerId, sessionId } = req.body;
        const providerKey = PROVIDER_ID_MAP[providerId];

        if (!providerKey) {
            return res.status(400).json({ success: false, message: "Geçersiz sağlayıcı kimliği" });
        }

        const config = await AutoInvoiceConfig.findOne({ userId });
        const $set = providerKey === "sovos"
            ? clearSovosCredentialFields()
            : clearQnbCredentialFields();

        await AutoInvoiceConfig.updateOne(
            { userId },
            { $set },
            { upsert: false }
        );

        if (providerKey === "qnb") {
            await User.updateOne({ _id: userId }, { $set: clearUserQnbFields() });
        }

        if (providerKey === "sovos" && sessionId) {
            await sovosService.logout({ sessionId }).catch(() => {});
        }

        logger.info("[AutoInvoice] Sağlayıcı bağlantısı kesildi — userId=" + userId + " provider=" + providerKey);
        res.json({ success: true, message: "Bağlantı kaldırıldı." });
    } catch (error) {
        logger.error("[AutoInvoice] disconnectProvider hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/config
 * Kullanıcının otomatik fatura ayarlarını getir
 */
exports.getConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            // Varsayılan config oluştur (kaydetme — sadece döndür)
            config = {
                enabled: false,
                provider: "qnb",
                enabledMarketplaces: [],
                triggerStatuses: ["Shipped", "Delivered"],
                invoiceDelayDays: 0,
                autoUploadInvoiceToMarketplace: false,
                documentType: "EARSIVFATURA",
                invoiceTypeCode: "SATIS",
                invoiceSeriesCode: "LYS",
                currency: "TRY",
                sendingType: "ELEKTRONIK",
                supplier: { vkn: "", name: "", taxOffice: "", street: "", district: "", city: "", country: "Turkiye", phone: "", email: "" },
                defaultCustomer: { vkn: "11111111111", name: "Nihai Tüketici", firstName: "Nihai", lastName: "Tüketici", city: "Istanbul", district: "Merkez", country: "Turkiye" },
                qnbCredentials: { username: "", password: "", earsivUsername: "", earsivPassword: "", efaturaUsername: "", efaturaPassword: "", env: "test" },
                sovosCredentials: { username: "", password: "", vknTckn: "", senderIdentifier: "", receiverIdentifier: "", branch: "default", env: "test" },
                defaultVatRate: 20,
                pricesIncludeVat: true,
                defaultNote: "",
                eArchiveVisuals: {
                    logoUrl: "",
                    signatureUrl: "",
                    signatureName: "",
                    invoiceDescription: "",
                },
                marketplaceSettings: {},
                stats: { totalInvoicesCreated: 0, consecutiveErrors: 0 },
            };
        }

        // User.companyInfo'dan eksik alanları otomatik doldur
        // Kullanıcı daha önce profil sayfasından firma bilgisi girdiyse,
        // fatura ayarlarına ilk girişte otomatik dolar.
        await fillConfigFromUser(userId, config);

        res.json({ success: true, data: config });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getConfig hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * PUT /api/auto-invoice/config
 * Kullanıcının otomatik fatura ayarlarını kaydet/güncelle
 */
exports.saveConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            enabled, provider, enabledMarketplaces, triggerStatuses,
            documentType, invoiceTypeCode, invoiceSeriesCode, currency, sendingType,
            supplier, defaultCustomer, qnbCredentials, sovosCredentials,
            defaultVatRate, pricesIncludeVat, defaultNote, eArchiveVisuals,
            marketplaceSettings, autoInvoiceStartDate,
            invoiceDelayDays, autoUploadInvoiceToMarketplace,
        } = req.body;

        // Validasyon
        if (enabled && provider === "sovos") {
            const sc = sovosCredentials || {};
            if (!sc.username || !sc.password || !sc.vknTckn) {
                return res.status(400).json({
                    success: false,
                    message: "Sovos otomatik fatura için web servis kullanıcı adı, şifre ve VKN/TCKN zorunludur.",
                });
            }
        }

        if (enabled && provider !== "sovos" && (!supplier || !supplier.vkn)) {
            return res.status(400).json({
                success: false,
                message: "Otomatik fatura aktif edilmek için satıcı VKN bilgisi zorunludur."
            });
        }

        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            config = new AutoInvoiceConfig({ userId });
        }

        // Alanları güncelle
        if (enabled !== undefined) config.enabled = enabled;
        if (provider) config.provider = provider;
        if (enabledMarketplaces) config.enabledMarketplaces = enabledMarketplaces;
        if (triggerStatuses) config.triggerStatuses = triggerStatuses;
        if (documentType) config.documentType = documentType;
        if (invoiceTypeCode) config.invoiceTypeCode = invoiceTypeCode;
        if (invoiceSeriesCode !== undefined) config.invoiceSeriesCode = invoiceSeriesCode;
        if (currency) config.currency = currency;
        if (sendingType) config.sendingType = sendingType;
        if (supplier) config.supplier = { ...config.supplier.toObject?.() || config.supplier, ...supplier };
        if (defaultCustomer) config.defaultCustomer = { ...config.defaultCustomer.toObject?.() || config.defaultCustomer, ...defaultCustomer };
        if (qnbCredentials) {
            const merged = { ...config.qnbCredentials.toObject?.() || config.qnbCredentials, ...qnbCredentials };
            // ⚠️ ÖNEMLİ: e-Arşiv ve e-Fatura FARKLI ortamlar — FARKLI credentials!
            //   Her kullanıcı QNB'den aldığı kullanıcı adı/şifreyi olduğu gibi girer.
            //   Eski "username" alanı e-Fatura'ya aittir — e-Arşiv'e kopyalanMAMALI!
            config.qnbCredentials = merged;

            // Credentials değiştiğinde login cooldown'ını temizle
            // Böylece yeni şifre ile hemen tekrar login denenebilir
            qnbService.clearLoginCooldown();
        }
        if (sovosCredentials) {
            config.sovosCredentials = {
                ...config.sovosCredentials.toObject?.() || config.sovosCredentials,
                ...sovosCredentials,
            };
            if (sovosCredentials.vknTckn && (!config.supplier?.vkn)) {
                config.supplier = { ...config.supplier.toObject?.() || config.supplier, vkn: sovosCredentials.vknTckn };
            }
        }

        const activeProvider = provider || config.provider || "qnb";
        const sc = config.sovosCredentials || {};
        const credsChanged = sovosCredentials && (
            sovosCredentials.username !== undefined ||
            sovosCredentials.password !== undefined ||
            sovosCredentials.senderIdentifier !== undefined
        );
        const verifiedAt = sc.verifiedAt ? new Date(sc.verifiedAt).getTime() : 0;
        const probeStale = !verifiedAt || (Date.now() - verifiedAt > 60 * 60 * 1000);

        if (activeProvider === "sovos" && sc.username && sc.password && sc.vknTckn && (credsChanged || probeStale)) {
            try {
                const probe = await sovosService.login({
                    username: sc.username,
                    password: sc.password,
                    vknTckn: sc.vknTckn,
                    senderIdentifier: sc.senderIdentifier || "",
                    receiverIdentifier: sc.receiverIdentifier || "",
                    branch: sc.branch || "default",
                    env: sc.env || "test",
                    loginMode: isValidGbIdentifier(sc.senderIdentifier) ? "auto" : "earsiv",
                });
                if (probe.success) {
                    config.sovosCredentials.capabilities = probe.capabilities || { efatura: false, earsiv: false };
                    config.sovosCredentials.verifiedAt = new Date();
                    if (!probe.capabilities?.efatura) {
                        config.documentType = "EARSIVFATURA";
                    }
                    config.markModified("sovosCredentials");
                }
            } catch (probeErr) {
                logger.warn("[AutoInvoice] Sovos yetki doğrulaması atlandı: " + probeErr.message);
            }
        }
        if (defaultVatRate !== undefined) config.defaultVatRate = defaultVatRate;
        if (pricesIncludeVat !== undefined) config.pricesIncludeVat = pricesIncludeVat;
        if (defaultNote !== undefined) config.defaultNote = defaultNote;
        if (eArchiveVisuals && typeof eArchiveVisuals === "object") {
            config.eArchiveVisuals = {
                ...(config.eArchiveVisuals?.toObject?.() || config.eArchiveVisuals || {}),
                logoUrl: eArchiveVisuals.logoUrl || "",
                signatureUrl: eArchiveVisuals.signatureUrl || "",
                signatureName: eArchiveVisuals.signatureName || "",
                invoiceDescription: eArchiveVisuals.invoiceDescription || "",
            };
        }
        if (invoiceDelayDays !== undefined) {
            const n = Math.floor(Number(invoiceDelayDays));
            config.invoiceDelayDays = Math.max(0, Math.min(90, Number.isFinite(n) ? n : 0));
        }
        if (autoUploadInvoiceToMarketplace !== undefined) {
            config.autoUploadInvoiceToMarketplace = !!autoUploadInvoiceToMarketplace;
        }
        if (marketplaceSettings && typeof marketplaceSettings === "object") {
            if (!config.marketplaceSettings) config.marketplaceSettings = new Map();
            Object.entries(marketplaceSettings).forEach(([mp, settings]) => {
                const normalized = normalizeMarketplaceName(mp);
                config.marketplaceSettings.set(normalized, settings);
            });
        }

        // Aktif edilirken ardışık hata sayacını sıfırla
        if (enabled === true) {
            config.stats.consecutiveErrors = 0;
        }

        // ── autoInvoiceStartDate yönetimi ────────────────────────────────
        // Kullanıcı ayarlardan özel bir başlangıç tarihi belirleyebilir.
        // Belirlemediyse ve ilk kez kayıt yapılıyorsa şu anı set et.
        // Bu tarihten önceki siparişler otomatik faturalanmaz (mükerrer engeli).
        if (autoInvoiceStartDate) {
            const parsed = new Date(autoInvoiceStartDate);
            if (!isNaN(parsed.getTime())) {
                config.autoInvoiceStartDate = parsed;
            }
        } else if (!config.autoInvoiceStartDate) {
            config.autoInvoiceStartDate = new Date();
            logger.info("[AutoInvoice] 📅 autoInvoiceStartDate ilk kayıtta set edildi — userId=" + userId);
        }

        await config.save();

        // ── User.companyInfo'yu senkronize et (tek kaynak) ────────────────
        // Fatura ayarlarından girilen firma bilgileri ve QNB credential'ları
        // User modeline de yazılır — böylece tüm servisler tutarlı veri okur.
        await syncConfigToUser(userId, supplier, qnbCredentials);

        logger.info("[AutoInvoice] Config güncellendi — userId=" + userId + " enabled=" + config.enabled);
        res.json({ success: true, data: config, message: "Ayarlar kaydedildi." });
    } catch (error) {
        logger.error("[AutoInvoice Controller] saveConfig hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/toggle
 * Otomatik faturayı aç/kapat (hızlı toggle)
 */
exports.toggleEnabled = async (req, res) => {
    try {
        const userId = req.user._id;
        const config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            return res.status(404).json({ success: false, message: "Önce ayarları kaydedin." });
        }

        // Açılırken satıcı VKN / sağlayıcı kontrolü
        if (!config.enabled) {
            const provider = config.provider || "qnb";
            const hasVkn = config.supplier?.vkn || config.sovosCredentials?.vknTckn;
            if (!hasVkn) {
                return res.status(400).json({
                    success: false,
                    message: "Satıcı VKN bilgisi eksik. Lütfen önce ayarlardan firma bilgilerinizi girin.",
                });
            }
            if (provider === "sovos") {
                const sc = config.sovosCredentials || {};
                if (!sc.username || !sc.password || !sc.vknTckn) {
                    return res.status(400).json({
                        success: false,
                        message: "Sovos bağlantı bilgileri eksik. Otomatik fatura ayarlarından Sovos bilgilerini girin.",
                    });
                }
            }
        }

        config.enabled = !config.enabled;
        if (config.enabled) {
            config.stats.consecutiveErrors = 0; // Açılırken hata sayacını sıfırla
            // Aktif edilirken login cooldown'ını da temizle
            qnbService.clearLoginCooldown();

            // ── Mükerrer fatura koruması ──────────────────────────────────
            // İlk kez aktif ediliyorsa autoInvoiceStartDate'i şu ana set et.
            // Bu tarihten önceki siparişler otomatik faturalanmaz.
            // Böylece kullanıcının daha önce manuel kestiği faturalar
            // tekrar kesilmez.
            if (!config.autoInvoiceStartDate) {
                config.autoInvoiceStartDate = new Date();
                logger.info("[AutoInvoice] 📅 autoInvoiceStartDate set edildi — userId=" + userId + " tarih=" + config.autoInvoiceStartDate.toISOString());
            }
        }
        await config.save();

        logger.info("[AutoInvoice] Toggle — userId=" + userId + " enabled=" + config.enabled);
        res.json({
            success: true,
            enabled: config.enabled,
            autoInvoiceStartDate: config.autoInvoiceStartDate,
            message: config.enabled ? "Otomatik fatura aktif edildi." : "Otomatik fatura devre dışı bırakıldı."
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] toggle hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  MANUEL TETİKLEME
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/process
 * Seçili siparişler için manuel fatura kes
 * Body: { orderIds: ["id1", "id2", ...] }
 */
exports.processOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderIds } = req.body;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, message: "Sipariş ID listesi gerekli." });
        }

        if (orderIds.length > 50) {
            return res.status(400).json({ success: false, message: "Tek seferde en fazla 50 sipariş faturalanabilir." });
        }

        logger.info("[AutoInvoice] Manuel tetikleme — userId=" + userId + " siparişSayısı=" + orderIds.length);

        const result = await processManualBatchInvoice(userId, orderIds);

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: result,
            message: result.invoiced + " fatura kesildi, " + result.skipped + " atlandı" +
                (result.errors > 0 ? ", " + result.errors + " hata" : "")
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] processOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/process-single/:orderId
 * Tek sipariş için fatura kes
 */
exports.processSingleOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Sipariş ID gerekli." });
        }

        // Siparişin bu kullanıcıya ait olduğunu doğrula
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        }

        if (order.invoiceId) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten faturalandı." });
        }

        if (order.invoiceStatus === "error" || order.invoiceStatus === "pending") {
            await Order.updateOne({ _id: orderId }, { invoiceStatus: "" });
        }

        logger.info("[AutoInvoice] Tek sipariş faturalama — orderId=" + orderId);

        const result = await processManualBatchInvoice(userId, [orderId]);

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        if (result.invoiced === 0) {
            const cfg = await AutoInvoiceConfig.findOne({ userId }).select("stats.lastError autoInvoiceStartDate").lean();
            const freshOrder = await Order.findOne({ _id: orderId, user: userId }).lean();
            let hint = cfg?.stats?.lastError || "Fatura kesilemedi. Sovos bağlantı, şube ve fatura seri kodunu kontrol edin.";
            if (freshOrder?.invoiceStatus === "pending") {
                hint = "Sipariş başka bir işlem tarafından kilitlendi (pending). Birkaç dakika sonra tekrar deneyin.";
            } else if (
                cfg?.autoInvoiceStartDate &&
                freshOrder?.orderDate &&
                new Date(freshOrder.orderDate) < new Date(cfg.autoInvoiceStartDate)
            ) {
                hint = "Sipariş, otomatik fatura başlangıç tarihinden (" +
                    new Date(cfg.autoInvoiceStartDate).toISOString().slice(0, 10) +
                    ") önce — manuel kesim denendi ama sağlayıcı hatası oluşmuş olabilir: " +
                    (cfg?.stats?.lastError || "logları kontrol edin");
            }
            return res.status(400).json({ success: false, message: hint });
        }

        res.json({
            success: true,
            data: result,
            message: "Fatura başarıyla kesildi.",
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] processSingleOrder hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  FATURA LİSTESİ & DETAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auto-invoice/invoices
 * Kullanıcının kesilen faturalarını listele
 * Query: ?page=1&limit=20&status=created&marketplace=Trendyol&startDate=2026-01-01&endDate=2026-12-31
 */
exports.listInvoices = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        // Filtreler
        const filter = { userId };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.marketplace) filter.marketplaceName = req.query.marketplace;
        if (req.query.createdBy) filter.createdBy = req.query.createdBy;
        if (req.query.startDate || req.query.endDate) {
            filter.issueDate = {};
            if (req.query.startDate) filter.issueDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.issueDate.$lte = new Date(req.query.endDate + "T23:59:59.999Z");
        }

        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Invoice.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: invoices,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] listInvoices hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/invoices/:invoiceId
 * Tek fatura detayı — zengin bilgi döndürür
 * invoiceId: MongoDB _id VEYA UUID (ETTN) olabilir
 */
exports.getInvoiceDetail = async (req, res) => {
    try {
        const userId = req.user._id;
        const { invoiceId } = req.params;

        // Önce _id ile ara, bulamazsa UUID ile ara
        let invoice = null;
        if (invoiceId.match(/^[0-9a-fA-F]{24}$/)) {
            invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
        }
        if (!invoice) {
            invoice = await Invoice.findOne({ uuid: invoiceId, userId }).lean();
        }
        if (!invoice) {
            invoice = await Invoice.findOne({ invoiceNumber: invoiceId, userId }).lean();
        }
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        // İlişkili siparişi de getir
        let order = null;
        if (invoice.orderId) {
            order = await Order.findById(invoice.orderId)
                .select("orderNumber marketplaceName status totalPrice shippingAddress customerFirstName customerLastName customerEmail isCancelled isReturned createdAt")
                .lean();
        }

        // Fatura görüntüleme URL'si — yalnızca QNB kayıtları için otomatik üret (Sovos'ta QNB linki kullanılmaz)
        let viewUrl = invoice.faturaURL || "";
        const invoiceProvider = invoice.provider || "qnb";
        if (!viewUrl && invoiceProvider === "qnb" && invoice.uuid && invoice.supplier?.vkn) {
            const env = invoice.env || "test";
            const envPrefix = env === "production" ? "earsiv" : "earsivtest";
            viewUrl = "https://" + envPrefix + ".qnbesolutions.com.tr/earsiv/goruntule.jsp?vkn=" + invoice.supplier.vkn + "&uuid=" + invoice.uuid;
        }

        // Zengin detay objesi
        const detail = {
            // Temel bilgiler
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber || "",
            uuid: invoice.uuid || "",
            profileId: invoice.profileId || "EARSIVFATURA",
            invoiceTypeCode: invoice.invoiceTypeCode || "SATIS",
            issueDate: invoice.issueDate || invoice.createdAt,
            currency: invoice.currency || "TRY",
            status: invoice.status || "created",
            createdBy: invoice.createdBy || "manual",
            provider: invoice.provider || "qnb",
            direction: invoice.direction || "outgoing",
            env: invoice.env || "test",
            note: invoice.note || "",

            // Satıcı
            supplier: {
                vkn: invoice.supplier?.vkn || "",
                name: invoice.supplier?.name || "",
                taxOffice: invoice.supplier?.taxOffice || "",
            },

            // Alıcı
            customer: {
                vkn: invoice.customer?.vkn || "",
                name: invoice.customer?.name || "",
                taxOffice: invoice.customer?.taxOffice || "",
            },

            // Tutarlar
            totals: {
                lineExtensionAmount: invoice.totals?.lineExtensionAmount || 0,
                totalTax: invoice.totals?.totalTax || 0,
                taxInclusiveAmount: invoice.totals?.taxInclusiveAmount || 0,
                payableAmount: invoice.totals?.payableAmount || 0,
                totalDiscount: invoice.totals?.totalDiscount || 0,
            },

            // Kalemler
            lines: (invoice.lines || []).map((line, idx) => ({
                index: idx + 1,
                name: line.name || "",
                quantity: line.quantity || 1,
                unit: line.unit || "adet",
                unitPrice: line.unitPrice || 0,
                vatRate: line.vatRate || 0,
                discountAmount: line.discountAmount || 0,
                lineTotal: line.lineTotal || 0,
                vatAmount: line.vatAmount || 0,
            })),

            // Sipariş bilgisi
            orderNumber: invoice.orderNumber || "",
            custInvId: invoice.custInvId || invoice.orderNumber || "",
            marketplaceName: invoice.marketplaceName || "",

            // Sağlayıcı yanıt bilgileri
            providerResponse: {
                resultCode: invoice.providerResponse?.resultCode || "",
                resultText: invoice.providerResponse?.resultText || "",
                islemId: invoice.providerResponse?.islemId || "",
                belgeOid: invoice.providerResponse?.belgeOid || "",
                signedDocument: invoice.providerResponse?.signedDocument || false,
            },
            providerStatusCode: invoice.providerResponse?.resultCode || "",
            providerStatusLabel: (() => {
                const code = invoice.providerResponse?.resultCode;
                const profileUpper = String(invoice.profileId || "").toUpperCase();
                if (invoiceProvider === "sovos" && profileUpper.includes("EARSIV") && code) {
                    return mapSovosEArchiveStatus(code, invoice.providerResponse?.resultText || "").label;
                }
                return invoice.providerResponse?.resultText || "";
            })(),

            // URL & hata
            faturaURL: viewUrl,
            qnbInvoiceNumber: invoice.qnbInvoiceNumber || "",
            errorMessage: invoice.errorMessage || "",

            // Zaman damgaları
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
        };

        res.json({ success: true, data: { invoice: detail, order: order || null } });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getInvoiceDetail hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/invoices/:invoiceId/refresh-status
 * Sağlayıcıdan fatura durumunu güncelle
 */
exports.refreshInvoiceStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        const profileUpper = String(invoice.profileId || "").toUpperCase();
        const isEArchive = profileUpper.includes("EARSIV");
        let providerStatus = null;
        let detail = "";
        let statusCode = "";

        if (invoice.provider === "sovos" && isEArchive) {
            const sovosCreds = await resolveSovosCredentials(userId);
            if (!sovosCreds) {
                return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
            }
            const session = await sovosService.restoreSession(sovosCreds);
            if (!session.success) {
                return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
            }
            try {
                const result = await sovosEArchiveService.getStatus({
                    sessionId: session.sessionId,
                    vkn: invoice.supplier?.vkn || sovosCreds.vknTckn,
                    uuid: invoice.uuid,
                    invoiceNumber: invoice.invoiceNumber,
                    custInvID: invoice.custInvId || invoice.orderNumber || "",
                    orderNumber: invoice.orderNumber || "",
                });
                if (!result.success) {
                    return res.status(400).json({ success: false, message: result.error || "Durum sorgulanamadı" });
                }
                providerStatus = result.data?.mappedStatus || "sent";
                detail = result.data?.detail || result.data?.statusLabel || "";
                statusCode = result.data?.statusCode != null ? String(result.data.statusCode) : "";

                const sovosInvNo = String(result.data?.invoiceNumber || "").trim();
                const sovosUuid = String(result.data?.uuid || "").trim();
                const syncFields = {};
                if (sovosInvNo && sovosInvNo !== invoice.invoiceNumber) {
                    syncFields.invoiceNumber = sovosInvNo;
                }
                if (sovosUuid && sovosUuid !== invoice.uuid) {
                    syncFields.uuid = sovosUuid;
                }
                if (Object.keys(syncFields).length) {
                    await Invoice.updateOne({ _id: invoice._id }, syncFields);
                    logger.info(
                        "[AutoInvoice] Sovos fatura kimliği senkronize edildi — " +
                        (syncFields.invoiceNumber ? "no=" + syncFields.invoiceNumber + " " : "") +
                        (syncFields.uuid ? "uuid=" + syncFields.uuid : "")
                    );
                }
            } finally {
                await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
            }
        } else if (invoice.provider === "sovos" && !isEArchive) {
            const sovosCreds = await resolveSovosCredentials(userId);
            if (!sovosCreds) {
                return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
            }
            const session = await sovosService.restoreSession(sovosCreds);
            if (!session.success) {
                return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
            }
            const isDespatch = profileUpper.includes("IRSALIYE") || profileUpper.includes("İRSALİYE");
            try {
                const direction = resolveSovosInvoiceDirection(invoice, sovosCreds);
                if (isDespatch) {
                    const envResult = await sovosEDespatchService.getDesEnvelopeStatus({
                        sessionId: session.sessionId,
                        uuid: invoice.envUuid || invoice.uuid,
                    });
                    if (!envResult.success) {
                        return res.status(400).json({ success: false, message: envResult.error || "e-İrsaliye zarf durumu sorgulanamadı" });
                    }
                    providerStatus = invoice.status === "accepted" || invoice.status === "rejected"
                        ? invoice.status
                        : "sent";
                    detail = "e-İrsaliye zarf durumu güncellendi";
                } else if (direction.type === "INBOUND") {
                    const respResult = await sovosService.getInvResponses({
                        sessionId: session.sessionId,
                        uuid: invoice.uuid,
                        type: "INBOUND",
                        identifierKey: direction.identifierKey,
                    });
                    if (!respResult.success) {
                        return res.status(400).json({ success: false, message: respResult.error || "Yanıt sorgulanamadı" });
                    }
                    const parsed = parseSovosInvResponseStatus(respResult.data);
                    providerStatus = parsed.status;
                    detail = parsed.detail;
                } else {
                    const envResult = await sovosService.getEnvelopeStatus({
                        sessionId: session.sessionId,
                        uuid: invoice.envUuid || invoice.uuid,
                    });
                    if (!envResult.success) {
                        return res.status(400).json({ success: false, message: envResult.error || "Zarf durumu sorgulanamadı" });
                    }
                    providerStatus = invoice.status === "accepted" || invoice.status === "rejected"
                        ? invoice.status
                        : "sent";
                    detail = "Zarf durumu güncellendi";
                }
            } finally {
                await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
            }
        } else if (invoice.provider === "qnb" && isEArchive) {
            const creds = await resolveEarsivCredentials(userId);
            if (!creds) {
                return res.status(400).json({ success: false, message: "e-Arşiv bağlantı bilgileri eksik." });
            }
            const loginResult = await qnbService.login({
                username: creds.earsivUsername,
                password: creds.earsivPassword,
                env: creds.env,
                service: "earsiv",
            });
            if (!loginResult.success) {
                return res.status(502).json({ success: false, message: "e-Arşiv oturumu açılamadı: " + loginResult.error });
            }
            try {
                const statusResult = await qnbService.queryEArchiveInvoice({
                    sessionId: loginResult.sessionId,
                    vkn: invoice.supplier?.vkn || creds.vkn,
                    uuid: invoice.uuid,
                    faturaNo: invoice.invoiceNumber,
                    env: creds.env,
                });
                if (!statusResult.success) {
                    return res.status(400).json({ success: false, message: statusResult.error || "Durum sorgulanamadı" });
                }
                const raw = statusResult.data || {};
                const rawStatus = String(raw.durum || raw.status || raw.faturaDurum || "").toLowerCase();
                providerStatus = /iptal|cancel/i.test(rawStatus) ? "cancelled" : "sent";
                detail = raw.aciklama || raw.message || rawStatus || "Sorgulandı";
            } finally {
                await qnbService.logout({ sessionId: loginResult.sessionId, env: creds.env, service: "earsiv" }).catch(() => {});
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Bu belge tipi için sağlayıcı durum sorgusu henüz desteklenmiyor.",
            });
        }

        await Invoice.updateOne(
            { _id: invoice._id },
            {
                status: providerStatus,
                "providerResponse.resultText": detail,
                ...(statusCode ? { "providerResponse.resultCode": statusCode } : {}),
                ...(providerStatus === "cancelled" ? { "providerResponse.sovosCancelled": true } : {}),
            }
        );

        res.json({
            success: true,
            data: {
                status: providerStatus,
                detail,
                statusCode: statusCode || undefined,
                invoiceId: invoice._id,
            },
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] refreshInvoiceStatus hatası: " + error.message);
        res.status(500).json({ success: false, message: "Durum güncellenemedi" });
    }
};

/**
 * Sovos cancelInvoice — resmi API totalAmount = vergiler hariç toplam (LineExtensionAmount)
 */
const resolveInvoiceCancelAmount = async (invoice) => {
    const totals = invoice.totals || {};
    let amount = Number(totals.lineExtensionAmount || totals.taxExclusiveAmount || 0);
    if (amount > 0) return amount;

    if (Array.isArray(invoice.lines) && invoice.lines.length) {
        const lineSum = invoice.lines.reduce((sum, line) => {
            const qty = Number(line.quantity || 1);
            const price = Number(line.unitPrice || line.price || 0);
            return sum + qty * price;
        }, 0);
        if (lineSum > 0) return Number(lineSum.toFixed(2));
    }

    // KDV dahil tutarlar yalnızca son çare — cancelInvoice UBL'den düzeltir
    amount = Number(totals.payableAmount || totals.taxInclusiveAmount || 0);
    if (amount > 0) return amount;

    if (invoice.orderId) {
        const order = await Order.findById(invoice.orderId).select("totalPrice").lean();
        if (order?.totalPrice > 0) return Number(order.totalPrice);
    }

    return 0;
};

/**
 * POST /api/auto-invoice/invoices/:invoiceId/cancel
 * e-Arşiv faturayı sağlayıcıda iptal et (itiraz)
 */
exports.cancelInvoiceRecord = async (req, res) => {
    try {
        const userId = req.user._id;
        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }
        if (invoice.status === "cancelled") {
            return res.status(400).json({ success: false, message: "Fatura zaten iptal edilmiş." });
        }
        const isEArchive = String(invoice.profileId || "").toUpperCase().includes("EARSIV");
        if (!isEArchive) {
            return res.status(400).json({ success: false, message: "Yalnızca e-Arşiv faturalar iptal edilebilir." });
        }

        const totalAmount = await resolveInvoiceCancelAmount(invoice);
        if (!(totalAmount > 0)) {
            return res.status(400).json({
                success: false,
                message: "İptal için fatura tutarı bulunamadı. Fatura detayındaki tutar alanını kontrol edin.",
            });
        }

        if (invoice.provider === "sovos") {
            const sovosCreds = await resolveSovosCredentials(userId);
            if (!sovosCreds) {
                return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
            }
            const session = await sovosService.restoreSession(sovosCreds);
            if (!session.success) {
                return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
            }
            try {
                const result = await sovosEArchiveService.cancelInvoice({
                    sessionId: session.sessionId,
                    vkn: invoice.supplier?.vkn || sovosCreds.vknTckn,
                    invoiceNumber: invoice.invoiceNumber,
                    uuid: invoice.uuid,
                    totalAmount,
                    cancelDate: invoice.issueDate || new Date(),
                    branch: sovosCreds.branch || "default",
                    custInvID: invoice.custInvId || invoice.orderNumber || "",
                    orderNumber: invoice.orderNumber || "",
                });
                if (!result.success) {
                    return res.status(400).json({ success: false, message: result.error || "Sovos iptal başarısız" });
                }

                const syncedInvNo = result.data?.invoiceNumber;
                const syncedUuid = result.data?.uuid;
                const verified = result.data?.verifiedStatus;
                const statusMessage = result.alreadyCancelled
                    ? (result.data?.message || "Fatura Sovos tarafında zaten iptal edilmiş — kayıt güncellendi.")
                    : (result.data?.message || "Fatura Sovos'ta iptal edildi.");

                const updateFields = {
                    status: "cancelled",
                    providerResponse: {
                        ...(invoice.providerResponse || {}),
                        resultCode: verified?.statusCode != null ? String(verified.statusCode) : "140",
                        resultText: statusMessage,
                        cancelCode: result.data?.code,
                    },
                };
                if (syncedInvNo && syncedInvNo !== invoice.invoiceNumber) {
                    updateFields.invoiceNumber = syncedInvNo;
                }
                if (syncedUuid && syncedUuid !== invoice.uuid) {
                    updateFields.uuid = syncedUuid;
                }

                await Invoice.updateOne({ _id: invoice._id }, updateFields);

                return res.json({
                    success: true,
                    message: statusMessage,
                    data: {
                        status: "cancelled",
                        alreadyCancelled: result.alreadyCancelled === true,
                        sovos: result.data,
                    },
                });
            } finally {
                await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
            }
        } else if (invoice.provider === "qnb") {
            const creds = await resolveEarsivCredentials(userId);
            if (!creds) {
                return res.status(400).json({ success: false, message: "e-Arşiv bağlantı bilgileri eksik." });
            }
            const loginResult = await qnbService.login({
                username: creds.earsivUsername,
                password: creds.earsivPassword,
                env: creds.env,
                service: "earsiv",
            });
            if (!loginResult.success) {
                return res.status(502).json({ success: false, message: "e-Arşiv oturumu açılamadı: " + loginResult.error });
            }
            try {
                const result = await qnbService.cancelEArchiveInvoice({
                    sessionId: loginResult.sessionId,
                    vkn: invoice.supplier?.vkn || creds.vkn,
                    uuid: invoice.uuid,
                    faturaNo: invoice.invoiceNumber,
                    env: creds.env,
                });
                if (!result.success) {
                    return res.status(400).json({ success: false, message: result.error || "İptal başarısız" });
                }
            } finally {
                await qnbService.logout({ sessionId: loginResult.sessionId, env: creds.env, service: "earsiv" }).catch(() => {});
            }
        } else {
            return res.status(400).json({ success: false, message: "Bu sağlayıcı için iptal desteklenmiyor." });
        }

        await Invoice.updateOne({ _id: invoice._id }, { status: "cancelled" });

        res.json({ success: true, message: "Fatura iptal edildi.", data: { status: "cancelled" } });
    } catch (error) {
        logger.error("[AutoInvoice Controller] cancelInvoiceRecord hatası: " + error.message);
        res.status(500).json({ success: false, message: "İptal işlemi başarısız" });
    }
};

/**
 * POST /api/auto-invoice/invoices/:invoiceId/respond
 * Gelen ticari e-Faturaya KABUL / RED uygulama yanıtı gönder
 */
exports.respondInvoiceRecord = async (req, res) => {
    try {
        const userId = req.user._id;
        const { responseCode } = req.body;
        const code = String(responseCode || "").toUpperCase();
        if (code !== "KABUL" && code !== "RED") {
            return res.status(400).json({ success: false, message: "responseCode: KABUL veya RED olmalıdır" });
        }

        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }
        if (invoice.provider !== "sovos") {
            return res.status(400).json({ success: false, message: "Kabul/red yalnızca Sovos gelen e-Fatura için desteklenir." });
        }
        if (invoice.status === "accepted" || invoice.status === "rejected") {
            return res.status(400).json({ success: false, message: "Bu faturaya zaten yanıt verilmiş." });
        }
        if (String(invoice.profileId || "").toUpperCase() !== "TICARIFATURA") {
            return res.status(400).json({
                success: false,
                message: "Kabul/red yalnızca ticari (TICARIFATURA) gelen faturalar için geçerlidir.",
            });
        }

        const config = await AutoInvoiceConfig.findOne({ userId }).lean();
        const sovosCreds = await resolveSovosCredentials(userId);
        if (!sovosCreds) {
            return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
        }

        const direction = resolveSovosInvoiceDirection(invoice, sovosCreds);
        if (direction.type !== "INBOUND" && invoice.direction !== "incoming") {
            return res.status(400).json({
                success: false,
                message: "Yalnızca gelen e-Faturalara kabul/red yanıtı gönderilebilir.",
            });
        }

        const session = await sovosService.restoreSession(sovosCreds);
        if (!session.success) {
            return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
        }

        const ourVkn = config?.supplier?.vkn || sovosCreds.vknTckn || "";
        const supplierVkn = invoice.supplier?.vkn || "";
        const counterpartyVkn = supplierVkn && supplierVkn !== ourVkn
            ? supplierVkn
            : (invoice.customer?.vkn || "");

        if (!counterpartyVkn || counterpartyVkn === ourVkn) {
            return res.status(400).json({
                success: false,
                message: "Gönderici VKN bulunamadı. Faturayı Sovos'tan yeniden senkronize edin.",
            });
        }

        try {
            const result = await sovosService.sendApplicationResponse({
                sessionId: session.sessionId,
                invoiceNumber: invoice.invoiceNumber,
                invoiceIssueDate: invoice.issueDate,
                responseCode: code,
                counterpartyVkn,
                counterpartyName: invoice.supplier?.name || "",
                ourParty: {
                    vkn: ourVkn,
                    name: config?.supplier?.name || "",
                    taxOffice: config?.supplier?.taxOffice || "",
                },
            });

            if (!result.success) {
                return res.status(400).json({ success: false, message: result.error || "Yanıt gönderilemedi" });
            }

            const newStatus = code === "KABUL" ? "accepted" : "rejected";
            await Invoice.updateOne({ _id: invoice._id }, { status: newStatus });

            res.json({
                success: true,
                message: code === "KABUL" ? "Fatura kabul edildi" : "Fatura reddedildi",
                data: { status: newStatus, responseCode: code, uuid: result.uuid },
            });
        } finally {
            await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
        }
    } catch (error) {
        logger.error("[AutoInvoice Controller] respondInvoiceRecord hatası: " + error.message);
        res.status(500).json({ success: false, message: "Yanıt gönderilemedi" });
    }
};

/**
 * DELETE /api/auto-invoice/invoices/:invoiceId
 * Yerel veritabanı kaydını sil (sağlayıcıdaki belge silinmez)
 */
exports.deleteInvoiceRecord = async (req, res) => {
    try {
        const userId = req.user._id;
        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        await Invoice.deleteOne({ _id: invoice._id });
        if (invoice.orderId) {
            await Order.updateOne(
                { _id: invoice.orderId },
                { $unset: { invoiceId: 1, invoiceNumber: 1 }, $set: { invoiceStatus: "" } }
            );
        }

        res.json({ success: true, message: "Fatura kaydı silindi." });
    } catch (error) {
        logger.error("[AutoInvoice Controller] deleteInvoiceRecord hatası: " + error.message);
        res.status(500).json({ success: false, message: "Silme işlemi başarısız" });
    }
};

const fmtApiDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
};

const mapLocalTypeToProfile = (localType) => {
    if (localType === "e-arsiv") return "EARSIVFATURA";
    if (localType === "e-irsaliye" || localType === "e-irsaliye-gelen") return "IRSALIYE";
    if (localType === "e-fatura-gelen") return "TEMELFATURA";
    return "TICARIFATURA";
};

const normalizeSovosProfileId = (doc, localType, existing) => {
    const envType = String(doc.envType || doc.raw?.EnvType || "").toUpperCase().trim();
    if (envType === "TICARIFATURA" || envType === "TEMELFATURA") {
        return envType;
    }
    if (localType === "e-arsiv") return "EARSIVFATURA";
    if (localType === "e-irsaliye" || localType === "e-irsaliye-gelen") return "IRSALIYE";
    if (localType === "e-fatura-gelen") {
        return existing?.profileId && existing.profileId !== "EARSIVFATURA"
            ? existing.profileId
            : "TEMELFATURA";
    }
    return mapLocalTypeToProfile(localType);
};

const inferInvoiceDirection = (doc, localType, config, existing) => {
    if (localType === "e-fatura-gelen") return "incoming";
    if (localType === "e-irsaliye-gelen") return "incoming";
    if (localType === "e-fatura" || localType === "e-arsiv" || localType === "e-irsaliye") return "outgoing";
    if (existing?.direction === "incoming" || existing?.direction === "outgoing") {
        return existing.direction;
    }
    const ourVkn = String(config?.supplier?.vkn || config?.sovosCredentials?.vknTckn || "").replace(/\D/g, "");
    const supplierVkn = String(
        doc?.vkn || doc?.raw?.VKN_TCKN || existing?.supplier?.vkn || ""
    ).replace(/\D/g, "");
    if (supplierVkn && ourVkn && supplierVkn !== ourVkn) return "incoming";
    return "outgoing";
};

const inferStoredInvoiceDirection = (inv, config) => {
    if (inv.direction === "incoming" || inv.direction === "outgoing") return inv.direction;
    const ourVkn = String(config?.supplier?.vkn || config?.sovosCredentials?.vknTckn || "").replace(/\D/g, "");
    const supplierVkn = String(inv.supplier?.vkn || "").replace(/\D/g, "");
    if (supplierVkn && ourVkn && supplierVkn !== ourVkn) return "incoming";
    return "outgoing";
};

const mapSovosLocalTypeToUblRequest = (localType) => {
    if (localType === "e-fatura-gelen") {
        return { docType: "INVOICE", type: "INBOUND", identifierKey: "receiver" };
    }
    if (localType === "e-fatura") {
        return { docType: "INVOICE", type: "OUTBOUND", identifierKey: "sender" };
    }
    return null;
};

/** Sovos getUBLList tutar döndürmez — eksik totals için UBL'den doldur */
const enrichSovosInvoiceTotalsFromUbl = async ({ sessionId, userId, uuid, localType }) => {
    if (!sessionId || !uuid) return false;

    const inv = await Invoice.findOne({ userId, uuid }).lean();
    if (!inv) return false;

    const current = resolveInvoiceTotals(inv);
    if (current.payableAmount > 0) return false;

    const ublReq = mapSovosLocalTypeToUblRequest(localType);
    if (!ublReq) return false;

    const ublResult = await sovosService.getUBL({
        sessionId,
        uuid,
        docType: ublReq.docType,
        type: ublReq.type,
        identifierKey: ublReq.identifierKey,
    });
    if (!ublResult.success) return false;

    const entry = ublResult.data?.zipEntries?.[0];
    const buf = entry?.buffer;
    if (!buf || buf.length < 20) return false;

    let xmlText = "";
    try {
        xmlText = decompressZipEntry(buf).toString("utf8");
    } catch {
        xmlText = buf.toString("utf8");
    }

    const totals = extractTotalsFromUblXml(xmlText);
    if (!totals || !(totals.payableAmount > 0)) return false;

    await Invoice.updateOne({ _id: inv._id }, { $set: { totals } });
    return true;
};

const upsertSovosProviderInvoice = async (userId, doc, { config, env, localType }) => {
    const uuid = String(doc.uuid || doc.id || "").trim();
    const invoiceNumber = String(doc.number || "").trim();
    const custInvId = String(doc.custInvId || doc.raw?.customerInvoiceID || "").trim();
    if (!uuid && !invoiceNumber) {
        return { skipped: true, reason: "uuid ve fatura no yok" };
    }

    const filter = uuid ? { userId, uuid } : { userId, invoiceNumber };
    const existing = await Invoice.findOne(filter).lean();
    const profileId = normalizeSovosProfileId(doc, localType, existing);
    const supplier = config?.supplier || {};
    const issueDate = doc.date ? new Date(doc.date) : new Date();
    const isIncoming = localType === "e-fatura-gelen";
    const direction = inferInvoiceDirection(doc, localType, config, existing);
    const envUuid = String(doc.envUuid || doc.raw?.EnvUUID || existing?.envUuid || "").trim();

    const payload = {
        userId,
        uuid: uuid || existing?.uuid || crypto.randomUUID(),
        envUuid: envUuid || existing?.envUuid || "",
        invoiceNumber: invoiceNumber || existing?.invoiceNumber || "",
        custInvId: custInvId || existing?.custInvId || "",
        orderNumber: custInvId || existing?.orderNumber || "",
        profileId,
        direction: isIncoming ? "incoming" : direction,
        issueDate: existing?.issueDate || issueDate,
        currency: existing?.currency || "TRY",
        provider: "sovos",
        env: env || "test",
        supplier: isIncoming
            ? {
                vkn: doc.vkn || doc.raw?.VKN_TCKN || existing?.supplier?.vkn || "",
                name: doc.raw?.senderTitle || existing?.supplier?.name || "",
                taxOffice: existing?.supplier?.taxOffice || "",
            }
            : {
                vkn: supplier.vkn || config?.sovosCredentials?.vknTckn || "",
                name: supplier.name || "",
                taxOffice: supplier.taxOffice || "",
            },
        customer: isIncoming
            ? {
                vkn: supplier.vkn || config?.sovosCredentials?.vknTckn || existing?.customer?.vkn || "",
                name: supplier.name || existing?.customer?.name || "",
                taxOffice: supplier.taxOffice || existing?.customer?.taxOffice || "",
            }
            : {
                vkn: doc.vkn || doc.raw?.receiverId || existing?.customer?.vkn || "",
                name: doc.customer || doc.raw?.receiverTitle || existing?.customer?.name || "",
                taxOffice: existing?.customer?.taxOffice || "",
            },
        totals: resolveInvoiceTotals({
            totals: {
                payableAmount:
                    Number(doc.total || doc.amount) > 0
                        ? Number(doc.total || doc.amount)
                        : Number(existing?.totals?.payableAmount || 0),
                lineExtensionAmount: Number(existing?.totals?.lineExtensionAmount || 0),
                totalTax: Number(existing?.totals?.totalTax || 0),
                taxInclusiveAmount:
                    Number(doc.total || doc.amount) > 0
                        ? Number(doc.total || doc.amount)
                        : Number(existing?.totals?.taxInclusiveAmount || 0),
            },
            lines: existing?.lines || [],
        }),
        status: existing?.status && existing.status !== "created" ? existing.status : "sent",
        createdBy: existing?.createdBy || "manual",
    };

    if (existing) {
        await Invoice.updateOne({ _id: existing._id }, { $set: payload });
        return { updated: true, uuid: payload.uuid, invoiceNumber: payload.invoiceNumber };
    }

    await Invoice.create(payload);
    return { created: true, uuid: payload.uuid, invoiceNumber: payload.invoiceNumber };
};

const sovosStatusIndicatesCancelled = (data) => {
    if (!data) return false;
    if (data.mappedStatus === "cancelled") return true;
    const detail = String(data.detail || data.statusLabel || "");
    return /iptal|itiraz|cancel/i.test(detail);
};

/** Sovos getStatus ile e-Arşiv iptal bayraklarını güncelle */
const syncSovosEArchiveCancelFlags = async ({
    userId,
    sessionId,
    supplierVkn,
    days = 30,
    maxInvoices = 50,
}) => {
    const stats = { checked: 0, cancelled: 0 };
    if (!sessionId || !supplierVkn) return stats;

    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Number(days) || 30));

    const rows = await Invoice.find({
        userId,
        provider: "sovos",
        profileId: /EARSIV/i,
        status: { $ne: "cancelled" },
        issueDate: { $gte: since },
    })
        .select("_id uuid invoiceNumber custInvId orderNumber")
        .limit(maxInvoices)
        .lean();

    for (const inv of rows) {
        stats.checked++;
        try {
            const result = await sovosEArchiveService.getStatus({
                sessionId,
                vkn: supplierVkn,
                uuid: inv.uuid,
                invoiceNumber: inv.invoiceNumber,
                custInvID: inv.custInvId || inv.orderNumber || "",
                orderNumber: inv.orderNumber || "",
            });
            if (!result.success || !result.data) continue;
            if (sovosStatusIndicatesCancelled(result.data)) {
                await Invoice.updateOne(
                    { _id: inv._id },
                    {
                        status: "cancelled",
                        "providerResponse.sovosCancelled": true,
                        "providerResponse.resultText": result.data.detail || result.data.statusLabel || "Sovos: iptal",
                    }
                );
                stats.cancelled++;
            } else {
                await Invoice.updateOne(
                    { _id: inv._id },
                    { "providerResponse.sovosCancelled": false }
                );
            }
        } catch (err) {
            logger.debug("[AutoInvoice] Sovos iptal senkron atlandı — " + inv._id + " " + err.message);
        }
    }
    return stats;
};

/**
 * e-Arşiv v2.3 tekil liste sunmaz — sipariş no (custInvID) ile Sovos getStatus'tan DB'ye kurtar.
 */
const reconcileSovosEArchiveFromOrders = async ({
    userId,
    sessionId,
    config,
    sovosCreds,
    env,
    days = 90,
    maxOrders = 150,
}) => {
    const stats = { recovered: 0, linked: 0, checked: 0, skipped: 0, errors: [] };
    const supplierVkn = sovosCreds?.vknTckn || config?.supplier?.vkn || "";
    if (!supplierVkn) {
        stats.errors.push({ message: "Satıcı VKN eksik — e-Arşiv kurtarma atlandı" });
        return stats;
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(1, Number(days) || 90));

    const existingRows = await Invoice.find({ userId })
        .select("uuid custInvId orderNumber invoiceNumber")
        .lean();
    const knownKeys = new Set();
    for (const inv of existingRows) {
        if (inv.uuid) knownKeys.add(String(inv.uuid).toLowerCase());
        if (inv.custInvId) knownKeys.add(String(inv.custInvId));
        if (inv.orderNumber) knownKeys.add(String(inv.orderNumber));
        if (inv.invoiceNumber) knownKeys.add(String(inv.invoiceNumber));
    }

    const orders = await Order.find({
        user: userId,
        trackingNumber: { $exists: true, $nin: ["", null] },
        $or: [
            { invoiceId: { $exists: false } },
            { invoiceId: null },
            { invoiceStatus: "error" },
        ],
        orderDate: { $gte: start },
    })
        .sort({ orderDate: -1 })
        .limit(maxOrders)
        .select("_id trackingNumber orderNumber totalPrice invoiceId invoiceStatus marketplaceName orderDate")
        .lean();

    for (const order of orders) {
        const custInvId = String(order.trackingNumber || order.orderNumber || "").trim();
        if (!custInvId) {
            stats.skipped++;
            continue;
        }
        if (knownKeys.has(custInvId)) {
            stats.skipped++;
            continue;
        }

        stats.checked++;
        try {
            const statusResult = await sovosEArchiveService.getStatus({
                sessionId,
                vkn: supplierVkn,
                custInvID: custInvId,
                custInvId,
                orderNumber: custInvId,
            });
            const statusData = statusResult.success ? statusResult.data : null;
            const uuid = String(statusData?.uuid || "").trim();
            const invoiceNumber = String(statusData?.invoiceNumber || "").trim();
            if (!uuid && !invoiceNumber) {
                stats.skipped++;
                continue;
            }
            if (uuid && knownKeys.has(uuid.toLowerCase())) {
                stats.skipped++;
                continue;
            }
            if (invoiceNumber && knownKeys.has(invoiceNumber)) {
                stats.skipped++;
                continue;
            }

            const upsert = await upsertSovosProviderInvoice(
                userId,
                {
                    uuid,
                    number: invoiceNumber,
                    custInvId,
                    date: order.orderDate || new Date(),
                    total: order.totalPrice,
                    type: "e-arsiv",
                    raw: statusData?.raw || statusData,
                },
                { config, env, localType: "e-arsiv" }
            );
            if (upsert.skipped) {
                stats.skipped++;
                continue;
            }
            if (upsert.created || upsert.updated) {
                stats.recovered++;
                if (uuid) knownKeys.add(uuid.toLowerCase());
                knownKeys.add(custInvId);
                if (invoiceNumber) knownKeys.add(invoiceNumber);

                if (!order.invoiceId) {
                    const saved = await Invoice.findOne(
                        uuid ? { userId, uuid } : { userId, invoiceNumber }
                    ).select("_id invoiceNumber").lean();
                    if (saved) {
                        await Order.updateOne(
                            { _id: order._id },
                            {
                                invoiceId: saved._id,
                                invoiceNumber: saved.invoiceNumber || invoiceNumber,
                                invoiceStatus: "created",
                            }
                        );
                        stats.linked++;
                    }
                }
            }
        } catch (reconcileErr) {
            stats.errors.push({ custInvId, message: reconcileErr.message });
        }
    }

    return stats;
};

/**
 * POST /api/auto-invoice/sync-sovos
 * Sovos portalından e-Arşiv + e-Fatura belgelerini çekip DB'ye yazar
 */
exports.syncSovosInvoices = async (req, res) => {
    try {
        const userId = req.user._id;
        const days = Math.min(30, Math.max(1, parseInt(req.body.days, 10) || 30));
        const sovosCreds = await resolveSovosCredentials(userId);
        if (!sovosCreds) {
            return res.status(400).json({
                success: false,
                message: "Sovos bağlantı bilgileri eksik. Faturalandırma ayarlarından Sovos bilgilerinizi girin.",
            });
        }

        const config = await AutoInvoiceConfig.findOne({ userId }).lean();
        const session = await sovosService.restoreSession(sovosCreds);
        if (!session.success) {
            return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
        }

        const sessionId = session.sessionId;
        const env = sovosCreds.env || "test";
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - days);
        const searchParams = {
            startDate: fmtApiDate(start),
            endDate: fmtApiDate(end),
        };

        const docTypes = [];
        const caps = session.capabilities || sovosCreds.capabilities || {};
        const storedCaps = config?.sovosCredentials?.capabilities || {};
        const edespatchEnabled = caps.edespatch !== false && storedCaps.edespatch !== false;
        if (caps.earsiv !== false) {
            docTypes.push({ apiType: "earchive", localType: "e-arsiv" });
        }
        const gb = String(sovosCreds.senderIdentifier || "").trim();
        if (caps.efatura === true && isValidGbIdentifier(gb)) {
            docTypes.push({ apiType: "outgoing-einvoice", localType: "e-fatura" });
            if (edespatchEnabled) {
                docTypes.push({ apiType: "despatch-advice", localType: "e-irsaliye" });
            }
            if (sovosCreds.receiverIdentifier) {
                docTypes.push({ apiType: "incoming-einvoice", localType: "e-fatura-gelen" });
                if (edespatchEnabled) {
                    docTypes.push({ apiType: "incoming-despatch", localType: "e-irsaliye-gelen" });
                }
            }
        }
        if (!docTypes.length) {
            docTypes.push({ apiType: "earchive", localType: "e-arsiv" });
        }

        const stats = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
            fetched: 0,
            earsivRecovered: 0,
            earsivChecked: 0,
            earsivLinked: 0,
            totalsEnriched: 0,
        };
        const seen = new Set();
        let ublEnrichBudget = 15;

        try {
            for (const dt of docTypes) {
                if (dt.apiType === "earchive") {
                    continue;
                }
                const result = await sovosService.searchDocuments({
                    sessionId,
                    documentType: dt.apiType,
                    searchParams,
                    allowBypassCooldown: true,
                });

                if (!result.success) {
                    const faultText = String(result.error || result.message || result.detail || "").trim();
                    if (result.inactiveModule && result.capabilityKey) {
                        await persistSovosCapability(userId, sessionId, result.capabilityKey, false);
                        stats.errors.push({ type: dt.localType, message: result.message || "Modül aktif değil", skipped: true });
                    } else if (isSovosInactiveModuleError(faultText)) {
                        await persistSovosCapability(userId, sessionId, result.capabilityKey || "edespatch", false);
                        stats.errors.push({ type: dt.localType, message: "Modül aktif değil — atlandı", skipped: true });
                    } else if (faultText) {
                        stats.errors.push({ type: dt.localType, message: faultText });
                    }
                    continue;
                }
                if (result.skipped) {
                    stats.errors.push({ type: dt.localType, message: result.message || "Atlandı", skipped: true });
                    continue;
                }

                const docs = Array.isArray(result.data) ? result.data : [];
                stats.fetched += docs.length;

                for (const doc of docs) {
                    const key = doc.uuid || doc.id || doc.number;
                    if (key && seen.has(key)) continue;
                    if (key) seen.add(key);

                    try {
                        const upsert = await upsertSovosProviderInvoice(userId, doc, {
                            config,
                            env,
                            localType: dt.localType,
                        });
                        if (upsert.skipped) stats.skipped++;
                        else if (upsert.created) stats.created++;
                        else if (upsert.updated) stats.updated++;

                        if (ublEnrichBudget > 0 && doc.uuid && (dt.localType === "e-fatura" || dt.localType === "e-fatura-gelen")) {
                            try {
                                const enriched = await enrichSovosInvoiceTotalsFromUbl({
                                    sessionId,
                                    userId,
                                    uuid: doc.uuid,
                                    localType: dt.localType,
                                });
                                if (enriched) {
                                    stats.totalsEnriched++;
                                    ublEnrichBudget--;
                                }
                            } catch (enrichErr) {
                                logger.warn("[AutoInvoice] Sovos UBL tutar zenginleştirme: " + enrichErr.message);
                            }
                        }
                    } catch (upsertErr) {
                        stats.errors.push({
                            type: dt.localType,
                            message: upsertErr.message,
                            uuid: doc.uuid,
                        });
                    }
                }
            }

            if (caps.earsiv !== false) {
                const reconcileDays = Math.max(days, 90);
                const earsivReconcile = await reconcileSovosEArchiveFromOrders({
                    userId,
                    sessionId,
                    config,
                    sovosCreds,
                    env,
                    days: reconcileDays,
                });
                stats.earsivRecovered = earsivReconcile.recovered || 0;
                stats.earsivChecked = earsivReconcile.checked || 0;
                stats.earsivLinked = earsivReconcile.linked || 0;
                stats.created += stats.earsivRecovered;
                stats.fetched += stats.earsivRecovered;
                if (stats.earsivRecovered > 0) {
                    logger.info(
                        "[AutoInvoice] Sovos e-Arşiv kurtarma — user=" + userId +
                        " recovered=" + stats.earsivRecovered +
                        " checked=" + stats.earsivChecked
                    );
                }
                if (earsivReconcile.errors?.length) {
                    stats.errors.push(...earsivReconcile.errors.map((e) => ({
                        type: "e-arsiv",
                        message: e.message,
                        custInvId: e.custInvId,
                    })));
                }

                const cancelSync = await syncSovosEArchiveCancelFlags({
                    userId,
                    sessionId,
                    supplierVkn: sovosCreds.vknTckn || config?.supplier?.vkn || "",
                    days,
                });
                stats.cancelSyncChecked = cancelSync.checked;
                stats.cancelSyncUpdated = cancelSync.cancelled;
            }
        } finally {
            await sovosService.logout({ sessionId }).catch(() => {});
        }

        logger.info(
            "[AutoInvoice] Sovos senkron — user=" + userId +
            " fetched=" + stats.fetched +
            " created=" + stats.created +
            " updated=" + stats.updated +
            " earsivRecovered=" + stats.earsivRecovered
        );

        const providerFix = await Invoice.updateMany(
            { userId, provider: { $ne: "sovos" } },
            { $set: { provider: "sovos" } }
        );
        if (providerFix.modifiedCount) {
            logger.info("[AutoInvoice] Sovos provider düzeltmesi — " + providerFix.modifiedCount + " kayıt");
        }

        const parts = [`${stats.created} yeni`, `${stats.updated} güncellenmiş`];
        if (stats.earsivRecovered > 0) {
            parts.push(`${stats.earsivRecovered} e-Arşiv Sovos'tan kurtarıldı`);
        }
        res.json({
            success: true,
            message: parts.join(", ") + ` (Sovos son ${days} gün)`,
            data: stats,
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] syncSovosInvoices hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sovos senkronizasyonu başarısız: " + error.message });
    }
};

/**
 * GET /api/auto-invoice/uninvoiced-orders
 * Faturalanmamış sipariş listesi (test / manuel kesim için)
 */
exports.getUninvoicedOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const config = await AutoInvoiceConfig.findOne({ userId }).lean();

        await releaseStalePendingOrders(userId);

        const filter = buildUninvoicedListFilter(userId, config);
        const autoStart = getUninvoicedStartDate(config);
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const [orders, total, errorCount, pendingCount, autoEligibleCount] = await Promise.all([
            Order.find(filter)
                .select("trackingNumber orderNumber marketplaceName status totalPrice orderDate invoiceStatus customerFirstName customerLastName customerName")
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(filter),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: "error",
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: getUninvoicedListStartDate() },
            }),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: "pending",
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: getUninvoicedListStartDate() },
            }),
            Order.countDocuments(buildUninvoicedOrderFilter(userId, config, { includeError: true, includePending: false })),
        ]);

        const data = orders.map((o) => ({
            id: o._id.toString(),
            orderNumber: o.trackingNumber || o.orderNumber || "",
            marketplaceName: o.marketplaceName || "",
            status: o.status || "",
            totalPrice: o.totalPrice || 0,
            orderDate: o.orderDate,
            invoiceStatus: o.invoiceStatus || "",
            customerName: o.customerName ||
                [o.customerFirstName, o.customerLastName].filter(Boolean).join(" ") ||
                "",
        }));

        res.json({
            success: true,
            data,
            summary: {
                eligible: total,
                autoEligible: autoEligibleCount,
                errorCount,
                pendingCount,
                listStartDate: getUninvoicedListStartDate(),
                autoInvoiceStartDate: autoStart,
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 0,
            },
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getUninvoicedOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sipariş listesi alınamadı" });
    }
};

/**
 * GET /api/auto-invoice/stats
 * Fatura istatistikleri (dashboard için)
 */
exports.getStats = async (req, res) => {
    try {
        const userId = req.user._id;

        await releaseStalePendingOrders(userId);

        const [config, totalInvoices, todayInvoices, totalAmount, byMarketplace, byStatus] = await Promise.all([
            AutoInvoiceConfig.findOne({ userId }).lean(),
            Invoice.countDocuments({ userId }),
            Invoice.countDocuments({
                userId,
                createdAt: { $gte: new Date(new Date().toISOString().split("T")[0]) }
            }),
            Invoice.aggregate([
                { $match: { userId: req.user._id, status: "created" } },
                { $group: { _id: null, total: { $sum: "$totals.payableAmount" } } }
            ]),
            Invoice.aggregate([
                { $match: { userId: req.user._id } },
                { $group: { _id: "$marketplaceName", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Invoice.aggregate([
                { $match: { userId: req.user._id } },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
        ]);

        // Faturasız sipariş sayısı
        const startDateFilter = getUninvoicedStartDate(config);

        const [uninvoicedOrders, errorOrders, pendingOrders] = await Promise.all([
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: { $nin: ["created", "pending", "error"] },
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: startDateFilter },
            }),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: "error",
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: startDateFilter },
            }),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: "pending",
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: startDateFilter },
            }),
        ]);

        // ✅ FIX: Otomatik fatura neden çalışmıyor bilgisi
        // Kullanıcıya "50 faturasız sipariş var" deyip neden faturalanmadığını açıkla
        let autoInvoiceWarning = "";
        if ((uninvoicedOrders > 0 || errorOrders > 0 || pendingOrders > 0) && config) {
            if (!config.enabled) {
                autoInvoiceWarning = "Otomatik fatura devre dışı. Manuel test için 'Faturasız Siparişleri Faturala' kullanabilirsiniz.";
            } else if (config.stats && config.stats.consecutiveErrors >= 5) {
                autoInvoiceWarning = "Ardışık hata limiti aşıldı (" + config.stats.consecutiveErrors + " hata). Hata sayacını sıfırlayın.";
            } else if (!config.supplier || !config.supplier.vkn) {
                autoInvoiceWarning = "Satıcı VKN bilgisi eksik. Ayarlardan firma bilgilerinizi girin.";
            } else if ((config.provider || "qnb") === "sovos") {
                const sc = config.sovosCredentials || {};
                if (!sc.username || !sc.password || !sc.vknTckn) {
                    autoInvoiceWarning = "Sovos web servis bilgileri eksik. Faturalandırma → Sovos bağlantınızı tamamlayın.";
                }
            } else if (!config.qnbCredentials || (!config.qnbCredentials.earsivUsername && !config.qnbCredentials.username)) {
                autoInvoiceWarning = "QNB e-Arşiv kullanıcı bilgileri eksik. Ayarlardan QNB bağlantı bilgilerinizi girin.";
            }
        } else if ((uninvoicedOrders > 0 || errorOrders > 0) && !config) {
            autoInvoiceWarning = "Otomatik fatura ayarları yapılmamış. Lütfen önce ayarları yapın.";
        }

        res.json({
            success: true,
            data: {
                config: config ? {
                    enabled: config.enabled,
                    provider: config.provider,
                    stats: config.stats,
                } : null,
                totalInvoices,
                todayInvoices,
                totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
                uninvoicedOrders,
                errorOrders,
                pendingOrders,
                autoInvoiceStartDate: startDateFilter,
                autoInvoiceWarning,
                byMarketplace: byMarketplace.map(m => ({ marketplace: m._id || "Diğer", count: m.count })),
                byStatus: byStatus.map(s => ({ status: s._id, count: s.count })),
            }
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getStats hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/reset-errors
 * Ardışık hata sayacını sıfırla (kullanıcı tarafından)
 */
exports.resetErrors = async (req, res) => {
    try {
        const userId = req.user._id;
        const config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            return res.status(404).json({ success: false, message: "Ayar bulunamadı." });
        }

        config.stats.consecutiveErrors = 0;
        config.stats.lastError = "";
        await config.save();

        res.json({ success: true, message: "Hata sayacı sıfırlandı." });
    } catch (error) {
        logger.error("[AutoInvoice Controller] resetErrors hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/cleanup-ghost-invoices
 * QNB portalında oluşturulamamış "hayalet" faturaları temizle.
 * Eski numaraVerilsinMi:0 veya kontör hatası nedeniyle DB'de "created" görünen
 * ama QNB'de aslında var olmayan faturaları siler ve siparişleri tekrar faturalanabilir yapar.
 */
exports.cleanupGhostInvoices = async (req, res) => {
    try {
        const userId = req.user._id;

        // Kullanıcının tüm "created" durumundaki faturalarını bul
        const ghostInvoices = await Invoice.find({
            userId,
            status: "created",
            createdBy: "auto"
        }).lean();

        if (ghostInvoices.length === 0) {
            return res.json({ success: true, message: "Temizlenecek fatura bulunamadı.", cleaned: 0 });
        }

        // Her birini sil ve ilgili siparişin invoiceStatus'unu sıfırla
        let cleaned = 0;
        const cleanedList = [];

        for (const inv of ghostInvoices) {
            // Faturayı sil
            await Invoice.deleteOne({ _id: inv._id });

            // Siparişin fatura durumunu sıfırla (tekrar faturalanabilir)
            if (inv.orderId) {
                await Order.updateOne(
                    { _id: inv.orderId },
                    { $unset: { invoiceId: 1, invoiceNumber: 1 }, $set: { invoiceStatus: "" } }
                );
            }

            cleaned++;
            cleanedList.push({
                invoiceNumber: inv.invoiceNumber || "",
                uuid: inv.uuid || "",
                orderNumber: inv.orderNumber || "",
            });
        }

        // Hata sayacını da sıfırla
        await AutoInvoiceConfig.updateOne({ userId }, {
            "stats.consecutiveErrors": 0,
            "stats.lastError": ""
        });

        logger.info("[AutoInvoice] 🧹 Hayalet fatura temizliği — " + cleaned + " fatura silindi, siparişler sıfırlandı — userId=" + userId);

        res.json({
            success: true,
            message: cleaned + " hayalet fatura temizlendi. Siparişler tekrar faturalanabilir durumda.",
            cleaned,
            invoices: cleanedList
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] cleanupGhostInvoices hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  BELGE LİSTESİ (DB — tüm sağlayıcılar)
// ═══════════════════════════════════════════════════════════════════════════

const ensureSovosProviderOnInvoices = async (userId) => {
    const config = await AutoInvoiceConfig.findOne({ userId }).select("provider").lean();
    if (config?.provider !== "sovos") return 0;
    const res = await Invoice.updateMany(
        { userId, provider: { $ne: "sovos" } },
        { $set: { provider: "sovos" } }
    );
    return res.modifiedCount || 0;
};

/**
 * GET /api/auto-invoice/documents
 * Kesilen belgeleri DB'den çeker (QNB, Sovos, tüm sağlayıcılar).
 */
exports.listBillingDocuments = async (req, res) => {
    try {
        const userId = req.user._id;
        await ensureSovosProviderOnInvoices(userId);

        // ── Filtre oluştur ──────────────────────────────────────────────
        const filter = { userId };

        // Tarih filtresi
        // Frontend "20260318" (YYYYMMDD) veya "2026-03-18" (ISO) formatında gönderebilir
        if (req.query.startDate || req.query.endDate) {
            filter.issueDate = {};
            if (req.query.startDate) {
                const sd = req.query.startDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
                const parsed = new Date(sd);
                if (!isNaN(parsed.getTime())) {
                    filter.issueDate.$gte = parsed;
                }
            }
            if (req.query.endDate) {
                const ed = req.query.endDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
                const parsed = new Date(ed);
                if (!isNaN(parsed.getTime())) {
                    parsed.setHours(23, 59, 59, 999);
                    filter.issueDate.$lte = parsed;
                }
            }
            // Her iki tarih de geçersizse filtreyi kaldır
            if (Object.keys(filter.issueDate).length === 0) {
                delete filter.issueDate;
            }
        }

        // Metin araması
        const search = (req.query.search || "").trim();
        if (search) {
            filter.$or = [
                { invoiceNumber: { $regex: search, $options: "i" } },
                { "customer.name": { $regex: search, $options: "i" } },
                { "customer.vkn": { $regex: search, $options: "i" } },
                { orderNumber: { $regex: search, $options: "i" } },
                { uuid: { $regex: search, $options: "i" } },
            ];
        }

        // Profil / belge tipi filtresi (opsiyonel)
        const docType = (req.query.documentType || "").toLowerCase();
        if (docType === "earsiv") {
            filter.profileId = { $regex: /EARSIV/i };
        } else if (docType === "efatura") {
            filter.profileId = { $not: { $regex: /EARSIV|IRSALIYE|İRSALİYE/i } };
        } else if (docType === "despatch" || docType === "irsaliye") {
            filter.profileId = { $regex: /IRSALIYE|İRSALİYE/i };
        } else if (req.query.profileId) {
            filter.profileId = req.query.profileId;
        }

        // ── Sayfalama ───────────────────────────────────────────────────
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        // ── DB'den çek ──────────────────────────────────────────────────
        const [invoices, total, config] = await Promise.all([
            Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Invoice.countDocuments(filter),
            AutoInvoiceConfig.findOne({ userId }).lean(),
        ]);

        const backfillOps = [];
        for (const inv of invoices) {
            if (inv.provider !== "sovos") continue;
            const inferredDirection = inferStoredInvoiceDirection(inv, config);
            if (inv.direction !== inferredDirection && inferredDirection === "incoming") {
                backfillOps.push(Invoice.updateOne({ _id: inv._id }, { $set: { direction: "incoming" } }));
            }
        }
        if (backfillOps.length) {
            Promise.all(backfillOps).catch((err) => {
                logger.warn("[AutoInvoice] direction backfill hatası: " + err.message);
            });
        }

        // ── Normalize et (frontend uyumlu format) ───────────────────────
        const data = invoices.map(inv => {
            const direction = inferStoredInvoiceDirection(inv, config);
            const totals = resolveInvoiceTotals(inv);
            return {
            id: inv.uuid || inv._id.toString(),
            faturaNo: inv.invoiceNumber || "",
            uuid: inv.uuid || "",
            envUuid: inv.envUuid || "",
            aliciAdi: inv.customer ? inv.customer.name : "",
            aliciVkn: inv.customer ? inv.customer.vkn : "",
            saticiAdi: inv.supplier ? inv.supplier.name : "",
            saticiVkn: inv.supplier ? inv.supplier.vkn : "",
            tarih: inv.issueDate || inv.createdAt,
            tutar: totals.payableAmount,
            kdvHaric: totals.lineExtensionAmount,
            kdv: totals.totalTax,
            totals,
            lines: inv.lines || [],
            durum: inv.status || "created",
            statusCode: inv.providerResponse?.resultCode || "",
            profileId: inv.profileId || "EARSIVFATURA",
            direction,
            marketplaceName: inv.marketplaceName || "",
            orderNumber: inv.orderNumber || "",
            custInvId: inv.custInvId || inv.orderNumber || "",
            faturaURL: inv.faturaURL || "",
            createdBy: inv.createdBy || "manual",
            provider: inv.provider || "qnb",
            currency: inv.currency || "TRY",
            sovosCancelled: inv.status === "cancelled" || inv.providerResponse?.sovosCancelled === true,
            _id: inv._id,
        };
        });

        logger.info("[AutoInvoice] DB'den " + total + " fatura bulundu, sayfa " + page + "/" + Math.ceil(total / limit));

        res.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });

    } catch (error) {
        logger.error("[AutoInvoice Controller] listBillingDocuments hatası: " + error.message);
        res.status(500).json({ success: false, message: "Fatura listesi alınamadı" });
    }
};

/** @deprecated qnb-invoices — geriye uyumluluk alias */
exports.getQnbInvoices = exports.listBillingDocuments;

/**
 * GET /api/auto-invoice/documents/:documentId/preview
 * Belge önizlemesi — sağlayıcıya göre QNB veya Sovos
 */
exports.getBillingDocumentPreview = async (req, res) => {
    try {
        const userId = req.user._id;
        const documentId = req.params.documentId || req.params.uuid;

        if (!documentId) {
            return res.status(400).json({ success: false, message: "Belge kimliği gerekli." });
        }

        const dbInvoice = await Invoice.findOne({
            userId,
            $or: [{ uuid: documentId }, { _id: mongoose.Types.ObjectId.isValid(documentId) ? documentId : null }],
        }).lean();
        const uuid = dbInvoice?.uuid || documentId;
        if (dbInvoice?.provider === "sovos") {
            const sovosCreds = await resolveSovosCredentials(userId);
            if (!sovosCreds) {
                return res.status(400).json({
                    success: false,
                    message: "Sovos bağlantı bilgileri eksik. Faturalandırma ayarlarından Sovos bilgilerinizi girin.",
                });
            }
            const streamed = await streamSovosDocumentBuffer(res, dbInvoice, sovosCreds);
            if (streamed) return;
            return;
        }

        // ── Credential çözümleme (ortak helper) ─────────────────────────
        const creds = await resolveEarsivCredentials(userId);
        if (!creds) {
            return res.status(400).json({ success: false, message: "e-Arşiv bağlantı bilgileri eksik. Lütfen Faturalandırma ayarlarından QNB kullanıcı adı ve şifrenizi girin." });
        }

        const loginResult = await qnbService.login({
            username: creds.earsivUsername,
            password: creds.earsivPassword,
            env: creds.env,
            service: "earsiv"
        });

        if (!loginResult.success) {
            return res.status(502).json({ success: false, message: "e-Arşiv oturumu açılamadı (" + creds.earsivUsername + "): " + loginResult.error });
        }

        const sessionId = loginResult.sessionId;
        const vkn = creds.vkn;
        const env = creds.env;

        try {
            // faturaOnizleme ile HTML çek
            const previewResult = await qnbService.previewEArchiveInvoice({
                sessionId,
                vkn,
                uuid,
                env
            });

            // Logout
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

            if (previewResult.success && previewResult.data) {
                let htmlData = previewResult.data;

                // Object ise JSON string'e çevir (debug amaçlı)
                if (typeof htmlData === "object") {
                    // Object içinde belgeIcerigi veya HTML alanı olabilir
                    const possibleHtml = htmlData.belgeIcerigi || htmlData.content || htmlData.htmlContent || htmlData.data;
                    if (typeof possibleHtml === "string" && possibleHtml.length > 0) {
                        // Base64 dene
                        try {
                            const decoded = Buffer.from(possibleHtml, "base64").toString("utf-8");
                            if (decoded.includes("<html") || decoded.includes("<HTML") || decoded.includes("<!DOCTYPE")) {
                                htmlData = decoded;
                            }
                        } catch (e) { /* ignore */ }
                        if (typeof htmlData === "object" && (possibleHtml.includes("<html") || possibleHtml.includes("<HTML"))) {
                            htmlData = possibleHtml;
                        }
                    }
                    // Hâlâ object ise — JSON olarak logla ve hata dön
                    if (typeof htmlData === "object") {
                        logger.warn("[AutoInvoice] Preview data object döndü, HTML değil: " + JSON.stringify(htmlData).substring(0, 300));
                        return res.status(404).json({ success: false, message: "Fatura önizlemesi HTML formatında alınamadı. QNB yanıtı beklenmeyen formatta." });
                    }
                }

                if (typeof htmlData === "string" &&
                    (htmlData.includes("<html") || htmlData.includes("<HTML") || htmlData.includes("<!DOCTYPE"))) {
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.setHeader("Content-Disposition", "inline; filename=\"fatura-" + uuid.substring(0, 8) + ".html\"");
                    return res.send(injectBaseTag(htmlData, env));
                }

                // HTML tag yok ama string — base64 encoded olabilir
                if (typeof htmlData === "string" && htmlData.length > 100) {
                    try {
                        const decoded = Buffer.from(htmlData, "base64").toString("utf-8");
                        if (decoded.includes("<html") || decoded.includes("<HTML") || decoded.includes("<!DOCTYPE")) {
                            res.setHeader("Content-Type", "text/html; charset=utf-8");
                            res.setHeader("Content-Disposition", "inline; filename=\"fatura-" + uuid.substring(0, 8) + ".html\"");
                            logger.info("[AutoInvoice] ✅ Base64 decode ile HTML preview döndürüldü");
                            return res.send(injectBaseTag(decoded, env));
                        }
                    } catch (e) { /* ignore */ }
                }
            }

            return res.status(404).json({ success: false, message: "Fatura önizlemesi alınamadı. QNB'de bu UUID ile fatura bulunamadı olabilir." });

        } catch (err) {
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }
            throw err;
        }

    } catch (error) {
        logger.error("[AutoInvoice Controller] getBillingDocumentPreview hatası: " + error.message);
        res.status(500).json({ success: false, message: "Fatura önizleme hatası" });
    }
};

/** @deprecated qnb-invoices/:uuid/preview — geriye uyumluluk alias */
exports.getQnbInvoicePreview = exports.getBillingDocumentPreview;

/**
 * GET /api/auto-invoice/invoices/:invoiceId/signed-xml
 * Sovos e-Arşiv imzalı XML indir
 */
exports.downloadSignedInvoiceXml = async (req, res) => {
    try {
        const userId = req.user._id;
        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }
        if (invoice.provider !== "sovos") {
            return res.status(400).json({ success: false, message: "İmzalı XML yalnızca Sovos e-Arşiv belgeleri için desteklenir." });
        }
        const profileUpper = String(invoice.profileId || "").toUpperCase();
        if (!profileUpper.includes("EARSIV")) {
            return res.status(400).json({ success: false, message: "İmzalı XML yalnızca e-Arşiv faturalar için desteklenir." });
        }

        const sovosCreds = await resolveSovosCredentials(userId);
        if (!sovosCreds) {
            return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
        }
        const session = await sovosService.restoreSession(sovosCreds);
        if (!session.success) {
            return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
        }

        try {
            const result = await sovosEArchiveService.getSignedInvoice({
                sessionId: session.sessionId,
                vkn: invoice.supplier?.vkn || sovosCreds.vknTckn,
                uuid: invoice.uuid,
                invoiceNumber: invoice.invoiceNumber,
                custInvID: invoice.custInvId || invoice.orderNumber || "",
                orderNumber: invoice.orderNumber || "",
            });
            if (!result.success || !(result.data?.buffer || result.data?.base64)) {
                return res.status(404).json({ success: false, message: result.error || "İmzalı belge alınamadı" });
            }
            const buf = result.data.buffer || Buffer.from(result.data.base64, "base64");
            res.setHeader("Content-Type", result.data.contentType || "application/xml; charset=utf-8");
            res.setHeader("Content-Disposition", "attachment; filename=\"" + (invoice.invoiceNumber || invoice.uuid) + "-signed.xml\"");
            return res.send(buf);
        } finally {
            await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
        }
    } catch (error) {
        logger.error("[AutoInvoice Controller] downloadSignedInvoiceXml hatası: " + error.message);
        res.status(500).json({ success: false, message: "İmzalı belge indirilemedi" });
    }
};

/**
 * POST /api/auto-invoice/invoices/:invoiceId/retrigger
 * Sovos e-Arşiv yeniden tetikleme (retriggerOperation)
 */
exports.retriggerEArchiveInvoice = async (req, res) => {
    try {
        const userId = req.user._id;
        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }
        if (invoice.provider !== "sovos" || !String(invoice.profileId || "").toUpperCase().includes("EARSIV")) {
            return res.status(400).json({ success: false, message: "Yeniden tetikleme yalnızca Sovos e-Arşiv belgeleri için desteklenir." });
        }

        const sovosCreds = await resolveSovosCredentials(userId);
        if (!sovosCreds) {
            return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
        }
        const session = await sovosService.restoreSession(sovosCreds);
        if (!session.success) {
            return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
        }

        try {
            const result = await sovosEArchiveService.retriggerOperation({
                sessionId: session.sessionId,
                vkn: invoice.supplier?.vkn || sovosCreds.vknTckn,
                branch: sovosCreds.branch || "default",
                invoiceId: invoice.invoiceNumber,
                invoiceUUID: invoice.uuid,
                parameters: req.body?.parameters || [],
            });
            if (!result.success) {
                return res.status(400).json({ success: false, message: result.error || "Yeniden tetikleme başarısız" });
            }
            res.json({ success: true, data: result.data });
        } finally {
            await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
        }
    } catch (error) {
        logger.error("[AutoInvoice Controller] retriggerEArchiveInvoice hatası: " + error.message);
        res.status(500).json({ success: false, message: "Yeniden tetikleme hatası" });
    }
};

/**
 * POST /api/auto-invoice/invoices/:invoiceId/detailed-query
 * Sovos e-Arşiv getStatus — billing detay entegrasyonu (v2.3 resmi API)
 */
exports.detailedEArchiveQuery = async (req, res) => {
    try {
        const userId = req.user._id;
        const invoice = await findInvoiceForUser(userId, req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }
        if (invoice.provider !== "sovos" || !String(invoice.profileId || "").toUpperCase().includes("EARSIV")) {
            return res.status(400).json({ success: false, message: "Detaylı sorgu yalnızca Sovos e-Arşiv belgeleri için desteklenir." });
        }

        const sovosCreds = await resolveSovosCredentials(userId);
        if (!sovosCreds) {
            return res.status(400).json({ success: false, message: "Sovos bağlantı bilgileri eksik." });
        }
        const session = await sovosService.restoreSession(sovosCreds);
        if (!session.success) {
            return res.status(502).json({ success: false, message: "Sovos oturumu açılamadı: " + session.error });
        }

        try {
            const statusResult = await sovosEArchiveService.getStatus({
                sessionId: session.sessionId,
                vkn: invoice.supplier?.vkn || sovosCreds.vknTckn,
                uuid: invoice.uuid,
                invoiceNumber: invoice.invoiceNumber,
                custInvID: invoice.custInvId || invoice.orderNumber || "",
                orderNumber: invoice.orderNumber || "",
            });
            if (!statusResult.success) {
                return res.status(400).json({ success: false, message: statusResult.error || "Durum sorgusu başarısız" });
            }
            res.json({
                success: true,
                data: {
                    match: statusResult.data || null,
                    detail: statusResult.data,
                },
            });
        } finally {
            await sovosService.logout({ sessionId: session.sessionId }).catch(() => {});
        }
    } catch (error) {
        logger.error("[AutoInvoice Controller] detailedEArchiveQuery hatası: " + error.message);
        res.status(500).json({ success: false, message: "Detaylı sorgu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  TOPLU FATURALAMA & PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/process-all
 * Faturası olmayan tüm siparişler için toplu fatura kes
 * Body: { limit: 50 } (opsiyonel)
 */
exports.processAllOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const limit = Math.min(50, Math.max(1, parseInt(req.body.limit) || 50));

        logger.info("[AutoInvoice] Toplu faturalama başlatıldı — userId=" + userId + " limit=" + limit);

        const result = await processAllUninvoiced(userId, limit);

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: result,
            message: result.totalEligible === 0
                ? (result.hint || "Faturalanabilir sipariş bulunamadı.")
                : result.invoiced + " fatura kesildi" +
                (result.skipped > 0 ? ", " + result.skipped + " atlandı" : "") +
                (result.errors > 0 ? ", " + result.errors + " hata" : "") +
                " (toplam " + result.totalEligible + " sipariş işlendi)"
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] processAllOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/invoices/:invoiceId/pdf
 * Fatura PDF'ini QNB e-Arşiv'den indir ve döndür
 *
 * ✅ FIX: Boş sayfa sorunu çözüldü — faturaOnizleme (HTML preview) kullanılıyor
 *
 * Credential öncelik sırası:
 *   1. Kullanıcının AutoInvoiceConfig'deki qnbCredentials
 *   2. .env'deki QNB_EARSIV_USERNAME / QNB_EARSIV_PASSWORD
 *   3. TEST_ACCOUNTS (son çare)
 *
 * İndirme stratejisi:
 *   1. faturaOnizleme (HTML preview) — EN GÜVENİLİR
 *   2. faturaURL (QNB'nin döndürdüğü direkt link)
 *   3. faturaZipiAl (ZIP içinde PDF + XML)
 */
exports.getInvoicePdf = async (req, res) => {
    try {
        const userId = req.user._id;
        const { invoiceId } = req.params;

        // ── Faturayı bul — MongoDB _id VEYA UUID ile ────────────────────
        // Frontend'den gelen invoiceId, DB'deki _id olabilir (ObjectId)
        // veya QNB arama sonuçlarından gelen UUID olabilir (GUID formatı)
        let invoice = null;
        const isObjectId = mongoose.Types.ObjectId.isValid(invoiceId);

        if (isObjectId) {
            invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
        }
        // ObjectId değilse veya ObjectId ile bulunamadıysa → UUID ile dene
        if (!invoice) {
            invoice = await Invoice.findOne({ uuid: invoiceId, userId }).lean();
        }

        // DB'de hiç kayıt yok ama invoiceId UUID formatında →
        // Doğrudan QNB'den faturaOnizleme ile çek (DB kaydı olmadan)
        const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
        if (!invoice && isUuidFormat) {
            logger.info("[AutoInvoice] DB'de fatura bulunamadı, UUID ile doğrudan QNB'den çekilecek — uuid=" + invoiceId);

            const creds = await resolveEarsivCredentials(userId);
            if (!creds) {
                return res.status(400).json({ success: false, message: "e-Arşiv bağlantı bilgileri eksik." });
            }

            const loginResult = await qnbService.login({
                username: creds.earsivUsername,
                password: creds.earsivPassword,
                env: creds.env,
                service: "earsiv"
            });
            if (!loginResult.success) {
                return res.status(502).json({ success: false, message: "e-Arşiv oturumu açılamadı: " + loginResult.error });
            }

            try {
                const previewResult = await qnbService.previewEArchiveInvoice({
                    sessionId: loginResult.sessionId,
                    vkn: creds.vkn,
                    uuid: invoiceId,
                    env: creds.env
                });

                try { await qnbService.logout({ sessionId: loginResult.sessionId, env: creds.env, service: "earsiv" }); } catch (e) { /* ignore */ }

                if (previewResult.success && previewResult.data) {
                    const htmlData = previewResult.data;
                    if (typeof htmlData === "string" &&
                        (htmlData.includes("<html") || htmlData.includes("<HTML") || htmlData.includes("<!DOCTYPE"))) {
                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                        res.setHeader("Content-Disposition", "inline; filename=\"fatura-" + invoiceId.substring(0, 8) + ".html\"");
                        logger.info("[AutoInvoice] ✅ UUID ile doğrudan QNB preview döndürüldü");
                        return res.send(injectBaseTag(htmlData, creds.env));
                    }
                }

                return res.status(404).json({ success: false, message: "Fatura önizlemesi QNB'den alınamadı." });
            } catch (err) {
                try { await qnbService.logout({ sessionId: loginResult.sessionId, env: creds.env, service: "earsiv" }); } catch (e) { /* ignore */ }
                throw err;
            }
        }

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        if (invoice.provider === "sovos") {
            const sovosCreds = await resolveSovosCredentials(userId);
            if (!sovosCreds) {
                return res.status(400).json({
                    success: false,
                    message: "Sovos bağlantı bilgileri eksik. Faturalandırma ayarlarından Sovos bilgilerinizi girin.",
                });
            }
            const streamed = await streamSovosDocumentBuffer(res, invoice, sovosCreds);
            if (streamed) {
                logger.info("[AutoInvoice] ✅ Sovos belge döndürüldü — " + (invoice.invoiceNumber || invoice.uuid));
            }
            return;
        }

        if (!invoice.uuid && !invoice.invoiceNumber) {
            return res.status(400).json({ success: false, message: "Fatura UUID veya numarası eksik." });
        }

        // ── Credential çözümleme (ortak helper) ─────────────────────────
        const creds = await resolveEarsivCredentials(userId);
        if (!creds) {
            return res.status(400).json({
                success: false,
                message: "e-Arşiv bağlantı bilgileri eksik. Lütfen Faturalandırma ayarlarından QNB kullanıcı adı ve şifrenizi girin."
            });
        }

        // ── QNB Login ───────────────────────────────────────────────────
        const loginResult = await qnbService.login({
            username: creds.earsivUsername,
            password: creds.earsivPassword,
            env: creds.env,
            service: "earsiv"
        });

        if (!loginResult.success) {
            return res.status(502).json({ success: false, message: "e-Arşiv oturumu açılamadı (" + creds.earsivUsername + "): " + loginResult.error });
        }

        const sessionId = loginResult.sessionId;
        const vkn = invoice.supplier?.vkn || creds.vkn;
        const env = creds.env;

        try {
            // ── Strateji 1: faturaOnizleme (HTML Preview) — EN GÜVENİLİR ──
            // QNB'nin faturaOnizleme metodu mevcut faturayı HTML olarak döndürür
            logger.info("[AutoInvoice] faturaOnizleme deneniyor — uuid=" + invoice.uuid);
            const previewResult = await qnbService.previewEArchiveInvoice({
                sessionId,
                vkn,
                uuid: invoice.uuid,
                faturaNo: invoice.invoiceNumber,
                env
            });

            if (previewResult.success && previewResult.data) {
                const htmlData = previewResult.data;

                // HTML string ise doğrudan döndür
                if (typeof htmlData === "string" &&
                    (htmlData.includes("<html") || htmlData.includes("<HTML") || htmlData.includes("<!DOCTYPE"))) {

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                    logger.info("[AutoInvoice] ✅ HTML preview başarıyla döndürüldü");
                    return res.send(injectBaseTag(htmlData, env));
                }
            }

            // ── Strateji 2: faturaURL ile doğrudan HTML çek ──
            const faturaURL = invoice.faturaURL || "";
            if (faturaURL) {
                try {
                    logger.info("[AutoInvoice] faturaURL ile HTML çekiliyor — " + faturaURL);
                    const axios = require("axios");
                    const htmlResp = await axios.get(faturaURL, { timeout: 15000, maxRedirects: 5 });

                    if (htmlResp.status === 200 && typeof htmlResp.data === "string" &&
                        (htmlResp.data.includes("<html") || htmlResp.data.includes("<HTML") || htmlResp.data.includes("<!DOCTYPE"))) {

                        // Logout
                        try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                        res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                        logger.info("[AutoInvoice] ✅ faturaURL başarıyla döndürüldü");
                        return res.send(injectBaseTag(htmlResp.data, env));
                    }
                } catch (urlErr) {
                    logger.warn("[AutoInvoice] faturaURL erişim hatası: " + (urlErr.response?.status || urlErr.message));
                }
            }

            // ── Strateji 3: faturaZipiAl ile ZIP indir ──────────────────
            logger.info("[AutoInvoice] faturaZipiAl deneniyor — uuid=" + invoice.uuid);
            const zipResult = await qnbService.downloadEArchiveZip({
                sessionId,
                uuid: invoice.uuid,
                env
            });

            if (zipResult.success && zipResult.data) {
                const zipData = zipResult.data;

                // Doğrudan base64 string ise
                if (typeof zipData === "string") {
                    const buffer = Buffer.from(zipData, "base64");

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader("Content-Disposition", "attachment; filename=\"" + (invoice.invoiceNumber || "fatura") + ".zip\"");
                    logger.info("[AutoInvoice] ✅ ZIP başarıyla döndürüldü");
                    return res.send(buffer);
                }

                // Object ise (zipIcerigi / belgeIcerigi alanı olabilir)
                const zipContent = zipData.zipIcerigi || zipData.belgeIcerigi || zipData.content;
                if (typeof zipContent === "string") {
                    const buffer = Buffer.from(zipContent, "base64");

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader("Content-Disposition", "attachment; filename=\"" + (invoice.invoiceNumber || "fatura") + ".zip\"");
                    logger.info("[AutoInvoice] ✅ ZIP başarıyla döndürüldü");
                    return res.send(buffer);
                }
            }

            // ── Strateji 4: faturaURL'yi UUID'den oluştur (fallback) ────
            if (!faturaURL && invoice.uuid && vkn) {
                const envPrefix = env === "production" ? "earsiv" : "earsivtest";
                const generatedURL = "https://" + envPrefix + ".qnbesolutions.com.tr/earsiv/goruntule.jsp?vkn=" + vkn + "&uuid=" + invoice.uuid;
                try {
                    logger.info("[AutoInvoice] Oluşturulan faturaURL deneniyor — " + generatedURL);
                    const axios = require("axios");
                    const htmlResp = await axios.get(generatedURL, { timeout: 15000, maxRedirects: 5 });

                    if (htmlResp.status === 200 && typeof htmlResp.data === "string" &&
                        (htmlResp.data.includes("<html") || htmlResp.data.includes("<HTML") || htmlResp.data.includes("<!DOCTYPE"))) {

                        // Logout
                        try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                        // faturaURL'yi kaydet (gelecek sefere hızlı erişim)
                        try {
                            await Invoice.updateOne({ _id: invoiceId }, { faturaURL: generatedURL });
                        } catch (saveErr) {
                            logger.warn("[AutoInvoice] faturaURL kaydedilemedi: " + saveErr.message);
                        }

                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                        res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                        logger.info("[AutoInvoice] ✅ Oluşturulan URL başarıyla döndürüldü");
                        return res.send(injectBaseTag(htmlResp.data, env));
                    }
                } catch (urlErr) {
                    logger.warn("[AutoInvoice] Oluşturulan faturaURL erişim hatası: " + (urlErr.response?.status || urlErr.message));
                }
            }

            // Logout
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

            // Tüm stratejiler başarısız
            logger.error("[AutoInvoice] ❌ Tüm indirme stratejileri başarısız oldu");
            return res.status(404).json({
                success: false,
                message: "Fatura görüntülenemedi. Lütfen QNB portalını kontrol edin."
            });

        } catch (downloadErr) {
            // Logout dene
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }
            throw downloadErr;
        }

    } catch (error) {
        logger.error("[AutoInvoice Controller] getInvoicePdf hatası: " + error.message);
        res.status(500).json({ success: false, message: "PDF indirme hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAZARYERI BAZLI İŞLEMLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/toggle-marketplace
 * Belirli bir pazaryerini otomatik fatura için aç/kapat
 * Body: { marketplace: "Trendyol" }
 */
exports.toggleMarketplace = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplace } = req.body;

        if (!marketplace) {
            return res.status(400).json({ success: false, message: "Pazaryeri adı gerekli." });
        }

        const normalized = normalizeMarketplaceName(marketplace);
        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            config = new AutoInvoiceConfig({ userId, enabledMarketplaces: [] });
        }

        const enabledList = config.enabledMarketplaces || [];
        const normalizedList = enabledList.map(m => normalizeMarketplaceName(m));
        const idx = normalizedList.indexOf(normalized);

        if (idx >= 0) {
            // Zaten aktif → kaldır
            enabledList.splice(idx, 1);
        } else {
            // Aktif değil → ekle
            enabledList.push(normalized);
        }

        config.enabledMarketplaces = enabledList;
        await config.save();

        const isEnabled = enabledList.map(m => normalizeMarketplaceName(m)).includes(normalized);

        logger.info("[AutoInvoice] Marketplace toggle — " + normalized + " " + (isEnabled ? "aktif" : "devre dışı") + " — userId=" + userId);
        res.json({
            success: true,
            marketplace: normalized,
            enabled: isEnabled,
            enabledMarketplaces: config.enabledMarketplaces,
            message: normalized + " otomatik fatura " + (isEnabled ? "aktif edildi." : "devre dışı bırakıldı.")
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] toggleMarketplace hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * PUT /api/auto-invoice/marketplace-settings
 * Belirli bir pazaryeri için özel ayarları kaydet
 * Body: { marketplace: "Trendyol", vatRate: 20, note: "...", pricesIncludeVat: true, invoiceSeriesCode: "TY" }
 */
exports.saveMarketplaceSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplace, vatRate, note, pricesIncludeVat, invoiceSeriesCode } = req.body;

        if (!marketplace) {
            return res.status(400).json({ success: false, message: "Pazaryeri adı gerekli." });
        }

        const normalized = normalizeMarketplaceName(marketplace);
        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            config = new AutoInvoiceConfig({ userId });
        }

        if (!config.marketplaceSettings) {
            config.marketplaceSettings = new Map();
        }

        const settings = {};
        if (vatRate !== undefined) settings.vatRate = Number(vatRate);
        if (note !== undefined) settings.note = note;
        if (pricesIncludeVat !== undefined) settings.pricesIncludeVat = pricesIncludeVat;
        if (invoiceSeriesCode !== undefined) settings.invoiceSeriesCode = invoiceSeriesCode;

        config.marketplaceSettings.set(normalized, settings);
        await config.save();

        logger.info("[AutoInvoice] Marketplace settings güncellendi — " + normalized + " — userId=" + userId);
        res.json({
            success: true,
            marketplace: normalized,
            settings: settings,
            message: normalized + " fatura ayarları kaydedildi."
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] saveMarketplaceSettings hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/marketplace-stats
 * Pazaryeri bazlı fatura istatistikleri
 * Her pazaryeri için: toplam sipariş, faturalı, faturasız, hata sayısı
 */
exports.getMarketplaceStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Son 30 günlük siparişler
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Pazaryeri bazlı sipariş istatistikleri
        const [orderStats, invoiceStats, config] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        user: userId,
                        createdAt: { $gte: thirtyDaysAgo },
                        isCancelled: false,
                        isReturned: false,
                    }
                },
                {
                    $group: {
                        _id: "$marketplaceName",
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: "$totalPrice" },
                        invoicedCount: {
                            $sum: { $cond: [{ $ifNull: ["$invoiceId", false] }, 1, 0] }
                        },
                        uninvoicedCount: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: [{ $ifNull: ["$invoiceId", null] }, null] },
                                            { $ne: ["$invoiceStatus", "created"] },
                                            { $gt: ["$totalPrice", 0] }
                                        ]
                                    },
                                    1, 0
                                ]
                            }
                        },
                        errorCount: {
                            $sum: { $cond: [{ $eq: ["$invoiceStatus", "error"] }, 1, 0] }
                        },
                        pendingCount: {
                            $sum: { $cond: [{ $eq: ["$invoiceStatus", "pending"] }, 1, 0] }
                        },
                    }
                },
                { $sort: { totalOrders: -1 } }
            ]),
            Invoice.aggregate([
                {
                    $match: {
                        userId: userId,
                        createdAt: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: "$marketplaceName",
                        totalInvoices: { $sum: 1 },
                        totalAmount: { $sum: "$totals.payableAmount" },
                        totalTax: { $sum: "$totals.totalTax" },
                    }
                }
            ]),
            AutoInvoiceConfig.findOne({ userId }).lean()
        ]);

        // İstatistikleri birleştir
        const enabledMps = (config?.enabledMarketplaces || []).map(m => normalizeMarketplaceName(m));
        const mpSettingsMap = config?.marketplaceSettings || {};

        const invoiceMap = {};
        invoiceStats.forEach(s => {
            invoiceMap[s._id || "Diğer"] = s;
        });

        const marketplaces = orderStats.map(os => {
            const mpName = os._id || "Diğer";
            const normalized = normalizeMarketplaceName(mpName);
            const invStat = invoiceMap[mpName] || {};
            const isEnabled = enabledMps.length === 0 || enabledMps.includes(normalized);
            const mpSettings = mpSettingsMap instanceof Map
                ? mpSettingsMap.get(normalized)
                : (mpSettingsMap[normalized] || null);

            return {
                marketplace: normalized,
                enabled: isEnabled,
                totalOrders: os.totalOrders,
                totalRevenue: os.totalRevenue,
                invoicedCount: os.invoicedCount,
                uninvoicedCount: os.uninvoicedCount,
                errorCount: os.errorCount,
                pendingCount: os.pendingCount,
                totalInvoices: invStat.totalInvoices || 0,
                totalInvoiceAmount: invStat.totalAmount || 0,
                totalTax: invStat.totalTax || 0,
                invoiceRate: os.totalOrders > 0
                    ? Math.round((os.invoicedCount / os.totalOrders) * 100)
                    : 0,
                settings: mpSettings || null,
                supportedStatuses: MARKETPLACE_STATUS_MAP[normalized] || [],
            };
        });

        // Desteklenen tüm pazaryerlerini listele (sipariş olmasa bile)
        const ALL_MARKETPLACES = [
            "Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti",
            "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA",
        ];
        const existingMps = marketplaces.map(m => m.marketplace);
        ALL_MARKETPLACES.forEach(mp => {
            if (!existingMps.includes(mp)) {
                const isEnabled = enabledMps.length === 0 || enabledMps.includes(mp);
                marketplaces.push({
                    marketplace: mp,
                    enabled: isEnabled,
                    totalOrders: 0,
                    totalRevenue: 0,
                    invoicedCount: 0,
                    uninvoicedCount: 0,
                    errorCount: 0,
                    pendingCount: 0,
                    totalInvoices: 0,
                    totalInvoiceAmount: 0,
                    totalTax: 0,
                    invoiceRate: 0,
                    settings: null,
                    supportedStatuses: MARKETPLACE_STATUS_MAP[mp] || [],
                });
            }
        });

        res.json({
            success: true,
            data: {
                marketplaces,
                config: config ? {
                    enabled: config.enabled,
                    provider: config.provider,
                    enabledMarketplaces: config.enabledMarketplaces || [],
                    stats: config.stats,
                } : null,
            }
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getMarketplaceStats hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

const E_ARCHIVE_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const E_ARCHIVE_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

/**
 * POST /api/auto-invoice/e-archive-visuals/upload
 * e-Arşiv logo veya imza görseli yükle (multipart)
 */
exports.uploadEArchiveVisual = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Dosya seçilmedi." });
        }

        if (!E_ARCHIVE_IMAGE_MIME.has(String(req.file.mimetype || "").toLowerCase())) {
            return res.status(400).json({ success: false, message: "Yalnızca PNG, JPG, WEBP veya GIF yüklenebilir." });
        }

        const userId = req.user._id;
        const assetType = req.body.assetType === "signature" ? "signature" : "logo";
        const ext = path.extname(req.file.originalname || "").toLowerCase();
        const safeExt = E_ARCHIVE_IMAGE_EXT.has(ext) ? ext : ".png";

        const baseDir = path.join(__dirname, "..", "uploads", "e-archive-visuals", String(userId));
        fs.mkdirSync(baseDir, { recursive: true });

        const fileName = `${assetType}-${Date.now()}${safeExt}`;
        fs.writeFileSync(path.join(baseDir, fileName), req.file.buffer);

        const url = `/uploads/e-archive-visuals/${userId}/${fileName}`;
        res.json({
            success: true,
            data: { url, assetType, fileName },
            message: assetType === "signature" ? "İmza görseli yüklendi." : "Logo yüklendi.",
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] uploadEArchiveVisual hatası: " + error.message);
        res.status(500).json({ success: false, message: "Görsel yüklenemedi." });
    }
};
