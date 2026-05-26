import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { resolveCargoBrand } from "../../utils/cargoBrand";
import "../../styles/TrendyolCargoLabel.css";

function CargoBrandMark({ cargoCompany, marketplace }) {
    const brand = resolveCargoBrand(cargoCompany);
    const mp = String(marketplace || "").toLowerCase();
    const cls = `ty-cargo-label__logo-cargo ty-cargo-label__logo-cargo--${brand.key}`;

    if (brand.key === "express" && mp.includes("trendyol")) {
        return (
            <div className={cls}>
                trendyol
                <span>express</span>
            </div>
        );
    }

    return (
        <div className={cls}>
            {brand.title}
            {brand.subtitle ? <span>{brand.subtitle}</span> : null}
        </div>
    );
}

/**
 * Pazaryeri A4 kargo etiketi — Trendyol, ÇiçekSepeti, N11, Amazon, PttAVM
 */
export default function MarketplaceCargoLabelCard({ data, printRef }) {
    const barcodeRef = useRef(null);
    const d = data || {};
    const barcodeValue = String(d.cargoTrackingNumber || "").replace(/\s/g, "").trim();
    const brandTitle = d.brandTitle || "pazaryeri.com";

    useEffect(() => {
        if (!barcodeRef.current || !barcodeValue) return;
        try {
            JsBarcode(barcodeRef.current, barcodeValue, {
                format: "CODE128",
                width: 2,
                height: 70,
                displayValue: false,
                margin: 6,
            });
        } catch {
            /* ignore */
        }
    }, [barcodeValue]);

    return (
        <div className={`ty-cargo-label cargo-label-print-root ty-cargo-label--${d.marketplace || "generic"}`} ref={printRef}>
            <div className="ty-cargo-label__warn">
                <span className="ty-cargo-label__warn-icon" aria-hidden>
                    ⚠
                </span>
                <p>{d.warningText || "Kargo şirketinin dikkatine, pazaryeri gönderisidir."}</p>
            </div>

            <div className="ty-cargo-label__head">
                <div className="ty-cargo-label__logo-main">{brandTitle}</div>
                <CargoBrandMark cargoCompany={d.cargoCompany} marketplace={d.marketplace} />
            </div>

            <div className="ty-cargo-label__grid">
                <section className="ty-cargo-label__box">
                    <h3>Alıcı Bilgileri</h3>
                    <dl>
                        <div className="ty-cargo-label__row">
                            <dt>Sipariş No</dt>
                            <dd>{d.orderNumber || "—"}</dd>
                        </div>
                        {d.orderItemId ? (
                            <div className="ty-cargo-label__row">
                                <dt>Alt Sipariş</dt>
                                <dd>{d.orderItemId}</dd>
                            </div>
                        ) : null}
                        {d.shipmentNumber ? (
                            <div className="ty-cargo-label__row">
                                <dt>Teslimat / Kargo Kodu</dt>
                                <dd>{d.shipmentNumber}</dd>
                            </div>
                        ) : null}
                        <div className="ty-cargo-label__row">
                            <dt>Ad-Soyad</dt>
                            <dd>{d.customerName || "—"}</dd>
                        </div>
                        <div className="ty-cargo-label__row">
                            <dt>Adres</dt>
                            <dd>{d.fullAddress || "—"}</dd>
                        </div>
                        {d.departureBranch && d.departureBranch !== "—" ? (
                            <div className="ty-cargo-label__row">
                                <dt>Çıkış Şubesi</dt>
                                <dd>{d.departureBranch}</dd>
                            </div>
                        ) : null}
                    </dl>
                </section>

                <section className="ty-cargo-label__box ty-cargo-label__box--barcode">
                    <h3>Kargo Barkodu</h3>
                    <div className="ty-cargo-label__barcode">
                        <svg ref={barcodeRef} />
                        <div className="ty-cargo-label__barcode-num">{barcodeValue || "—"}</div>
                    </div>
                </section>
            </div>
        </div>
    );
}
