const LoginPageConfig = require("../models/LoginPageConfig");
const defaults = require("../data/loginPageDefaults");
const partnerTemplates = require("../data/loginPartnerTemplates");

const CONFIG_KEY = "default";

const mapPartnerItem = (p) => ({
    _id: p._id,
    name: p.name,
    logoUrl: p.logoUrl || "",
    website: p.website || "",
    order: p.order || 0,
    isTemplate: p.isTemplate === true,
});

const resolvePartnerItems = (rawPartners = {}) => {
    const rawItems = (rawPartners.items || []).filter((p) => p.active !== false);
    const useTemplate =
        rawItems.length === 0 &&
        rawPartners.useTemplateWhenEmpty !== false &&
        partnerTemplates.length > 0;

    const source = useTemplate
        ? partnerTemplates.map((t, i) => ({ ...t, order: t.order ?? i, isTemplate: true }))
        : rawItems;

    return {
        items: source
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(mapPartnerItem),
        usingTemplate: useTemplate,
    };
};

const deepMerge = (base, patch) => {
    if (!patch || typeof patch !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const [k, v] of Object.entries(patch)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
            out[k] = deepMerge(base?.[k] || {}, v);
        } else if (v !== undefined && v !== null && v !== "") {
            out[k] = v;
        }
    }
    return out;
};

const normalizePublicConfig = (doc) => {
    const raw = doc?.toObject ? doc.toObject() : doc || {};
    const merged = {
        hero: deepMerge(defaults.hero, raw.hero),
        partners: {
            ...deepMerge(defaults.partners, raw.partners),
            ...resolvePartnerItems(raw.partners || {}),
        },
        sections: {
            features: deepMerge(defaults.sections.features, raw.sections?.features),
            pricing: deepMerge(defaults.sections.pricing, raw.sections?.pricing),
            about: deepMerge(defaults.sections.about, raw.sections?.about),
            contact: deepMerge(defaults.sections.contact, raw.sections?.contact),
        },
        updatedAt: raw.updatedAt,
    };
    return merged;
};

const getOrCreateConfig = async () => {
    let doc = await LoginPageConfig.findOne({ key: CONFIG_KEY });
    if (!doc) {
        doc = await LoginPageConfig.create({
            key: CONFIG_KEY,
            hero: defaults.hero,
            partners: { ...defaults.partners, items: [] },
            sections: defaults.sections,
        });
    }
    return doc;
};

const getPublicLoginPageConfig = async () => normalizePublicConfig(await getOrCreateConfig());

const getAdminLoginPageConfig = async () => {
    const doc = await getOrCreateConfig();
    const obj = doc.toObject();
    const publicNorm = normalizePublicConfig(doc);
    const dbItems = (obj.partners?.items || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    return {
        ...publicNorm,
        partners: {
            ...publicNorm.partners,
            items: dbItems,
            usingTemplate: publicNorm.partners?.usingTemplate === true,
            templatePreview: partnerTemplates,
        },
        _id: obj._id,
    };
};

const updateLoginPageConfig = async (payload, userId) => {
    const doc = await getOrCreateConfig();
    if (payload.hero) doc.hero = deepMerge(doc.hero?.toObject?.() || doc.hero || {}, payload.hero);
    if (payload.partners) {
        const { items, ...rest } = payload.partners;
        doc.partners = deepMerge(doc.partners?.toObject?.() || doc.partners || {}, rest);
        if (Array.isArray(items)) doc.partners.items = items;
    }
    if (payload.sections) {
        doc.sections = doc.sections || {};
        for (const key of ["features", "pricing", "about", "contact"]) {
            if (payload.sections[key]) {
                doc.sections[key] = deepMerge(
                    doc.sections[key] || defaults.sections[key] || {},
                    payload.sections[key]
                );
                doc.markModified(`sections.${key}`);
            }
        }
    }
    if (userId) doc.updatedBy = userId;
    await doc.save();
    return getAdminLoginPageConfig();
};

const seedPartnerTemplate = async (userId, { replace = false } = {}) => {
    const doc = await getOrCreateConfig();
    if (doc.partners.items.length > 0 && !replace) {
        const err = new Error("Zaten referans firma var. Üzerine yazmak için replace=true gönderin.");
        err.statusCode = 400;
        throw err;
    }
    doc.partners.items = partnerTemplates.map((t, i) => ({
        name: t.name,
        logoUrl: t.logoUrl,
        website: t.website || "",
        order: t.order ?? i,
        active: true,
    }));
    doc.partners.useTemplateWhenEmpty = false;
    if (userId) doc.updatedBy = userId;
    await doc.save();
    return getAdminLoginPageConfig();
};

module.exports = {
    getPublicLoginPageConfig,
    getAdminLoginPageConfig,
    updateLoginPageConfig,
    getOrCreateConfig,
    seedPartnerTemplate,
    defaults,
    partnerTemplates,
};
