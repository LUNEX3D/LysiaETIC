const soap = require("soap");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");
const logger = require("../config/logger");
const { compressXmlToZip, decompressZipEntry } = require("../utils/sovosUblZip");
const { extractSoapFault, mapSovosLoginError, isSovosInactiveModuleError, buildSovosInactiveModuleResult } = require("../utils/sovosSoapFault");
const { getSovosTlsOptions, createSovosHttpsAgent } = require("../utils/sovosTls");
const { applySovosSoapSecurity, callWithAuthFallback, resolveAuthModes, normalizeEarsivAuthMode } = require("../utils/sovosSoapAuth");
const { buildBasicAuthHeader } = require("../utils/sovosHttpSoap");
const { parseUserListFromRawResponse } = require("../utils/sovosUserListParser");
const {
    checkListCooldown,
    markListCall,
    getCachedList,
    setCachedList,
    cacheKey,
    clampDateRange,
    sleep,
    isValidGbIdentifier,
    MAX_LIST_DAYS,
    CHUNK_DELAY_MS,
    taxpayerCacheKey,
    checkTaxpayerCooldown,
    markTaxpayerCall,
    getCachedTaxpayer,
    setCachedTaxpayer,
    checkPartialListCooldown,
    markPartialListCall,
} = require("../utils/sovosApiGuard");
const { normalizeSovosBinaryData, sniffContentType } = require("../utils/sovosBinaryData");

/**
 * SOVOS BULUT e-FATURA WS API v2.3 — LysiaETIC
 *
 * Türkiye Fitbulut SOAP web servisi (ClientEInvoiceServices-2.2)
 * Resmi örnek: Sovos-Compliance/turkey-cloud-sample-api-client
 *
 * Kimlik doğrulama: WS-Security (varsayılan/auto) veya HTTP Basic (SOVOS_AUTH_MODE=basic)
 */

const LOCAL_WSDL = path.join(__dirname, "../assets/sovos-wsdl/ClientEInvoiceServices-2.2.wsdl");

const WSDL = {
    test: process.env.SOVOS_EFATURA_TEST_WSDL || LOCAL_WSDL,
    production: process.env.SOVOS_EFATURA_PROD_WSDL || "https://efaturaws.fitbulut.com/ClientEInvoiceServices/ClientEInvoiceServicesPort.svc?wsdl",
};

const ENDPOINT = {
    test: process.env.SOVOS_EFATURA_TEST_URL || "https://efaturawstest.fitbulut.com/ClientEInvoiceServices/ClientEInvoiceServicesPort.svc",
    production: process.env.SOVOS_EFATURA_PROD_URL || "https://efaturaws.fitbulut.com/ClientEInvoiceServices/ClientEInvoiceServicesPort.svc",
};

const SovosWsSession = require("../models/SovosWsSession");

const sessionStore = {};
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const getWsdlUrl = (env) => WSDL[env] || WSDL.test;
const getEndpoint = (env) => ENDPOINT[env] || ENDPOINT.test;
const clean = (s) => String(s || "").trim();
const rawPass = (s) => (s == null ? "" : String(s));
const toUuidArray = (value) => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(clean).filter(Boolean);
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
        authMode || session.authMode || resolveAuthModes()[0]
    );
    client.addHttpHeader("Authorization", buildBasicAuthHeader(session.username, session.password));
    return client;
};

const patchSessionCapabilities = (sessionId, capabilityPatch = {}) => {
    const session = sessionStore[sessionId];
    if (!session || !capabilityPatch || typeof capabilityPatch !== "object") return;
    session.capabilities = { ...(session.capabilities || {}), ...capabilityPatch };
};

const applyInactiveModuleCapability = (sessionId, result) => {
    if (!result?.inactiveModule || !result?.capabilityKey || !sessionId) return result;
    patchSessionCapabilities(sessionId, { [result.capabilityKey]: false });
    return result;
};

const storeSession = (sessionId, data) => {
    sessionStore[sessionId] = { ...data, createdAt: Date.now() };
    SovosWsSession.findOneAndUpdate(
        { sessionId },
        {
            sessionId,
            vknTckn: data.vknTckn,
            env: data.env,
            username: data.username,
            password: data.password,
            senderIdentifier: data.senderIdentifier,
            receiverIdentifier: data.receiverIdentifier || "",
            capabilities: data.capabilities || { efatura: false, earsiv: false },
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
        { upsert: true }
    ).catch((err) => logger.warn("[Sovos WS] Oturum DB kaydı başarısız: " + err.message));
};

const getSession = (sessionId) => {
    const s = sessionStore[sessionId];
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
        delete sessionStore[sessionId];
        SovosWsSession.deleteOne({ sessionId }).catch(() => {});
        return null;
    }
    return s;
};

const hydrateSessionFromDb = async (sessionId) => {
    if (!sessionId) return null;
    if (getSession(sessionId)) return getSession(sessionId);
    try {
        const doc = await SovosWsSession.findOne({
            sessionId,
            expiresAt: { $gt: new Date() },
        }).lean();
        if (!doc) return null;
        const session = {
            username: doc.username,
            password: doc.password,
            vknTckn: doc.vknTckn,
            senderIdentifier: doc.senderIdentifier,
            receiverIdentifier: doc.receiverIdentifier,
            env: doc.env,
            capabilities: doc.capabilities || { efatura: false, earsiv: false },
        };
        sessionStore[sessionId] = { ...session, createdAt: doc.createdAt?.getTime() || Date.now() };
        return session;
    } catch (err) {
        logger.warn("[Sovos WS] Oturum DB okuma başarısız: " + err.message);
        return null;
    }
};

const ensureSession = async (sessionId) => {
    const mem = getSession(sessionId);
    if (mem) {
        if (mem.authMode) {
            mem.authMode = normalizeEarsivAuthMode(mem.authMode);
        }
        return mem;
    }
    return hydrateSessionFromDb(sessionId);
};

