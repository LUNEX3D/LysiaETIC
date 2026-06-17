const axios = require("axios");
const crypto = require("crypto");
const { createSovosHttpsAgent } = require("./sovosTls");
const { extractSoapFault, isSovosAlreadyCancelledError, parseSovosProcessingFault } = require("./sovosSoapFault");
const { normalizeSovosEArchiveInvoiceNumber } = require("./sovosEArchiveInvoiceNumber");

const clean = (s) => String(s || "").trim();
const rawPass = (s) => (s == null ? "" : String(s));

const getHttpsAgent = () => createSovosHttpsAgent();

const buildBasicAuthHeader = (username, password) => {
    const token = Buffer.from(`${clean(username)}:${rawPass(password)}`, "utf8").toString("base64");
    return `Basic ${token}`;
};

const soapActionHeader = (action) => {
    const name = String(action || "").replace(/^\"|\"$/g, "");
    return `"${name}"`;
};

const EARCHIVE_INVOICE_NS = "http://fitcons.com/earchive/invoice";

const escXml = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const extractXmlTag = (text, tag) => {
    const m = String(text || "").match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)<`, "i"));
    return m ? String(m[1]).trim() : "";
};

const extractXmlBinaryTag = (text, tags) => {
    const names = Array.isArray(tags) ? tags : [tags];
    for (const tag of names) {
        const m = String(text || "").match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i"));
        if (m && m[1]) return String(m[1]).replace(/\s+/g, "").trim();
    }
    return "";
};

/** Resmi generateInvIDRequest.xml — invIdGenerationRequest, Cust_inv_id büyük/küçük harf resmi örnekte böyle */
const buildGenerateInvIdEnvelope = ({
    identifier,
    vknTckn,
    branch = "default",
    issueDate,
    custInvId = "LYSIA_LOGIN",
}) => {
    const issue = issueDate || new Date().toISOString().slice(0, 10);
    const idValue = escXml(clean(identifier || vknTckn));
    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:inv="' + EARCHIVE_INVOICE_NS + '">' +
        "<soapenv:Header/>" +
        "<soapenv:Body>" +
        "<inv:invIdGenerationRequest>" +
        "<Identifier>" + idValue + "</Identifier>" +
        "<Branch>" + escXml(clean(branch)) + "</Branch>" +
        "<Cust_inv_id>" + escXml(clean(custInvId) || "LYSIA_LOGIN") + "</Cust_inv_id>" +
        "<Issue_date>" + escXml(issue) + "</Issue_date>" +
        "</inv:invIdGenerationRequest>" +
        "</soapenv:Body>" +
        "</soapenv:Envelope>"
    );
};

/**
 * Resmi getStatus/getSignedInvoice/getInvoiceDocument — dört lookup alanı hep gönderilir;
 * kullanılmayanlar boş tag (getStatusRequest.xml satır 10-12).
 */
const buildEArchiveLookupEnvelope = ({
    requestElement,
    fields = {},
    outputType,
}) => {
    const f = fields || {};
    let inner =
        "<UUID>" + escXml(f.UUID ?? "") + "</UUID>" +
        "<vkn>" + escXml(f.vkn ?? "") + "</vkn>" +
        "<invoiceNumber>" + escXml(f.invoiceNumber ?? "") + "</invoiceNumber>";

    if (requestElement === "getInvoiceDocumentRequestType") {
        inner += "<outputType>" + escXml(String(outputType || "PDF").toUpperCase()) + "</outputType>";
    }

    inner += "<custInvID>" + escXml(f.custInvID ?? "") + "</custInvID>";

    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:inv="' + EARCHIVE_INVOICE_NS + '">' +
        "<soapenv:Header/>" +
        "<soapenv:Body>" +
        "<inv:" + requestElement + ">" +
        inner +
        "</inv:" + requestElement + ">" +
        "</soapenv:Body>" +
        "</soapenv:Envelope>"
    );
};

const buildGetStatusEnvelope = (fields) =>
    buildEArchiveLookupEnvelope({ requestElement: "getStatusRequestType", fields });

const buildGetSignedInvoiceEnvelope = (fields) =>
    buildEArchiveLookupEnvelope({ requestElement: "getSignedInvoiceRequestType", fields });

const buildGetInvoiceDocumentEnvelope = (fields, outputType) =>
    buildEArchiveLookupEnvelope({ requestElement: "getInvoiceDocumentRequestType", fields, outputType });

const buildEArchiveGetUserListEnvelope = ({ vknTckn }) =>
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:get="http:/fitcons.com/earchive/getuserlist">' +
    "<soapenv:Header/>" +
    "<soapenv:Body>" +
    "<get:getUserListRequest>" +
    "<get:vknTckn>" +
    clean(vknTckn) +
    "</get:vknTckn>" +
    "</get:getUserListRequest>" +
    "</soapenv:Body>" +
    "</soapenv:Envelope>";

const isSoapFaultBody = (body) => /<[^>]*:?Fault[\s>]/i.test(body) || /faultcode/i.test(body);

const parseGenerateInvIdSuccess = (body) => {
    const text = String(body || "");
    if (!text || isSoapFaultBody(text)) return false;

    const statusMatch = text.match(/<(?:[\w-]+:)?StatusCode[^>]*>(\d+)<\//i);
    if (statusMatch) {
        const code = Number(statusMatch[1]);
        return code === 10 || code === 0;
    }

    return /<(?:[\w-]+:)?Invoice_ID[^>]*>[^<]+</i.test(text)
        && /<(?:[\w-]+:)?UUID[^>]*>[^<]+</i.test(text);
};

const postSoap = async ({ endpoint, envelope, username, password, soapAction }) => {
    const response = await axios.post(endpoint, envelope, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: soapActionHeader(soapAction),
            Authorization: buildBasicAuthHeader(username, password),
        },
        httpsAgent: getHttpsAgent(),
        timeout: 30000,
        validateStatus: () => true,
        responseType: "text",
        transformResponse: [(data) => data],
    });

    const body = String(response.data || "");
    if (response.status >= 400 || isSoapFaultBody(body)) {
        const fault = extractSoapFault({ body, message: body });
        const error = new Error(fault || `HTTP ${response.status}`);
        error.body = body;
        error.statusCode = response.status;
        throw error;
    }

    return { body, statusCode: response.status };
};

/**
 * e-Arşiv WS kimlik doğrulama — resmi örnekler HTTP Basic + boş SOAP Header.
 * Önce generateInvID (e-Arşiv ana akış), sonra getUserList.
 */
const verifyEArchiveCredentials = async ({
    endpoint,
    username,
    password,
    vknTckn,
    branch = "default",
    identifier,
}) => {
    const attempts = [
        {
            id: "http-generateInvID",
            soapAction: "generateInvID",
            envelope: buildGenerateInvIdEnvelope({ identifier: identifier || vknTckn, vknTckn, branch }),
        },
        {
            id: "http-getUserList",
            soapAction: "getUserList",
            envelope: buildEArchiveGetUserListEnvelope({ vknTckn }),
        },
    ];

    let lastError;
    for (const attempt of attempts) {
        try {
            const response = await postSoap({
                endpoint,
                envelope: attempt.envelope,
                username,
                password,
                soapAction: attempt.soapAction,
            });
            if (attempt.id === "http-generateInvID") {
                if (!parseGenerateInvIdSuccess(response.body)) {
                    lastError = new Error("generateInvID iş yanıtı başarısız (StatusCode≠10) — HTTP Basic geçti ama fatura ID üretilemedi");
                    lastError.body = response.body;
                    continue;
                }
            }
            // Her iki deneme de HTTP Basic — soap client için "basic" kullanılmalı
            return { success: true, authMode: "basic" };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("e-Arşiv HTTP SOAP doğrulaması başarısız");
};

const buildSendInvoiceEnvelope = ({
    senderID,
    receiverID,
    docType = "XML",
    fileName,
    hash,
    binaryBase64,
    branch = "default",
}) => {
    const sender = escXml(clean(senderID));
    const receiver = escXml(clean(receiverID));
    if (!sender || !receiver) {
        throw new Error("sendInvoice: senderID ve receiverID zorunlu (sender=" + (sender || "boş") + ", receiver=" + (receiver || "boş") + ")");
    }
    // BaseArchiveRequest alanları XmlSchemaForm.Unqualified — base: prefix KULLANMA
    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:inv="http://fitcons.com/earchive/invoice">' +
        "<soapenv:Header/>" +
        "<soapenv:Body>" +
        "<inv:sendInvoiceRequestType>" +
        "<senderID>" + sender + "</senderID>" +
        "<receiverID>" + receiver + "</receiverID>" +
        "<docType>" + escXml(docType) + "</docType>" +
        "<fileName>" + escXml(clean(fileName)) + "</fileName>" +
        "<hash>" + escXml(clean(hash)) + "</hash>" +
        "<binaryData>" + binaryBase64 + "</binaryData>" +
        "<customizationParams>" +
        "<paramName>BRANCH</paramName>" +
        "<paramValue>" + escXml(clean(branch) || "default") + "</paramValue>" +
        "</customizationParams>" +
        "</inv:sendInvoiceRequestType>" +
        "</soapenv:Body>" +
        "</soapenv:Envelope>"
    );
};

const parseSendInvoiceHttpBody = (body) => {
    const text = String(body || "");
    if (!text || isSoapFaultBody(text)) {
        return { success: false, error: extractSoapFault({ body, message: text }) || "sendInvoice başarısız" };
    }

    const resultMatch = text.match(/<(?:[\w-]+:)?Result[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Result>/i);
    const resultBlock = resultMatch ? resultMatch[1] : "";
    const statusMatch = resultBlock.match(/<(?:[\w-]+:)?StatusCode[^>]*>([^<]+)</i)
        || text.match(/<(?:[\w-]+:)?StatusCode[^>]*>([^<]+)</i);
    const statusCode = statusMatch ? String(statusMatch[1]).trim() : "";
    const ok = statusCode === "10" || statusCode === "0"
        || /<(?:[\w-]+:)?Result[^>]*>\s*SUCCESS\s*</i.test(text);

    if (ok) {
        const preCheckBlock = text.match(/<(?:[\w-]+:)?preCheckSuccessResults[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?preCheckSuccessResults>/i);
        const searchIn = preCheckBlock ? preCheckBlock[1] : text;
        const uuidMatch = searchIn.match(/<(?:[\w-]+:)?UUID[^>]*>([^<]+)</i) || text.match(/<(?:[\w-]+:)?UUID[^>]*>([^<]+)</i);
        const invMatch = searchIn.match(/<(?:[\w-]+:)?InvoiceNumber[^>]*>([^<]+)</i) || text.match(/<(?:[\w-]+:)?InvoiceNumber[^>]*>([^<]+)</i);
        return {
            success: true,
            uuid: uuidMatch ? uuidMatch[1].trim() : "",
            invoiceNumber: normalizeSovosEArchiveInvoiceNumber(invMatch ? invMatch[1].trim() : ""),
            raw: text,
        };
    }

    const preCheckErr = text.match(/<(?:[\w-]+:)?ErrorDesc[^>]*>([^<]+)</i);
    const detailMatch = text.match(/<(?:[\w-]+:)?Detail[^>]*>([^<]+)</i);
    return {
        success: false,
        error: preCheckErr?.[1] || detailMatch?.[1] || "sendInvoice iş yanıtı başarısız (StatusCode=" + (statusCode || "?") + ")",
        raw: text,
    };
};

const postSendInvoice = async ({ endpoint, username, password, payload }) => {
    const binaryData = Buffer.isBuffer(payload.zipBuffer)
        ? payload.zipBuffer
        : Buffer.from(payload.zipBuffer || []);
    const hash = crypto.createHash("md5").update(binaryData).digest("hex");
    const envelope = buildSendInvoiceEnvelope({
        senderID: payload.senderID,
        receiverID: payload.receiverID,
        fileName: payload.fileName,
        hash,
        binaryBase64: binaryData.toString("base64"),
        branch: payload.branch || "default",
    });
    const response = await postSoap({
        endpoint,
        envelope,
        username,
        password,
        soapAction: "sendInvoice",
    });
    return parseSendInvoiceHttpBody(response.body);
};

/** Resmi cancelInvoiceRequest.xml — xmlns:inv=http://fitcons.com/earchive/invoicecancellation */
const buildCancelInvoiceEnvelope = ({
    invoiceId,
    vkn,
    branch = "default",
    totalAmount,
    cancelDate,
    custInvID,
}) => {
    const custXml = custInvID != null && String(custInvID).trim() !== ""
        ? "<custInvID>" + escXml(custInvID) + "</custInvID>"
        : "<custInvID></custInvID>";

    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:inv="http://fitcons.com/earchive/invoicecancellation">' +
        "<soapenv:Header/>" +
        "<soapenv:Body>" +
        "<inv:invoiceCancellationServiceRequestType>" +
        "<invoiceCancelInfoTypeList>" +
        "<invoiceId>" + escXml(invoiceId) + "</invoiceId>" +
        "<vkn>" + escXml(vkn) + "</vkn>" +
        "<branch>" + escXml(clean(branch) || "default") + "</branch>" +
        "<totalAmount>" + escXml(Number(totalAmount).toFixed(2)) + "</totalAmount>" +
        "<cancelDate>" + escXml(cancelDate) + "</cancelDate>" +
        custXml +
        "</invoiceCancelInfoTypeList>" +
        "</inv:invoiceCancellationServiceRequestType>" +
        "</soapenv:Body>" +
        "</soapenv:Envelope>"
    );
};

const parseCancelInvoiceHttpBody = (body) => {
    const text = String(body || "");
    if (!text) {
        return { success: false, error: "cancelInvoice başarısız — boş yanıt", raw: text };
    }

    if (isSoapFaultBody(text)) {
        if (isSovosAlreadyCancelledError(text)) {
            const fault = parseSovosProcessingFault(text);
            return {
                success: true,
                alreadyCancelled: true,
                message: fault?.text || "Fatura Sovos tarafında zaten iptal edilmiş.",
                code: fault?.code ?? 2,
                raw: text,
            };
        }
        const fault = parseSovosProcessingFault(text);
        return {
            success: false,
            error: fault?.text || extractSoapFault({ body: text, message: text }) || "cancelInvoice başarısız",
            code: fault?.code,
            raw: text,
        };
    }

    const resultOk = /<(?:[\w-]+:)?Result[^>]*>\s*SUCCESS\s*<\//i.test(text);
    const codeMatch = text.match(/<(?:[\w-]+:)?code[^>]*>\s*(\d+)\s*<\//i);
    const code = codeMatch ? Number(codeMatch[1]) : null;
    const messageMatch = text.match(/<(?:[\w-]+:)?message[^>]*>([^<]*)<\//i);
    const message = messageMatch ? String(messageMatch[1]).trim() : "";
    const ok = resultOk && (code === 1 || /basari|başarı|success/i.test(message));

    if (ok) {
        return {
            success: true,
            message: message || "Fatura iptal bilgileri başarı ile kaydedilmiştir.",
            code: code ?? 1,
            raw: text,
        };
    }

    const statusDesc = text.match(/<(?:[\w-]+:)?StatusDescription[^>]*>([^<]*)<\//i);
    return {
        success: false,
        error: message || statusDesc?.[1] || extractSoapFault({ body: text, message: text }) || "cancelInvoice iş yanıtı başarısız",
        code,
        raw: text,
    };
};

const postCancelInvoice = async ({ endpoint, username, password, payload }) => {
    const envelope = buildCancelInvoiceEnvelope(payload);
    try {
        const response = await postSoap({
            endpoint,
            envelope,
            username,
            password,
            soapAction: "cancelInvoice",
        });
        return parseCancelInvoiceHttpBody(response.body);
    } catch (error) {
        const body = String(error?.body || error?.response?.data || "");
        if (body) {
            return parseCancelInvoiceHttpBody(body);
        }
        return {
            success: false,
            error: extractSoapFault(error) || error?.message || "cancelInvoice başarısız",
            raw: body,
        };
    }
};

const parseGenerateInvIdHttpBody = (body) => {
    const text = String(body || "");
    if (!text || isSoapFaultBody(text)) {
        return {
            success: false,
            error: extractSoapFault({ body: text, message: text }) || "generateInvID başarısız",
            raw: text,
        };
    }

    const statusCodeRaw = extractXmlTag(text, "StatusCode");
    const statusCode = statusCodeRaw ? Number(statusCodeRaw) : undefined;
    const invoiceNumber = extractXmlTag(text, "Invoice_ID");
    const uuid = extractXmlTag(text, "UUID");
    const link = extractXmlTag(text, "Link");
    const ok = statusCode === 10 || statusCode === 0 || Boolean(invoiceNumber && uuid);

    return {
        success: ok,
        invoiceNumber,
        uuid,
        link,
        statusCode,
        raw: text,
        error: ok ? undefined : (extractXmlTag(text, "StatusDescription") || "generateInvID iş yanıtı başarısız"),
    };
};

const parseGetStatusHttpBody = (body) => {
    const text = String(body || "");
    if (!text || isSoapFaultBody(text)) {
        return {
            success: false,
            error: extractSoapFault({ body: text, message: text }) || "getStatus başarısız",
            raw: text,
        };
    }

    const blockMatch = text.match(/<(?:[\w-]+:)?getStatusResponseType[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?getStatusResponseType>/i);
    const block = blockMatch ? blockMatch[1] : text;

    const statusCode = extractXmlTag(block, "statusCode") || extractXmlTag(block, "StatusCode");
    const detail = extractXmlTag(block, "Detail") || extractXmlTag(block, "detail");
    const rawInvNo = extractXmlTag(block, "invoiceNumber") || extractXmlTag(block, "InvoiceNumber");
    return {
        success: true,
        statusCode,
        detail,
        uuid: extractXmlTag(block, "UUID"),
        invoiceNumber: normalizeSovosEArchiveInvoiceNumber(rawInvNo),
        raw: text,
    };
};

const parseGetSignedInvoiceHttpBody = (body) => {
    const text = String(body || "");
    if (!text || isSoapFaultBody(text)) {
        return {
            success: false,
            error: extractSoapFault({ body: text, message: text }) || "getSignedInvoice başarısız",
            raw: text,
        };
    }

    const base64 = extractXmlBinaryTag(text, ["binaryData", "BinaryData", "DocData"]);
    if (!base64) {
        const detail = extractXmlTag(text, "Detail") || extractXmlTag(text, "detail");
        return {
            success: false,
            error: detail || "İmzalı belge boş",
            raw: text,
        };
    }

    return {
        success: true,
        base64,
        uuid: extractXmlTag(text, "UUID"),
        detail: extractXmlTag(text, "Detail") || extractXmlTag(text, "detail"),
        raw: text,
    };
};

const parseGetInvoiceDocumentHttpBody = (body) => {
    const text = String(body || "");
    if (!text || isSoapFaultBody(text)) {
        return {
            success: false,
            error: extractSoapFault({ body: text, message: text }) || "getInvoiceDocument başarısız",
            raw: text,
        };
    }

    const base64 = extractXmlBinaryTag(text, ["binaryData", "BinaryData"]);
    if (!base64) {
        const detail = extractXmlTag(text, "Detail") || extractXmlTag(text, "detail");
        return {
            success: false,
            error: detail || "Belge içeriği boş",
            raw: text,
        };
    }

    return {
        success: true,
        base64,
        raw: text,
    };
};

const postEArchiveHttp = async ({ endpoint, username, password, soapAction, envelope, parseFn }) => {
    try {
        const response = await postSoap({
            endpoint,
            envelope,
            username,
            password,
            soapAction,
        });
        return parseFn(response.body);
    } catch (error) {
        const body = String(error?.body || error?.response?.data || "");
        if (body) {
            return parseFn(body);
        }
        return {
            success: false,
            error: extractSoapFault(error) || error?.message || soapAction + " başarısız",
            raw: body,
        };
    }
};

const postGenerateInvID = ({ endpoint, username, password, payload }) =>
    postEArchiveHttp({
        endpoint,
        username,
        password,
        soapAction: "generateInvID",
        envelope: buildGenerateInvIdEnvelope(payload),
        parseFn: parseGenerateInvIdHttpBody,
    });

const postGetStatus = ({ endpoint, username, password, fields }) =>
    postEArchiveHttp({
        endpoint,
        username,
        password,
        soapAction: "getStatus",
        envelope: buildGetStatusEnvelope(fields),
        parseFn: parseGetStatusHttpBody,
    });

const postGetSignedInvoice = ({ endpoint, username, password, fields }) =>
    postEArchiveHttp({
        endpoint,
        username,
        password,
        soapAction: "getSignedInvoice",
        envelope: buildGetSignedInvoiceEnvelope(fields),
        parseFn: parseGetSignedInvoiceHttpBody,
    });

const postGetInvoiceDocument = ({ endpoint, username, password, fields, outputType }) =>
    postEArchiveHttp({
        endpoint,
        username,
        password,
        soapAction: "getInvoiceDocument",
        envelope: buildGetInvoiceDocumentEnvelope(fields, outputType),
        parseFn: parseGetInvoiceDocumentHttpBody,
    });

module.exports = {
    buildBasicAuthHeader,
    buildGenerateInvIdEnvelope,
    buildEArchiveGetUserListEnvelope,
    buildEArchiveLookupEnvelope,
    buildGetStatusEnvelope,
    buildGetSignedInvoiceEnvelope,
    buildGetInvoiceDocumentEnvelope,
    buildSendInvoiceEnvelope,
    buildCancelInvoiceEnvelope,
    postSoap,
    postSendInvoice,
    postCancelInvoice,
    postGenerateInvID,
    postGetStatus,
    postGetSignedInvoice,
    postGetInvoiceDocument,
    parseSendInvoiceHttpBody,
    parseCancelInvoiceHttpBody,
    parseGenerateInvIdHttpBody,
    parseGetStatusHttpBody,
    parseGetSignedInvoiceHttpBody,
    parseGetInvoiceDocumentHttpBody,
    verifyEArchiveCredentials,
    verifyEArchiveGetUserList: verifyEArchiveCredentials,
};
