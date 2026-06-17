import { normalizeProductRulesForForm } from "./CampaignProductRulesEditor";

export const TITLE_MAX = 200;
export const CODE_MAX = 64;

export const DISCOUNT_TYPES = [
    { id: "percentage", label: "Yüzdelik" },
    { id: "fixed", label: "Sabit Tutar" },
    { id: "free_shipping", label: "Ücretsiz Kargo" },
    { id: "buy_x_get_y", label: "X Al Y Kazan" },
];

export const SCOPE_OPTIONS = [
    { id: "all_products", label: "Tüm Ürünler" },
    { id: "specific_products", label: "Belirli Ürünler" },
];

export const CUSTOMER_SCOPES = [
    { id: "all", label: "Tüm Kişiler" },
    { id: "groups", label: "Müşteri Grubu & Segment" },
    { id: "specific", label: "Spesifik Müşteriler" },
];

export function emptyCampaignForm(kind = "automatic") {
    return {
        title: "",
        kind,
        code: "",
        discountType: "percentage",
        discountValue: 0,
        scope: "all_products",
        includeDiscountedProducts: false,
        productRules: [],
        buyRequirementMode: "quantity",
        requirements: {
            limitPurchaseAmount: false,
            minPurchaseAmount: 0,
            maxPurchaseAmount: null,
            maxPurchaseAmountEnabled: false,
            limitQuantity: false,
            minQuantity: 0,
            maxQuantity: null,
            maxQuantityEnabled: false,
        },
        buyXGetY: {
            buyCondition: "quantity",
            buyQuantity: 0,
            buyAmount: 0,
            buyMaxQuantity: null,
            buyProductIds: [],
            getQuantity: 0,
            getProductIds: [],
            getDiscountPercent: 0,
            getFree: false,
            autoAddToCart: false,
        },
        usageLimits: {
            totalEnabled: false,
            totalLimit: null,
            perUserEnabled: false,
            perUserLimit: null,
        },
        customers: {
            scope: "all",
            groupNames: [],
            customerIds: [],
            accountOnly: false,
        },
        settings: {
            combineWithOthers: false,
            channelsEnabled: false,
            salesChannelIds: [],
            currenciesEnabled: false,
            currencies: [],
            perOrderLimitEnabled: false,
            perOrderLimit: 1,
        },
        dates: {
            startEnabled: false,
            startDate: "",
            endEnabled: false,
            endDate: "",
        },
        extraDiscounts: {
            freeShippingOnCode: false,
            addRewardProduct: false,
            rewardProductIds: [],
        },
        priceBasis: "sale",
        buyRuleTarget: "products",
        active: true,
    };
}

export function campaignToForm(c) {
    const f = emptyCampaignForm(c?.kind || "automatic");
    if (!c) return f;
    f.title = c.title || "";
    f.kind = c.kind === "code" ? "code" : "automatic";
    f.code = c.code || "";
    f.discountType = c.discountType || "percentage";
    f.discountValue = Number(c.discountValue) || 0;
    f.scope = c.scope || "all_products";
    f.includeDiscountedProducts = !!c.includeDiscountedProducts;
    f.productRules = Array.isArray(c.productRules) ? c.productRules.map((r) => ({ ...r })) : [];
    if (f.scope === "specific_products") {
        f.productRules = normalizeProductRulesForForm(f.productRules);
    }
    f.requirements = { ...f.requirements, ...(c.requirements || {}) };
    f.requirements.maxQuantityEnabled =
        f.requirements.maxQuantity != null && f.requirements.maxQuantity !== "";
    f.requirements.maxPurchaseAmountEnabled =
        f.requirements.maxPurchaseAmount != null && f.requirements.maxPurchaseAmount !== "";
    f.buyRequirementMode =
        c.buyRequirementMode ||
        (f.requirements.limitPurchaseAmount && !f.requirements.limitQuantity
            ? "amount"
            : "quantity");
    f.buyXGetY = { ...f.buyXGetY, ...(c.buyXGetY || {}) };
    f.usageLimits = { ...f.usageLimits, ...(c.usageLimits || {}) };
    f.customers = {
        ...f.customers,
        ...(c.customers || {}),
        customerIds: (c.customers?.customerIds || []).map(String),
    };
    f.settings = { ...f.settings, ...(c.settings || {}) };
    f.dates = {
        startEnabled: !!c.dates?.startEnabled,
        startDate: c.dates?.startDate ? toLocalInput(c.dates.startDate) : "",
        endEnabled: !!c.dates?.endEnabled,
        endDate: c.dates?.endDate ? toLocalInput(c.dates.endDate) : "",
    };
    f.extraDiscounts = { ...f.extraDiscounts, ...(c.extraDiscounts || {}) };
    f.priceBasis = c.priceBasis === "discounted" ? "discounted" : "sale";
    f.buyRuleTarget =
        c.buyRuleTarget || (c.productRules?.[0]?.field ? c.productRules[0].field : "products");
    f.active = c.active !== false;
    return f;
}

function toLocalInput(iso) {
    try {
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return "";
    }
}

function fromLocalInput(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function productRulesForPayload(form) {
    if (form.scope !== "specific_products") return [];
    return (form.productRules || [])
        .map((r) => ({
            field: r.field || "products",
            mode: r.mode === "exclude" ? "exclude" : "include",
            values: (r.values || []).map(String).filter(Boolean),
        }))
        .filter((r) => r.values.length > 0);
}

export function formToCampaignPayload(form) {
    return {
        title: form.title.trim(),
        kind: form.kind,
        code: form.kind === "code" ? form.code.trim().toUpperCase() : "",
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        scope: form.scope,
        includeDiscountedProducts: !!form.includeDiscountedProducts,
        productRules: productRulesForPayload(form),
        requirements: form.requirements,
        buyXGetY: form.buyXGetY,
        usageLimits: form.usageLimits,
        customers: {
            ...form.customers,
            customerIds: form.customers.customerIds || [],
        },
        settings: form.settings,
        dates: {
            startEnabled: !!form.dates.startEnabled,
            startDate: form.dates.startEnabled ? fromLocalInput(form.dates.startDate) : null,
            endEnabled: !!form.dates.endEnabled,
            endDate: form.dates.endEnabled ? fromLocalInput(form.dates.endDate) : null,
        },
        extraDiscounts: form.extraDiscounts,
        priceBasis: form.priceBasis,
        buyRuleTarget: form.buyRuleTarget,
        active: !!form.active,
    };
}

export function campaignTypeLabel(c) {
    if (c?.kind === "code") return "İndirim Kodu";
    if (c?.discountType === "buy_x_get_y") return "X Al Y Kazan";
    if (c?.discountType === "free_shipping") return "Ücretsiz Kargo";
    if (c?.discountType === "fixed") return "Sabit Tutar";
    return "Otomatik İndirim";
}

export function fmtCampaignDate(c) {
    const d = c?.dates?.startDate || c?.createdAt;
    if (!d) return "—";
    try {
        return new Date(d).toLocaleDateString("tr-TR");
    } catch {
        return "—";
    }
}
