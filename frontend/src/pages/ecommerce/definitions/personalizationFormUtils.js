export const PERSONALIZATION_NAME_MAX = 100;
export const PAID_PRICING_FEATURE = "product_personalization_pricing";

export const PERSONALIZATION_TYPES = [
    { id: "yes_no", label: "Evet/Hayır", icon: "toggle" },
    { id: "selection", label: "Seçim", icon: "list" },
    { id: "color", label: "Renk Seçimi", icon: "color" },
    { id: "date", label: "Tarih Seçimi", icon: "date" },
    { id: "file", label: "Dosya", icon: "file" },
    { id: "text", label: "Yazı", icon: "text" },
    { id: "paragraph", label: "Paragraf", icon: "paragraph" },
];

export const SELECTION_STYLE_OPTIONS = [
    { id: "box", label: "Kutu" },
    { id: "list", label: "Liste" },
    { id: "color_image", label: "Renk/Resim" },
];

export const VALUE_PRICE_TYPES = [
    { id: "fixed", label: "Sabit Fiyat" },
    { id: "percent", label: "Ürün Fiyatının Yüzdesi" },
];

export function emptyPersonalizationForm() {
    return {
        name: "",
        options: [],
    };
}

export function emptyOptionForm() {
    return {
        _id: null,
        clientKey: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "",
        description: "",
        showDescription: false,
        type: "yes_no",
        selectionStyle: "list",
        minSelection: "",
        maxSelection: "",
        minChars: "",
        maxChars: "",
        dateStartDays: "",
        dateEndDays: "",
        minFiles: "",
        maxFiles: "",
        allowedExtensions: [],
        extensionInput: "",
        values: [],
        valueInput: "",
        isPaid: false,
        priceType: "fixed",
        fixedPrice: "",
        pricePercent: "",
        required: false,
        dependsOnOptionId: "",
    };
}

export function personalizationToForm(row) {
    if (!row) return emptyPersonalizationForm();
    return {
        name: row.name || "",
        options: (row.options || []).map(optionToForm),
    };
}

