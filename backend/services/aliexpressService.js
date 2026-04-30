const axios = require("axios");
const crypto = require("crypto");
const logger = require("../config/logger");

/**
 * 🛒 ALIEXPRESS OPEN PLATFORM SERVİSİ (Global Pazaryeri)
 * Dokümantasyon: https://open.aliexpress.com/
 */
class AliexpressService {
    constructor(authConfig) {
        this.apiBase = "https://gw.api.alibaba.com/openapi/param2/1/aliexpress.open";
        this.authConfig = authConfig; // { appKey, appSecret, accessToken }
    }

    /**
     * AliExpress API İmzası Oluştur (HMAC-SHA256)
     */
    generateSignature(path, params) {
        const sortedKeys = Object.keys(params).sort();
        let signStr = path;
        for (const key of sortedKeys) {
            signStr += key + params[key];
        }
        return crypto
            .createHmac("sha256", this.authConfig.appSecret)
            .update(signStr)
            .digest("hex")
            .toUpperCase();
    }

    /**
     * Sipariş listesini getir
     */
    async getOrders(page = 1) {
        const path = "aliexpress.solution.order.get";
        const params = {
            app_key: this.authConfig.appKey,
            session: this.authConfig.accessToken,
            timestamp: new Date().getTime(),
            param0: JSON.stringify({
                page_size: 20,
                current_page: page,
                order_status_list: ["WAIT_SELLER_SEND_GOODS"]
            })
        };
        params.sign = this.generateSignature(path, params);

        try {
            const response = await axios.post(`${this.apiBase}/${path}/${this.authConfig.appKey}`, null, { params });
            return response.data;
        } catch (error) {
            logger.error("[AliExpress] Sipariş listesi alma hatası", { error: error.message });
            throw error;
        }
    }

    /**
     * Stok güncelle
     */
    async updateStock(productId, skuId, quantity) {
        const path = "aliexpress.solution.batch.product.inventory.update";
        const params = {
            app_key: this.authConfig.appKey,
            session: this.authConfig.accessToken,
            timestamp: new Date().getTime(),
            param0: JSON.stringify({
                product_id: productId,
                multiple_sku_update_list: [{
                    sku_code: skuId,
                    inventory: quantity
                }]
            })
        };
        params.sign = this.generateSignature(path, params);

        try {
            const response = await axios.post(`${this.apiBase}/${path}/${this.authConfig.appKey}`, null, { params });
            return response.data;
        } catch (error) {
            logger.error("[AliExpress] Stok güncelleme hatası", { productId, error: error.message });
            throw error;
        }
    }
}

module.exports = AliexpressService;
