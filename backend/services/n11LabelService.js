/**
 * N11 kargo etiketi — GetShipmentPackages → A4 panel şablonu
 */

const axios = require("axios");
const { buildMarketplaceA4LabelResponse, formatFullAddress } = require("./marketplaceA4LabelService");
const logger = require("../config/logger");

const N11_BASE = "https://api.n11.com";

const cleanAscii = (str) => String(str || "").replace(/[^\x20-\x7E]/g, "");

const getN11Headers = (apiKey, secretKey) => ({
    appkey: cleanAscii(apiKey),
    appsecret: cleanAscii(secretKey),
    "Content-Type": "application/json",
    "User-Agent": "Dashtock",
});

const sanitizeTn = (v) => {
    const s = String(v ?? "").trim();
    if (!s || ["yok", "none", "bilinmiyor", "—", "-"].includes(s.toLowerCase())) return "";
    return s;
};

async function fetchN11PackageByOrderNumber(credentials, orderNumber) {
    const apiKey = String(credentials.apiKey || "").trim();
    const secretKey = String(credentials.secretKey || "").trim();
    if (!apiKey || !secretKey) return null;

    const target = String(orderNumber || "").trim();
    if (!target) return null;

    const headers = getN11Headers(apiKey, secretKey);
    const statuses = ["Created", "Picking", "Shipped", "Delivered", "UnPacked", "UnSupplied"];

    for (const status of statuses) {
        try {
            const res = await axios.get(`${N11_BASE}/rest/delivery/v1/shipmentPackages`, {
                headers,
                params: {
                    orderNumber: target,
                    status,
                    page: 0,
                    size: 50,
                },
                timeout: 25000,
            });
            const list = res.data?.content || [];
            if (!list.length) continue;
            const hit = list.find((p) => String(p.orderNumber || "") === target) || list[0];
            if (hit) return hit;
        } catch (e) {
            logger.warn(`[ShippingLabel] N11 paket (${status}): ${e.message}`);
        }
    }

    try {
        const res = await axios.get(`${N11_BASE}/rest/delivery/v1/shipmentPackages`, {
            headers,
            params: { orderNumber: target, page: 0, size: 20 },
            timeout: 25000,
        });
        const list = res.data?.content || [];
        return list.find((p) => String(p.orderNumber || "") === target) || list[0] || null;
    } catch {
        return null;
    }
}

function mapN11PackageToMeta(pkg, base = {}) {
    const ship = pkg?.shippingAddress || pkg?.shipmentAddress || {};
    const bill = pkg?.billingAddress || {};
    const addr = ship.fullAddress || ship.address || bill.fullAddress || base.fullAddress || "";
    const tn = sanitizeTn(
        pkg?.cargoTrackingNumber ||
            pkg?.cargoSenderNumber ||
            base.cargoTrackingNumber ||
            base.trackingNumber
    );

    return {
        orderNumber: String(base.orderNumber || pkg?.orderNumber || "").trim(),
        customerName:
            base.customerName ||
            pkg?.customerfullName ||
            pkg?.customerFullName ||
            ship.fullName ||
            "—",
        fullAddress: formatFullAddress(
            {
                district: ship.district || ship.county,
                city: ship.city,
            },
            addr
        ),
        city: ship.city || base.city || "",
        district: ship.district || ship.county || base.district || "",
        cargoTrackingNumber: tn,
        cargoCompany: base.cargoCompany || pkg?.cargoProviderName || "",
        cargoTrackingLink: base.cargoTrackingLink || pkg?.cargoTrackingLink || "",
        shipmentPackageId: String(pkg?.id || base.shipmentPackageId || ""),
        marketplaceDisplay: "N11",
    };
}

async function fetchN11Label(credentials, opts = {}) {
    if (!credentials?.apiKey || !credentials?.secretKey) {
        throw new Error("N11 API bilgileri eksik (App Key / App Secret).");
    }

    const orderNumber = String(opts.orderNumber || "").trim();
    let pkg = null;

    try {
        pkg = await fetchN11PackageByOrderNumber(credentials, orderNumber);
    } catch (e) {
        logger.warn(`[ShippingLabel] N11 paket arama: ${e.message}`);
    }

    const meta = mapN11PackageToMeta(pkg, opts);

    if (!meta.cargoTrackingNumber) {
        if (meta.cargoTrackingLink) {
            return {
                viewMode: "tracking_portal",
                format: "portal",
                cargoTrackingLink: meta.cargoTrackingLink,
                cargoCompany: meta.cargoCompany || "Kargo",
                orderNumber: meta.orderNumber,
                source: "n11_tracking_portal",
                message: "N11 kargo takip sayfasından etiketinizi yazdırabilirsiniz.",
            };
        }
        throw new Error(
            "N11 kargo barkod numarası henüz oluşmadı. Siparişi «Hazırlanıyor» statüsüne aldıktan sonra tekrar deneyin."
        );
    }

    return buildMarketplaceA4LabelResponse(meta, "n11");
}

module.exports = {
    fetchN11Label,
    fetchN11PackageByOrderNumber,
    mapN11PackageToMeta,
};
