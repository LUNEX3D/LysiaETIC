/**
 * Faturalandırma Modülü — Yardımcı Fonksiyonlar
 * LysiaETIC
 */

function getApiBaseForAssets() {
    if (typeof window !== "undefined") {
        const h = window.location.hostname;
        if (h === "localhost" || h === "127.0.0.1") {
            return "http://localhost:5000";
        }
    }
    if (process.env.NODE_ENV === "production") {
        return "";
    }
    const fromEnv = process.env.REACT_APP_API_URL;
    if (fromEnv !== undefined && fromEnv !== null && fromEnv !== "") {
        return fromEnv.replace(/\/$/, "");
    }
    return "http://localhost:5000";
}

/** Sunucuya yüklenen görseller için tam URL */
export const resolveMediaUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }
    const base = getApiBaseForAssets().replace(/\/$/, "");
    if (!base) return path.startsWith("/") ? path : `/${path}`;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

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

/** QNB e-Arşiv görüntüleme URL'si mi? */
export const isQnbFaturaUrl = (url) =>
    /qnbesolutions\.com\.tr/i.test(String(url || ""));

/** Sağlayıcı değeri Sovos mu? */
export const isSovosProvider = (provider) => String(provider || "").toLowerCase() === "sovos";

/**
 * HTML önizleme için sağlayıcıya uygun <base> etiketi (blob URL'de relative kaynaklar için)
 */
export const injectPreviewBaseTag = (html, { provider, env } = {}) => {
    if (!html || typeof html !== "string" || html.includes("<base")) return html;
    let baseUrl = "";
    if (isSovosProvider(provider)) {
        baseUrl = env === "production"
            ? "https://earsivws.fitbulut.com/"
            : "https://earsivwstest.fitbulut.com/";
    } else if (provider === "qnb" || !provider) {
        baseUrl = env === "production"
            ? "https://earsiv.qnbesolutions.com.tr/"
            : "https://earsivtest.qnbesolutions.com.tr/";
    }
    if (!baseUrl) return html;
    return html.replace(/(<head[^>]*>)/i, '$1<base href="' + baseUrl + '" />');
};

/**
 * Fatura satırından önizleme / indirme kimliklerini çöz
 */
export const resolveInvoiceIds = (inv) => {
    if (!inv) {
        return {
            uuid: "", mongoId: "", invoiceNumber: "", lookupId: "",
            faturaURL: "", orderNumber: "", custInvId: "", provider: "",
        };
    }
    const raw = inv.raw || {};
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const objectIdRe = /^[0-9a-fA-F]{24}$/;

    const uuid =
        inv.uuid || raw.uuid ||
        (uuidRe.test(String(inv.id || "")) ? String(inv.id) : "") ||
        (uuidRe.test(String(raw.id || "")) ? String(raw.id) : "") || "";

    const mongoId =
        (inv._id ? String(inv._id) : "") ||
        (raw._id ? String(raw._id) : "") ||
        (objectIdRe.test(String(inv.id || "")) ? String(inv.id) : "") ||
        (objectIdRe.test(String(raw._id || "")) ? String(raw._id) : "") || "";

    const invoiceNumber =
        inv.number || inv.invoiceNumber || raw.faturaNo || raw.invoiceNumber || "";

    const orderNumber = inv.orderNumber || raw.orderNumber || "";
    const custInvId = inv.custInvId || raw.custInvId || orderNumber || "";
    const lookupId = mongoId || uuid || invoiceNumber || String(inv.id || "") || "";
    const faturaURL = inv.faturaURL || raw.faturaURL || "";
    const provider = inv.provider || raw.provider || "";
    const env = inv.env || raw.env || "test";
    const profileId = inv.profileId || raw.profileId || "";

    return { uuid, mongoId, invoiceNumber, lookupId, faturaURL, orderNumber, custInvId, provider, env, profileId };
};

/**
 * Handler'a geçirilen değeri fatura nesnesine veya kimliklere çevir
 */
export const coerceInvoiceRef = (invOrId, invoiceNumber) => {
    if (invOrId && typeof invOrId === "object") {
        return resolveInvoiceIds(invOrId);
    }
    const id = String(invOrId || "");
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return {
        uuid: uuidRe.test(id) ? id : "",
        mongoId: /^[0-9a-fA-F]{24}$/.test(id) ? id : "",
        invoiceNumber: invoiceNumber || "",
        lookupId: id,
        faturaURL: "",
        orderNumber: "",
        custInvId: "",
        provider: "",
        env: "test",
        profileId: "",
    };
};

/**
 * DB / API kaydından belge tipini çöz
 */
export const resolveInvoiceDocType = (inv) => {
    const profile = String(inv.profileId || inv.raw?.profileId || "").toUpperCase();
    if (profile.includes("EARSIV")) return "e-arsiv";
    if (profile.includes("IRSALIYE") || profile.includes("İRSALİYE")) {
        return inv.direction === "incoming" || inv.raw?.direction === "incoming"
            ? "e-irsaliye-gelen"
            : "e-irsaliye";
    }
    if (profile.includes("SMM")) return "e-smm";
    if (inv.direction === "incoming" || inv.raw?.direction === "incoming") return "e-fatura-gelen";
    if (inv.type) return inv.type;
    return "e-fatura";
};

/**
 * Fatura satırından tutarları çöz (DB totals, API alanları, kalemler)
 */
