"use strict";

const tls = require("tls");
const https = require("https");
const fs = require("fs");
const { X509Certificate } = require("crypto");
const path = require("path");
const axios = require("axios");
const WBDomain = require("../models/WBDomain");
const logger = require("../config/logger");
const { syncSiteDomainFields } = require("./wbDomainService");

const MAX_ATTEMPTS = Math.max(3, parseInt(process.env.WB_SSL_MAX_ATTEMPTS || "12", 10));
const RETRY_MINUTES = Math.max(2, parseInt(process.env.WB_SSL_RETRY_MINUTES || "10", 10));
const TLS_PROBE_HOST = process.env.WB_SSL_TLS_PROBE_HOST || "127.0.0.1";
const TLS_PROBE_PORT = parseInt(process.env.WB_SSL_TLS_PROBE_PORT || "443", 10);
const CADDY_STORAGE = process.env.CADDY_STORAGE_PATH || "/var/lib/caddy/.local/share/caddy/certificates";

/** Caddy ask + TLS issuance için izin verilen WBDomain.status değerleri */
const TLS_AUTHORIZED_STATUSES = ["ssl_provisioning", "active", "renewing"];

function normalizeHostname(host) {
    return String(host || "")
        .toLowerCase()
        .split(":")[0]
        .trim()
        .replace(/\.$/, "");
}

function apexDomain(domain) {
    return domain.replace(/^www\./, "");
}

/** TLS/SNI için bağlanılacak host (www tercih — F1 CNAME www) */
function resolveTlsHostnames(domain) {
    const apex = apexDomain(domain);
    const hosts = [];
    if (domain.startsWith("www.")) {
        hosts.push(domain, apex);
    } else {
        hosts.push(`www.${apex}`, apex, domain);
    }
    return [...new Set(hosts.filter(Boolean))];
}

/**
 * Caddy on-demand TLS ask — domain DB'de ve uygun statüde mi?
 */
async function isAuthorizedForTls(hostname) {
    const h = normalizeHostname(hostname);
    if (!h || h.length < 3 || !h.includes(".")) return false;

    const apex = apexDomain(h);
    const candidates = [...new Set([h, apex, `www.${apex}`])];

    const doc = await WBDomain.findOne({
        domain: { $in: candidates },
        status: { $in: TLS_AUTHORIZED_STATUSES },
    })
        .select("domain status sslStatus")
        .lean();

    return !!doc;
}

function scheduleRetry(attempts) {
    const backoff = Math.min(RETRY_MINUTES * Math.pow(1.5, Math.max(0, attempts - 1)), 120);
    return new Date(Date.now() + backoff * 60 * 1000);
}

function readCertFromCaddyStorage(hostname) {
    const base = path.join(
        CADDY_STORAGE,
        "acme-v02.api.letsencrypt.org-directory",
        hostname,
        `${hostname}.crt`
    );
    if (!fs.existsSync(base)) return null;
    try {
        const pem = fs.readFileSync(base, "utf8");
        return parsePemDates(pem);
    } catch {
        return null;
    }
}

function parsePemDates(pem) {
    try {
        const x509 = new X509Certificate(pem);
        const validTo = new Date(x509.validTo);
        const validFrom = new Date(x509.validFrom);
        if (Number.isNaN(validTo.getTime())) return null;
        return {
            validFrom,
            validTo,
            issuer: x509.issuer || "Let's Encrypt",
        };
    } catch {
        return null;
    }
}

function probeTlsCertificate(hostname) {
    return new Promise((resolve) => {
        const socket = tls.connect(
            {
                host: TLS_PROBE_HOST,
                port: TLS_PROBE_PORT,
                servername: hostname,
                rejectUnauthorized: false,
                ALPNProtocols: ["http/1.1", "h2"],
            },
            () => {
                const cert = socket.getPeerCertificate(true);
                socket.end();
                if (!cert || !cert.valid_to) {
                    resolve(null);
                    return;
                }
                const validTo = new Date(cert.valid_to);
                const validFrom = new Date(cert.valid_from);
                if (Number.isNaN(validTo.getTime())) {
                    resolve(null);
                    return;
                }
                const issuer =
                    (typeof cert.issuer === "string" ? cert.issuer : cert.issuer?.O) || "Let's Encrypt";
                resolve({ validFrom, validTo, issuer });
            }
        );

        socket.setTimeout(15000, () => {
            socket.destroy();
            resolve(null);
        });
        socket.on("error", () => resolve(null));
    });
}

