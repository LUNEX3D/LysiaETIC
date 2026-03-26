// services/trendyolFinanceService.js
const axios = require("axios");

// Trendyol settlements verilerini çek
exports.fetchSettlements = async ({
                                      sellerId,
                                      apiKey,
                                      apiSecret,
                                      transactionType,
                                      startDate,
                                      endDate,
                                      page = 0,
                                      size = 500
                                  }) => {
    const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/settlements`;
    const params = {
        transactionType,
        startDate,
        endDate,
        page,
        size
    };

    // Eğer Trendyol yeni Auth sistemine geçtiyse, Bearer Token kullanılabilir.
    // Şimdilik Basic Auth ile örnek (apiKey/apiSecret).
    const response = await axios.get(url, {
        params,
        auth: {
            username: apiKey,
            password: apiSecret
        }
    });

    return response.data;
};

// Trendyol otherfinancials verilerini çek
exports.fetchOtherFinancials = async ({
                                          sellerId,
                                          apiKey,
                                          apiSecret,
                                          transactionType,
                                          startDate,
                                          endDate,
                                          page = 0,
                                          size = 500
                                      }) => {
    const url = `https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/otherfinancials`;
    const params = {
        transactionType,
        startDate,
        endDate,
        page,
        size
    };

    const response = await axios.get(url, {
        params,
        auth: {
            username: apiKey,
            password: apiSecret
        }
    });

    return response.data;
};
