import api from "./api";

/**
 * GELİŞMİŞ ÜRÜN YÖNETİMİ API SERVİSİ
 */

// Tüm pazaryerlerinden ürünleri çek (asenkron)
export const pullAllProducts = async (marketplaceIds) => {
    const response = await api.post("/advanced-products/pull-all", { marketplaceIds });
    return response.data;
};

// Tek bir pazaryerinden ürünleri çek
export const pullProductsFromMarketplace = async (marketplaceId, marketplaceName) => {
    const response = await api.post("/advanced-products/pull", { marketplaceId, marketplaceName });
    return response.data;
};

// Kategorileri çek
export const pullCategories = async (marketplaceId, marketplaceName) => {
    const response = await api.post("/advanced-products/pull-categories", { marketplaceId, marketplaceName });
    return response.data;
};

// İşlem durumunu sorgula
export const getJobStatus = async (jobId) => {
    const response = await api.get(`/advanced-products/job/${jobId}`);
    return response.data;
};

// Aktif işlemleri listele
export const getActiveJobs = async () => {
    const response = await api.get("/advanced-products/jobs/active");
    return response.data;
};

// Tamamlanan işlemleri listele
export const getCompletedJobs = async (limit = 10) => {
    const response = await api.get(`/advanced-products/jobs/completed?limit=${limit}`);
    return response.data;
};

// Pazaryerlerini karşılaştır
export const compareMarketplaces = async () => {
    const response = await api.get("/advanced-products/compare");
    return response.data;
};

// Kullanıcının ürünlerini listele
export const getUserProducts = async (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/advanced-products/products?${queryParams}`);
    return response.data;
};

// Ürün detayını getir
export const getProductDetail = async (productId) => {
    const response = await api.get(`/advanced-products/products/${productId}`);
    return response.data;
};

// Kullanıcının kategorilerini listele
export const getUserCategories = async (marketplaceName) => {
    const queryParams = marketplaceName ? `?marketplaceName=${marketplaceName}` : "";
    const response = await api.get(`/advanced-products/categories${queryParams}`);
    return response.data;
};

// Kategori detayını getir
export const getCategoryDetail = async (categoryId, marketplaceName) => {
    const queryParams = marketplaceName ? `?marketplaceName=${marketplaceName}` : "";
    const response = await api.get(`/advanced-products/categories/${categoryId}${queryParams}`);
    return response.data;
};

// Dashboard verileri
export const getDashboardData = async () => {
    const response = await api.get("/advanced-products/dashboard");
    return response.data;
};

// Job durumunu polling ile izle
export const pollJobStatus = async (jobId, onUpdate, interval = 2000) => {
    let completed = false;

    const poll = async () => {
        if (completed) return;

        try {
            const result = await getJobStatus(jobId);
            onUpdate(result.job);

            if (result.job.status === "completed" || result.job.status === "failed") {
                completed = true;
            }
        } catch (error) {
            console.error("Job polling hatası:", error);
            completed = true;
        }
    };

    // İlk kontrol
    await poll();

    // Devam eden işlemler için polling
    if (!completed) {
        const intervalId = setInterval(poll, interval);

        // Cleanup fonksiyonu
        return () => {
            completed = true;
            clearInterval(intervalId);
        };
    }

    return () => {};
};
