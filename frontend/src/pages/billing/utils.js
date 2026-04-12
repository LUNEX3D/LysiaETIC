/**
 * Faturalandırma Modülü — Yardımcı Fonksiyonlar
 * LysiaETIC
 */

/**
 * Para birimi formatla (TRY)
 */
export const fmtCurrency = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 2,
        }).format(Number(v || 0));
    } catch {
        return Number(v || 0).toFixed(2) + " TL";
    }
};

/**
 * Tarih formatla (dd.MM.yyyy)
 */
export const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        return date.toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return String(d);
    }
};

/**
 * Tarih + saat formatla
 */
export const fmtDateTime = (d) => {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        return date.toLocaleString("tr-TR");
    } catch {
        return String(d);
    }
};

/**
 * YYYYMMDD formatında tarih (QNB API için)
 */
export const fmtDateApi = (d) => {
    const date = d instanceof Date ? d : new Date(d);
    return (
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0")
    );
};

/**
 * Yüzde hesapla (güvenli)
 */
export const pct = (val, max) => (max > 0 ? Math.min((val / max) * 100, 100) : 0);

/**
 * Sağlayıcı API yanıtından belgeleri normalize et
 */
export const normalizeDocuments = (docs, localType, providerId) => {
    if (!Array.isArray(docs)) return [];
    return docs.map((doc, idx) => ({
        id: doc.id || doc.uuid || doc.documentId || doc.referenceId || (localType + "-" + idx),
        type: localType,
        number: doc.invoiceNumber || doc.documentNumber || doc.number || doc.invoiceNo || "",
        date: doc.invoiceDate || doc.documentDate || doc.date || doc.createDate || "",
        customer: doc.receiverName || doc.customerName || doc.title || doc.receiverTitle || "",
        vkn: doc.receiverTaxNumber || doc.receiverIdentifier || doc.vkn || doc.taxNumber || "",
        amount: Number(doc.amount || doc.totalAmount || 0),
        tax: Number(doc.taxAmount || doc.totalTax || doc.vatAmount || 0),
        total: Number(doc.payableAmount || doc.totalPayable || doc.total || doc.grandTotal || 0),
        status: (doc.status || doc.documentStatus || doc.state || "").toLowerCase(),
        currency: doc.currency || doc.currencyCode || "TRY",
        provider: providerId,
        raw: doc,
    }));
};

/**
 * Fatura kalem hesaplamaları
 */
export const calcInvoiceLines = (lines) => {
    const calculated = (lines || []).map((l) => {
        const qty = Number(l.quantity || 1);
        const price = Number(l.unitPrice || 0);
        const disc = Number(l.discountAmount || 0);
        const lineTotal = qty * price - disc;
        const vat = lineTotal * (Number(l.vatRate || 20) / 100);
        return { lineTotal, vat, total: lineTotal + vat };
    });

    const subTotal = calculated.reduce((s, l) => s + l.lineTotal, 0);
    const totalVat = calculated.reduce((s, l) => s + l.vat, 0);
    const grandTotal = subTotal + totalVat;

    return { calculated, subTotal, totalVat, grandTotal };
};

/**
 * Fatura istatistiklerini hesapla
 */
export const calcInvoiceStats = (invoices) => {
    const eArchive = invoices.filter((i) => i.type === "e-arsiv");
    const eInvoice = invoices.filter((i) => i.type === "e-fatura" || i.type === "e-fatura-gelen");
    const eDespatch = invoices.filter((i) => i.type === "e-irsaliye");
    const pending = invoices.filter(
        (i) => i.status === "pending" || i.status === "waiting" || i.status === "queued"
    );
    const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);

    return {
        totalInvoices: invoices.length,
        totalAmount,
        pendingCount: pending.length,
        eArchiveCount: eArchive.length,
        eInvoiceCount: eInvoice.length,
        eDespatchCount: eDespatch.length,
    };
};

/**
 * Fatura listesini filtrele
 */
export const filterInvoices = (invoices, { type, status, query }) => {
    return invoices.filter((inv) => {
        if (type && type !== "all" && inv.type !== type) return false;
        if (status && status !== "all" && inv.status !== status) return false;
        if (query) {
            const q = query.toLowerCase();
            return (
                (inv.number || "").toLowerCase().includes(q) ||
                (inv.customer || "").toLowerCase().includes(q) ||
                (inv.vkn || "").includes(q)
            );
        }
        return true;
    });
};

/**
 * Sekmeye göre faturaları filtrele
 */
export const filterByTab = (invoices, tab) => {
    switch (tab) {
        case "e-archive":
            return invoices.filter((i) => i.type === "e-arsiv");
        case "e-invoice":
            return invoices.filter((i) => i.type === "e-fatura" || i.type === "e-fatura-gelen");
        case "e-despatch":
            return invoices.filter((i) => i.type === "e-irsaliye");
        default:
            return invoices;
    }
};