const validateReceiverIdentifier = (receiverIdentifier) => {
    const pk = clean(receiverIdentifier);
    if (!pk) {
        return { valid: true, warning: "Gelen faturalar için PK (receiver) etiketi tanımlanmadı" };
    }
    const urnOk = /^urn:mail:[^@\s]+@[^@\s]+$/i.test(pk);
    const aliasOk = pk.length >= 8 && !/\s/.test(pk);
    if (!urnOk && !aliasOk) {
        return {
            valid: false,
            error: "PK etiketi geçersiz. Örnek: urn:mail:defaultpk@sirket.com",
        };
    }
    return { valid: true };
};

const unwrapSoapArgs = (args) => {
    if (!args || typeof args !== "object" || Array.isArray(args)) return args;
    const keys = Object.keys(args);
    if (keys.length !== 1) return args;
    const key = keys[0];
    const inner = args[key];
    if (!inner || typeof inner !== "object" || Array.isArray(inner)) return args;
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

const resolveIdentifier = (session, identifierKey) => {
    if (identifierKey === "receiver") return session.receiverIdentifier;
    return session.senderIdentifier;
};

const identifierLabel = (identifierKey) => (identifierKey === "receiver" ? "PK etiketi" : "GB etiketi");

const verifyEfaturaCredentials = async (session) => {
    if (!session.senderIdentifier) {
        return { ok: false, fault: "GB etiketi tanımlı değil" };
    }

    const { authMode } = await callWithAuthFallback({
        username: session.username,
        password: session.password,
        authMode: session.authMode,
        createClient: (mode) => createSoapClient(session, mode),
        call: (client) =>
            invokeSoapMethod(client, "getRAWUserList", {
                getRAWUserListRequest: {
                    Identifier: session.senderIdentifier,
                    VKN_TCKN: session.vknTckn,
                    Role: "GB",
                },
            }),
    });

    session.authMode = authMode;
    return { ok: true, authMode };
};

const verifyEarsivCredentials = async (session) => {
    const sovosEArchiveService = require("./sovosEArchiveService");
    const result = await sovosEArchiveService.verifyCredentials({
        username: session.username,
        password: session.password,
        vknTckn: session.vknTckn,
        env: session.env,
        branch: session.branch || "default",
        identifier: session.vknTckn,
        authMode: session.authMode,
    });
    session.authMode = normalizeEarsivAuthMode(result.authMode);
    return { ok: true, authMode: session.authMode };
};

// ─── 1. Bağlantı / Oturum ───────────────────────────────────────────────────
const login = async ({
    username,
    password,
    vknTckn,
    senderIdentifier,
    receiverIdentifier,
    branch,
    faturaKodu,
    env = "test",
    loginMode = "auto",
}) => {
    if (!username || !password || !vknTckn) {
        return {
            success: false,
            error: "Web servis kullanıcı adı, şifre ve VKN/TCKN zorunludur",
            status: 400,
        };
    }

    const mode = String(loginMode || "auto").toLowerCase();
    if (mode === "efatura" && !clean(senderIdentifier)) {
        return {
            success: false,
            error: "e-Fatura bağlantısı için GB etiketi zorunludur",
            status: 400,
        };
    }

    const pkCheck = validateReceiverIdentifier(receiverIdentifier);
    if (!pkCheck.valid) {
        return { success: false, error: pkCheck.error, status: 400 };
    }

    const session = {
        username: clean(username),
        password: rawPass(password),
        vknTckn: clean(vknTckn),
        senderIdentifier: clean(senderIdentifier),
        receiverIdentifier: clean(receiverIdentifier),
        branch: clean(branch) || "default",
        faturaKodu: clean(faturaKodu).slice(0, 3).toUpperCase(),
        env: env === "production" ? "production" : "test",
    };

    const gbValid = isValidGbIdentifier(session.senderIdentifier);
    if (mode === "efatura" && !gbValid) {
        return {
            success: false,
            error: "GB etiketi geçersiz. Sovos portalındaki tam urn:mail:... formatını girin.",
            status: 400,
        };
    }

    let efaturaOk = false;
    let earsivOk = false;
    let lastFault = "";
    const tryEfatura = mode === "efatura" || (mode === "auto" && gbValid);
    const tryEarsiv = mode === "earsiv" || mode === "auto";

    if (tryEfatura) {
        try {
            await verifyEfaturaCredentials(session);
            efaturaOk = true;
        } catch (error) {
            lastFault = extractSoapFault(error);
            logger.warn(
                "[Sovos WS] e-Fatura doğrulama başarısız env=" + session.env +
                " endpoint=" + getEndpoint(session.env) +
                " user=" + session.username +
                " vkn=" + session.vknTckn +
                " fault=" + lastFault
            );
            if (mode === "efatura") {
                return {
                    success: false,
                    error: mapSovosLoginError(lastFault, session.env, "efatura"),
                    status: 400,
                };
            }
        }
    }

    if (tryEarsiv && !efaturaOk) {
        try {
            await verifyEarsivCredentials(session);
            earsivOk = true;
            const earsivEndpoint = require("./sovosEArchiveService").ENDPOINT[session.env];
            logger.info(
                "[Sovos e-Arşiv WS] Oturum açıldı — VKN=" + session.vknTckn +
                " env=" + session.env +
                " endpoint=" + earsivEndpoint
            );
        } catch (error) {
            lastFault = extractSoapFault(error);
            logger.error(
                "[Sovos e-Arşiv WS] Login hatası env=" + session.env +
                " endpoint=" + require("./sovosEArchiveService").ENDPOINT[session.env] +
                " user=" + session.username +
                " vkn=" + session.vknTckn +
                " passLen=" + session.password.length +
                (session.env === "production"
                    ? " hint=cloudtest WS kullanicisi icin env=test (earsivwstest) kullanin"
                    : "") +
                " fault=" + lastFault
            );
            return {
                success: false,
                error: mapSovosLoginError(lastFault, session.env, "earsiv", { passLen: session.password.length }),
                status: 400,
            };
        }
    }

    if (!efaturaOk && !earsivOk) {
        return {
            success: false,
            error: mapSovosLoginError(lastFault, session.env, mode === "earsiv" ? "earsiv" : "efatura"),
            status: 400,
        };
    }

    const sessionId = crypto.randomUUID();
    storeSession(sessionId, {
        ...session,
        capabilities: {
            efatura: efaturaOk,
            earsiv: earsivOk || efaturaOk,
            edespatch: undefined,
            esmm: undefined,
        },
    });

    if (efaturaOk) {
        logger.info("[Sovos WS] Oturum açıldı (e-Fatura) — VKN=" + session.vknTckn + " env=" + session.env);
    }

    const payload = {
        success: true,
        sessionId,
        accessToken: sessionId,
        env: session.env,
        vknTckn: session.vknTckn,
        senderIdentifier: session.senderIdentifier,
        capabilities: {
            efatura: efaturaOk,
            earsiv: earsivOk || efaturaOk,
            edespatch: undefined,
            esmm: undefined,
        },
        verifiedVia: efaturaOk ? "efatura" : "earsiv",
        authMode: session.authMode || "",
    };

    if (!efaturaOk && earsivOk) {
        payload.warning =
            "Bağlantı e-Arşiv servisi üzerinden doğrulandı. e-Fatura için GB etiketi ve e-Fatura lisansı gerekir.";
    } else if (pkCheck.warning) {
        payload.warning = pkCheck.warning;
    }

    return payload;
};

const logout = async ({ sessionId }) => {
    if (sessionId && sessionStore[sessionId]) {
        delete sessionStore[sessionId];
    }
    if (sessionId) {
        await SovosWsSession.deleteOne({ sessionId }).catch(() => {});
    }
    return { success: true };
};

// ─── 2. Mükellef listesi ────────────────────────────────────────────────────
const queryTaxpayer = async ({ sessionId, filterVknTckn, role = "PK", allowBypassCooldown = false }) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı veya süresi doldu" };

    const filterVkn = filterVknTckn ? clean(filterVknTckn) : "";
    const cacheKeyStr = taxpayerCacheKey(session.vknTckn, filterVkn, role);
    const cached = getCachedTaxpayer(cacheKeyStr);
    if (cached) {
        return { success: true, data: cached, cached: true };
    }

    if (!allowBypassCooldown && filterVkn) {
        const cooldown = checkTaxpayerCooldown(session.vknTckn, filterVkn);
        if (!cooldown.allowed) {
            return {
                success: false,
                error: `Mükellef sorgusu çok sık yapılıyor. ${cooldown.waitSec} saniye sonra tekrar deneyin.`,
                rateLimited: true,
            };
        }
    }

    try {
        const identifier = session.senderIdentifier;
        const result = await soapCall(session, "getRAWUserList", {
            getRAWUserListRequest: {
                Identifier: identifier,
                VKN_TCKN: session.vknTckn,
                Role: role,
                Parameters: filterVkn ? ["VKN_TCKN=" + filterVkn] : undefined,
            },
        });
        if (filterVkn) {
            markTaxpayerCall(session.vknTckn, filterVkn);
            setCachedTaxpayer(cacheKeyStr, result);
        }
        return { success: true, data: result };
    } catch (error) {
        logger.error("[Sovos WS] Mükellef sorgu hatası:", extractFault(error));
        return { success: false, error: extractFault(error) };
    }
};

