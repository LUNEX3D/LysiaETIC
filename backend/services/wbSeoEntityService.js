"use strict";

const mongoose = require("mongoose");
const WBSite = require("../models/WBSite");
const WBBlogPost = require("../models/WBBlogPost");
const StoreProduct = require("../models/StoreProduct");
const StoreCategory = require("../models/StoreCategory");
const { chatCompletion } = require("./llmChatRouter");
const logger = require("../config/logger");

function toOid(id) {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function seoComplete(entityType, row) {
    if (entityType === "product") {
        return !!(row.seo?.metaTitle?.trim() && row.seo?.metaDescription?.trim() && row.seo?.slug?.trim());
    }
    if (entityType === "category") {
        return !!(row.seo?.pageTitle?.trim() && row.seo?.metaDescription?.trim() && row.seo?.slug?.trim());
    }
    if (entityType === "blog") {
        return !!(row.seo?.title?.trim() && row.seo?.description?.trim() && row.slug?.trim());
    }
    return false;
}

async function assertSite(siteId, userId) {
    const site = await WBSite.findOne({ _id: toOid(siteId), userId: toOid(userId) }).lean();
    if (!site) return { error: "Site bulunamadı" };
    return { site };
}

async function listEntities(siteId, userId, entityType, { page = 1, limit = 30, filter = "all" } = {}) {
    const check = await assertSite(siteId, userId);
    if (check.error) return check;
    const { site } = check;
    const skip = (page - 1) * limit;

    if (entityType === "product" && site.storeId) {
        const q = { storeId: toOid(site.storeId), visible: { $ne: false } };
        const [rows, total] = await Promise.all([
            StoreProduct.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit)
                .select("title slug seo updatedAt").lean(),
            StoreProduct.countDocuments(q),
        ]);
        let items = rows.map((r) => ({
            id: r._id,
            name: r.title,
            slug: r.seo?.slug || r.slug,
            seo: r.seo,
            complete: seoComplete("product", r),
        }));
        if (filter === "incomplete") items = items.filter((i) => !i.complete);
        return { items, total, page, entityType };
    }

    if (entityType === "category" && site.storeId) {
        const q = { storeId: toOid(site.storeId) };
        const [rows, total] = await Promise.all([
            StoreCategory.find(q).sort({ name: 1 }).skip(skip).limit(limit)
                .select("name seo updatedAt").lean(),
            StoreCategory.countDocuments(q),
        ]);
        let items = rows.map((r) => ({
            id: r._id,
            name: r.name,
            slug: r.seo?.slug,
            seo: r.seo,
            complete: seoComplete("category", r),
        }));
        if (filter === "incomplete") items = items.filter((i) => !i.complete);
        return { items, total, page, entityType };
    }

    if (entityType === "blog") {
        const q = { siteId: toOid(siteId) };
        const [rows, total] = await Promise.all([
            WBBlogPost.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit)
                .select("title slug seo status updatedAt thumbnailUrl").lean(),
            WBBlogPost.countDocuments(q),
        ]);
        let items = rows.map((r) => ({
            id: r._id,
            name: r.title,
            slug: r.slug,
            seo: r.seo,
            status: r.status,
            complete: seoComplete("blog", r),
        }));
        if (filter === "incomplete") items = items.filter((i) => !i.complete);
        return { items, total, page, entityType };
    }

    return { error: "Geçersiz entity tipi veya mağaza bağlantısı yok" };
}

async function updateEntitySeo(siteId, userId, entityType, entityId, seoPatch) {
    const check = await assertSite(siteId, userId);
    if (check.error) return check;

    if (entityType === "product" && check.site.storeId) {
        const doc = await StoreProduct.findOne({ _id: toOid(entityId), storeId: toOid(check.site.storeId) });
        if (!doc) return { error: "Ürün bulunamadı" };
        doc.seo = { ...(doc.seo?.toObject?.() || doc.seo || {}), ...seoPatch };
        if (seoPatch.slug) doc.seo.slug = slugify(seoPatch.slug);
        doc.markModified("seo");
        await doc.save();
        return { entity: doc.toObject() };
    }

    if (entityType === "category" && check.site.storeId) {
        const doc = await StoreCategory.findOne({ _id: toOid(entityId), storeId: toOid(check.site.storeId) });
        if (!doc) return { error: "Kategori bulunamadı" };
        doc.seo = { ...(doc.seo?.toObject?.() || doc.seo || {}), ...seoPatch };
        if (seoPatch.slug) doc.seo.slug = slugify(seoPatch.slug);
        doc.markModified("seo");
        await doc.save();
        return { entity: doc.toObject() };
    }

    if (entityType === "blog") {
        const doc = await WBBlogPost.findOne({ _id: toOid(entityId), siteId: toOid(siteId) });
        if (!doc) return { error: "Blog yazısı bulunamadı" };
        doc.seo = { ...(doc.seo?.toObject?.() || doc.seo || {}), ...seoPatch };
        if (seoPatch.slug) doc.slug = slugify(seoPatch.slug);
        doc.markModified("seo");
        await doc.save();
        return { entity: doc.toObject() };
    }

    return { error: "Güncellenemedi" };
}

