const path = require("path");
const axios = require("axios");
const soap = require("soap");
const logger = require("../config/logger");
const { extractSoapFault, buildSovosInactiveModuleResult, isSovosInactiveModuleError } = require("../utils/sovosSoapFault");
const { getSovosTlsOptions, createSovosHttpsAgent } = require("../utils/sovosTls");
const { applySovosSoapSecurity, resolveAuthModes, normalizeEarsivAuthMode } = require("../utils/sovosSoapAuth");
const { buildBasicAuthHeader } = require("../utils/sovosHttpSoap");
const sovosEInvoiceService = require("./sovosEInvoiceService");
const { parseYearMonth } = require("../utils/sovosDateTime");

/**
 * SOVOS BULUT e-SMM WS API v1.1 — ForibaESmmServicesPort
 * Resmi endpoint: earsivwstest / earsivws .fitbulut.com/ClientESmmServicesPort.svc
 */

const LOCAL_WSDL = path.join(__dirname, "../assets/sovos-wsdl/esmm/ForibaESmmServices.wsdl");

const WSDL = {
    test: process.env.SOVOS_ESMM_TEST_WSDL || LOCAL_WSDL,
    production:
        process.env.SOVOS_ESMM_PROD_WSDL ||
        "https://earsivws.fitbulut.com/ForibaESmmServices.wsdl",
};

