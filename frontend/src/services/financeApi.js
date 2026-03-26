import axios from "axios";

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
    timeout: 30000, // 30 seconds timeout
    withCredentials: true,
});

// Request interceptor
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // 401 Unauthorized
            if (error.response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("userId");
                window.location.href = "/login";
            }

            // Format error message
            let errorMessage = "Bir hata oluştu";
            if (error.response.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.response.data?.errors) {
                errorMessage = error.response.data.errors
                    .map(e => e.message)
                    .join(', ');
            }

            return Promise.reject(new Error(errorMessage));
        } else if (error.request) {
            return Promise.reject(new Error("Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin."));
        } else {
            return Promise.reject(new Error("İstek oluşturulurken bir hata oluştu."));
        }
    }
);

// Date validation helper function
const validateAndFormatDates = (startDate, endDate) => {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime())) throw new Error("Geçersiz başlangıç tarihi");
        if (isNaN(end.getTime())) throw new Error("Geçersiz bitiş tarihi");

        const diff = end.getTime() - start.getTime();
        const maxDiff = 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds

        if (diff > maxDiff) {
            // Automatically get last 15 days
            const adjustedStart = new Date(end);
            adjustedStart.setDate(end.getDate() - 15);
            return {
                start: adjustedStart.getTime(),
                end: end.getTime(),
                adjusted: true
            };
        }

        if (start > end) {
            throw new Error("Başlangıç tarihi bitiş tarihinden büyük olamaz");
        }

        return {
            start: start.getTime(),
            end: end.getTime(),
            adjusted: false
        };
    } catch (error) {
        console.error("Tarih validasyon hatası:", error);
        throw error;
    }
};

// 1. Settlement Records
export const fetchTrendyolSettlements = async (params) => {
    try {
        const { startDate, endDate, marketplaceId, ...otherParams } = params;

        // Date validation (15 day limit)
        const { start, end } = validateAndFormatDates(startDate, endDate);

        const response = await API.get("/finance/trendyol/settlements", {
            params: {
                ...otherParams,
                startDate: start,
                endDate: end,
                marketplaceId: marketplaceId // Pass marketplaceId to backend
            }
        });

        return response.data;
    } catch (error) {
        console.error("Settlements hatası:", error);
        throw error;
    }
};

// 2. Other Financial Records
export const fetchTrendyolOtherFinancials = async (params) => {
    try {
        const { startDate, endDate, marketplaceId, ...otherParams } = params;

        // Date validation (15 day limit)
        const { start, end } = validateAndFormatDates(startDate, endDate);

        const response = await API.get("/finance/trendyol/otherfinancials", {
            params: {
                ...otherParams,
                startDate: start,
                endDate: end,
                marketplaceId: marketplaceId // Pass marketplaceId to backend
            }
        });

        return response.data;
    } catch (error) {
        console.error("Other financials hatası:", error);
        throw error;
    }
};

// 3. Cargo Invoice Details
export const fetchTrendyolCargoInvoiceItems = async ({ userId, invoiceSerialNumber, marketplaceId }) => {
    try {
        const response = await API.get("/finance/trendyol/cargo-invoice-items", {
            params: { userId, invoiceSerialNumber, marketplaceId }
        });

        return response.data;
    } catch (error) {
        console.error("Cargo invoice hatası:", error);
        throw error;
    }
};

// 4. Bulk Data Fetch (in 15-day chunks)
export const fetchTrendyolSettlementsBulk = async (params, progressCallback) => {
    try {
        const { startDate, endDate, ...otherParams } = params;
        const start = new Date(startDate);
        const end = new Date(endDate);

        let allData = [];
        let currentStart = start.getTime();
        const chunkSize = 15 * 24 * 60 * 60 * 1000; // 15 days
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        let processedDays = 0;

        while (currentStart < end.getTime()) {
            const currentEnd = Math.min(currentStart + chunkSize, end.getTime());

            const response = await fetchTrendyolSettlements({
                ...otherParams,
                startDate: currentStart,
                endDate: currentEnd
            });

            allData = [...allData, ...(response.data?.content || [])];
            currentStart = currentEnd + 1; // Start from 1ms after

            // Calculate and report progress
            processedDays += Math.ceil((currentEnd - currentStart) / (24 * 60 * 60 * 1000));
            const progress = Math.round((processedDays / totalDays) * 100);
            if (progressCallback) progressCallback(progress);
        }

        return { data: { content: allData } };
    } catch (error) {
        console.error("Bulk settlements hatası:", error);
        throw error;
    }
};