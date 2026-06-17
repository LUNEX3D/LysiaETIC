export function defaultCountTitle(locationName) {
    const d = new Date();
    const dateStr = d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
    return `${locationName} - ${dateStr}`;
}

export function buildBranchOptions(storeName, products) {
    const set = new Set(["Ana Depo"]);
    for (const p of products || []) {
        for (const loc of p.inventory?.locations || []) {
            if (loc?.name?.trim()) set.add(loc.name.trim());
        }
    }
    if (storeName?.trim() && storeName.trim() !== "Ana Depo") {
        set.add(storeName.trim());
    }
    return [...set];
}

export function getProductStockAtLocation(product, locationName) {
    if (!product) return 0;
    if (locationName) {
        const loc = (product.inventory?.locations || []).find((l) => l.name === locationName);
        if (loc != null) return Number(loc.stock ?? 0);
    }
    return Number(product.stock ?? 0);
}

export function buildCountLineFromProduct(product, variant, locationName) {
    const variantBarcode = variant?.barcode ? String(variant.barcode).trim() : "";
    const title = variant?.title ? `${product.title} — ${variant.title}` : product.title;
    return {
        productId: product._id,
        variantBarcode,
        title,
        systemStock: getProductStockAtLocation(product, locationName),
        countedQty: 0,
    };
}

export const STOCK_COUNT_DRAFT_KEY = "ec_stock_count_draft";

export function saveStockCountDraft(draft) {
    try {
        sessionStorage.setItem(STOCK_COUNT_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        // no-op
    }
}

export function loadStockCountDraft() {
    try {
        const raw = sessionStorage.getItem(STOCK_COUNT_DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearStockCountDraft() {
    try {
        sessionStorage.removeItem(STOCK_COUNT_DRAFT_KEY);
    } catch {
        // no-op
    }
}

export function productsMatchingFilters(products, filters) {
    if (!filters?.length) return products || [];
    return (products || []).filter((p) =>
        filters.every((f) => {
            if (f.type === "brand") return p.brand === f.value;
            if (f.type === "tag") return (p.tags || []).includes(f.value);
            if (f.type === "supplier") return p.supplier === f.value;
            if (f.type === "category") {
                return (p.productCategories || []).some(
                    (c) => String(c.categoryId) === String(f.value)
                );
            }
            return true;
        })
    );
}

export function linesFromProductsForCount(products, locationName) {
    return (products || []).map((p) => buildCountLineFromProduct(p, null, locationName));
}

export function stockCountToForm(sc, defaultLocation = "") {
    if (!sc) {
        return {
            locationName: defaultLocation,
            title: defaultCountTitle(defaultLocation || "Ana Depo"),
            method: "manual",
            lines: [],
            filters: [],
            recentActions: [],
            status: "draft",
        };
    }
    return {
        locationName: sc.locationName || defaultLocation,
        title: sc.title || "",
        method: sc.method || "manual",
        lines: (sc.lines || []).map((l) => ({ ...l })),
        filters: sc.filters || [],
        recentActions: sc.recentActions || [],
        status: sc.status || "draft",
        countNumber: sc.countNumber,
    };
}

export function formToStockCountPayload(form, { submit = false } = {}) {
    return {
        locationName: form.locationName,
        title: form.title,
        method: form.method,
        lines: form.lines,
        filters: form.filters,
        recentActions: form.recentActions,
        submit,
    };
}

export function extractFilterOptions(products, categories = []) {
    const brands = new Set();
    const tags = new Set();
    const suppliers = new Set();

    for (const p of products || []) {
        if (p.brand?.trim()) brands.add(p.brand.trim());
        if (p.supplier?.trim()) suppliers.add(p.supplier.trim());
        for (const t of p.tags || []) {
            if (t?.trim()) tags.add(t.trim());
        }
    }

    return {
        brands: [...brands].sort(),
        tags: [...tags].sort(),
        suppliers: [...suppliers].sort(),
        categories: (categories || []).map((c) => ({ id: String(c._id), name: c.name })),
    };
}

export const FILTER_TYPE_LABELS = {
    brand: "Marka",
    tag: "Etiket",
    supplier: "Tedarikçi",
    category: "Kategori",
};
