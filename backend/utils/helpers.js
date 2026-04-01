/**
 * General Helpers — LysiaETIC
 * ✅ FIX #4: ESM export → CommonJS module.exports
 */

/**
 * General date formatter
 * @param {number|string} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
}

/**
 * Trendyol API usually sends timestamp as string/number
 */
function formatTrendyolDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
}

/**
 * Currency formatter (TRY)
 * @param {number|string} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    if (amount == null || amount === "") return "-";
    return Number(amount).toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Returns color based on transaction type
 */
function getTransactionColor(type) {
    switch (type) {
        case "Satış":
        case "Sale":
            return "success";
        case "İade":
        case "Return":
            return "error";
        case "İndirim":
        case "Discount":
            return "warning";
        case "Kupon":
        case "Coupon":
            return "primary";
        default:
            return "default";
    }
}

/**
 * For special filtering purposes (example)
 */
function filterFinancialData(data = [], searchText = "") {
    if (!searchText) return data;
    return data.filter(item =>
        (item.orderNumber && item.orderNumber.toString().includes(searchText)) ||
        (item.description && item.description.toLowerCase().includes(searchText.toLowerCase()))
    );
}

module.exports = {
    formatDate,
    formatTrendyolDate,
    formatCurrency,
    getTransactionColor,
    filterFinancialData
};