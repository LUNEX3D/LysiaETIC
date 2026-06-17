export const PURCHASE_CURRENCIES = [
    { value: "TRY", label: "Turkish Lira" },
    { value: "USD", label: "US Dollar" },
    { value: "EUR", label: "Euro" },
];

export const emptyPurchaseForm = (branchDefault = "") => ({
    supplierName: "",
    branchName: branchDefault,
    referenceNumber: "",
    currency: "TRY",
    expectedShipmentAt: "",
    trackingNumber: "",
    shippingCompany: "",
    lines: [],
    vatRate: 0,
    shippingCost: 0,
    showShipping: false,
    adjustments: [],
    timeline: [],
    status: "draft",
});

export function lineTotal(line) {
    return Number(line.quantity || 0) * Number(line.unitCost || 0);
}

export function computePurchaseTotals(form) {
    const subtotal = (form.lines || []).reduce((s, l) => s + lineTotal(l), 0);
    const vatAmount = subtotal * (Number(form.vatRate) / 100);
    const adjSum = (form.adjustments || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    const total = subtotal + vatAmount + Number(form.shippingCost || 0) + adjSum;
    return { subtotal, vatAmount, total };
}

export function purchaseToForm(purchase, branchDefault = "") {
    if (!purchase) return emptyPurchaseForm(branchDefault);
    return {
        supplierName: purchase.supplierName || "",
        branchName: purchase.branchName || branchDefault,
        referenceNumber: purchase.referenceNumber || "",
        currency: purchase.currency || "TRY",
        expectedShipmentAt: purchase.expectedShipmentAt
            ? new Date(purchase.expectedShipmentAt).toISOString().slice(0, 10)
            : "",
        trackingNumber: purchase.trackingNumber || "",
        shippingCompany: purchase.shippingCompany || "",
        lines: (purchase.lines || []).map((l) => ({
            productId: l.productId,
            title: l.title,
            quantity: l.quantity,
            unitCost: l.unitCost,
        })),
        vatRate: purchase.vatRate ?? 0,
        shippingCost: purchase.shippingCost ?? 0,
        showShipping: Number(purchase.shippingCost) > 0,
        adjustments: purchase.adjustments?.length
            ? purchase.adjustments.map((a) => ({ label: a.label, amount: a.amount }))
            : [],
        timeline: purchase.timeline || [],
        status: purchase.status || "draft",
        purchaseNumber: purchase.purchaseNumber,
    };
}

export function formToPayload(form, { approve = false } = {}) {
    return {
        supplierName: form.supplierName,
        branchName: form.branchName,
        referenceNumber: form.referenceNumber,
        currency: form.currency,
        expectedShipmentAt: form.expectedShipmentAt || null,
        trackingNumber: form.trackingNumber,
        shippingCompany: form.shippingCompany,
        lines: form.lines,
        vatRate: form.vatRate,
        shippingCost: form.showShipping ? form.shippingCost : 0,
        adjustments: form.adjustments,
        timeline: form.timeline,
        approve,
    };
}

export function fmtMoney(amount, currency = "TRY") {
    try {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: currency === "TRY" ? "TRY" : currency,
        }).format(Number(amount || 0));
    } catch {
        return `${Number(amount || 0).toFixed(2)} ${currency}`;
    }
}
