const ORDER_STATUS_TR_MAP = {
    atcollectionpoint: "Teslim noktasında",
    picking: "Hazırlanıyor",
    packed: "Paketlendi",
    packaged: "Paketlendi",
    unpacked: "Paketlenmeyi bekliyor",
    open: "Yeni sipariş",
    created: "Yeni sipariş",
    approved: "Onaylandı",
    processing: "İşleniyor",
    intransit: "Taşımada",
    shipped: "Kargoya verildi",
    shipping: "Kargoda",
    delivered: "Teslim edildi",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    canceled: "İptal edildi",
    returned: "İade edildi",
    refunded: "Ücret iadesi yapıldı",
    undelivered: "Teslim edilemedi",
    waiting: "Beklemede",
};

const normalizeStatus = (status) =>
    String(status || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");

const includesAny = (value, list) => list.some((x) => value.includes(x));

export const getOrderStatusLabelTr = (status) => {
    const raw = String(status || "").trim();
    if (!raw) return "Belirsiz";

    const key = normalizeStatus(raw);
    if (ORDER_STATUS_TR_MAP[key]) return ORDER_STATUS_TR_MAP[key];

    // Tam eşleşme yoksa kapsayıcı kurallar
    if (includesAny(key, ["ship", "cargo", "transit"])) return "Kargoda";
    if (includesAny(key, ["deliver", "teslim"])) return "Teslim edildi";
    if (includesAny(key, ["cancel", "iptal"])) return "İptal edildi";
    if (includesAny(key, ["return", "refund", "iade"])) return "İade edildi";
    if (includesAny(key, ["pick", "pack", "hazir", "process", "unpack"])) return "Hazırlanıyor";
    if (includesAny(key, ["create", "new", "open", "waiting"])) return "Yeni sipariş";

    return raw;
};

export const classifyOrderStatus = (status) => {
    const key = normalizeStatus(status);
    if (includesAny(key, ["create", "new", "open", "waiting"])) return "new";
    if (includesAny(key, ["pick", "pack", "hazir", "process", "approve", "unpack", "atcollectionpoint"])) return "processing";
    if (includesAny(key, ["ship", "cargo", "transit", "invoiced"])) return "shipping";
    if (includesAny(key, ["deliver", "complete", "tamam"])) return "delivered";
    if (includesAny(key, ["cancel", "iptal"])) return "cancelled";
    if (includesAny(key, ["return", "refund", "iade"])) return "returned";
    return "processing";
};
