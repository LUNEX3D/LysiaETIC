const path = require("path");
const axios = require("axios");
const soap = require("soap");
const logger = require("../config/logger");
const { extractSoapFault, buildSovosInactiveModuleResult, isSovosInactiveModuleError } = require("../utils/sovosSoapFault");
const { getSovosTlsOptions, createSovosHttpsAgent } = require("../utils/sovosTls");
const { applySovosSoapSecurity, resolveAuthModes, normalizeEarsivAuthMode } = require("../utils/sovosSoapAuth");
const { buildBasicAuthHeader } = require("../utils/sovosHttpSoap");
const { checkListCooldown, markListCall, clampDateRange, MAX_LIST_DAYS, sleep, CHUNK_DELAY_MS, isValidGbIdentifier, checkPartialListCooldown, markPartialListCall } = require("../utils/sovosApiGuard");
const sovosEInvoiceService = require("./sovosEInvoiceService");
const { normalizeSovosBinaryData, sniffContentType } = require("../utils/sovosBinaryData");

/**
 * SOVOS BULUT e-İRSALİYE WS API v1.3 — ClientEDespatchServicesPort
 * Resmi endpoint: efaturawstest / efaturaws .fitbulut.com/ClientEDespatchServicePort.svc
 */

const LOCAL_WSDL = path.join(__dirname, "../assets/sovos-wsdl/despatch/ClientEDespatchServices-1.1.wsdl");

const WSDL = {
    test: process.env.SOVOS_EDESPATCH_TEST_WSDL || LOCAL_WSDL,
    production:
        process.env.SOVOS_EDESPATCH_PROD_WSDL ||
        "https://efaturaws.fitbulut.com/ClientEDespatchServices-1.1.wsdl",
};

const ENDPOINT = {
    test:
        process.env.SOVOS_EDESPATCH_TEST_URL ||
        "https://efaturawstest.fitbulut.com/ClientEDespatchServicePort.svc",
    production:
        process.env.SOVOS_EDESPATCH_PROD_URL ||
        "https://efaturaws.fitbulut.com/ClientEDespatchServicePort.svc",
};

const clean = (s) => String(s || "").trim();
const getWsdlUrl = (env) => WSDL[env] || WSDL.test;
const getEndpoint = (env) => ENDPOINT[env] || ENDPOINT.test;

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

const resolveIdentifier = (session, identifierKey) => {
    if (identifierKey === "receiver") return session.receiverIdentifier;
    return session.senderIdentifier;
};

const mapDocType = (documentType) => {
    switch (documentType) {
        case "incoming-despatch":
            return { docType: "DESPATCH", type: "INBOUND", identifierKey: "receiver", localType: "e-irsaliye-gelen" };
        case "despatch-advice":
        default:
            return { docType: "DESPATCH", type: "OUTBOUND", identifierKey: "sender", localType: "e-irsaliye" };
    }
};

const toDespatchDate = (value, endOfDay = false) => {
    if (!value) return undefined;
    const s = String(value).replace(/[^\d]/g, "");
    if (s.length === 8) {
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const buildDailyRanges = (fromValue, toValue) => {
    const start = toDespatchDate(fromValue);
    const end = toDespatchDate(toValue, true);
    if (!start || !end) return [];

    const startD = new Date(start);
    const endD = new Date(end);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime()) || startD > endD) return [];

    const ranges = [];
    const cursor = new Date(startD);
    while (cursor <= endD) {
        const day = toDespatchDate(cursor);
        ranges.push({ fromDate: day, toDate: day });
        cursor.setDate(cursor.getDate() + 1);
    }
    return ranges;
};

const normalizeDesList = (result, localType) => {
    const body = result?.getDesUBLListResponse ?? result ?? {};
    let listRaw = body.Response ?? body.response;
    if (!listRaw && body.UUID) listRaw = body;
    const list = listRaw ? (Array.isArray(listRaw) ? listRaw : [listRaw]) : [];

    return list.map((item) => ({
        id: item.UUID || item.ID,
        uuid: item.UUID || "",
        number: item.ID || "",
        envUuid: item.EnvUUID || "",
        date: item.InsertDateTime || "",
        status: "sent",
        type: localType,
        vkn: item.VKN_TCKN || item.Identifier || "",
        raw: item,
    }));
};

const getDesUBLListOnce = async (session, mapped, searchParams) => {
    const identifier = resolveIdentifier(session, mapped.identifierKey);
    const req = {
        Identifier: identifier,
        VKN_TCKN: session.vknTckn,
        DocType: mapped.docType,
        Type: mapped.type,
    };
    if (searchParams.fromDate) req.FromDate = searchParams.fromDate;
    if (searchParams.toDate) req.ToDate = searchParams.toDate;
    if (searchParams.uuid) req.UUID = clean(searchParams.uuid);
    if (searchParams.parameters) req.Parameters = searchParams.parameters;

    return soapCall(session, "getDesUBLList", { getDesUBLListRequest: req });
};

