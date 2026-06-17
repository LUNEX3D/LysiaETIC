import React, { useCallback, useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaPen,
    FaChevronLeft,
    FaChevronRight,
    FaLock,
    FaUser,
    FaUserCheck,
    FaBoxOpen,
    FaMapMarkerAlt,
} from "react-icons/fa";
import {
    fetchStoreCustomer,
    fetchStoreCustomers,
    updateStoreCustomer,
} from "../../../services/storeApi";
import {
    fmtTry,
    fmtCustomerDate,
    customerFullName,
} from "./customerUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

function formatPhone(c) {
    if (!c?.phone) return "—";
    const code = c.phoneCountryCode || "";
    const sep = code && c.phone ? " " : "";
    return `${code}${sep}${c.phone}`;
}

function formatAddressLine(a) {
    return [a.line1, a.district, a.city, a.country].filter(Boolean).join(", ");
}

const EcommerceCustomerDetailPage = ({ customerId, onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [customer, setCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [siblingIds, setSiblingIds] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [res, listRes] = await Promise.all([
                fetchStoreCustomer(customerId),
                fetchStoreCustomers(),
            ]);
            setCustomer(res.customer);
            setOrders(res.orders || []);
            setSiblingIds((listRes.customers || []).map((c) => String(c._id)));
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        load();
    }, [load]);

    const navIndex = siblingIds.indexOf(String(customerId));
    const hasPrev = navIndex > 0;
    const hasNext = navIndex >= 0 && navIndex < siblingIds.length - 1;

    const submitComment = async () => {
        if (!comment.trim()) return;
        setSaving(true);
        try {
            const res = await updateStoreCustomer(customerId, { comment: comment.trim() });
            setCustomer(res.customer);
            setComment("");
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const goEdit = () => onNavigate?.(`ec-customer-edit-${customerId}`);

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    if (!customer) {
        return (
            <div className="ec-prod-page">
                <div className="ec-prod-empty">Müşteri bulunamadı</div>
            </div>
        );
    }

    const orderCount = customer.orderCount || 0;
    const totalSpent = customer.totalSpent || 0;
    const avgCart = orderCount > 0 ? totalSpent / orderCount : 0;
    const timeline = [...(customer.timeline || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const langLabel =
        customer.preferredLanguage === "en"
            ? "English"
            : customer.preferredLanguage === "tr"
              ? "Türkçe"
              : "—";

    return (
        <div className="ec-prod-page ec-customer-detail-page">
            <div className="ec-prod-panel ec-customer-detail-panel">
                <header className="ec-customer-detail-topbar">
                    <div className="ec-customer-detail-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn ec-customer-detail-topbar__icon"
                            onClick={() => onNavigate?.("ec-customers")}
                            aria-label="Geri"
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-customer-detail-crumb" aria-label="Konum">
                            <button type="button" onClick={() => onNavigate?.("ec-customers")}>
                                Müşteriler
                            </button>
                            <span>&gt;</span>
                            <span>Müşteri Detayı</span>
                        </nav>
                    </div>
                    <div className="ec-customer-detail-topbar__right">
                        <button
                            type="button"
                            className="ec-prod-icon-btn ec-customer-detail-topbar__icon"
                            disabled={!hasPrev}
                            onClick={() => onNavigate?.(`ec-customer-${siblingIds[navIndex - 1]}`)}
                            aria-label="Önceki müşteri"
                        >
                            <FaChevronLeft />
                        </button>
                        <button
                            type="button"
                            className="ec-prod-icon-btn ec-customer-detail-topbar__icon"
                            disabled={!hasNext}
                            onClick={() => onNavigate?.(`ec-customer-${siblingIds[navIndex + 1]}`)}
                            aria-label="Sonraki müşteri"
                        >
                            <FaChevronRight />
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary ec-customer-detail-edit-btn"
                            onClick={goEdit}
                        >
                            <FaPen /> Düzenle
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="ec-purchase-form-error ec-customer-detail-error">{error}</div>
                )}

                <div className="ec-customer-detail-hero">
                    <div className="ec-customer-detail-hero__title">
                        <h1>{customerFullName(customer)}</h1>
                        <span
                            className={`ec-customer-detail-status${customer.hasAccount ? " ec-customer-detail-status--ok" : ""}`}
                        >
                            {customer.hasAccount ? <FaUserCheck /> : <FaUser />}
                            {customer.hasAccount ? "Hesabı Var" : "Hesabı Yok"}
                        </span>
                    </div>
                    <div className="ec-customer-detail-info-grid">
                        <div className="ec-customer-detail-info-cell">
                            <span className="ec-customer-detail-info-grid__label">E-Posta</span>
                            <a
                                href={customer.email ? `mailto:${customer.email}` : undefined}
                                className="ec-customer-detail-info-grid__value"
                            >
                                {customer.email || "—"}
                            </a>
                            {customer.marketingEmailConsent && (
                                <span className="ec-customer-badge ec-customer-badge--ok">
                                    E-Posta İzni Var
                                </span>
                            )}
                        </div>
                        <div className="ec-customer-detail-info-cell">
                            <span className="ec-customer-detail-info-grid__label">Telefon Numarası</span>
                            <strong className="ec-customer-detail-info-grid__value">
                                {formatPhone(customer)}
                            </strong>
                        </div>
                        <div className="ec-customer-detail-info-cell">
                            <span className="ec-customer-detail-info-grid__label">Üyelik Tarihi</span>
                            <strong className="ec-customer-detail-info-grid__value">
                                {customer.hasAccount ? fmtCustomerDate(customer.createdAt) : "—"}
                            </strong>
                        </div>
                        <div className="ec-customer-detail-info-cell">
                            <span className="ec-customer-detail-info-grid__label">En Son Ziyaret</span>
                            <strong className="ec-customer-detail-info-grid__value">—</strong>
                        </div>
                        <div className="ec-customer-detail-info-cell">
                            <span className="ec-customer-detail-info-grid__label">Dil Tercihi</span>
                            <strong className="ec-customer-detail-info-grid__value">{langLabel}</strong>
                        </div>
                    </div>
                    {(customer.groups?.length > 0 || customer.tags?.length > 0) && (
                        <div className="ec-customer-detail-tags-row">
                            {customer.groups?.map((g) => (
                                <span key={`g-${g}`} className="ec-customer-detail-meta-chip">
                                    {g}
                                </span>
                            ))}
                            {customer.tags?.map((t) => (
                                <span key={`t-${t}`} className="ec-customer-detail-meta-chip ec-customer-detail-meta-chip--tag">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ec-customer-stats">
                    <div>
                        <span>Toplam Satış Tutarı</span>
                        <strong>{fmtTry(totalSpent)}</strong>
                    </div>
                    <div>
                        <span>Toplam Sipariş Sayısı</span>
                        <strong>{orderCount}</strong>
                    </div>
                    <div>
                        <span>Ort. Sepet Tutarı</span>
                        <strong>{fmtTry(avgCart)}</strong>
                    </div>
                    <div>
                        <span>Ort. Sepet Büyüklüğü</span>
                        <strong>0.00</strong>
                    </div>
                </div>

                <div className="ec-customer-detail-body">
                    <div className="ec-customer-detail-grid">
                        <aside className="ec-customer-detail-card ec-customer-detail-card--addresses">
                            <h3>Adresler</h3>
                            {(customer.addresses || []).length === 0 ? (
                                <div className="ec-customer-detail-mini-empty">
                                    <FaMapMarkerAlt className="ec-customer-detail-mini-empty__icon" />
                                    <p>
                                        Müşteriye ait henüz bir adres yok.{" "}
                                        <button type="button" className="ec-customer-detail-inline-link" onClick={goEdit}>
                                            Adres eklemek için düzenleye basınız.
                                        </button>
                                    </p>
                                </div>
                            ) : (
                                <ul className="ec-customer-detail-addresses">
                                    {customer.addresses.map((a, i) => (
                                        <li key={i}>
                                            <div className="ec-customer-detail-address-head">
                                                <strong>{a.title || "Adres"}</strong>
                                                {a.isDefault && (
                                                    <span className="ec-customer-detail-address-default">Varsayılan</span>
                                                )}
                                            </div>
                                            <p>{formatAddressLine(a)}</p>
                                            {a.invoiceType === "corporate" && a.companyName && (
                                                <p className="ec-customer-detail-address-corp">{a.companyName}</p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </aside>

                        <section className="ec-customer-detail-card ec-customer-detail-card--orders">
                            <h3 className="ec-customer-orders-card__title">Siparişler</h3>
                            {orders.length === 0 ? (
                                <div className="ec-customer-orders-empty">
                                    <span className="ec-customer-orders-empty__icon" aria-hidden>
                                        <FaBoxOpen />
                                    </span>
                                    <p>
                                        Siparişleriniz burada gösterilecek. Müşterilerden sipariş almak ve
                                        ödeme kabul etmek için bu alanı kullanabilirsiniz.
                                    </p>
                                </div>
                            ) : (
                                <div className="ec-orders-table-wrap">
                                    <table className="ec-orders-table">
                                        <thead>
                                            <tr>
                                                <th>Sipariş</th>
                                                <th>Tarih</th>
                                                <th>Toplam</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((o) => (
                                                <tr
                                                    key={o._id}
                                                    className="ec-customer-order-row"
                                                    onClick={() => onNavigate?.(`ec-order-${o._id}`)}
                                                >
                                                    <td>#{o.orderNumber || String(o._id).slice(-6)}</td>
                                                    <td>{fmtCustomerDate(o.createdAt)}</td>
                                                    <td>{fmtTry(o.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="ec-customer-detail-card ec-customer-detail-card--timeline">
                        <h3>Zaman Çizelgesi</h3>
                        <div className="ec-customer-timeline-compose">
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Yorum yaz..."
                                rows={2}
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
                        <p className="ec-customer-timeline-privacy">
                            <FaLock /> Yorumları sadece siz ve diğer personel görebilir.
                        </p>
                        {timeline.length === 0 ? (
                            <p className="ec-customer-detail-timeline-empty">Henüz kayıt yok.</p>
                        ) : (
                            <ul className="ec-customer-timeline-list">
                                {timeline.map((ev, i) => (
                                    <li key={i}>
                                        <div className="ec-customer-timeline-list__dot" />
                                        <div>
                                            <p>{ev.message}</p>
                                            <time>{fmtCustomerDate(ev.createdAt)}</time>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default EcommerceCustomerDetailPage;
