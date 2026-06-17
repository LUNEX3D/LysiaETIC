export const ORDER_STATUS_LABELS = {
    pending_payment: "Ödeme Bekleniyor",
    paid: "Ödendi",
    processing: "Kargoya Hazır",
    shipped: "Kargoda",
    delivered: "Teslim Edildi",
    cancelled: "İptal Edildi",
    failed: "Başarısız",
};

export const PAYMENT_STATUS_LABELS = {
    pending: "Ödeme Bekleniyor",
    paid: "Ödeme Alındı",
    failed: "Ödeme Başarısız",
};

export function fmtTry(v) {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
            Number(v || 0)
        );
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
}

export function fmtOrderDate(d) {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleString("tr-TR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return String(d);
    }
}

export function orderStatusBadgeClass(status) {
    if (status === "delivered") return "ec-order-badge--delivered";
    if (status === "cancelled" || status === "failed") return "ec-order-badge--cancelled";
    if (status === "shipped" || status === "processing") return "ec-order-badge--shipping";
    return "ec-order-badge--default";
}

export function paymentStatusBadgeClass(status) {
    if (status === "paid") return "ec-order-badge--paid";
    if (status === "failed") return "ec-order-badge--cancelled";
    return "ec-order-badge--pending";
}

export function salesChannelLabel(order, storeUrl) {
    if (order.salesChannel) return order.salesChannel;
    if (order.source === "manual") return "Manuel Sipariş";
    if (storeUrl) return storeUrl.replace(/^https?:\/\//, "");
    return "Web sitesi";
}

export function lineItemCount(order) {
    return (order.lineItems || []).reduce((s, li) => s + (Number(li.quantity) || 0), 0);
}

export function formatAddress(addr) {
    if (!addr) return "—";
    const parts = [addr.line, addr.district, addr.city, addr.zip].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
}
