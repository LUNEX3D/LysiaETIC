import React, { useRef, useEffect } from "react";
import {
    FaArrowLeft,
    FaEllipsisV,
    FaGlobe,
    FaTimes,
    FaChartLine,
    FaHistory,
    FaCopy,
    FaTrash,
    FaPencilAlt,
} from "react-icons/fa";

const ProductFormHeader = ({
    isEdit,
    isVariant,
    title,
    saving,
    storeHost,
    channelsOpen,
    setChannelsOpen,
    channelHidden,
    setChannelHidden,
    channelQtyLimits,
    setChannelQtyLimits,
    moreOpen,
    setMoreOpen,
    onBack,
    onSave,
    onSaveClosed,
    onCopy,
    onDelete,
    onTranslations,
}) => {
    const moreRef = useRef(null);

    useEffect(() => {
        if (!moreOpen) return undefined;
        const close = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [moreOpen, setMoreOpen]);

    const editLabel = isVariant ? "Varyantlı Ürün Düzenle" : "Basit Ürün Düzenle";

    return (
        <>
            <header className={`ec-prod-form-topbar ${isEdit ? "ec-prod-form-topbar--edit" : ""}`}>
                <div className="ec-prod-form-topbar__left">
                    <button type="button" onClick={onBack} aria-label="Geri" className="ec-prod-icon-btn">
                        <FaArrowLeft />
                    </button>
                    <nav className="ec-prod-breadcrumb" aria-label="Breadcrumb">
                        <button type="button" className="ec-prod-breadcrumb__link" onClick={onBack}>
                            Ürünler
                        </button>
                        <span className="ec-prod-breadcrumb__sep">&gt;</span>
                        <span>{isEdit ? editLabel : isVariant ? "Varyantlı Ürün Ekle" : "Basit Ürün Ekle"}</span>
                    </nav>
                </div>

                {isEdit && (
                    <h1 className="ec-prod-form-topbar__title" title={title}>
                        {title || "Ürün"}
                    </h1>
                )}

                <div className="ec-prod-head-actions">
                    {isEdit && (
                        <>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--channels"
                                onClick={() => {
                                    setChannelsOpen(true);
                                    setMoreOpen(false);
                                }}
                            >
                                <span className="ec-prod-status-dot" />
                                Satış Kanalları (1)
                            </button>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={saving}
                                onClick={onSave}
                            >
                                Kaydet
                            </button>
                            <div className="ec-prod-more-wrap" ref={moreRef}>
                                <button
                                    type="button"
                                    className="ec-prod-icon-btn"
                                    aria-label="Diğer işlemler"
                                    onClick={() => setMoreOpen(!moreOpen)}
                                >
                                    <FaEllipsisV />
                                </button>
                                {moreOpen && (
                                    <div className="ec-prod-more-menu">
                                        <button type="button" onClick={() => alert("Stok hareketleri yakında.")}>
                                            <FaChartLine /> Stok Hareketleri
                                        </button>
                                        <button type="button" onClick={() => alert("Ürün geçmişi yakında.")}>
                                            <FaHistory /> Ürün Geçmişi
                                        </button>
                                        <button type="button" onClick={onCopy}>
                                            <FaCopy /> Ürünü Kopyala
                                        </button>
                                        <button type="button" className="ec-prod-more-menu__danger" onClick={onDelete}>
                                            <FaTrash /> Ürünü Sil
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {!isEdit && (
                        <>
                            <button type="button" className="ec-prod-btn" disabled={saving} onClick={onSaveClosed}>
                                Satışa Kapalı Kaydet
                            </button>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={saving}
                                onClick={onSave}
                            >
                                Kaydet
                            </button>
                        </>
                    )}
                </div>
            </header>

            {channelsOpen && (
                <div className="ec-prod-drawer-backdrop" onClick={() => setChannelsOpen(false)}>
                    <aside className="ec-prod-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="ec-prod-drawer__head">
                            <h2>Satış Kanalları</h2>
                            <button type="button" className="ec-prod-icon-btn" onClick={() => setChannelsOpen(false)}>
                                <FaTimes />
                            </button>
                        </div>
                        <div className="ec-prod-drawer__body">
                            <div className="ec-prod-channel-row">
                                <div className="ec-prod-channel-row__info">
                                    <FaGlobe />
                                    <div>
                                        <strong>{storeHost || "Online Mağaza"}</strong>
                                        <span>Online Mağaza</span>
                                    </div>
                                </div>
                                <label className="ec-prod-switch">
                                    <input type="checkbox" defaultChecked />
                                    <span />
                                </label>
                            </div>
                            <label className="ec-prod-drawer-check">
                                <input
                                    type="checkbox"
                                    checked={channelHidden}
                                    onChange={(e) => setChannelHidden(e.target.checked)}
                                />
                                Bu ürünü arama ve kategori sayfalarında gizle
                            </label>
                            <label className="ec-prod-drawer-check">
                                <input
                                    type="checkbox"
                                    checked={channelQtyLimits}
                                    onChange={(e) => setChannelQtyLimits(e.target.checked)}
                                />
                                Sepet başına minimum ve maksimum satın alma adedini belirle
                            </label>
                        </div>
                    </aside>
                </div>
            )}
        </>
    );
};

export const ProductFormTabs = ({ tabs, tab, onTab, isEdit, onTranslations }) => (
    <div className="ec-prod-tabs-row">
        <nav className="ec-prod-tabs">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    className={`ec-prod-tab ${tab === t.id ? "ec-prod-tab--active" : ""}`}
                    onClick={() => onTab(t.id)}
                >
                    {t.label}
                </button>
            ))}
        </nav>
        {isEdit && (
            <button type="button" className="ec-prod-translations-btn" onClick={onTranslations}>
                <FaPencilAlt /> Çevirileri Düzenle
            </button>
        )}
    </div>
);

export default ProductFormHeader;
