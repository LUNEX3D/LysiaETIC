export const CUSTOMER_LANGUAGES = [
    { value: "tr", label: "Türkçe" },
    { value: "en", label: "English" },
];

export const CUSTOMER_FILTER_TYPES = [
    { id: "marketingConsent", label: "İletişim İzni" },
    { id: "hasAccount", label: "Hesap Durumu" },
    { id: "group", label: "Müşteri Grubu" },
    { id: "tag", label: "Etiket" },
];

export function fmtTry(v) {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
            Number(v || 0)
        );
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
}

export function fmtCustomerDate(d) {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "—";
    }
}

export function customerFullName(c) {
    return [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() || "—";
}

export function emptyAddress() {
    return {
        title: "",
        firstName: "",
        lastName: "",
        identityNumber: "",
        line1: "",
        line2: "",
        zip: "",
        country: "Türkiye",
        city: "",
        district: "",
        phone: "",
        phoneCountryCode: "+90",
        isDefault: false,
        invoiceType: "individual",
        companyName: "",
        taxOffice: "",
        taxNumber: "",
    };
}

export function emptyCustomerForm() {
    return {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        phoneCountryCode: "+90",
        preferredLanguage: "tr",
        marketingEmailConsent: false,
        groups: [],
        tags: [],
        groupInput: "",
        tagInput: "",
        addresses: [],
        notes: "",
        customFields: [],
    };
}

export function customerToForm(c) {
    return {
        firstName: c?.firstName || "",
        lastName: c?.lastName || "",
        email: c?.email || "",
        phone: c?.phone || "",
        phoneCountryCode: c?.phoneCountryCode || "+90",
        preferredLanguage: c?.preferredLanguage || "tr",
        marketingEmailConsent: !!c?.marketingEmailConsent,
        groups: [...(c?.groups || [])],
        tags: [...(c?.tags || [])],
        groupInput: "",
        tagInput: "",
        addresses: (c?.addresses || []).map((a) => ({ ...emptyAddress(), ...a, line1: a.line1 || a.line || "" })),
        notes: c?.notes || "",
        customFields: [...(c?.customFields || [])],
    };
}

export function formToCustomerPayload(form) {
    return {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        phoneCountryCode: form.phoneCountryCode || "+90",
        preferredLanguage: form.preferredLanguage || "tr",
        marketingEmailConsent: !!form.marketingEmailConsent,
        groups: form.groups || [],
        tags: form.tags || [],
        addresses: form.addresses || [],
        notes: form.notes.trim(),
        customFields: form.customFields || [],
    };
}

export function customersToCsv(rows) {
    const header = [
        "Ad",
        "Soyad",
        "E-posta",
        "Telefon",
        "İletişim İzni",
        "Hesap",
        "Toplam Sipariş",
        "Toplam Tutar",
        "Oluşturulma",
    ];
    const lines = [header.join(";")];
    for (const c of rows) {
        lines.push(
            [
                c.firstName,
                c.lastName,
                c.email,
                `${c.phoneCountryCode || ""}${c.phone || ""}`,
                c.marketingEmailConsent ? "Evet" : "Hayır",
                c.hasAccount ? "Hesabı Var" : "Hesabı Yok",
                c.orderCount || 0,
                (c.totalSpent || 0).toFixed(2),
                c.createdAt ? new Date(c.createdAt).toISOString() : "",
            ]
                .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                .join(";")
        );
    }
    return lines.join("\n");
}
