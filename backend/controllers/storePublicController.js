const storeService = require("../services/storeService");
const storeProductService = require("../services/storeProductService");
const storeCartService = require("../services/storeCartService");
const storeCheckoutService = require("../services/storeCheckoutService");
const internalInboxService = require("../services/inbox/internalInboxService");
const marketingPopupService = require("../services/marketing/marketingPopupService");
const marketingAffiliateService = require("../services/marketing/marketingAffiliateService");
const logger = require("../config/logger");

const SESSION_COOKIE = "store_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return {};
    return Object.fromEntries(
        header.split(";").map((part) => {
            const i = part.indexOf("=");
            if (i < 0) return [part.trim(), ""];
            const k = part.slice(0, i).trim();
            const v = part.slice(i + 1).trim();
            try {
                return [k, decodeURIComponent(v)];
            } catch {
                return [k, v];
            }
        })
    );
}

function getSessionId(req, res) {
    const cookies = parseCookies(req);
    let sid = cookies[SESSION_COOKIE] || req.headers["x-store-session"];
    if (!sid) {
        sid = require("crypto").randomBytes(16).toString("hex");
        res.cookie(SESSION_COOKIE, sid, {
            httpOnly: true,
            maxAge: SESSION_MAX_AGE,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });
    }
    return sid;
}

function clientIp(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
}

exports.resolve = async (req, res) => {
    try {
        const host = req.query.host || req.headers.host;
        const slug = req.query.slug;
        let store = null;
        if (slug) store = await storeService.getStoreBySlug(slug);
        else if (host) store = await storeService.resolveStoreByHost(host);
        if (!store) return res.status(404).json({ error: "Mağaza bulunamadı" });
        return res.json({
            success: true,
            store: {
                id: store._id,
                name: store.name,
                slug: store.slug,
                themeId: store.themeId,
                themeOverrides: store.themeOverrides,
                settings: {
                    currency: store.settings?.currency,
                    contactEmail: store.settings?.contactEmail,
                    contactPhone: store.settings?.contactPhone,
                    address: store.settings?.address,
                    flatShippingCost: store.settings?.flatShippingCost,
                    freeShippingOver: store.settings?.freeShippingOver,
                },
            },
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listProducts = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const products = await storeProductService.listStoreProducts(store._id, { visibleOnly: true });
        return res.json({ success: true, products });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const StoreProduct = require("../models/StoreProduct");
        const product = await StoreProduct.findOne({
            storeId: store._id,
            slug: req.params.productSlug,
            visible: true,
        }).lean();
        if (!product) return res.status(404).json({ error: "Ürün yok" });
        return res.json({ success: true, product });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getCart = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const sessionId = getSessionId(req, res);
        const cart = await storeCartService.getCartWithProducts(store._id, sessionId);
        const shipping = storeCheckoutService.calcShipping(store, cart.subtotal || 0);
        return res.json({ success: true, cart, shipping, total: (cart.subtotal || 0) + shipping });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const sessionId = getSessionId(req, res);
        const { storeProductId, quantity } = req.body || {};
        const out = await storeCartService.addItem(store._id, sessionId, storeProductId, quantity);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const sessionId = getSessionId(req, res);
        const out = await storeCartService.updateItemQty(
            store._id,
            sessionId,
            req.params.productId,
            req.body?.quantity
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.checkout = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const sessionId = getSessionId(req, res);
        const { customer, shippingAddress } = req.body || {};
        if (!customer?.name || !customer?.email) {
            return res.status(400).json({ error: "Ad ve e-posta zorunlu" });
        }
        const out = await storeCheckoutService.createCheckout(
            store,
            sessionId,
            customer,
            shippingAddress,
            clientIp(req),
            req.body || {}
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.paytrCallback = async (req, res) => {
    try {
        const result = await storeCheckoutService.handlePaytrCallback(req.body || {});
        if (!result.ok) {
            logger.warn("[Store PayTR callback]", result);
            return res.send("OK");
        }
        return res.send("OK");
    } catch (e) {
        logger.error("[Store PayTR callback]", e.message);
        return res.send("OK");
    }
};

exports.orderStatus = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const order = await storeCheckoutService.getOrderByGuestToken(store._id, req.query.token);
        if (!order) return res.status(404).json({ error: "Sipariş bulunamadı" });
        return res.json({
            success: true,
            order: {
                orderNumber: order.orderNumber,
                status: order.status,
                total: order.total,
                paymentStatus: order.payment?.status,
            },
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

/** Mağaza formu / canlı sohbet → gelen kutusu */
exports.postInboxMessage = async (req, res) => {
    try {
        const slug = req.params.slug;
        const store = await storeService.getStoreBySlug(slug);
        if (!store) return res.status(404).json({ error: "Mağaza bulunamadı" });
        const rawChannel = String(req.body.channel || "form").toLowerCase();
        const channelId =
            rawChannel === "livechat" ? "livechat" : rawChannel === "email" ? "email" : "form";
        let out;
        if (channelId === "email") {
            const emailInbox = require("../services/inbox/emailInboxService");
            const { name, email, text, subject } = req.body || {};
            out = await emailInbox.upsertEmailMessage(store._id, {
                messageId: `web_${Date.now()}`,
                fromName: name || email,
                fromEmail: email,
                subject,
                text: text || subject,
                sentAt: new Date(),
            });
            if (out) out = { conversationId: out._id };
            else out = { error: "Mesaj kaydedilemedi" };
        } else {
            out = await internalInboxService.ingestPublicMessage(store._id, channelId, req.body || {});
        }
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, conversationId: out.conversationId });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listMarketingPopups = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const path = String(req.query.path || "/");
        const popups = await marketingPopupService.listActiveForStorefront(store._id, path);
        return res.json({ success: true, popups });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.trackAffiliateClick = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const code = req.body?.ref || req.query?.ref;
        const out = await marketingAffiliateService.trackClick(store._id, code, {
            path: req.body?.path,
            userAgent: req.headers["user-agent"],
        });
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.trackPopupEvent = async (req, res) => {
    try {
        const store = await storeService.getStoreBySlug(req.params.slug);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const { popupId, event, email } = req.body || {};
        if (!popupId) return res.status(400).json({ error: "popupId gerekli" });
        if (event === "convert") await marketingPopupService.trackPopupConvert(store._id, popupId, email);
        else await marketingPopupService.trackPopupView(store._id, popupId, email);
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
