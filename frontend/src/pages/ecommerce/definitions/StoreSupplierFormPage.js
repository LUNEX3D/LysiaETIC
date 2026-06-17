import React, { useState, useEffect, useCallback } from "react";
import { FaArrowLeft } from "react-icons/fa";
import {
    fetchStoreSupplier,
    createStoreSupplier,
    updateStoreSupplier,
    deleteStoreSupplier,
} from "../../../services/storeApi";
import EcSelect from "../../../components/ecommerce/EcSelect";
import {
    emptySupplierForm,
    supplierToForm,
    formToSupplierPayload,
    SUPPLIER_NAME_MAX,
    PHONE_COUNTRY_OPTIONS,
} from "./supplierFormUtils";
import { phoneCountryListLabel } from "../../../constants/phoneCountries";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreSupplierFormPage = ({ supplierId, onNavigate }) => {
    const isEdit = !!supplierId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptySupplierForm);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            if (isEdit) {
                const res = await fetchStoreSupplier(supplierId);
                setForm(supplierToForm(res.supplier));
            } else {
                setForm(emptySupplierForm());
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [supplierId, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

    const save = async () => {
        if (!form.name.trim()) {
            setError("Tedarikçi adı zorunludur");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToSupplierPayload(form);
            if (isEdit) {
                await updateStoreSupplier(supplierId, payload);
            } else {
                await createStoreSupplier(payload);
            }
            onNavigate?.("ec-products-definitions-suppliers");
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!isEdit) return;
        if (!window.confirm(`"${form.name}" silinsin mi?`)) return;
        try {
            await deleteStoreSupplier(supplierId);
            onNavigate?.("ec-products-definitions-suppliers");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-products-definitions-suppliers")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-definitions-suppliers")}
                            >
                                Tedarikçiler
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{isEdit ? "Tedarikçi Düzenle" : "Tedarikçi Oluştur"}</span>
                        </nav>
                        {isEdit && <strong className="ec-cat-form-title">{form.name}</strong>}
                    </div>
                    <div className="ec-prod-head-actions">
                        {isEdit && (
                            <button type="button" className="ec-prod-btn ec-prod-btn--danger" onClick={remove}>
                                Sil
                            </button>
                        )}
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            disabled={saving || !form.name.trim()}
                            onClick={save}
                        >
                            {saving ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-prod-form-body ec-cat-form-body ec-supplier-form-body">
                    <section className="ec-prod-section ec-supplier-form-card">
                        <div className="ec-prod-field ec-prod-field--full">
                            <label>Ad *</label>
                            <div className="ec-prod-char-field">
                                <input
                                    value={form.name}
                                    maxLength={SUPPLIER_NAME_MAX}
                                    onChange={(e) => setField({ name: e.target.value })}
                                    placeholder="Tedarikçi adı"
                                />
                                <span className="ec-prod-char-count">
                                    {form.name.length}/{SUPPLIER_NAME_MAX}
                                </span>
                            </div>
                        </div>

                        <div className="ec-prod-seo-split">
                            <div className="ec-prod-field">
                                <label>E-Posta</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setField({ email: e.target.value })}
                                    placeholder="ornek@firma.com"
                                />
                            </div>
                            <div className="ec-prod-field">
                                <label>Telefon Numarası</label>
                                <div className="ec-supplier-phone">
                                    <EcSelect
                                        value={form.phoneCountryCode}
                                        onChange={(e) => setField({ phoneCountryCode: e.target.value })}
                                        wrapperClassName="ec-supplier-phone__code"
                                    >
                                        {PHONE_COUNTRY_OPTIONS.map((opt) => (
                                            <option key={opt.code} value={opt.code}>
                                                {phoneCountryListLabel(opt)}
                                            </option>
                                        ))}
                                    </EcSelect>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setField({ phone: e.target.value })}
                                        placeholder="5XX XXX XX XX"
                                        className="ec-supplier-phone__number"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="ec-prod-seo-split">
                            <div className="ec-prod-field">
                                <label>Şirket</label>
                                <input
                                    value={form.company}
                                    onChange={(e) => setField({ company: e.target.value })}
                                    placeholder="Şirket adı"
                                />
                            </div>
                            <div className="ec-prod-field">
                                <label>Çalışan Adı</label>
                                <input
                                    value={form.contactName}
                                    onChange={(e) => setField({ contactName: e.target.value })}
                                    placeholder="İlgili kişi"
                                />
                            </div>
                        </div>

                        <div className="ec-prod-seo-split">
                            <div className="ec-prod-field">
                                <label>Vergi Numarası</label>
                                <input
                                    value={form.taxNumber}
                                    onChange={(e) => setField({ taxNumber: e.target.value })}
                                    placeholder="Vergi numarası"
                                />
                            </div>
                            <div className="ec-prod-field">
                                <label>Vergi Dairesi</label>
                                <input
                                    value={form.taxOffice}
                                    onChange={(e) => setField({ taxOffice: e.target.value })}
                                    placeholder="Vergi dairesi"
                                />
                            </div>
                        </div>

                        <div className="ec-prod-field ec-prod-field--full">
                            <label>Adres</label>
                            <textarea
                                rows={4}
                                value={form.address}
                                onChange={(e) => setField({ address: e.target.value })}
                                placeholder="Açık adres"
                            />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default StoreSupplierFormPage;