const searchDocuments = async ({ sessionId, documentType, searchParams = {}, allowBypassCooldown = false }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const mapped = mapDocType(documentType);
    const identifier = resolveIdentifier(session, mapped.identifierKey);
    if (!identifier) {
        return {
            success: true,
            data: [],
            message: (mapped.identifierKey === "receiver" ? "PK" : "GB") + " etiketi tanımlı değil — e-İrsaliye listesi atlandı.",
            skipped: true,
        };
    }
    if (mapped.identifierKey === "sender" && !isValidGbIdentifier(identifier)) {
        return {
            success: false,
            error: "GB etiketi geçersiz. e-İrsaliye için urn:mail:... formatında GB etiketi gerekli.",
            skipped: true,
        };
    }

    const fromRaw = searchParams.startDate || searchParams.fromDate;
    const toRaw = searchParams.endDate || searchParams.toDate;
    const hasUuid = Boolean(searchParams.uuid);

    if (!hasUuid) {
        const cooldown = checkListCooldown(session.vknTckn + ":despatch");
        if (!allowBypassCooldown && !cooldown.allowed) {
            return {
                success: false,
                error: `Sovos e-İrsaliye sorgu limiti — ${cooldown.waitSec} saniye bekleyin.`,
                rateLimited: true,
            };
        }
    }

    const ranges = hasUuid
        ? [{ fromDate: undefined, toDate: undefined }]
        : buildDailyRanges(fromRaw, toRaw);

    if (!hasUuid && !ranges.length) {
        return { success: true, data: [], message: "e-İrsaliye listesi için tarih aralığı gerekli." };
    }

    if (!hasUuid && !allowBypassCooldown) {
        markListCall(session.vknTckn + ":despatch");
    }

    const allDocs = [];
    try {
        for (let i = 0; i < ranges.length; i++) {
            if (i > 0) await sleep(CHUNK_DELAY_MS);
            const range = ranges[i];
            const params = { ...searchParams, ...range };
            if (hasUuid) params.uuid = searchParams.uuid;
            const result = await getDesUBLListOnce(session, mapped, params);
            allDocs.push(...normalizeDesList(result, mapped.localType));
        }
        return { success: true, data: allDocs };
    } catch (error) {
        const fault = extractSoapFault(error);
        if (isSovosInactiveModuleError(fault)) {
            logger.info("[Sovos e-İrsaliye] Modül aktif değil (5040) — getDesUBLList atlandı");
            return buildSovosInactiveModuleResult(fault, {
                moduleKey: "edespatch",
                moduleLabel: "e-İrsaliye",
            });
        }
        logger.error("[Sovos e-İrsaliye] getDesUBLList hatası:", fault);
        return { success: false, error: fault || "getDesUBLList başarısız" };
    }
};

