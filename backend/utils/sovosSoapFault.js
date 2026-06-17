/**
 * Sovos / node-soap hata metinlerini okunabilir string'e çevirir.
 * faultstring çoğu zaman { $value: "...", attributes: {...} } olarak gelir.
 */

const normalizeSoapValue = (val) => {
    if (val == null) return "";
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        return String(val).trim();
    }
    if (typeof val !== "object") return "";

    if (val.$value != null) return normalizeSoapValue(val.$value);
    if (val._ != null) return normalizeSoapValue(val._);
    if (val.Text != null) return normalizeSoapValue(val.Text);
    if (val.Message != null) return normalizeSoapValue(val.Message);
    if (val.message != null) return normalizeSoapValue(val.message);

    return "";
};

const extractSoapFault = (error) => {
    const message = normalizeSoapValue(error?.message);
    if (message && !message.includes("[object Object]")) {
        return message;
    }

    const fault = error?.root?.Envelope?.Body?.Fault;
    if (fault) {
        const faultcode =
            normalizeSoapValue(fault.faultcode) ||
            normalizeSoapValue(fault.Code?.Value) ||
            normalizeSoapValue(fault.Code?.Subcode?.Value);
        const faultstring =
            normalizeSoapValue(fault.faultstring) ||
            normalizeSoapValue(fault.Reason?.Text);
        const detail =
            normalizeSoapValue(fault.detail) ||
            normalizeSoapValue(fault.Detail) ||
            normalizeSoapValue(fault.detail?.ProcessingFault?.Message) ||
            normalizeSoapValue(fault.Detail?.ProcessingFault?.Message);

        const parts = [faultcode, faultstring, detail].filter(Boolean);
        if (parts.length) return parts.join(": ");
    }

    if (typeof error?.body === "string") {
        const textMatch = error.body.match(/<(?:[\w-]+:)?Text[^>]*>([^<]+)<\/(?:[\w-]+:)?Text>/i);
        if (textMatch?.[1]) return textMatch[1].trim();
        const match = error.body.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
        if (match?.[1]) return match[1].trim();
        return error.body.slice(0, 500);
    }

    if (error?.body && typeof error.body === "object") {
        return JSON.stringify(error.body).slice(0, 500);
    }

    if (error?.response?.data) {
        const body = error.response.data;
        const nested = extractSoapFault({ message: body?.message || body?.faultstring || body });
        if (nested && nested !== "Bilinmeyen SOAP hatası") return nested;
    }

    if (error?.code) return String(error.code);

    return message || "Bilinmeyen SOAP hatası";
};

