import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaInfoCircle,
    FaLock,
    FaChevronLeft,
    FaChevronRight,
    FaPen,
} from "react-icons/fa";
import {
    fetchStoreOrder,
    fetchStoreOrders,
    patchStoreOrder,
    fetchStoreOrderLabels,
} from "../../../services/storeApi";
import OrderLabelPickerModal from "./OrderLabelPickerModal";
import {
    fmtTry,
    fmtOrderDate,
    orderStatusBadgeClass,
    paymentStatusBadgeClass,
    formatAddress,
    ORDER_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
} from "./orderUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";

const EcommerceOrderDetailPage = ({ orderId, onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [order, setOrder] = useState(null);
    const [allLabels, setAllLabels] = useState([]);
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [labelModalOpen, setLabelModalOpen] = useState(false);
    const [siblingIds, setSiblingIds] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreOrder(orderId);
            const isDraft = !!res.order?.isDraft;
            const [listRes, labelsRes] = await Promise.all([
                fetchStoreOrders({ draft: isDraft ? "1" : "0" }),
                fetchStoreOrderLabels(),
            ]);
            setOrder(res.order);
            setAllLabels(labelsRes.labels || res.labels || []);
            const ids = (listRes.orders || []).map((o) => String(o._id));
            setSiblingIds(ids);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        load();
    }, [load]);

    const labelMap = useMemo(
        () => new Map(allLabels.map((l) => [String(l._id), l.name])),
        [allLabels]
    );

    const orderLabels = useMemo(
        () => (order?.labelIds || []).map((id) => labelMap.get(String(id))).filter(Boolean),
        [order, labelMap]
    );

    const navIndex = siblingIds.indexOf(String(orderId));
    const hasPrev = navIndex > 0;
    const hasNext = navIndex >= 0 && navIndex < siblingIds.length - 1;

    const submitComment = async () => {
        if (!comment.trim()) return;
        setSaving(true);
        try {
            const res = await patchStoreOrder(orderId, { comment: comment.trim() });
            setOrder(res.order);
            setComment("");
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const saveLabels = async (labelIds) => {
        try {
            const res = await patchStoreOrder(orderId, { labelIds });
            setOrder(res.order);
            setLabelModalOpen(false);
        } catch (e) {
            setError(e.response?.data?.error || "Etiketler kaydedilemedi");
        }
    };

    const removeLabel = async (labelId) => {
        const next = (order.labelIds || [])
            .map(String)
            .filter((id) => id !== String(labelId));
        await saveLabels(next);
    };

    const finalizeDraft = async () => {
        setSaving(true);
        try {
            const res = await patchStoreOrder(orderId, { isDraft: false, status: "processing" });
            setOrder(res.order);
        } catch (e) {
            setError(e.response?.data?.error || "Sipariş tamamlanamadı");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="ec-prod-empty">Yükleniyor…</div>;
    if (!order) {
        return (
            <div className="ec-prod-empty">
                {error || "Sipariş bulunamadı"}
                <button
                    type="button"
                    className="ec-prod-btn"
                    style={{ marginTop: "1rem" }}
                    onClick={() => onNavigate?.("ec-orders")}
                >
                    Siparişlere dön
                </button>
            </div>
        );
    }

    const tax = Number(order.taxAmount) || 0;
    const isDraft = !!order.isDraft;
    const backPanel = isDraft ? "ec-orders-drafts" : "ec-orders";
    const backLabel = isDraft ? "Taslaklar" : "Siparişler";

    return (
        <div className="ec-prod-page ec-orders-page ec-order-detail-page">
            <div className="ec-prod-panel" style={{ display: "flex", flexDirection: "column" }}>
                <header className="ec-order-detail-topbar">
                    <div className="ec-order-detail-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.(backPanel)}
                        >
                            <FaArrowLeft />
                        </button>
                        <h1>
                            <button
                                type="button"
                                className="ec-order-detail-topbar__crumb"
                                onClick={() => onNavigate?.(backPanel)}
                            >
                                {backLabel}
                            </button>
                            <span className="ec-order-detail-topbar__sep"> &gt; </span>
                            Sipariş #{order.orderNumber}
                        </h1>
                        {isDraft ? (
                            <span className="ec-order-badge ec-order-badge--default">Taslak</span>
                        ) : (
                            <span className={`ec-order-badge ${orderStatusBadgeClass(order.status)}`}>
                                {ORDER_STATUS_LABELS[order.status] || order.status}
                            </span>
                        )}
                        <span
                            className={`ec-order-badge ${paymentStatusBadgeClass(order.payment?.status)}`}
                        >
                            {PAYMENT_STATUS_LABELS[order.payment?.status] || order.payment?.status}
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        {isDraft && (
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={saving}
                                onClick={finalizeDraft}
                            >
                                Siparişi Tamamla
                            </button>
                        )}
                        <button
                            type="button"
                            className="ec-prod-btn"
                            disabled={!hasPrev}
                            onClick={() => onNavigate?.(`ec-order-${siblingIds[navIndex - 1]}`)}
                        >
                            <FaChevronLeft /> Önceki
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn"
                            disabled={!hasNext}
                            onClick={() => onNavigate?.(`ec-order-${siblingIds[navIndex + 1]}`)}
                        >
                            Sonraki <FaChevronRight />
                        </button>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-order-detail-layout">
                    <div className="ec-order-detail-main">
                        <section className="ec-order-card">
                            <h3>
                                {ORDER_STATUS_LABELS[order.status] || order.status} —{" "}
                                {(order.lineItems || []).length} ürün
                            </h3>
                            <table className="ec-order-lines-table">
                                <thead>
                                    <tr>
                                        <th>Ürün</th>
                                        <th>Adet</th>
                                        <th>Fiyat</th>
                                        <th>Toplam Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(order.lineItems || []).map((li, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="ec-order-lines-table__product">
                                                    <span
                                                        className="ec-order-lines-table__thumb"
                                                        aria-hidden
                                                    />
                                                    <span>{li.title || "Ürün"}</span>
                                                </div>
                                            </td>
                                            <td>{li.quantity}</td>
                                            <td>{fmtTry(li.unitPrice)}</td>
                                            <td>{fmtTry((li.quantity || 0) * (li.unitPrice || 0))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {(order.shippingCarrier || order.trackingNumber) && (
                                <div className="ec-order-meta-row">
                                    {order.shippingCarrier && (
                                        <div>Kargo Şirketi: {order.shippingCarrier}</div>
                                    )}
                                    {order.trackingNumber && (
                                        <div>
                                            Takip Numarası:{" "}
                                            <a href={`#track-${order.trackingNumber}`}>
                                                {order.trackingNumber}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="ec-order-card">
                            <h3>
                                Müşteri <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                            </h3>
                            <p className="ec-order-customer-name">{order.customer?.name}</p>
                            <p className="ec-order-customer-meta">
                                {order.customer?.email}
                                {order.customer?.phone ? (
                                    <>
                                        <br />
                                        {order.customer.phone}
                                    </>
                                ) : null}
                            </p>
                            <div className="ec-order-address-grid" style={{ marginTop: "1rem" }}>
                                <div className="ec-order-address-block">
                                    <strong>Sevkiyat Adresi</strong>
                                    <p>{formatAddress(order.shippingAddress)}</p>
                                </div>
                                <div className="ec-order-address-block">
                                    <strong>Fatura Adresi</strong>
                                    <p>{formatAddress(order.billingAddress || order.shippingAddress)}</p>
                                </div>
                            </div>
                        </section>

                        <section className="ec-order-card">
                            <h3>Zaman Çizelgesi</h3>
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
                                {[...(order.timeline || [])].reverse().map((ev, i) => (
                                    <li key={i}>
                                        <strong>{ev.actor || "Sistem"}</strong> — {ev.message}
                                        <time>{fmtOrderDate(ev.createdAt)}</time>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    <aside className="ec-order-detail-side">
                        <section className="ec-order-card">
                            <h3>Sipariş Özeti</h3>
                            <p style={{ fontSize: "0.84rem", margin: "0 0 0.75rem", opacity: 0.85 }}>
                                {fmtOrderDate(order.createdAt)}
                                <br />
                                {order.salesChannel ||
                                    (order.source === "manual" ? "Manuel Sipariş" : "Web")}
                            </p>
                            <div className="ec-order-summary-rows">
                                <div>
                                    <span>Ara Toplam</span>
                                    <span>{fmtTry(order.subtotal)}</span>
                                </div>
                                <div>
                                    <span>Kargo Tutarı</span>
                                    <span>{fmtTry(order.shippingCost)}</span>
                                </div>
                                {tax > 0 && (
                                    <div>
                                        <span>Vergi</span>
                                        <span>{fmtTry(tax)}</span>
                                    </div>
                                )}
                                <div className="ec-order-summary-rows__total">
                                    <span>Toplam</span>
                                    <span>{fmtTry(order.total)}</span>
                                </div>
                            </div>
                        </section>

                        <section className="ec-order-card">
                            <h3>Ödemeler</h3>
                            <button type="button" className="ec-prod-btn" style={{ width: "100%" }} disabled>
                                Ödeme Yöntemi Seç
                            </button>
                        </section>

                        <section className="ec-order-card ec-order-tags-card">
                            <div className="ec-order-tags-card__head">
                                <h3>
                                    Etiketler{" "}
                                    <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                                </h3>
                            </div>
                            <div className="ec-order-tags-field">
                                <div className="ec-order-tags-field__head">
                                    <label>Etiket</label>
                                    <button
                                        type="button"
                                        className="ec-order-tags-field__edit"
                                        onClick={() => setLabelModalOpen(true)}
                                        aria-label="Etiket ekle veya düzenle"
                                    >
                                        <FaPen />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="ec-order-tags-field__input"
                                    onClick={() => setLabelModalOpen(true)}
                                >
                                    Etiket Ekle
                                </button>
                                {orderLabels.length > 0 && (
                                    <div className="ec-order-tags-chips">
                                        {(order.labelIds || []).map((lid) => {
                                            const name = labelMap.get(String(lid));
                                            if (!name) return null;
                                            return (
                                                <span key={lid} className="ec-order-label-chip">
                                                    {name}
                                                    <button
                                                        type="button"
                                                        className="ec-order-label-chip__x"
                                                        aria-label="Kaldır"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeLabel(lid);
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>
                    </aside>
                </div>
            </div>

            <OrderLabelPickerModal
                open={labelModalOpen}
                title="Etiket Ekle"
                onClose={() => setLabelModalOpen(false)}
                labels={allLabels}
                selectedIds={(order.labelIds || []).map(String)}
                onSave={saveLabels}
                onLabelCreated={(label) => {
                    setAllLabels((prev) => {
                        if (prev.some((l) => String(l._id) === String(label._id))) return prev;
                        return [...prev, label].sort((a, b) =>
                            (a.name || "").localeCompare(b.name || "", "tr")
                        );
                    });
                }}
            />
        </div>
    );
};

export default EcommerceOrderDetailPage;
