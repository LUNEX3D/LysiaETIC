/**
 * Finance API Service — LysiaETIC
 * Token'dan userId aliniyor, marketplaceId ile tek marketplace destegi
 */
import API from "./api";

// --- 1. Unified Finance Summary (tek marketplace veya tumu) ---

export const fetchProductProfitAnalysis = async ({ startDate, endDate, marketplaceId, sortBy, limit, signal }) => {
    try {
        const { start, end } = toRangeTimestamps(startDate, endDate);
        const params = { startDate: start, endDate: end };
        if (marketplaceId) params.marketplaceId = marketplaceId;
        if (sortBy) params.sortBy = sortBy;
        if (limit) params.limit = limit;
        const response = await API.get("/finance/product-profit-analysis", { params, signal });
        return response.data;
    } catch (error) {
        console.error("Product profit analysis hatasi:", error);
        throw error;
    }
};

const toRangeTimestamps = (startDate, endDate) => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
};

export const fetchFinanceSummary = async ({ startDate, endDate, marketplaceId }) => {
    try {
        const { start, end } = toRangeTimestamps(startDate, endDate);

        const params = { startDate: start, endDate: end };
        if (marketplaceId) params.marketplaceId = marketplaceId;

        const response = await API.get("/finance/summary", { params });

        return response.data;
    } catch (error) {
        console.error("Finance summary hatasi:", error);
        throw error;
    }
};

// --- 2. Trendyol Settlements ---

export const fetchTrendyolSettlements = async ({ startDate, endDate, marketplaceId, transactionType, page = 0, size = 500 }) => {
    try {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        const params = { startDate: start, endDate: end, page, size };
        if (marketplaceId) params.marketplaceId = marketplaceId;
        if (transactionType) params.transactionType = transactionType;

        const response = await API.get("/finance/trendyol/settlements", { params });
        return response.data;
    } catch (error) {
        console.error("Trendyol settlements hatasi:", error);
        throw error;
    }
};

// --- 3. Trendyol Other Financials ---

export const fetchTrendyolOtherFinancials = async ({ startDate, endDate, marketplaceId, transactionType, page = 0, size = 500 }) => {
    try {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        const params = { startDate: start, endDate: end, page, size };
        if (marketplaceId) params.marketplaceId = marketplaceId;
        if (transactionType) params.transactionType = transactionType;

        const response = await API.get("/finance/trendyol/otherfinancials", { params });
        return response.data;
    } catch (error) {
        console.error("Trendyol other financials hatasi:", error);
        throw error;
    }
};

// --- 4. Trendyol Cargo Invoice Items ---

export const fetchTrendyolCargoInvoiceItems = async ({ invoiceSerialNumber, marketplaceId }) => {
    try {
        const params = { invoiceSerialNumber };
        if (marketplaceId) params.marketplaceId = marketplaceId;

        const response = await API.get("/finance/trendyol/cargo-invoice-items", { params });
        return response.data;
    } catch (error) {
        console.error("Cargo invoice hatasi:", error);
        throw error;
    }
};
