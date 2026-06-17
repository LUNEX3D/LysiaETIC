/**
 * Pazaryeri panel akışı:
 * - Trendyol: Created → Yeni | Picking → İşlemde
 * - Hepsiburada: Paketlenecek (Open/Unpacked) + Gönderime hazır (Packaged) → İşlemde (Yeni değil)
 * - N11: Created → Yeni | Picking → İşlemde | Shipped → Kargoda | Delivered → Teslim | Cancelled/UnSupplied → İptal
 * - ÇiçekSepeti: gelen sipariş doğrudan İşlemde (Yeni/Onay yok)
 */

/** Türkçe İ/ı — varsayılan toLowerCase() "İade" → i̇ade eşleşmesini bozar */
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

/** Panel metinleri (Taşıma, Teslim Edildi, İade Tedarikçide…) için ASCII anahtar */
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

/** HB: sadece ödeme bekleyen = Yeni; Paketlenecek / Gönderime hazır = İşlemde */
const classifyHepsiburada = (key) => {
    if (
        includesAny(key, [
            "odemebek",
            "paymentawait",
            "awaitingpayment",
            "pendingpayment",
            "bekleyenodeme",
        ])
    ) {
        return "new";
    }
    if (
        key === "open" ||
        key === "unpacked" ||
        key === "packaged" ||
        includesAny(key, [
            "paketlenecek",
            "paketleniyor",
            "gonderimehazir",
            "gonderime",
            "readytoship",
            "readytosend",
            "labelprint",
            "etiket",
            "invoic",
            "accept",
            "kabul",
        ])
    ) {
        return "processing";
    }
    if (includesAny(key, ["ship", "transit", "cargo", "intransit", "kargoda"])) return "shipping";
    if (includesAny(key, ["deliver", "complet", "teslim"])) return "delivered";
    if (includesAny(key, ["cancel", "iptal"])) return "cancelled";
    if (includesAny(key, ["return", "iade"])) return "returned";
    return "processing";
};

/** N11 REST: Created → Picking → Shipped → Delivered | Cancelled/UnSupplied | panel: Tamamlandı */
const classifyN11 = (key) => {
    if (
        includesAny(key, [
            "tamamlandi",
            "tamamland",
            "delivered",
            "completed",
            "teslim",
            "complet",
        ])
    ) {
        return "delivered";
    }
    if (includesAny(key, ["ship", "transit", "kargo", "shipped", "gonderildi"])) return "shipping";
    if (
        includesAny(key, [
            "onaylandi",
            "onayland",
            "approved",
            "picking",
            "packaged",
            "packing",
            "hazirlan",
            "islemde",
        ])
    ) {
        return "processing";
    }
    if (includesAny(key, ["cancel", "reject", "iptal", "redded", "unsupplied"])) return "cancelled";
    if (includesAny(key, ["return", "iade", "refund"])) return "returned";
    /**
     * N11 REST: yeni siparişler "Created" gelir (panelde "Yeni"),
     * onaylananlar "Picking" (yukarıda processing'e gider).
     * "UnPacked" = bölünen ana paket → yeni gibi ele al.
     */
    if (
        key === "created" ||
        key === "new" ||
        includesAny(key, ["unpacked", "yenisiparis", "waiting", "bekle"])
    ) {
        return "new";
    }
    return "new";
};

/** Ozon FBS: awaiting_packaging → İşlemde | delivering → Kargoda */
const classifyOzon = (key) => {
    if (includesAny(key, ["delivered", "deliveringdone"])) return "delivered";
    if (includesAny(key, ["cancel", "cancelled", "notaccepted"])) return "cancelled";
    if (includesAny(key, ["return", "arbitration"])) return "returned";
    if (
        includesAny(key, [
            "delivering",
            "driverpickup",
            "sentbyseller",
            "acceptanceinprogress",
        ])
    ) {
        return "shipping";
    }
    if (
        includesAny(key, [
            "awaitingpackaging",
            "awaitingdeliver",
            "awaitingapproval",
            "packaging",
            "readytoship",
        ])
    ) {
        return "processing";
    }
    return "processing";
};

/** Trendyol: Created = Yeni | Picking = İşlemde */
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

/**
 * ÇiçekSepeti GetOrders + getcanceledorders (orderItemStatusId 20–23)
 * İşlemde: Yeni, Hazırlanıyor, Onaylandı, Kargoya Verilecek
 * Kargoda: Kargoda, Kargoya Verildi, Taşıma durumunda
 * İade: İade Tedarikçide, İade Kargoda, İade Süreci Başladı …
 */
const classifyCiceksepeti = (key) => {
    if (
        includesAny(key, [
            "iade",
            "refund",
            "return",
            "iadetedarik",
            "iadetedarikcide",
            "iadetedarikcionay",
            "iadesurecibasladi",
            "iadesurecinde",
            "iadekargoda",
            "iadeonaylandi",
            "iadeonaybekliyor",
            "ihtilaf",
            "musteriyegonderilecek",
        ])
    ) {
        return "returned";
    }
    if (includesAny(key, [
            "teslimedildi",
            "teslim",
            "tamamlandi",
            "tamamland",
            "delivered",
            "completed",
            "teslimedild",
        ])
    ) {
        return "delivered";
    }
    if (includesAny(key, ["iptal", "cancel", "iptaledildi"])) return "cancelled";
    if (
        key.includes("kargoyaverildi") ||
        key.includes("kargoyaverilecek") ||
        key === "kargoda" ||
        includesAny(key, ["tasima", "tasimadurumunda", "transit", "yolda", "gonderildi", "shipped"])
    ) {
        return "shipping";
    }
    if (key === "yeni" || key === "new") return "new";
    if (includesAny(key, ["hazirlan", "onay", "onaylandi", "onayland"])) return "processing";
    return "processing";
};

