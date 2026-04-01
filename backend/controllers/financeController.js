const logger = require("../config/logger");
const Marketplace = require("../models/Marketplace");
const axios = require("axios");

// Date formatting and validation helper functions
const formatAndValidateDate = (date) => {
    if (!date) throw new Error("Tarih bilgisi gereklidir");

    // Convert string to number if needed
    if (typeof date === 'string') date = parseInt(date);

    // Convert to Date object
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) throw new Error("Geçersiz tarih formatı");

    return dateObj.getTime();
};

const validateDateRange = (startDate, endDate) => {
    const diff = endDate - startDate;
    const maxDiff = 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds

    if (diff > maxDiff) {
        throw new Error("Tarih aralığı maksimum 15 gün olabilir");
    }

    if (startDate > endDate) {
        throw new Error("Başlangıç tarihi bitiş tarihinden büyük olamaz");
    }
};

// 1. Settlement Records
exports.getTrendyolSettlements = async (req, res) => {
    try {
        const { userId, transactionType, startDate, endDate, page = 0, size = 500, marketplaceId } = req.query;

        // Validation
        if (!userId || !transactionType || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "userId, transactionType, startDate ve endDate zorunlu alanlardır!"
            });
        }

        // Date formatting and validation
        const formattedStart = formatAndValidateDate(startDate);
        const formattedEnd = formatAndValidateDate(endDate);
        validateDateRange(formattedStart, formattedEnd);

        // Get marketplace info - use marketplaceId if provided, otherwise fallback to Trendyol
        let marketplace;
        if (marketplaceId) {
            marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
        } else {
            marketplace = await Marketplace.findOne({ userId, marketplaceName: "Trendyol" });
        }

        if (!marketplace) {
            return res.status(404).json({
                success: false,
                message: "Pazaryeri API bilgileri bulunamadı!"
            });
        }

        const { sellerId, token } = marketplace.credentials;
        if (!sellerId || !token) {
            return res.status(400).json({
                success: false,
                message: "Trendyol sellerId veya token eksik!"
            });
        }

        // Trendyol API request
        const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/settlements`;
        const headers = {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json'
        };
        const params = {
            transactionType,
            startDate: formattedStart,
            endDate: formattedEnd,
            page,
            size
        };

        const { data } = await axios.get(url, { headers, params });

        res.json({
            success: true,
            data
        });

    } catch (err) {
        logger.error("Trendyol settlements hatası:", err.message);

        const status = err.response?.status || 500;
        const message = err.message || "Trendyol settlements çekilirken hata oluştu!";

        res.status(status).json({
            success: false,
            message,
            error: err.message
        });
    }
};

// 2. Other Financial Records
exports.getTrendyolOtherFinancials = async (req, res) => {
    try {
        const { userId, transactionType, startDate, endDate, page = 0, size = 500, marketplaceId } = req.query;

        // Validation
        if (!userId || !transactionType || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "userId, transactionType, startDate ve endDate zorunlu alanlardır!"
            });
        }

        // Date formatting and validation
        const formattedStart = formatAndValidateDate(startDate);
        const formattedEnd = formatAndValidateDate(endDate);
        validateDateRange(formattedStart, formattedEnd);

        // Get marketplace info - use marketplaceId if provided, otherwise fallback to Trendyol
        let marketplace;
        if (marketplaceId) {
            marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
        } else {
            marketplace = await Marketplace.findOne({ userId, marketplaceName: "Trendyol" });
        }

        if (!marketplace) {
            return res.status(404).json({
                success: false,
                message: "Pazaryeri API bilgileri bulunamadı!"
            });
        }

        const { sellerId, token } = marketplace.credentials;
        if (!sellerId || !token) {
            return res.status(400).json({
                success: false,
                message: "Trendyol sellerId veya token eksik!"
            });
        }

        // Trendyol API request
        const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/otherfinancials`;
        const headers = {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json'
        };
        const params = {
            transactionType,
            startDate: formattedStart,
            endDate: formattedEnd,
            page,
            size
        };

        const { data } = await axios.get(url, { headers, params });

        res.json({
            success: true,
            data
        });

    } catch (err) {
        logger.error("Trendyol otherfinancials hatası:", err.message);

        const status = err.response?.status || 500;
        const message = err.message || "Trendyol otherfinancials çekilirken hata oluştu!";

        res.status(status).json({
            success: false,
            message,
            error: err.message
        });
    }
};

// 3. Cargo Invoice Details
exports.getTrendyolCargoInvoiceItems = async (req, res) => {
    try {
        const { userId, invoiceSerialNumber, marketplaceId } = req.query;

        // Validation
        if (!userId || !invoiceSerialNumber) {
            return res.status(400).json({
                success: false,
                message: "userId ve invoiceSerialNumber zorunlu alanlardır!"
            });
        }

        // Get marketplace info - use marketplaceId if provided, otherwise fallback to Trendyol
        let marketplace;
        if (marketplaceId) {
            marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
        } else {
            marketplace = await Marketplace.findOne({ userId, marketplaceName: "Trendyol" });
        }

        if (!marketplace) {
            return res.status(404).json({
                success: false,
                message: "Pazaryeri API bilgileri bulunamadı!"
            });
        }

        const { sellerId, token } = marketplace.credentials;
        if (!sellerId || !token) {
            return res.status(400).json({
                success: false,
                message: "Trendyol sellerId veya token eksik!"
            });
        }

        // Trendyol API request
        const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${invoiceSerialNumber}/items`;
        const headers = {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json'
        };

        const { data } = await axios.get(url, { headers });

        res.json({
            success: true,
            data
        });

    } catch (err) {
        logger.error("Kargo faturası detay hatası:", err.message);

        const status = err.response?.status || 500;
        const message = err.message || "Kargo faturası detayları çekilirken hata oluştu!";

        res.status(status).json({
            success: false,
            message,
            error: err.message
        });
    }
};