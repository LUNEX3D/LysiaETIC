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

/** Dashboard / sipariş listesinde güvenli tarih gösterimi */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** HB dahil — panelde gösterilecek sipariş numarası (UUID iç id değil) */
export const formatOrderNumberForDisplay = (order) => {
    const candidates = [order?.orderNumber, order?.packageNumber, order?.trackingNumber];
    for (const c of candidates) {
        const s = String(c ?? "").trim();
        if (!s || UUID_RE.test(s)) continue;
        return s;
    }
    return "N/A";
};

export const parseOrderDateForDisplay = (value) => {
    if (value == null || value === "") return null;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;

    const s = String(value).trim();
    const tr = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (tr) {
        const [, d, mo, y, h = "0", mi = "0"] = tr;
        const parsed = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
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
