const Store = require("../models/Store");
const StorePaymentSettings = require("../models/StorePaymentSettings");
const { encrypt, decrypt, maskSecret } = require("../utils/storeCredentialCrypto");
const storePaytr = require("./storePaytrService");
const { APP_URL } = require("../config/domain");

const THEMES = [
    { id: "minimal", name: "Minimal", description: "Sade grid, açık tonlar" },
    { id: "boutique", name: "Boutique", description: "Büyük görseller, premium his" },
    { id: "classic", name: "Dark Pro", description: "Koyu tema, Dashtock uyumlu" },
];

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "magaza";
}

async function ensureUniqueSlug(base, excludeId = null) {
    let slug = slugify(base);
    let n = 0;
    for (;;) {
        const candidate = n ? `${slug}-${n}` : slug;
        const q = { slug: candidate };
        if (excludeId) q._id = { $ne: excludeId };
        const exists = await Store.findOne(q).select("_id").lean();
        if (!exists) return candidate;
        n += 1;
    }
}

async function getStoreByUserId(userId) {
    return Store.findOne({ userId }).sort({ createdAt: 1 }).lean();
}

async function getStoreByWbSiteId(wbSiteId) {
    return Store.findOne({ wbSiteId }).lean();
}

async function resolveStoreForUser(userId, opts = {}) {
    const uid = userId;
    const { siteId, storeId } = opts;
    if (storeId) {
        const s = await Store.findOne({ _id: storeId, userId: uid }).lean();
        if (s) return s;
    }
    if (siteId) {
        const WBSite = require("../models/WBSite");
        const site = await WBSite.findOne({ _id: siteId, userId: uid }).lean();
        if (site?.storeId) {
            const linked = await Store.findOne({ _id: site.storeId, userId: uid }).lean();
            if (linked) return linked;
        }
        const bySite = await Store.findOne({ wbSiteId: siteId, userId: uid }).lean();
        if (bySite) return bySite;
    }
    return getStoreByUserId(uid);
}

async function getStoreBySlug(slug) {
    return Store.findOne({ slug: String(slug).toLowerCase(), status: "published" }).lean();
}

async function resolveStoreByHost(host) {
    const h = String(host || "").toLowerCase().split(":")[0];
    if (!h) return null;
    let store = await Store.findOne({ customDomain: h, domainStatus: "verified", status: "published" }).lean();
    if (store) return store;
    const subMatch = h.match(/^([a-z0-9-]+)\.sites\.dashtock\.com$/);
    if (subMatch) {
        store = await Store.findOne({ slug: subMatch[1], status: "published" }).lean();
    }
    return store;
}

async function createStore(userId, { name, slug: requestedSlug, themeId, wbSiteId, businessType, brandStyle } = {}) {
    if (wbSiteId) {
        const linked = await Store.findOne({ wbSiteId }).lean();
        if (linked) return { store: linked };
    } else {
        const legacy = await Store.findOne({ userId, wbSiteId: { $exists: false } });
        const anyStore = await Store.findOne({ userId });
        if (anyStore && !wbSiteId && legacy) {
            return { error: "Zaten bir mağazanız var", store: anyStore };
        }
    }
    const slug = await ensureUniqueSlug(requestedSlug || name);
    if (!SLUG_RE.test(slug)) {
        return { error: "Geçersiz mağaza adresi (slug)" };
    }
    const payload = {
        userId,
        name: String(name || "Mağazam").trim(),
        slug,
        themeId: themeId || "minimal",
        subdomain: `${slug}.sites.dashtock.com`,
    };
    if (wbSiteId) payload.wbSiteId = wbSiteId;
    if (businessType) payload.businessType = businessType;
    if (brandStyle) payload.brandStyle = brandStyle;
    const store = await Store.create(payload);
    await StorePaymentSettings.create({
        storeId: store._id,
        paytr: { notifyUrlHint: storePaytr.getNotifyUrl() },
    });
    return { store: store.toObject() };
}

const DNS_CNAME_TARGET = process.env.STORE_DNS_CNAME_TARGET || "sites.dashtock.com";

function buildDomainDnsRecords(store) {
    if (!store?.customDomain) return null;
    const raw = String(store.customDomain).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const root = raw.replace(/^www\./, "");
    const token = store.domainVerifyToken || `dashtock-verify-${store._id}`;
    return [
        {
            id: "cname",
            type: "CNAME",
            name: "www",
            host: `www.${root}`,
            value: DNS_CNAME_TARGET,
            ttl: "3600",
            description: "www alt alan adını mağazanıza yönlendirir",
        },
        {
            id: "txt",
            type: "TXT",
            name: "_dashtock",
            host: `_dashtock.${root}`,
            value: token,
            ttl: "3600",
            description: "Alan adı sahipliğini doğrular",
        },
    ];
}

