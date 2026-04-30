/**
 * useProviders — Sağlayıcı Bağlantı Yönetimi Hook'u
 * LysiaETIC
 *
 * Sağlayıcı bağlantı/bağlantı kesme, credential yönetimi.
 * ⚠️ Güvenlik: Credential'lar backend'e gönderilir, localStorage'da sadece
 *    session token saklanır (plain text password SAKLANMAZ).
 *
 * ✅ DB'deki auto-invoice config'den bağlı sağlayıcıyı otomatik algılar.
 *    localStorage boşsa bile, kullanıcının DB'de kayıtlı QNB ayarı varsa
 *    sağlayıcı "bağlı" olarak gösterilir.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import API from "../../../services/api";

const STORAGE_KEY = "lysia_billing_providers";

/**
 * localStorage'dan bağlı sağlayıcıları oku
 * Sadece token ve meta bilgi saklanır, credential saklanmaz
 */
const loadProviders = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {
        /* ignore */
    }
    return [];
};

/**
 * localStorage'a sağlayıcıları kaydet
 * ⚠️ Password/secret alanları temizlenerek kaydedilir
 */
const saveProviders = (providers) => {
    try {
        const sanitized = providers.map((p) => {
            const clean = { ...p };
            // Credential'ları temizle — sadece token ve meta bilgi sakla
            delete clean.password;
            delete clean.apiSecret;
            delete clean.clientSecret;
            delete clean.customerPassword;
            // fields bilgisini de temizle (büyük obje, gereksiz)
            delete clean.fields;
            delete clean.environments;
            delete clean.capabilities;
            return clean;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
        /* ignore */
    }
};

const useProviders = () => {
    const [connectedProviders, setConnectedProviders] = useState(loadProviders);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState("");
    const dbCheckDoneRef = useRef(false);

    /**
     * localStorage boşsa DB'deki auto-invoice config'den bağlı sağlayıcıyı algıla.
     * Kullanıcı daha önce Otomatik Fatura ayarlarından QNB bilgilerini girmişse,
     * Faturalandırma sayfasının "Genel Bakış" sekmesi de sağlayıcıyı bağlı gösterir.
     */
    useEffect(() => {
        if (dbCheckDoneRef.current) return;
        if (connectedProviders.length > 0) {
            dbCheckDoneRef.current = true;
            return;
        }
        dbCheckDoneRef.current = true;

        API.get("/auto-invoice/config")
            .then((res) => {
                if (!res.data.success) return;
                const cfg = res.data.data;
                if (!cfg || !cfg.supplier || !cfg.supplier.vkn) return;

                // QNB credentials var mı?
                const qnb = cfg.qnbCredentials || {};
                const hasQnb = !!(qnb.earsivUsername || qnb.username);
                if (!hasQnb) return;

                // DB'den algılanan sağlayıcıyı oluştur
                const dbProvider = {
                    id: "qnb-esolutions",
                    name: "QNB eSolutions",
                    logo: "🏦",
                    color: "#7c3aed",
                    authType: "qnb",
                    env: qnb.env || "test",
                    connectedAt: new Date().toISOString(),
                    fromDb: true, // DB'den algılandığını işaretle
                    searchEndpoint: "/api/e-invoice/qnb/documents/search",
                };

                setConnectedProviders([dbProvider]);
                saveProviders([dbProvider]);
            })
            .catch(() => {
                /* Subscription expired veya ağ hatası — sessizce geç */
            });
    }, [connectedProviders.length]);

    const isConnected = connectedProviders.length > 0;
    const activeProvider = connectedProviders.length > 0 ? connectedProviders[0] : null;

    /**
     * Sağlayıcıya bağlan
     */
    const connect = useCallback(async (provider, formData, env) => {
        if (!provider) return false;
        setConnecting(true);
        setConnectionError("");

        // Zorunlu alan kontrolü
        const missing = (provider.fields || []).filter(
            (f) => f.required && !formData[f.key]
        );
        if (missing.length > 0) {
            setConnectionError(
                "Lütfen tüm zorunlu alanları doldurun: " +
                    missing.map((f) => f.label).join(", ")
            );
            setConnecting(false);
            return false;
        }

        try {
            const authType = provider.authType || "trendyol";
            let newProvider = null;

            // ═══ QNB eSolutions ═══
            if (authType === "qnb") {
                // Önce e-Arşiv olarak dene (en yaygın kullanım)
                let loginResult = await API.post("/e-invoice/qnb/login", {
                    username: formData.username,
                    password: formData.password,
                    env: env,
                    service: "earsiv",
                }).catch(() => ({ data: { success: false } }));

                let loginData = loginResult.data;

                // e-Arşiv başarısızsa e-Fatura olarak dene
                if (!loginData.success) {
                    loginResult = await API.post("/e-invoice/qnb/login", {
                        username: formData.username,
                        password: formData.password,
                        env: env,
                        service: "efatura",
                    }).catch(() => ({ data: { success: false } }));
                    loginData = loginResult.data;
                }

                if (!loginData.success) {
                    setConnectionError(
                        "QNB giriş başarısız: " + (loginData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                newProvider = {
                    id: provider.id,
                    name: provider.name,
                    logo: provider.logo,
                    color: provider.color,
                    authType: "qnb",
                    env: env,
                    connectedAt: new Date().toISOString(),
                    apiToken: loginData.data?.accessToken || loginData.data?.sessionId,
                    sessionId: loginData.data?.sessionId,
                    searchEndpoint: provider.searchEndpoint,
                };
            }

            // ═══ TRENDYOL E-FATURAM ═══
            else if (authType === "trendyol") {
                // 1. Partner Login
                const partnerResult = await API.post("/e-invoice/trendyol/partner-login", {
                    username: formData.username,
                    password: formData.password,
                    env: env,
                }).catch(() => ({ data: { success: false } }));

                const partnerData = partnerResult.data;
                if (!partnerData.success) {
                    setConnectionError(
                        "Partner giriş başarısız: " + (partnerData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                const partnerToken = partnerData.data?.accessToken;

                // 2. Customer Login
                const customerResult = await API.post("/e-invoice/trendyol/customer-login", {
                    partnerToken: partnerToken,
                    customerUsername: formData.customerUsername,
                    customerPassword: formData.customerPassword,
                    env: env,
                }).catch(() => ({ data: { success: false } }));

                const customerData = customerResult.data;
                if (!customerData.success) {
                    setConnectionError(
                        "Müşteri giriş başarısız: " + (customerData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                newProvider = {
                    id: provider.id,
                    name: provider.name,
                    logo: provider.logo,
                    color: provider.color,
                    authType: "trendyol",
                    env: env,
                    connectedAt: new Date().toISOString(),
                    partnerToken: partnerToken,
                    customerToken: customerData.data?.accessToken,
                    apiToken: customerData.data?.accessToken,
                    companyId: customerData.data?.companyId,
                    userId: customerData.data?.userId,
                    searchEndpoint: provider.searchEndpoint,
                };
            }

            // ═══ SOVOS (Foriba) ═══
            else if (authType === "sovos") {
                const tokenResult = await API.post("/e-invoice/sovos/token", {
                    apiKey: formData.apiKey,
                    apiSecret: formData.apiSecret,
                    env: env,
                }).catch(() => ({ data: { success: false } }));

                const tokenData = tokenResult.data;
                if (!tokenData.success) {
                    setConnectionError(
                        "Sovos OAuth başarısız: " + (tokenData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                newProvider = {
                    id: provider.id,
                    name: provider.name,
                    logo: provider.logo,
                    color: provider.color,
                    authType: "sovos",
                    env: env,
                    connectedAt: new Date().toISOString(),
                    apiToken: tokenData.data?.accessToken,
                    expiresIn: tokenData.data?.expiresIn,
                    searchEndpoint: provider.searchEndpoint,
                };
            }

            // ═══ PARAŞÜT ═══
            else if (authType === "parasut") {
                const tokenResult = await API.post("/e-invoice/parasut/token", {
                    clientId: formData.clientId,
                    clientSecret: formData.clientSecret,
                    email: formData.email,
                    password: formData.password,
                }).catch(() => ({ data: { success: false } }));

                const tokenData = tokenResult.data;
                if (!tokenData.success) {
                    setConnectionError(
                        "Paraşüt OAuth başarısız: " + (tokenData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                const parasutData = tokenData.data || {};
                const companies = parasutData.companies || [];

                newProvider = {
                    id: provider.id,
                    name: provider.name,
                    logo: provider.logo,
                    color: provider.color,
                    authType: "parasut",
                    env: env,
                    connectedAt: new Date().toISOString(),
                    apiToken: parasutData.accessToken,
                    refreshToken: parasutData.refreshToken,
                    expiresIn: parasutData.expiresIn,
                    companyId: companies.length > 0 ? companies[0].id : null,
                    companies: companies,
                    userId: parasutData.userId,
                    searchEndpoint: provider.searchEndpoint,
                };
            }

            // ═══ ÖDEAL (E-FaturaPos) ═══
            else if (authType === "odeal") {
                const validateResult = await API.post("/e-invoice/odeal/validate-key", {
                    serviceKey: formData.serviceKey,
                    merchantKey: formData.merchantKey || null,
                    env: env,
                }).catch(() => ({ data: { success: false } }));

                const validateData = validateResult.data;
                if (!validateData.success) {
                    setConnectionError(
                        "Ödeal doğrulama başarısız: " + (validateData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                newProvider = {
                    id: provider.id,
                    name: provider.name,
                    logo: provider.logo,
                    color: provider.color,
                    authType: "odeal",
                    env: env,
                    connectedAt: new Date().toISOString(),
                    apiToken: formData.serviceKey,
                    serviceKey: formData.serviceKey,
                    merchantKey: formData.merchantKey || null,
                    searchEndpoint: provider.searchEndpoint,
                };
            }

            if (!newProvider) {
                setConnectionError("Bilinmeyen sağlayıcı tipi");
                setConnecting(false);
                return false;
            }

            const updated = [...connectedProviders, newProvider];
            setConnectedProviders(updated);
            saveProviders(updated);
            setConnectionError("");
            setConnecting(false);
            return true;
        } catch (err) {
            setConnectionError(
                "Bağlantı hatası: " + (err.response?.data?.message || err.message || "Sunucuya erişilemiyor")
            );
            setConnecting(false);
            return false;
        }
    }, [connectedProviders]);

    /**
     * Sağlayıcı bağlantısını kes
     */
    const disconnect = useCallback(
        (providerId) => {
            const updated = connectedProviders.filter((p) => p.id !== providerId);
            setConnectedProviders(updated);
            if (updated.length > 0) {
                saveProviders(updated);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        },
        [connectedProviders]
    );

    /**
     * Bağlantı hatasını temizle
     */
    const clearError = useCallback(() => {
        setConnectionError("");
    }, []);

    return {
        connectedProviders,
        isConnected,
        activeProvider,
        connecting,
        connectionError,
        connect,
        disconnect,
        clearError,
    };
};

export default useProviders;
