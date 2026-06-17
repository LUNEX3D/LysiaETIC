import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchShippingLabel } from "../../services/marketplaceApi";
import MarketplaceCargoLabelCard from "./MarketplaceCargoLabelCard";
import { printCargoLabelsBatch } from "../../utils/printCargoLabel";
import "../../styles/ShippingLabelModal.css";

const invalidTracking = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return true;
    const low = s.toLowerCase();
    return ["yok", "none", "bilinmiyor", "—", "-"].includes(low) || !/\d/.test(s);
};

const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

async function zplToPngDataUrl(zplText) {
    const res = await fetch("https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/", {
        method: "POST",
        headers: { Accept: "image/png" },
        body: zplText,
    });
    if (!res.ok) throw new Error("ZPL önizleme oluşturulamadı.");
    const blob = await res.blob();
    return blobToDataUrl(blob);
}

const buildLabelParams = (order) => {
    const orderNo =
        String(order.orderNumber || "").trim() ||
        (invalidTracking(order.trackingNumber) ? "" : String(order.trackingNumber).trim());
    let cargoTn = String(order.cargoTrackingNumber || "").trim();
    if (invalidTracking(cargoTn) && !invalidTracking(order.trackingNumber)) {
        cargoTn = String(order.trackingNumber).trim();
    }
    return {
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
    };
};

/**
 * Birden fazla siparişin kargo etiketini topluca getirip tek diyalogda yazdırır.
 * - A4 kart (Trendyol/N11/ÇiçekSepeti/Amazon/PttAVM) ve ZPL → tek yazdırma çıktısında birleştirilir.
 * - PDF ve takip-portalı etiketleri ayrı listelenir; her biri tekil yazdırma ile açılır.
 */
