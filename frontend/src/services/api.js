/**
 * API Service — LysiaETIC
 * ✅ FIX #20: 401 interceptor eklendi — token expire olunca login'e yönlendir
 * ✅ FIX #21: baseURL environment'tan alınıyor
 * ✅ SEC #2: Refresh token rotation desteği — yeni refresh token da kaydedilir
 * ✅ SEC #3: clearSession helper + logout API çağrısı
 * ✅ v2: 429 Rate Limit otomatik retry (exponential backoff) + toast bildirimi
 */
import axios from "axios";
import { pushClientError } from "./clientErrorStore";

// ✅ Production'da REACT_APP_API_URL boş string = Nginx reverse proxy (/api)
// Development'ta REACT_APP_API_URL=http://localhost:5000
// LAN: Sayfa http://192.168.x.x:3000 ile açıldıysa ve env hâlâ localhost:5000 ise,
//      istekleri aynı makinenin LAN IP'sine yönlendir (telefon/test için).
function resolveApiBase() {
    // Production'da relative path (/api) kullanımı için boş string dön
    if (process.env.NODE_ENV === "production") {
        return "";
    }

    const defaultLocal = "http://localhost:5000";
    const fromEnv = process.env.REACT_APP_API_URL;
    const envVal = fromEnv !== undefined && fromEnv !== null && fromEnv !== ""
        ? fromEnv
        : defaultLocal;

    if (typeof window === "undefined") return envVal;

    const h = window.location.hostname;
    const onPrivateLan =
        /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/i.test(h);

    if (process.env.NODE_ENV !== "development" || !onPrivateLan) return envVal;

    try {
        const apiUrl = new URL(envVal);
        const apiHost = apiUrl.hostname;
        if (apiHost === "localhost" || apiHost === "127.0.0.1") {
            const port = apiUrl.port || "5000";
            return `${apiUrl.protocol}//${h}:${port}`;
        }
    } catch {
        /* env geçersiz URL — olduğu gibi kullan */
    }
    return envVal;
}

const BASE_URL = resolveApiBase();

// ─── 429 Rate Limit Event — UI bildirim sistemi ────────────────────────────────
// Herhangi bir component dinleyebilir: window.addEventListener("api:rate-limited", handler)
const emitRateLimited = (retryAfter, attempt) => {
    window.dispatchEvent(new CustomEvent("api:rate-limited", {
        detail: { retryAfter, attempt, timestamp: Date.now() }
    }));
};

// Axios instance oluştur
const API = axios.create({
    baseURL: BASE_URL + "/api",
    timeout: 120000, // 2 dakika — toplu dağıtım ve karşılaştırma uzun sürebilir
});

// ─── Oturum temizleme helper'ı ─────────────────────────────────────────────────
// ✅ FIX: legalAccepted, legalAcceptedAt, themeMode gibi tüm oturum verileri temizleniyor
// KVKK/GDPR uyumluluğu — farklı kullanıcı aynı tarayıcıda giriş yaparsa eski onay geçerli sayılmaz
const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    localStorage.removeItem("adminLoginTime");
    localStorage.removeItem("legalAccepted");
    localStorage.removeItem("legalAcceptedAt");
};