function fallbackSeo(entityType, context) {
    const name = context.name || context.title || "Ürün";
    const desc = (context.description || context.excerpt || "").replace(/<[^>]+>/g, "").trim();
    const baseSlug = slugify(name);

    if (entityType === "product") {
        const title = `${name} — Hızlı Kargo & Güvenli Alışveriş`.slice(0, 60);
        return {
            metaTitle: title,
            metaDescription: (desc || `${name} en uygun fiyatlarla. Hızlı kargo, kolay iade.`).slice(0, 160),
            slug: baseSlug,
        };
    }
    if (entityType === "category") {
        return {
            pageTitle: `${name} | Online Alışveriş`.slice(0, 60),
            metaDescription: (desc || `${name} kategorisinde en yeni ürünleri keşfedin.`).slice(0, 160),
            slug: baseSlug,
        };
    }
    if (entityType === "blog") {
        return {
            title: name.slice(0, 60),
            description: (desc || name).slice(0, 160),
            slug: baseSlug,
            ogImage: context.thumbnailUrl || "",
        };
    }
    if (entityType === "site") {
        return {
            title: `${name} | Online Mağaza`.slice(0, 60),
            description: (desc || `${name} — güvenli alışveriş, hızlı teslimat.`).slice(0, 160),
            keywords: context.keywords || "",
        };
    }
    return {};
}

async function generateAiSeo(entityType, context = {}) {
    const name = context.name || context.title || "Mağaza";
    const system = "Sen Türkçe e-ticaret SEO uzmanısın. Yalnızca geçerli JSON döndür, markdown kullanma.";
    const fieldMap = {
        product: "metaTitle, metaDescription, slug",
        category: "pageTitle, metaDescription, slug",
        blog: "title, description, slug, ogImage",
        site: "title, description, keywords",
    };
    const user = `Tip: ${entityType}\nBaşlık/Ad: ${name}\nAçıklama: ${(context.description || "").slice(0, 500)}\nMarka: ${context.brand || ""}\nFiyat: ${context.price || ""}\n\nJSON alanları: ${fieldMap[entityType] || fieldMap.site}. slug küçük harf, tire ile. title max 60, description max 160 karakter.`;

    try {
        const reply = await chatCompletion([
            { role: "system", content: system },
            { role: "user", content: user },
        ], { maxTokens: 400 });
        const text = reply?.content || reply?.message || "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.slug) parsed.slug = slugify(parsed.slug);
            return { seo: parsed, source: "ai" };
        }
    } catch (err) {
        logger.warn("[SeoEntity] AI fallback:", err.message);
    }

    return { seo: fallbackSeo(entityType, context), source: "template" };
}

async function bulkGenerateSeo(siteId, userId, entityType, { limit = 20 } = {}) {
    const list = await listEntities(siteId, userId, entityType, { page: 1, limit: 100, filter: "incomplete" });
    if (list.error) return list;

    const targets = (list.items || []).slice(0, limit);
    const results = [];

    for (const item of targets) {
        const gen = await generateAiSeo(entityType, {
            name: item.name,
            title: item.name,
            description: item.seo?.metaDescription || item.seo?.description,
        });
        const upd = await updateEntitySeo(siteId, userId, entityType, item.id, gen.seo);
        results.push({ id: item.id, name: item.name, ok: !upd.error, source: gen.source });
    }

    return { processed: results.length, results };
}

module.exports = {
    listEntities,
    updateEntitySeo,
    generateAiSeo,
    bulkGenerateSeo,
    slugify,
};