// ─── 3. Belge listeleme ─────────────────────────────────────────────────────
const mapDocType = (documentType) => {
    switch (documentType) {
        case "outgoing-einvoice":
            return { docType: "INVOICE", type: "OUTBOUND", identifierKey: "sender", localType: "e-fatura" };
        case "incoming-einvoice":
            return { docType: "INVOICE", type: "INBOUND", identifierKey: "receiver", localType: "e-fatura-gelen" };
        case "outgoing-envelope":
            return { docType: "ENVELOPE", type: "OUTBOUND", identifierKey: "sender", localType: "zarf-giden" };
        case "incoming-envelope":
            return { docType: "ENVELOPE", type: "INBOUND", identifierKey: "receiver", localType: "zarf-gelen" };
        case "outgoing-app-resp":
            return { docType: "APP_RESP", type: "OUTBOUND", identifierKey: "receiver", localType: "uygulama-yaniti-giden" };
        case "incoming-app-resp":
            return { docType: "APP_RESP", type: "INBOUND", identifierKey: "sender", localType: "uygulama-yaniti-gelen" };
        case "despatch-advice":
        case "incoming-despatch":
            return {
                error: "e-İrsaliye e-Fatura servisinde değil — searchDocuments üzerinden yönlendirilir.",
            };
        case "e-smm":
            return {
                error: "e-SMM e-Fatura servisinde değil — searchDocuments üzerinden yönlendirilir.",
            };
        default:
            return { docType: "INVOICE", type: "OUTBOUND", identifierKey: "sender", localType: "e-fatura" };
    }
};

/** Sovos resmi örnek: 2015-11-12T00:00:00.000+03:00 (UTC değil, TR offset) */
const formatTrDateTime = (d, endOfDay = false) => {
    if (!d || Number.isNaN(d.getTime())) return undefined;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const time = endOfDay ? "23:59:59" : "00:00:00";
    return `${y}-${m}-${day}T${time}.000+03:00`;
};

