import axios from "axios";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000") + "/api"; // Backend API'nizin temel URL'si

// Kullanıcının entegre ettiği pazar yerlerini çekme
export const getUserMarketplaces = async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/marketplace/user-marketplaces`, {
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
export const fetchDashboardData = async () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/dashboard`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (response.status === 200) {
            // Backend ok() helper'ı { success, message, data: {...} } formatında döndürür
            // Gerçek dashboard verisi response.data.data içinde
            const body = response.data;
            if (body && body.data) return body.data;
            // Eski format veya doğrudan veri döndüren endpoint için fallback
            return body;
        } else {
            throw new Error("Genel bakış verileri yüklenirken hata oluştu.");
        }
    } catch (error) {
        console.error("Genel bakış verileri yüklenirken hata oluştu:", error);
        throw error;
    }
};

// Diğer API çağrıları için örnek fonksiyonlar
export const fetchOrders = async (marketplaceId) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/orders/all${marketplaceId ? `?marketplace=${marketplaceId}` : ''}`, {
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

export const fetchInventory = async (marketplaceId) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (!token) {
        console.error("❌ Token eksik!");
        return { message: "❌ Yetkisiz erişim, token eksik!" };
    }

    try {
        const response = await axios.get(`${BASE_URL}/inventory/all${marketplaceId ? `?marketplace=${marketplaceId}` : ''}`, {
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