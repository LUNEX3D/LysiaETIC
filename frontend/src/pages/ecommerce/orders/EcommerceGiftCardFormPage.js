import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaInfoCircle } from "react-icons/fa";
import {
    fetchStoreGiftCard,
    fetchStoreCartLinkSalesChannels,
    suggestStoreGiftCardCode,
    createStoreGiftCard,
    updateStoreGiftCard,
} from "../../../services/storeApi";
import {
    emptyGiftCardForm,
    giftCardToForm,
    formToGiftCardPayload,
} from "./giftCardUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceGiftCards.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceDefinitions.css";

const RequirementToggle = ({ checked, onChange, label, children }) => (
    <div className="ec-gift-card-req">
        <div className="ec-gift-card-req__head">
            <label className="ec-gift-card-req__toggle">
                <span className="ec-gift-card-switch">
                    <input type="checkbox" checked={checked} onChange={onChange} />
                    <span aria-hidden />
                </span>
                <span className="ec-gift-card-req__label">{label}</span>
            </label>
        </div>
        {checked && children ? <div className="ec-gift-card-req__body">{children}</div> : null}
    </div>
);

const EcommerceGiftCardFormPage = ({ giftCardId, onNavigate }) => {
    const isEdit = !!giftCardId;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptyGiftCardForm);
    const [channels, setChannels] = useState([]);
    const [codeLabel, setCodeLabel] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const chRes = await fetchStoreCartLinkSalesChannels();
            const ch = chRes.channels || [];
            setChannels(ch);

            if (isEdit) {
                const res = await fetchStoreGiftCard(giftCardId);
                setForm(giftCardToForm(res.giftCard, ch));
                setCodeLabel(res.giftCard?.code || "");
            } else {
                const f = emptyGiftCardForm();
                f.salesChannelIds = ch.map((c) => c.id);
                setForm(f);
                setCodeLabel("");
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [giftCardId, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    const generateCode = async () => {
        try {
            const res = await suggestStoreGiftCardCode();
            if (res.code) setForm((f) => ({ ...f, code: res.code }));
        } catch {
            setError("Kod oluşturulamadı");
        }
    };

    const toggleChannel = (id) => {
        setForm((f) => {
            const set = new Set(f.salesChannelIds);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            return { ...f, salesChannelIds: [...set] };
        });
    };

    const submit = async () => {
        const payload = formToGiftCardPayload(form);
        if (!payload.code) {
            setError("Hediye kartı kodu gerekli");
            return;
        }
        if (!payload.initialAmount) {
            setError("Hediye kartı değeri gerekli");
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (isEdit) {
                await updateStoreGiftCard(giftCardId, payload);
                onNavigate?.(`ec-gift-card-${giftCardId}`);
            } else {
                const res = await createStoreGiftCard(payload);
                onNavigate?.(`ec-gift-card-${res.giftCard._id}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const goBack = () => {
        if (isEdit) onNavigate?.(`ec-gift-card-${giftCardId}`);
        else onNavigate?.("ec-orders-gift-cards");
    };

    if (loading) {
        return (
            <div className="ec-prod-page ec-gift-card-form-page">
                <div className="ec-prod-empty">Yükleniyor…</div>
            </div>
        );
    }

    const pageTitle = isEdit ? "Düzenle" : "Hediye Kartı Oluştur";
    const crumbEnd = isEdit ? codeLabel || "Hediye Kartı" : pageTitle;

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-gift-card-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button type="button" className="ec-prod-icon-btn" onClick={goBack}>
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb" aria-label="Konum">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-orders-gift-cards")}
                            >
                                Hediye Kartları
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{crumbEnd}</span>
                        </nav>
                    </div>
                    <div className="ec-prod-head-actions">
                        <button type="button" className="ec-prod-btn" onClick={goBack} disabled={saving}>
                            Vazgeç
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            disabled={saving}
                            onClick={submit}
                        >
                            {saving ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="ec-purchase-form-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="ec-prod-form-body ec-cat-form-body">
                    <div className="ec-gift-card-form-layout">
                        <section className="ec-prod-section">
                            <div className="ec-prod-section__head">
                                <h3>
                                    Hediye Kartı Bilgileri{" "}
                                    <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                                </h3>
                                <label className="ec-gift-card-active-row">
                                    <span>Aktif</span>
                                    <span className="ec-gift-card-switch">
                                        <input
                                            type="checkbox"
                                            checked={form.active}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, active: e.target.checked }))
                                            }
                                        />
                                        <span aria-hidden />
                                    </span>
                                </label>
                            </div>

                            <div className="ec-prod-field">
                                <div className="ec-gift-card-field-label-row">
                                    <label htmlFor="gift-card-code">Hediye Kartı Kodu *</label>
                                    {!isEdit && (
                                        <button
                                            type="button"
                                            className="ec-prod-section-link"
                                            onClick={generateCode}
                                        >
                                            Kod Oluştur
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="gift-card-code"
                                    value={form.code}
                                    maxLength={20}
                                    autoComplete="off"
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            code: e.target.value.toUpperCase().slice(0, 20),
                                        }))
                                    }
                                    placeholder="Örn. EYLUL100"
                                />
                                <p className="ec-gift-card-char-count">{form.code.length}/20</p>
                            </div>

                            <div className="ec-prod-field">
                                <label htmlFor="gift-card-amount">Hediye Kartı Değeri *</label>
                                <div className="ec-gift-card-amount-row">
                                    <input
                                        id="gift-card-amount"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={form.initialAmount}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, initialAmount: e.target.value }))
                                        }
                                        placeholder="0,00"
                                    />
                                    <select
                                        className="ec-gift-card-amount-row__currency"
                                        value={form.currency}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, currency: e.target.value }))
                                        }
                                        aria-label="Para birimi"
                                    >
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="ec-prod-section">
                            <h3>Gereksinimler</h3>
                            <p className="ec-prod-muted">
                                Hediye kartının kullanım koşullarını belirleyin.
                            </p>
                            <div className="ec-gift-card-req-list">
                                <RequirementToggle
                                    checked={form.useMinOrder}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, useMinOrder: e.target.checked }))
                                    }
                                    label="Minimum sipariş tutarı ekle"
                                >
                                    <div className="ec-prod-field">
                                        <label htmlFor="gift-min-order">Minimum tutar (₺)</label>
                                        <input
                                            id="gift-min-order"
                                            type="number"
                                            min={0}
                                            value={form.minOrderAmount}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    minOrderAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </RequirementToggle>

                                <RequirementToggle
                                    checked={form.useStartDate}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, useStartDate: e.target.checked }))
                                    }
                                    label="Başlangıç tarihi ekle"
                                >
                                    <div className="ec-prod-field">
                                        <label htmlFor="gift-start">Başlangıç tarihi</label>
                                        <input
                                            id="gift-start"
                                            type="date"
                                            value={form.startDate}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, startDate: e.target.value }))
                                            }
                                        />
                                    </div>
                                </RequirementToggle>

                                <RequirementToggle
                                    checked={form.useEndDate}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, useEndDate: e.target.checked }))
                                    }
                                    label="Bitiş tarihi ekle"
                                >
                                    <div className="ec-prod-field">
                                        <label htmlFor="gift-end">Bitiş tarihi</label>
                                        <input
                                            id="gift-end"
                                            type="date"
                                            value={form.endDate}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, endDate: e.target.value }))
                                            }
                                        />
                                    </div>
                                </RequirementToggle>
                            </div>
                        </section>

                        <section className="ec-prod-section">
                            <h3>Müşteri</h3>
                            <p className="ec-prod-muted">
                                Bir müşteri seçerek oluşturduğunuz hediye kartını gönderebilirsiniz.
                            </p>
                            <div className="ec-prod-field">
                                <label htmlFor="gift-customer-name">Müşteri ara</label>
                                <input
                                    id="gift-customer-name"
                                    value={form.customerName}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, customerName: e.target.value }))
                                    }
                                    placeholder="Ad soyad veya e-posta"
                                />
                            </div>
                            <div className="ec-prod-grid ec-purchase-grid--2">
                                <div className="ec-prod-field">
                                    <label htmlFor="gift-customer-email">E-posta</label>
                                    <input
                                        id="gift-customer-email"
                                        type="email"
                                        value={form.customerEmail}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, customerEmail: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="ec-prod-field">
                                    <label htmlFor="gift-customer-phone">Telefon</label>
                                    <input
                                        id="gift-customer-phone"
                                        type="tel"
                                        value={form.customerPhone}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, customerPhone: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="ec-prod-section">
                            <h3>Satış Kanalları</h3>
                            {channels.length === 0 ? (
                                <p className="ec-prod-muted">Yayınlanmış mağaza kanalı bulunamadı.</p>
                            ) : (
                                <ul className="ec-gift-card-channel-list">
                                    {channels.map((ch) => {
                                        const on = form.salesChannelIds.includes(ch.id);
                                        return (
                                            <li key={ch.id}>
                                                <label
                                                    className={`ec-gift-card-channel-row${on ? " ec-gift-card-channel-row--on" : ""}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={on}
                                                        onChange={() => toggleChannel(ch.id)}
                                                    />
                                                    <span className="ec-gift-card-channel-row__main">
                                                        <strong>{ch.label}</strong>
                                                        <span>{ch.basePath}</span>
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EcommerceGiftCardFormPage;
