export function normalizeScanCode(code) {
    return String(code || "")
        .trim()
        .replace(/\s/g, "");
}

export function buildProductBarcodeIndex(products) {
    const index = new Map();

    const register = (rawCode, entry) => {
        const key = normalizeScanCode(rawCode);
        if (!key) return;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(entry);
    };

    for (const product of products || []) {
        register(product.barcode, { product, variant: null, matchType: "barcode" });
        register(product.sku, { product, variant: null, matchType: "sku" });

        for (const variant of product.variants || []) {
            register(variant.barcode, { product, variant, matchType: "barcode" });
            register(variant.sku, { product, variant, matchType: "sku" });
        }
    }

    return index;
}

export function resolveBarcodeHit(index, rawCode) {
    const key = normalizeScanCode(rawCode);
    if (!key) return null;

    const hits = index.get(key);
    if (!hits?.length) return null;

    const barcodeHit = hits.find((h) => h.matchType === "barcode");
    return barcodeHit || hits[0];
}

export function lineIdentity(productId, variantBarcode = "") {
    return `${productId}:${variantBarcode || ""}`;
}

export function buildPurchaseLineFromProduct(product, variant, scannedCode) {
    const variantBarcode = variant?.barcode ? normalizeScanCode(variant.barcode) : "";
    const title = variant?.title
        ? `${product.title} — ${variant.title}`
        : product.title;
    const unitCost = Number(
        variant?.costPrice ?? variant?.price ?? product.costPrice ?? product.price ?? 0
    );

    return {
        productId: product._id,
        variantBarcode,
        title,
        quantity: 1,
        unitCost,
        scannedCode: normalizeScanCode(scannedCode),
    };
}

export function buildTransferLineFromProduct(product, variant, scannedCode, fromBranchStock) {
    const variantBarcode = variant?.barcode ? normalizeScanCode(variant.barcode) : "";
    const title = variant?.title
        ? `${product.title} — ${variant.title}`
        : product.title;

    return {
        productId: product._id,
        variantBarcode,
        title,
        fromBranchStock: Number(fromBranchStock ?? 0),
        quantity: 1,
        scannedCode: normalizeScanCode(scannedCode),
    };
}
