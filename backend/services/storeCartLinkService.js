const StoreCartLink = require("../models/StoreCartLink");
const { APP_URL } = require("../config/domain");

function normalizeProducts(products) {
    if (!Array.isArray(products)) return [];
    return products
        .filter((p) => p?.productId)
        .map((p) => ({
            productId: p.productId,
            quantity: Math.max(1, Number(p.quantity) || 1),
            variantBarcode: String(p.variantBarcode || "").trim(),
        }));
}

function resolveAbsoluteBase(basePath) {
    const base = String(basePath || "").trim();
    if (!base) return "";
    if (/^https?:\/\//i.test(base)) return base.replace(/\/$/, "");
    const origin = (APP_URL || "").replace(/\/$/, "");
    return `${origin}${base.startsWith("/") ? base : `/${base}`}`.replace(/\/$/, "");
}

function buildGeneratedUrl({ basePath, products, trackUtm, couponMode, couponCode }) {
    const root = resolveAbsoluteBase(basePath);
    if (!root) return "";
    const cartBase = root.endsWith("/cart") ? root : `${root}/cart`;
    const url = new URL(cartBase);
    if (products.length) {
        const add = products
            .map((p) => `${p.productId}:${p.quantity}`)
            .join(",");
        url.searchParams.set("add", add);
    }
    if (couponMode === "with_code" && couponCode) {
        url.searchParams.set("coupon", couponCode);
    }
    if (trackUtm) {
        url.searchParams.set("utm_source", "cart_link");
        url.searchParams.set("utm_medium", "cart_link");
    }
    return url.toString();
}

function storeHasWebStorefront(store) {
    if (!store) return false;
    if (String(store.subdomain || "").trim()) return true;
    if (store.customDomain && store.domainStatus === "verified") return true;
    return false;
}

function buildSalesChannels(store) {
    if (!store) return [];
    const channels = [];
    const slug = store.slug;
    const name = store.name || slug;
    channels.push({
        id: `shop-${slug}`,
        label: name,
        basePath: `/shop/${slug}`,
        type: "shop",
    });
    if (store.subdomain) {
        const host = String(store.subdomain).replace(/^https?:\/\//i, "");
        channels.push({
            id: "subdomain",
            label: host,
            basePath: `https://${host}`,
            type: "subdomain",
        });
    }
    if (store.customDomain && store.domainStatus === "verified") {
        const domain = store.customDomain;
        channels.push({
            id: "domain",
            label: domain,
            basePath: `https://${domain}`,
            type: "domain",
        });
        const locale = store.settings?.locale || "tr";
        channels.push({
            id: "domain-locale",
            label: `${domain}/${locale}`,
            basePath: `https://${domain}/${locale}`,
            type: "domain",
        });
    }
    return channels;
}

/** Kampanya / kısıtlama UI — alan adı / subdomain yoksa boş */
function buildCampaignSalesChannels(store) {
    if (!storeHasWebStorefront(store)) return [];
    const all = buildSalesChannels(store);
    const web = all.filter((ch) => ch.type !== "shop");
    if (web.length) return web;
    return store.status === "published" ? all : [];
}

function normalizeBody(body) {
    const products = normalizeProducts(body.products);
    const couponMode = body.couponMode === "with_code" ? "with_code" : "none";
    const couponCode =
        couponMode === "with_code" ? String(body.couponCode || "").trim().slice(0, 64) : "";
    return {
        salesChannelId: String(body.salesChannelId || "").trim(),
        salesChannelLabel: String(body.salesChannelLabel || "").trim(),
        basePath: String(body.basePath || "").trim(),
        products,
        trackUtm: !!body.trackUtm,
        couponMode,
        couponCode,
    };
}

async function listCartLinks(storeId) {
    return StoreCartLink.find({ storeId }).sort({ createdAt: -1 }).lean();
}

async function getCartLink(storeId, id) {
    const doc = await StoreCartLink.findOne({ _id: id, storeId }).lean();
    if (!doc) return { error: "Sepet linki bulunamadı" };
    return { cartLink: doc };
}

async function getSalesChannelsForStore(store) {
    const all = buildSalesChannels(store);
    return {
        channels: all,
        hasStorefront: storeHasWebStorefront(store),
        campaignChannels: buildCampaignSalesChannels(store),
    };
}

async function createCartLink(storeId, body) {
    const data = normalizeBody(body);
    if (!data.salesChannelId || !data.basePath) {
        return { error: "Satış kanalı seçin" };
    }
    if (!data.products.length) {
        return { error: "En az bir ürün ekleyin" };
    }
    if (data.couponMode === "with_code" && !data.couponCode) {
        return { error: "Kupon kodu seçin veya girin" };
    }
    data.generatedUrl = buildGeneratedUrl(data);
    const doc = await StoreCartLink.create({ storeId, ...data });
    return { cartLink: doc.toObject() };
}

async function updateCartLink(storeId, id, body) {
    const doc = await StoreCartLink.findOne({ _id: id, storeId });
    if (!doc) return { error: "Sepet linki bulunamadı" };
    const data = normalizeBody({ ...doc.toObject(), ...body });
    if (!data.salesChannelId || !data.basePath) {
        return { error: "Satış kanalı seçin" };
    }
    if (!data.products.length) {
        return { error: "En az bir ürün ekleyin" };
    }
    if (data.couponMode === "with_code" && !data.couponCode) {
        return { error: "Kupon kodu seçin veya girin" };
    }
    data.generatedUrl = buildGeneratedUrl(data);
    Object.assign(doc, data);
    await doc.save();
    return { cartLink: doc.toObject() };
}

async function deleteCartLink(storeId, id) {
    const r = await StoreCartLink.deleteOne({ _id: id, storeId });
    if (!r.deletedCount) return { error: "Sepet linki bulunamadı" };
    return { ok: true };
}

module.exports = {
    listCartLinks,
    getCartLink,
    getSalesChannelsForStore,
    createCartLink,
    updateCartLink,
    deleteCartLink,
    buildSalesChannels,
    buildCampaignSalesChannels,
    storeHasWebStorefront,
    buildGeneratedUrl,
};
