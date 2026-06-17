export function fmtTry(v) {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
            Number(v || 0)
        );
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
}

export function fmtGiftCardDate(d) {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    } catch {
        return String(d);
    }
}

export function fmtGiftCardDateTime(d) {
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

export function giftCardStatusLabel(card) {
    if (!card?.active) return "Pasif";
    const now = Date.now();
    if (card.endDate && new Date(card.endDate).getTime() < now) return "Süresi doldu";
    if (card.startDate && new Date(card.startDate).getTime() > now) return "Beklemede";
    return "Aktif";
}

export function giftCardStatusClass(card) {
    const s = giftCardStatusLabel(card);
    if (s === "Aktif") return "ec-gift-card-badge--active";
    if (s === "Pasif" || s === "Süresi doldu") return "ec-gift-card-badge--inactive";
    return "ec-gift-card-badge--pending";
}

export function remainingBalance(card) {
    return Math.max(0, Number(card?.initialAmount || 0) - Number(card?.usedAmount || 0));
}

export function customerDisplay(card) {
    const name = card?.customer?.name?.trim();
    const email = card?.customer?.email?.trim();
    if (name) return name;
    if (email) return email;
    return "Seçilmedi";
}

export const emptyGiftCardForm = () => ({
    code: "",
    initialAmount: "",
    currency: "TRY",
    active: true,
    useMinOrder: false,
    minOrderAmount: "",
    useStartDate: false,
    startDate: "",
    useEndDate: false,
    endDate: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    salesChannelIds: [],
});

export function giftCardToForm(card, channels = []) {
    const allIds = channels.map((c) => c.id);
    const ids = card?.salesChannelIds?.length ? card.salesChannelIds : allIds;
    return {
        code: card?.code || "",
        initialAmount: card?.initialAmount != null ? String(card.initialAmount) : "",
        currency: card?.currency || "TRY",
        active: card?.active !== false,
        useMinOrder: card?.minOrderAmount != null && card.minOrderAmount > 0,
        minOrderAmount:
            card?.minOrderAmount != null && card.minOrderAmount > 0
                ? String(card.minOrderAmount)
                : "",
        useStartDate: !!card?.startDate,
        startDate: card?.startDate ? toInputDate(card.startDate) : "",
        useEndDate: !!card?.endDate,
        endDate: card?.endDate ? toInputDate(card.endDate) : "",
        customerName: card?.customer?.name || "",
        customerEmail: card?.customer?.email || "",
        customerPhone: card?.customer?.phone || "",
        salesChannelIds: ids.filter((id) => allIds.includes(id)),
    };
}

function toInputDate(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
}

export function formToGiftCardPayload(form) {
    return {
        code: form.code.trim().toUpperCase(),
        initialAmount: Number(form.initialAmount) || 0,
        currency: form.currency || "TRY",
        active: !!form.active,
        minOrderAmount: form.useMinOrder ? Number(form.minOrderAmount) || 0 : null,
        startDate: form.useStartDate && form.startDate ? form.startDate : null,
        endDate: form.useEndDate && form.endDate ? form.endDate : null,
        customer: {
            name: form.customerName.trim(),
            email: form.customerEmail.trim(),
            phone: form.customerPhone.trim(),
        },
        salesChannelIds: form.salesChannelIds || [],
    };
}
