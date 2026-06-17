const crypto = require("crypto");
const path = require("path");
const axios = require("axios");
const soap = require("soap");
const logger = require("../config/logger");
const { buildInvoiceXml, formatGibInvoiceId } = require("../utils/ublBuilder");
const { compressXmlToZip } = require("../utils/sovosUblZip");
const { extractSoapFault, parseSovosProcessingFault } = require("../utils/sovosSoapFault");
const { getSovosTlsOptions, createSovosHttpsAgent } = require("../utils/sovosTls");
const { applySovosSoapSecurity, resolveAuthModes, normalizeEarsivAuthMode } = require("../utils/sovosSoapAuth");
const {
    verifyEArchiveCredentials,
    buildBasicAuthHeader,
    postSendInvoice,
    postCancelInvoice,
    postGenerateInvID,
    postGetStatus,
    postGetSignedInvoice,
    postGetInvoiceDocument,
} = require("../utils/sovosHttpSoap");
const sovosEInvoiceService = require("./sovosEInvoiceService");
const { mapSovosEArchiveStatus } = require("../constants/sovosEArchiveStatuses");
const { checkListCooldown, markListCall, clampDateRange, MAX_LIST_DAYS, checkPartialListCooldown, markPartialListCall } = require("../utils/sovosApiGuard");
const { toSovosDateTime } = require("../utils/sovosDateTime");
const { normalizeSovosBinaryData, sniffContentType } = require("../utils/sovosBinaryData");
const {
    normalizeSovosEArchiveInvoiceNumber,
    pickBestSovosInvoiceNumber,
    isCorruptedSovosInvoiceNumber,
} = require("../utils/sovosEArchiveInvoiceNumber");

/**
 * SOVOS BULUT e-ARŞİV WS API v2.3 — LysiaETIC
 * ClientEArsivServicesPort — earsivwstest / earsivws.fitbulut.com
 */

const LOCAL_WSDL = path.join(__dirname, "../assets/sovos-wsdl/EArchiveInvoiceService.wsdl");

const WSDL = {
    test: process.env.SOVOS_EARSIV_TEST_WSDL || LOCAL_WSDL,
    production:
        process.env.SOVOS_EARSIV_PROD_WSDL ||
        "https://earsivws.fitbulut.com/ClientEArsivServicesPort.svc?wsdl",
};

const ENDPOINT = {
    test: process.env.SOVOS_EARSIV_TEST_URL || "https://earsivwstest.fitbulut.com/ClientEArsivServicesPort.svc",
    production: process.env.SOVOS_EARSIV_PROD_URL || "https://earsivws.fitbulut.com/ClientEArsivServicesPort.svc",
};

const getWsdlUrl = (env) => WSDL[env] || WSDL.test;
const getEndpoint = (env) => ENDPOINT[env] || ENDPOINT.test;
const clean = (s) => String(s || "").trim();
const rawPass = (s) => (s == null ? "" : String(s));

const md5Hex = (buf) => crypto.createHash("md5").update(buf).digest("hex");

const toQueryDate = (value) => {
    if (!value) return "";
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const digits = s.replace(/\D/g, "");
    if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }
    return s.slice(0, 10);
};

/** Resmi cancelDate: xs:date — Türkiye yerel gün (YYYY-MM-DD) */
const toTurkeyCancelDate = (value) => {
    const parsed = value ? new Date(value) : new Date();
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(base);
};

const formatCancelAmount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Number(n.toFixed(2));
};

