/**
 * useProviders — Sağlayıcı Bağlantı Yönetimi Hook'u
 * LysiaETIC
 *
 * Sağlayıcı bağlantı/bağlantı kesme, credential yönetimi.
 * ⚠️ Güvenlik: Credential'lar backend'e gönderilir, localStorage'da sadece
 *    session token saklanır (plain text password SAKLANMAZ).
 *
 * ✅ DB'deki auto-invoice config (provider alanı) tek kaynak — sayfa yenilemede
 *    doğru sağlayıcı gösterilir.
 */
import { useState, useCallback, useEffect } from "react";
import API from "../../../services/api";
import { isValidSovosGbIdentifier } from "../constants";

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
        if (!providers.length) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        const sanitized = providers.map((p) => {
            const clean = { ...p };
            delete clean.password;
            delete clean.apiSecret;
            delete clean.clientSecret;
            delete clean.customerPassword;
            delete clean.wsPassword;
            delete clean.fields;
            delete clean.environments;
            return clean;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
        /* ignore */
    }
};

const buildQnbProvider = (qnb) => ({
    id: "qnb-esolutions",
    name: "QNB eSolutions",
    logo: "🏦",
    color: "#7c3aed",
    authType: "qnb",
    env: qnb.env || "test",
    connectedAt: new Date().toISOString(),
    fromDb: true,
    searchEndpoint: "/api/e-invoice/qnb/documents/search",
});

const buildSovosProvider = (sovos, session = {}) => ({
    id: "sovos",
    name: "Sovos (Foriba)",
    logo: "🌐",
    color: "#10b981",
    authType: "sovos",
    env: sovos.env || session.env || "test",
    connectedAt: new Date().toISOString(),
    apiToken: session.accessToken || session.sessionId,
    sessionId: session.sessionId || session.accessToken,
    vknTckn: session.vknTckn || sovos.vknTckn,
    senderIdentifier: session.senderIdentifier || sovos.senderIdentifier || "",
    receiverIdentifier: session.receiverIdentifier || sovos.receiverIdentifier || "",
    capabilities: session.capabilities || sovos.capabilities || { efatura: false, earsiv: true },
    branch: sovos.branch || "default",
    faturaKodu: sovos.faturaKodu || "LYS",
    fromDb: true,
    searchEndpoint: "/api/e-invoice/sovos/documents/search",
});

