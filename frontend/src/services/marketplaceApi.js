import API from "./api"; // ✅ Interceptor'lı API instance'ı kullan

// Kullanıcının entegre ettiği pazar yerlerini çekme
export const getUserMarketplaces = async () => {
    try {
        // ✅ API instance kullan — interceptor'lardan geçer
        const response = await API.get("/marketplace/user-marketplaces");

        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error("Pazar yerleri yüklenirken hata oluştu.");
        }
    } catch (error) {
        console.error("Pazar yerleri yüklenirken hata oluştu:", error);

        // ✅ 403 + subscriptionExpired kontrolü
        if (error.response?.status === 403 && error.response?.data?.subscriptionExpired) {
            const customError = new Error(error.response.data.message || "Abonelik süreniz dolmuştur.");
            customError.subscriptionExpired = true;
            customError.response = error.response;
            throw customError;
        }

        throw error;
    }
};

// Genel bakış verilerini çekme
/** Ana sayfa siparişler kartı — canlı pazaryeri statüleri */
export const fetchOrdersCard = async () => {
    const response = await API.get("/dashboard/orders-card");
    if (response.status === 200) {
        const body = response.data;
        return body?.data || body;
    }
    throw new Error("Sipariş kartı yüklenemedi.");
};

/** Ana sayfa — pazaryerlerinden son günlerin siparişlerini DB'ye çeker (arka plan) */
export const syncRecentOrders = async ({ days } = {}) => {
    const response = await API.get("/orders/sync-recent", {
        params: { parallel: "1", ...(days ? { days } : {}) },
        timeout: 90000,
    });
    if (response.status === 200) {
        return response.data;
    }
    throw new Error("Sipariş senkronizasyonu başarısız.");
};

export const fetchDashboardData = async ({ refresh = false } = {}) => {
    try {
        const response = await API.get("/dashboard", {
            params: refresh ? { refresh: "true" } : undefined,
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

        // ✅ 403 + subscriptionExpired kontrolü
        if (error.response?.status === 403 && error.response?.data?.subscriptionExpired) {
            const customError = new Error(error.response.data.message || "Abonelik süreniz dolmuştur.");
            customError.subscriptionExpired = true;
            customError.response = error.response;
            throw customError;
        }

        throw error;
    }
};

// Diğer API çağrıları için örnek fonksiyonlar
export const fetchOrders = async (marketplaceId) => {
    try {
        const response = await API.get(`/orders/all${marketplaceId ? `?marketplace=${marketplaceId}` : ''}`);

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

/** Kargo etiketi — tüm pazaryerleri (A4 / PDF / ZPL) */
export const fetchShippingLabel = async (params = {}) => {
    const clean = {};
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            clean[k] = v;
        }
    });
    try {
        const response = await API.get("/orders/shipping-label", { params: clean, timeout: 90000 });
        if (response.status === 200 && response.data?.success) {
            return response.data.data;
        }
        throw new Error(response.data?.message || "Kargo etiketi alınamadı.");
    } catch (error) {
        const data = error.response?.data;
        let msg = "Kargo etiketi alınamadı.";
        if (typeof data === "string" && data.trim()) msg = data.trim();
        else if (data?.message) msg = data.message;
        else if (error.message && !/^Request failed with status code \d+$/i.test(error.message)) {
            msg = error.message;
        }
        throw new Error(msg);
    }
};

export const fetchInventory = async (marketplaceId) => {
    try {
        const response = await API.get(`/inventory/all${marketplaceId ? `?marketplace=${marketplaceId}` : ''}`);

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