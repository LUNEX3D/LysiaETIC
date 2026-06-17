import React from "react";
import { FaRocket, FaSync, FaExternalLinkAlt, FaShoppingCart, FaCreditCard } from "react-icons/fa";

const StoreOverviewPanel = ({ store, stats, publicUrl, onPublish, onUnpublish, onSyncProducts }) => (
    <div className="store-ikas-page">
        <header className="store-ikas-page-header store-ikas-page-header--row">
            <div>
                <h1 className="store-ikas-title">{store.name}</h1>
                <p className="store-ikas-subtitle">
                    Mağaza durumu:{" "}
                    <span className={`store-ikas-pill store-ikas-pill--${store.status === "published" ? "success" : "neutral"}`}>
                        {store.status === "published" ? "Yayında" : "Taslak"}
                    </span>
                </p>
            </div>
            {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="store-ikas-btn store-ikas-btn--ghost">
                    <FaExternalLinkAlt /> Mağazayı görüntüle
                </a>
            )}
        </header>

        <div className="store-ikas-kpi-grid">
            <div className="store-ikas-kpi">
                <FaShoppingCart />
                <div>
                    <span>Ödenen sipariş</span>
                    <strong>{stats?.orders?.paid ?? 0}</strong>
                </div>
            </div>
            <div className="store-ikas-kpi">
                <FaCreditCard />
                <div>
                    <span>Bekleyen ödeme</span>
                    <strong>{stats?.orders?.pending ?? 0}</strong>
                </div>
            </div>
        </div>

        <section className="store-ikas-card">
            <h2>Hızlı işlemler</h2>
            <div className="store-ikas-actions-row">
                {store.status !== "published" ? (
                    <button type="button" className="store-ikas-btn store-ikas-btn--primary" onClick={onPublish}>
                        <FaRocket /> Mağazayı yayınla
                    </button>
                ) : (
                    <button type="button" className="store-ikas-btn store-ikas-btn--ghost" onClick={onUnpublish}>
                        Taslağa al
                    </button>
                )}
                <button type="button" className="store-ikas-btn store-ikas-btn--ghost" onClick={onSyncProducts}>
                    <FaSync /> Ürünleri senkronize et
                </button>
            </div>
            <p className="store-ikas-field-hint" style={{ marginTop: 16 }}>
                Yayınlamadan önce PayTR ayarlarını tamamlayın ve domain sekmesinden adresinizi yapılandırın.
            </p>
        </section>
    </div>
);

export default StoreOverviewPanel;
