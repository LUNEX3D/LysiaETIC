import axios from "axios";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://13.51.158.124:5000") + "/api"; // Backend API'nizin temel URL'si

// Kullanıcının entegre ettiği pazar yerlerini çekme
export const getUserMarketplaces = async (userId) => {
    const token = localStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/marketplace/user-marketplaces/${userId}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error("Pazar yerleri yüklenirken hata oluştu.");
        }
    } catch (error) {
        console.error("Pazar yerleri yüklenirken hata oluştu:", error);
        throw error;
    }
};

// Genel bakış verilerini çekme
export const fetchDashboardData = async (userId) => {
    const token = localStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/dashboard/${userId}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error("Genel bakış verileri yüklenirken hata oluştu.");
        }
    } catch (error) {
        console.error("Genel bakış verileri yüklenirken hata oluştu:", error);
        throw error;
    }
};

// Diğer API çağrıları için örnek fonksiyonlar
export const fetchOrders = async (userId, marketplaceId) => {
    const token = localStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/orders/${userId}/${marketplaceId}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error("Siparişler yüklenirken hata oluştu.");
        }
    } catch (error) {
        console.error("Siparişler yüklenirken hata oluştu:", error);
        throw error;
    }
};

export const fetchInventory = async (userId, marketplaceId) => {
    const token = localStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/inventory/${userId}/${marketplaceId}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error("Stok bilgileri yüklenirken hata oluştu.");
        }
    } catch (error) {
        console.error("Stok bilgileri yüklenirken hata oluştu:", error);
        throw error;
    }
};