export const BARCODE_LABEL_DRAFT_KEY = "ec_barcode_label_draft";

export const PRICE_LIST_OPTIONS = [
    { id: "default", label: "Varsayılan" },
    { id: "compare", label: "Liste Fiyatı" },
];

export function buildLocationOptions(storeName, products) {
    const set = new Set(["Tüm Lokasyonlar", "Ana Depo"]);
    for (const p of products || []) {
        for (const loc of p.inventory?.locations || []) {
            if (loc?.name?.trim()) set.add(loc.name.trim());
        }
    }
    if (storeName?.trim()) set.add(storeName.trim());
    return [...set];
}

export function getDisplayPrice(product, priceListId) {
    if (priceListId === "compare") {
        const v = product.compareAtPrice ?? product.price;
        return Number(v) || 0;
    }
    return Number(product.price) || 0;
}

export function lineKey(productId, variantBarcode = "") {
    return `${productId}::${variantBarcode || ""}`;
}

export function linesFromProduct(product, priceListId) {
    const variants = product.variants || [];
    if (variants.length > 0) {
        return variants.map((v) => ({
            key: lineKey(product._id, v.barcode || v.sku || v.title),
            productId: String(product._id),
            variantBarcode: v.barcode || "",
            title: v.title ? `${product.title} — ${v.title}` : product.title,
            barcode: v.barcode || product.barcode || "",
            sku: v.sku || product.sku || "",
            price: getDisplayPrice({ ...product, price: v.price ?? product.price, compareAtPrice: v.compareAtPrice ?? product.compareAtPrice }, priceListId),
            quantity: 1,
        }));
    }
    return [
        {
            key: lineKey(product._id, ""),
            productId: String(product._id),
            variantBarcode: "",
            title: product.title || "Ürün",
            barcode: product.barcode || "",
            sku: product.sku || "",
            price: getDisplayPrice(product, priceListId),
            quantity: 1,
        },
    ];
}

export function productMatchesSearch(product, q) {
    if (product.title?.toLowerCase().includes(q)) return true;
    if (product.barcode?.toLowerCase().includes(q)) return true;
    if (product.sku?.toLowerCase().includes(q)) return true;
    for (const v of product.variants || []) {
        if (v.title?.toLowerCase().includes(q)) return true;
        if (v.barcode?.toLowerCase().includes(q)) return true;
        if (v.sku?.toLowerCase().includes(q)) return true;
    }
    return false;
}

export function saveBarcodeLabelDraft(draft) {
    try {
        sessionStorage.setItem(BARCODE_LABEL_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        // no-op
    }
}

export function loadBarcodeLabelDraft() {
    try {
        const raw = sessionStorage.getItem(BARCODE_LABEL_DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
