function normalizePhone(phone, countryCode = "+90") {
    let digits = String(phone || "").replace(/\D/g, "");
    const cc = String(countryCode || "+90").replace(/\D/g, "");
    if (digits.startsWith(cc)) digits = digits.slice(cc.length);
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10 && digits.startsWith("5")) return digits;
    if (digits.length === 11 && digits.startsWith("05")) return digits.slice(1);
    return digits.length >= 10 ? digits.slice(-10) : "";
}

module.exports = { normalizePhone };
