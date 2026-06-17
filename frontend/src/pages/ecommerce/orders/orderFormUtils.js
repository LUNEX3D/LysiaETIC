export function emptyAddress() {
    return { line: "", district: "", city: "", zip: "" };
}

export function productToLineItem(product, quantity = 1) {
    const price =
        Number(product.salePrice) ||
        Number(product.price) ||
        Number(product.listPrice) ||
        0;
    return {
        storeProductId: product._id,
        title: product.title || "Ürün",
        quantity: Math.max(1, quantity),
        unitPrice: price,
        barcode: product.barcode || product.sku || "",
        imageUrl: product.images?.[0]?.url || product.imageUrl || "",
    };
}

export function computeOrderTotals({ lineItems, shippingCost, taxPercent, taxIncluded }) {
    const subtotal = (lineItems || []).reduce(
        (s, li) => s + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
        0
    );
    const ship = Number(shippingCost) || 0;
    let taxAmount = 0;
    if (taxPercent > 0) {
        taxAmount = taxIncluded
            ? subtotal - subtotal / (1 + taxPercent / 100)
            : (subtotal * taxPercent) / 100;
    }
    const total = subtotal + ship + (taxIncluded ? 0 : taxAmount);
    return {
        subtotal: Math.round(subtotal * 100) / 100,
        shippingCost: ship,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
    };
}

export const emptyOrderCreateForm = () => ({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shipping: emptyAddress(),
    billing: emptyAddress(),
    sameBilling: true,
    shippingCarrier: "",
    trackingNumber: "",
    shippingCost: "0",
    taxPercent: "20",
    applyTax: true,
    lineItems: [],
});
