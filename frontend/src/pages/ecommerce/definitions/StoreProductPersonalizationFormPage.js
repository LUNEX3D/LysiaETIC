import React, { useState, useEffect, useCallback } from "react";
import { FaArrowLeft, FaPlus, FaPen, FaTrash } from "react-icons/fa";
import usePlanEntitlements from "../../../hooks/usePlanEntitlements";
import {
    fetchStorePersonalization,
    createStorePersonalization,
    updateStorePersonalization,
    deleteStorePersonalization,
} from "../../../services/storeApi";
import {
    emptyPersonalizationForm,
    personalizationToForm,
    formToPersonalizationPayload,
    PERSONALIZATION_NAME_MAX,
    PAID_PRICING_FEATURE,
    getTypeLabel,
    getOptionLabel,
} from "./personalizationFormUtils";
import {
    savePersonalizationDraft,
    loadPersonalizationDraft,
    clearPersonalizationDraft,
    getPersonalizationReturnPanel,
} from "./personalizationDraftStorage";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreProductPersonalizationFormPage = ({ personalizationId, onNavigate }) => {
    const isEdit = !!personalizationId;
    const { canAccess, loading: planLoading } = usePlanEntitlements();
    const allowPaidPricing = canAccess(PAID_PRICING_FEATURE);

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptyPersonalizationForm);

    const returnPanel = getPersonalizationReturnPanel(personalizationId);

    const persistDraft = useCallback(
        (nextForm) => {
            savePersonalizationDraft({
                personalizationId: personalizationId || null,
                name: nextForm.name,
                options: nextForm.options,
                returnPanel,
            });
        },
        [personalizationId, returnPanel]
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const cached = loadPersonalizationDraft();
            if (cached?.returnPanel === returnPanel) {
                setForm({ name: cached.name || "", options: cached.options || [] });
                setLoading(false);
                return;
            }

            if (isEdit) {
                const res = await fetchStorePersonalization(personalizationId);
                const loaded = personalizationToForm(res.personalization);
                setForm(loaded);
                savePersonalizationDraft({
                    personalizationId,
                    name: loaded.name,
                    options: loaded.options,
                    returnPanel,
                });
            } else {
                setForm(emptyPersonalizationForm());
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [personalizationId, isEdit, returnPanel]);

    useEffect(() => {
        load();
    }, [load]);

    const openAddOption = () => {
        persistDraft(form);
        onNavigate?.("ec-personalization-option-add");
    };

    const openEditOption = (opt) => {
        persistDraft(form);
        onNavigate?.(`ec-personalization-option-edit-${opt._id || opt.clientKey}`);
    };

    const removeOption = (opt) => {
        const key = String(opt._id || opt.clientKey);
        if (!window.confirm(`"${getOptionLabel(opt)}" seçeneği kaldırılsın mı?`)) return;
        const next = {
            ...form,
            options: form.options.filter((o) => String(o._id || o.clientKey) !== key),
        };
        setForm(next);
        persistDraft(next);
    };

    const save = async () => {
        if (!form.name.trim()) {
            setError("Kişiselleştirme adı zorunludur");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToPersonalizationPayload(form, allowPaidPricing);
            if (isEdit) {
                await updateStorePersonalization(personalizationId, payload);
            } else {
                await createStorePersonalization(payload);
            }
            clearPersonalizationDraft();
            onNavigate?.("ec-products-definitions-personalizations");
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
            await deleteStorePersonalization(personalizationId);
            clearPersonalizationDraft();
            onNavigate?.("ec-products-definitions-personalizations");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    if (loading || planLoading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-pers-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-products-definitions-personalizations")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-definitions-personalizations")}
                            >
                                Ürün Kişiselleştirmeleri
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>
                                {isEdit ? "Kişiselleştirmeyi Düzenle" : "Ürün Kişiselleştirmesi Ekle"}
                            </span>
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

                <div className="ec-prod-form-body ec-cat-form-body ec-pers-form-body">
                    <section className="ec-prod-section ec-pers-form-card">
                        <h3 className="ec-pers-form-card__title">Temel Bilgiler</h3>
                        <div className="ec-prod-field ec-prod-field--full">
                            <label htmlFor="pers-group-name">Ürün Kişiselleştirme Adı *</label>
                            <div className="ec-prod-char-field">
                                <input
                                    id="pers-group-name"
                                    value={form.name}
                                    maxLength={PERSONALIZATION_NAME_MAX}
                                    onChange={(e) => {
                                        const next = { ...form, name: e.target.value };
                                        setForm(next);
                                        persistDraft(next);
                                    }}
                                    placeholder="Örn. 3D Baskı Hizmeti"
                                />
                                <span className="ec-prod-char-count">
                                    {form.name.length}/{PERSONALIZATION_NAME_MAX}
                                </span>
                            </div>
                            <p className="ec-pers-field-hint">Bu adı sadece siz görürsünüz.</p>
                        </div>
                    </section>

                    <section className="ec-prod-section ec-pers-form-card ec-pers-options-section">
                        <h3 className="ec-pers-form-card__title">Kişiselleştirme Seçenekleri</h3>
                        {!form.options.length ? (
                            <div className="ec-pers-options-empty">
                                <div className="ec-pers-options-empty__icon" />
                                <h4>Henüz bir kişiselleştirme seçeneği eklenmedi.</h4>
                                <p>
                                    Ürünlerinizi müşterilerinize göre kişiselleştirilebilir hale getirebilirsiniz.
                                </p>
                                <button
                                    type="button"
                                    className="ec-prod-btn ec-prod-btn--primary"
                                    onClick={openAddOption}
                                >
                                    Kişiselleştirme Ekle
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="ec-pers-options-head">
                                    <span className="ec-prod-muted">{form.options.length} seçenek</span>
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--primary"
                                        onClick={openAddOption}
                                    >
                                        <FaPlus /> Kişiselleştirme Ekle
                                    </button>
                                </div>
                                <ul className="ec-pers-options-list">
                                    {form.options.map((opt) => (
                                        <li key={opt._id || opt.clientKey}>
                                            <div>
                                                <strong>{getOptionLabel(opt)}</strong>
                                                <span>{getTypeLabel(opt.type)}</span>
                                            </div>
                                            <div className="ec-pers-options-list__actions">
                                                <button
                                                    type="button"
                                                    className="ec-prod-icon-btn"
                                                    title="Düzenle"
                                                    onClick={() => openEditOption(opt)}
                                                >
                                                    <FaPen />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                    title="Sil"
                                                    onClick={() => removeOption(opt)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default StoreProductPersonalizationFormPage;
