export function slugifyBrandName(name) {
    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 185);
}

export const BRAND_SORT_CRITERIA_OPTIONS = [
    { id: "", label: "Sıralama ölçütü seçiniz" },
    { id: "discount_desc", label: "İndirim Oranına Göre Azalan" },
    { id: "discount_asc", label: "İndirim Oranına Göre Artan" },
    { id: "price_desc", label: "Fiyata Göre Azalan" },
    { id: "price_asc", label: "Fiyata Göre Artan" },
    { id: "created_desc", label: "Yeniden Eskiye (Oluşturulma Tarihine Göre)" },
    { id: "created_asc", label: "Eskiden Yeniye (Oluşturulma Tarihine Göre)" },
];

const LEGACY_SORT_LABELS = {
    discount_desc: "İndirim Oranına Göre Azalan",
    discount_asc: "İndirim Oranına Göre Artan",
    price_asc: "Fiyata Göre Artan",
    price_desc: "Fiyata Göre Azalan",
    created_desc: "Yeniden Eskiye (Oluşturulma Tarihine Göre)",
    created_asc: "Eskiden Yeniye (Oluşturulma Tarihine Göre)",
};

export function brandSortCriteriaLabel(id) {
    if (!id) return "—";
    const opt = BRAND_SORT_CRITERIA_OPTIONS.find((o) => o.id === id);
    if (opt?.id) return opt.label;
    return LEGACY_SORT_LABELS[id] || "—";
}

export function emptyBrandForm() {
    return {
        name: "",
        description: "",
        imageUrl: "",
        sortCriteria: "",
        seo: {
            slug: "",
            pageTitle: "",
            metaDescription: "",
            noIndex: false,
            canonicalUrl: "",
        },
    };
}

export function brandToForm(brand) {
    if (!brand) return emptyBrandForm();
    return {
        name: brand.name || "",
        description: brand.description || "",
        imageUrl: brand.imageUrl || "",
        sortCriteria: brand.sortCriteria || "",
        seo: {
            slug: brand.seo?.slug || "",
            pageTitle: brand.seo?.pageTitle || "",
            metaDescription: brand.seo?.metaDescription || "",
            noIndex: !!brand.seo?.noIndex,
            canonicalUrl: brand.seo?.canonicalUrl || "",
        },
    };
}

export function formToBrandPayload(form) {
    return {
        name: form.name.trim(),
        description: form.description,
        imageUrl: form.imageUrl,
        sortCriteria: form.sortCriteria,
        seo: {
            slug: String(form.seo?.slug || "").replace(/^\/+/, ""),
            pageTitle: form.seo?.pageTitle || "",
            metaDescription: form.seo?.metaDescription || "",
            noIndex: !!form.seo?.noIndex,
            canonicalUrl: form.seo?.canonicalUrl || "",
        },
    };
}

export { getStoreDisplayDomain } from "./categoryFormUtils";
