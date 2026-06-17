const fs = require("fs");
const path = require("path");
const https = require("https");
const tls = require("tls");

const CERT_DIR = path.join(__dirname, "../assets/sovos-wsdl/certs");
const LEGACY_CERT = path.join(__dirname, "../assets/sovos-wsdl/fitbulut.com.cer");
const OFFICIAL_CERT_ROOT = path.join(
    __dirname,
    "../../Sovos Bulut e-Fatura WS API v2.3 (1)/Sovos Cloud SSL Certificates"
);

const CERT_FILES = [
    "fitbulut.com.cer",
    "Sectigo RSA Organization Validation Secure Server CA.cer",
    "USERTrust RSA Certification Authority.cer",
    "AAA Certificate Services.cer",
];

let cachedAgent;
let cachedCa;

const readCertFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath);
    } catch {
        return null;
    }
};

const resolveOfficialCertDir = () => {
    if (process.env.SOVOS_TLS_CERT_DIR && fs.existsSync(process.env.SOVOS_TLS_CERT_DIR)) {
        return process.env.SOVOS_TLS_CERT_DIR;
    }
    try {
        if (!fs.existsSync(OFFICIAL_CERT_ROOT)) return null;
        const dirs = fs.readdirSync(OFFICIAL_CERT_ROOT, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => path.join(OFFICIAL_CERT_ROOT, d.name));
        if (!dirs.length) return null;
        dirs.sort((a, b) => {
            const statA = fs.statSync(a);
            const statB = fs.statSync(b);
            return statB.mtimeMs - statA.mtimeMs;
        });
        return dirs[0];
    } catch {
        return null;
    }
};

const loadCaBundle = () => {
    if (cachedCa) return cachedCa;

    const buffers = [];
    const seen = new Set();
    const officialDir = resolveOfficialCertDir();

    const pushCert = (buf, label) => {
        if (!buf || !buf.length) return;
        const key = buf.toString("base64").slice(0, 40);
        if (seen.has(key)) return;
        seen.add(key);
        buffers.push(buf);
    };

    for (const name of CERT_FILES) {
        pushCert(readCertFile(path.join(CERT_DIR, name)), name);
        if (officialDir) {
            pushCert(readCertFile(path.join(officialDir, name)), name + "@official");
        }
    }

    pushCert(readCertFile(LEGACY_CERT), "legacy");
    if (Array.isArray(tls.rootCertificates)) {
        for (const pem of tls.rootCertificates) {
            pushCert(Buffer.from(pem), "node-root");
        }
    }

    cachedCa = buffers.length ? buffers : undefined;
    return cachedCa;
};

const getRejectUnauthorized = () => {
    if (process.env.SOVOS_TLS_REJECT_UNAUTHORIZED === "true") return true;
    if (process.env.SOVOS_TLS_REJECT_UNAUTHORIZED === "false") return false;
    // Sovos test ortamında sertifika zinciri sık hata verir; canlıda doğrulama açık kalır
    if (process.env.NODE_ENV === "production") return true;
    return false;
};

const getSovosTlsOptions = () => {
    const ca = loadCaBundle();
    const rejectUnauthorized = getRejectUnauthorized();

    return {
        timeout: 30000,
        rejectUnauthorized,
        ca,
    };
};

const createSovosHttpsAgent = () => {
    if (cachedAgent) return cachedAgent;

    const tlsOpts = getSovosTlsOptions();
    cachedAgent = new https.Agent({
        ca: tlsOpts.ca,
        rejectUnauthorized: tlsOpts.rejectUnauthorized,
        keepAlive: true,
        maxSockets: 20,
    });

    return cachedAgent;
};

const resetSovosTlsCache = () => {
    cachedAgent = undefined;
    cachedCa = undefined;
};

const getSovosTlsDebugInfo = () => {
    const ca = loadCaBundle();
    return {
        certCount: ca?.length || 0,
        rejectUnauthorized: getRejectUnauthorized(),
        certDir: CERT_DIR,
        officialCertDir: resolveOfficialCertDir() || "(bulunamadı)",
    };
};
module.exports = {
    getSovosTlsOptions,
    createSovosHttpsAgent,
    loadCaBundle,
    resetSovosTlsCache,
    getSovosTlsDebugInfo,
    getRejectUnauthorized,
};
