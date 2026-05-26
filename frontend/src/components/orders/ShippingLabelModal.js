import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { fetchShippingLabel } from "../../services/marketplaceApi";
import MarketplaceCargoLabelCard from "./MarketplaceCargoLabelCard";
import { printCargoLabelOnly } from "../../utils/printCargoLabel";
import "../../styles/ShippingLabelModal.css";

export const supportsCargoLabel = (marketplace) => {
    const m = String(marketplace || "").toLowerCase();
    if (!m || m === "diğer" || m === "diger" || m === "other") return false;
    return (
        m.includes("trendyol") ||
        m.includes("hepsi") ||
        m.includes("ozon") ||
        m.includes("cicek") ||
        m.includes("çiçek") ||
        m === "n11" ||
        m.includes("amazon") ||
        m.includes("ptt")
    );
};

const base64ToBlob = (b64, mime) => {
    const raw = atob(b64.replace(/\s/g, ""));
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
};

const invalidTracking = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return true;
    const low = s.toLowerCase();
    return ["yok", "none", "bilinmiyor", "—", "-"].includes(low) || !/\d/.test(s);
};

async function zplToPreviewPng(zplText) {
    const res = await fetch("https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/", {
        method: "POST",
        headers: { Accept: "image/png" },
        body: zplText,
    });
    if (!res.ok) throw new Error("ZPL önizleme oluşturulamadı.");
    return res.blob();
};

