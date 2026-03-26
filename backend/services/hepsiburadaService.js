const axios = require("axios");
const moment = require("moment");
const logger = require("../config/logger");

// ═══════════════════════════════════════════════════════════════════════
// 🏪 HEPSİBURADA API SERVİSİ
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ ÖNEMLİ: Production endpoint'leri kullanılmalı (mpop-sit DEĞİL!)
const HEPSIBURADA_BASE_URL = "https://listing-external.hepsiburada.com";
const HEPSIBURADA_MPOP_URL = "https://mpop.hepsiburada.com"; // Production MPOP endpoint

/**
 * Auth Header Oluştur
 * Hepsiburada Format: Basic base64(merchantId:serviceKey)
 * @param {string} merchantId - Mağaza ID
 * @param {string} serviceKey - Servis Anahtarı (API Key)
 */
const getAuthHeader = (merchantId, serviceKey) => {
    const credentials = `${merchantId}:${serviceKey}`;
    const encodedCredentials = Buffer.from(credentials, "utf-8").toString("base64").trim();
    return `Basic ${encodedCredentials}`;
};

/**
 * Hepsiburada Ürün Listesi Çek
 * @param {string} merchantId - Mağaza ID
 * @param {string} serviceKey - Servis Anahtarı (API Key)
 */
const fetchHepsiburadaProducts = async (merchantId, serviceKey) => {
    try {
        const headers = {
            "Authorization": getAuthHeader(merchantId, serviceKey),
            "User-Agent": "LysiaETIC",
            "Content-Type": "application/json"
        };

        const url = `${HEPSIBURADA_BASE_URL}/listings/merchantid/${merchantId}?offset=0&limit=2000`;

        const response = await axios.get(url, { headers });

        if (response.status === 200) {
            const products = response.data?.listings || [];

            return products.map(product => ({
                sku: product.merchantSku,
                productName: product.productName || product.hbSku,
                price: product.price || 0,
                stock: product.availableStock || 0,
                status: product.isSalable ? 'active' : 'inactive'
            }));
        } else {
            logger.warn("Hepsiburada API unexpected status", { status: response.status });
            return [];
        }
    } catch (error) {
        logger.error("Hepsiburada products error", { error: error.message });
        return [];
    }
};

/**
 * Hepsiburada Sipariş Listesi Çek (Marketplace Orders API)
 * ⚠️ ÖNEMLİ: ordersService.js'deki fetchHepsiburadaOrders ile aynı
 * Bu fonksiyon sadece geriye dönük uyumluluk için tutulmuştur
 * @param {string} merchantId - Mağaza ID (Username olarak kullanılır)
 * @param {string} serviceKey - Servis Anahtarı (Password olarak kullanılır)
 * @param {Date} startDate - Başlangıç tarihi
 * @param {Date} endDate - Bitiş tarihi
 */
const fetchHepsiburadaOrders = async (merchantId, serviceKey, startDate, endDate) => {
    // ordersService.js'deki aynı fonksiyonu kullan
    const { fetchHepsiburadaOrders: fetchOrders } = require("./ordersService");
    return await fetchOrders(merchantId, serviceKey, startDate, endDate);
};

/**
 * Hepsiburada Stok Güncelle
 * @param {string} merchantId - Mağaza ID
 * @param {string} serviceKey - Servis Anahtarı (API Key)
 * @param {string} sku - Ürün SKU
 * @param {number} stock - Stok miktarı
 */
const updateHepsiburadaStock = async (merchantId, serviceKey, sku, stock) => {
    try {
        const headers = {
            "Authorization": getAuthHeader(merchantId, serviceKey),
            "User-Agent": "LysiaETIC",
            "Content-Type": "application/json"
        };

        const url = `${HEPSIBURADA_BASE_URL}/product/api/products/merchantid/${merchantId}/sku/${sku}/price-and-stock`;

        const payload = {
            availableStock: stock
        };

        const response = await axios.put(url, payload, { headers });

        if (response.status === 200) {
            return true;
        } else {
            logger.warn("Hepsiburada stock update unexpected status", { status: response.status });
            return false;
        }
    } catch (error) {
        logger.error("Hepsiburada stock update error", { error: error.message });
        return false;
    }
};

/**
 * Hepsiburada Fiyat Güncelle
 * @param {string} merchantId - Mağaza ID
 * @param {string} serviceKey - Servis Anahtarı (API Key)
 * @param {string} sku - Ürün SKU
 * @param {number} price - Fiyat
 */
const updateHepsiburadaPrice = async (merchantId, serviceKey, sku, price) => {
    try {
        const headers = {
            "Authorization": getAuthHeader(merchantId, serviceKey),
            "User-Agent": "LysiaETIC",
            "Content-Type": "application/json"
        };

        const url = `${HEPSIBURADA_BASE_URL}/product/api/products/merchantid/${merchantId}/sku/${sku}/price-and-stock`;

        const payload = {
            price: price
        };

        const response = await axios.put(url, payload, { headers });

        if (response.status === 200) {
            return true;
        } else {
            logger.warn("Hepsiburada price update unexpected status", { status: response.status });
            return false;
        }
    } catch (error) {
        logger.error("Hepsiburada price update error", { error: error.message });
        return false;
    }
};

module.exports = {
    fetchHepsiburadaProducts,
    fetchHepsiburadaOrders,
    updateHepsiburadaStock,
    updateHepsiburadaPrice
};