const mapSovosLoginError = (raw, env, service = "efatura", meta = {}) => {
    const text = extractSoapFault({ message: raw }) || String(raw || "").trim();
    const lower = text.toLowerCase();
    const envLabel = env === "production" ? "Canlı" : "Test";
    const serviceLabel =
        service === "earsiv"
            ? "e-Arşiv (earsivws.fitbulut.com)"
            : "e-Fatura (efaturaws.fitbulut.com)";
    const passLen = Number(meta.passLen);
    const passLenHint =
        Number.isFinite(passLen) && passLen > 0
            ? ` Gönderilen şifre uzunluğu: ${passLen} karakter — portal WS şifresini harf harf yeniden yapıştırın (başında/sonunda boşluk olmamalı).`
            : "";

    if (lower.includes("self-signed certificate") || lower.includes("unable to verify the first certificate")) {
        return (
            "Sovos TLS sertifika doğrulaması başarısız. " +
            "backend/assets/sovos-wsdl/certs/ klasöründeki Sovos SSL paketinin yüklü olduğundan emin olun. " +
            "Geçici test için backend/.env dosyasına SOVOS_TLS_REJECT_UNAUTHORIZED=false ekleyebilirsiniz."
        );
    }

    if (lower.includes("missing authorization") || lower.includes("s:5010")) {
        return (
            "Sovos web servis isteğinde HTTP Authorization header eksik. " +
            "Bu genellikle geçici bir yapılandırma sorunudur — backend'i yeniden başlatıp tekrar deneyin. " +
            `Ortam: ${envLabel}, servis: ${serviceLabel}.`
        );
    }

    if (lower.includes("unauthorized") || lower.includes("s:5000")) {
        const endpointHint =
            env === "production"
                ? " Canlı endpoint (earsivws.fitbulut.com) kullanılıyor — cloudtest.fitbulut.com WS kullanıcıları yalnızca TEST ortamında (earsivwstest.fitbulut.com) geçerlidir."
                : " Test endpoint (earsivwstest.fitbulut.com) kullanılıyor.";
        let msg =
            "Sovos web servis kimlik doğrulaması başarısız (Unauthorized / HTTP 401)." +
            endpointHint +
            " Resmi örnek istemci de yalnızca test URL kullanır: earsivwstest.fitbulut.com/ClientEArsivServicesPort.svc " +
            "(bkz. github.com/Sovos-Compliance/turkey-cloud-sample-api-client). " +
            "cloudtest.fitbulut.com → Ayarlar → Web Servis Tanımı kullanıcı/şifre (portal giriş şifresi değil). " +
            "WS şifreleri süreli olabilir; portalda Şifre Geçerlilik Tarihi kontrol edin. " +
            `Seçili ortam: ${envLabel}.` +
            passLenHint;

        if (service === "efatura") {
            msg +=
                " Yalnızca e-Arşiv kullanıyorsanız GB etiketini boş bırakın — bağlantı e-Arşiv servisi üzerinden doğrulanır.";
        }

        return msg;
    }

    if (lower.includes("etiket kayıtlı değil") || lower.includes("1112")) {
        return (
            "GB etiketi Sovos kayıtlarınızla eşleşmiyor. " +
            "https://cloudtest.fitbulut.com portalına giriş yapın → firma / etiket ayarlarından " +
            "Gönderici Birim (GB) etiketini kopyalayıp bağlantı formuna yapıştırın (örn. urn:mail:...@...)."
        );
    }

    if (lower.includes("etiket boş") || lower.includes("vkn/tckn boş")) {
        return "VKN/TCKN veya GB etiketi eksik ya da hatalı. Sovos portalındaki değerlerle birebir aynı olmalıdır.";
    }

    return text || "Sovos bağlantısı kurulamadı";
};

/** Sovos s:5040 — hesapta ilgili ürün/modül lisanslı değil (resmi API davranışı) */
const isSovosInactiveModuleError = (raw) => {
    const text = String(extractSoapFault({ message: raw }) || raw || "").toLowerCase();
    return (
        text.includes("5040")
        || text.includes("module is inactive")
        || text.includes("modül aktif değil")
        || text.includes("modul aktif degil")
    );
};

const buildSovosInactiveModuleResult = (raw, { moduleKey, moduleLabel }) => ({
    success: true,
    data: [],
    skipped: true,
    inactiveModule: true,
    capabilityKey: moduleKey,
    message: `${moduleLabel} hesabınızda Sovos tarafında aktif değil — sorgu atlandı.`,
    detail: extractSoapFault({ message: raw }) || String(raw || "").trim(),
});

/** Sovos e-Arşiv cancelInvoice Code=2 — fatura Sovos'ta zaten iptal edilmiş */
const parseSovosProcessingFault = (rawBody) => {
    const text = String(rawBody || "");
    if (!text) return null;
    const codeMatch = text.match(/<(?:[\w-]+:)?Code[^>]*>\s*(\d+)\s*<\//i);
    const textMatch = text.match(/<(?:[\w-]+:)?Text[^>]*>([^<]*)<\//i);
    const code = codeMatch ? Number(codeMatch[1]) : null;
    const detail = textMatch ? String(textMatch[1]).trim() : "";
    return { code, text: detail };
};

const isSovosAlreadyCancelledError = (raw) => {
    const body = typeof raw === "string" ? raw : (raw?.body || raw?.message || "");
    const fault = parseSovosProcessingFault(body);
    const combined = String(fault?.text || extractSoapFault({ body, message: body }) || raw || "").toLowerCase();
    return (
        fault?.code === 2
        || /daha önceden iptal|daha onceden iptal|already cancel|zaten iptal/i.test(combined)
    );
};

module.exports = {
    normalizeSoapValue,
    extractSoapFault,
    mapSovosLoginError,
    isSovosInactiveModuleError,
    buildSovosInactiveModuleResult,
    parseSovosProcessingFault,
    isSovosAlreadyCancelledError,
};
