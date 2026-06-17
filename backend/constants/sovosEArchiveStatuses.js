/**
 * Sovos e-Arşiv belge statü kodları — EK3 resmi referans (v2.3)
 * StatusBadge / detay ekranında statusCode → Türkçe etiket
 */
const SOVOS_EARCHIVE_STATUS_MAP = {
    0: { label: "Başarılı", mapped: "sent", color: "#00ff88" },
    10: { label: "Başarılı", mapped: "sent", color: "#00ff88" },
    20: { label: "İşleniyor", mapped: "pending", color: "#ffcc00" },
    30: { label: "Hata", mapped: "error", color: "#ff3366" },
    40: { label: "Doğrulama hatası", mapped: "error", color: "#ff3366" },
    50: { label: "Şema hatası", mapped: "error", color: "#ff3366" },
    60: { label: "Yetkilendirme hatası", mapped: "error", color: "#ff3366" },
    70: { label: "Tekrar denenecek", mapped: "pending", color: "#ffcc00" },
    80: { label: "Rapor bekleniyor", mapped: "pending", color: "#ffcc00" },
    90: { label: "Rapor gönderildi", mapped: "sent", color: "#3b82f6" },
    100: { label: "Rapor onaylandı", mapped: "approved", color: "#00ff88" },
    110: { label: "Rapor reddedildi", mapped: "rejected", color: "#ff3366" },
    120: { label: "İmza bekleniyor", mapped: "pending", color: "#ffcc00" },
    130: { label: "İmzalandı", mapped: "sent", color: "#00ff88" },
    140: { label: "İptal edildi", mapped: "cancelled", color: "#ff3366" },
    150: { label: "İtiraz edildi", mapped: "cancelled", color: "#ff3366" },
};

const mapSovosEArchiveStatus = (statusCode, detailText = "") => {
    const code = Number(statusCode);
    const entry = SOVOS_EARCHIVE_STATUS_MAP[code];
    if (entry) {
        return {
            statusCode: code,
            label: entry.label,
            mappedStatus: entry.mapped,
            color: entry.color,
            detail: detailText || entry.label,
        };
    }
    const detail = String(detailText || "");
    if (/cancel|iptal|itiraz/i.test(detail)) {
        return { statusCode: code || null, label: "İptal / İtiraz", mappedStatus: "cancelled", color: "#ff3366", detail };
    }
    if (/sign|imza/i.test(detail)) {
        return { statusCode: code || null, label: detail || "İmzalandı", mappedStatus: "sent", color: "#00ff88", detail };
    }
    return {
        statusCode: code || null,
        label: detail || "Bilinmiyor",
        mappedStatus: "sent",
        color: "#4a5568",
        detail: detail || "Durum bilinmiyor",
    };
};

module.exports = {
    SOVOS_EARCHIVE_STATUS_MAP,
    mapSovosEArchiveStatus,
};
