"use strict";

const dns = require("dns").promises;
const crypto = require("crypto");
const WBSite = require("../models/WBSite");
const logger = require("../config/logger");

function extractDomain(email) {
    const m = String(email || "").match(/@([a-z0-9.-]+\.[a-z]{2,})$/i);
    return m ? m[1].toLowerCase() : "";
}

function buildEmailDnsRecords(domain, token) {
    const dkimHost = `lysia._domainkey.${domain}`;
    return [
        {
            type: "TXT",
            name: domain,
            value: `v=spf1 include:mail.dashtock.com ~all`,
            description: "SPF — e-posta gönderim yetkisi",
        },
        {
            type: "TXT",
            name: dkimHost,
            value: `v=DKIM1; k=rsa; p=${token.slice(0, 32)}...`,
            description: "DKIM — e-posta imzalama (LysiaETIC yönetir)",
        },
        {
            type: "TXT",
            name: `_dmarc.${domain}`,
            value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
            description: "DMARC — spam koruması politikası",
        },
    ];
}

async function checkTxt(name, expectedSubstring) {
    try {
        const records = await dns.resolveTxt(name);
        const flat = records.flat().join("");
        return flat.includes(expectedSubstring);
    } catch {
        return false;
    }
}

async function getEmailDomainStatus(siteId, userId) {
    const site = await WBSite.findOne({ _id: siteId, userId }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const settings = site.emailSettings || {};
    const domain = extractDomain(settings.customFromEmail || settings.replyToEmail);
    if (!domain || settings.senderMode !== "custom") {
        return {
            status: "none",
            domain: null,
            records: [],
            message: "Platform gönderici modu aktif",
        };
    }

    const token = crypto.createHash("sha256").update(`${siteId}-${domain}`).digest("hex");
    const records = buildEmailDnsRecords(domain, token);

    const spfOk = await checkTxt(domain, "spf1");
    const dkimOk = await checkTxt(`lysia._domainkey.${domain}`, "DKIM1");
    const dmarcOk = await checkTxt(`_dmarc.${domain}`, "DMARC1");

    const allOk = spfOk && dkimOk;
    const status = allOk ? "verified" : spfOk || dkimOk ? "pending" : "pending";

    if (status === "verified" && settings.emailDomainStatus !== "verified") {
        await WBSite.updateOne(
            { _id: siteId },
            { $set: { "emailSettings.emailDomainStatus": "verified" } }
        );
    }

    return {
        status,
        domain,
        records: records.map((r, i) => ({
            ...r,
            verified: [spfOk, dkimOk, dmarcOk][i] || false,
        })),
        checks: { spf: spfOk, dkim: dkimOk, dmarc: dmarcOk },
        message: allOk
            ? "E-posta domain doğrulandı — özel adresten gönderim aktif"
            : "DNS kayıtlarını ekleyin; sistem otomatik kontrol eder",
    };
}

async function verifyEmailDomain(siteId, userId) {
    const result = await getEmailDomainStatus(siteId, userId);
    if (result.error) return result;
    if (result.status === "verified") return { verified: true, ...result };
    return {
        verified: false,
        ...result,
        message: "DNS kayıtları henüz tamamlanmadı. Yayılma 24 saate kadar sürebilir.",
    };
}

module.exports = {
    getEmailDomainStatus,
    verifyEmailDomain,
    buildEmailDnsRecords,
    extractDomain,
};
