import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaInfoCircle } from "react-icons/fa";
import { loadBarcodeLabelDraft } from "./barcodeLabelUtils";
import "../../../styles/ecommerceBarcodeLabel.css";
import "../../../styles/ecommerceProducts.css";

const EcommerceBarcodeLabelContinuePage = ({ onNavigate }) => {
    const [draft, setDraft] = useState(null);

    useEffect(() => {
        setDraft(loadBarcodeLabelDraft());
    }, []);

    if (!draft?.lines?.length) {
        return (
            <div className="ec-prod-page ec-barcode-label-page">
                <div className="ec-prod-panel ec-barcode-label-panel">
                    <div className="ec-barcode-label-body">
                        <div className="ec-barcode-label-empty">
                            <h2>Ürün seçilmedi</h2>
                            <p>Önce ürün ekleyerek devam edin.</p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={() => onNavigate?.("ec-products-barcode")}
                            >
                                Geri dön
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const totalLabels = draft.lines.reduce((s, l) => s + (Number(l.quantity) || 1), 0);

    return (
        <div className="ec-prod-page ec-barcode-label-page">
            <div className="ec-prod-panel ec-barcode-label-panel">
                <header className="ec-prod-head ec-barcode-label-head">
                    <div className="ec-barcode-label-head__left">
                        <button
                            type="button"
                            className="ec-barcode-label-back"
                            onClick={() => onNavigate?.("ec-products-barcode")}
                            aria-label="Geri"
                        >
                            <FaArrowLeft />
                        </button>
                        <h1>
                            Etiket Önizleme
                            <FaInfoCircle className="ec-barcode-label-head__info" aria-hidden="true" />
                        </h1>
                    </div>
                </header>

                <div className="ec-barcode-label-body">
                    <p className="ec-barcode-label-summary">
                        <strong>{draft.locationId}</strong> ·{" "}
                        {draft.priceListId === "compare" ? "Liste Fiyatı" : "Varsayılan"} ·{" "}
                        {draft.lines.length} ürün satırı · {totalLabels} etiket
                    </p>

                    <ul className="ec-barcode-label-preview-list">
                        {draft.lines.map((line) => (
                            <li key={line.key}>
                                <span className="ec-barcode-label-preview-list__title">{line.title}</span>
                                <span className="ec-barcode-label-preview-list__meta">
                                    {line.barcode || "Barkodsuz"} · Adet: {line.quantity}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <p className="ec-barcode-label-coming">
                        Etiket şablonu ve yazdırma adımı bir sonraki sürümde eklenecek.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EcommerceBarcodeLabelContinuePage;
