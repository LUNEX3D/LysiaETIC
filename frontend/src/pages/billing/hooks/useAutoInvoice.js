/**
 * useAutoInvoice — Otomatik Fatura Yönetimi Hook'u
 * LysiaETIC
 *
 * Otomatik fatura ayarları, QNB fatura listesi, toplu faturalama.
 * api.js Axios instance kullanır.
 */
import { useState, useCallback } from "react";
import API from "../../../services/api";
import { BILLING_DOCUMENTS_API } from "../constants";

const useAutoInvoice = () => {
    // Config & Stats
    const [config, setConfig] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Kesilen fatura listesi (DB — tüm sağlayıcılar)
    const [qnbInvoices, setQnbInvoices] = useState([]);
    const [qnbLoading, setQnbLoading] = useState(false);
    const [qnbPagination, setQnbPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // Faturasız sipariş listesi
    const [uninvoicedOrders, setUninvoicedOrders] = useState([]);
    const [uninvoicedLoading, setUninvoicedLoading] = useState(false);
    const [uninvoicedPagination, setUninvoicedPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [uninvoicedSummary, setUninvoicedSummary] = useState(null);
    const [invoiceProcessingId, setInvoiceProcessingId] = useState(null);

    // Toplu faturalama
    const [processLoading, setProcessLoading] = useState(false);
    const [processResult, setProcessResult] = useState(null);

    /**
     * Config ve istatistikleri yükle
     */
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [configRes, statsRes] = await Promise.all([
                API.get("/auto-invoice/config"),
                API.get("/auto-invoice/stats"),
            ]);
            if (configRes.data.success) setConfig(configRes.data.data);
            if (statsRes.data.success) setStats(statsRes.data.data);

            try {
                const uninvoicedRes = await API.get("/auto-invoice/uninvoiced-orders", { params: { page: 1, limit: 25 } });
                if (uninvoicedRes.data.success) {
                    setUninvoicedOrders(uninvoicedRes.data.data || []);
                    setUninvoicedPagination(uninvoicedRes.data.pagination || { page: 1, total: 0, totalPages: 0 });
                    setUninvoicedSummary(uninvoicedRes.data.summary || null);
                }
            } catch {
                /* sipariş listesi opsiyonel */
            }

            try {
                const invRes = await API.get(BILLING_DOCUMENTS_API.list, { params: { page: 1, limit: 50 } });
                if (invRes.data.success) {
                    setQnbInvoices(invRes.data.data || []);
                    setQnbPagination(invRes.data.pagination || { page: 1, total: 0, totalPages: 0 });
                }
            } catch {
                /* fatura listesi opsiyonel */
            }
        } catch (err) {
            // Subscription expired durumunda özel mesaj
            if (err.response?.status === 403 && (err.response?.data?.subscriptionExpired || err.response?.data?.subscriptionSuspended)) {
                setError(err.response.data.message || "Abonelik süreniz dolmuş. Lütfen paketinizi yenileyin.");
            } else {
                setError("Veriler yüklenemedi: " + (err.response?.data?.message || err.message));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Kesilen faturaları listele (DB — QNB/Sovos)
     */
    const fetchQnbInvoices = useCallback(async (search, dateStart, dateEnd, page) => {
        setQnbLoading(true);
        setError("");
        try {
            const params = {};
            if (search) params.search = search;
            if (dateStart) params.startDate = dateStart.replace(/-/g, "");
            if (dateEnd) params.endDate = dateEnd.replace(/-/g, "");
            if (page) params.page = page;
            params.limit = 50;

            const res = await API.get(BILLING_DOCUMENTS_API.list, { params });
            if (res.data.success) {
                setQnbInvoices(res.data.data || []);
                setQnbPagination(res.data.pagination || { page: 1, total: 0, totalPages: 0 });
            } else {
                setError(res.data.message || "Fatura listesi alınamadı");
            }
        } catch (err) {
            if (err.response?.status === 403 && (err.response?.data?.subscriptionExpired || err.response?.data?.subscriptionSuspended)) {
                setError(err.response.data.message || "Abonelik süreniz dolmuş.");
            } else {
                setError("Fatura listesi hatası: " + (err.response?.data?.message || err.message));
            }
        } finally {
            setQnbLoading(false);
        }
    }, []);

    /**
     * Faturasız siparişleri listele
     */
    const fetchUninvoicedOrders = useCallback(async (page = 1) => {
        setUninvoicedLoading(true);
        try {
            const res = await API.get("/auto-invoice/uninvoiced-orders", { params: { page, limit: 25 } });
            if (res.data.success) {
                setUninvoicedOrders(res.data.data || []);
                setUninvoicedPagination(res.data.pagination || { page: 1, total: 0, totalPages: 0 });
                setUninvoicedSummary(res.data.summary || null);
            }
        } catch (err) {
            setError("Sipariş listesi hatası: " + (err.response?.data?.message || err.message));
        } finally {
            setUninvoicedLoading(false);
        }
    }, []);

    /**
     * Tek sipariş için manuel fatura kes (test)
     */
    const processSingleOrder = useCallback(async (orderId) => {
        setInvoiceProcessingId(orderId);
        setError("");
        try {
            const res = await API.post("/auto-invoice/process-single/" + encodeURIComponent(orderId));
            if (res.data.success) {
                await fetchData();
                return { success: true, message: res.data.message };
            }
            setError(res.data.message || "Fatura kesilemedi");
            return { error: res.data.message };
        } catch (err) {
            const msg = "Fatura hatası: " + (err.response?.data?.message || err.message);
            setError(msg);
            return { error: msg };
        } finally {
            setInvoiceProcessingId(null);
        }
    }, [fetchData]);

    /**
     * Otomatik fatura ayarlarını kaydet
     */
    const saveConfig = useCallback(async (configData) => {
        setSaving(true);
        setError("");
        try {
            const res = await API.put("/auto-invoice/config", configData);
            if (res.data.success) {
                setConfig(res.data.data);
                await fetchData();
                return { success: true };
            }
            setError(res.data.message || "Kaydetme hatası");
            return { error: res.data.message || "Kaydetme hatası" };
        } catch (err) {
            const msg = "Kaydetme hatası: " + (err.response?.data?.message || err.message);
            setError(msg);
            return { error: msg };
        } finally {
            setSaving(false);
        }
    }, [fetchData]);

    /**
     * Otomatik faturayı aç/kapat
     */
    const toggleEnabled = useCallback(async () => {
        setError("");
        try {
            const res = await API.post("/auto-invoice/toggle");
            if (res.data.success) {
                setConfig((prev) => (prev ? { ...prev, enabled: res.data.enabled } : prev));
                await fetchData();
                return { success: true, enabled: res.data.enabled };
            }
            setError(res.data.message || "Toggle hatası");
            return { error: res.data.message };
        } catch (err) {
            const msg = "Toggle hatası: " + (err.response?.data?.message || err.message);
            setError(msg);
            return { error: msg };
        }
    }, [fetchData]);

    /**
     * Faturasız tüm siparişleri faturala
     */
    const processAll = useCallback(async (limit = 50) => {
        setProcessLoading(true);
        setProcessResult(null);
        setError("");
        try {
            const res = await API.post("/auto-invoice/process-all", { limit });
            if (res.data.success) {
                setProcessResult(res.data);
                await fetchData();
                return { success: true, data: res.data };
            }
            const failMsg = res.data.message || res.data.data?.hint || "Toplu faturalama hatası";
            setError(failMsg);
            return { error: failMsg };
        } catch (err) {
            const msg = "Toplu faturalama hatası: " + (err.response?.data?.message || err.message);
            setError(msg);
            return { error: msg };
        } finally {
            setProcessLoading(false);
        }
    }, [fetchData]);

    /**
     * Ardışık hata sayacını sıfırla
     */
    const resetErrors = useCallback(async () => {
        try {
            const res = await API.post("/auto-invoice/reset-errors");
            if (res.data.success) await fetchData();
        } catch {
            /* ignore */
        }
    }, [fetchData]);

    /**
     * QNB UUID ile fatura önizleme
     */
    const previewQnbInvoice = useCallback(async (uuid) => {
        try {
            const res = await API.get(
                BILLING_DOCUMENTS_API.preview(uuid),
                { responseType: "text" }
            );
            const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
            if (text.includes("<html") || text.includes("<HTML") || text.includes("<!DOCTYPE")) {
                // QNB HTML'i relative URL'ler içerebilir — <base> tag ekle
                let html = text;
                if (!html.includes("<base")) {
                    const baseTag = '<base href="https://earsivtest.qnbesolutions.com.tr/" />';
                    html = html.replace(/(<head[^>]*>)/i, "$1" + baseTag);
                }
                const blob = new Blob([html], { type: "text/html; charset=utf-8" });
                const url = window.URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                return { success: true };
            }
            try {
                const data = JSON.parse(text);
                return { error: data.message || "Fatura önizlemesi alınamadı" };
            } catch {
                return { error: "Beklenmeyen yanıt formatı" };
            }
        } catch (err) {
            return { error: "Fatura önizleme hatası: " + (err.response?.data?.message || err.message) };
        }
    }, []);

    /**
     * Fatura detayını DB'den çek
     */
    const fetchInvoiceDetail = useCallback(async (invoiceId) => {
        try {
            const res = await API.get("/auto-invoice/invoices/" + invoiceId);
            if (res.data.success) return { success: true, data: res.data.data };
            return { error: res.data.message || "Fatura detayı alınamadı" };
        } catch (err) {
            return { error: "Fatura detayı hatası: " + (err.response?.data?.message || err.message) };
        }
    }, []);

    /**
     * Fatura PDF indir (auto-invoice endpoint)
     */
    const downloadInvoicePdf = useCallback(async (invoiceId, invoiceNumber) => {
        try {
            // UUID formatı ise önce preview endpoint'ini dene (daha güvenilir)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
            if (isUuid) {
                const previewResult = await previewQnbInvoice(invoiceId);
                if (previewResult?.success) return previewResult;
            }

            const res = await API.get("/auto-invoice/invoices/" + invoiceId + "/pdf", {
                responseType: "blob",
            });
            const contentType = res.headers["content-type"] || "";
            const blob = res.data;

            // ⚠️ responseType: "blob" ile JSON hata yanıtları da blob olarak gelir
            if (contentType.includes("json")) {
                const text = await blob.text();
                try {
                    const data = JSON.parse(text);
                    return { error: data.message || "Fatura indirilemedi" };
                } catch {
                    return { error: "Beklenmeyen yanıt" };
                }
            }

            if (contentType.includes("zip") || contentType.includes("octet")) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = (invoiceNumber || "fatura") + ".zip";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else if (contentType.includes("html")) {
                let text = await blob.text();
                // QNB HTML'i relative URL'ler içerebilir — <base> tag ekle
                if (!text.includes("<base")) {
                    text = text.replace(/(<head[^>]*>)/i, '$1<base href="https://earsivtest.qnbesolutions.com.tr/" />');
                }
                const htmlBlob = new Blob([text], { type: "text/html; charset=utf-8" });
                const url = window.URL.createObjectURL(htmlBlob);
                window.open(url, "_blank");
                setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            } else if (contentType.includes("pdf")) {
                const url = window.URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            } else {
                let text = await blob.text();
                if (text.includes("<html") || text.includes("<!DOCTYPE")) {
                    // QNB HTML'i relative URL'ler içerebilir — <base> tag ekle
                    if (!text.includes("<base")) {
                        text = text.replace(/(<head[^>]*>)/i, '$1<base href="https://earsivtest.qnbesolutions.com.tr/" />');
                    }
                    const htmlBlob = new Blob([text], { type: "text/html; charset=utf-8" });
                    const url = window.URL.createObjectURL(htmlBlob);
                    window.open(url, "_blank");
                    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                } else {
                    return { error: "Beklenmeyen yanıt formatı" };
                }
            }
            return { success: true };
        } catch (err) {
            // Axios blob hatalarında response.data bir Blob olabilir
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const data = JSON.parse(text);
                    return { error: data.message || "Fatura indirilemedi" };
                } catch { /* ignore */ }
            }
            return { error: "PDF indirme hatası: " + (err.response?.data?.message || err.message) };
        }
    }, [previewQnbInvoice]);

    /**
     * Hata mesajını temizle
     */
    const clearError = useCallback(() => {
        setError("");
    }, []);

    /**
     * İşlem sonucunu temizle
     */
    const clearProcessResult = useCallback(() => {
        setProcessResult(null);
    }, []);

    /**
     * e-Arşiv logo / imza görseli yükle
     */
    const uploadEArchiveVisual = useCallback(async (file, assetType = "logo") => {
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("assetType", assetType);
            const res = await API.post("/auto-invoice/e-archive-visuals/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (res.data.success) {
                return { success: true, url: res.data.data?.url || "" };
            }
            return { error: res.data.message || "Görsel yüklenemedi" };
        } catch (err) {
            return { error: err.response?.data?.message || err.message || "Görsel yüklenemedi" };
        }
    }, []);

    /**
     * Otomatik fatura config form için başlangıç değerleri oluştur
     */
    const buildConfigForm = useCallback(() => {
        const cfg = config || {};
        return {
            enabled: cfg.enabled || false,
            provider: cfg.provider || "qnb",
            autoInvoiceStartDate: cfg.autoInvoiceStartDate
                ? new Date(cfg.autoInvoiceStartDate).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            enabledMarketplaces: cfg.enabledMarketplaces || [],
            triggerStatuses: cfg.triggerStatuses || ["Shipped", "Delivered"],
            invoiceDelayDays: Math.max(0, Math.min(90, Number(cfg.invoiceDelayDays) || 0)),
            autoUploadInvoiceToMarketplace: !!cfg.autoUploadInvoiceToMarketplace,
            documentType: cfg.documentType || "EARSIVFATURA",
            invoiceTypeCode: cfg.invoiceTypeCode || "SATIS",
            invoiceSeriesCode: cfg.invoiceSeriesCode || "LYS",
            currency: cfg.currency || "TRY",
            sendingType: cfg.sendingType || "ELEKTRONIK",
            defaultVatRate: cfg.defaultVatRate || 20,
            pricesIncludeVat: cfg.pricesIncludeVat !== false,
            defaultNote: cfg.defaultNote || "",
            eArchiveVisuals: {
                logoUrl: cfg.eArchiveVisuals?.logoUrl || "",
                signatureUrl: cfg.eArchiveVisuals?.signatureUrl || "",
                signatureName: cfg.eArchiveVisuals?.signatureName || "",
                invoiceDescription: cfg.eArchiveVisuals?.invoiceDescription || cfg.defaultNote || "",
            },
            supplier: {
                vkn: cfg.supplier?.vkn || "",
                name: cfg.supplier?.name || "",
                taxOffice: cfg.supplier?.taxOffice || "",
                street: cfg.supplier?.street || "",
                district: cfg.supplier?.district || "",
                city: cfg.supplier?.city || "",
                country: cfg.supplier?.country || "Turkiye",
                phone: cfg.supplier?.phone || "",
                email: cfg.supplier?.email || "",
            },
            defaultCustomer: {
                vkn: cfg.defaultCustomer?.vkn || "22222222222",
                name: cfg.defaultCustomer?.name || "",
                firstName: cfg.defaultCustomer?.firstName || "",
                lastName: cfg.defaultCustomer?.lastName || "",
                city: cfg.defaultCustomer?.city || "Istanbul",
                district: cfg.defaultCustomer?.district || "Merkez",
                country: cfg.defaultCustomer?.country || "Turkiye",
            },
            qnbCredentials: {
                username: cfg.qnbCredentials?.username || "",
                password: cfg.qnbCredentials?.password || "",
                earsivUsername: cfg.qnbCredentials?.earsivUsername || "",
                earsivPassword: cfg.qnbCredentials?.earsivPassword || "",
                efaturaUsername: cfg.qnbCredentials?.efaturaUsername || "",
                efaturaPassword: cfg.qnbCredentials?.efaturaPassword || "",
                env: cfg.qnbCredentials?.env || "test",
            },
            sovosCredentials: {
                username: cfg.sovosCredentials?.username || "",
                password: cfg.sovosCredentials?.password || "",
                vknTckn: cfg.sovosCredentials?.vknTckn || cfg.supplier?.vkn || "",
                senderIdentifier: cfg.sovosCredentials?.senderIdentifier || "",
                receiverIdentifier: cfg.sovosCredentials?.receiverIdentifier || "",
                branch: cfg.sovosCredentials?.branch || "default",
                env: cfg.sovosCredentials?.env || "test",
                capabilities: cfg.sovosCredentials?.capabilities || { efatura: false, earsiv: false },
            },
        };
    }, [config]);

    return {
        // Config & Stats
        config,
        stats,
        loading,
        saving,
        error,
        fetchData,
        saveConfig,
        toggleEnabled,
        resetErrors,
        buildConfigForm,
        uploadEArchiveVisual,

        // Kesilen fatura listesi (DB)
        qnbInvoices,
        qnbLoading,
        qnbPagination,
        fetchQnbInvoices,
        previewQnbInvoice,
        fetchInvoiceDetail,
        downloadInvoicePdf,

        // Faturasız siparişler
        uninvoicedOrders,
        uninvoicedLoading,
        uninvoicedPagination,
        uninvoicedSummary,
        invoiceProcessingId,
        fetchUninvoicedOrders,
        processSingleOrder,

        // Toplu Faturalama
        processLoading,
        processResult,
        processAll,

        // Yardımcı
        clearError,
        clearProcessResult,
    };
};

export default useAutoInvoice;