export const resolveInvoiceTotals = (inv) => {
    const raw = inv?.raw || inv;
    const t = raw?.totals || {};

    let total = Number(
        inv?.total ?? raw?.tutar ?? t.payableAmount ?? t.taxInclusiveAmount ?? 0
    );
    let tax = Number(inv?.tax ?? raw?.kdv ?? t.totalTax ?? t.taxAmount ?? 0);
    let amount = Number(
        inv?.amount ?? raw?.kdvHaric ?? t.lineExtensionAmount ?? t.taxExclusive ?? 0
    );

    const lines = inv?.lines || raw?.lines || [];
    if (lines.length && (!(total > 0) || !(amount > 0))) {
        let lineExt = 0;
        let lineVat = 0;
        for (const line of lines) {
            const qty = Number(line.quantity || 1);
            const price = Number(line.unitPrice || 0);
            const disc = Number(line.discountAmount || 0);
            const lineTotal =
                Number(line.lineTotal) > 0
                    ? Number(line.lineTotal)
                    : qty * price - disc;
            const vatAmount =
                Number(line.vatAmount) > 0
                    ? Number(line.vatAmount)
                    : lineTotal * (Number(line.vatRate ?? 20) / 100);
            lineExt += lineTotal;
            lineVat += vatAmount;
        }
        if (!(amount > 0) && lineExt > 0) amount = lineExt;
        if (!(tax > 0) && lineVat > 0) tax = lineVat;
        if (!(total > 0) && (amount > 0 || lineExt > 0)) {
            total = (amount || lineExt) + (tax || lineVat);
        }
    }

    if (!(total > 0) && amount > 0) total = amount + tax;
    if (!(amount > 0) && total > 0) amount = Math.max(0, total - tax);

    return {
        total: Number(total) || 0,
        tax: Number(tax) || 0,
        amount: Number(amount) || 0,
    };
};

/** İptal edilmiş fatura mı? */
export const isCancelledInvoiceStatus = (inv) => {
    const status = String(inv?.status || inv?.durum || "").toLowerCase();
    return inv?.sovosCancelled === true || status === "cancelled" || status === "canceled";
};

/** API / DB satırını fatura listesi formatına çevir */
export const mapBillingDocumentRow = (inv, defaultProviderId = "qnb-esolutions") => {
    const resolved = resolveInvoiceTotals(inv);
    return {
        id: inv._id || inv.id || inv.uuid,
        type: resolveInvoiceDocType(inv),
        direction: inv.direction || "outgoing",
        number: inv.faturaNo || inv.invoiceNumber || "",
        date: inv.tarih || inv.issueDate || "",
        customer: inv.aliciAdi || inv.customer?.name || "",
        vkn: inv.aliciVkn || inv.customer?.vkn || "",
        amount: resolved.amount,
        tax: resolved.tax,
        total: resolved.total,
        status: inv.durum || inv.status || "created",
        statusCode: inv.statusCode || inv.raw?.statusCode || "",
        sovosCancelled: isCancelledInvoiceStatus(inv),
        currency: inv.currency || "TRY",
        provider: inv.provider === "sovos" ? "sovos" : (inv.provider || defaultProviderId),
        orderNumber: inv.orderNumber || "",
        lines: inv.lines || inv.raw?.lines || [],
        raw: inv,
    };
};

/**
 * Tüm kesilmiş belgeleri DB'den sayfalayarak çek
 */
export const loadAllBillingDocuments = async (apiGet, listPath = "/auto-invoice/documents", opts = {}) => {
    const limit = 100;
    let page = 1;
    let allRows = [];
    const maxPages = opts.maxPages || 50;

    while (page <= maxPages) {
        const params = { page, limit };
        if (opts.documentType) params.documentType = opts.documentType;

        const res = await apiGet(listPath, { params });
        if (!res.data?.success || !Array.isArray(res.data.data)) break;

        allRows = allRows.concat(res.data.data);
        const totalPages = res.data.pagination?.totalPages || 1;
        if (page >= totalPages || res.data.data.length === 0) break;
        page += 1;
    }

    return allRows.map((row) => mapBillingDocumentRow(row, opts.providerId));
};

/**
 * İki fatura listesini birleştir (uuid / fatura no ile tekilleştir)
 */
export const mergeInvoiceLists = (primary = [], secondary = []) => {
    const byKey = new Map();
    const keyOf = (inv) => {
        const id = inv.id || inv.raw?.uuid || inv.raw?._id;
        if (id) return "id:" + id;
        const num = inv.number || inv.raw?.faturaNo;
        if (num) return "no:" + num;
        return "row:" + JSON.stringify([inv.date, inv.customer, inv.total]);
    };

    for (const inv of [...primary, ...secondary]) {
        const key = keyOf(inv);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, inv);
            continue;
        }
        const preferNew =
            (inv.raw?.orderNumber && !existing.raw?.orderNumber) ||
            (inv.raw?.marketplaceName && !existing.raw?.marketplaceName) ||
            ((inv.total || 0) > (existing.total || 0));
        if (preferNew) byKey.set(key, inv);
    }

    return Array.from(byKey.values()).sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        return db - da;
    });
};

/**
 * Sekmeye göre faturaları filtrele
 */
export const filterByTab = (invoices, tab) => {
    switch (tab) {
        case "e-archive":
            return invoices.filter((i) => i.type === "e-arsiv");
        case "e-invoice-out":
            return invoices.filter((i) => i.type === "e-fatura" && i.direction !== "incoming");
        case "e-invoice-in":
            return invoices.filter((i) => i.type === "e-fatura-gelen" || (i.type === "e-fatura" && i.direction === "incoming"));
        case "e-smm":
            return invoices.filter((i) => i.type === "e-smm");
        case "e-despatch":
            return invoices.filter((i) => i.type === "e-irsaliye" || i.type === "e-irsaliye-gelen");
        default:
            return invoices;
    }
};