async function verifyStoreDomain(userId) {
    const store = await Store.findOne({ userId });
    if (!store) return { error: "Mağaza bulunamadı" };
    if (!store.customDomain) return { error: "Önce özel alan adı ekleyin" };
    if (store.domainStatus === "verified") {
        return { store: store.toObject(), verified: true, dnsRecords: buildDomainDnsRecords(store) };
    }

    if (process.env.STORE_DOMAIN_SKIP_DNS === "1") {
        store.domainStatus = "verified";
        await store.save();
        return { store: store.toObject(), verified: true, dnsRecords: buildDomainDnsRecords(store) };
    }

    const dns = require("dns").promises;
    const root = String(store.customDomain).toLowerCase().replace(/^www\./, "");
    const txtHost = `_dashtock.${root}`;
    try {
        const chunks = await dns.resolveTxt(txtHost);
        const flat = chunks.map((c) => c.join("")).join("");
        if (flat.includes(store.domainVerifyToken)) {
            store.domainStatus = "verified";
            await store.save();
            return { store: store.toObject(), verified: true, dnsRecords: buildDomainDnsRecords(store) };
        }
        return {
            error: "TXT doğrulama kaydı henüz görünmüyor. DNS yayılımı 24–48 saat sürebilir.",
            dnsRecords: buildDomainDnsRecords(store),
        };
    } catch {
        return {
            error: "DNS kayıtları henüz doğrulanamadı. Tablodaki değerleri domain sağlayıcınıza ekleyin.",
            dnsRecords: buildDomainDnsRecords(store),
        };
    }
}

async function disconnectStoreDomain(userId) {
    const store = await Store.findOne({ userId });
    if (!store) return { error: "Mağaza bulunamadı" };
    store.customDomain = "";
    store.domainStatus = "none";
    store.domainVerifyToken = "";
    await store.save();
    return { store: store.toObject() };
}

async function updateStore(userId, patch) {
    const store = await Store.findOne({ userId });
    if (!store) return { error: "Mağaza bulunamadı" };
    if (patch.name) store.name = String(patch.name).trim();
    if (patch.themeId) store.themeId = patch.themeId;
    if (patch.themeOverrides) store.themeOverrides = { ...store.themeOverrides?.toObject?.() || store.themeOverrides, ...patch.themeOverrides };
    if (patch.settings) store.settings = { ...store.settings?.toObject?.() || store.settings, ...patch.settings };
    if (patch.customDomain !== undefined) {
        const dom = String(patch.customDomain || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        store.customDomain = dom;
        store.domainStatus = dom ? "pending" : "none";
        store.domainVerifyToken = dom ? `dashtock-verify-${store._id}` : "";
    }
    await store.save();
    return { store: store.toObject() };
}

async function publishStore(userId) {
    const store = await Store.findOne({ userId });
    if (!store) return { error: "Önce mağaza oluşturun" };
    const pay = await StorePaymentSettings.findOne({ storeId: store._id }).lean();
    if (!storePaytr.hasValidCreds(pay)) {
        return { error: "Yayınlamak için PayTR bilgilerinizi girin ve etkinleştirin" };
    }
    if (!pay.paytr.enabled) {
        return { error: "PayTR ödemesini etkinleştirin" };
    }
    store.status = "published";
    store.publishedAt = new Date();
    await store.save();
    return { store: store.toObject() };
}

async function unpublishStore(userId) {
    const store = await Store.findOne({ userId });
    if (!store) return { error: "Mağaza bulunamadı" };
    store.status = "draft";
    await store.save();
    return { store: store.toObject() };
}

async function getPaymentSettings(storeId) {
    const doc = await StorePaymentSettings.findOne({ storeId }).lean();
    if (!doc) return null;
    return {
        paytr: {
            enabled: !!doc.paytr?.enabled,
            merchantId: doc.paytr?.merchantId || "",
            merchantKeyMasked: maskSecret(decrypt(doc.paytr?.merchantKeyEnc)),
            merchantSaltMasked: maskSecret(decrypt(doc.paytr?.merchantSaltEnc)),
            testMode: !!doc.paytr?.testMode,
            configured: storePaytr.hasValidCreds(doc),
            notifyUrl: storePaytr.getNotifyUrl(),
            notifyUrlHint: doc.paytr?.notifyUrlHint || storePaytr.getNotifyUrl(),
        },
        bankTransfer: doc.bankTransfer || { enabled: false, instructions: "" },
    };
}

async function savePaymentSettings(storeId, body) {
    let doc = await StorePaymentSettings.findOne({ storeId });
    if (!doc) doc = new StorePaymentSettings({ storeId });
    const p = body.paytr || {};
    if (p.merchantId !== undefined) doc.paytr.merchantId = String(p.merchantId).trim();
    if (p.merchantKey) doc.paytr.merchantKeyEnc = encrypt(p.merchantKey);
    if (p.merchantSalt) doc.paytr.merchantSaltEnc = encrypt(p.merchantSalt);
    if (p.enabled !== undefined) doc.paytr.enabled = !!p.enabled;
    if (p.testMode !== undefined) doc.paytr.testMode = !!p.testMode;
    doc.paytr.notifyUrlHint = storePaytr.getNotifyUrl();
    if (body.bankTransfer) {
        doc.bankTransfer = { ...doc.bankTransfer?.toObject?.() || doc.bankTransfer, ...body.bankTransfer };
    }
    await doc.save();
    return getPaymentSettings(storeId);
}

function getPublicStoreUrl(store) {
    const base = APP_URL || "";
    if (store.customDomain && store.domainStatus === "verified") {
        return `https://${store.customDomain}`;
    }
    return `${base}/shop/${store.slug}`;
}

module.exports = {
    THEMES,
    DNS_CNAME_TARGET,
    slugify,
    ensureUniqueSlug,
    getStoreByUserId,
    getStoreByWbSiteId,
    resolveStoreForUser,
    getStoreBySlug,
    resolveStoreByHost,
    createStore,
    updateStore,
    publishStore,
    buildDomainDnsRecords,
    verifyStoreDomain,
    disconnectStoreDomain,
    unpublishStore,
    getPaymentSettings,
    savePaymentSettings,
    getPublicStoreUrl,
};
