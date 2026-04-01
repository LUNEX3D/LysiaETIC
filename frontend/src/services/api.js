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

// 🔒 Her istekte Authorization header'ını otomatik ekle
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ✅ FIX #20: Response interceptor — 401 gelirse oturumu temizle ve login'e yönlendir
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token geçersiz veya süresi dolmuş
            const currentPath = window.location.pathname;
            // Login sayfasındayken sonsuz döngü olmasın
            if (currentPath !== "/login" && currentPath !== "/register" && currentPath !== "/") {
                localStorage.removeItem("token");
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
    } catch (error) {
        console.error("Kategoriler yüklenirken hata oluştu:", error);
        return [];
    }
};

// Ürün yükleme fonksiyonu
export const uploadProduct = async (productData) => {
    try {
        const response = await API.post("/products", productData);
        return response.data;
    } catch (error) {
        console.error("Ürün yüklenirken hata oluştu:", error);
        throw error;
    }
};

// Kullanıcı girişi fonksiyonu
export const loginUser = async (credentials) => {
    try {
        const response = await API.post("/auth/login", credentials);
        return response.data;
    } catch (error) {
        console.error("Giriş yapılırken hata oluştu:", error);
        throw error;
    }
};

// Kullanıcı kaydı fonksiyonu
export const registerUser = async (userData) => {
    try {
        const response = await API.post("/auth/register", userData);
        return response.data;
    } catch (error) {
        console.error("Kayıt olunurken hata oluştu:", error);
        throw error;
    }
};

export default API;
