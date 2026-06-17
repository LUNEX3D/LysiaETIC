import React, { useState, useEffect, useCallback } from "react";
import { FaPlus, FaInfoCircle } from "react-icons/fa";
import { fetchStore, fetchStoreTransfers } from "../../../services/storeApi";
import TransferEmptyIllustration from "./TransferEmptyIllustration";

const STATUS_LABELS = {
    draft: "Taslak",
    confirmed: "Onaylandı",
    in_transit: "Yolda",
    completed: "Tamamlandı",
    cancelled: "İptal",
};

const EcommerceTransfersPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [transfers, setTransfers] = useState([]);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Önce mağazanızı oluşturun (Satış Kanalları).");
                setTransfers([]);
                return;
            }
            const res = await fetchStoreTransfers();
            setTransfers(res.transfers || []);
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
        return <div className="ec-prod-empty">Transferler yükleniyor…</div>;
    }

    if (error && !transfers.length) {
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

    if (transfers.length === 0) {
        return (
            <div className="ec-prod-page ec-purchase-page">
                <div className="ec-prod-panel ec-prod-panel--purchase-empty">
                    <div className="ec-purchase-empty">
                        <TransferEmptyIllustration />
                        <h1 className="ec-purchase-empty__title">
                            Transfer Oluşturun
                            <FaInfoCircle className="ec-purchase-empty__info" title="Şubeler arası stok transferi" />
                        </h1>
                        <p className="ec-purchase-empty__desc">
                            Depolarınız veya şubeleriniz arasında ürün transferi oluşturarak stok hareketlerini
                            takip edebilirsiniz.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary ec-purchase-empty__cta"
                            onClick={() => onNavigate?.("ec-transfer-add")}
                        >
                            <FaPlus /> Transfer Ekle
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ec-prod-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Transferler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => onNavigate?.("ec-transfer-add")}
                    >
                        <FaPlus /> Transfer Ekle
                    </button>
                </header>
                <div className="ec-prod-table-wrap">
                    <table className="ec-prod-table ec-prod-table--purchases">
                        <thead>
                            <tr>
                                <th>Transfer no</th>
                                <th>İrsaliye</th>
                                <th>Çıkış → Giriş</th>
                                <th>Durum</th>
                                <th>Kalem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.map((t) => (
                                <tr
                                    key={t._id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => onNavigate?.(`ec-transfer-edit-${t._id}`)}
                                >
                                    <td>
                                        <strong>{t.transferNumber}</strong>
                                    </td>
                                    <td>{t.waybillNumber || "—"}</td>
                                    <td>
                                        {t.fromBranch} → {t.toBranch}
                                    </td>
                                    <td>
                                        <span className={`ec-purchase-status ec-purchase-status--${t.status}`}>
                                            {STATUS_LABELS[t.status] || t.status}
                                        </span>
                                    </td>
                                    <td>{t.itemCount ?? t.lines?.length ?? 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EcommerceTransfersPage;
