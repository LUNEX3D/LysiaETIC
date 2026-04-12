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
     * Tüm bağlı sağlayıcılardan belgeleri çek
     */
    const fetchAll = useCallback(async () => {
        const providers = providersRef.current;
        if (!providers || providers.length === 0) return;
        if (isFetchingRef.current) return;

        const provider = providers[0];
        const apiToken = provider.apiToken || provider.customerToken || provider.partnerToken;
        if (!apiToken) {
            setFetchError("Geçerli bir oturum token'ı bulunamadı. Lütfen sağlayıcıyı yeniden bağlayın.");
            return;
        }

        isFetchingRef.current = true;
        setLoading(true);
        setFetchError("");

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
    }, []);

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
                const blob = new Blob([text], { type: "text/html; charset=utf-8" });
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
        setPdfLoading(invoiceId);
        try {
            const res = await API.get("/auto-invoice/invoices/" + invoiceId + "/pdf", {
                responseType: "blob",
            });

            const contentType = res.headers["content-type"] || "";
            const blob = res.data;

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
                const text = await blob.text();
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
                const text = await blob.text();
                if (text.includes("<html") || text.includes("<!DOCTYPE")) {
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
            return { error: "PDF indirme hatası: " + (err.response?.data?.message || err.message) };
        } finally {
            setPdfLoading(null);
        }
    }, []);

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
