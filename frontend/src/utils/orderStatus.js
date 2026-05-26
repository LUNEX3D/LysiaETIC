const ORDER_STATUS_TR_MAP = {
    atcollectionpoint: "Teslim noktasında",
    picking: "Hazırlanıyor",
    packaged: "Paketlendi",
    unpacked: "Paketlenmeyi bekliyor",
    open: "Paketlenecek",
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

const turkishLower = (value) => {
    try {
        return String(value ?? "").toLocaleLowerCase("tr-TR");
    } catch {
        return String(value ?? "")
            .replace(/\u0130/g, "i")
            .replace(/I/g, "ı")
            .toLowerCase();
    }
};

const normalizeStatus = (status) => turkishLower(status).replace(/[\s_\-\.]/g, "");

const toStatusKey = (status) =>
    normalizeStatus(status)
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");

const normalizeMp = (name) => toStatusKey(name);

const includesAny = (value, list) => list.some((x) => value.includes(x));

const classifyHepsiburada = (key) => {
    if (includesAny(key, ["odemebek", "paymentawait", "pendingpayment", "bekleyenodeme"])) {
        return "new";
    }
    if (
        key === "open" ||
        key === "unpacked" ||
        key === "packaged" ||
        includesAny(key, ["paketlenecek", "gonderimehazir", "gonderime", "readytoship", "etiket"])
    ) {
        return "processing";
    }
    if (includesAny(key, ["ship", "transit", "cargo", "kargoda"])) return "shipping";
    if (includesAny(key, ["deliver", "complet", "teslim"])) return "delivered";
    if (includesAny(key, ["cancel", "iptal"])) return "cancelled";
    if (includesAny(key, ["return", "iade"])) return "returned";
    return "processing";
};

const classifyN11 = (key) => {
    if (includesAny(key, ["tamamlandi", "tamamland", "delivered", "completed", "teslim", "complet"])) {
        return "delivered";
    }
    if (includesAny(key, ["ship", "transit", "kargo", "shipped", "gonderildi"])) return "shipping";
    if (includesAny(key, ["onaylandi", "onayland", "approved", "picking", "packaged", "hazirlan", "islemde"])) {
        return "processing";
    }
    if (includesAny(key, ["cancel", "reject", "iptal", "redded"])) return "cancelled";
    if (includesAny(key, ["return", "iade", "refund"])) return "returned";
    if (key === "new" || includesAny(key, ["yenisiparis", "waiting", "bekle"])) return "new";
    if (key === "created") return "delivered";
    return "new";
};

const classifyOzon = (key) => {
    if (includesAny(key, ["delivered", "deliveringdone"])) return "delivered";
    if (includesAny(key, ["cancel", "cancelled", "notaccepted"])) return "cancelled";
    if (includesAny(key, ["return", "arbitration"])) return "returned";
    if (includesAny(key, ["delivering", "driverpickup", "sentbyseller"])) return "shipping";
    if (includesAny(key, ["awaitingpackaging", "awaitingdeliver", "awaitingapproval", "packaging"])) {
        return "processing";
    }
    return "processing";
};

const classifyTrendyol = (key) => {
    if (key === "created") return "new";
    if (key === "unpacked") return "new";
    if (includesAny(key, ["pick", "repack", "hazirlan"])) return "processing";
    if (key === "invoiced") return "shipping";
    if (includesAny(key, ["ship", "atcollectionpoint", "transit"])) return "shipping";
    if (key === "delivered") return "delivered";
    if (includesAny(key, ["cancel", "undelivered"])) return "cancelled";
    if (includesAny(key, ["return", "unsupplied", "iade"])) return "returned";
    return "new";
};

const classifyCiceksepeti = (key) => {
    if (
        includesAny(key, [
            "iade",
            "refund",
            "return",
            "iadetedarik",
            "iadetedarikcide",
            "iadesurecibasladi",
            "iadesurecinde",
            "iadekargoda",
            "iadeonaybekliyor",
            "ihtilaf",
            "musteriyegonderilecek",
        ])
    ) {
        return "returned";
    }
    if (
        includesAny(key, [
            "teslimedildi",
            "teslim",
            "tamamlandi",
            "tamamland",
            "delivered",
            "completed",
        ])
    ) {
        return "delivered";
    }
    if (includesAny(key, ["iptal", "cancel", "iptaledildi"])) return "cancelled";
    if (
        key.includes("kargoyaverildi") ||
        key === "kargoda" ||
        includesAny(key, ["tasima", "tasimadurumunda", "transit", "yolda", "gonderildi", "shipped"])
    ) {
        return "shipping";
    }
    return "processing";
};

/** Ana sayfa sipariş kartı: yalnızca Yeni + İşlemde (kargoda hariç) */
export const countActiveOrders = (statusCounts = {}) =>
    (statusCounts.new || 0) + (statusCounts.processing || 0);

export const classifyOrderStatus = (status, marketplaceName = "") => {
    const key = toStatusKey(status);
    const mp = normalizeMp(marketplaceName);

    if (mp.includes("ciceksepeti") || mp.includes("cicek")) return classifyCiceksepeti(key);
    if (mp.includes("hepsiburada") || mp.includes("hepsi")) return classifyHepsiburada(key);
    if (mp.includes("n11")) return classifyN11(key);
    if (mp.includes("trendyol")) return classifyTrendyol(key);
    if (mp.includes("ozon")) return classifyOzon(key);

    if (includesAny(key, ["teslim", "deliver", "complete", "tamam"])) return "delivered";
    if (includesAny(key, ["return", "refund", "iade"])) return "returned";
    if (includesAny(key, ["cancel", "iptal"])) return "cancelled";
    if (includesAny(key, ["ship", "cargo", "transit", "invoiced", "kargo"])) return "shipping";
    if (includesAny(key, ["pick", "pack", "hazir", "process", "approve", "unpack", "gonderime"])) {
        return "processing";
    }
    if (includesAny(key, ["create", "new", "open", "waiting"])) return "new";
    return "new";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getOrderStatusLabelTr = (status, marketplaceName = "") => {
    const raw = String(status || "").trim();
    if (!raw) return "Belirsiz";

    const key = toStatusKey(raw);
    const mp = normalizeMp(marketplaceName);

    if (mp.includes("hepsi")) {
        if (key === "packaged" || includesAny(key, ["gonderime", "readytoship"])) return "Gönderime hazır";
        if (key === "open" || key === "unpacked" || includesAny(key, ["paketlenecek"])) return "Paketlenecek";
        if (includesAny(key, ["ship", "transit", "kargo"])) return "Kargoda";
        if (includesAny(key, ["deliver", "teslim"])) return "Teslim edildi";
        if (includesAny(key, ["cancel", "iptal"])) return "İptal edildi";
    }

    if (mp.includes("n11")) {
        if (includesAny(key, ["tamamlandi", "tamamland", "delivered", "completed", "teslim"])) {
            return "Tamamlandı";
        }
        if (includesAny(key, ["onaylandi", "onayland", "approved"])) return "Onaylandı";
        if (includesAny(key, ["pick", "pack", "hazir"])) return "Hazırlanıyor";
        if (includesAny(key, ["ship", "kargo", "transit", "shipped"])) return "Kargoda";
        if (includesAny(key, ["new", "yeni"])) return "Yeni sipariş";
    }

    if (mp.includes("cicek")) {
        if (includesAny(key, ["iade", "return", "ihtilaf"])) return "İade";
        if (includesAny(key, ["teslim", "tamamlandi", "delivered"])) return "Teslim edildi";
        if (includesAny(key, ["kargo", "ship", "gonder", "tasima"])) return "Kargoda";
        if (includesAny(key, ["iptal", "cancel"])) return "İptal edildi";
        return "Hazırlanıyor";
    }

    if (mp.includes("ozon")) {
        if (includesAny(key, ["delivered"])) return "Teslim edildi";
        if (includesAny(key, ["delivering"])) return "Kargoda";
        if (includesAny(key, ["awaitingdeliver"])) return "Gönderime hazır";
        if (includesAny(key, ["awaitingpackaging"])) return "Paketleniyor";
        if (includesAny(key, ["cancel"])) return "İptal";
    }

    if (mp.includes("trendyol")) {
        if (includesAny(key, ["pick", "hazirlan"])) return "Hazırlanıyor";
        if (key === "created" || key === "unpacked") return "Yeni sipariş";
        if (key === "invoiced") return "Faturalandı";
        if (includesAny(key, ["ship", "transit"])) return "Kargoda";
        if (key === "delivered") return "Teslim edildi";
    }

    if (ORDER_STATUS_TR_MAP[key]) return ORDER_STATUS_TR_MAP[key];

    const bucket = classifyOrderStatus(status, marketplaceName);
    const labels = {
        new: "Yeni sipariş",
        processing: "Hazırlanıyor",
        shipping: "Kargoda",
        delivered: "Teslim edildi",
        cancelled: "İptal edildi",
        returned: "İade",
    };
    return labels[bucket] || raw;
};

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
