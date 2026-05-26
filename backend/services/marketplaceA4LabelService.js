/**
 * Pazaryeri A4 kargo etiketi — ortak veri modeli ve uyarı metinleri
 */

const sanitizeFilenamePart = (s) =>
    String(s || "")
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 80) || "Musteri";

function resolveCargoBrandKey(cargoCompany = "") {
    const n = String(cargoCompany || "").toLowerCase();
    if (n.includes("express") || (n.includes("tex") && !n.includes("latex"))) return "express";
    if (n.includes("yurti")) return "yurtici";
    if (n.includes("ptt")) return "ptt";
    if (n.includes("aras")) return "aras";
    if (n.includes("mng")) return "mng";
    if (n.includes("sürat") || n.includes("surat")) return "surat";
    if (n.includes("horoz")) return "horoz";
    if (n.includes("kolay") || n.includes("sendeo")) return "kolay";
    if (n.includes("ceva")) return "ceva";
    if (n.includes("dhl")) return "dhl";
    return "generic";
}

function formatFullAddress(addr = {}, base = "") {
    let full = String(base || addr.fullAddress || "").trim();
    const district = String(addr.district || "").trim();
    const city = String(addr.city || "").trim();
    const tail = [district, city].filter(Boolean).join("/");
    if (tail && full && !full.toLowerCase().includes(tail.toLowerCase())) {
        full = `${full} ${tail}`;
    } else if (!full && tail) {
        full = tail;
    }
    return full || "—";
}

function buildPdfFilename(meta = {}) {
    const name = sanitizeFilenamePart(meta.customerName);
    const tn = String(meta.cargoTrackingNumber || meta.barcodeValue || "")
        .replace(/[^\dA-Za-z-]/g, "")
        .trim();
    return tn ? `${name} - ${tn}.pdf` : `${name} - kargo-etiketi.pdf`;
}

const isTrendyolCommonLabelEligible = (cargoCompany = "") => {
    const n = String(cargoCompany || "").toLowerCase();
    if (!n) return false;
    if (
        n.includes("express") ||
        n.includes("ptt") ||
        n.includes("yurti") ||
        n.includes("mng") ||
        n.includes("sürat") ||
        n.includes("surat") ||
        n.includes("kolay") ||
        n.includes("horoz") ||
        n.includes("sendeo") ||
        n.includes("borusan")
    ) {
        return false;
    }
    if (n.includes("tex") && !n.includes("latex")) return true;
    return false;
};

const WARNING_BUILDERS = {
    trendyol: () =>
        "Kargo şirketinin dikkatine, bu bir trendyol.com gönderisidir. " +
        "Trendyol anlaşmasına uygun işlem yapabilirsiniz.",
    ciceksepeti: (meta) => {
        if (meta.integrationType === "supplier") {
            return (
                "Kargo şirketinin dikkatine, bu bir ciceksepeti.com gönderisidir (tedarikçi kargo entegrasyonu). " +
                "Etiket üzerindeki kargo kodunu kargo firmasına iletin."
            );
        }
        return (
            "Kargo şirketinin dikkatine, bu bir ciceksepeti.com gönderisidir. " +
            "ÇiçekSepeti anlaşmalı kargo sürecine uygun işlem yapabilirsiniz."
        );
    },
    n11: () =>
        "Kargo şirketinin dikkatine, bu bir n11.com gönderisidir. N11 kargo sürecine uygun işlem yapabilirsiniz.",
    hepsiburada: () =>
        "Kargo şirketinin dikkatine, bu bir Hepsiburada gönderisidir. Hepsiburada anlaşmasına uygun işlem yapabilirsiniz.",
    amazon: () =>
        "Kargo şirketinin dikkatine, bu bir Amazon gönderisidir. Amazon kargo sürecine uygun işlem yapabilirsiniz.",
    pttavm: () =>
        "Kargo şirketinin dikkatine, bu bir PttAVM gönderisidir. PttAVM kargo sürecine uygun işlem yapabilirsiniz.",
    ozon: () => "Ozon FBS kargo etiketi — gönderiyi Ozon sürecine uygun hazırlayın.",
    generic: (meta) =>
        `Kargo şirketinin dikkatine, bu bir ${meta.marketplaceDisplay || "pazaryeri"} gönderisidir.`,
};

const BRAND_TITLES = {
    trendyol: "trendyol.com",
    ciceksepeti: "ciceksepeti.com",
    n11: "n11.com",
    hepsiburada: "Hepsiburada",
    amazon: "Amazon",
    pttavm: "PttAVM",
    ozon: "Ozon",
};

/**
 * @param {object} meta
 * @param {string} marketplaceKey — trendyol | ciceksepeti | n11 | ...
 */
function buildMarketplaceA4LabelResponse(meta = {}, marketplaceKey = "generic") {
    const mp = String(marketplaceKey || "generic").toLowerCase();
    const barcodeRaw = String(
        meta.cargoTrackingNumber || meta.partialNumber || meta.barcodeValue || ""
    ).trim();
    const barcodeDigits = barcodeRaw.replace(/\s/g, "");
    const cargoCompany = String(meta.cargoCompany || "").trim();
    const cargoBrandKey = resolveCargoBrandKey(cargoCompany);
    const warnFn = WARNING_BUILDERS[mp] || WARNING_BUILDERS.generic;

    const labelData = {
        marketplace: mp,
        brandTitle: BRAND_TITLES[mp] || meta.marketplaceDisplay || "Pazaryeri",
        warningText: warnFn({ ...meta, cargoCompany }),
        orderNumber: String(meta.orderNumber || "").trim(),
        customerName: String(meta.customerName || "").trim() || "—",
        fullAddress: formatFullAddress(
            { district: meta.district, city: meta.city },
            meta.fullAddress || meta.addressLine
        ),
        departureBranch: String(meta.departureBranch || "").trim() || "—",
        shipmentNumber: String(meta.shipmentNumber || meta.deliveryNumber || meta.partialNumber || "").trim(),
        cargoTrackingNumber: barcodeDigits,
        cargoCompany,
        cargoBrandKey,
        isExpress: cargoBrandKey === "express",
        integrationType: meta.integrationType || "",
        orderItemId: meta.orderItemId != null ? String(meta.orderItemId) : "",
    };

    const filename = buildPdfFilename({ ...meta, cargoTrackingNumber: barcodeDigits });

    return {
        format: "marketplace_a4",
        viewMode: "marketplace_a4",
        labelData,
        filename,
        source: `${mp}_a4_panel`,
        cargoTrackingNumber: barcodeDigits || undefined,
        cargoCompany: labelData.cargoCompany,
        orderNumber: labelData.orderNumber,
        customerName: labelData.customerName,
        marketplace: meta.marketplaceDisplay || mp,
    };
}

module.exports = {
    buildMarketplaceA4LabelResponse,
    buildPdfFilename,
    formatFullAddress,
    resolveCargoBrandKey,
    isTrendyolCommonLabelEligible,
    BRAND_TITLES,
};
