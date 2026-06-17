import React from "react";
import { FaPalette, FaCheck } from "react-icons/fa";

const THEME_PREVIEW = {
    minimal: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    boutique: "linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #e9d5ff 100%)",
    classic: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
};

const StoreDesignPanel = ({ store, themes, onSelectTheme }) => (
    <div className="store-ikas-page">
        <header className="store-ikas-page-header">
            <div>
                <h1 className="store-ikas-title">Tasarım & Tema</h1>
                <p className="store-ikas-subtitle">Mağaza vitrininizin görünümünü seçin. Yayınladıktan sonra değiştirebilirsiniz.</p>
            </div>
        </header>

        <section className="store-ikas-card">
            <div className="store-ikas-card-head">
                <div className="store-ikas-card-icon store-ikas-card-icon--teal">
                    <FaPalette />
                </div>
                <div>
                    <h2>Tema galerisi</h2>
                    <p>Aktif tema: <strong>{themes.find((t) => t.id === store.themeId)?.name || store.themeId}</strong></p>
                </div>
            </div>

            <div className="store-ikas-theme-grid">
                {(themes.length ? themes : [{ id: "minimal", name: "Minimal", description: "Sade grid" }]).map((t) => {
                    const active = store.themeId === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            className={`store-ikas-theme-card ${active ? "store-ikas-theme-card--active" : ""}`}
                            onClick={() => onSelectTheme(t.id)}
                        >
                            <div
                                className="store-ikas-theme-preview"
                                style={{ background: THEME_PREVIEW[t.id] || THEME_PREVIEW.minimal }}
                            >
                                <div className="store-ikas-theme-preview__bar" />
                                <div className="store-ikas-theme-preview__grid">
                                    <span /><span /><span />
                                </div>
                            </div>
                            <div className="store-ikas-theme-card__body">
                                <strong>{t.name}</strong>
                                {t.description && <p>{t.description}</p>}
                            </div>
                            {active && (
                                <span className="store-ikas-theme-card__badge">
                                    <FaCheck /> Seçili
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>

        <section className="store-ikas-card store-ikas-card--muted">
            <h3 className="store-ikas-card-title-sm">Renk & logo (yakında)</h3>
            <p className="store-ikas-field-hint">
                Marka rengi, logo ve font özelleştirmesi bir sonraki güncellemede eklenecek.
            </p>
        </section>
    </div>
);

export default StoreDesignPanel;
