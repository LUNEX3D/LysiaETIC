/**
 * API Service — LysiaETIC
 * ✅ FIX #20: 401 interceptor eklendi — token expire olunca login'e yönlendir
 * ✅ FIX #21: baseURL environment'tan alınıyor
 */
import axios from "axios";

// Axios instance oluştur
const API = axios.create({
    baseURL: (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api",
    timeout: 120000, // 2 dakika — toplu dağıtım ve karşılaştırma uzun sürebilir
});

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

// 🛡️ FIX #12: Response interceptor — 401 gelirse refresh token ile yenile, başarısızsa login'e yönlendir
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
                        (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api/auth/refresh-token",
                        { refreshToken }
                    );

                    const newToken = data.token;
                    // Token'ı kaydet (hangi storage kullanılıyorsa oraya)
                    if (localStorage.getItem("token")) {
                        localStorage.setItem("token", newToken);
                    } else {
                        sessionStorage.setItem("token", newToken);
                    }

                    processQueue(null, newToken);
                    originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                    return API(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    // Refresh de başarısız — oturumu temizle
                    localStorage.removeItem("token");
                    localStorage.removeItem("refreshToken");
                    sessionStorage.removeItem("token");
                    sessionStorage.removeItem("refreshToken");
                    localStorage.removeItem("userId");
                    localStorage.removeItem("userEmail");
                    localStorage.removeItem("userName");
                    localStorage.removeItem("userRole");
                    window.location.href = "/login";
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Refresh token yok — direkt login'e yönlendir
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
                localStorage.removeItem("userId");
                localStorage.removeItem("userEmail");
                localStorage.removeItem("userName");
                localStorage.removeItem("userRole");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

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

export default API;
