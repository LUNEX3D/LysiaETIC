/**
 * Pazaryeri kargo firması → etiket sağ üst görünümü
 */
export function resolveCargoBrand(cargoCompany = "") {
    const n = String(cargoCompany || "").toLowerCase();

    if (n.includes("express") || (n.includes("tex") && n.includes("market"))) {
        return { key: "express", title: "trendyol", subtitle: "express" };
    }
    if (n.includes("yurti")) {
        return { key: "yurtici", title: "Yurtiçi", subtitle: "Kargo" };
    }
    if (n.includes("ptt")) {
        return { key: "ptt", title: "PTT", subtitle: "Kargo" };
    }
    if (n.includes("aras")) {
        return { key: "aras", title: "Aras", subtitle: "Kargo" };
    }
    if (n.includes("mng")) {
        return { key: "mng", title: "MNG", subtitle: "Kargo" };
    }
    if (n.includes("sürat") || n.includes("surat")) {
        return { key: "surat", title: "Sürat", subtitle: "Kargo" };
    }
    if (n.includes("horoz")) {
        return { key: "horoz", title: "Horoz", subtitle: "Lojistik" };
    }
    if (n.includes("kolay") || n.includes("sendeo")) {
        return { key: "kolay", title: "Kolay Gelsin", subtitle: "" };
    }
    if (n.includes("ceva")) {
        return { key: "ceva", title: "CEVA", subtitle: "Lojistik" };
    }
    if (n.includes("dhl")) {
        return { key: "dhl", title: "DHL", subtitle: "eCommerce" };
    }
    if (n.includes("borusan")) {
        return { key: "borusan", title: "Borusan", subtitle: "Kargo" };
    }

    const raw = String(cargoCompany || "Kargo").trim();
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
        return { key: "generic", title: parts[0], subtitle: parts.slice(1).join(" ") };
    }
    return { key: "generic", title: raw, subtitle: "" };
}
