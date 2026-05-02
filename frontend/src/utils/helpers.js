/**
 * General date formatter
 * @param {number|string} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
}

/**
 * Trendyol API usually sends timestamp as string/number
 */
export function formatTrendyolDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
}

/**
 * Currency formatter (TRY)
 * @param {number|string} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
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
export function getTransactionColor(type) {
    switch (type) {
        case "Satış":
        case "Sale":
            return "success";
        case "İİade":
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
export function filterFinancialData(data = [], searchText = "") {
    if (!searchText) return data;
    return data.filter(item =>
        (item.orderNumber && item.orderNumber.toString().includes(searchText)) ||
        (item.description && item.description.toLowerCase().includes(searchText.toLowerCase()))
    );
}