export function optionToForm(opt) {
    if (!opt) return emptyOptionForm();
    return {
        _id: opt._id ? String(opt._id) : null,
        clientKey: opt._id ? String(opt._id) : `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: opt.title || "",
        description: opt.description || "",
        showDescription: !!opt.showDescription,
        type: opt.type || "yes_no",
        selectionStyle: opt.selectionStyle || "list",
        minSelection: opt.minSelection ?? "",
        maxSelection: opt.maxSelection ?? "",
        minChars: opt.minChars ?? "",
        maxChars: opt.maxChars ?? "",
        dateStartDays: opt.dateStartDays ?? "",
        dateEndDays: opt.dateEndDays ?? "",
        minFiles: opt.minFiles ?? "",
        maxFiles: opt.maxFiles ?? "",
        allowedExtensions: [...(opt.allowedExtensions || [])],
        extensionInput: "",
        values: (opt.values || []).map((v, i) => ({
            label: v.label || "",
            priceType: v.priceType || "fixed",
            price: v.price ?? "",
            sortOrder: v.sortOrder ?? i,
        })),
        valueInput: "",
        isPaid: !!opt.isPaid,
        priceType: opt.priceType || "fixed",
        fixedPrice: opt.fixedPrice ?? "",
        pricePercent: opt.pricePercent ?? "",
        required: !!opt.required,
        dependsOnOptionId: opt.dependsOnOptionId ? String(opt.dependsOnOptionId) : "",
    };
}

export function optionFormToPayload(opt, allowPaid) {
    const base = {
        _id: opt._id || undefined,
        title: opt.title.trim(),
        description: opt.showDescription ? opt.description.trim() : "",
        showDescription: !!opt.showDescription,
        type: opt.type,
        selectionStyle: opt.selectionStyle,
        minSelection: opt.minSelection === "" ? undefined : Number(opt.minSelection),
        maxSelection: opt.maxSelection === "" ? undefined : Number(opt.maxSelection),
        minChars: opt.minChars === "" ? undefined : Number(opt.minChars),
        maxChars: opt.maxChars === "" ? undefined : Number(opt.maxChars),
        dateStartDays: opt.dateStartDays === "" ? undefined : Number(opt.dateStartDays),
        dateEndDays: opt.dateEndDays === "" ? undefined : Number(opt.dateEndDays),
        minFiles: opt.minFiles === "" ? undefined : Number(opt.minFiles),
        maxFiles: opt.maxFiles === "" ? undefined : Number(opt.maxFiles),
        allowedExtensions: opt.allowedExtensions || [],
        values:
            opt.type === "selection"
                ? (opt.values || [])
                      .filter((v) => v.label?.trim())
                      .map((v, i) => ({
                          label: v.label.trim(),
                          priceType: allowPaid && v.priceType === "percent" ? "percent" : "fixed",
                          price: allowPaid ? Number(v.price) || 0 : 0,
                          sortOrder: i,
                      }))
                : [],
        isPaid: allowPaid && !!opt.isPaid,
        priceType: allowPaid && opt.priceType === "percent" ? "percent" : "fixed",
        fixedPrice: allowPaid && opt.isPaid ? Number(opt.fixedPrice) || 0 : 0,
        pricePercent: allowPaid && opt.isPaid && opt.priceType === "percent" ? Number(opt.pricePercent) || 0 : 0,
        required: !!opt.required,
        dependsOnOptionId: opt.dependsOnOptionId || undefined,
        sortOrder: opt.sortOrder ?? 0,
    };
    return base;
}

export function formToPersonalizationPayload(form, allowPaid) {
    const options = (form.options || []).map((o, i) => {
        const payload = optionFormToPayload({ ...o, sortOrder: i }, allowPaid);
        if (o.dependsOnOptionId) {
            const parent = form.options.find(
                (p) => String(p._id || p.clientKey) === String(o.dependsOnOptionId)
            );
            payload.dependsOnOptionId = parent?._id || undefined;
        }
        return payload;
    });
    return {
        name: form.name.trim().slice(0, PERSONALIZATION_NAME_MAX),
        options,
    };
}

export function getOptionLabel(opt) {
    return opt.title?.trim() || "Seçenek";
}

export function getTypeLabel(typeId) {
    return PERSONALIZATION_TYPES.find((t) => t.id === typeId)?.label || typeId;
}

export function addSelectionValue(form) {
    const label = String(form.valueInput || "").trim();
    if (!label) return form;
    if (form.values.some((v) => v.label.toLowerCase() === label.toLowerCase())) {
        return { ...form, valueInput: "" };
    }
    return {
        ...form,
        values: [...form.values, { label, priceType: "fixed", price: "", sortOrder: form.values.length }],
        valueInput: "",
    };
}

export function removeSelectionValue(form, index) {
    return {
        ...form,
        values: form.values.filter((_, i) => i !== index).map((v, i) => ({ ...v, sortOrder: i })),
    };
}

export function addExtension(form) {
    let ext = String(form.extensionInput || "").trim().toLowerCase();
    if (!ext) return form;
    if (!ext.startsWith(".")) ext = `.${ext}`;
    if (form.allowedExtensions.includes(ext)) return { ...form, extensionInput: "" };
    return {
        ...form,
        allowedExtensions: [...form.allowedExtensions, ext],
        extensionInput: "",
    };
}

export function removeExtension(form, ext) {
    return {
        ...form,
        allowedExtensions: form.allowedExtensions.filter((e) => e !== ext),
    };
}

export function stripPaidFromOptionForm(opt) {
    return {
        ...opt,
        isPaid: false,
        fixedPrice: "",
        pricePercent: "",
        values: (opt.values || []).map((v) => ({ ...v, priceType: "fixed", price: "" })),
    };
}
