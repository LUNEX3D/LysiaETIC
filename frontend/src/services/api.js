/**
 * API Service — LysiaETIC
 * ✅ FIX #20: 401 interceptor eklendi — token expire olunca login'e yönlendir
 * ✅ FIX #21: baseURL environment'tan alınıyor
 * ✅ SEC #2: Refresh token rotation desteği — yeni refresh token da kaydedilir
 * ✅ SEC #3: clearSession helper + logout API çağrısı
 */
import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Axios instance oluştur
const API = axios.create({
    baseURL: BASE_URL + "/api",
    timeout: 120000, // 2 dakika — toplu dağıtım ve karşılaştırma uzun sürebilir
});

// ─── Oturum temizleme helper'ı ─────────────────────────────────────────────────
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
