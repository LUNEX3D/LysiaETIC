"use strict";

const mongoose = require("mongoose");
const WBSite = require("../models/WBSite");
const Store = require("../models/Store");
const StoreProduct = require("../models/StoreProduct");
const StorePaymentSettings = require("../models/StorePaymentSettings");
const storeService = require("./storeService");
const websiteBuilderService = require("./websiteBuilderService");
const {
    BUSINESS_TYPES,
    BRAND_STYLES,
    resolveKitSlug,
    resolveStyleTokens,
    getKitMeta,
} = require("../config/starterKits");
const logger = require("../config/logger");

function toObjectId(id) {
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

function siteToDto(site, store) {
    if (!site) return null;
    return {
        id: String(site._id),
        storeId: store ? String(store._id) : site.storeId ? String(site.storeId) : null,
        name: site.name || site.displayName,
        slug: site.slug,
        status: site.status,
        themeId: site.themeId,
        businessType: site.businessType || store?.businessType || "general",
        brandStyle: site.brandStyle || store?.brandStyle || "modern",
        customDomain: site.customDomain || store?.customDomain || null,
        domainStatus: site.domainStatus || store?.domainStatus || "none",
        host: site.slug ? `${site.slug}.sites.dashtock.com` : null,
    };
}

function storeToDto(store) {
    if (!store) return null;
    return {
        id: String(store._id),
        wbSiteId: store.wbSiteId ? String(store.wbSiteId) : null,
        name: store.name,
        slug: store.slug,
        status: store.status,
        themeId: store.themeId,
        businessType: store.businessType,
        brandStyle: store.brandStyle,
        publicUrl: storeService.getPublicStoreUrl(store),
    };
}

async function listStoresForUser(userId) {
    const uid = toObjectId(userId);
    const sites = await WBSite.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    const stores = await Store.find({ userId: uid }).lean();
    const storeBySite = Object.fromEntries(
        stores.filter((s) => s.wbSiteId).map((s) => [String(s.wbSiteId), s])
    );
    const storeById = Object.fromEntries(stores.map((s) => [String(s._id), s]));

    return sites.map((site) => {
        const store =
            (site.storeId && storeById[String(site.storeId)]) ||
            storeBySite[String(site._id)] ||
            null;
        return {
            site: siteToDto(site, store),
            store: storeToDto(store),
            linked: !!(site.storeId || store?.wbSiteId),
        };
    });
}

async function backfillLinks(userId) {
    const uid = toObjectId(userId);
    const sites = await WBSite.find({ userId: uid }).sort({ createdAt: 1 }).lean();
    const stores = await Store.find({ userId: uid }).sort({ createdAt: 1 }).lean();

    let linked = 0;
    for (const site of sites) {
        if (site.storeId) continue;
        let store = stores.find((s) => s.wbSiteId && String(s.wbSiteId) === String(site._id));
        if (!store && stores.length === 1 && sites.length === 1) {
            store = stores[0];
        }
        if (store && !store.wbSiteId) {
            await Store.updateOne({ _id: store._id }, { $set: { wbSiteId: site._id } });
            store.wbSiteId = site._id;
        }
        if (store) {
            await WBSite.updateOne({ _id: site._id }, { $set: { storeId: store._id } });
            linked += 1;
        }
    }
    return { linked };
}

async function createLinkedStore(userId, body = {}) {
    const uid = toObjectId(userId);
    const name = String(body.name || "Mağazam").trim();
    const businessType = String(body.businessType || "general").toLowerCase();
    const brandStyle = String(body.brandStyle || "modern").toLowerCase();
    const kitSlug = resolveKitSlug(businessType);
    const styleTokens = resolveStyleTokens(brandStyle);
    const kitMeta = getKitMeta(businessType);

    const siteResult = await websiteBuilderService.createSite(uid, {
        name,
        themeId: kitSlug,
        defaultLanguage: body.defaultLanguage || "tr",
        defaultCurrency: body.defaultCurrency || "TRY",
        plan: body.plan,
    });
    if (siteResult.error) return { error: siteResult.error };
    const site = siteResult.site;

    await WBSite.updateOne(
        { _id: site._id },
        {
            $set: {
                businessType,
                brandStyle,
                themeVariables: {
                    ...(site.themeVariables || {}),
                    ...styleTokens,
                },
            },
        }
    );

    const slug = await storeService.ensureUniqueSlug(body.slug || name);
    const storeDoc = await Store.create({
        userId: uid,
        wbSiteId: site._id,
        name,
        slug,
        themeId: kitSlug,
        businessType,
        brandStyle,
        subdomain: `${slug}.sites.dashtock.com`,
    });

    await WBSite.updateOne({ _id: site._id }, { $set: { storeId: storeDoc._id } });

    await StorePaymentSettings.create({
        storeId: storeDoc._id,
        paytr: { notifyUrlHint: require("./storePaytrService").getNotifyUrl() },
    });

    const freshSite = await WBSite.findById(site._id).lean();
    const freshStore = storeDoc.toObject();

    logger.info(`[StoreFacade] Linked store created: site=${site.slug} store=${storeDoc.slug}`);
    return {
        site: siteToDto(freshSite, freshStore),
        store: storeToDto(freshStore),
        kit: { slug: kitSlug, ...kitMeta },
        brandStyle,
    };
}

async function getSetupProgress(userId, siteId) {
    const uid = toObjectId(userId);
    const sid = toObjectId(siteId);
    if (!sid) return { error: "siteId gerekli" };

    const site = await WBSite.findOne({ _id: sid, userId: uid }).lean();
    if (!site) return { error: "Site bulunamadı" };

    let store =
        (site.storeId && (await Store.findOne({ _id: site.storeId, userId: uid }).lean())) ||
        (await Store.findOne({ wbSiteId: sid, userId: uid }).lean());

    const productCount = store
        ? await StoreProduct.countDocuments({ storeId: store._id })
        : 0;

    let paymentReady = false;
    if (store) {
        const pay = await StorePaymentSettings.findOne({ storeId: store._id }).lean();
        paymentReady = !!(pay?.paytr?.merchantId || pay?.testMode);
    }

    const appearanceReady = !!(site.themeId && (site.themeInstallId || site.themeId !== "aurora"));
    const domainReady =
        site.domainStatus === "verified" ||
        !!(site.customDomain && site.domainStatus === "verified");
    const published = site.status === "published";

    const steps = [
        {
            id: "store_created",
            labelTr: "Mağaza oluşturuldu",
            done: true,
            weight: 15,
        },
        {
            id: "appearance",
            labelTr: "Görünüm hazır",
            done: appearanceReady,
            weight: 20,
        },
        {
            id: "first_product",
            labelTr: "İlk ürün eklendi",
            done: productCount > 0,
            weight: 25,
        },
        {
            id: "payment",
            labelTr: "Ödeme ayarlandı",
            done: paymentReady,
            weight: 20,
        },
        {
            id: "domain",
            labelTr: "Alan adı bağlandı",
            done: domainReady,
            weight: 10,
            optional: true,
        },
        {
            id: "publish",
            labelTr: "Yayında",
            done: published,
            weight: 10,
        },
    ];

    const totalWeight = steps.reduce((s, x) => s + x.weight, 0);
    const doneWeight = steps.filter((x) => x.done).reduce((s, x) => s + x.weight, 0);
    const percent = Math.round((doneWeight / totalWeight) * 100);

    return {
        siteId: String(site._id),
        storeId: store ? String(store._id) : null,
        percent,
        steps,
        counts: { products: productCount },
        phase:
            percent < 40 ? "setup" : percent < 80 ? "configure" : published ? "live" : "launch",
    };
}

async function applyStarterKit(userId, siteId, { businessType, brandStyle } = {}) {
    const uid = toObjectId(userId);
    const sid = toObjectId(siteId);
    const site = await WBSite.findOne({ _id: sid, userId: uid });
    if (!site) return { error: "Site bulunamadı" };

    const bt = String(businessType || site.businessType || "general").toLowerCase();
    const bs = String(brandStyle || site.brandStyle || "modern").toLowerCase();
    const kitSlug = resolveKitSlug(bt);
    const tokens = resolveStyleTokens(bs);

    const install = { error: null };
    if (install.error) {
        logger.warn(`[StoreFacade] Kit install: ${install.error}`);
    }

    site.businessType = bt;
    site.brandStyle = bs;
    site.themeId = kitSlug;
    site.themeVariables = { ...(site.themeVariables || {}), ...tokens };
    await site.save();

    const store = await Store.findOne({ wbSiteId: sid, userId: uid });
    if (store) {
        store.businessType = bt;
        store.brandStyle = bs;
        store.themeId = kitSlug;
        await store.save();
    }

    return {
        kitSlug,
        kit: getKitMeta(bt),
        brandStyle: bs,
        themeVariables: site.themeVariables,
    };
}

async function publishStorefront(userId, siteId) {
    const uid = toObjectId(userId);
    const sid = toObjectId(siteId);
    const site = await WBSite.findOne({ _id: sid, userId: uid });
    if (!site) return { error: "Site bulunamadı" };

    site.status = "published";
    site.publishedAt = new Date();
    await site.save();

    const store = await Store.findOne({ wbSiteId: sid, userId: uid });
    if (store) {
        store.status = "published";
        store.publishedAt = new Date();
        await store.save();
    }

    return { status: "published", site: siteToDto(site.toObject(), store?.toObject?.() || store) };
}

function getCatalogMeta() {
    return {
        businessTypes: BUSINESS_TYPES,
        brandStyles: BRAND_STYLES,
    };
}

module.exports = {
    listStoresForUser,
    backfillLinks,
    createLinkedStore,
    getSetupProgress,
    applyStarterKit,
    publishStorefront,
    getCatalogMeta,
    siteToDto,
    storeToDto,
};
