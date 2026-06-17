"use strict";

const dns = require("dns").promises;
const crypto = require("crypto");
const WBDomain = require("../models/WBDomain");
const WBSite = require("../models/WBSite");
const logger = require("../config/logger");

const APP_CNAME_TARGET = process.env.WB_CNAME_TARGET || "sites.lysia.com.tr";
const APP_IP = process.env.WB_APP_IP || "";
const VERIFICATION_PREFIX = "lysia-verify=";

/** WBDomain.status → WBSite.domainStatus */
const STATUS_TO_SITE_DOMAIN = {
    pending_dns: "pending_verification",
    dns_verified: "verified",
    ssl_provisioning: "ssl_pending",
    active: "active",
    failed: "failed",
    expired: "expired",
};

const SSL_STATUSES = ["none", "pending", "active", "renewing", "expired", "failed"];

function generateVerificationToken() {
    return crypto.randomBytes(20).toString("hex");
}

function buildRequiredDnsRecords(domain, verificationToken) {
    const records = [
        {
            type: "TXT",
            name: `_lysia-verify.${domain}`,
            value: `${VERIFICATION_PREFIX}${verificationToken}`,
            ttl: 3600,
            description: "Domain doğrulama kaydı (bir kez eklenir, silinmez)",
        },
        {
            type: "CNAME",
            name: domain.startsWith("www.") ? domain : `www.${domain}`,
            value: APP_CNAME_TARGET,
            ttl: 3600,
            description: "Site yönlendirme kaydı",
        },
    ];

    if (APP_IP) {
        records.push({
            type: "A",
            name: domain.replace(/^www\./, ""),
            value: APP_IP,
            ttl: 3600,
            description: "Ana domain A kaydı",
        });
    }

    return records;
}

async function checkTxtRecord(domain, expectedToken) {
    try {
        const verifyDomain = `_lysia-verify.${domain}`;
        const records = await dns.resolveTxt(verifyDomain);
        const flat = records.flat();
        return flat.some((r) => r.includes(expectedToken));
    } catch {
        return false;
    }
}

async function checkCnameRecord(domain) {
    try {
        const apex = domain.replace(/^www\./, "");
        const wwwDomain = `www.${apex}`;
        const records = await dns.resolveCname(wwwDomain);
        return records.some((r) => r.includes(APP_CNAME_TARGET.split(".")[0]));
    } catch {
        return false;
    }
}

function normalizeSslStatus(value, domainStatus) {
    if (value && SSL_STATUSES.includes(value)) return value;
    if (domainStatus === "ssl_provisioning") return "pending";
    if (domainStatus === "active") return "active";
    if (domainStatus === "expired") return "expired";
    if (domainStatus === "failed") return value === "failed" ? "failed" : "none";
    return "none";
}

/**
 * Tek yazım noktası: WBDomain → WBSite alanları.
 * @param {import("mongoose").Types.ObjectId|string} siteId
 * @param {object|null} domainDoc — null ise domain bağlantısı temizlenir
 */
async function syncSiteDomainFields(siteId, domainDoc) {
    if (!domainDoc) {
        await WBSite.updateOne(
            { _id: siteId },
            {
                $set: {
                    customDomain: "",
                    domainStatus: "none",
                    domainVerifyToken: "",
                    sslStatus: "none",
                },
            }
        );
        return;
    }

    const domainStatus = STATUS_TO_SITE_DOMAIN[domainDoc.status] || "pending_verification";
    const sslStatus = normalizeSslStatus(domainDoc.sslStatus, domainDoc.status);

    await WBSite.updateOne(
        { _id: siteId },
        {
            $set: {
                customDomain: domainDoc.domain,
                domainStatus,
                domainVerifyToken: domainDoc.verificationToken || "",
                sslStatus,
            },
        }
    );
}

async function createDomainRecord(siteId, userId, domain, options = {}) {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const domainType = options.domainType || (normalized.startsWith("www.") ? "alias" : options.subdomain ? "subdomain" : "primary");

    const existing = await WBDomain.findOne({ domain: normalized });
    if (existing && String(existing.siteId) !== String(siteId)) {
        return { error: "Bu domain başka bir siteye bağlı" };
    }

    const primaryExists = await WBDomain.findOne({ siteId, domainType: "primary", status: "active" });
    const effectiveType = primaryExists && domainType === "primary" ? "alias" : domainType;

    const verificationToken = generateVerificationToken();
    const requiredDnsRecords = buildRequiredDnsRecords(normalized.replace(/^www\./, ""), verificationToken);

    const domainDoc = await WBDomain.findOneAndUpdate(
        { domain: normalized },
        {
            $set: {
                siteId,
                userId,
                domain: normalized,
                domainType: effectiveType,
                status: "pending_dns",
                verificationToken,
                verificationMethod: "dns_txt",
                requiredDnsRecords,
                verificationAttempts: 0,
                lastVerificationAttempt: null,
                verifiedAt: null,
                errorMessage: "",
                sslStatus: "none",
                isPrimary: effectiveType === "primary",
                nextCheckAt: new Date(Date.now() + 5 * 60 * 1000),
                nextSslCheckAt: null,
                provisionAttempts: 0,
                lastSslAttemptAt: null,
            },
        },
        { upsert: true, new: true }
    );

    if (effectiveType === "primary") {
        await syncSiteDomainFields(siteId, domainDoc);
    }
    return { domain: domainDoc };
}

