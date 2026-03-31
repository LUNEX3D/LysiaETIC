import axios from "axios";

// Axios instance oluştur
const API = axios.create({
    baseURL: (process.env.REACT_APP_API_URL || "http://13.51.158.124:5000") + "/api", // Backend URL'si
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
// ✅ FIX #15: /login → /auth/login olarak düzeltildi
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
// ✅ FIX #15: /register → /auth/register olarak düzeltildi
export const registerUser = async (userData) => {
    try {
        const response = await API.post("/auth/register", userData);
        return response.data;
    } catch (error) {
        console.error("Kayıt olunurken hata oluştu:", error);
        throw error;
    }
};

// Diğer API fonksiyonları buraya eklenebilir...

export default API;