export default function ShippingLabelModal({ order, onClose, C, t }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [label, setLabel] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const printRef = useRef(null);

    const isTrackingPortal = label?.viewMode === "tracking_portal" || label?.format === "portal";
    const isMarketplaceA4 =
        (label?.viewMode === "marketplace_a4" || label?.viewMode === "trendyol_a4") &&
        label?.labelData;

    useEffect(() => {
        let cancelled = false;
        let objectUrl = null;

        (async () => {
            if (!order) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError("");
            setLabel(null);
            setPreviewUrl(null);

            try {
                const orderNo =
                    String(order.orderNumber || "").trim() ||
                    (invalidTracking(order.trackingNumber) ? "" : String(order.trackingNumber).trim());

                let cargoTn = String(order.cargoTrackingNumber || "").trim();
                if (invalidTracking(cargoTn) && !invalidTracking(order.trackingNumber)) {
                    cargoTn = String(order.trackingNumber).trim();
                }

                const data = await fetchShippingLabel({
                    marketplace: order.marketplace,
                    marketplaceName: order.marketplace,
                    marketplaceId: order.marketplaceId,
                    orderNumber: orderNo,
                    orderId: order._id,
                    cargoTrackingNumber: invalidTracking(cargoTn) ? undefined : cargoTn,
                    packageNumber: order.packageNumber || undefined,
                    shipmentPackageId: order.shipmentPackageId || undefined,
                    cargoTrackingLink: order.cargoTrackingLink || undefined,
                    orderItemId: order.orderItemId || undefined,
                });

                if (cancelled) return;
                setLabel(data);

                if (
                    (data.viewMode === "marketplace_a4" || data.viewMode === "trendyol_a4") &&
                    data.labelData
                ) {
                    return;
                }
                if (data.viewMode === "tracking_portal" || data.format === "portal") return;

                if (data.format === "pdf" && data.contentBase64) {
                    const blob = base64ToBlob(data.contentBase64, "application/pdf");
                    objectUrl = URL.createObjectURL(blob);
                    setPreviewUrl(objectUrl);
                } else if (data.format === "zpl" && data.contentBase64) {
                    const zpl = atob(data.contentBase64);
                    try {
                        const pngBlob = await zplToPreviewPng(zpl);
                        if (!cancelled) {
                            objectUrl = URL.createObjectURL(pngBlob);
                            setPreviewUrl(objectUrl);
                        }
                    } catch {
                        /* ZPL yine indirilebilir */
                    }
                }
            } catch (e) {
                if (!cancelled) {
                    setError(
                        e.response?.data?.message || e.message || t("orders.cargoLabelError")
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [order, t, order?.orderNumber, order?._id]);

    const pdfFilename =
        label?.filename ||
        (label?.labelData
            ? `${label.labelData.customerName || "Musteri"} - ${label.labelData.cargoTrackingNumber || "etiket"}.pdf`
            : "kargo-etiketi.pdf");

    const handleDownload = useCallback(async () => {
        if (isMarketplaceA4 && printRef.current) {
            setDownloading(true);
            try {
                const el = printRef.current;
                const canvas = await html2canvas(el, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                });
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                const pageW = pdf.internal.pageSize.getWidth();
                const pageH = pdf.internal.pageSize.getHeight();
                const margin = 10;
                const maxW = pageW - margin * 2;
                const imgH = (canvas.height * maxW) / canvas.width;
                const y = imgH > pageH - margin * 2 ? margin : margin;
                const drawH = Math.min(imgH, pageH - margin * 2);
                const drawW = (canvas.width * drawH) / canvas.height;
                pdf.addImage(imgData, "PNG", margin, y, drawW, drawH);
                pdf.save(pdfFilename);
            } catch (err) {
                setError(err.message || "PDF oluşturulamadı.");
            } finally {
                setDownloading(false);
            }
            return;
        }

        if (!label?.contentBase64) return;
        const mime =
            label.mimeType ||
            (label.format === "pdf" ? "application/pdf" : "application/zpl");
        const blob = base64ToBlob(label.contentBase64, mime);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = label.filename || `label.${label.format || "bin"}`;
        a.click();
        URL.revokeObjectURL(url);
    }, [label, isMarketplaceA4, pdfFilename]);

    const handlePrint = useCallback(() => {
        if (isMarketplaceA4 && printRef.current) {
            const ok = printCargoLabelOnly(printRef.current, t("orders.cargoLabelTitle"));
            if (!ok) {
                setError(
                    "Yazdırma penceresi açılamadı. Tarayıcıda açılır pencere (popup) iznini kontrol edin."
                );
            }
            return;
        }
        if (isTrackingPortal && label?.cargoTrackingLink) {
            const w = window.open(label.cargoTrackingLink, "_blank");
            if (w) w.focus();
            return;
        }
        if (!previewUrl) return;
        const w = window.open("", "_blank");
        if (!w) return;
        const isPdf = label?.format === "pdf";
        w.document.write(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t("orders.cargoLabelTitle")}</title>` +
            `<style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}` +
            `${isPdf ? "embed" : "img"}{max-width:100%;height:auto}</style></head><body>` +
            (isPdf
                ? `<embed src="${previewUrl}" type="application/pdf" width="100%" height="100%" />`
                : `<img src="${previewUrl}" onload="window.print();" />`) +
            `</body></html>`
        );
        w.document.close();
        if (isPdf) setTimeout(() => w.print(), 500);
    }, [previewUrl, label, t, isTrackingPortal, isMarketplaceA4]);

    const portalUrl = label?.cargoTrackingLink || order?.cargoTrackingLink || "";

    if (!order) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="shipping-label-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{ background: "rgba(0,0,0,0.88)" }}
            >
                <motion.div
                    className="shipping-label-modal shipping-label-modal-chrome"
                    initial={{ scale: 0.94, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.94, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: `linear-gradient(160deg, ${C.card} 0%, rgba(12,16,22,0.98) 100%)`,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                    }}
                >
                    <header className="shipping-label-modal__header">
                        <div>
                            <h2>🏷️ {t("orders.cargoLabelTitle")}</h2>
                            <p>
                                {order.marketplace} · #{order.orderNumber}
                                {(label?.cargoCompany || order?.cargoCompany)
                                    ? ` · ${label?.cargoCompany || order?.cargoCompany}`
                                    : ""}
                            </p>
                        </div>
                        <button type="button" className="shipping-label-modal__close" onClick={onClose}>
                            ✕
                        </button>
                    </header>

                    {loading && (
                        <p className="shipping-label-modal__loading">{t("orders.cargoLabelLoading")}</p>
                    )}

                    {!loading && error && (
                        <div className="shipping-label-modal__error">{error}</div>
                    )}

                    {!loading && !error && isMarketplaceA4 && label?.labelData && (
                        <div className="shipping-label-modal__preview-wrap">
                            <MarketplaceCargoLabelCard data={label.labelData} printRef={printRef} />
                        </div>
                    )}

                    {!loading && !error && isTrackingPortal && portalUrl && (
                        <>
                            <p className="shipping-label-modal__hint">
                                {label?.message ||
                                    "Resmi Trendyol kargo takip sayfasından etiketinizi yazdırın."}
                            </p>
                            <div className="shipping-label-modal__iframe-wrap">
                                <iframe title={t("orders.cargoLabelTitle")} src={portalUrl} />
                            </div>
                        </>
                    )}

                    {!loading && !error && previewUrl && (
                        <div className="shipping-label-modal__preview-wrap shipping-label-modal__preview-wrap--media">
                            {label?.format === "pdf" ? (
                                <iframe title={t("orders.cargoLabelTitle")} src={previewUrl} />
                            ) : (
                                <img src={previewUrl} alt={t("orders.cargoLabelTitle")} />
                            )}
                        </div>
                    )}

                    {!loading && !error && label && (
                        <footer className="shipping-label-modal__actions">
                            {(isMarketplaceA4 || previewUrl || isTrackingPortal) && (
                                <button
                                    type="button"
                                    className="shipping-label-modal__btn shipping-label-modal__btn--primary"
                                    onClick={handlePrint}
                                    style={{ background: C.accent, color: "#000" }}
                                >
                                    🖨️ {t("orders.cargoLabelPrint")}
                                </button>
                            )}
                            {isTrackingPortal && portalUrl && (
                                <a
                                    href={portalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shipping-label-modal__btn shipping-label-modal__btn--ghost"
                                >
                                    ↗ Takip sayfası
                                </a>
                            )}
                            {(isMarketplaceA4 || label?.contentBase64) && (
                                <button
                                    type="button"
                                    className="shipping-label-modal__btn shipping-label-modal__btn--ghost"
                                    onClick={handleDownload}
                                    disabled={downloading}
                                >
                                    {downloading ? "…" : `⬇️ ${t("orders.cargoLabelDownload")}`}
                                </button>
                            )}
                        </footer>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
