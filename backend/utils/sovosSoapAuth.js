const soap = require("soap");
const { extractSoapFault } = require("./sovosSoapFault");

const clean = (s) => String(s || "").trim();
const rawPass = (s) => (s == null ? "" : String(s));

/**
 * Fitbulut Sovos WS: HTTP Authorization: Basic + SOAP wsse:Security birlikte gerekir.
 * Yalnızca basic → SOAP Header boş kalır (5010).
 * Yalnızca wss → HTTP Authorization yok (5010).
 */
class FitbulutCombinedSecurity {
    constructor(username, password) {
        this.basic = new soap.BasicAuthSecurity(username, password);
        this.wss = new soap.WSSecurity(username, password, {
            passwordType: "PasswordText",
            hasTimeStamp: true,
            mustUnderstand: true,
        });
    }

    addHeaders(headers) {
        this.basic.addHeaders(headers);
    }

    addOptions(options) {
        if (typeof this.basic.addOptions === "function") {
            this.basic.addOptions(options);
        }
    }

    toXML() {
        return this.wss.toXML();
    }
}

const AUTH_MODE_ORDER = ["basic", "fitbulut", "wss", "wss-digest"];

/** e-Arşiv HTTP doğrulamasından gelen http-* etiketlerini soap moduna çevir */
const normalizeEarsivAuthMode = (mode) => {
    const m = String(mode || "basic").toLowerCase();
    if (m === "basic" || m.startsWith("http-")) return "basic";
    if (AUTH_MODE_ORDER.includes(m)) return m;
    return "basic";
};

const resolveAuthModes = (preferred) => {
    const envMode = (process.env.SOVOS_AUTH_MODE || "auto").toLowerCase();
    if (envMode !== "auto") {
        return [envMode];
    }
    const pref = preferred && AUTH_MODE_ORDER.includes(preferred) ? preferred : null;
    if (pref) {
        return [pref, ...AUTH_MODE_ORDER.filter((mode) => mode !== pref)];
    }
    return [...AUTH_MODE_ORDER];
};

const applySovosSoapSecurity = (client, username, password, mode) => {
    const user = clean(username);
    const pass = rawPass(password);

    switch (mode) {
        case "fitbulut":
            client.setSecurity(new FitbulutCombinedSecurity(user, pass));
            break;
        case "wss":
            client.setSecurity(
                new soap.WSSecurity(user, pass, { passwordType: "PasswordText", hasTimeStamp: true })
            );
            break;
        case "wss-digest":
            client.setSecurity(
                new soap.WSSecurity(user, pass, { passwordType: "PasswordDigest", hasTimeStamp: true })
            );
            break;
        case "basic":
            client.setSecurity(new soap.BasicAuthSecurity(user, pass));
            break;
        default:
            throw new Error("Bilinmeyen SOVOS_AUTH_MODE: " + mode);
    }

    return mode;
};

const isAuthRetryableFault = (error) => {
    const fault = extractSoapFault(error).toLowerCase();
    return (
        fault.includes("unauthorized") ||
        fault.includes("s:5000") ||
        fault.includes("s:5010") ||
        fault.includes("missing authorization") ||
        fault.includes("security header") ||
        fault.includes("authenticationtokenpolicy") ||
        fault.includes("not authorized")
    );
};

/**
 * Auth hatasında sıradaki modu dener (SOVOS_AUTH_MODE=auto).
 */
const callWithAuthFallback = async ({ username, password, authMode, createClient, call }) => {
    const modes = resolveAuthModes(authMode);
    let lastError;
    const triedModes = [];

    for (const mode of modes) {
        triedModes.push(mode);
        try {
            const client = await createClient(mode);
            const result = await call(client);
            return { result, authMode: mode, triedModes };
        } catch (error) {
            lastError = error;
            const canRetry = modes.length > 1 && isAuthRetryableFault(error);
            if (!canRetry) {
                throw error;
            }
        }
    }

    if (lastError) {
        lastError.sovosAuthModesTried = triedModes;
    }
    throw lastError;
};

module.exports = {
    FitbulutCombinedSecurity,
    AUTH_MODE_ORDER,
    normalizeEarsivAuthMode,
    resolveAuthModes,
    applySovosSoapSecurity,
    isAuthRetryableFault,
    isUnauthorizedFault: isAuthRetryableFault,
    callWithAuthFallback,
};