async function verifyDomain(siteId, domainId = null) {
    const filter = domainId
        ? { _id: domainId, siteId }
        : { siteId, isPrimary: true };
    let domainDoc = await WBDomain.findOne(filter);
    if (!domainDoc) {
        domainDoc = await WBDomain.findOne({ siteId }).sort({ isPrimary: -1, createdAt: 1 });
    }
    if (!domainDoc) return { error: "Domain kaydı bulunamadı" };

    await WBDomain.updateOne(
        { _id: domainDoc._id },
        { $inc: { verificationAttempts: 1 }, $set: { lastVerificationAttempt: new Date() } }
    );

    const txtVerified = await checkTxtRecord(domainDoc.domain, domainDoc.verificationToken);

    if (!txtVerified) {
        const nextCheck = new Date(Date.now() + 10 * 60 * 1000);
        let errorMsg = "TXT kaydı bulunamadı";
        try {
            const records = await dns.resolveTxt(`_lysia-verify.${domainDoc.domain}`);
            if (records.length > 0) errorMsg = "TXT kaydı var ama değer yanlış";
        } catch {}

        const updated = await WBDomain.findOneAndUpdate(
            { _id: domainDoc._id },
            {
                $set: {
                    status: "pending_dns",
                    sslStatus: "none",
                    errorMessage: errorMsg,
                    nextCheckAt: nextCheck,
                },
            },
            { new: true }
        );
        await syncSiteDomainFields(siteId, updated);
        return {
            verified: false,
            status: "pending_dns",
            message: "DNS kaydı henüz doğrulanamadı. DNS yayılması 24 saate kadar sürebilir.",
        };
    }

    const cnameOk = await checkCnameRecord(domainDoc.domain);

    if (!cnameOk) {
        const nextCheck = new Date(Date.now() + 15 * 60 * 1000);
        const updated = await WBDomain.findOneAndUpdate(
            { _id: domainDoc._id },
            {
                $set: {
                    status: "dns_verified",
                    sslStatus: "none",
                    verifiedAt: new Date(),
                    errorMessage: "",
                    nextCheckAt: nextCheck,
                },
            },
            { new: true }
        );
        await syncSiteDomainFields(siteId, updated);
        return {
            verified: true,
            cnameConfigured: false,
            status: "dns_verified",
            message: "TXT doğrulandı. CNAME kaydını ekledikten sonra tekrar doğrulayın.",
        };
    }

    const updated = await WBDomain.findOneAndUpdate(
        { _id: domainDoc._id },
        {
            $set: {
                status: "ssl_provisioning",
                sslStatus: "pending",
                verifiedAt: new Date(),
                errorMessage: "",
                nextCheckAt: new Date(Date.now() + 10 * 60 * 1000),
                nextSslCheckAt: new Date(),
                provisionAttempts: 0,
                lastSslAttemptAt: null,
            },
        },
        { new: true }
    );
    await syncSiteDomainFields(siteId, updated);

    return {
        verified: true,
        cnameConfigured: true,
        status: "ssl_provisioning",
        message: "DNS doğrulandı. SSL sertifikası hazırlanıyor. Birkaç dakika içinde otomatik tamamlanacak.",
    };
}

async function removeDomain(siteId, domainId = null) {
    if (domainId) {
        const doc = await WBDomain.findOne({ _id: domainId, siteId });
        if (!doc) return { error: "Domain bulunamadı" };
        await WBDomain.deleteOne({ _id: domainId });
        if (doc.isPrimary || doc.domainType === "primary") {
            const next = await WBDomain.findOne({ siteId, status: "active" }).sort({ createdAt: 1 });
            await syncSiteDomainFields(siteId, next);
        }
        return { success: true };
    }
    await WBDomain.deleteMany({ siteId });
    await syncSiteDomainFields(siteId, null);
    return { success: true };
}

async function getDomainBySite(siteId) {
    const primary = await WBDomain.findOne({ siteId, $or: [{ isPrimary: true }, { domainType: "primary" }] }).lean();
    return primary || WBDomain.findOne({ siteId }).sort({ createdAt: 1 }).lean();
}

async function listDomainsBySite(siteId) {
    return WBDomain.find({ siteId }).sort({ isPrimary: -1, createdAt: 1 }).lean();
}

async function setPrimaryDomain(siteId, domainId) {
    const doc = await WBDomain.findOne({ _id: domainId, siteId });
    if (!doc) return { error: "Domain bulunamadı" };
    await WBDomain.updateMany({ siteId }, { $set: { isPrimary: false, domainType: "alias" } });
    const updated = await WBDomain.findOneAndUpdate(
        { _id: domainId },
        { $set: { isPrimary: true, domainType: "primary" } },
        { new: true }
    );
    await syncSiteDomainFields(siteId, updated);
    return { domain: updated };
}

async function runPeriodicVerification() {
    const pending = await WBDomain.find({
        status: { $in: ["pending_dns", "dns_verified"] },
        nextCheckAt: { $lte: new Date() },
    }).limit(50);

    for (const domain of pending) {
        try {
            await verifyDomain(domain.siteId);
        } catch (err) {
            logger.error(`[WBDomain] periodic verify error for ${domain.domain}:`, err.message);
        }
    }
}

module.exports = {
    createDomainRecord,
    verifyDomain,
    removeDomain,
    getDomainBySite,
    listDomainsBySite,
    setPrimaryDomain,
    buildRequiredDnsRecords,
    generateVerificationToken,
    runPeriodicVerification,
    syncSiteDomainFields,
    STATUS_TO_SITE_DOMAIN,
};