/** Sovos cancelInvoice totalAmount = vergiler hariç toplam (LegalMonetaryTotal / LineExtensionAmount) */
const extractCancelAmountFromUbl = (xmlText) => {
    const text = String(xmlText || "");
    if (!text) return null;

    const legalMatch = text.match(/<(?:[\w-]+:)?LegalMonetaryTotal[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?LegalMonetaryTotal>/i);
    const block = legalMatch ? legalMatch[1] : text;

    const taxExclusive = block.match(/<(?:[\w-]+:)?TaxExclusiveAmount[^>]*>([^<]+)</i);
    if (taxExclusive) {
        const n = Number(String(taxExclusive[1]).trim());
        if (Number.isFinite(n) && n > 0) return formatCancelAmount(n);
    }

    const lineExt = block.match(/<(?:[\w-]+:)?LineExtensionAmount[^>]*>([^<]+)</i);
    if (lineExt) {
        const n = Number(String(lineExt[1]).trim());
        if (Number.isFinite(n) && n > 0) return formatCancelAmount(n);
    }

    return null;
};

const extractInvoiceIdFromUbl = (xmlText) => {
    const text = String(xmlText || "");
    const invoiceId =
        text.match(/<(?:[\w-]+:)?Invoice[\s>][\s\S]*?<(?:[\w-]+:)?ID[^>]*>([^<]+)</i)?.[1]
        || text.match(/<(?:[\w-]+:)?ID[^>]*>([^<]+)</i)?.[1];
    return invoiceId ? clean(invoiceId) : "";
};

/** @deprecated cancel için PayableAmount kullanılmamalı — extractCancelAmountFromUbl */
const extractPayableAmountFromUbl = (xmlText) => {
    const text = String(xmlText || "");
    const payable = text.match(/<(?:[\w-]+:)?PayableAmount[^>]*>([^<]+)</i);
    if (payable) {
        const n = Number(String(payable[1]).trim());
        if (Number.isFinite(n) && n > 0) return formatCancelAmount(n);
    }
    const taxInclusive = text.match(/<(?:[\w-]+:)?TaxInclusiveAmount[^>]*>([^<]+)</i);
    if (taxInclusive) {
        const n = Number(String(taxInclusive[1]).trim());
        if (Number.isFinite(n) && n > 0) return formatCancelAmount(n);
    }
    return null;
};

const parseCancelInvoiceBody = (result) => {
    const body = result?.invoiceCancellationServiceResponseType ?? result ?? {};
    const cancelBlock = body?.invoiceCancellation ?? body?.InvoiceCancellation ?? {};
    const message = String(cancelBlock?.message || cancelBlock?.Message || body?.Result?.StatusDescription || "").trim();
    const codeRaw = cancelBlock?.code ?? cancelBlock?.Code;
    const code = codeRaw == null || codeRaw === "" ? null : Number(codeRaw);
    const resultOk = isSuccessResult(body?.Result);
    const ok = resultOk && (code === 1 || /basari|başarı|success/i.test(message));
    return {
        ok,
        message: message || (ok ? "Fatura iptal bilgileri başarı ile kaydedilmiştir." : "e-Arşiv iptal başarısız"),
        code,
        raw: body,
    };
};

const createSoapClient = async (session, authMode) => {
    const env = session.env === "production" ? "production" : "test";
    const tls = getSovosTlsOptions();
    const httpsAgent = createSovosHttpsAgent();
    const client = await soap.createClientAsync(getWsdlUrl(env), {
        wsdl_options: { ...tls, httpsAgent },
        endpoint: getEndpoint(env),
        request: axios.create({ httpsAgent, timeout: tls.timeout || 30000 }),
    });

    applySovosSoapSecurity(
        client,
        session.username,
        session.password,
        normalizeEarsivAuthMode(authMode || session.authMode || resolveAuthModes()[0])
    );
    client.addHttpHeader("Authorization", buildBasicAuthHeader(session.username, session.password));
    return client;
};

const unwrapSoapArgs = (args) => {
    if (!args || typeof args !== "object" || Array.isArray(args)) return args;
    const keys = Object.keys(args);
    if (keys.length !== 1) return args;
    const key = keys[0];
    const inner = args[key];
    if (!inner || typeof inner !== "object" || Array.isArray(inner)) return args;
    // invoiceCancellationServiceRequestType — tam sarmalayıcı korunmalı (resmi WSDL)
    if (/ServiceRequestType$/i.test(key)) return args;
    if (/Request(Type)?$/i.test(key) || key === "parameter") return inner;
    return args;
};

const invokeSoapMethod = async (client, method, args) => {
    const fn = client[method + "Async"];
    if (typeof fn !== "function") {
        throw new Error("SOAP metodu bulunamadı: " + method);
    }
    const [result] = await fn(unwrapSoapArgs(args));
    return result;
};

const soapCall = async (session, method, args) => {
    const client = await createSoapClient(session);
    return invokeSoapMethod(client, method, args);
};

const extractFault = extractSoapFault;

/** e-Arşiv WS kimlik doğrulama — HTTP Basic (resmi Fitbulut örneği) */
const verifyCredentials = async ({
    username,
    password,
    vknTckn,
    env = "test",
    branch = "default",
    identifier,
    authMode,
}) => {
    const session = {
        username: clean(username),
        password: rawPass(password),
        vknTckn: clean(vknTckn),
        env: env === "production" ? "production" : "test",
        authMode: authMode || "basic",
    };

    if (!session.username || !session.password || !session.vknTckn) {
        throw new Error("Web servis kullanıcı adı, şifre ve VKN/TCKN zorunludur");
    }

    const result = await verifyEArchiveCredentials({
        endpoint: getEndpoint(session.env),
        username: session.username,
        password: session.password,
        vknTckn: session.vknTckn,
        branch: clean(branch) || "default",
        identifier: clean(identifier || vknTckn),
    });

    return {
        success: true,
        env: session.env,
        authMode: result.authMode || "basic",
    };
};

const unwrap = (result, key) => result?.[key] ?? result ?? {};

const isSuccessResult = (resultBlock) => {
    const r = resultBlock?.Result ?? resultBlock?.result ?? resultBlock;
    if (typeof r === "string") {
        return r.toUpperCase() === "SUCCESS";
    }
    const statusCode = r?.StatusCode ?? r?.statusCode;
    if (statusCode != null && statusCode !== "") {
        const n = Number(statusCode);
        if (n === 10 || n === 0) return true;
    }
    const val = String(r?.Result || r?.result || "").toUpperCase();
    return val === "SUCCESS";
};

const formatGenerateInvIdError = (body, branch) => {
    const desc = body?.Result?.StatusDescription || body?.Result?.statusDescription || "Fatura numarası üretilemedi";
    const code = body?.Result?.StatusCode ?? body?.Result?.statusCode;
    let msg = desc;
    if (code != null && code !== "") msg += " (StatusCode=" + code + ")";
    if (String(desc).toLowerCase().includes("parametre")) {
        msg += ". Sovos portalındaki e-Arşiv şube (Branch) adını kontrol edin (gönderilen: " + (branch || "default") + "). Cust_inv_id sipariş numarası olmalıdır.";
    } else if (Number(code) === 60 || /yetkilendirme/i.test(String(desc))) {
        msg += ". WS kullanıcısının generateInvID yetkisi veya şube tanımı eksik olabilir (Branch: " + (branch || "default") + ").";
        msg += " Sistem client-side fatura numarası ile sendInvoice deneyecek (resmi Foriba örneği akışı).";
    }
    return msg;
};

/** GİB/Sovos fatura no doğrulama — ublBuilder.formatGibInvoiceId kullanılır */
const isGenerateInvIdAuthError = (parsed) => {
    const code = Number(parsed?.statusCode);
    if (code === 60) return true;
    const desc = String(parsed?.error || parsed?.raw?.Result?.StatusDescription || "");
    return /yetkilendirme|illegalaccess|unauthorized/i.test(desc);
};

const shouldSkipGenerateInvId = () =>
    String(process.env.SOVOS_EARSIV_SKIP_GENERATE_INVID || "").toLowerCase() === "true";

/** Sovos/Foriba e-Arşiv: nihai tüketici receiverID = 2222222222 (10 hane) */
const normalizeEArchiveReceiverId = (vkn) => {
    const v = clean(vkn).replace(/\D/g, "");
    if (!v || v === "11111111111" || v === "22222222222" || v === "12345678901") {
        return "2222222222";
    }
    return v;
};

const parseGenerateInvId = (result) => {
    const body = unwrap(result, "invIdGenerationResponse");
    const status = body?.Result?.StatusCode || body?.Result?.statusCode || body?.result?.StatusCode;
    const invoiceNumber = body?.Invoice_ID || body?.invoice_ID || "";
    const uuid = body?.UUID || body?.uuid || "";
    const link = body?.Link || body?.link || "";
    const ok = isSuccessResult(body?.Result) || Boolean(invoiceNumber && uuid);
    return {
        success: ok,
        invoiceNumber,
        uuid,
        link,
        statusCode: status,
        raw: body,
        error: ok ? undefined : formatGenerateInvIdError(body, null),
    };
};

const normalizeDetailedInvoiceList = (result) => {
    const body = unwrap(result, "detailedInvoiceQueryResponse");
    const resultFlag = String(body?.Result || body?.result || "").toUpperCase();
    if (resultFlag && resultFlag !== "SUCCESS") {
        return {
            success: false,
            error: body?.ErrorDetail || body?.errorDetail || "e-Arşiv sorgusu başarısız",
            raw: body,
        };
    }

    let invoices = body?.invoice ?? body?.Invoice;
    if (!invoices) return { success: true, data: [] };
    if (!Array.isArray(invoices)) invoices = [invoices];

    const documents = invoices.map((item) => ({
        id: item.invoiceUUID || item.invoiceID,
        uuid: item.invoiceUUID || "",
        number: item.invoiceID || "",
        custInvId: item.customerInvoiceID || "",
        date: item.invoiceDate || "",
        total: Number(item.invoiceAmount || 0),
        amount: Number(item.invoiceAmount || 0),
        status: "sent",
        type: "e-arsiv",
        raw: item,
    }));

    return { success: true, data: documents };
};

const parseSendInvoice = (result) => {
    const body = unwrap(result, "sendInvoiceResponseType");
    const ok = isSuccessResult(body?.Result);
    const preCheck = body?.preCheckSuccessResults?.preCheckSuccess
        || body?.preCheckSuccessResults?.PreCheckSuccess;
    const first = Array.isArray(preCheck) ? preCheck[0] : preCheck;
    return {
        success: ok || Boolean(first),
        detail: body?.Detail || body?.detail || "",
        preCheck: first,
        raw: body,
        error: ok ? undefined : (body?.Detail || "e-Arşiv gönderimi başarısız"),
    };
};

// ─── Fatura numarası üret (generateInvID) ───────────────────────────────────
const generateInvoiceId = async ({
    sessionId,
    identifier,
    branch = "default",
    custInvId = "",
    issueDate,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı veya süresi doldu" };

    const issue = issueDate || new Date().toISOString().split("T")[0];
    const resolvedBranch = clean(branch) || clean(session.branch) || "default";
    const custId = clean(custInvId) || "LYSIA-" + Date.now();

    try {
        const httpResult = await postGenerateInvID({
            endpoint: getEndpoint(session.env),
            username: session.username,
            password: session.password,
            payload: {
                identifier: clean(session.vknTckn),
                vknTckn: session.vknTckn,
                branch: resolvedBranch,
                custInvId: custId,
                issueDate: issue,
            },
        });
        const parsed = {
            success: httpResult.success,
            invoiceNumber: httpResult.invoiceNumber,
            uuid: httpResult.uuid,
            link: httpResult.link,
            statusCode: httpResult.statusCode,
            raw: httpResult.raw,
            error: httpResult.error,
        };
        if (!parsed.success) {
            parsed.error = formatGenerateInvIdError(parsed.raw, resolvedBranch) || parsed.error;
            logger.warn(
                "[Sovos e-Arşiv] generateInvID başarısız — Identifier=" + clean(session.vknTckn) +
                " Branch=" + resolvedBranch + " Cust_inv_id=" + custId +
                " StatusCode=" + (parsed.statusCode ?? "?")
            );
        }
        return parsed;
    } catch (error) {
        const fault = extractFault(error);
        logger.error("[Sovos e-Arşiv] generateInvID hatası:", fault);
        if (/bilinmeyen sovos_auth_mode|unauthorized|yetkilendirme|s:5000|s:5010/i.test(fault)) {
            return { success: false, statusCode: 60, error: fault };
        }
        return { success: false, error: fault };
    }
};

// ─── e-Arşiv fatura gönder ───────────────────────────────────────────────────
const sendInvoice = async ({
    sessionId,
    senderId,
    receiverId,
    fileName,
    zipBuffer,
    branch = "default",
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const binaryData = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
    const resolvedBranch = clean(branch) || clean(session.branch) || "default";
    const sender = clean(senderId) || clean(session.vknTckn);
    const receiver = normalizeEArchiveReceiverId(receiverId);

    if (!sender) {
        return { success: false, error: "Gönderici VKN/TCKN boş — Sovos oturumunu yenileyin" };
    }

    try {
        logger.info(
            "[Sovos e-Arşiv] sendInvoice — sender=" + sender +
            " receiver=" + receiver + " branch=" + resolvedBranch +
            " fileName=" + clean(fileName)
        );
        const httpResult = await postSendInvoice({
            endpoint: getEndpoint(session.env),
            username: session.username,
            password: session.password,
            payload: {
                senderID: sender,
                receiverID: receiver,
                fileName: clean(fileName),
                zipBuffer: binaryData,
                branch: resolvedBranch,
            },
        });
        if (!httpResult.success) {
            const shortErr = extractFault({ body: httpResult.raw, message: httpResult.error });
            const snippet = String(shortErr || httpResult.error || "").slice(0, 500);
            logger.warn("[Sovos e-Arşiv] sendInvoice HTTP başarısız — " + snippet);
            return { success: false, error: shortErr || httpResult.error || "sendInvoice başarısız" };
        }

        return {
            success: true,
            detail: httpResult.detail || "",
            preCheck: httpResult.preCheck,
            invoiceNumber: httpResult.invoiceNumber || "",
            uuid: httpResult.uuid || "",
            raw: httpResult.raw,
        };
    } catch (error) {
        const fault = extractFault(error);
        logger.error("[Sovos e-Arşiv] sendInvoice hatası:", fault);
        return { success: false, error: fault };
    }
};

/**
 * Form verilerinden e-Arşiv fatura oluştur ve gönder
 */
const createEArchiveFromForm = async ({ sessionId, vkn, invoiceData, branch = "default" }) => {
    try {
        const session = await sovosEInvoiceService.ensureSession(sessionId);
        if (!session) return { success: false, error: "Oturum bulunamadı" };

        const authorizedVkn = clean(session.vknTckn);
        if (!authorizedVkn) {
            return { success: false, error: "Sovos oturumunda VKN/TCKN tanımlı değil" };
        }

        const requestedVkn = clean(vkn || invoiceData?.supplier?.vkn);
        if (requestedVkn && requestedVkn !== authorizedVkn) {
            logger.warn(
                "[Sovos e-Arşiv] İstenen VKN/TCKN (" + requestedVkn +
                ") Sovos yetkili VKN/TCKN (" + authorizedVkn + ") ile uyuşmuyor — WS ve UBL için yetkili değer kullanılacak"
            );
        }

        const senderVkn = authorizedVkn;
        const resolvedBranch = clean(branch) || clean(session.branch) || "default";
        const issueDate = invoiceData?.issueDate || new Date().toISOString().split("T")[0];
        const customerVkn = clean(invoiceData?.customer?.vkn || "11111111111");
        const custInvId = clean(
            invoiceData?.custInvId ||
            invoiceData?.orderNumber ||
            invoiceData?.trackingNumber ||
            ""
        );
        const supplier = { ...(invoiceData?.supplier || {}), vkn: senderVkn };
        if (senderVkn.length === 11 && !supplier.firstName) {
            const nameParts = String(supplier.name || "").trim().split(/\s+/).filter(Boolean);
            supplier.firstName = nameParts[0] || "Ad";
            supplier.lastName = nameParts.slice(1).join(" ") || "Soyad";
        }

        const faturaKodu = (
            invoiceData?.faturaKodu ||
            session.faturaKodu ||
            invoiceData?.invoiceSeriesCode ||
            "FA"
        ).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "FA";

        // Mükerrer gönderim / mevcut fatura — resmi akış: getStatus + custInvID
        if (custInvId) {
            const existing = await resolveSovosEArchiveIdentity({
                sessionId,
                vkn: senderVkn,
                custInvID: custInvId,
                custInvId,
                orderNumber: custInvId,
                seriesHint: faturaKodu,
            });
            if (existing.success && existing.uuid && !existing.cancelled) {
                logger.info(
                    "[Sovos e-Arşiv] Sipariş zaten faturalı (getStatus) — custInvId=" + custInvId +
                    " faturaNo=" + existing.invoiceNumber
                );
                return {
                    success: true,
                    uuid: existing.uuid,
                    invoiceNumber: existing.invoiceNumber,
                    custInvId,
                    totals: {},
                    recovered: true,
                };
            }
        }

        const seqSeed = custInvId
            ? Math.abs(custInvId.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0))
            : Date.now();

        let invoiceNumber = "";
        let uuid = "";
        let faturaURL = "";

        const idResult = shouldSkipGenerateInvId()
            ? { success: false, statusCode: 60, error: "SOVOS_EARSIV_SKIP_GENERATE_INVID=true" }
            : await generateInvoiceId({
                sessionId,
                identifier: senderVkn,
                branch: resolvedBranch,
                custInvId,
                issueDate,
            });

        if (idResult.success) {
            invoiceNumber = idResult.invoiceNumber;
            uuid = idResult.uuid;
            faturaURL = idResult.link || "";
        } else if (isGenerateInvIdAuthError(idResult) || shouldSkipGenerateInvId()) {
            uuid = crypto.randomUUID();
            invoiceNumber = formatGibInvoiceId(faturaKodu, seqSeed, issueDate.slice(0, 4));
            logger.warn(
                "[Sovos e-Arşiv] generateInvID atlandı (StatusCode=" + (idResult.statusCode ?? "?") + ") — " +
                "UBL geçici no: " + invoiceNumber + " UUID: " + uuid +
                " — kesim sonrası sendInvoice.InvoiceNumber ile güncellenecek"
            );
        } else {
            return { success: false, error: idResult.error || "Fatura numarası alınamadı" };
        }

        const { xml, totals } = buildInvoiceXml({
            profileId: "EARSIVFATURA",
            invoiceTypeCode: invoiceData.invoiceTypeCode || "SATIS",
            invoiceNumber,
            uuid,
            issueDate,
            currency: invoiceData.currency || "TRY",
            note: invoiceData.note || "",
            sendingType: invoiceData.sendingType || "ELEKTRONIK",
            eArchiveVisuals: invoiceData.eArchiveVisuals || {},
            custInvId,
            orderNumber: custInvId,
            supplier,
            customer: invoiceData.customer || {},
            lines: invoiceData.lines || [],
        });

        const zipBuffer = compressXmlToZip(xml, uuid);
        const sendResult = await sendInvoice({
            sessionId,
            senderId: senderVkn,
            receiverId: normalizeEArchiveReceiverId(customerVkn),
            fileName: uuid,
            zipBuffer,
            branch: resolvedBranch,
        });

        if (!sendResult.success) {
            return { success: false, error: sendResult.error || sendResult.detail };
        }

        const synced = await syncEArchiveInvoiceNumberAfterSend({
            sessionId,
            vkn: senderVkn,
            uuid: sendResult.uuid || uuid,
            invoiceNumber,
            custInvId,
            sendResult,
            seriesHint: faturaKodu,
        });
        invoiceNumber = synced.invoiceNumber;
        uuid = synced.uuid || uuid;

        logger.info("[Sovos e-Arşiv] Fatura gönderildi — " + invoiceNumber + " UUID: " + uuid);

        return {
            success: true,
            uuid,
            invoiceNumber,
            custInvId,
            totals,
            faturaURL,
            data: sendResult.raw,
        };
    } catch (error) {
        logger.error("[Sovos e-Arşiv] createEArchiveFromForm hatası:", error.message);
        return { success: false, error: error.message };
    }
};

const resolveCustInvId = (params = {}) =>
    clean(params.custInvID || params.custInvId || params.orderNumber);

const isEArchiveCancelledStatus = (data) => {
    if (!data) return false;
    const mapped = data.mappedStatus || mapSovosEArchiveStatus(data.statusCode, data.detail).mappedStatus;
    return mapped === "cancelled" || /iptal|itiraz|cancel/i.test(String(data.detail || ""));
};

const isSovosCancelAmountMismatchError = (message) =>
    /vergiler hariç|vergiler haric|tax.?exclusive|lineextension|toplam tutar.*eşit|esit degil/i.test(String(message || ""));

/** İmzalı UBL — Sovos iptal için tek güvenilir kaynak (fatura no + vergiler hariç tutar) */
const resolveSovosCancelFromSignedUbl = async ({
    sessionId,
    vkn,
    uuid,
    invoiceNumber,
    custInvID,
    custInvId,
    orderNumber,
}) => {
    const signed = await getSignedInvoice({
        sessionId,
        vkn,
        uuid,
        invoiceNumber,
        custInvID,
        custInvId,
        orderNumber,
    });
    if (!signed.success || !signed.data?.buffer?.length) {
        return { success: false, error: signed.error || "İmzalı UBL alınamadı" };
    }

    const xmlText = signed.data.buffer.toString("utf8");
    const invoiceId = extractInvoiceIdFromUbl(xmlText);
    const totalAmount = extractCancelAmountFromUbl(xmlText);

    if (!invoiceId) {
        return { success: false, error: "UBL fatura numarası (cbc:ID) okunamadı" };
    }
    if (totalAmount == null) {
        return { success: false, error: "UBL vergiler hariç tutar (LineExtensionAmount) okunamadı" };
    }

    return {
        success: true,
        invoiceId,
        totalAmount,
        xmlText,
    };
};

const resolveSovosEArchiveIdentity = async ({
    sessionId,
    vkn,
    uuid,
    invoiceNumber,
    custInvID,
    custInvId,
    orderNumber,
    seriesHint,
}) => {
    const statusResult = await getStatus({
        sessionId,
        vkn,
        uuid,
        invoiceNumber,
        custInvID,
        custInvId,
        orderNumber,
    });
    if (!statusResult.success) {
        return {
            success: false,
            error: statusResult.error,
            invoiceNumber: normalizeSovosEArchiveInvoiceNumber(invoiceNumber, { seriesHint }),
            uuid: clean(uuid),
        };
    }
    const data = statusResult.data || {};
    const normalizedNo = normalizeSovosEArchiveInvoiceNumber(
        data.invoiceNumber || invoiceNumber,
        { seriesHint }
    );
    return {
        success: true,
        invoiceNumber: normalizedNo || clean(invoiceNumber),
        uuid: clean(data.uuid) || clean(uuid),
        statusCode: data.statusCode,
        mappedStatus: data.mappedStatus,
        detail: data.detail,
        cancelled: isEArchiveCancelledStatus(data),
        raw: data.raw,
    };
};

/**
 * Kesim sonrası fatura no — resmi öncelik: sendInvoice.InvoiceNumber > imzalı UBL > getStatus
 */
const syncEArchiveInvoiceNumberAfterSend = async ({
    sessionId,
    vkn,
    uuid,
    invoiceNumber,
    custInvId,
    sendResult,
    seriesHint,
}) => {
    const hint = seriesHint || "FA";
    const candidates = [
        sendResult?.invoiceNumber,
        invoiceNumber,
    ];

    if (uuid || custInvId || invoiceNumber) {
        try {
            const signed = await getSignedInvoice({
                sessionId,
                vkn,
                uuid,
                invoiceNumber,
                custInvID: custInvId,
                custInvId,
                orderNumber: custInvId,
            });
            if (signed.success && signed.data?.buffer) {
                candidates.unshift(extractInvoiceIdFromUbl(signed.data.buffer.toString("utf8")));
            }
        } catch (_) { /* imzalı UBL henüz hazır olmayabilir */ }
    }

    const status = await resolveSovosEArchiveIdentity({
        sessionId,
        vkn,
        uuid,
        invoiceNumber,
        custInvID: custInvId,
        custInvId,
        orderNumber: custInvId,
        seriesHint: hint,
    });
    if (status.success && status.invoiceNumber) {
        candidates.push(status.invoiceNumber);
    }

    const best = pickBestSovosInvoiceNumber(candidates, { seriesHint: hint });
    const resolvedUuid = status.success && status.uuid ? status.uuid : clean(uuid);

    if (best && best !== invoiceNumber) {
        logger.info(
            "[Sovos e-Arşiv] Fatura no senkronize edildi — " + invoiceNumber + " → " + best
        );
    } else if (best && isCorruptedSovosInvoiceNumber(invoiceNumber) && !isCorruptedSovosInvoiceNumber(best)) {
        logger.info("[Sovos e-Arşiv] Fatura no düzeltildi — " + invoiceNumber + " → " + best);
    }

    return {
        invoiceNumber: best || normalizeSovosEArchiveInvoiceNumber(invoiceNumber, { seriesHint: hint }),
        uuid: resolvedUuid,
        status,
    };
};

/** Resmi örnek: UUID, vkn, invoiceNumber, custInvID — boş alanlar boş tag olarak gönderilir */
const buildEArchiveLookupAttempts = ({ vkn, sessionVkn, uuid, invoiceNumber, custInvID, custInvId, orderNumber }) => {
    const supplierVkn = clean(vkn || sessionVkn);
    const uuidVal = clean(uuid);
    const invNo = clean(invoiceNumber);
    const custId = resolveCustInvId({ custInvID, custInvId, orderNumber });

    const toOfficialFields = (partial = {}) => ({
        UUID: partial.UUID ?? "",
        vkn: partial.vkn ?? supplierVkn ?? "",
        invoiceNumber: partial.invoiceNumber ?? "",
        custInvID: partial.custInvID ?? "",
    });

    const attempts = [];
    const seen = new Set();
    const pushAttempt = (fields) => {
        const key = [fields.UUID, fields.vkn, fields.invoiceNumber, fields.custInvID].join("|");
        if (seen.has(key)) return;
        seen.add(key);
        attempts.push(fields);
    };

    if (supplierVkn && (uuidVal || invNo || custId)) {
        pushAttempt(toOfficialFields({
            UUID: uuidVal,
            invoiceNumber: invNo,
            custInvID: custId,
        }));
    }
    if (supplierVkn && uuidVal) {
        pushAttempt(toOfficialFields({ UUID: uuidVal }));
    }
    if (supplierVkn && invNo) {
        pushAttempt(toOfficialFields({ invoiceNumber: invNo }));
    }
    if (supplierVkn && custId) {
        pushAttempt(toOfficialFields({ custInvID: custId }));
    }

    return { supplierVkn, custId, attempts };
};

const validateEArchiveLookupAttempts = (attempts) => {
    if (!attempts || attempts.length === 0) {
        return "En az UUID veya VKN + fatura numarası veya VKN + müşteri fatura ID (sipariş no) gerekli.";
    }
    return null;
};

const parseGetStatusBody = (result) => {
    const body = result?.statusCode != null || result?.raw && typeof result.raw === "string" && !result?.getStatusResponseType
        ? result
        : unwrap(result, "getStatusResponseType");
    const statusCode = body?.statusCode ?? body?.StatusCode;
    const detail = String(body?.Detail || body?.detail || "");
    const mapped = mapSovosEArchiveStatus(statusCode, detail);
    return {
        statusCode: mapped.statusCode,
        statusLabel: mapped.label,
        detail: mapped.detail,
        mappedStatus: mapped.mappedStatus,
        uuid: body?.UUID || body?.uuid || "",
        invoiceNumber: normalizeSovosEArchiveInvoiceNumber(body?.invoiceNumber || "", { seriesHint: "FA" }),
        raw: body?.raw ?? body,
    };
};

const parseInvoiceDocumentBody = (result, outputType) => {
    const body = unwrap(result, "getInvoiceDocumentResponseType");
    const docData = body?.binaryData ?? body?.BinaryData;
    const buf = normalizeSovosBinaryData(docData);
    const format = String(outputType || "PDF").toUpperCase();
    const contentType = buf
        ? sniffContentType(buf, format === "HTML" ? "text/html; charset=utf-8" : "application/pdf")
        : (format === "HTML" ? "text/html; charset=utf-8" : "application/pdf");
    return {
        buffer: buf,
        base64: buf ? buf.toString("base64") : null,
        contentType,
        raw: body,
    };
};

const getStatus = async ({ sessionId, vkn, uuid, invoiceNumber, custInvID, custInvId, orderNumber }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const { attempts } = buildEArchiveLookupAttempts({
        vkn,
        sessionVkn: session.vknTckn,
        uuid,
        invoiceNumber,
        custInvID,
        custInvId,
        orderNumber,
    });
    const validationError = validateEArchiveLookupAttempts(attempts);
    if (validationError) return { success: false, error: validationError };

    let lastError = "";
    for (const attempt of attempts) {
        const httpResult = await postGetStatus({
            endpoint: getEndpoint(session.env),
            username: session.username,
            password: session.password,
            fields: attempt,
        });
        if (!httpResult.success) {
            lastError = httpResult.error || "getStatus başarısız";
            continue;
        }
        const parsed = parseGetStatusBody(httpResult);
        const code = Number(parsed.statusCode);
        const detail = String(parsed.detail || "");
        if (code === 901 || /parametre hatası|parameter error/i.test(detail)) {
            lastError = detail || "getStatus parametre hatası (901)";
            continue;
        }
        return { success: true, data: parsed };
    }
    return { success: false, error: lastError || "e-Arşiv durum sorgusu başarısız" };
};

const getInvoiceDocument = async ({
    sessionId,
    vkn,
    uuid,
    invoiceNumber,
    custInvID,
    custInvId,
    orderNumber,
    outputType = "PDF",
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const format = String(outputType || "PDF").toUpperCase();
    const { attempts } = buildEArchiveLookupAttempts({
        vkn,
        sessionVkn: session.vknTckn,
        uuid,
        invoiceNumber,
        custInvID,
        custInvId,
        orderNumber,
    });
    const validationError = validateEArchiveLookupAttempts(attempts);
    if (validationError) return { success: false, error: validationError };

    let lastError = "";
    for (const attempt of attempts) {
        const httpResult = await postGetInvoiceDocument({
            endpoint: getEndpoint(session.env),
            username: session.username,
            password: session.password,
            fields: attempt,
            outputType: format,
        });
        if (!httpResult.success) {
            lastError = httpResult.error || "getInvoiceDocument başarısız";
            continue;
        }
        const buf = normalizeSovosBinaryData(httpResult.base64);
        if (buf && buf.length) {
            const contentType = sniffContentType(buf, format === "HTML" ? "text/html; charset=utf-8" : "application/pdf");
            return {
                success: true,
                data: {
                    buffer: buf,
                    base64: buf.toString("base64"),
                    contentType,
                    raw: httpResult.raw,
                },
            };
        }
        lastError = "Belge içeriği boş";
    }
    return { success: false, error: lastError || "e-Arşiv belgesi alınamadı" };
};

const actionService = async ({
    sessionId,
    senderId,
    branch,
    invoiceId,
    actionType,
    parameters = [],
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const req = {
        SenderID: clean(senderId || session.vknTckn),
        Branch: clean(branch || session.branch) || "default",
        ActionType: clean(actionType),
    };
    if (invoiceId) req.InvoiceID = clean(invoiceId);
    if (parameters?.length) {
        req.Parameters = parameters.map((p) => ({
            Name: p.name || p.Name,
            Value: p.value || p.Value,
        }));
    }

    try {
        const result = await soapCall(session, "actionService", {
            actionServiceRequestType: req,
        });
        const body = result?.actionServiceResponseType ?? result ?? {};
        return { success: true, data: body };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const sendEnvelope = async ({
    sessionId,
    senderId,
    receiverId,
    zipBuffer,
    fileName,
    hash,
    branch = "default",
    outputType = "NONE",
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const binaryData = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
    try {
        const result = await soapCall(session, "sendEnvelope", {
            sendInvoiceRequestType: {
                ...buildBaseArchiveRequest({
                    senderId, receiverId, zipBuffer: binaryData, fileName, hash, branch, session,
                }),
                responsiveOutput: { outputType: String(outputType || "NONE").toUpperCase() },
            },
        });
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const retriggerOperation = async ({
    sessionId,
    vkn,
    branch,
    invoiceId,
    invoiceUUID,
    parameters = [],
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const req = {
        VKN: clean(vkn || session.vknTckn),
        branch: clean(branch || session.branch) || "default",
    };
    if (invoiceId) req.invoiceID = clean(invoiceId);
    if (invoiceUUID) req.invoiceUUID = clean(invoiceUUID);
    if (parameters?.length) {
        req.customizationParams = parameters.map((p) => ({
            paramName: p.name || p.paramName,
            paramValue: p.value || p.paramValue,
        }));
    }

    try {
        const result = await soapCall(session, "retriggerOperation", {
            retriggerServiceRequest: req,
        });
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const getSignedInvoice = async ({
    sessionId,
    vkn,
    uuid,
    invoiceNumber,
    custInvID,
    custInvId,
    orderNumber,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const { attempts } = buildEArchiveLookupAttempts({
        vkn,
        sessionVkn: session.vknTckn,
        uuid,
        invoiceNumber,
        custInvID,
        custInvId,
        orderNumber,
    });
    const validationError = validateEArchiveLookupAttempts(attempts);
    if (validationError) return { success: false, error: validationError };

    let lastError = "";
    for (const attempt of attempts) {
        const httpResult = await postGetSignedInvoice({
            endpoint: getEndpoint(session.env),
            username: session.username,
            password: session.password,
            fields: attempt,
        });
        if (!httpResult.success) {
            lastError = httpResult.error || "getSignedInvoice başarısız";
            continue;
        }
        const buf = normalizeSovosBinaryData(httpResult.base64);
        if (buf && buf.length) {
            return {
                success: true,
                data: {
                    raw: httpResult.raw,
                    buffer: buf,
                    base64: buf.toString("base64"),
                    contentType: sniffContentType(buf, "application/xml; charset=utf-8"),
                },
            };
        }
        lastError = httpResult.detail || "İmzalı belge boş";
    }
    return { success: false, error: lastError || "İmzalı e-Arşiv belgesi alınamadı" };
};

const buildBaseArchiveRequest = ({
    senderId,
    receiverId,
    zipBuffer,
    fileName,
    hash,
    branch = "default",
    session,
}) => {
    const binaryData = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
    return {
        senderID: clean(senderId || session.vknTckn),
        receiverID: clean(receiverId || "2222222222"),
        docType: "XML",
        fileName: clean(fileName) || "envelope.zip",
        hash: clean(hash) || md5Hex(binaryData),
        binaryData,
        customizationParams: [{ paramName: "BRANCH", paramValue: clean(branch) || "default" }],
    };
};

const getReportList = async ({ sessionId, vkn, startDate, endDate, approved = false, customizationParams = [] }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const start = toSovosDateTime(startDate, { endOfDay: false });
    const end = toSovosDateTime(endDate, { endOfDay: true });
    const supplierVkn = clean(vkn || session.vknTckn);
    if (!start || !end || !supplierVkn) {
        return { success: false, error: "VKN ve tarih aralığı gerekli" };
    }

    try {
        const req = {
            startDate: start,
            endDate: end,
            vkn: supplierVkn,
            approved: approved === true || approved === 1 || approved === "1" || approved === "true",
        };
        if (customizationParams?.length) {
            req.customizationParams = customizationParams.map((p) => ({
                paramName: p.paramName || p.name,
                paramValue: p.paramValue || p.value,
            }));
        }
        const result = await soapCall(session, "getReportList", { getReportListRequest: req });
        const body = result?.getReportListResponse ?? result ?? {};
        let reports = body.Reports ?? body.reports ?? body.Report;
        if (reports && !Array.isArray(reports)) reports = [reports];
        return { success: true, data: reports || [] };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const getReportData = async ({ sessionId, vkn, uuid, reportId, reportUuid }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    const reportUUID = clean(uuid || reportUuid || reportId);
    if (!reportUUID) return { success: false, error: "Rapor UUID gerekli (getReportDataRequest.UUID)" };

    try {
        const result = await soapCall(session, "getReportData", {
            getReportDataRequest: {
                UUID: reportUUID,
                VKN_TCKN: clean(vkn || session.vknTckn),
            },
        });
        const body = result?.getReportDataResponse ?? result ?? {};
        const docData = body.binaryData ?? body.DocData ?? body.docData;
        if (!docData) {
            return { success: false, error: body?.Detail || "Rapor verisi boş", data: { raw: body } };
        }
        const buf = Buffer.isBuffer(docData) ? docData : Buffer.from(docData);
        return {
            success: true,
            data: {
                raw: body,
                base64: buf.toString("base64"),
                contentType: "application/zip",
            },
        };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const getReportStatus = async ({ sessionId, vkn, uuid, reportUuid }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    const reportUUID = clean(uuid || reportUuid);
    if (!reportUUID) return { success: false, error: "Rapor UUID gerekli" };

    try {
        const result = await soapCall(session, "getReportStatus", {
            getReportStatusRequestType: {
                UUID: reportUUID,
                VKN: clean(vkn || session.vknTckn),
            },
        });
        const body = result?.getReportStatusResponseType ?? result ?? {};
        return { success: true, data: body };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const sendReport = async ({
    sessionId,
    senderId,
    receiverId,
    zipBuffer,
    fileName,
    hash,
    branch = "default",
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    try {
        const result = await soapCall(session, "sendReport", {
            sendReportRequestType: buildBaseArchiveRequest({
                senderId, receiverId, zipBuffer, fileName, hash, branch, session,
            }),
        });
        return { success: true, data: result?.sendReportResponseType ?? result ?? {} };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const getUserList = async ({ sessionId, vknTckn }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    try {
        const result = await soapCall(session, "getUserList", {
            getUserListRequest: { vknTckn: clean(vknTckn || session.vknTckn) },
        });
        const body = result?.getUserListResponse ?? result ?? {};
        const binaryData = body.binaryData;
        return {
            success: true,
            data: {
                raw: body,
                base64: binaryData ? (Buffer.isBuffer(binaryData) ? binaryData.toString("base64") : String(binaryData)) : null,
            },
        };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const getPartialUserList = async ({
    sessionId,
    vknTckn,
    includeBinary = true,
    fileNameList = [],
    parameters = [],
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const names = Array.isArray(fileNameList) ? fileNameList.map((f) => clean(f)).filter(Boolean) : [];
    if (!names.length) {
        return {
            success: false,
            error:
                "getPartialUserList yalnızca toplu kullanıcı listesi parçası indirmek içindir (fileNameList zorunlu). " +
                "Tekil mükellef sorgusu için customer/lookup kullanın.",
        };
    }

    const cooldown = checkPartialListCooldown(session.vknTckn);
    if (!cooldown.allowed) {
        return {
            success: false,
            error: `getPartialUserList çok sık çağrıldı. ${cooldown.waitSec} saniye sonra tekrar deneyin.`,
            rateLimited: true,
        };
    }

    const req = {
        vknTckn: clean(vknTckn || session.vknTckn),
        includeBinary: includeBinary === true || includeBinary === 1 || includeBinary === "true",
        fileNameList: { fileName: names },
    };
    if (parameters?.length) {
        req.parameters = {
            parameter: parameters.map((p) => ({
                name: p.name || p.Name,
                value: p.value || p.Value,
            })),
        };
    }

    try {
        markPartialListCall(session.vknTckn);
        const result = await soapCall(session, "getPartialUserList", { getPartialUserListRequest: req });
        return { success: true, data: result?.getPartialUserListResponse ?? result ?? {} };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

const cancelInvoice = async ({
    sessionId,
    vkn,
    invoiceNumber,
    invoiceId,
    totalAmount,
    cancelDate,
    branch,
    custInvID,
    custInvId,
    orderNumber,
    uuid,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const invIdInput = clean(invoiceNumber || invoiceId);
    const supplierVkn = clean(vkn || session.vknTckn);
    const custId = resolveCustInvId({ custInvID, custInvId, orderNumber });
    const resolvedBranch = clean(branch) || clean(session.branch) || "default";

    if (!invIdInput && !custId && !uuid) {
        return { success: false, error: "İptal için fatura numarası, UUID veya sipariş no (custInvID) gerekli" };
    }
    if (!supplierVkn) {
        return { success: false, error: "İptal için VKN gerekli" };
    }

    let invId = invIdInput;
    let resolvedUuid = clean(uuid);
    let resolvedAmount = formatCancelAmount(totalAmount);

    // 1) İmzalı UBL — resmi iptal totalAmount = vergiler hariç (LineExtensionAmount)
    const ublResolved = await resolveSovosCancelFromSignedUbl({
        sessionId,
        vkn: supplierVkn,
        uuid: resolvedUuid,
        invoiceNumber: invId,
        custInvID: custId,
        custInvId: custId,
        orderNumber: custId,
    });
    if (ublResolved.success) {
        if (ublResolved.invoiceId && ublResolved.invoiceId !== invId) {
            logger.info(
                "[Sovos e-Arşiv] cancelInvoice — UBL fatura no: " +
                (invId || "(boş)") + " → " + ublResolved.invoiceId
            );
            invId = ublResolved.invoiceId;
        }
        if (resolvedAmount !== ublResolved.totalAmount) {
            logger.info(
                "[Sovos e-Arşiv] cancelInvoice totalAmount (vergiler hariç) — " +
                (resolvedAmount ?? "?") + " → " + ublResolved.totalAmount
            );
        }
        resolvedAmount = ublResolved.totalAmount;
    } else if (resolvedAmount == null) {
        return {
            success: false,
            error: ublResolved.error || "İptal tutarı belirlenemedi — UBL okunamadı",
        };
    }

    // 2) getStatus — iptal durumu + UUID senkronu
    const identity = await resolveSovosEArchiveIdentity({
        sessionId,
        vkn: supplierVkn,
        uuid: resolvedUuid,
        invoiceNumber: invId,
        custInvID: custId,
        custInvId: custId,
        orderNumber: custId,
    });
    if (identity.success) {
        if (identity.uuid) resolvedUuid = identity.uuid;
        if (identity.cancelled) {
            logger.info("[Sovos e-Arşiv] cancelInvoice — Sovos'ta zaten iptal (getStatus) — " + invId);
            return {
                success: true,
                alreadyCancelled: true,
                data: {
                    message: "Fatura Sovos tarafında zaten iptal edilmiş.",
                    code: 2,
                    verifiedStatus: identity,
                    invoiceNumber: invId,
                    uuid: resolvedUuid,
                },
            };
        }
        // getStatus fatura no UBL ile çelişirse UBL öncelikli (portal ile uyumlu)
        if (
            identity.invoiceNumber &&
            identity.invoiceNumber !== invId &&
            ublResolved.success &&
            ublResolved.invoiceId
        ) {
            logger.warn(
                "[Sovos e-Arşiv] cancelInvoice — getStatus fatura no yok sayıldı (UBL öncelikli): " +
                identity.invoiceNumber + " ≠ " + invId
            );
        } else if (identity.invoiceNumber && identity.invoiceNumber !== invId && !ublResolved.success) {
            logger.warn(
                "[Sovos e-Arşiv] cancelInvoice — getStatus fatura no: " +
                (invId || "(boş)") + " → " + identity.invoiceNumber
            );
            invId = identity.invoiceNumber;
        }
    } else if (!invId) {
        return { success: false, error: identity.error || "Sovos'ta fatura bulunamadı — iptal edilemedi" };
    }

    if (!invId) {
        return { success: false, error: "İptal için fatura numarası (invoiceId) gerekli" };
    }

    const cancelInfo = {
        invoiceId: invId,
        vkn: supplierVkn,
        branch: resolvedBranch,
        totalAmount: resolvedAmount,
        cancelDate: toTurkeyCancelDate(cancelDate),
        custInvID: custId || "",
    };

    try {
        logger.info(
            "[Sovos e-Arşiv] cancelInvoice — invoiceId=" + invId +
            " vkn=" + supplierVkn +
            " branch=" + resolvedBranch +
            " totalAmount=" + resolvedAmount + " (vergiler hariç)" +
            " cancelDate=" + cancelInfo.cancelDate +
            (custId ? " custInvID=" + custId : " custInvID=(boş)")
        );

        const postCancel = (payload) => postCancelInvoice({
            endpoint: getEndpoint(session.env),
            username: session.username,
            password: session.password,
            payload,
        });

        let httpResult = await postCancel(cancelInfo);

        let parsed = httpResult.success
            ? {
                ok: true,
                message: httpResult.message,
                code: httpResult.code,
                alreadyCancelled: httpResult.alreadyCancelled === true,
                raw: httpResult.raw,
            }
            : {
                ok: false,
                message: httpResult.error,
                code: httpResult.code,
                raw: httpResult.raw,
            };

        // Resmi örnekte custInvID boş — InternalServiceFault durumunda boş custInvID ile bir kez daha dene
        if (!parsed.ok && custId && /internal|internalservicefault|500/i.test(String(parsed.message || ""))) {
            logger.warn("[Sovos e-Arşiv] cancelInvoice custInvID ile başarısız — boş custInvID ile tekrar deneniyor");
            httpResult = await postCancel({ ...cancelInfo, custInvID: "" });
            parsed = httpResult.success
                ? { ok: true, message: httpResult.message, code: httpResult.code, alreadyCancelled: httpResult.alreadyCancelled === true, raw: httpResult.raw }
                : { ok: false, message: httpResult.error, code: httpResult.code, raw: httpResult.raw };
        }

        // Tutar uyuşmazlığı — boş custInvID ile bir kez daha dene (resmi örnek)
        if (!parsed.ok && isSovosCancelAmountMismatchError(parsed.message) && custId) {
            logger.warn("[Sovos e-Arşiv] cancelInvoice tutar hatası — boş custInvID ile tekrar deneniyor");
            httpResult = await postCancel({ ...cancelInfo, custInvID: "" });
            parsed = httpResult.success
                ? { ok: true, message: httpResult.message, code: httpResult.code, alreadyCancelled: httpResult.alreadyCancelled === true, raw: httpResult.raw }
                : { ok: false, message: httpResult.error, code: httpResult.code, raw: httpResult.raw };
        }

        if (!parsed.ok) {
            const faultText = parseSovosProcessingFault(String(parsed.message || parsed.raw || ""))?.text;
            const userMsg = isSovosCancelAmountMismatchError(faultText || parsed.message)
                ? (faultText || "Sovos iptal tutarı uyuşmuyor (vergiler hariç toplam).")
                : (faultText || parsed.message);
            logger.warn("[Sovos e-Arşiv] cancelInvoice başarısız — " + parsed.message + (parsed.code != null ? " code=" + parsed.code : ""));
            return { success: false, error: userMsg, data: parsed.raw };
        }

        let verified = null;
        if (uuid || invId || custId || resolvedUuid) {
            try {
                const statusResult = await getStatus({
                    sessionId,
                    vkn: supplierVkn,
                    uuid: resolvedUuid,
                    invoiceNumber: invId,
                    custInvID: custId,
                    custInvId: custId,
                    orderNumber: custId,
                });
                if (statusResult.success) {
                    verified = statusResult.data;
                    const stillActive = !isEArchiveCancelledStatus(verified);
                    if (stillActive) {
                        if (parsed.alreadyCancelled) {
                            logger.warn(
                                "[Sovos e-Arşiv] cancelInvoice — Code=2 ancak getStatus hâlâ aktif — " +
                                "invoiceId=" + invId + " statusCode=" + (verified?.statusCode ?? "?")
                            );
                            return {
                                success: false,
                                error:
                                    "Sovos iptal yanıtı tutarsız: kayıt zaten iptal görünüyor ancak fatura hâlâ aktif. " +
                                    "Portaldeki fatura numarasını kontrol edin (" + invId + ").",
                                data: { verifiedStatus: verified, attemptedInvoiceId: invId },
                            };
                        }
                        logger.warn(
                            "[Sovos e-Arşiv] cancelInvoice sonrası getStatus — fatura hâlâ aktif görünüyor — " +
                            "statusCode=" + (verified?.statusCode ?? "?") + " detail=" + (verified?.detail || "")
                        );
                    }
                } else if (statusResult.error) {
                    logger.debug("[Sovos e-Arşiv] cancelInvoice sonrası getStatus atlandı: " + statusResult.error);
                }
            } catch (verifyErr) {
                logger.debug("[Sovos e-Arşiv] cancelInvoice sonrası getStatus doğrulaması atlandı: " + verifyErr.message);
            }
        }

        logger.info(
            "[Sovos e-Arşiv] cancelInvoice başarılı — " + invId +
            (parsed.alreadyCancelled ? " (Sovos'ta zaten iptal)" : "") +
            " code=" + (parsed.code ?? 1)
        );
        return {
            success: true,
            alreadyCancelled: parsed.alreadyCancelled === true,
            data: {
                raw: parsed.raw,
                message: parsed.message,
                code: parsed.code,
                verifiedStatus: verified,
                invoiceNumber: invId,
                uuid: resolvedUuid,
            },
        };
    } catch (error) {
        const fault = extractFault(error);
        logger.error("[Sovos e-Arşiv] cancelInvoice hatası:", fault || error.message);
        return { success: false, error: fault || error.message || "e-Arşiv iptal başarısız" };
    }
};

/**
 * e-Arşiv v2.3 resmi API'de tekil fatura listesi operasyonu yok.
 * Geriye uyumluluk: getReportList rapor özetlerini döndürür.
 */
const detailedInvoiceQuery = async ({
    sessionId,
    vkn,
    startDate,
    endDate,
    allowBypassCooldown = false,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    if (!allowBypassCooldown) {
        const cooldown = checkListCooldown(session.vknTckn);
        if (!cooldown.allowed) {
            return {
                success: false,
                error: `Sovos e-Arşiv liste sorgusu çok sık yapılıyor. ${cooldown.waitSec} saniye sonra tekrar deneyin.`,
                rateLimited: true,
            };
        }
        markListCall(session.vknTckn);
    }

    const result = await getReportList({
        sessionId,
        vkn: vkn || session.vknTckn,
        startDate,
        endDate,
    });
    if (!result.success) return result;

    const rows = (result.data || []).map((row) => ({
        uuid: row.uuid || row.UUID || "",
        invoiceNumber: row.periodCode || "",
        statusCode: row.gibStatus || "",
        reportUuid: row.uuid || row.UUID || "",
        raw: row,
    }));

    return {
        success: true,
        data: rows,
        message: "e-Arşiv v2.3 resmi API: tekil fatura listesi yok; getReportList rapor özetleri döndü.",
        documentKind: "report",
    };
};

module.exports = {
    verifyCredentials,
    generateInvoiceId,
    sendInvoice,
    createEArchiveFromForm,
    getStatus,
    getInvoiceDocument,
    getSignedInvoice,
    getReportList,
    getReportData,
    getReportStatus,
    sendReport,
    getUserList,
    getPartialUserList,
    actionService,
    sendEnvelope,
    retriggerOperation,
    cancelInvoice,
    resolveSovosEArchiveIdentity,
    syncEArchiveInvoiceNumberAfterSend,
    buildEArchiveLookupAttempts,
    resolveCustInvId,
    detailedInvoiceQuery,
    normalizeDetailedInvoiceList,
    WSDL,
    ENDPOINT,
};
