const normalizeStatus = (status) =>
    String(status || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");

const includesAny = (value, list) => list.some((x) => value.includes(x));

/** Frontend orderStatus.js ile aynı sınıflandırma (dashboard KPI tutarlılığı) */
const classifyOrderStatus = (status) => {
    const key = normalizeStatus(status);
    if (includesAny(key, ["create", "new", "open", "waiting"])) return "new";
    if (includesAny(key, ["pick", "pack", "hazir", "process", "approve", "unpack", "atcollectionpoint"])) return "processing";
    if (includesAny(key, ["ship", "cargo", "transit", "invoiced"])) return "shipping";
    if (includesAny(key, ["deliver", "complete", "tamam"])) return "delivered";
    if (includesAny(key, ["cancel", "iptal"])) return "cancelled";
    if (includesAny(key, ["return", "refund", "iade"])) return "returned";
    return "processing";
};

module.exports = { classifyOrderStatus, normalizeStatus };