// ✅ FIX H7: rememberMe — hem localStorage hem sessionStorage'dan token oku
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 🛡️ SEC #2: Response interceptor — 401 gelirse refresh token rotation ile yenile
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const statusCode = error.response?.status || 0;
        const requestPath = originalRequest?.url || "";
        const userMessage = error.response?.data?.message || error.message || "Bilinmeyen hata";

        const skipErrorLog =
            requestPath.includes("/auth/refresh-token") ||
            requestPath.includes("/client-errors");

        if (!skipErrorLog) {
            let source = "api";
            const p = String(requestPath || "");
            if (p.includes("product-management") || p.includes("marketplace")) {
                source = "marketplace";
            }
            pushClientError({
                source,
                statusCode,
                path: requestPath,
                method: String(originalRequest?.method || "get").toUpperCase(),
                message: userMessage,
            });
        }

        // ─── 429 Rate Limit — Otomatik Retry (exponential backoff) ──────────
        if (error.response?.status === 429) {
            const attempt = (originalRequest._retryCount || 0) + 1;
            const MAX_RETRIES = 3;

            if (attempt <= MAX_RETRIES) {
                originalRequest._retryCount = attempt;

                // Retry-After header'ından veya response body'den bekleme süresi al
                const retryAfterHeader = error.response.headers?.["retry-after"];
                const retryAfterBody = error.response.data?.retryAfter;
                const retryAfterSec = parseInt(retryAfterHeader || retryAfterBody, 10) || 0;

                // Exponential backoff: 2s, 4s, 8s — ama Retry-After varsa onu kullan
                const backoffMs = retryAfterSec > 0
                    ? Math.min(retryAfterSec * 1000, 30000)
                    : Math.min(2000 * Math.pow(2, attempt - 1), 15000);

                // UI'a bildir (toast göstermek için)
                emitRateLimited(Math.ceil(backoffMs / 1000), attempt);

                // Bekle ve tekrar dene
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return API(originalRequest);
            }

            // Max retry aşıldı — hatayı fırlat ama mesajı güzelleştir
            const friendlyError = new Error("Sunucu yoğun. Lütfen birkaç saniye bekleyip tekrar deneyin.");
            friendlyError.response = error.response;
            friendlyError.isRateLimited = true;
            return Promise.reject(friendlyError);
        }

        // ─── 403 Subscription Expired — Abonelik süresi dolmuş ─────────────
        if (error.response?.status === 403 && error.response?.data?.subscriptionExpired) {
            // subscriptionExpired flag'ini error'a ekle — UI bunu yakalayıp özel mesaj gösterir
            error.subscriptionExpired = true;
            // Global event fırlat — herhangi bir component dinleyebilir
            window.dispatchEvent(new CustomEvent("api:subscription-expired", {
                detail: {
                    message: error.response.data.message,
                    plan: error.response.data.plan,
                    timestamp: Date.now()
                }
            }));
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            const currentPath = window.location.pathname;
            // Login sayfasındayken sonsuz döngü olmasın
            if (currentPath === "/login" || currentPath === "/register" || currentPath === "/") {
                return Promise.reject(error);
            }

            // Refresh token ile yenilemeyi dene
            const refreshToken = localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");

            if (refreshToken) {
                if (isRefreshing) {
                    // Zaten yenileniyor — kuyruğa ekle
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then(token => {
                        originalRequest.headers["Authorization"] = `Bearer ${token}`;
                        return API(originalRequest);
                    }).catch(err => Promise.reject(err));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const { data } = await axios.post(
                        BASE_URL + "/api/auth/refresh-token",
                        { refreshToken }
                    );

                    const newToken = data.token;
                    const newRefreshToken = data.refreshToken;

                    // ✅ SEC #2: Token rotation — yeni access + refresh token'ı kaydet
                    if (localStorage.getItem("token")) {
                        localStorage.setItem("token", newToken);
                        if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);
                    } else {
                        sessionStorage.setItem("token", newToken);
                        if (newRefreshToken) sessionStorage.setItem("refreshToken", newRefreshToken);
                    }

                    processQueue(null, newToken);
                    originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                    return API(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    // Refresh de başarısız — oturumu temizle
                    clearSession();
                    window.location.href = "/login";
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Refresh token yok — direkt login'e yönlendir
                clearSession();
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

// ─── API Helper Fonksiyonları ──────────────────────────────────────────────────

// Kategorileri çekmek için fonksiyon
export const getCategories = async () => {
    try {
        const response = await API.get("/categories");
        return response.data.categories;
    } catch {
        return [];
    }
};

// Ürün yükleme fonksiyonu
export const uploadProduct = async (productData) => {
    try {
        const response = await API.post("/products", productData);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Kullanıcı girişi fonksiyonu
export const loginUser = async (credentials) => {
    try {
        const response = await API.post("/auth/login", credentials);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Kullanıcı kaydı fonksiyonu
export const registerUser = async (userData) => {
    try {
        const response = await API.post("/auth/register", userData);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// ✅ SEC #2: Logout — backend'e refresh token revoke isteği gönder + oturumu temizle
export const logoutUser = async () => {
    try {
        const refreshToken = localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");
        if (refreshToken) {
            await API.post("/auth/logout", { refreshToken }).catch(() => {});
        }
    } finally {
        clearSession();
    }
};

export { clearSession };
export default API;
