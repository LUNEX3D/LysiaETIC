import React, { useState, useEffect, useCallback } from "react";
import { FaInfoCircle, FaPlus, FaArrowLeft } from "react-icons/fa";
import { fetchStore, fetchStorePurchases } from "../../../services/storeApi";
import PurchaseEmptyIllustration from "./PurchaseEmptyIllustration";

const STATUS_LABELS = {
    draft: "Taslak",
    ordered: "Sipariş verildi",
    in_transit: "Yolda",
    received: "Teslim alındı",
    cancelled: "İptal",
};

const fmtTry = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(v || 0));
    } catch {
        return `${Number(v || 0).toFixed(2)} ₺`;
    }
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return "—";
    }
};

const EcommercePurchasesPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState([]);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Önce mağazanızı oluşturun (Satış Kanalları).");
                setPurchases([]);
                return;
            }
            const res = await fetchStorePurchases();
            setPurchases(res.purchases || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return <div className="ec-prod-empty">Satın almalar yükleniyor…</div>;
    }

    if (error && !purchases.length) {
        return (
            <div className="ec-prod-page">
                <div className="ec-prod-panel">
                    <div className="ec-prod-empty">
                        <p style={{ color: "var(--ec-red)" }}>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (purchases.length === 0) {
        return (
            <div className="ec-prod-page ec-purchase-page">
                <div className="ec-prod-panel ec-prod-panel--purchase-empty">
                    <div className="ec-purchase-empty">
                        <PurchaseEmptyIllustration />
                        <h1 className="ec-purchase-empty__title">
                            Satın Alma Oluşturun
                            <FaInfoCircle
                                className="ec-purchase-empty__info"
                                title="Tedarikçilerden aldığınız ürünleri kaydederek stok ve sevkiyat takibi yapın"
                            />
                        </h1>
                        <p className="ec-purchase-empty__desc">
                            Tedarikçilerinizden satın aldığınız ürünleri Dashtock&apos;a girerek ürünlerinizin
                            sevkiyat durumlarını takip edebilirsiniz.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary ec-purchase-empty__cta"
                            onClick={() => onNavigate?.("ec-purchase-add")}
                        >
                            <FaPlus /> Satın Alma Ekle
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ec-prod-page ec-purchase-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Satın Alma
                        <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <div className="ec-prod-head-actions">
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-purchase-add")}
                        >
                            <FaPlus /> Satın Alma Ekle
                        </button>
                    </div>
                </header>

                {error && (
                    <div style={{ padding: "0.75rem 1.15rem", color: "var(--ec-red)" }}>{error}</div>
                )}

                <div className="ec-prod-table-wrap">
                    <table className="ec-prod-table ec-prod-table--purchases">
                        <thead>
                            <tr>
                                <th>Satın alma no</th>
                                <th>Tedarikçi</th>
                                <th>Durum</th>
                                <th>Tutar</th>
                                <th>Kalem</th>
                                <th>Tarih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((p) => (
                                <tr
                                    key={p._id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => onNavigate?.(`ec-purchase-edit-${p._id}`)}
                                >
                                    <td>
                                        <strong>{p.purchaseNumber || "—"}</strong>
                                    </td>
                                    <td>{p.supplierName || "—"}</td>
                                    <td>
                                        <span className={`ec-purchase-status ec-purchase-status--${p.status || "draft"}`}>
                                            {STATUS_LABELS[p.status] || p.status}
                                        </span>
                                    </td>
                                    <td>{fmtTry(p.totalCost)}</td>
                                    <td>{p.itemCount ?? p.lines?.length ?? 0}</td>
                                    <td>{fmtDate(p.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="ec-prod-table-footer">{purchases.length} satın alma</div>
            </div>
        </div>
    );
};

export default EcommercePurchasesPage;
