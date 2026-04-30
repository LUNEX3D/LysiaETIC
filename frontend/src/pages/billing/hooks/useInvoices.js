/**
 * useInvoices — Fatura Veri Yönetimi Hook'u
 * LysiaETIC
 *
 * Belge çekme, filtreleme, detay görüntüleme, PDF indirme.
 * api.js Axios instance kullanır (refresh token rotation desteği).
 */
import { useState, useCallback, useRef, useEffect } from "react";
import API from "../../../services/api";
import { PROVIDER_DOC_TYPES } from "../constants";
import { normalizeDocuments, fmtDateApi } from "../utils";

const useInvoices = (connectedProviders) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState(null);
    const [fetchError, setFetchError] = useState("");

    // Detay modal state
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // PDF loading state
    const [pdfLoading, setPdfLoading] = useState(null);

    // Fetch guard
    const isFetchingRef = useRef(false);
    const hasFetchedRef = useRef(false);
    const providersRef = useRef(connectedProviders);
    providersRef.current = connectedProviders;

    /**
     * DB'den (LysiaETIC Invoice tablosu) faturaları çek.
     * Provider DB'den algılandığında (fromDb: true) aktif QNB session olmadan
     * faturaları gösterebilmek için kullanılır.
     */
    const fetchFromDb = useCallback(async () => {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const startDate = thirtyDaysAgo.toISOString().split("T")[0].replace(/-/g, "");
            const endDate = now.toISOString().split("T")[0].replace(/-/g, "");

            const res = await API.get("/auto-invoice/qnb-invoices", {
                params: { startDate, endDate, limit: 100 },
            });

            if (res.data.success && Array.isArray(res.data.data)) {
                return res.data.data.map((inv) => ({
                    id: inv.id || inv._id || inv.uuid,
                    type: (inv.profileId || "").toLowerCase().includes("earsiv") ? "e-arsiv" : "e-fatura",
                    number: inv.faturaNo || "",
                    date: inv.tarih || "",
                    customer: inv.aliciAdi || "",
                    vkn: inv.aliciVkn || "",
                    amount: Number(inv.kdvHaric || 0),
                    tax: Number(inv.kdv || 0),
                    total: Number(inv.tutar || 0) || (Number(inv.kdvHaric || 0) + Number(inv.kdv || 0)),
                    status: inv.durum || "created",
                    currency: inv.currency || "TRY",
                    provider: "qnb-esolutions",
                    raw: inv,
                }));
            }
        } catch (err) {
            // Subscription expired — özel mesaj
            if (err.response?.status === 403 && (err.response?.data?.subscriptionExpired || err.response?.data?.subscriptionSuspended)) {
                setFetchError(err.response.data.message || "Abonelik süreniz dolmuş. Lütfen paketinizi yenileyin.");
            }
            console.error("[useInvoices] DB'den fatura çekme hatası:", err);
        }
        return [];
    }, []);

    /**
     * Tüm bağlı sağlayıcılardan belgeleri çek.
     * Provider DB'den algılandıysa (fromDb: true, aktif session yok)
     * QNB API yerine LysiaETIC DB'den faturaları çeker.
     */
    const fetchAll = useCallback(async () => {
        const providers = providersRef.current;
        if (!providers || providers.length === 0) return;
        if (isFetchingRef.current) return;

        const provider = providers[0];

        isFetchingRef.current = true;
        setLoading(true);
        setFetchError("");

        // ── DB'den algılanan sağlayıcı (aktif session yok) ──
        // QNB API'ye erişim için token gerekir ama DB-detected provider'da token yok.
        // Bu durumda LysiaETIC DB'deki Invoice kayıtlarını kullanıyoruz.
        const apiToken = provider.apiToken || provider.customerToken || provider.partnerToken;
        if (!apiToken || provider.fromDb) {
            const dbDocs = await fetchFromDb();
            setInvoices(dbDocs);
            setLastFetchTime(new Date());
            setLoading(false);
            isFetchingRef.current = false;
            return;
        }

        const authType = provider.authType || "trendyol";
        const docTypes = PROVIDER_DOC_TYPES[authType] || PROVIDER_DOC_TYPES.trendyol;
        const searchEndpoint = provider.searchEndpoint || "/api/e-invoice/documents/search";

        let allDocs = [];
        let hasError = false;

        for (const dt of docTypes) {
            try {
                // QNB tarih aralığı zorunlu — son 30 gün
                const defaultSearchParams = {};
                if (authType === "qnb") {
                    const now = new Date();
                    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    defaultSearchParams.startDate = fmtDateApi(thirtyDaysAgo);
                    defaultSearchParams.endDate = fmtDateApi(now);
                }

                const bodyData = {
                    token: apiToken,
                    documentType: dt.apiType,
                    searchParams: defaultSearchParams,
                    env: provider.env,
                };

                // QNB backend "sessionId" bekliyor
                if (authType === "qnb") {
                    bodyData.sessionId = provider.sessionId || apiToken;
                }
                // Paraşüt companyId gerektirir
                if (authType === "parasut" && provider.companyId) {
                    bodyData.companyId = provider.companyId;
                }

                const res = await API.post(searchEndpoint.replace("/api/", "/"), bodyData);
                const data = res.data;

                if (data.success && data.data) {
                    const docs = Array.isArray(data.data)
                        ? data.data
                        : data.data.content || data.data.documents || data.data.items || [];
                    const normalized = normalizeDocuments(docs, dt.localType, provider.id);
                    allDocs = [...allDocs, ...normalized];
                }
            } catch (err) {
                console.error("[useInvoices] " + dt.apiType + " çekme hatası:", err);
                hasError = true;
            }
        }

        setInvoices(allDocs);
        setLastFetchTime(new Date());
        if (hasError && allDocs.length === 0) {
            setFetchError("Belgeler çekilirken hata oluştu. Sağlayıcı bağlantınızı kontrol edin.");
        }
        setLoading(false);
        isFetchingRef.current = false;
    }, [fetchFromDb]);

    /**
     * Sağlayıcı bağlandığında otomatik belge çek (tek seferlik)
     */
    useEffect(() => {
        const isConnected = connectedProviders && connectedProviders.length > 0;
        if (isConnected && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchAll();
        }
        if (!isConnected) {
            hasFetchedRef.current = false;
            setInvoices([]);
            setLastFetchTime(null);
            setFetchError("");
        }
    }, [connectedProviders, fetchAll]);

    /**
     * Fatura detayını DB'den çek
     */
    const fetchDetail = useCallback(async (invoiceId) => {
        if (!invoiceId) return;
        setDetailLoading(true);
        setDetailData(null);
        try {
            const res = await API.get("/auto-invoice/invoices/" + invoiceId);
            if (res.data.success) {
                setDetailData(res.data.data);
            }
        } catch (err) {
            console.error("[useInvoices] Detay hatası:", err);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    /**
     * Fatura seç ve detay modalını aç
     */
    const selectInvoice = useCallback(
        (inv) => {
            setSelectedInvoice(inv);
            setDetailData(null);
            if (inv && inv.id) {
                fetchDetail(inv.id).catch(() => {});
            }
        },
        [fetchDetail]
    );

    /**
     * Detay modalını kapat
     */
    const clearSelection = useCallback(() => {
        setSelectedInvoice(null);
        setDetailData(null);
    }, []);

    /**
     * QNB UUID ile fatura önizleme
     */
    const previewInvoice = useCallback(async (uuid) => {
        if (!uuid) return;
        setPdfLoading(uuid);
        try {
            const res = await API.get("/auto-invoice/qnb-invoices/" + encodeURIComponent(uuid) + "/preview", {
                responseType: "text",
            });
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
            } else {
                try {
                    const data = JSON.parse(text);
                    if (!data.success) {
                        return { error: data.message || "Fatura önizlemesi alınamadı" };
                    }
                } catch {
                    return { error: "Beklenmeyen yanıt formatı" };
                }
            }
            return { success: true };
        } catch (err) {
            return { error: "Fatura önizleme hatası: " + (err.response?.data?.message || err.message) };
        } finally {
            setPdfLoading(null);
        }
    }, []);

    /**
     * Fatura PDF indir
     */
    const downloadPdf = useCallback(async (invoiceId, invoiceNumber) => {
        if (!invoiceId) return;

        // UUID formatı ise önce preview endpoint'ini dene (daha güvenilir)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
        if (isUuid) {
            const previewResult = await previewInvoice(invoiceId);
            if (previewResult?.success) return previewResult;
            // Preview başarısız olursa PDF endpoint'ine düş
        }

        setPdfLoading(invoiceId);
        try {
            const res = await API.get("/auto-invoice/invoices/" + invoiceId + "/pdf", {
                responseType: "blob",
            });

            const contentType = res.headers["content-type"] || "";
            const blob = res.data;

            // ⚠️ responseType: "blob" ile JSON hata yanıtları da blob olarak gelir
            // Content-Type JSON ise hata mesajını çıkar
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
                // Bilinmeyen format — text olarak oku
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
                    return { error: "Beklenmeyen yanıt formatı: " + contentType };
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
        } finally {
            setPdfLoading(null);
        }
    }, [previewInvoice]);

    /**
     * QNB üzerinden fatura oluştur (e-Arşiv)
     */
    const createInvoice = useCallback(
        async (provider, invoiceFormData) => {
            if (!provider) return { error: "Sağlayıcı bulunamadı" };
            const isQnb = provider.authType === "qnb";
            if (!isQnb) {
                return { error: "Şu an sadece QNB eSolutions ile fatura oluşturma desteklenmektedir." };
            }

            try {
                const res = await API.post("/e-invoice/qnb/earchive/create-from-form", {
                    sessionId: provider.sessionId,
                    env: provider.env || "test",
                    invoiceData: invoiceFormData,
                });

                const data = res.data;
                if (data.success) {
                    // Belgeleri yenile
                    setTimeout(() => fetchAll(), 1500);
                    return { success: true, data: data.data };
                }
                return { error: data.message || "Fatura oluşturulamadı" };
            } catch (err) {
                return {
                    error: "Bağlantı hatası: " + (err.response?.data?.message || err.message || "Sunucuya erişilemiyor"),
                };
            }
        },
        [fetchAll]
    );

    return {
        invoices,
        loading,
        lastFetchTime,
        fetchError,
        fetchAll,

        // Detay
        selectedInvoice,
        detailData,
        detailLoading,
        selectInvoice,
        clearSelection,

        // PDF
        pdfLoading,
        previewInvoice,
        downloadPdf,

        // Oluşturma
        createInvoice,
    };
};

export default useInvoices;
