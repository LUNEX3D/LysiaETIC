const axios = require("axios");
const logger = require("../config/logger");

/**
 * 🛒 NOON API SERVİSİ (Orta Doğu Pazaryeri)
 * Dokümantasyon: https://noon-api-docs.readme.io/
 */
class NoonService {
    constructor(authConfig) {
        this.apiBase = authConfig.env === "prod" 
            ? "https://api.noon.com/v1" 
            : "https://api-test.noon.com/v1";
        this.authConfig = authConfig; // { appId, appKey, sellerId, env }
    }

    getHeaders() {
        return {
            "Content-Type": "application/json",
            "x-noon-app-id": this.authConfig.appId,
            "x-noon-app-key": this.authConfig.appKey,
            "Authorization": `Basic ${Buffer.from(`${this.authConfig.sellerId}:`).toString("base64")}`
        };
    }

    /**
     * Bekleyen siparişleri çek
     */
    async getOrders(page = 0) {
        try {
            const response = await axios.get(`${this.apiBase}/order?status=PENDING&page=${page}`, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            logger.error("[Noon] Sipariş çekme hatası", { error: error.message });
            throw error;
        }
    }

    /**
     * Stok güncelle (Price & Stock Update)
     */
    async updateStock(sku, quantity) {
        try {
            const response = await axios.post(`${this.apiBase}/seller/product/offer`, {
                offers: [{
                    sku: sku,
                    active: quantity > 0,
                    stock: quantity
                }]
            }, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            logger.error("[Noon] Stok güncelleme hatası", { sku, error: error.message });
            throw error;
        }
    }

    /**
     * Sipariş detaylarını getir
     */
    async getOrderDetails(orderId) {
        try {
            const response = await axios.get(`${this.apiBase}/order/${orderId}`, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            logger.error("[Noon] Sipariş detay hatası", { orderId, error: error.message });
            throw error;
        }
    }
}

module.exports = NoonService;
