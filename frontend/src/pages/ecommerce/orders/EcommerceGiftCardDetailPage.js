import React, { useCallback, useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaLock,
    FaPen,
    FaTrash,
    FaInfoCircle,
} from "react-icons/fa";
import {
    fetchStoreGiftCard,
    updateStoreGiftCard,
    deleteStoreGiftCard,
} from "../../../services/storeApi";
import {
    fmtTry,
    fmtGiftCardDate,
    fmtGiftCardDateTime,
    giftCardStatusLabel,
    giftCardStatusClass,
    customerDisplay,
    remainingBalance,
} from "./giftCardUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceGiftCards.css";
import "../../../styles/ecommerceProducts.css";

const EcommerceGiftCardDetailPage = ({ giftCardId, onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [card, setCard] = useState(null);
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreGiftCard(giftCardId);
            setCard(res.giftCard);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [giftCardId]);

    useEffect(() => {
        load();
    }, [load]);

    const submitComment = async () => {
        if (!comment.trim()) return;
        setSaving(true);
        try {
            const res = await updateStoreGiftCard(giftCardId, { comment: comment.trim() });
            setCard(res.giftCard);
            setComment("");
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!window.confirm("Bu hediye kartını silmek istediğinize emin misiniz?")) return;
        try {
            await deleteStoreGiftCard(giftCardId);
            onNavigate?.("ec-orders-gift-cards");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    if (loading) return <div className="ec-prod-empty">Yükleniyor…</div>;
    if (!card) {
        return (
            <div className="ec-prod-empty">
                {error || "Hediye kartı bulunamadı"}
                <button
                    type="button"
                    className="ec-prod-btn"
                    style={{ marginTop: "1rem" }}
                    onClick={() => onNavigate?.("ec-orders-gift-cards")}
                >
                    Listeye dön
                </button>
            </div>
        );
    }

    const channels = (card.salesChannelLabels || []).join(", ") || "—";

    return (
        <div className="ec-prod-page ec-gift-cards-page">
            <div className="ec-prod-panel" style={{ maxWidth: 900, margin: "0 auto" }}>
                <header className="ec-order-detail-topbar">
                    <div className="ec-order-detail-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-orders-gift-cards")}
                        >
                            <FaArrowLeft />
                        </button>
                        <h1>
                            <button
                                type="button"
                                className="ec-order-detail-topbar__crumb"
                                onClick={() => onNavigate?.("ec-orders-gift-cards")}
                            >
                                Hediye Kartları
                            </button>
                            <span className="ec-order-detail-topbar__sep"> &gt; </span>
                            {card.code}
                        </h1>
                        <span className={`ec-gift-card-badge ${giftCardStatusClass(card)}`}>
                            {giftCardStatusLabel(card)}
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                            type="button"
                            className="ec-prod-btn"
                            onClick={() => onNavigate?.(`ec-gift-card-edit-${giftCardId}`)}
                        >
                            <FaPen /> Düzenle
                        </button>
                        <button
                            type="button"
                            className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                            title="Sil"
                            onClick={remove}
                        >
                            <FaTrash />
                        </button>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div style={{ padding: "1.15rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <section className="ec-order-card">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "1rem",
                            }}
                        >
                            <h3 style={{ margin: 0 }}>Hediye Kartı</h3>
                            <span className={`ec-gift-card-badge ${giftCardStatusClass(card)}`}>
                                {giftCardStatusLabel(card)}
                            </span>
                        </div>
                        <dl className="ec-gift-card-detail-grid">
                            <div>
                                <dt>Hediye Kodu</dt>
                                <dd>
                                    <span className="ec-gift-card-code-pill">{card.code}</span>
                                </dd>
                            </div>
                            <div>
                                <dt>İlk Tutar</dt>
                                <dd>{fmtTry(card.initialAmount)}</dd>
                            </div>
                            <div>
                                <dt>Toplam Kullanılan Tutar</dt>
                                <dd>{fmtTry(card.usedAmount)}</dd>
                            </div>
                            <div>
                                <dt>Kalan Bakiye</dt>
                                <dd>{fmtTry(remainingBalance(card))}</dd>
                            </div>
                            <div>
                                <dt>Müşteri</dt>
                                <dd>{customerDisplay(card)}</dd>
                            </div>
                            <div>
                                <dt>Minimum Sipariş Tutarı</dt>
                                <dd>
                                    {card.minOrderAmount != null && card.minOrderAmount > 0
                                        ? fmtTry(card.minOrderAmount)
                                        : "—"}
                                </dd>
                            </div>
                            <div>
                                <dt>Başlangıç Tarihi</dt>
                                <dd>{card.startDate ? fmtGiftCardDate(card.startDate) : "—"}</dd>
                            </div>
                            <div>
                                <dt>Son Kullanma Tarihi</dt>
                                <dd>{card.endDate ? fmtGiftCardDate(card.endDate) : "—"}</dd>
                            </div>
                            <div>
                                <dt>Satış Kanalları</dt>
                                <dd>{channels}</dd>
                            </div>
                        </dl>
                    </section>

                    <section className="ec-order-card">
                        <h3>
                            Zaman Çizelgesi{" "}
                            <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                        </h3>
                        <div className="ec-order-timeline-compose">
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Yorum yaz..."
                            />
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={saving || !comment.trim()}
                                onClick={submitComment}
                            >
                                Gönder
                            </button>
                        </div>
                        <p className="ec-order-timeline-hint">
                            <FaLock style={{ marginRight: 4 }} />
                            Yorumları sadece siz ve diğer personel görebilir
                        </p>
                        <ul className="ec-order-timeline-list">
                            {[...(card.timeline || [])].reverse().map((ev, i) => (
                                <li key={i}>
                                    <strong>{ev.actor || "Sistem"}</strong> — {ev.message}
                                    <time>{fmtGiftCardDateTime(ev.createdAt)}</time>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default EcommerceGiftCardDetailPage;
