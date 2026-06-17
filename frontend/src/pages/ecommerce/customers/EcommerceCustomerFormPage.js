import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaInfoCircle, FaEllipsisV, FaTrash, FaBan, FaMapMarkerAlt } from "react-icons/fa";
import {
    fetchStoreCustomer,
    fetchStoreCustomers,
    fetchStoreCustomerGroups,
    createStoreCustomer,
    updateStoreCustomer,
    deleteStoreCustomer,
} from "../../../services/storeApi";
import CustomerAddressModal from "./CustomerAddressModal";
import CustomerSearchAddField, { collectCustomerFieldValues } from "./CustomerSearchAddField";
import {
    emptyCustomerForm,
    customerToForm,
    formToCustomerPayload,
    CUSTOMER_LANGUAGES,
} from "./customerUtils";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcPhoneInput from "../../../components/ecommerce/EcPhoneInput";
import { normalizePhoneCountryCode } from "../../../constants/phoneCountries";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const EcommerceCustomerFormPage = ({ customerId, onNavigate }) => {
    const isEdit = !!customerId;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptyCustomerForm);
    const [addressModal, setAddressModal] = useState(false);
    const [editAddressIndex, setEditAddressIndex] = useState(-1);
    const [menuOpen, setMenuOpen] = useState(false);
    const [customFieldEmptyOpen, setCustomFieldEmptyOpen] = useState(false);
    const [groupCatalog, setGroupCatalog] = useState([]);
    const [tagCatalog, setTagCatalog] = useState([]);

    const loadCatalog = useCallback(async () => {
        try {
            const [groupsRes, customersRes] = await Promise.all([
                fetchStoreCustomerGroups(),
                fetchStoreCustomers(),
            ]);
            const customers = customersRes.customers || [];
            const fromApi = (groupsRes.groups || []).map((g) => g.name).filter(Boolean);
            const fromCustomers = collectCustomerFieldValues(customers, "groups");
            setGroupCatalog([...new Set([...fromApi, ...fromCustomers])].sort((a, b) => a.localeCompare(b, "tr")));
            setTagCatalog(collectCustomerFieldValues(customers, "tags"));
        } catch {
            setGroupCatalog([]);
            setTagCatalog([]);
        }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            if (isEdit) {
                const res = await fetchStoreCustomer(customerId);
                setForm(customerToForm(res.customer));
            } else {
                setForm(emptyCustomerForm());
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [customerId, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    const submit = async () => {
        const payload = formToCustomerPayload(form);
        if (!payload.firstName || !payload.lastName) {
            setError("Ad ve soyad gerekli");
            return;
        }
        if (!payload.email) {
            setError("E-posta gerekli");
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (isEdit) {
                await updateStoreCustomer(customerId, payload);
                onNavigate?.(`ec-customer-${customerId}`);
            } else {
                const res = await createStoreCustomer(payload);
                onNavigate?.(`ec-customer-${res.customer._id}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const removeCustomer = async () => {
        if (!window.confirm("Bu müşteri silinsin mi?")) return;
        try {
            await deleteStoreCustomer(customerId);
            onNavigate?.("ec-customers");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    const saveAddress = (addr) => {
        setForm((f) => {
            const list = [...f.addresses];
            if (editAddressIndex >= 0) list[editAddressIndex] = addr;
            else list.push(addr);
            return { ...f, addresses: list };
        });
        setEditAddressIndex(-1);
    };

    const removeAddress = (idx) => {
        setForm((f) => ({
            ...f,
            addresses: f.addresses.filter((_, i) => i !== idx),
        }));
    };

    const goBack = () => {
        if (isEdit) onNavigate?.(`ec-customer-${customerId}`);
        else onNavigate?.("ec-customers");
    };

    if (loading) {
        return (
            <div className="ec-prod-page ec-customer-form-page">
                <div className="ec-prod-empty">Yükleniyor…</div>
            </div>
        );
    }

    const pageTitle = isEdit ? "Müşteri Düzenle" : "Müşteri Oluştur";

    return (
        <div className="ec-prod-page ec-purchase-form-page ec-customer-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button type="button" className="ec-prod-icon-btn" onClick={goBack}>
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb" aria-label="Konum">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-customers")}
                            >
                                Müşteriler
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{pageTitle}</span>
                        </nav>
                    </div>
                    <div className="ec-prod-head-actions">
                        {isEdit && (
                            <div className="ec-customer-more-wrap">
                                <button
                                    type="button"
                                    className="ec-prod-icon-btn"
                                    onClick={() => setMenuOpen((o) => !o)}
                                >
                                    <FaEllipsisV />
                                </button>
                                {menuOpen && (
                                    <ul className="ec-customer-more-menu">
                                        <li>
                                            <button type="button" disabled>
                                                <FaBan /> Mesajı engelle
                                            </button>
                                        </li>
                                        <li>
                                            <button type="button" className="ec-customer-more-menu--danger" onClick={removeCustomer}>
                                                <FaTrash /> Sil
                                            </button>
                                        </li>
                                    </ul>
                                )}
                            </div>
                        )}
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

                <div className="ec-prod-form-body ec-customer-form-body">
                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>
                                Müşteri Bilgileri <FaInfoCircle style={{ opacity: 0.4, fontSize: 12 }} />
                            </h3>
                        </div>
                        <div className="ec-prod-grid ec-purchase-grid--2">
                            <div className="ec-prod-field">
                                <label>Ad *</label>
                                <input
                                    value={form.firstName}
                                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                                />
                            </div>
                            <div className="ec-prod-field">
                                <label>Soyad *</label>
                                <input
                                    value={form.lastName}
                                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                                />
                            </div>
                            <div className="ec-prod-field">
                                <label>E-Posta *</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                    placeholder="ornek@dashtock.com"
                                />
                            </div>
                            <div className="ec-prod-field">
                                <label>Telefon Numarası</label>
                                <EcPhoneInput
                                    phoneCountryCode={form.phoneCountryCode}
                                    phone={form.phone}
                                    onCountryCodeChange={(phoneCountryCode) =>
                                        setForm((f) => ({
                                            ...f,
                                            phoneCountryCode: normalizePhoneCountryCode(phoneCountryCode),
                                        }))
                                    }
                                    onPhoneChange={(phone) => setForm((f) => ({ ...f, phone }))}
                                />
                            </div>
                            <div className="ec-prod-field ec-prod-field--full">
                                <label>Tercih Edilen Dil</label>
                                <EcSelect
                                    value={form.preferredLanguage}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, preferredLanguage: e.target.value }))
                                    }
                                >
                                    {CUSTOMER_LANGUAGES.map((l) => (
                                        <option key={l.value} value={l.value}>
                                            {l.label}
                                        </option>
                                    ))}
                                </EcSelect>
                            </div>
                        </div>
                    </section>

                    <section className="ec-prod-section ec-prod-section--address">
                        <div className="ec-prod-section__head">
                            <h3>
                                Adres <FaInfoCircle style={{ opacity: 0.4, fontSize: 12 }} />
                            </h3>
                        </div>
                        {form.addresses.length === 0 ? (
                            <div className="ec-customer-address-empty">
                                <span className="ec-customer-address-empty__icon" aria-hidden>
                                    <FaMapMarkerAlt />
                                </span>
                                <p className="ec-customer-address-empty__title">
                                    Müşteriye ait henüz bir adres yok
                                </p>
                                <p className="ec-customer-address-empty__hint">
                                    Müşterinize ait birden fazla adres girebilirsiniz.
                                </p>
                                <button
                                    type="button"
                                    className="ec-prod-btn ec-prod-btn--primary ec-customer-address-empty__btn"
                                    onClick={() => {
                                        setEditAddressIndex(-1);
                                        setAddressModal(true);
                                    }}
                                >
                                    Adres Ekle
                                </button>
                            </div>
                        ) : (
                            <div className="ec-customer-address-list">
                                {form.addresses.map((a, idx) => (
                                    <div key={idx} className="ec-customer-address-card">
                                        <div>
                                            <strong>{a.title || "Adres"}</strong>
                                            <p className="ec-prod-muted">
                                                {[a.line1, a.city, a.country].filter(Boolean).join(", ")}
                                            </p>
                                        </div>
                                        <div className="ec-customer-address-card__actions">
                                            <button
                                                type="button"
                                                className="ec-prod-btn"
                                                onClick={() => {
                                                    setEditAddressIndex(idx);
                                                    setAddressModal(true);
                                                }}
                                            >
                                                Düzenle
                                            </button>
                                            <button
                                                type="button"
                                                className="ec-prod-btn"
                                                onClick={() => removeAddress(idx)}
                                            >
                                                Sil
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="ec-prod-btn ec-prod-btn--primary"
                                    onClick={() => {
                                        setEditAddressIndex(-1);
                                        setAddressModal(true);
                                    }}
                                >
                                    Adres Ekle
                                </button>
                            </div>
                        )}
                    </section>

                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>
                                Müşteri Notları <FaInfoCircle style={{ opacity: 0.4, fontSize: 12 }} />
                            </h3>
                        </div>
                        <textarea
                            className="ec-customer-notes"
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Not ekleyin..."
                            rows={4}
                        />
                    </section>

                    <section className="ec-prod-section ec-prod-section--marketing">
                        <div className="ec-prod-section__head">
                            <h3>
                                Pazarlama <FaInfoCircle style={{ opacity: 0.4, fontSize: 12 }} />
                            </h3>
                        </div>
                        <div className="ec-prod-grid ec-purchase-grid--2 ec-customer-marketing-grid">
                            <CustomerSearchAddField
                                label="Müşteri Grubu"
                                placeholder="Grup Ara ve Ekle"
                                emptyTitle="Müşteri Grubu Bulunamadı"
                                emptyHint="Yeni değer eklemek için isim yazıp ENTER tuşuna basın"
                                values={form.groups}
                                onChange={(groups) => setForm((f) => ({ ...f, groups }))}
                                suggestions={groupCatalog}
                            />
                            <CustomerSearchAddField
                                label="Etiketler"
                                placeholder="Etiket Ara ve Ekle"
                                emptyTitle="Etiketler Bulunamadı"
                                emptyHint="Yeni değer eklemek için isim yazıp ENTER tuşuna basın"
                                values={form.tags}
                                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                                suggestions={tagCatalog}
                            />
                        </div>
                        <h4 className="ec-customer-subhead">Bildirimler</h4>
                        <label className="ec-order-create-same-bill ec-customer-marketing-check">
                            <input
                                type="checkbox"
                                checked={form.marketingEmailConsent}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, marketingEmailConsent: e.target.checked }))
                                }
                            />
                            Müşteri, pazarlama e-postaları almayı kabul etti
                        </label>
                        <div className="ec-customer-marketing-footer">
                            <p>
                                Müşterileriniz için takip etmek istediğiniz farklı verileri özel alan olarak
                                ekleyin.
                            </p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={() => setCustomFieldEmptyOpen(true)}
                            >
                                Özel Alan Ekle
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            <CustomerAddressModal
                open={addressModal}
                onClose={() => setAddressModal(false)}
                initial={editAddressIndex >= 0 ? form.addresses[editAddressIndex] : null}
                customerDefaults={{ firstName: form.firstName, lastName: form.lastName }}
                onSave={saveAddress}
            />

            {customFieldEmptyOpen && (
                <div
                    className="ec-order-label-modal-backdrop"
                    role="dialog"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setCustomFieldEmptyOpen(false);
                    }}
                >
                    <div className="ec-order-label-modal ec-customer-export-modal" onMouseDown={(e) => e.stopPropagation()}>
                        <header className="ec-order-label-modal__head">
                            <h3>Özel Alan Ekle</h3>
                            <button type="button" className="ec-prod-icon-btn" onClick={() => setCustomFieldEmptyOpen(false)}>
                                ×
                            </button>
                        </header>
                        <div className="ec-order-label-modal__body ec-customer-custom-empty">
                            <h4>Henüz Bir Müşteri Özel Alanınız Yok</h4>
                            <p className="ec-prod-muted">
                                Şu anda kayıtlı bir müşteri özel alanınız yok. Özel alan oluşturmak için butona
                                tıklayabilirsiniz.
                            </p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={() => {
                                    alert("Özel alan tanımları yakında eklenecek.");
                                    setCustomFieldEmptyOpen(false);
                                }}
                            >
                                Özel Alan Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EcommerceCustomerFormPage;