const toIsoDateTime = (value, endOfDay = false) => {
    if (!value) return undefined;
    const s = String(value).replace(/[^\d]/g, "");
    if (s.length === 8) {
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${endOfDay ? "23:59:59" : "00:00:00"}.000+03:00`;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return formatTrDateTime(d, endOfDay);
};

const parseDateInput = (value, endOfDay = false) => {
    const iso = toIsoDateTime(value, endOfDay);
    return iso ? new Date(iso) : null;
};

/** API en fazla 1 günlük aralık kabul eder — resmi örnekte günlük parçalama yapılır. */
const buildDailyDateRanges = (fromValue, toValue) => {
    const start = parseDateInput(fromValue, false);
    const end = parseDateInput(toValue, true);
    if (!start || !end || start > end) return [];

    const ranges = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= end) {
        const dayStart = new Date(cursor);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(cursor);
        dayEnd.setHours(23, 59, 59, 999);
        if (dayEnd > end) dayEnd.setTime(end.getTime());
        ranges.push({
            fromDate: formatTrDateTime(dayStart, false),
            toDate: formatTrDateTime(dayEnd, true),
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    return ranges;
};

const normalizeUblList = (result, localType) => {
    const body = result?.getUBLListResponse ?? result ?? {};
    let listRaw = body.UBLList ?? body.ublList;

    if (!listRaw && body.UUID) listRaw = body;
    if (!listRaw && Array.isArray(result)) listRaw = result;

    const list = listRaw ? (Array.isArray(listRaw) ? listRaw : [listRaw]) : [];

    return list.map((item) => ({
        id: item.UUID || item.ID,
        uuid: item.UUID,
        number: item.ID || item.CustInvID || "",
        custInvId: item.CustInvID || "",
        date: item.InsertDateTime || "",
        envUuid: item.EnvUUID || "",
        envType: item.EnvType || "",
        status: "sent",
        type: localType,
        vkn: item.VKN_TCKN || item.Identifier || "",
        raw: item,
    }));
};

const getUBLListOnce = async (session, mapped, searchParams) => {
    const identifier = resolveIdentifier(session, mapped.identifierKey);
    const args = {
        getUBLListRequest: {
            Identifier: identifier,
            VKN_TCKN: session.vknTckn,
            DocType: mapped.docType,
            Type: mapped.type,
        },
    };

    if (searchParams.fromDate) args.getUBLListRequest.FromDate = searchParams.fromDate;
    if (searchParams.toDate) args.getUBLListRequest.ToDate = searchParams.toDate;
    if (searchParams.uuid) {
        const uuids = toUuidArray(searchParams.uuid);
        if (uuids.length) args.getUBLListRequest.UUID = uuids.length === 1 ? uuids[0] : uuids;
    }
    if (searchParams.parameters) {
        args.getUBLListRequest.Parameters = searchParams.parameters;
    }

    return soapCall(session, "getUBLList", args);
};

const getUBLList = async ({ sessionId, documentType, searchParams = {}, allowBypassCooldown = false }) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı veya süresi doldu" };

    const mapped = mapDocType(documentType);
    if (mapped.error) return { success: false, error: mapped.error };

    const identifier = resolveIdentifier(session, mapped.identifierKey);
    const caps = session.capabilities || {};
    // Yalnızca doğrulanmış e-Arşiv-only hesaplarda atla (geçerli GB varsa eski capability cache'i yok sayılır)
    if (caps.efatura === false && caps.earsiv === true && mapped.identifierKey === "sender" && !isValidGbIdentifier(identifier)) {
        return {
            success: true,
            data: [],
            message: "Hesabınızda e-Fatura yetkisi yok — getUBLList çağrılmadı (e-Arşiv only).",
            skipped: true,
        };
    }

    if (!identifier) {
        return {
            success: true,
            data: [],
            message: identifierLabel(mapped.identifierKey) + " tanımlı değil — e-Fatura listesi atlandı.",
            skipped: true,
        };
    }

    if (mapped.identifierKey === "sender" && !isValidGbIdentifier(identifier)) {
        logger.warn(
            "[Sovos WS] getUBLList atlandı — GB etiketi urn:mail formatında değil: " + identifier
        );
        return {
            success: false,
            error: "GB etiketi geçersiz. Sovos portalındaki tam urn:mail:... formatını girin (ör. urn:mail:defaultgb@firma.com).",
            skipped: true,
        };
    }

    const fromRaw = searchParams.startDate || searchParams.fromDate;
    const toRaw = searchParams.endDate || searchParams.toDate;
    const hasUuid = Boolean(searchParams.uuid);

    if (!hasUuid) {
        const cooldown = checkListCooldown(session.vknTckn);
        if (!allowBypassCooldown && !cooldown.allowed) {
            return {
                success: false,
                error: `Sovos liste sorgusu çok sık yapılıyor. ${cooldown.waitSec} saniye sonra tekrar deneyin.`,
                rateLimited: true,
            };
        }
    }

    try {
        if (hasUuid || !fromRaw || !toRaw) {
            const result = await getUBLListOnce(session, mapped, {
                fromDate: fromRaw ? toIsoDateTime(fromRaw, false) : undefined,
                toDate: toRaw ? toIsoDateTime(toRaw, true) : undefined,
                uuid: searchParams.uuid,
                parameters: searchParams.parameters,
            });
            const documents = normalizeUblList(result, mapped.localType);
            return { success: true, data: documents };
        }

        const clamped = clampDateRange(fromRaw, toRaw, MAX_LIST_DAYS);
        const ck = cacheKey(
            session.vknTckn,
            documentType,
            clamped.start.toISOString(),
            clamped.end.toISOString()
        );
        const cached = getCachedList(ck);
        if (cached) {
            return { success: true, data: cached, cached: true };
        }

        const ranges = buildDailyDateRanges(clamped.start, clamped.end);
        if (!ranges.length) {
            return { success: false, error: "Geçerli bir tarih aralığı girin" };
        }

        if (!allowBypassCooldown) {
            markListCall(session.vknTckn);
        }

        const seen = new Set();
        const documents = [];
        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            if (i > 0) await sleep(CHUNK_DELAY_MS);
            const result = await getUBLListOnce(session, mapped, {
                fromDate: range.fromDate,
                toDate: range.toDate,
                parameters: searchParams.parameters,
            });
            for (const doc of normalizeUblList(result, mapped.localType)) {
                const key = doc.uuid || doc.id;
                if (key && seen.has(key)) continue;
                if (key) seen.add(key);
                documents.push(doc);
            }
        }

        setCachedList(ck, documents);
        return {
            success: true,
            data: documents,
            meta: {
                dayChunks: ranges.length,
                rangeClamped: clamped.clamped,
                maxDays: MAX_LIST_DAYS,
            },
        };
    } catch (error) {
        const fault = extractFault(error);
        if (isSovosInactiveModuleError(fault)) {
            logger.info("[Sovos WS] e-Fatura modülü aktif değil (5040) — getUBLList atlandı");
            return buildSovosInactiveModuleResult(fault, {
                moduleKey: "efatura",
                moduleLabel: "e-Fatura",
            });
        }
        logger.error(
            "[Sovos WS] getUBLList hatası: " + fault +
            " docType=" + mapped.docType +
            " type=" + mapped.type +
            " identifier=" + (identifier || "(yok)") +
            " vkn=" + session.vknTckn
        );
        return { success: false, error: fault || "getUBLList başarısız" };
    }
};

const searchDocuments = async ({ sessionId, documentType, searchParams, env, allowBypassCooldown = false }) => {
    if (documentType === "earchive") {
        const session = await ensureSession(sessionId);
        if (!session) {
            return { success: false, error: "Oturum bulunamadı" };
        }
        const sovosEArchiveService = require("./sovosEArchiveService");
        const from = searchParams.startDate || searchParams.fromDate;
        const to = searchParams.endDate || searchParams.toDate;
        if (!from || !to) {
            return {
                success: true,
                data: [],
                message: "e-Arşiv listesi için başlangıç ve bitiş tarihi gerekli.",
            };
        }
        return sovosEArchiveService.detailedInvoiceQuery({
            sessionId,
            vkn: session.vknTckn,
            startDate: from,
            endDate: to,
            allowBypassCooldown,
        });
    }

    if (documentType === "despatch-advice" || documentType === "incoming-despatch") {
        const session = await ensureSession(sessionId);
        if (session?.capabilities?.edespatch === false) {
            return {
                success: true,
                data: [],
                skipped: true,
                message: "e-İrsaliye modülü hesabınızda aktif değil — sorgu atlandı.",
            };
        }
        const sovosEDespatchService = require("./sovosEDespatchService");
        const result = await sovosEDespatchService.searchDocuments({
            sessionId,
            documentType,
            searchParams,
            allowBypassCooldown,
        });
        return applyInactiveModuleCapability(sessionId, result);
    }

    if (documentType === "e-smm") {
        const session = await ensureSession(sessionId);
        if (session?.capabilities?.esmm === false) {
            return {
                success: true,
                data: [],
                skipped: true,
                message: "e-SMM modülü hesabınızda aktif değil — sorgu atlandı.",
            };
        }
        const sovosESmmService = require("./sovosESmmService");
        const result = await sovosESmmService.searchDocuments({ sessionId, searchParams });
        return applyInactiveModuleCapability(sessionId, result);
    }

    if (sessionId) {
        return getUBLList({ sessionId, documentType, searchParams, allowBypassCooldown });
    }

    if (env && !sessionId) {
        return {
            success: false,
            error: "Sovos e-Fatura WS oturumu gerekli. Lütfen sağlayıcıyı yeniden bağlayın.",
        };
    }

    return { success: false, error: "Oturum bulunamadı" };
};

// ─── 4. Zarf durumu ─────────────────────────────────────────────────────────
const getEnvelopeStatus = async ({ sessionId, uuid, uuids, includeDocData = false }) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const uuidList = toUuidArray(uuids || uuid);
    if (!uuidList.length) return { success: false, error: "En az bir zarf UUID gerekli" };

    try {
        const req = {
            Identifier: session.senderIdentifier,
            VKN_TCKN: session.vknTckn,
            UUID: uuidList.length === 1 ? uuidList[0] : uuidList,
        };
        if (includeDocData) req.Parameters = ["DOC_DATA"];

        const result = await soapCall(session, "getEnvelopeStatus", {
            getEnvelopeStatusRequest: req,
        });
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

// ─── 5. UBL indir ───────────────────────────────────────────────────────────
const getUBL = async ({
    sessionId,
    uuid,
    uuids,
    docType = "INVOICE",
    type = "OUTBOUND",
    identifierKey,
    parameters = ["zip"],
}) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const uuidList = toUuidArray(uuids || uuid);
    if (!uuidList.length) return { success: false, error: "UUID gerekli" };

    const key = identifierKey || (type === "INBOUND" ? "receiver" : "sender");
    const identifier = resolveIdentifier(session, key);
    if (!identifier) {
        return { success: false, error: `${identifierLabel(key)} tanımlı değil` };
    }

    try {
        const result = await soapCall(session, "getUBL", {
            getUBLRequest: {
                Identifier: identifier,
                VKN_TCKN: session.vknTckn,
                UUID: uuidList.length === 1 ? uuidList[0] : uuidList,
                DocType: docType,
                Type: type,
                Parameters: parameters,
            },
        });

        const body = result?.getUBLResponse ?? result ?? {};
        const docData = body.DocData ?? body.docData;
        const entries = docData ? (Array.isArray(docData) ? docData : [docData]) : [];

        return {
            success: true,
            data: {
                raw: result,
                zipEntries: entries.map((entry) => {
                    const buf = normalizeSovosBinaryData(entry);
                    if (!buf) return { base64: null, size: 0 };
                    return { base64: buf.toString("base64"), size: buf.length, buffer: buf };
                }),
            },
        };
    } catch (error) {
        logger.error("[Sovos WS] getUBL hatası:", extractFault(error));
        return { success: false, error: extractFault(error) };
    }
};

// ─── 6. Fatura görüntü (HTML/PDF) ───────────────────────────────────────────
const getInvoiceView = async ({
    sessionId,
    uuid,
    custInvId,
    type = "OUTBOUND",
    viewFormat = "PDF",
    identifierKey,
}) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    if (!uuid && !custInvId) return { success: false, error: "UUID veya CustInvID gerekli" };

    const key = identifierKey || (type === "INBOUND" ? "receiver" : "sender");
    const identifier = resolveIdentifier(session, key);
    if (!identifier) {
        return { success: false, error: `${identifierLabel(key)} tanımlı değil` };
    }

    try {
        // Resmi SOAP örneği: UUID ve CustInvID ikisi de gönderilir (kullanılmayan boş string)
        const req = {
            UUID: uuid ? clean(uuid) : "",
            CustInvID: custInvId ? clean(custInvId) : "",
            Identifier: identifier,
            VKN_TCKN: session.vknTckn,
            Type: type,
            DocType: String(viewFormat || "PDF").toUpperCase(),
        };

        const result = await soapCall(session, "getInvoiceView", {
            getInvoiceViewRequest: req,
        });

        const body = result?.getInvoiceViewResponse ?? result ?? {};
        const docData = body.DocData ?? body.docData;
        const buf = normalizeSovosBinaryData(docData);
        if (!buf || !buf.length) {
            return { success: false, error: "Fatura görüntüsü boş döndü" };
        }

        const contentType = sniffContentType(
            buf,
            req.DocType === "HTML" ? "text/html; charset=utf-8" : "application/pdf"
        );

        return {
            success: true,
            data: {
                raw: result,
                buffer: buf,
                base64: buf.toString("base64"),
                contentType,
            },
        };
    } catch (error) {
        const fault = extractFault(error);
        logger.error("[Sovos WS] getInvoiceView hatası:", fault || error?.message || String(error));
        return { success: false, error: fault || "getInvoiceView başarısız" };
    }
};

// ─── 7. Uygulama yanıtları ───────────────────────────────────────────────────
const getInvResponses = async ({
    sessionId,
    uuid,
    uuids,
    type = "INBOUND",
    identifierKey,
    parameters,
    includeDocData = false,
}) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const uuidList = toUuidArray(uuids || uuid);
    if (!uuidList.length) return { success: false, error: "Fatura UUID listesi gerekli" };

    const key = identifierKey || (type === "INBOUND" ? "receiver" : "sender");
    const identifier = resolveIdentifier(session, key);
    if (!identifier) {
        return { success: false, error: `${identifierLabel(key)} tanımlı değil` };
    }

    try {
        const req = {
            Identifier: identifier,
            VKN_TCKN: session.vknTckn,
            UUID: uuidList.length === 1 ? uuidList[0] : uuidList,
            Type: type,
        };
        const params = parameters ? [...parameters] : [];
        if (includeDocData && !params.includes("DOC_DATA")) params.push("DOC_DATA");
        if (params.length) req.Parameters = params;

        const result = await soapCall(session, "getInvResponses", {
            getInvResponsesRequest: req,
        });
        return { success: true, data: result };
    } catch (error) {
        logger.error("[Sovos WS] getInvResponses hatası:", extractFault(error));
        return { success: false, error: extractFault(error) };
    }
};

// ─── 8. UBL gönder ───────────────────────────────────────────────────────────
const prepareDocData = ({ docDataBase64, ublXml, fileName }) => {
    if (docDataBase64) {
        return Buffer.from(docDataBase64, "base64");
    }
    if (ublXml) {
        return compressXmlToZip(ublXml, fileName || crypto.randomUUID());
    }
    return null;
};

const parseSendUBL = (result) => {
    const body = result?.sendUBLResponse ?? result ?? {};
    let responses = body.Response ?? body.response;
    if (!responses) {
        return { success: false, error: "Sovos sendUBL yanıtı boş", raw: body };
    }
    const list = Array.isArray(responses) ? responses : [responses];
    const first = list[0] || {};
    const uuid = clean(first.UUID || first.uuid);
    const invoiceNumber = clean(first.ID || first.id);
    const envUuid = clean(first.EnvUUID || first.envUUID);
    if (!uuid && !envUuid) {
        return { success: false, error: "Sovos fatura gönderimi yanıtı geçersiz", raw: body };
    }
    return {
        success: true,
        uuid: uuid || envUuid,
        invoiceNumber,
        envUuid,
        raw: body,
    };
};

const sendUBL = async ({
    sessionId,
    docType,
    docDataBase64,
    ublXml,
    fileName,
    receiverIdentifier,
    senderIdentifier,
    parameters,
}) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const docData = prepareDocData({ docDataBase64, ublXml, fileName });
    if (!docData) {
        return { success: false, error: "Belge verisi gerekli (docDataBase64 veya ublXml)" };
    }

    const normalizedDocType = clean(docType || "INVOICE").toUpperCase();
    let senderId = senderIdentifier || session.senderIdentifier;
    let receiverId = receiverIdentifier || session.receiverIdentifier;

    // APP_RESP: gönderici PK, alıcı GB (resmi örnek)
    if (normalizedDocType === "APP_RESP") {
        senderId = receiverIdentifier || session.receiverIdentifier || senderId;
        receiverId = senderIdentifier || session.senderIdentifier || receiverId;
    }

    if (!senderId || !receiverId) {
        return { success: false, error: "Gönderici ve alıcı etiketleri tanımlı olmalıdır" };
    }

    try {
        const result = await soapCall(session, "sendUBL", {
            sendUBLRequest: {
                VKN_TCKN: session.vknTckn,
                SenderIdentifier: senderId,
                ReceiverIdentifier: receiverId,
                DocType: normalizedDocType,
                Parameters: parameters,
                DocData: docData,
            },
        });
        const parsed = parseSendUBL(result);
        if (!parsed.success) {
            return parsed;
        }
        return { success: true, data: parsed.raw, ...parsed };
    } catch (error) {
        logger.error("[Sovos WS] sendUBL hatası:", extractFault(error));
        return { success: false, error: extractFault(error) };
    }
};

// ─── Uyumluluk katmanı ───────────────────────────────────────────────────────
const getAccessToken = async (params) => login(params);

const checkApiStatus = async ({ sessionId }) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    return { success: true, data: { status: "connected", env: session.env } };
};

const restoreSession = async (credentials) => {
    if (!credentials?.username || !credentials?.password || !credentials?.vknTckn) {
        return { success: false, error: "Kayıtlı Sovos bilgileri eksik" };
    }
    const gb = clean(credentials.senderIdentifier);
    return login({
        username: credentials.username,
        password: credentials.password,
        vknTckn: credentials.vknTckn,
        senderIdentifier: gb,
        receiverIdentifier: credentials.receiverIdentifier,
        branch: credentials.branch || "default",
        env: credentials.env,
        loginMode: isValidGbIdentifier(gb) ? "auto" : "earsiv",
    });
};

/** getRAWUserList yanıtından mükellef kaydı ve PK etiketi çıkar */
const parseEInvoiceRegistration = (raw) => {
    const body = raw?.getRAWUserListResponse ?? raw ?? {};
    const docData = body.DocData ?? body.docData;
    if (!docData) return { isRegistered: false, receiverIdentifier: "" };

    const buf = Buffer.isBuffer(docData) ? docData : Buffer.from(docData);
    if (buf.length < 20) return { isRegistered: false, receiverIdentifier: "" };

    const parsed = parseUserListFromRawResponse(raw);
    return {
        isRegistered: true,
        receiverIdentifier: parsed.identifier || "",
        parsed,
    };
};

/** Alıcı VKN e-Fatura mükellefi mi? (getRAWUserList PK sorgusu) */
const checkEInvoiceUser = async ({ sessionId, vkn }) => {
    const filterVkn = clean(vkn);
    if (!filterVkn || filterVkn === "11111111111") {
        return { success: true, isRegistered: false, receiverIdentifier: "" };
    }

    const result = await queryTaxpayer({ sessionId, filterVknTckn: filterVkn, role: "PK" });
    if (!result.success) {
        return { success: false, error: result.error, isRegistered: false, rateLimited: result.rateLimited };
    }

    const { isRegistered, receiverIdentifier } = parseEInvoiceRegistration(result.data);
    return { success: true, isRegistered, receiverIdentifier };
};

const PLACEHOLDER_VKNS = new Set(["11111111111", "22222222222", "12345678901"]);

/** VKN/TCKN ile alıcı bilgisi — e-Fatura mükellef sorgusu + getRAWUserList (resmi API) */
const lookupCustomer = async ({ sessionId, vkn }) => {
    const vknClean = clean(vkn).replace(/\D/g, "");
    if (!vknClean || vknClean.length < 10 || vknClean.length > 11) {
        return { success: false, error: "Geçerli VKN (10) veya TCKN (11) girin" };
    }
    if (PLACEHOLDER_VKNS.has(vknClean)) {
        return {
            success: true,
            isEfaturaMukellef: false,
            suggestedDocType: "e-arsiv",
            message: "Nihai tüketici — e-Arşiv fatura kesilmelidir.",
            customer: {
                vkn: vknClean,
                name: "Nihai Tuketici",
                firstName: "Nihai",
                lastName: "Tuketici",
            },
        };
    }

    const query = await queryTaxpayer({ sessionId, filterVknTckn: vknClean, role: "PK" });
    if (!query.success) {
        return { success: false, error: query.error || "Mükellef sorgusu başarısız", rateLimited: query.rateLimited };
    }

    const { isRegistered, receiverIdentifier, parsed } = parseEInvoiceRegistration(query.data);

    if (!isRegistered) {
        const isIndividual = vknClean.length === 11;
        return {
            success: true,
            isEfaturaMukellef: false,
            suggestedDocType: "e-arsiv",
            message: "Alıcı e-Fatura mükellefi değil — e-Arşiv fatura kesilmelidir (mevzuat).",
            customer: {
                vkn: vknClean,
                name: isIndividual ? "" : "",
                firstName: isIndividual ? "" : "",
                lastName: isIndividual ? "" : "",
            },
        };
    }

    const isIndividual = vknClean.length === 11;
    const fullName = parsed.name || parsed.title || "";

    return {
        success: true,
        isEfaturaMukellef: true,
        suggestedDocType: "e-fatura",
        receiverIdentifier: receiverIdentifier || parsed.identifier || "",
        message: "Alıcı e-Fatura mükellefi — e-Fatura kesilebilir.",
        customer: {
            vkn: vknClean,
            name: fullName,
            firstName: isIndividual ? (parsed.firstName || fullName.split(" ")[0] || "") : "",
            lastName: isIndividual ? (parsed.lastName || fullName.split(" ").slice(1).join(" ") || "") : "",
            taxOffice: parsed.taxOffice || "",
            city: parsed.city || "",
            district: parsed.district || "",
            street: parsed.street || "",
        },
    };
};

/** Sovos e-Fatura için yerel seri numarası (UBL cbc:ID) */
const buildSovosInvoiceNumber = (seriesCode, seq = Date.now()) => {
    const y = new Date().getFullYear();
    const prefix = String(seriesCode || "LYS").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "A");
    const tail = String(Math.abs(Number(seq) || 0) % 1000000000).padStart(9, "0");
    return `${prefix}${y}${tail}`;
};

const resolveCounterpartyGb = async (sessionId, vknTckn) => {
    const vkn = clean(vknTckn).replace(/\D/g, "");
    if (!vkn) return { success: false, error: "Karşı taraf VKN/TCKN gerekli" };

    const query = await queryTaxpayer({ sessionId, filterVknTckn: vkn, role: "GB" });
    if (!query.success) {
        return { success: false, error: query.error || "GB etiketi sorgulanamadı" };
    }
    const parsed = parseUserListFromRawResponse(query.data);
    const gb = parsed.identifier || "";
    if (!gb) {
        return { success: false, error: "Gönderici GB etiketi bulunamadı (VKN: " + vkn + ")" };
    }
    return { success: true, gb, party: parsed };
};

const validateEInvoiceForm = (invoiceData) => {
    if (!invoiceData) return "Fatura verileri gerekli";
    if (!invoiceData.lines || invoiceData.lines.length === 0) return "En az bir fatura kalemi gerekli";
    if (!invoiceData.supplier || !invoiceData.supplier.vkn) return "Satıcı VKN bilgisi gerekli";
    if (!invoiceData.customer || !invoiceData.customer.vkn) return "Alıcı VKN/TCKN gerekli";
    return null;
};

/** Manuel e-Fatura oluştur ve gönder (sendUBL INVOICE) */
const createEInvoiceFromForm = async ({
    sessionId,
    invoiceData,
    receiverIdentifier,
    profileId = "TICARIFATURA",
    seq = Date.now(),
}) => {
    const formError = validateEInvoiceForm(invoiceData);
    if (formError) return { success: false, error: formError };

    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const pk = clean(receiverIdentifier);
    if (!pk) {
        return { success: false, error: "Alıcı PK etiketi gerekli — mükellef sorgusu yapın veya Sovos ayarlarından PK girin" };
    }
    if (!session.senderIdentifier || !isValidGbIdentifier(session.senderIdentifier)) {
        return { success: false, error: "Geçerli GB etiketi tanımlı değil (urn:mail:...)" };
    }

    const { buildInvoiceXml } = require("../utils/ublBuilder");
    const invoiceNumber = buildSovosInvoiceNumber(
        invoiceData.faturaKodu || invoiceData.invoiceSeriesCode || "LYS",
        seq
    );
    const resolvedProfile = profileId === "TEMELFATURA" ? "TEMELFATURA" : "TICARIFATURA";

    const { xml, uuid, totals } = buildInvoiceXml({
        profileId: resolvedProfile,
        invoiceTypeCode: invoiceData.invoiceTypeCode || "SATIS",
        invoiceNumber,
        issueDate: invoiceData.issueDate,
        currency: invoiceData.currency || "TRY",
        note: invoiceData.note || "",
        sendingType: invoiceData.sendingType || "ELEKTRONIK",
        supplier: invoiceData.supplier || {},
        customer: invoiceData.customer || {},
        lines: invoiceData.lines || [],
    });

    const sendResult = await sendUBL({
        sessionId,
        ublXml: xml,
        fileName: uuid,
        docType: "INVOICE",
        receiverIdentifier: pk,
        senderIdentifier: session.senderIdentifier,
    });

    if (!sendResult.success) {
        return sendResult;
    }

    return {
        success: true,
        uuid: sendResult.uuid || uuid,
        invoiceNumber: sendResult.invoiceNumber || invoiceNumber,
        totals,
        envUuid: sendResult.envUuid,
    };
};

/**
 * Gelen ticari e-Faturaya uygulama yanıtı gönder (KABUL / RED)
 * Resmi akış: sendUBL APP_RESP — gönderici PK, alıcı gönderenin GB etiketi
 */
const sendApplicationResponse = async ({
    sessionId,
    invoiceNumber,
    invoiceIssueDate,
    responseCode,
    counterpartyVkn,
    counterpartyName,
    counterpartyGb,
    ourParty,
}) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const code = String(responseCode || "").toUpperCase();
    if (code !== "KABUL" && code !== "RED") {
        return { success: false, error: "Yanıt kodu KABUL veya RED olmalıdır" };
    }
    const invNo = clean(invoiceNumber);
    if (!invNo) return { success: false, error: "Fatura numarası gerekli" };

    const ourPk = session.receiverIdentifier;
    if (!ourPk) {
        return { success: false, error: "PK (receiver) etiketi tanımlı değil — Sovos ayarlarından girin" };
    }

    let senderGb = clean(counterpartyGb);
    if (!senderGb) {
        const gbResult = await resolveCounterpartyGb(sessionId, counterpartyVkn);
        if (!gbResult.success) return gbResult;
        senderGb = gbResult.gb;
    }

    const issueDate = invoiceIssueDate
        ? String(invoiceIssueDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const { buildApplicationResponseXml } = require("../utils/ublBuilder");
    const { xml, uuid } = buildApplicationResponseXml({
        responseCode: code,
        invoiceNumber: invNo,
        invoiceIssueDate: issueDate,
        ourParty: {
            vkn: ourParty?.vkn || session.vknTckn,
            name: ourParty?.name || "",
            taxOffice: ourParty?.taxOffice || "",
            street: ourParty?.street || "",
            district: ourParty?.district || "Merkez",
            city: ourParty?.city || "Istanbul",
            country: ourParty?.country || "Turkiye",
        },
        counterparty: {
            vkn: counterpartyVkn,
            name: counterpartyName || "",
            district: "Merkez",
            city: "Istanbul",
            country: "Turkiye",
        },
    });

    const sendResult = await sendUBL({
        sessionId,
        ublXml: xml,
        fileName: uuid,
        docType: "APP_RESP",
        senderIdentifier: senderGb,
        receiverIdentifier: ourPk,
    });

    if (!sendResult.success) {
        return sendResult;
    }

    return {
        success: true,
        uuid: sendResult.uuid || uuid,
        responseCode: code,
        invoiceNumber: invNo,
        envUuid: sendResult.envUuid,
    };
};

const resolveSessionId = async (sessionId, credentials) => {
    if (sessionId && (await ensureSession(sessionId))) {
        return { sessionId, restored: false };
    }
    if (!credentials) {
        return { sessionId: null, restored: false, error: "Oturum bulunamadı veya süresi doldu" };
    }
    const restored = await restoreSession(credentials);
    if (!restored.success) {
        return { sessionId: null, restored: false, error: restored.error };
    }
    return { sessionId: restored.sessionId, restored: true };
};

const getPartialUserList = async ({
    sessionId,
    identifier,
    vknTckn,
    role = "GB",
    includeBinary = false,
    fileNameList = [],
    parameters = [],
}) => {
    const session = await ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const names = Array.isArray(fileNameList) ? fileNameList.map((f) => clean(f)).filter(Boolean) : [];
    if (!names.length) {
        return {
            success: false,
            error:
                "getPartialUserList yalnızca GB/PK toplu liste parçası indirmek içindir (fileNameList zorunlu). " +
                "Tekil mükellef sorgusu için getRAWUserList / customer/lookup kullanın.",
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
        Identifier: clean(identifier || session.senderIdentifier),
        VKN_TCKN: clean(vknTckn || session.vknTckn),
        Role: clean(role) || "GB",
        IncludeBinary: includeBinary === true || includeBinary === 1 || includeBinary === "true",
        FileNameList: { fileName: names },
    };
    if (parameters?.length) {
        req.Parameters = parameters.map((p) => clean(p));
    }

    try {
        markPartialListCall(session.vknTckn);
        const result = await soapCall(session, "getPartialUserList", { getPartialUserListRequest: req });
        return { success: true, data: result?.getPartialUserListResponse ?? result ?? {} };
    } catch (error) {
        return { success: false, error: extractFault(error) };
    }
};

module.exports = {
    patchSessionCapabilities,
    applyInactiveModuleCapability,
    login,
    logout,
    queryTaxpayer,
    getPartialUserList,
    getUBLList,
    searchDocuments,
    getEnvelopeStatus,
    getUBL,
    getInvoiceView,
    getInvResponses,
    sendUBL,
    createEInvoiceFromForm,
    sendApplicationResponse,
    resolveCounterpartyGb,
    getAccessToken,
    checkApiStatus,
    restoreSession,
    resolveSessionId,
    ensureSession,
    getSession,
    compressXmlToZip,
    decompressZipEntry,
    checkEInvoiceUser,
    lookupCustomer,
    buildSovosInvoiceNumber,
    parseSendUBL,
    WSDL,
    ENDPOINT,
};
