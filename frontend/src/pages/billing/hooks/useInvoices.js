/**
 * useInvoices — Fatura Veri Yönetimi Hook'u
 * LysiaETIC
 *
 * Belge çekme, filtreleme, detay görüntüleme, PDF indirme.
 * api.js Axios instance kullanır (refresh token rotation desteği).
 */
import { useState, useCallback, useRef, useEffect } from "react";
import API from "../../../services/api";
import { getProviderDocTypes, BILLING_DOCUMENTS_API } from "../constants";
import { normalizeDocuments, fmtDateApi, mergeInvoiceLists, resolveInvoiceDocType, coerceInvoiceRef, isQnbFaturaUrl, isSovosProvider, injectPreviewBaseTag, loadAllBillingDocuments } from "../utils";

const useInvoices = (connectedProviders) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState(null);
    const [fetchError, setFetchError] = useState("");
    const [actionError, setActionError] = useState("");

    // Detay modal state
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Belge işlem loading — preview / download / signed ayrı
    const [docLoading, setDocLoading] = useState(null);

    const setDocActionLoading = (id, action) => {
        if (!id) {
            setDocLoading(null);
            return;
        }
        setDocLoading({ id: String(id), action });
    };

    const isDocLoading = useCallback((id, action) => {
        if (!id || !docLoading) return false;
        return docLoading.id === String(id) && docLoading.action === action;
    }, [docLoading]);

    const isAnyDocLoading = useCallback((id) => {
        if (!id || !docLoading) return false;
        return docLoading.id === String(id);
    }, [docLoading]);

    // Fetch guard
    const isFetchingRef = useRef(false);
    const hasFetchedRef = useRef(false);
    const lastProviderApiAtRef = useRef(0);
    const providersRef = useRef(connectedProviders);
    providersRef.current = connectedProviders;

    const PROVIDER_API_COOLDOWN_MS = 90 * 1000;

    const patchProviderCapabilities = useCallback((capabilityKey, value = false) => {
        if (!capabilityKey) return;
        const updated = (providersRef.current || []).map((p) =>
            p.authType === "sovos"
                ? { ...p, capabilities: { ...(p.capabilities || {}), [capabilityKey]: value } }
                : p
        );
        providersRef.current = updated;
        try {
            localStorage.setItem("lysia_billing_providers", JSON.stringify(updated));
        } catch {
            /* ignore */
        }
    }, []);

    const isInactiveModuleResponse = (data) =>
        Boolean(data?.inactiveModule || data?.skipped) ||
        /5040|module is inactive|modül aktif değil/i.test(String(data?.error || data?.message || ""));

    /**
     * DB'den (LysiaETIC Invoice tablosu) faturaları çek.
     * Provider DB'den algılandığında (fromDb: true) aktif QNB session olmadan
     * faturaları gösterebilmek için kullanılır.
     */
    const fetchFromDb = useCallback(async (provider, { documentType } = {}) => {
        try {
            const providerId = provider?.id || "qnb-esolutions";
            const rows = await loadAllBillingDocuments(
                (path, config) => API.get(path, config),
                BILLING_DOCUMENTS_API.list,
                { documentType, providerId, maxPages: 20 }
            );
            return rows;
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
    const fetchAll = useCallback(async (options = {}) => {
        const providers = providersRef.current;
        if (isFetchingRef.current) return;

        const provider = providers?.[0];
        const authType = provider?.authType || "trendyol";
        const forceProviderApi = options.forceProviderApi === true;

        isFetchingRef.current = true;
        setLoading(true);
        setFetchError("");

        // Sağlayıcı bağlı değilse yalnızca DB (Dashtock'ta kesilen faturalar)
        if (!provider) {
            const dbDocs = await fetchFromDb(null);
            setInvoices(dbDocs);
            setLastFetchTime(new Date());
            if (dbDocs.length === 0) {
                setFetchError("");
            }
            setLoading(false);
            isFetchingRef.current = false;
            return;
        }

        // Sovos: varsayılan olarak yalnızca LysiaETIC DB — getUBLList çağrılmaz (Sovos rate limit)
        if (authType === "sovos" && !forceProviderApi) {
            const dbDocs = await fetchFromDb(provider);
            setInvoices(dbDocs);
            setLastFetchTime(new Date());
            setLoading(false);
            isFetchingRef.current = false;
            return;
        }

        const apiToken = provider.apiToken || provider.customerToken || provider.partnerToken;

        if (!apiToken) {
            if (provider.fromDb) {
                const dbDocs = await fetchFromDb(provider);
                setInvoices(dbDocs);
                setLastFetchTime(new Date());
                setLoading(false);
                isFetchingRef.current = false;
                return;
            }
            setFetchError("Sağlayıcı oturumu bulunamadı. Lütfen yeniden bağlanın.");
            setLoading(false);
            isFetchingRef.current = false;
            return;
        }

        const now = Date.now();
        if (!forceProviderApi && now - lastProviderApiAtRef.current < PROVIDER_API_COOLDOWN_MS) {
            const dbDocs = await fetchFromDb(provider);
            setInvoices(dbDocs);
            setLastFetchTime(new Date());
            setFetchError("Sağlayıcı sorgusu sınırlandı. Liste veritabanından gösteriliyor; tam senkron için biraz bekleyip yenileyin.");
            setLoading(false);
            isFetchingRef.current = false;
            return;
        }
        lastProviderApiAtRef.current = now;

        const docTypes = getProviderDocTypes(provider);
        const searchEndpoint = provider.searchEndpoint || "/api/e-invoice/documents/search";

        let allDocs = [];
        let hasError = false;

        for (const dt of docTypes) {
            try {
                const defaultSearchParams = {};
                if (authType === "qnb" || authType === "sovos") {
                    const rangeDays = authType === "sovos" ? 7 : 30;
                    const ago = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
                    defaultSearchParams.startDate = fmtDateApi(ago);
                    defaultSearchParams.endDate = fmtDateApi(now);
                }

                const bodyData = {
                    token: apiToken,
                    documentType: dt.apiType,
                    searchParams: defaultSearchParams,
                    env: provider.env,
                };

                if (authType === "qnb" || authType === "sovos") {
                    bodyData.sessionId = provider.sessionId || apiToken;
                    bodyData.token = provider.sessionId || apiToken;
                }
                if (authType === "parasut" && provider.companyId) {
                    bodyData.companyId = provider.companyId;
                }

                const res = await API.post(searchEndpoint.replace("/api/", "/"), bodyData);
                const data = res.data;

                if (data.rateLimited) {
                    setFetchError(data.error || data.message || "Sovos sorgu limiti — lütfen bekleyin.");
                    hasError = true;
                    continue;
                }

                if (data.inactiveModule && data.capabilityKey) {
                    patchProviderCapabilities(data.capabilityKey, false);
                }

                if (data.success && data.data) {
                    if (authType === "sovos" && (data.sessionId || data.accessToken)) {
                        const newSid = data.sessionId || data.accessToken;
                        const updated = providersRef.current.map((p) =>
                            p.id === provider.id ? { ...p, sessionId: newSid, apiToken: newSid } : p
                        );
                        providersRef.current = updated;
                        try {
                            localStorage.setItem("lysia_billing_providers", JSON.stringify(updated));
                        } catch {
                            /* ignore */
                        }
                    }

                    const docs = Array.isArray(data.data)
                        ? data.data
                        : data.data.content || data.data.documents || data.data.items || [];
                    const normalized = normalizeDocuments(docs, dt.localType, provider.id);
                    allDocs = [...allDocs, ...normalized];
                } else if (data.skipped || data.inactiveModule || isInactiveModuleResponse(data)) {
                    if (data.inactiveModule && data.capabilityKey) {
                        patchProviderCapabilities(data.capabilityKey, false);
                    }
                } else if (!data.success && data.message) {
                    if (!isInactiveModuleResponse(data)) {
                        hasError = true;
                    }
                }
            } catch (err) {
                console.error("[useInvoices] " + dt.apiType + " çekme hatası:", err);
                hasError = true;
            }
        }

        const dbDocs = await fetchFromDb(provider);
        const merged = mergeInvoiceLists(allDocs, dbDocs);
        setInvoices(merged);
        setLastFetchTime(new Date());
        if (hasError && merged.length === 0) {
            setFetchError("Belgeler çekilirken hata oluştu. Sağlayıcı bağlantınızı kontrol edin.");
        }
        setLoading(false);
        isFetchingRef.current = false;
    }, [fetchFromDb, patchProviderCapabilities]);

    const wasProviderConnectedRef = useRef(false);

    /**
     * İlk yükleme + sağlayıcı bağlandığında belge çek
     */
    useEffect(() => {
        const isConnected = connectedProviders && connectedProviders.length > 0;

        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchAll();
            wasProviderConnectedRef.current = isConnected;
            return;
        }

        if (isConnected && !wasProviderConnectedRef.current) {
            wasProviderConnectedRef.current = true;
            fetchAll();
        }
        if (!isConnected) {
            wasProviderConnectedRef.current = false;
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
            setActionError("");
            const ids = coerceInvoiceRef(inv);
            const detailId = ids.mongoId || ids.lookupId;
            if (detailId) {
                fetchDetail(detailId).catch(() => {});
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
     * Belge önizleme — sağlayıcıya göre QNB veya Sovos
     */
    const resolveInvoiceProvider = useCallback((ids) => {
        if (isSovosProvider(ids.provider)) return "sovos";
        const connected = providersRef.current?.[0];
        if (connected?.authType === "sovos") return "sovos";
        if (ids.provider === "qnb") return "qnb";
        if (connected?.authType === "qnb") return "qnb";
        return ids.provider || connected?.authType || "";
    }, []);

    const openHtmlPreview = (html, previewContext = {}) => {
        const content = injectPreviewBaseTag(html, previewContext);
        const blob = new Blob([content], { type: "text/html; charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    };

    const looksLikeBase64Text = (text) => {
        const sample = String(text || "").replace(/\s/g, "").slice(0, 80);
        return sample.length >= 8 && /^[A-Za-z0-9+/=]+$/.test(sample);
    };

    const normalizePreviewBlob = async (blob, contentType = "") => {
        if (!(blob instanceof Blob)) return { blob, contentType };

        const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
        const isHtml = header[0] === 0x3c;
        if (isPdf) return { blob, contentType: "application/pdf" };
        if (isHtml) return { blob, contentType: "text/html; charset=utf-8" };

        const text = await blob.text();
        if (text.trim().startsWith("<")) {
            return { blob: new Blob([text], { type: "text/html; charset=utf-8" }), contentType: "text/html; charset=utf-8" };
        }
        if (looksLikeBase64Text(text)) {
            const binary = Uint8Array.from(atob(text.replace(/\s/g, "")), (c) => c.charCodeAt(0));
            const decoded = new Blob([binary], { type: contentType || "application/octet-stream" });
            const decodedHeader = binary.slice(0, 4);
            if (decodedHeader[0] === 0x25 && decodedHeader[1] === 0x50) {
                return { blob: new Blob([binary], { type: "application/pdf" }), contentType: "application/pdf" };
            }
            if (decodedHeader[0] === 0x3c) {
                const decodedText = new TextDecoder().decode(binary);
                return { blob: new Blob([decodedText], { type: "text/html; charset=utf-8" }), contentType: "text/html; charset=utf-8" };
            }
            return { blob: decoded, contentType };
        }
        return { blob, contentType };
    };

    const openBlobPreview = async (blob, contentType, previewContext = {}) => {
        const normalized = await normalizePreviewBlob(blob, contentType);
        blob = normalized.blob;
        contentType = normalized.contentType || contentType;

        if (contentType.includes("json")) {
            const text = await blob.text();
            try {
                const data = JSON.parse(text);
                return { error: data.message || "Belge alınamadı" };
            } catch {
                return { error: "Belge alınamadı" };
            }
        }
        if (contentType.includes("pdf")) {
            const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
            if (!(header[0] === 0x25 && header[1] === 0x50)) {
                return { error: "Geçersiz PDF içeriği alındı" };
            }
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            return { success: true };
        }
        if (contentType.includes("html") || contentType.includes("text")) {
            const text = await blob.text();
            if (text.includes("<html") || text.includes("<!DOCTYPE")) {
                openHtmlPreview(text, previewContext);
                return { success: true };
            }
            return { error: "Beklenmeyen yanıt formatı" };
        }
        const text = await blob.text();
        if (text.includes("<html") || text.includes("<!DOCTYPE")) {
            openHtmlPreview(text, previewContext);
            return { success: true };
        }
        return { error: "Beklenmeyen yanıt formatı" };
    };

    const previewInvoice = useCallback(async (invOrId, invoiceNumber) => {
        const ids = coerceInvoiceRef(invOrId, invoiceNumber);
        if (!ids.lookupId && !ids.uuid) {
            return { error: "Fatura kimliği bulunamadı" };
        }

        const invoiceProvider = resolveInvoiceProvider(ids);
        const previewContext = { provider: invoiceProvider, env: ids.env || providersRef.current?.[0]?.env || "test" };

        setDocActionLoading(ids.lookupId || ids.uuid, "preview");
        setActionError("");
        try {
            const safeFaturaUrl = ids.faturaURL && !(isSovosProvider(invoiceProvider) && isQnbFaturaUrl(ids.faturaURL))
                ? ids.faturaURL
                : "";
            if (safeFaturaUrl) {
                window.open(safeFaturaUrl, "_blank");
                return { success: true };
            }

            if (invoiceProvider !== "sovos" && ids.uuid) {
                try {
                    const res = await API.get(
                        BILLING_DOCUMENTS_API.preview(ids.uuid),
                        { responseType: "text" }
                    );
                    const text = typeof res.data === "string" ? res.data : "";
                    if (text.includes("<html") || text.includes("<HTML") || text.includes("<!DOCTYPE")) {
                        openHtmlPreview(text, previewContext);
                        return { success: true };
                    }
                } catch (previewErr) {
                    // PDF endpoint'ine düş
                }
            }

            const pdfId = ids.lookupId || ids.uuid;
            const res = await API.get("/auto-invoice/invoices/" + encodeURIComponent(pdfId) + "/pdf", {
                responseType: "blob",
            });
            const result = await openBlobPreview(res.data, res.headers["content-type"] || "", previewContext);
            if (result.error) {
                setActionError(result.error);
            }
            return result;
        } catch (err) {
            let msg = "Fatura önizleme hatası";
            if (err.response?.data instanceof Blob) {
                try {
                    const data = JSON.parse(await err.response.data.text());
                    msg = data.message || msg;
                } catch { /* ignore */ }
            } else {
                msg = err.response?.data?.message || err.message || msg;
            }
            setActionError(msg);
            return { error: msg };
        } finally {
            setDocActionLoading(null);
        }
    }, [resolveInvoiceProvider]);

    /**
     * Fatura PDF indir
     */
    const downloadPdf = useCallback(async (invOrId, invoiceNumber) => {
        const ids = coerceInvoiceRef(invOrId, invoiceNumber);
        if (!ids.lookupId && !ids.uuid) {
            setActionError("Fatura kimliği bulunamadı");
            return { error: "Fatura kimliği bulunamadı" };
        }

        const invoiceProvider = resolveInvoiceProvider(ids);
        const previewContext = { provider: invoiceProvider, env: ids.env || providersRef.current?.[0]?.env || "test" };

        setDocActionLoading(ids.lookupId || ids.uuid, "download");
        setActionError("");
        try {
            const safeFaturaUrl = ids.faturaURL && !(isSovosProvider(invoiceProvider) && isQnbFaturaUrl(ids.faturaURL))
                ? ids.faturaURL
                : "";
            if (safeFaturaUrl) {
                window.open(safeFaturaUrl, "_blank");
                return { success: true };
            }

            const pdfId = ids.lookupId || ids.uuid;
            const res = await API.get("/auto-invoice/invoices/" + encodeURIComponent(pdfId) + "/pdf", {
                responseType: "blob",
            });

            const contentType = res.headers["content-type"] || "";
            const blob = res.data;

            const normalized = await normalizePreviewBlob(blob, contentType);
            blob = normalized.blob;
            contentType = normalized.contentType || contentType;

            if (contentType.includes("json")) {
                const text = await blob.text();
                try {
                    const data = JSON.parse(text);
                    const msg = data.message || "Fatura indirilemedi";
                    setActionError(msg);
                    return { error: msg };
                } catch {
                    setActionError("Fatura indirilemedi");
                    return { error: "Fatura indirilemedi" };
                }
            }

            if (contentType.includes("zip") || contentType.includes("octet")) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = (ids.invoiceNumber || "fatura") + ".zip";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return { success: true };
            }

            if (contentType.includes("xml")) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = (ids.invoiceNumber || "fatura") + ".xml";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return { success: true };
            }

            if (contentType.includes("pdf")) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = (ids.invoiceNumber || "fatura") + ".pdf";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                return { success: true };
            }

            const result = await openBlobPreview(blob, contentType, previewContext);
            if (result.error) {
                setActionError(result.error);
            }
            return result;
        } catch (err) {
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const data = JSON.parse(text);
                    const msg = data.message || "Fatura indirilemedi";
                    setActionError(msg);
                    return { error: msg };
                } catch { /* ignore */ }
            }
            const msg = "PDF indirme hatası: " + (err.response?.data?.message || err.message);
            setActionError(msg);
            return { error: msg };
        } finally {
            setDocActionLoading(null);
        }
    }, [resolveInvoiceProvider]);

    /**
     * Sağlayıcı üzerinden fatura oluştur (e-Arşiv / e-Fatura)
     */
    const createInvoice = useCallback(
        async (provider, invoiceFormData, createType = "e-arsiv") => {
            if (!provider) return { error: "Sağlayıcı bulunamadı" };

            if (createType !== "e-arsiv" && createType !== "e-fatura") {
                return { error: "Bu belge tipi için manuel oluşturma desteklenmiyor." };
            }
            if (createType === "e-fatura" && provider.authType !== "sovos") {
                return { error: "Manuel e-Fatura oluşturma şu an yalnızca Sovos ile desteklenmektedir." };
            }

            const supplierVkn =
                invoiceFormData?.supplier?.vkn ||
                provider.vknTckn ||
                provider.vkn ||
                "";

            const payload = {
                ...invoiceFormData,
                faturaKodu: invoiceFormData.faturaKodu || provider.faturaKodu || "LYS",
                issueDate: invoiceFormData.issueDate || new Date().toISOString().split("T")[0],
                supplier: {
                    ...(invoiceFormData.supplier || {}),
                    vkn: supplierVkn,
                },
            };

            try {
                if (provider.authType === "sovos") {
                    const isEfatura = createType === "e-fatura";
                    const endpoint = isEfatura
                        ? "/e-invoice/sovos/efatura/create-from-form"
                        : "/e-invoice/sovos/earchive/create-from-form";

                    if (isEfatura && !payload.receiverIdentifier) {
                        return {
                            error: "Alıcı PK etiketi bulunamadı. VKN sorgusu yapın veya alıcının e-Fatura mükellefi olduğundan emin olun.",
                        };
                    }

                    const res = await API.post(endpoint, {
                        sessionId: provider.sessionId,
                        token: provider.sessionId,
                        vkn: supplierVkn,
                        branch: provider.branch || "default",
                        invoiceData: payload,
                        receiverIdentifier: payload.receiverIdentifier,
                        profileId: "TICARIFATURA",
                    });

                    const data = res.data;
                    if (data.sessionId || data.accessToken) {
                        const newSid = data.sessionId || data.accessToken;
                        const updated = providersRef.current.map((p) =>
                            p.id === provider.id ? { ...p, sessionId: newSid, apiToken: newSid } : p
                        );
                        providersRef.current = updated;
                        try {
                            localStorage.setItem("lysia_billing_providers", JSON.stringify(updated));
                        } catch {
                            /* ignore */
                        }
                    }

                    if (data.success) {
                        setTimeout(() => fetchAll(), 1500);
                        return { success: true, data: data.data || data };
                    }
                    return { error: data.message || data.error || "Fatura oluşturulamadı" };
                }

                if (provider.authType === "qnb") {
                    const res = await API.post("/e-invoice/qnb/earchive/create-from-form", {
                        sessionId: provider.sessionId,
                        env: provider.env || "test",
                        invoiceData: payload,
                    });

                    const data = res.data;
                    if (data.success) {
                        setTimeout(() => fetchAll(), 1500);
                        return { success: true, data: data.data };
                    }
                    return { error: data.message || "Fatura oluşturulamadı" };
                }

                return { error: "Bu sağlayıcı ile manuel fatura oluşturma henüz desteklenmiyor." };
            } catch (err) {
                return {
                    error: "Bağlantı hatası: " + (err.response?.data?.message || err.message || "Sunucuya erişilemiyor"),
                };
            }
        },
        [fetchAll]
    );

    const respondToInvoice = useCallback(async (invOrId, responseCode) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };

        setActionError("");
        try {
            const res = await API.post(
                "/auto-invoice/invoices/" + encodeURIComponent(actionId) + "/respond",
                { responseCode }
            );
            if (res.data.success) {
                await fetchAll();
                if (selectedInvoice) {
                    const ids = coerceInvoiceRef(selectedInvoice);
                    if (ids.mongoId === actionId || ids.lookupId === actionId) {
                        fetchDetail(actionId).catch(() => {});
                    }
                }
                return { success: true, data: res.data.data };
            }
            return { error: res.data.message || "Yanıt gönderilemedi" };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Yanıt gönderilemedi";
            setActionError(msg);
            return { error: msg };
        }
    }, [fetchAll, selectedInvoice, fetchDetail]);

    const resolveActionId = (invOrId) => {
        const ids = coerceInvoiceRef(invOrId);
        return ids.mongoId || ids.lookupId || ids.uuid;
    };

    const refreshInvoiceStatus = useCallback(async (invOrId) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };

        setActionError("");
        try {
            const res = await API.post("/auto-invoice/invoices/" + encodeURIComponent(actionId) + "/refresh-status");
            if (res.data.success) {
                await fetchAll();
                if (selectedInvoice) {
                    const ids = coerceInvoiceRef(selectedInvoice);
                    if (ids.mongoId === actionId || ids.lookupId === actionId) {
                        fetchDetail(actionId).catch(() => {});
                    }
                }
                return { success: true, data: res.data.data };
            }
            return { error: res.data.message || "Durum güncellenemedi" };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Durum güncellenemedi";
            setActionError(msg);
            return { error: msg };
        }
    }, [fetchAll, fetchDetail, selectedInvoice]);

    const cancelInvoice = useCallback(async (invOrId) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };

        setActionError("");
        try {
            const res = await API.post("/auto-invoice/invoices/" + encodeURIComponent(actionId) + "/cancel");
            if (res.data.success) {
                await fetchAll();
                return { success: true };
            }
            return { error: res.data.message || "İptal başarısız" };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "İptal başarısız";
            setActionError(msg);
            return { error: msg };
        }
    }, [fetchAll]);

    const deleteInvoice = useCallback(async (invOrId) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };

        setActionError("");
        try {
            const res = await API.delete("/auto-invoice/invoices/" + encodeURIComponent(actionId));
            if (res.data.success) {
                clearSelection();
                await fetchAll();
                return { success: true };
            }
            return { error: res.data.message || "Silme başarısız" };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Silme başarısız";
            setActionError(msg);
            return { error: msg };
        }
    }, [fetchAll, clearSelection]);

    /**
     * Sovos portalından belgeleri çekip DB'ye yazar, ardından listeyi günceller
     */
    const syncFromProvider = useCallback(async () => {
        const provider = providersRef.current[0];
        if (!provider || provider.authType !== "sovos") {
            return fetchAll({ forceProviderApi: true });
        }

        setLoading(true);
        setFetchError("");
        setActionError("");
        try {
            const res = await API.post("/auto-invoice/sync-sovos", {
                sessionId: provider.sessionId || provider.apiToken,
                days: 30,
            });
            const data = res.data;
            if (!data.success) {
                setFetchError(data.message || "Sovos senkronizasyonu başarısız");
                return { error: data.message };
            }
            if (data.data?.errors?.length) {
                const isBenignSyncError = (e) =>
                    e.skipped
                    || /5040|module is inactive|modül aktif değil|tekil fatura listesi sunmaz|db kayıtları kullanılır/i.test(
                        String(e.message || e.detail || "")
                    );
                const nonSkip = data.data.errors.filter((e) => !isBenignSyncError(e) && String(e.message || "").trim());
                if (nonSkip.length) {
                    setFetchError(nonSkip.map((e) => e.message).join(" • "));
                } else {
                    setFetchError("");
                }
                data.data.errors
                    .filter((e) => e.skipped || /5040|module is inactive|modül aktif değil/i.test(String(e.message || "")))
                    .forEach((e) => {
                        if (/irsaliye|despatch/i.test(String(e.type || e.message || ""))) {
                            patchProviderCapabilities("edespatch", false);
                        }
                    });
            }
            const dbDocs = await fetchFromDb(provider);
            setInvoices(dbDocs);
            setLastFetchTime(new Date());
            return { success: true, stats: data.data };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Sovos senkronizasyon hatası";
            setFetchError(msg);
            return { error: msg };
        } finally {
            setLoading(false);
        }
    }, [fetchAll, fetchFromDb, patchProviderCapabilities]);

    const downloadSignedXml = useCallback(async (invOrId) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };

        setActionError("");
        setDocActionLoading(actionId, "signed");
        try {
            const res = await API.get("/auto-invoice/invoices/" + encodeURIComponent(actionId) + "/signed-xml", {
                responseType: "blob",
            });
            const blob = res.data;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = (coerceInvoiceRef(invOrId).invoiceNumber || "belge") + "-signed.xml";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            return { success: true };
        } catch (err) {
            let msg = "İmzalı XML indirilemedi";
            if (err.response?.data instanceof Blob) {
                try {
                    const data = JSON.parse(await err.response.data.text());
                    msg = data.message || msg;
                } catch { /* ignore */ }
            } else {
                msg = err.response?.data?.message || err.message || msg;
            }
            setActionError(msg);
            return { error: msg };
        } finally {
            setDocActionLoading(null);
        }
    }, []);

    const retriggerInvoice = useCallback(async (invOrId) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };
        if (!window.confirm("Bu e-Arşiv belgesi için Sovos yeniden tetikleme (retriggerOperation) çalıştırılsın mı?")) {
            return { cancelled: true };
        }

        setActionError("");
        try {
            const res = await API.post("/auto-invoice/invoices/" + encodeURIComponent(actionId) + "/retrigger");
            if (res.data.success) {
                await fetchAll();
                if (selectedInvoice) fetchDetail(actionId).catch(() => {});
                return { success: true, data: res.data.data };
            }
            return { error: res.data.message || "Yeniden tetikleme başarısız" };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Yeniden tetikleme başarısız";
            setActionError(msg);
            return { error: msg };
        }
    }, [fetchAll, fetchDetail, selectedInvoice]);

    const detailedQuery = useCallback(async (invOrId) => {
        const actionId = resolveActionId(invOrId);
        if (!actionId) return { error: "Fatura kimliği bulunamadı" };

        setActionError("");
        try {
            const res = await API.post("/auto-invoice/invoices/" + encodeURIComponent(actionId) + "/detailed-query");
            if (res.data.success) {
                const match = res.data.data?.match;
                if (match) {
                    fetchDetail(actionId).catch(() => {});
                }
                return { success: true, data: res.data.data, message: match ? "Detaylı kayıt bulundu — detay yenilendi." : "Kayıt bulunamadı; ham liste döndü." };
            }
            return { error: res.data.message || "Detaylı sorgu başarısız" };
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Detaylı sorgu başarısız";
            setActionError(msg);
            return { error: msg };
        }
    }, [fetchDetail]);

    return {
        invoices,
        loading,
        lastFetchTime,
        fetchError,
        actionError,
        clearActionError: () => setActionError(""),
        fetchAll,
        syncFromProvider,

        // Detay
        selectedInvoice,
        detailData,
        detailLoading,
        selectInvoice,
        clearSelection,

        // Belge işlemleri
        docLoading,
        isDocLoading,
        isAnyDocLoading,
        previewInvoice,
        downloadPdf,

        // Oluşturma
        createInvoice,

        // İşlemler
        refreshInvoiceStatus,
        cancelInvoice,
        deleteInvoice,
        respondToInvoice,
        downloadSignedXml,
        retriggerInvoice,
        detailedQuery,
    };
};

export default useInvoices;