export default function BulkShippingLabelModal({ orders = [], onClose, onPrintSingle, C, t }) {
    const [items, setItems] = useState(() =>
        orders.map((o) => ({ order: o, state: "pending", kind: null, error: "" }))
    );
    const [done, setDone] = useState(0);
    const [running, setRunning] = useState(true);
    const [printing, setPrinting] = useState(false);
    const cardRefs = useRef({});

    const total = orders.length;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            for (let i = 0; i < orders.length; i++) {
                if (cancelled) return;
                setItems((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], state: "loading" };
                    return next;
                });

                let result;
                try {
                    const data = await fetchShippingLabel(buildLabelParams(orders[i]));
                    const isA4 =
                        (data.viewMode === "marketplace_a4" || data.viewMode === "trendyol_a4") &&
                        data.labelData;
                    const isPortal = data.viewMode === "tracking_portal" || data.format === "portal";

                    if (isA4) {
                        result = { state: "ok", kind: "card", labelData: data.labelData, cargoCompany: data.cargoCompany };
                    } else if (data.format === "pdf" && data.contentBase64) {
                        result = { state: "ok", kind: "pdf", label: data };
                    } else if (data.format === "zpl" && data.contentBase64) {
                        try {
                            const dataUrl = await zplToPngDataUrl(atob(data.contentBase64));
                            result = { state: "ok", kind: "img", imgDataUrl: dataUrl };
                        } catch {
                            result = { state: "ok", kind: "pdf", label: data };
                        }
                    } else if (isPortal) {
                        result = { state: "ok", kind: "portal", link: data.cargoTrackingLink || orders[i].cargoTrackingLink || "" };
                    } else {
                        result = { state: "fail", error: "Etiket formatı desteklenmiyor" };
                    }
                } catch (e) {
                    result = {
                        state: "fail",
                        error: e.response?.data?.message || e.message || "Etiket alınamadı",
                    };
                }

                if (cancelled) return;
                setItems((prev) => {
                    const next = [...prev];
                    next[i] = { ...next[i], ...result };
                    return next;
                });
                setDone((d) => d + 1);
            }
            if (!cancelled) setRunning(false);
        })();

        return () => {
            cancelled = true;
        };
        // orders sabit referansta tutuluyor (parent useMemo) — sadece açılışta çalışır
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cardItems = items.filter((it) => it.kind === "card");
    const imgItems = items.filter((it) => it.kind === "img");
    const pdfItems = items.filter((it) => it.kind === "pdf");
    const portalItems = items.filter((it) => it.kind === "portal");
    const failItems = items.filter((it) => it.state === "fail");
    const batchCount = cardItems.length + imgItems.length;

    const handleBatchPrint = useCallback(() => {
        setPrinting(true);
        try {
            const blocks = [];
            items.forEach((it, idx) => {
                if (it.kind === "card") {
                    const el = cardRefs.current[idx];
                    if (el?.outerHTML) blocks.push(el.outerHTML);
                } else if (it.kind === "img" && it.imgDataUrl) {
                    blocks.push(`<img class="cargo-print-img" src="${it.imgDataUrl}" alt="kargo etiketi" />`);
                }
            });
            const ok = printCargoLabelsBatch(blocks, "Kargo Etiketleri");
            if (!ok) {
                window.alert(
                    "Yazdırma penceresi açılamadı. Tarayıcıda açılır pencere (popup) iznini kontrol edin."
                );
            }
        } finally {
            setPrinting(false);
        }
    }, [items]);

    const badge = (it) => {
        if (it.state === "loading" || it.state === "pending")
            return { txt: it.state === "loading" ? "Alınıyor…" : "Bekliyor", col: C.muted };
        if (it.state === "fail") return { txt: "Hata", col: C.red };
        if (it.kind === "card" || it.kind === "img") return { txt: "Hazır ✓", col: C.green };
        if (it.kind === "pdf") return { txt: "PDF — tekil", col: C.yellow };
        if (it.kind === "portal") return { txt: "Portal — tekil", col: C.purple };
        return { txt: "—", col: C.muted };
    };

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
                        maxWidth: 640,
                        width: "94vw",
                    }}
                >
                    <header className="shipping-label-modal__header">
                        <div>
                            <h2>🏷️ Toplu Kargo Etiketi</h2>
                            <p>
                                İşlemdeki {total} sipariş ·{" "}
                                {running ? `hazırlanıyor (${done}/${total})` : `${done}/${total} tamamlandı`}
                            </p>
                        </div>
                        <button type="button" className="shipping-label-modal__close" onClick={onClose}>
                            ✕
                        </button>
                    </header>

                    {running && (
                        <div style={{ padding: "0 1.25rem" }}>
                            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${total ? (done / total) * 100 : 0}%`,
                                        background: C.accent,
                                        transition: "width 0.3s",
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ padding: "0.75rem 1.25rem", maxHeight: "46vh", overflowY: "auto" }}>
                        {items.map((it, idx) => {
                            const b = badge(it);
                            const o = it.order;
                            return (
                                <div
                                    key={o._id || idx}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        padding: "0.5rem 0.25rem",
                                        borderBottom: `1px solid ${C.glassBr}`,
                                        fontSize: "0.8rem",
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            #{o.orderNumber} · {o.marketplace}
                                        </div>
                                        <div style={{ color: C.muted, fontSize: "0.72rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {o.customerName || "—"}
                                            {it.error ? ` · ${it.error}` : ""}
                                        </div>
                                    </div>
                                    <span style={{ color: b.col, fontWeight: 700, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                                        {b.txt}
                                    </span>
                                    {(it.kind === "pdf" || it.kind === "portal") && onPrintSingle && (
                                        <button
                                            type="button"
                                            onClick={() => onPrintSingle(o)}
                                            style={{
                                                background: C.accent,
                                                color: "#000",
                                                border: "none",
                                                borderRadius: 8,
                                                padding: "0.3rem 0.6rem",
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            Yazdır
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <footer className="shipping-label-modal__actions" style={{ flexWrap: "wrap", gap: "0.6rem" }}>
                        <button
                            type="button"
                            className="shipping-label-modal__btn shipping-label-modal__btn--primary"
                            onClick={handleBatchPrint}
                            disabled={running || printing || batchCount === 0}
                            style={{
                                background: batchCount === 0 ? C.glass : C.accent,
                                color: batchCount === 0 ? C.muted : "#000",
                                cursor: running || batchCount === 0 ? "not-allowed" : "pointer",
                                opacity: running || batchCount === 0 ? 0.6 : 1,
                            }}
                        >
                            🖨️ {batchCount > 0 ? `${batchCount} etiketi yazdır` : "Yazdırılacak etiket yok"}
                        </button>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: "0.72rem", color: C.muted }}>
                            {pdfItems.length > 0 && `${pdfItems.length} PDF · `}
                            {portalItems.length > 0 && `${portalItems.length} portal · `}
                            {failItems.length > 0 && `${failItems.length} hata`}
                        </span>
                    </footer>

                    {/* Yazdırma için A4 kartlar ekran dışında render edilir (barkod DOM'u oluşsun) */}
                    <div style={{ position: "absolute", left: -99999, top: 0, width: "210mm", pointerEvents: "none" }} aria-hidden>
                        {items.map((it, idx) =>
                            it.kind === "card" && it.labelData ? (
                                <MarketplaceCargoLabelCard
                                    key={`card-${it.order._id || idx}`}
                                    data={it.labelData}
                                    printRef={(el) => {
                                        cardRefs.current[idx] = el;
                                    }}
                                />
                            ) : null
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
