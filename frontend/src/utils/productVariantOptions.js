/** Varyant değeri girişini virgül / satır sonu ile böler (yapıştırma desteği). */
export function parseVariantValueInput(text) {
    return String(text || "")
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

export function newVariantValue(label, displayStyle, sortOrder = 0) {
    return {
        label: String(label).trim().slice(0, 80),
        colorHex: displayStyle === "color_image" ? "#9ca3af" : "",
        imageUrl: "",
        sortOrder,
    };
}

export function normalizeVariantOptionGroup(raw) {
    const name = String(raw?.name || "").trim().slice(0, 100);
    const displayStyle = raw?.displayStyle === "color_image" ? "color_image" : "list";
    const values = (Array.isArray(raw?.values) ? raw.values : [])
        .map((v, i) => ({
            label: String(v?.label || "").trim(),
            colorHex: String(v?.colorHex || "").trim(),
            imageUrl: String(v?.imageUrl || "").trim(),
            sortOrder: Number.isFinite(Number(v?.sortOrder)) ? Number(v.sortOrder) : i,
        }))
        .filter((v) => v.label);
    return {
        name,
        displayStyle,
        showOnListingPages: !!raw?.showOnListingPages,
        values,
    };
}

function cartesian(arrays) {
    if (!arrays.length) return [[]];
    return arrays.reduce(
        (acc, curr) => acc.flatMap((prefix) => curr.map((item) => [...prefix, item])),
        [[]]
    );
}

function optionsKey(options) {
    if (!options || typeof options !== "object") return "";
    return Object.entries(options)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join("|");
}

function optionsFromMap(options) {
    if (!options) return {};
    if (options instanceof Map) return Object.fromEntries(options);
    return { ...options };
}

/** Seçenek gruplarından satış varyantı satırları üretir; mevcut fiyat/stok korunur. */
export function buildVariantsFromOptionGroups(groups, existing = [], basePrice = 0) {
    const normalized = (groups || [])
        .map(normalizeVariantOptionGroup)
        .filter((g) => g.name && g.values.length);
    if (!normalized.length) return existing || [];

    const existingByKey = new Map();
    (existing || []).forEach((v) => {
        const opts = optionsFromMap(v.options);
        const key = optionsKey(opts);
        if (key) existingByKey.set(key, v);
        if (v.title) existingByKey.set(`title:${v.title}`, v);
    });

    const valueArrays = normalized.map((g) =>
        g.values.map((val) => ({
            groupName: g.name,
            label: val.label,
            colorHex: val.colorHex,
            imageUrl: val.imageUrl,
        }))
    );

    return cartesian(valueArrays).map((combo) => {
        const options = {};
        combo.forEach((c) => {
            options[c.groupName] = c.label;
        });
        const title = combo.map((c) => c.label).join(" / ");
        const key = optionsKey(options);
        const prev = existingByKey.get(key) || existingByKey.get(`title:${title}`);
        return {
            title,
            options,
            price: prev?.price ?? basePrice,
            stock: prev?.stock ?? 0,
            sku: prev?.sku ?? "",
            barcode: prev?.barcode ?? "",
            compareAtPrice: prev?.compareAtPrice,
        };
    });
}

export const VARIANT_STYLE_LABELS = {
    list: "Liste",
    color_image: "Renk / Görsel",
};
