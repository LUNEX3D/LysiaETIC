export function slugifyCategoryName(name) {
    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 185);
}

export const SORT_CRITERIA_OPTIONS = [
    { id: "", label: "Sıralama ölçütü seçiniz" },
    { id: "discount_asc", label: "İndirim Oranına Göre Artan" },
    { id: "price_desc", label: "Fiyata Göre Azalan" },
    { id: "price_asc", label: "Fiyata Göre Artan" },
    { id: "created_desc", label: "Yeniden Eskiye (Oluşturulma Tarihine Göre)" },
    { id: "created_asc", label: "Eskiden Yeniye (Oluşturulma Tarihine Göre)" },
    { id: "manual", label: "Manuel Sıralama" },
];

const LEGACY_SORT_LABELS = {
    manual: "Manuel Sıralama",
    best_selling: "En çok satanlar",
    newest: "En yeni",
    price_asc: "Fiyata Göre Artan",
    price_desc: "Fiyata Göre Azalan",
    name_asc: "Ad (A-Z)",
};

export const DYNAMIC_CONDITION_FIELDS = [
    { id: "", label: "Koşul seçiniz" },
    { id: "brand", label: "Ürün Markası" },
    { id: "price", label: "Ürün Fiyatı" },
    { id: "tag", label: "Ürün Etiketi" },
    { id: "variant", label: "Varyant Değeri" },
    { id: "discounted", label: "İndirimli Ürünler" },
    { id: "created_at", label: "Oluşturulma Tarihi" },
];

/** @deprecated use DYNAMIC_CONDITION_FIELDS */
export const CONDITION_FIELD_OPTIONS = DYNAMIC_CONDITION_FIELDS;

export function operatorsForConditionField(fieldId) {
    if (fieldId === "price") {
        return [
            { id: "eq", label: "eşit" },
            { id: "gt", label: "büyüktür" },
            { id: "lt", label: "küçüktür" },
            { id: "gte", label: "büyük eşit" },
            { id: "lte", label: "küçük eşit" },
        ];
    }
    if (fieldId === "discounted") {
        return [
            { id: "yes", label: "evet" },
            { id: "no", label: "hayır" },
        ];
    }
    if (fieldId === "created_at") {
        return [
            { id: "before", label: "önce" },
            { id: "after", label: "sonra" },
            { id: "equals", label: "eşit" },
        ];
    }
    return [
        { id: "contains", label: "içeren" },
        { id: "equals", label: "eşit" },
    ];
}

export function defaultOperatorForField(fieldId) {
    return operatorsForConditionField(fieldId)[0]?.id || "contains";
}

export function emptyDynamicConditionRow() {
    return { field: "", operator: "contains", value: "" };
}

export const CONDITION_OPERATOR_OPTIONS = [
    { id: "contains", label: "içeren" },
    { id: "equals", label: "eşit" },
];

export function sortCriteriaLabel(id) {
    if (!id) return "—";
    const opt = SORT_CRITERIA_OPTIONS.find((o) => o.id === id);
    if (opt?.id) return opt.label;
    return LEGACY_SORT_LABELS[id] || "—";
}

export function emptyCategoryForm(categoryType = "normal") {
    return {
        name: "",
        parentId: "",
        categoryType,
        description: "",
        imageUrl: "",
        sortCriteria: "",
        conditionMatch: "all",
        dynamicConditions: [emptyDynamicConditionRow()],
        seo: {
            slug: "",
            pageTitle: "",
            metaDescription: "",
            noIndex: false,
            canonicalUrl: "",
        },
    };
}

export function categoryToForm(cat) {
    if (!cat) return emptyCategoryForm();
    return {
        name: cat.name || "",
        parentId: cat.parentId ? String(cat.parentId) : "",
        categoryType: cat.categoryType || "normal",
        description: cat.description || "",
        imageUrl: cat.imageUrl || "",
        sortCriteria: cat.sortCriteria || "",
        conditionMatch: cat.conditionMatch === "any" ? "any" : "all",
        dynamicConditions:
            cat.dynamicConditions?.length > 0
                ? cat.dynamicConditions.map((c) => ({ ...c }))
                : [emptyDynamicConditionRow()],
        seo: {
            slug: cat.seo?.slug || "",
            pageTitle: cat.seo?.pageTitle || "",
            metaDescription: cat.seo?.metaDescription || "",
            noIndex: !!cat.seo?.noIndex,
            canonicalUrl: cat.seo?.canonicalUrl || "",
        },
    };
}

export function formToCategoryPayload(form) {
    return {
        name: form.name.trim(),
        parentId: form.parentId || null,
        categoryType: form.categoryType,
        description: form.description,
        imageUrl: form.imageUrl,
        sortCriteria: form.sortCriteria,
        conditionMatch: form.conditionMatch,
        dynamicConditions: (form.dynamicConditions || []).filter((c) => String(c.value || "").trim()),
        seo: {
            slug: String(form.seo?.slug || "").replace(/^\/+/, ""),
            pageTitle: form.seo?.pageTitle || "",
            metaDescription: form.seo?.metaDescription || "",
            noIndex: !!form.seo?.noIndex,
            canonicalUrl: form.seo?.canonicalUrl || "",
        },
    };
}

export function getStoreDisplayDomain(store) {
    if (!store) return "magaza.com";
    if (store.customDomain && store.domainStatus === "verified") return store.customDomain;
    return store.subdomain || `${store.slug || "magaza"}.sites.dashtock.com`;
}