async function warmUpTls(hostname) {
    const url = `https://${hostname}/`;
    try {
        await axios.get(url, {
            timeout: 20000,
            validateStatus: () => true,
            maxRedirects: 5,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
    } catch (err) {
        logger.debug(`[WB SSL] warm-up ${hostname}: ${err.message}`);
    }
}

async function detectCertificate(hostnames) {
    for (const host of hostnames) {
        await warmUpTls(host);
        const fromStorage = readCertFromCaddyStorage(host);
        if (fromStorage && fromStorage.validTo > new Date()) {
            return { ...fromStorage, hostname: host, source: "caddy_storage" };
        }
        const fromTls = await probeTlsCertificate(host);
        if (fromTls && fromTls.validTo > new Date()) {
            return { ...fromTls, hostname: host, source: "tls_probe" };
        }
    }
    return null;
}

function certStoragePaths(hostname) {
    const dir = path.join(CADDY_STORAGE, "acme-v02.api.letsencrypt.org-directory", hostname);
    return {
        certPath: path.join(dir, `${hostname}.crt`),
        keyPath: path.join(dir, `${hostname}.key`),
    };
}

/**
 * Tek domain SSL provision — ssl_provisioning → active
 */
async function provisionDomainSsl(domainDoc) {
    const hostnames = resolveTlsHostnames(domainDoc.domain);
    const primaryHost = hostnames[0];

    await WBDomain.updateOne(
        { _id: domainDoc._id },
        {
            $inc: { provisionAttempts: 1 },
            $set: { lastSslAttemptAt: new Date() },
        }
    );

    const cert = await detectCertificate(hostnames);

    if (!cert) {
        const attempts = (domainDoc.provisionAttempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
            const failed = await WBDomain.findOneAndUpdate(
                { _id: domainDoc._id },
                {
                    $set: {
                        status: "failed",
                        sslStatus: "failed",
                        errorMessage:
                            "SSL sertifikası oluşturulamadı. DNS ve edge (Caddy) yapılandırmasını kontrol edin.",
                        nextSslCheckAt: null,
                    },
                },
                { new: true }
            );
            await syncSiteDomainFields(domainDoc.siteId, failed);
            logger.warn(`[WB SSL] provision failed (max attempts) for ${domainDoc.domain}`);
            return { success: false, status: "failed" };
        }

        const updated = await WBDomain.findOneAndUpdate(
            { _id: domainDoc._id },
            {
                $set: {
                    sslStatus: "pending",
                    errorMessage: "SSL sertifikası bekleniyor (Caddy/ACME)",
                    nextSslCheckAt: scheduleRetry(attempts),
                },
            },
            { new: true }
        );
        await syncSiteDomainFields(domainDoc.siteId, updated);
        return { success: false, status: "ssl_provisioning", retry: true };
    }

    const paths = certStoragePaths(cert.hostname);
    const renewalLeadDays = parseInt(process.env.WB_SSL_RENEWAL_LEAD_DAYS || "30", 10);
    const nextSslCheckAt = new Date(
        cert.validTo.getTime() - renewalLeadDays * 24 * 60 * 60 * 1000
    );

    const updated = await WBDomain.findOneAndUpdate(
        { _id: domainDoc._id },
        {
            $set: {
                status: "active",
                sslStatus: "active",
                errorMessage: "",
                provisionAttempts: 0,
                nextSslCheckAt,
                ssl: {
                    issuer: cert.issuer,
                    validFrom: cert.validFrom,
                    validTo: cert.validTo,
                    autoRenew: true,
                    provider: "letsencrypt",
                    certPath: fs.existsSync(paths.certPath) ? paths.certPath : "",
                    keyPath: fs.existsSync(paths.keyPath) ? paths.keyPath : "",
                },
            },
        },
        { new: true }
    );

    await syncSiteDomainFields(domainDoc.siteId, updated);
    logger.info(
        `[WB SSL] active ${domainDoc.domain} validTo=${cert.validTo.toISOString()} via ${cert.source}`
    );
    return { success: true, status: "active", validTo: cert.validTo };
}

async function runPeriodicSslProvisioning() {
    const batch = Math.max(1, parseInt(process.env.WB_SSL_BATCH_SIZE || "10", 10));
    const pending = await WBDomain.find({
        status: "ssl_provisioning",
        nextSslCheckAt: { $lte: new Date() },
    })
        .limit(batch)
        .lean();

    for (const row of pending) {
        try {
            await provisionDomainSsl(row);
        } catch (err) {
            logger.error(`[WB SSL] provision tick error ${row.domain}:`, err.message);
            await WBDomain.updateOne(
                { _id: row._id },
                { $set: { nextSslCheckAt: scheduleRetry(row.provisionAttempts || 0) } }
            );
        }
    }

    return { processed: pending.length };
}

module.exports = {
    isAuthorizedForTls,
    provisionDomainSsl,
    runPeriodicSslProvisioning,
    resolveTlsHostnames,
    normalizeHostname,
};
