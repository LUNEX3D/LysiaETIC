/**
 * Trendyol Express / anlaşmalı kargo — A4 etiket verisi (frontend React UI)
 */

const {
    buildMarketplaceA4LabelResponse,
    formatFullAddress,
    buildPdfFilename,
} = require("./marketplaceA4LabelService");

function buildTrendyolA4LabelResponse(meta = {}) {
    return buildMarketplaceA4LabelResponse(meta, "trendyol");
}

/** @deprecated — use buildTrendyolA4LabelResponse */
function buildTrendyolA4HtmlLabel(meta) {
    return buildTrendyolA4LabelResponse(meta);
}

function extractLabelMetaFromPackage(pkg, base = {}) {
    const addr = pkg?.shipmentAddress || {};
    const fullAddress = String(
        addr.fullAddress ||
            [addr.address1, addr.address2, addr.district, addr.city].filter(Boolean).join(" ") ||
            ""
    ).trim();

    return {
        ...base,
        orderNumber: base.orderNumber || pkg?.orderNumber,
        cargoTrackingNumber:
            base.cargoTrackingNumber ||
            (pkg?.cargoTrackingNumber != null ? String(pkg.cargoTrackingNumber) : ""),
        cargoCompany: base.cargoCompany || pkg?.cargoProviderName || pkg?.cargoCompany || "",
        cargoTrackingLink: base.cargoTrackingLink || pkg?.cargoTrackingLink || "",
        cargoSenderNumber: pkg?.cargoSenderNumber || base.cargoSenderNumber || "",
        shipmentPackageId:
            base.shipmentPackageId || String(pkg?.shipmentPackageId || pkg?.id || ""),
        shipmentNumber: pkg?.shipmentNumber != null ? String(pkg.shipmentNumber) : base.shipmentNumber || "",
        customerName:
            base.customerName ||
            addr.fullName ||
            [pkg?.customerFirstName, pkg?.customerLastName].filter(Boolean).join(" "),
        fullAddress: formatFullAddress(addr, base.fullAddress || fullAddress),
        city: base.city || addr.city || "",
        district: base.district || addr.district || "",
        departureBranch:
            base.departureBranch ||
            pkg?.warehouseName ||
            pkg?.originWarehouseName ||
            pkg?.departureBranch ||
            pkg?.cargoBranch ||
            "",
    };
}

module.exports = {
    buildTrendyolA4LabelResponse,
    buildTrendyolA4HtmlLabel,
    buildPdfFilename,
    extractLabelMetaFromPackage,
};