const getDesUBL = async ({ sessionId, uuid, type = "OUTBOUND", identifierKey, parameters = ["zip"] }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    if (!uuid) return { success: false, error: "UUID gerekli" };

    const key = identifierKey || (type === "INBOUND" ? "receiver" : "sender");
    const identifier = resolveIdentifier(session, key);
    if (!identifier) {
        return { success: false, error: (key === "receiver" ? "PK" : "GB") + " etiketi tanımlı değil" };
    }

    try {
        const result = await soapCall(session, "getDesUBL", {
            getDesUBLRequest: {
                Identifier: identifier,
                VKN_TCKN: session.vknTckn,
                UUID: clean(uuid),
                DocType: "DESPATCH",
                Type: type,
                Parameters: parameters,
            },
        });
        const body = result?.getDesUBLResponse ?? result ?? {};
        const docData = body.DocData ?? body.docData;
        const entries = docData ? (Array.isArray(docData) ? docData : [docData]) : [];
        return {
            success: true,
            data: {
                raw: result,
                zipEntries: entries.map((entry) => {
                    const buf = Buffer.isBuffer(entry) ? entry : Buffer.from(entry);
                    return { base64: buf.toString("base64"), size: buf.length };
                }),
            },
        };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const getDesView = async ({
    sessionId,
    uuid,
    custInvId,
    type = "OUTBOUND",
    viewFormat = "PDF",
    identifierKey,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    if (!uuid && !custInvId) return { success: false, error: "UUID veya CustInvID gerekli" };

    const key = identifierKey || (type === "INBOUND" ? "receiver" : "sender");
    const identifier = resolveIdentifier(session, key);
    if (!identifier) {
        return { success: false, error: (key === "receiver" ? "PK" : "GB") + " etiketi tanımlı değil" };
    }

    const docDetails = {
        Type: type,
        DocType: "DESPATCH",
        ViewType: String(viewFormat || "PDF").toUpperCase(),
    };
    if (uuid) docDetails.UUID = clean(uuid);
    if (custInvId) docDetails.CustInvID = clean(custInvId);

    try {
        const result = await soapCall(session, "getDesView", {
            getDesViewRequest: {
                Identifier: identifier,
                VKN_TCKN: session.vknTckn,
                DocDetails: docDetails,
            },
        });
        const body = result?.getDesViewResponse ?? result ?? {};
        const docData = body.DocData ?? body.docData;
        const buf = normalizeSovosBinaryData(docData);
        const format = String(viewFormat || "PDF").toUpperCase();
        if (!buf || !buf.length) {
            return { success: false, error: "e-İrsaliye görüntüsü boş" };
        }
        return {
            success: true,
            data: {
                raw: result,
                buffer: buf,
                base64: buf.toString("base64"),
                contentType: sniffContentType(buf, format === "HTML" ? "text/html; charset=utf-8" : "application/pdf"),
            },
        };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const getDesEnvelopeStatus = async ({ sessionId, uuid, uuids }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const uuidList = (Array.isArray(uuids) ? uuids : [uuids || uuid]).map(clean).filter(Boolean);
    if (!uuidList.length) return { success: false, error: "Zarf UUID gerekli" };

    try {
        const result = await soapCall(session, "getDesEnvelopeStatus", {
            getDesEnvelopeStatusRequest: {
                Identifier: session.senderIdentifier,
                VKN_TCKN: session.vknTckn,
                UUID: uuidList.length === 1 ? uuidList[0] : uuidList,
            },
        });
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const sendDesUBL = async ({
    sessionId,
    zipBuffer,
    fileName,
    receiverIdentifier,
    docType = "DESPATCH",
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    if (!session.senderIdentifier) {
        return { success: false, error: "GB etiketi tanımlı değil" };
    }

    const binaryData = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
    try {
        const result = await soapCall(session, "sendDesUBL", {
            sendDesUBLRequest: {
                VKN_TCKN: session.vknTckn,
                SenderIdentifier: session.senderIdentifier,
                ReceiverIdentifier: clean(receiverIdentifier),
                DocType: docType,
                DocData: binaryData,
                FileName: clean(fileName) || "despatch.zip",
            },
        });
        const body = result?.sendDesUBLResponse ?? result ?? {};
        return { success: true, data: body };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const getDesReceipts = async ({
    sessionId,
    identifier,
    vknTckn,
    uuid,
    uuids,
    type = "INBOUND",
    parameters = [],
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const uuidList = uuids || (uuid ? [uuid] : []);
    if (!uuidList.length) return { success: false, error: "En az bir UUID gerekli" };

    const req = {
        Identifier: clean(identifier || session.senderIdentifier),
        VKN_TCKN: clean(vknTckn || session.vknTckn),
        UUID: uuidList.length === 1 ? uuidList[0] : uuidList,
        Type: clean(type) || "INBOUND",
    };
    if (parameters?.length) req.Parameters = parameters.map((p) => clean(p));

    try {
        const result = await soapCall(session, "getDesReceipts", { getDesReceiptsRequest: req });
        return { success: true, data: result?.getDesReceiptsResponse ?? result ?? {} };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const getDesUserList = async ({ sessionId, identifier, vknTckn, role = "PK", parameters = [] }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const req = {
        Identifier: clean(identifier || session.senderIdentifier),
        VKN_TCKN: clean(vknTckn || session.vknTckn),
        Role: clean(role) || "PK",
    };
    if (parameters?.length) req.Parameters = parameters.map((p) => clean(p));

    try {
        const result = await soapCall(session, "getDesUserList", { getDesUserListRequest: req });
        const body = result?.getDesUserListResponse ?? result ?? {};
        const docData = body.DocData ?? body.docData;
        return {
            success: true,
            data: {
                raw: body,
                base64: docData ? (Buffer.isBuffer(docData) ? docData.toString("base64") : String(docData)) : null,
            },
        };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const getDesPartialUserList = async ({
    sessionId,
    identifier,
    vknTckn,
    role = "PK",
    includeBinary = false,
    fileNameList = [],
    parameters = [],
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const names = Array.isArray(fileNameList) ? fileNameList.map((f) => String(f || "").trim()).filter(Boolean) : [];
    if (!names.length) {
        return {
            success: false,
            error:
                "getDesPartialUserList yalnızca toplu kullanıcı listesi parçası indirmek içindir (fileNameList zorunlu).",
        };
    }

    const cooldown = checkPartialListCooldown(session.vknTckn);
    if (!cooldown.allowed) {
        return {
            success: false,
            error: `getDesPartialUserList çok sık çağrıldı. ${cooldown.waitSec} saniye sonra tekrar deneyin.`,
            rateLimited: true,
        };
    }

    const req = {
        Identifier: String(identifier || session.senderIdentifier || "").trim(),
        VKN_TCKN: String(vknTckn || session.vknTckn || "").trim(),
        Role: String(role || "PK").trim() || "PK",
        IncludeBinary: includeBinary === true || includeBinary === 1 || includeBinary === "true",
        FileNameList: { fileName: names },
    };
    if (parameters?.length) req.Parameters = parameters.map((p) => String(p || "").trim());

    try {
        markPartialListCall(session.vknTckn);
        const result = await soapCall(session, "getDesPartialUserList", { getDesPartialUserListRequest: req });
        return { success: true, data: result?.getDesPartialUserListResponse ?? result ?? {} };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

module.exports = {
    searchDocuments,
    getDesUBL,
    getDesView,
    getDesEnvelopeStatus,
    sendDesUBL,
    getDesReceipts,
    getDesUserList,
    getDesPartialUserList,
    mapDocType,
    WSDL,
    ENDPOINT,
};
