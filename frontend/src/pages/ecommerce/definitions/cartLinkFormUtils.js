export function emptyCartLinkForm() {
    return {
        salesChannelId: "",
        salesChannelLabel: "",
        basePath: "",
        products: [],
        trackUtm: false,
        couponMode: "none",
        couponCode: "",
    };
}

export function cartLinkToForm(row, channels = []) {
    if (!row) return emptyCartLinkForm();
    const channel = channels.find((c) => c.id === row.salesChannelId);
    return {
        salesChannelId: row.salesChannelId || "",
        salesChannelLabel: row.salesChannelLabel || channel?.label || "",
        basePath: row.basePath || channel?.basePath || "",
        products: (row.products || []).map((p) => ({
            productId: String(p.productId),
            quantity: p.quantity ?? 1,
            variantBarcode: p.variantBarcode || "",
            title: p.title || "",
        })),
        trackUtm: !!row.trackUtm,
        couponMode: row.couponMode === "with_code" ? "with_code" : "none",
        couponCode: row.couponCode || "",
        generatedUrl: row.generatedUrl || "",
    };
}

export function formToCartLinkPayload(form) {
    return {
        salesChannelId: form.salesChannelId,
        salesChannelLabel: form.salesChannelLabel,
        basePath: form.basePath,
        products: form.products.map((p) => ({
            productId: p.productId,
            quantity: Number(p.quantity) || 1,
            variantBarcode: p.variantBarcode || "",
        })),
        trackUtm: !!form.trackUtm,
        couponMode: form.couponMode,
        couponCode: form.couponMode === "with_code" ? form.couponCode.trim() : "",
    };
}

export function canSubmitCartLink(form) {
    if (!form.salesChannelId) return false;
    if (!form.products.length) return false;
    if (form.couponMode === "with_code" && !form.couponCode.trim()) return false;
    return true;
}