const ENDPOINT = {
    test:
        process.env.SOVOS_ESMM_TEST_URL ||
        "https://earsivwstest.fitbulut.com/ClientESmmServicesPort.svc",
    production:
        process.env.SOVOS_ESMM_PROD_URL ||
        "https://earsivws.fitbulut.com/ClientESmmServicesPort.svc",
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

const parseDocBuffer = (docData) => {
    if (!docData) return null;
    const buf = Buffer.isBuffer(docData) ? docData : Buffer.from(docData);
    return { base64: buf.toString("base64"), size: buf.length };
};

const sendDocument = async ({
    sessionId,
    uuid,
    zipBuffer,
    branch = "default",
    viewType = "PDF",
    parameters,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const binaryData = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
    const docUuid = clean(uuid) || require("crypto").randomUUID();

    try {
        const result = await soapCall(session, "sendDocument", {
            sendDocumentRequest: {
                VKN_TCKN: session.vknTckn,
                Branch: clean(branch) || clean(session.branch) || "default",
                SendDocDetails: {
                    UUID: docUuid,
                    Type: "SMM",
                    DocType: "XML",
                    DocData: binaryData,
                    ViewType: String(viewType || "PDF").toUpperCase(),
                    ...(parameters?.length ? {
                        Parameters: parameters.map((p) => ({
                            Name: p.name || p.Name,
                            Value: p.value || p.Value,
                        })),
                    } : {}),
                },
            },
        });
        const body = result?.sendDocumentResponse ?? result ?? {};
        return { success: true, data: { uuid: docUuid, raw: body } };
    } catch (error) {
        logger.error("[Sovos e-SMM] sendDocument hatası:", extractSoapFault(error));
        return { success: false, error: extractSoapFault(error) };
    }
};

const getDocument = async ({
    sessionId,
    uuid,
    documentId,
    custDocId,
    viewType = "PDF",
    docType = "XML",
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    if (!uuid && !documentId && !custDocId) {
        return { success: false, error: "UUID, belge numarası veya CustDocID gerekli" };
    }

    const details = {
        Type: "SMM",
        DocType: String(docType || "XML").toUpperCase(),
        ViewType: String(viewType || "PDF").toUpperCase(),
    };
    if (uuid) details.UUID = clean(uuid);
    if (documentId) details.ID = clean(documentId);
    if (custDocId) details.CustDocID = clean(custDocId);

    try {
        const result = await soapCall(session, "getDocument", {
            getDocumentRequest: {
                VKN_TCKN: session.vknTckn,
                GetDocDetails: details,
            },
        });
        const body = result?.getDocumentResponse ?? result ?? {};
        const rows = body.getDocumentResponse ?? body;
        const row = Array.isArray(rows) ? rows[0] : rows;
        const docData = row?.DocData ?? body.DocData ?? body.docData;
        const parsed = parseDocBuffer(docData);
        const format = String(viewType || "PDF").toUpperCase();
        return {
            success: Boolean(parsed),
            data: {
                raw: body,
                base64: parsed?.base64 || null,
                contentType: format === "HTML" ? "text/html" : format === "XML" ? "application/xml" : "application/pdf",
            },
            error: parsed ? undefined : "Belge içeriği boş",
        };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const cancelDocument = async ({
    sessionId,
    uuid,
    documentId,
    branch = "default",
    cancelDate,
    totalAmount,
}) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    const docId = clean(documentId);
    const docUuid = clean(uuid);
    if (!docId && !docUuid) return { success: false, error: "İptal için UUID veya belge numarası gerekli" };

    const cancelDetails = {
        Type: "SMM",
        DocType: "XML",
        TotalAmount: Number(totalAmount) || 0,
        CancelDate: cancelDate || new Date().toISOString().slice(0, 10),
    };
    if (docId) cancelDetails.ID = docId;
    if (docUuid) cancelDetails.UUID = docUuid;

    try {
        const result = await soapCall(session, "cancelDocument", {
            cancelDocumentRequest: {
                VKN_TCKN: session.vknTckn,
                Branch: clean(branch) || clean(session.branch) || "default",
                CancelDocDetails: cancelDetails,
            },
        });
        const body = result?.cancelDocumentResponse ?? result ?? {};
        return { success: true, data: body };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

const getReportList = async ({ sessionId, vknTckn, type = "SMM", docType = "XML", year, month, startDate, endDate, parameters = [] }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };

    let reportYear = Number(year);
    let reportMonth = Number(month);
    if (!reportYear || !reportMonth) {
        const ym = parseYearMonth(startDate, endDate);
        if (!ym) return { success: false, error: "Yıl/ay veya tarih aralığı gerekli" };
        reportYear = ym.year;
        reportMonth = ym.month;
    }

    try {
        const req = {
            VKN_TCKN: clean(vknTckn || session.vknTckn),
            Type: clean(type) || "SMM",
            DocType: clean(docType) || "XML",
            Year: reportYear,
            Month: reportMonth,
        };
        if (parameters?.length) {
            req.Parameters = parameters.map((p) => ({
                Name: p.name || p.Name,
                Value: p.value || p.Value,
            }));
        }
        const result = await soapCall(session, "getReportList", { getReportListRequest: req });
        const body = result?.getReportListResponse ?? result ?? {};
        let reports = body.getReportList ?? body.Reports ?? body.reports;
        if (reports && !Array.isArray(reports)) reports = [reports];
        return { success: true, data: reports || [] };
    } catch (error) {
        const fault = extractSoapFault(error);
        if (isSovosInactiveModuleError(fault)) {
            logger.info("[Sovos e-SMM] Modül aktif değil (5040) — getReportList atlandı");
            return buildSovosInactiveModuleResult(fault, {
                moduleKey: "esmm",
                moduleLabel: "e-SMM",
            });
        }
        return { success: false, error: fault };
    }
};

const getReportData = async ({ sessionId, vknTckn, uuid, type = "SMM", docType = "XML", parameters = [] }) => {
    const session = await sovosEInvoiceService.ensureSession(sessionId);
    if (!session) return { success: false, error: "Oturum bulunamadı" };
    if (!uuid) return { success: false, error: "Rapor UUID gerekli" };

    const item = {
        UUID: clean(uuid),
        Type: clean(type) || "SMM",
        DocType: clean(docType) || "XML",
    };
    if (parameters?.length) {
        item.Parameters = parameters.map((p) => ({
            Name: p.name || p.Name,
            Value: p.value || p.Value,
        }));
    }

    try {
        const result = await soapCall(session, "getReportData", {
            getReportDataRequest: {
                VKN_TCKN: clean(vknTckn || session.vknTckn),
                GetDocReportData: item,
            },
        });
        const body = result?.getReportDataResponse ?? result ?? {};
        const rows = body.getDocReportData ?? body;
        const row = Array.isArray(rows) ? rows[0] : rows;
        const docData = row?.DocData ?? body.DocData;
        const parsed = parseDocBuffer(docData);
        return {
            success: Boolean(parsed),
            data: { raw: body, base64: parsed?.base64 || null },
            error: parsed ? undefined : "Rapor verisi boş",
        };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) };
    }
};

/** e-SMM için resmi API'de belge listesi yok — getReportList ile rapor özeti döner */
const searchDocuments = async ({ sessionId, searchParams = {} }) => {
    const from = searchParams.startDate || searchParams.fromDate;
    const to = searchParams.endDate || searchParams.toDate;
    if (!from || !to) {
        return {
            success: true,
            data: [],
            message: "e-SMM için tarih aralığı gerekli (rapor listesi). Tek belge için UUID ile getDocument kullanın.",
        };
    }
    const result = await getReportList({ sessionId, startDate: from, endDate: to });
    if (!result.success) return result;

    const documents = (result.data || []).map((item, idx) => ({
        id: item.UUID || item.uuid || item.reportId || "smm-report-" + idx,
        uuid: item.UUID || item.uuid || "",
        number: item.periodCode || item.reportName || item.ReportName || "",
        date: item.SectionStartDate || item.startDate || "",
        status: String(item.GIBStatusDesc || item.status || "report").toLowerCase(),
        type: "e-smm",
        raw: item,
    }));

    return { success: true, data: documents, message: "e-SMM rapor listesi (resmi API — belge listesi değil)" };
};

const actionService = async ({
    sessionId,
    senderId,
    branch,
    documentId,
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
    if (documentId) req.ID = clean(documentId);
    if (parameters?.length) {
        req.Parameters = parameters.map((p) => ({
            Name: p.name || p.Name,
            Value: p.value || p.Value,
        }));
    }

    try {
        const result = await soapCall(session, "actionService", {
            actionServiceRequest: {
                actionServiceRequestType: req,
            },
        });
        const body = result?.actionServiceResponseType ?? result?.actionServiceResponse ?? result ?? {};
        return { success: true, data: body };
    } catch (error) {
        return { success: false, error: extractSoapFault(error) || error.message };
    }
};

module.exports = {
    sendDocument,
    getDocument,
    cancelDocument,
    getReportList,
    getReportData,
    searchDocuments,
    actionService,
    WSDL,
    ENDPOINT,
};
