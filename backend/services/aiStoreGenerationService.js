"use strict";

/**
 * AI Store Builder — mağaza oluşturma sırasında görünüm + örnek içerik üretimi.
 * OpenAI yoksa kural tabanlı şablonlar kullanılır.
 */
const WBPage = require("../models/WBPage");
const WBSite = require("../models/WBSite");
const storeFacadeService = require("./storeFacadeService");
const logger = require("../config/logger");

const HERO_COPY = {
    fashion: {
        headline: "Yeni sezon koleksiyonu",
        subheadline: "Tarzınızı yansıtan parçalar, hızlı kargo ve kolay iade.",
        cta: "Koleksiyonu keşfet",
    },
    electronics: {
        headline: "Teknoloji vitrininiz",
        subheadline: "Orijinal ürünler, güvenli ödeme ve hızlı teslimat.",
        cta: "Ürünleri incele",
    },
    furniture: {
        headline: "Evinize değer katın",
        subheadline: "Seçkin mobilya ve dekorasyon ürünleri.",
        cta: "Kataloğu gör",
    },
    cosmetics: {
        headline: "Güzelliğinize özel",
        subheadline: "Cilt bakımı ve makyaj ürünlerinde özenle seçilmiş koleksiyon.",
        cta: "Alışverişe başla",
    },
    jewelry: {
        headline: "Zarif koleksiyon",
        subheadline: "Özel anlarınız için seçkin mücevherler.",
        cta: "Koleksiyonu gör",
    },
    food: {
        headline: "Taze lezzetler",
        subheadline: "Kaliteli gıda ve içecek ürünleri kapınızda.",
        cta: "Ürünlere göz at",
    },
    general: {
        headline: "Mağazanıza hoş geldiniz",
        subheadline: "Kaliteli ürünler, güvenli alışveriş deneyimi.",
        cta: "Alışverişe başla",
    },
};

const GENERATION_STEPS = [
    { id: "kit", labelTr: "Mağaza görünümü seçiliyor", durationMs: 800 },
    { id: "layout", labelTr: "Sayfa düzeni oluşturuluyor", durationMs: 1200 },
    { id: "brand", labelTr: "Marka stili uygulanıyor", durationMs: 900 },
    { id: "content", labelTr: "Vitrin metinleri yazılıyor", durationMs: 1500 },
    { id: "finalize", labelTr: "Mağaza hazırlanıyor", durationMs: 600 },
];

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function patchHeroSections(sections, copy) {
    if (!Array.isArray(sections)) return sections;
    return sections.map((sec) => {
        if (!sec || typeof sec !== "object") return sec;
        const type = String(sec.type || sec.component || "").toLowerCase();
        if (!type.includes("hero") && !type.includes("banner")) return sec;
        const props = { ...(sec.props || sec.settings || {}) };
        if (copy.headline) props.title = props.title || copy.headline;
        if (copy.subheadline) props.subtitle = props.subtitle || copy.subheadline;
        if (copy.cta) props.buttonText = props.buttonText || copy.cta;
        if (sec.props) return { ...sec, props };
        if (sec.settings) return { ...sec, settings: props };
        return { ...sec, props };
    });
}

async function applyHeroCopy(siteId, businessType) {
    const bt = String(businessType || "general").toLowerCase();
    const copy = HERO_COPY[bt] || HERO_COPY.general;
    const home = await WBPage.findOne({ siteId, isHomePage: true });
    if (!home || !Array.isArray(home.sections)) return { updated: false };

    home.sections = patchHeroSections(home.sections, copy);
    await home.save();
    return { updated: true, copy };
}

async function generateStore(userId, payload = {}) {
    const steps = [];
    const report = (id, status, detail) => {
        steps.push({ id, status, detail, at: new Date().toISOString() });
    };

    report("kit", "running");
    const created = await storeFacadeService.createLinkedStore(userId, payload);
    if (created.error) {
        report("kit", "error", created.error);
        return { error: created.error, steps };
    }
    report("kit", "done");

    const siteId = created.site.id;

    report("brand", "running");
    await storeFacadeService.applyStarterKit(userId, siteId, {
        businessType: payload.businessType,
        brandStyle: payload.brandStyle,
    });
    report("brand", "done");

    report("content", "running");
    const content = await applyHeroCopy(siteId, payload.businessType);
    report("content", "done", content);

    report("finalize", "done");

    const progress = await storeFacadeService.getSetupProgress(userId, siteId);

    return {
        site: created.site,
        store: created.store,
        kit: created.kit,
        steps,
        setupProgress: progress,
    };
}

async function simulateGenerationProgress(onStep) {
    for (const step of GENERATION_STEPS) {
        if (onStep) onStep({ ...step, status: "running" });
        await sleep(step.durationMs);
        if (onStep) onStep({ ...step, status: "done" });
    }
}

module.exports = {
    GENERATION_STEPS,
    HERO_COPY,
    generateStore,
    applyHeroCopy,
    simulateGenerationProgress,
};