/** Ana sayfa sipariş kartı: yalnızca Yeni + İşlemde (kargoda hariç) */
const countActiveOrders = (statusCounts = {}) =>
    (statusCounts.new || 0) + (statusCounts.processing || 0);

const classifyOrderStatus = (status, marketplaceName = "") => {
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

const getOrderStatusLabelTr = (status, marketplaceName = "") => {
    const raw = String(status || "").trim();
    if (!raw) return "Belirsiz";

    const key = normalizeStatus(raw);
    const mp = normalizeMp(marketplaceName);

    if (mp.includes("hepsi")) {
        if (key === "packaged" || includesAny(key, ["gonderime", "readytoship"])) return "Gönderime hazır";
        if (key === "open" || key === "unpacked" || includesAny(key, ["paketlenecek", "paketlen"])) {
            return "Paketlenecek";
        }
        if (includesAny(key, ["ship", "transit", "kargo"])) return "Kargoda";
        if (includesAny(key, ["deliver", "teslim"])) return "Teslim edildi";
        if (includesAny(key, ["cancel", "iptal"])) return "İptal edildi";
        if (includesAny(key, ["return", "iade"])) return "İade";
    }

    if (mp.includes("n11")) {
        if (includesAny(key, ["tamamlandi", "tamamland", "delivered", "completed", "teslim"])) {
            return "Tamamlandı";
        }
        if (includesAny(key, ["cancel", "iptal", "unsupplied"])) return "İptal edildi";
        if (includesAny(key, ["ship", "kargo", "transit", "shipped"])) return "Kargoda";
        // Picking = N11'de "Onaylandı/Hazırlanıyor"
        if (includesAny(key, ["onaylandi", "onayland", "approved", "pick", "pack", "hazir"])) {
            return "Hazırlanıyor";
        }
        // Created = N11'de yeni sipariş, UnPacked = bölünen paket
        if (key === "created" || key === "unpacked" || includesAny(key, ["new", "yeni"])) {
            return "Yeni sipariş";
        }
    }

    if (mp.includes("cicek")) {
        if (includesAny(key, ["iade", "return", "ihtilaf"])) return "İade";
        if (includesAny(key, ["teslim", "tamamlandi", "delivered"])) return "Teslim edildi";
        if (includesAny(key, ["kargo", "ship", "gonder", "tasima"])) return "Kargoda";
        if (includesAny(key, ["iptal", "cancel"])) return "İptal edildi";
        return "Hazırlanıyor";
    }

    if (mp.includes("trendyol")) {
        if (includesAny(key, ["pick", "hazirlan"])) return "Hazırlanıyor";
        if (key === "created" || key === "unpacked") return "Yeni sipariş";
        if (key === "invoiced") return "Faturalandı";
        if (includesAny(key, ["ship", "transit"])) return "Kargoda";
        if (key === "delivered") return "Teslim edildi";
    }

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

const BUCKET_PRIORITY = {
    awaiting: 0,
    new: 1,
    processing: 2,
    shipping: 3,
    delivered: 4,
    cancelled: 5,
    returned: 6,
};

const bucketPriority = (status, marketplaceName = "") =>
    BUCKET_PRIORITY[classifyOrderStatus(status, marketplaceName)] ?? 0;

const pickPreferredOrderRecord = (existing, candidate) => {
    if (!existing) return candidate;
    if (!candidate) return existing;

    const mp = candidate.marketplaceName || existing.marketplaceName || "";
    const exP = bucketPriority(existing.status, mp);
    const caP = bucketPriority(candidate.status, mp);
    if (caP > exP) return candidate;
    if (caP < exP) return existing;

    const exT = existing.orderDate ? new Date(existing.orderDate).getTime() : 0;
    const caT = candidate.orderDate ? new Date(candidate.orderDate).getTime() : 0;
    if (caT !== exT) return caT > exT ? candidate : existing;

    const exU = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const caU = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : 0;
    return caU >= exU ? candidate : existing;
};

const resolveBestOrderStatus = (currentStatus, incomingStatus, marketplaceName = "") => {
    const cur = String(currentStatus || "").trim();
    const inc = String(incomingStatus || "").trim();
    if (!inc) return cur;
    if (!cur) return inc;
    const mp = marketplaceName || "";
    const winner = pickPreferredOrderRecord(
        { status: cur, marketplaceName: mp },
        { status: inc, marketplaceName: mp }
    );
    return winner.status || inc;
};

const HB_RAW_STATUS_RANK = {
    open: 1,
    unpacked: 2,
    packaged: 3,
    shipped: 4,
    delivered: 5,
    cancelled: 6,
};

const hepsiburadaStatusRank = (status) => HB_RAW_STATUS_RANK[normalizeStatus(status)] || 0;

const shouldUpgradeHepsiburadaStatus = (current, incoming) =>
    hepsiburadaStatusRank(incoming) > hepsiburadaStatusRank(current);

module.exports = {
    classifyOrderStatus,
    getOrderStatusLabelTr,
    normalizeStatus,
    toStatusKey,
    countActiveOrders,
    bucketPriority,
    pickPreferredOrderRecord,
    resolveBestOrderStatus,
    hepsiburadaStatusRank,
    shouldUpgradeHepsiburadaStatus,
};