const useProviders = () => {
    const [connectedProviders, setConnectedProviders] = useState(loadProviders);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState("");

    /**
     * DB'deki provider alanına göre bağlı sağlayıcıyı yükle.
     * localStorage önbellektir; DB ile çelişirse DB kazanır.
     */
    const hydrateFromDb = useCallback(async () => {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) {
            setConnectedProviders([]);
            saveProviders([]);
            return;
        }

        try {
            const res = await API.get("/auto-invoice/config");
            if (!res.data.success) return;
            const cfg = res.data.data;
            if (!cfg) return;

            const activeProvider = cfg.provider || "qnb";
            const qnb = cfg.qnbCredentials || {};
            const sovos = cfg.sovosCredentials || {};
            const hasQnb = !!(qnb.earsivUsername || qnb.efaturaUsername || qnb.username);
            const hasSovos = !!(sovos.username && sovos.password && sovos.vknTckn);

            if (activeProvider === "sovos" && hasSovos) {
                const dbProvider = buildSovosProvider(sovos, {});
                try {
                    const restoreRes = await API.post("/e-invoice/sovos/session/restore");
                    if (restoreRes.data?.success) {
                        const session = restoreRes.data.data || {};
                        const withSession = buildSovosProvider(sovos, session);
                        setConnectedProviders([withSession]);
                        saveProviders([withSession]);
                        return;
                    }
                } catch {
                    /* lazy restore */
                }
                setConnectedProviders([dbProvider]);
                saveProviders([dbProvider]);
                return;
            }

            if (activeProvider !== "sovos" && hasQnb) {
                const dbProvider = buildQnbProvider(qnb);
                setConnectedProviders([dbProvider]);
                saveProviders([dbProvider]);
                return;
            }

            setConnectedProviders([]);
            saveProviders([]);
        } catch {
            /* abonelik / ağ — localStorage önbelleği korunur */
        }
    }, []);

    useEffect(() => {
        hydrateFromDb();
    }, [hydrateFromDb]);

    const isConnected = connectedProviders.length > 0;
    const activeProvider = connectedProviders.length > 0 ? connectedProviders[0] : null;

    /**
     * Sağlayıcıya bağlan
     */
    const connect = useCallback(async (provider, formData, env) => {
        if (!provider) return false;
        setConnecting(true);
        setConnectionError("");

        const normalizedForm = { ...formData };
        if (provider.authType === "sovos" && normalizedForm.vknTckn) {
            normalizedForm.vknTckn = String(normalizedForm.vknTckn).replace(/\D/g, "");
        }

        const missing = (provider.fields || []).filter(
            (f) => f.required && !normalizedForm[f.key]
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

            if (authType === "qnb") {
                let loginResult = await API.post("/e-invoice/qnb/login", {
                    username: normalizedForm.username,
                    password: normalizedForm.password,
                    env: env,
                    service: "earsiv",
                }).catch(() => ({ data: { success: false } }));

                let loginData = loginResult.data;

                if (!loginData.success) {
                    loginResult = await API.post("/e-invoice/qnb/login", {
                        username: normalizedForm.username,
                        password: normalizedForm.password,
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
            } else if (authType === "trendyol") {
                const partnerResult = await API.post("/e-invoice/trendyol/partner-login", {
                    username: normalizedForm.username,
                    password: normalizedForm.password,
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

                const customerResult = await API.post("/e-invoice/trendyol/customer-login", {
                    partnerToken: partnerToken,
                    customerUsername: normalizedForm.customerUsername,
                    customerPassword: normalizedForm.customerPassword,
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
            } else if (authType === "sovos") {
                const loginResult = await API.post("/e-invoice/sovos/login", {
                    username: normalizedForm.username,
                    password: normalizedForm.password,
                    vknTckn: normalizedForm.vknTckn,
                    senderIdentifier: normalizedForm.senderIdentifier?.trim() || "",
                    receiverIdentifier: normalizedForm.receiverIdentifier?.trim() || "",
                    branch: normalizedForm.branch?.trim() || "default",
                    faturaKodu: normalizedForm.faturaKodu?.trim() || "",
                    env: env,
                    loginMode: isValidSovosGbIdentifier(normalizedForm.senderIdentifier) ? "auto" : "earsiv",
                }).catch(() => ({ data: { success: false } }));

                const loginData = loginResult.data;
                if (!loginData.success) {
                    setConnectionError(
                        "Sovos bağlantısı başarısız: " + (loginData.message || "Bilinmeyen hata")
                    );
                    setConnecting(false);
                    return false;
                }

                const session = loginData.data || {};
                newProvider = {
                    id: provider.id,
                    name: provider.name,
                    logo: provider.logo,
                    color: provider.color,
                    authType: "sovos",
                    env: env,
                    connectedAt: new Date().toISOString(),
                    apiToken: session.accessToken || session.sessionId,
                    sessionId: session.sessionId || session.accessToken,
                    vknTckn: session.vknTckn,
                    senderIdentifier: session.senderIdentifier || normalizedForm.senderIdentifier?.trim() || "",
                    receiverIdentifier: normalizedForm.receiverIdentifier?.trim() || "",
                    capabilities: session.capabilities,
                    verifiedVia: session.verifiedVia,
                    branch: normalizedForm.branch || "default",
                    faturaKodu: (normalizedForm.faturaKodu || "LYS").slice(0, 3).toUpperCase(),
                    searchEndpoint: provider.searchEndpoint,
                };
            } else if (authType === "parasut") {
                const tokenResult = await API.post("/e-invoice/parasut/token", {
                    clientId: normalizedForm.clientId,
                    clientSecret: normalizedForm.clientSecret,
                    email: normalizedForm.email,
                    password: normalizedForm.password,
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
            } else if (authType === "odeal") {
                const validateResult = await API.post("/e-invoice/odeal/validate-key", {
                    serviceKey: normalizedForm.serviceKey,
                    merchantKey: normalizedForm.merchantKey || null,
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
                    apiToken: normalizedForm.serviceKey,
                    serviceKey: normalizedForm.serviceKey,
                    merchantKey: normalizedForm.merchantKey || null,
                    searchEndpoint: provider.searchEndpoint,
                };
            }

            if (!newProvider) {
                setConnectionError("Bilinmeyen sağlayıcı tipi");
                setConnecting(false);
                return false;
            }

            const updated = [newProvider];
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
    }, []);

    /**
     * Sağlayıcı bağlantısını kes — DB credential'larını da temizler
     */
    const disconnect = useCallback(async (providerId) => {
        const target = connectedProviders.find((p) => p.id === providerId);

        try {
            await API.post("/auto-invoice/disconnect-provider", {
                providerId,
                sessionId: target?.sessionId,
            });
        } catch {
            /* DB temizlenemese bile yerel durumu sıfırla */
        }

        if (target?.sessionId && target.authType === "sovos") {
            API.post("/e-invoice/sovos/logout", { sessionId: target.sessionId }).catch(() => {});
        }

        setConnectedProviders([]);
        saveProviders([]);
    }, [connectedProviders]);

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
        hydrateFromDb,
    };
};

export default useProviders;
