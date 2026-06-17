import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaTrash,
    FaChevronUp,
    FaChevronDown,
    FaTimes,
} from "react-icons/fa";
import {
    fetchStoreProductGroup,
    fetchStoreProducts,
    fetchStoreCustomFields,
    createStoreProductGroup,
    updateStoreProductGroup,
    deleteStoreProductGroup,
} from "../../../services/storeApi";
import EcFieldLabel from "../../../components/ecommerce/EcFieldLabel";
import EcSelect from "../../../components/ecommerce/EcSelect";
import ProductGroupProductPickerModal from "./ProductGroupProductPickerModal";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import {
    emptyManualForm,
    emptyAutomaticForm,
    groupToManualForm,
    manualFormToPayload,
    automaticFormToPayload,
    addVariantTypeLabel,
    removeVariantTypeLabel,
    addProductToForm,
    removeProductFromForm,
    moveProductInForm,
    setItemValue,
    setItemSortOrder,
    MAX_PRODUCT_GROUP_TYPES,
} from "./productGroupFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreProductGroupFormPage = ({ groupId, mode = "manual", onNavigate }) => {
    const isEdit = !!groupId;
    const isAutomatic = !isEdit && mode === "automatic";
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [manualForm, setManualForm] = useState(emptyManualForm);
    const [autoForm, setAutoForm] = useState(emptyAutomaticForm);
    const [products, setProducts] = useState([]);
    const [customFields, setCustomFields] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [prodRes, cfRes] = await Promise.all([fetchStoreProducts(), fetchStoreCustomFields()]);
            setProducts(prodRes.products || []);
            setCustomFields(cfRes.fields || []);

            if (isEdit) {
                const res = await fetchStoreProductGroup(groupId);
                setManualForm(groupToManualForm(res.group));
            } else if (isAutomatic) {
                setAutoForm(emptyAutomaticForm());
            } else {
                setManualForm(emptyManualForm());
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [groupId, isEdit, isAutomatic]);

    useEffect(() => {
        load();
    }, [load]);

    const textCustomFields = useMemo(
        () => customFields.filter((f) => f.type === "text"),
        [customFields]
    );

    const groupingFieldOptions = useMemo(
        () => textCustomFields.map((f) => ({ value: String(f._id), label: f.name })),
        [textCustomFields]
    );

    const typeFieldOptions = groupingFieldOptions;

    const existingProductIds = useMemo(
        () => manualForm.items.map((item) => String(item.productId)),
        [manualForm.items]
    );

    const pageTitle = isEdit
        ? "Ürün Grubunu Düzenle"
        : isAutomatic
          ? "Otomatik Ürün Grubu Ekle"
          : "Manuel Ürün Grubu Ekle";

    const canShowProducts = manualForm.variantTypeLabels.length > 0;

    const handleTypeKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setManualForm((prev) => addVariantTypeLabel(prev));
        }
    };

    const handleSaveManual = async () => {
        setSaving(true);
        setError("");
        try {
            const payload = manualFormToPayload(manualForm);
            if (!payload.name) {
                setError("Ürün grubu adı gerekli");
                return;
            }
            if (!payload.variantTypeLabels.length) {
                setError("En az bir ürün grubu türü ekleyin");
                return;
            }
            if (!payload.items.length) {
                setError("En az bir ürün ekleyin");
                return;
            }
            if (isEdit) {
                await updateStoreProductGroup(groupId, payload);
                pushToast("success", "Ürün grubu güncellendi.");
            } else {
                await createStoreProductGroup(payload);
                pushToast("success", "Ürün grubu oluşturuldu.");
            }
            onNavigate?.("ec-products-definitions-product-groups");
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAutomatic = async () => {
        setSaving(true);
        setError("");
        try {
            const payload = automaticFormToPayload(autoForm);
            if (!payload.name) {
                setError("Ürün grubu adı gerekli");
                return;
            }
            if (!payload.groupingFieldId) {
                setError("Gruplama koşulu seçin");
                return;
            }
            if (payload.typeSource === "custom_field" && !payload.typeCustomFieldId) {
                setError("Özel alana göre gruplama için tür alanı seçin");
                return;
            }
            const res = await createStoreProductGroup(payload);
            const count = res.createdCount || res.groups?.length || 0;
            pushToast("success", `${count} ürün grubu oluşturuldu.`);
            onNavigate?.("ec-products-definitions-product-groups");
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!isEdit) return;
        if (!window.confirm("Bu ürün grubunu silmek istediğinize emin misiniz?")) return;
        setSaving(true);
        try {
            await deleteStoreProductGroup(groupId);
            pushToast("success", "Ürün grubu silindi.");
            onNavigate?.("ec-products-definitions-product-groups");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="ec-prod-form-shell">
                <p className="ec-prod-muted">Yükleniyor…</p>
            </div>
        );
    }

    return (
        <div className="ec-prod-form-shell">
            <EcToast toasts={toasts} onDismiss={dismissToast} />
            <header className="ec-prod-form-topbar">
                <div className="ec-prod-form-topbar__left">
                    <button
                        type="button"
                        className="ec-prod-icon-btn"
                        onClick={() => onNavigate?.("ec-products-definitions-product-groups")}
                    >
                        <FaArrowLeft />
                    </button>
                    <h1>{pageTitle}</h1>
                </div>
                <div className="ec-prod-form-topbar__actions">
                    {isEdit && (
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--danger-outline"
                            disabled={saving}
                            onClick={handleDelete}
                        >
                            <FaTrash /> Sil
                        </button>
                    )}
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={saving}
                        onClick={isAutomatic ? handleSaveAutomatic : handleSaveManual}
                    >
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                </div>
            </header>

            {error && <div className="ec-prod-form-error">{error}</div>}

            {isAutomatic ? (
                <div className="ec-prod-form-grid ec-pg-form">
                    <section className="ec-prod-form-section">
                        <h2>Temel Bilgiler</h2>
                        <p className="ec-prod-muted ec-pg-section-hint">
                            Bu ad yalnızca yönetim panelinde görünür; müşterilere gösterilmez.
                        </p>
                        <label className="ec-prod-field">
                            <EcFieldLabel text="Ürün Grubu Adı" required />
                            <input
                                value={autoForm.name}
                                onChange={(e) => setAutoForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Örn. Tişört Renk Grubu"
                            />
                        </label>
                    </section>

                    <section className="ec-prod-form-section">
                        <h2>Gruplama Koşulu</h2>
                        <p className="ec-prod-muted ec-pg-section-hint">
                            Ürünlerinize eklediğiniz Yazı türündeki özel alanı seçin. Aynı değere sahip ürünler
                            otomatik olarak gruplanır.
                        </p>
                        <label className="ec-prod-field">
                            <EcFieldLabel text="Gruplama Özel Alanı" required />
                            <EcSelect
                                value={autoForm.groupingFieldId}
                                onChange={(e) =>
                                    setAutoForm((prev) => ({ ...prev, groupingFieldId: e.target.value }))
                                }
                            >
                                <option value="">Seçin</option>
                                {groupingFieldOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </EcSelect>
                        </label>
                        {!textCustomFields.length && (
                            <p className="ec-pg-warn">
                                Otomatik gruplama için önce Tanımlamalar → Özel Alanlar bölümünden Yazı türünde
                                alan oluşturun ve ürünlere aynı değeri girin.
                            </p>
                        )}
                    </section>

                    <section className="ec-prod-form-section">
                        <h2>Ürün Grubu Türü</h2>
                        <p className="ec-prod-muted ec-pg-section-hint">
                            Varyant görünümünü elde etmek için ürünlerinizi varyant veya özel alan ile hazırlamış
                            olmanız gerekir.
                        </p>
                        <div className="ec-pg-radio-group">
                            <label className="ec-pg-radio">
                                <input
                                    type="radio"
                                    name="typeSource"
                                    checked={autoForm.typeSource === "variant"}
                                    onChange={() =>
                                        setAutoForm((prev) => ({
                                            ...prev,
                                            typeSource: "variant",
                                            typeCustomFieldId: "",
                                        }))
                                    }
                                />
                                <span>
                                    <strong>Varyanta Göre Grupla</strong>
                                    <small>Ürünlerde tanımlı varyant bilgisi seçenek başlığı olarak kullanılır.</small>
                                </span>
                            </label>
                            <label className="ec-pg-radio">
                                <input
                                    type="radio"
                                    name="typeSource"
                                    checked={autoForm.typeSource === "custom_field"}
                                    onChange={() =>
                                        setAutoForm((prev) => ({ ...prev, typeSource: "custom_field" }))
                                    }
                                />
                                <span>
                                    <strong>Özel Alana Göre Grupla</strong>
                                    <small>Seçilen özel alanın değeri müşteriye gösterilen seçenek olur.</small>
                                </span>
                            </label>
                        </div>
                        {autoForm.typeSource === "custom_field" && (
                            <label className="ec-prod-field" style={{ marginTop: "1rem" }}>
                                <EcFieldLabel text="Tür Özel Alanı" required />
                                <EcSelect
                                    value={autoForm.typeCustomFieldId}
                                    onChange={(e) =>
                                        setAutoForm((prev) => ({
                                            ...prev,
                                            typeCustomFieldId: e.target.value,
                                        }))
                                    }
                                >
                                    <option value="">Seçin</option>
                                    {typeFieldOptions.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </EcSelect>
                            </label>
                        )}
                    </section>
                </div>
            ) : (
                <div className="ec-prod-form-grid ec-pg-form">
                    <section className="ec-prod-form-section">
                        <h2>Temel Bilgiler</h2>
                        <p className="ec-prod-muted ec-pg-section-hint">
                            Bu ad yalnızca yönetim panelinde görünür; müşterilere gösterilmez.
                        </p>
                        <label className="ec-prod-field">
                            <EcFieldLabel text="Ürün Grubu Adı" required />
                            <input
                                value={manualForm.name}
                                onChange={(e) => setManualForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Örn. Tişört Renk Grubu"
                            />
                        </label>
                    </section>

                    <section className="ec-prod-form-section">
                        <h2>Ürün Grubu Varyantları</h2>
                        <p className="ec-prod-muted ec-pg-section-hint">
                            Ürün sayfasında müşterilere seçenek başlığı olarak gösterilecek türleri girin (Renk,
                            Beden, Boyut vb.). En fazla {MAX_PRODUCT_GROUP_TYPES} tür eklenebilir.
                        </p>
                        <label className="ec-prod-field">
                            <EcFieldLabel text="Ürün Grubu Türü" />
                            <input
                                value={manualForm.typeInput}
                                onChange={(e) =>
                                    setManualForm((prev) => ({ ...prev, typeInput: e.target.value }))
                                }
                                onKeyDown={handleTypeKeyDown}
                                placeholder="Tür yazıp Enter'a basın"
                                disabled={manualForm.variantTypeLabels.length >= MAX_PRODUCT_GROUP_TYPES}
                            />
                        </label>
                        {manualForm.variantTypeLabels.length > 0 && (
                            <div className="ec-pg-type-tags">
                                {manualForm.variantTypeLabels.map((label) => (
                                    <span key={label} className="ec-pg-type-tag">
                                        {label}
                                        <button
                                            type="button"
                                            aria-label={`${label} kaldır`}
                                            onClick={() =>
                                                setManualForm((prev) => removeVariantTypeLabel(prev, label))
                                            }
                                        >
                                            <FaTimes />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>

                    {canShowProducts && (
                        <section className="ec-prod-form-section ec-pg-products-section">
                            <div className="ec-pg-products-head">
                                <h2>Ürünler</h2>
                                <button
                                    type="button"
                                    className="ec-prod-btn ec-prod-btn--primary"
                                    onClick={() => setPickerOpen(true)}
                                >
                                    <FaPlus /> Ürün Ekle
                                </button>
                            </div>

                            {!manualForm.items.length ? (
                                <p className="ec-prod-muted">Henüz ürün eklenmedi.</p>
                            ) : (
                                <div className="ec-prod-table-wrap">
                                    <table className="ec-prod-table ec-pg-items-table">
                                        <thead>
                                            <tr>
                                                <th>Sıra</th>
                                                <th>Ürün</th>
                                                {manualForm.variantTypeLabels.map((label) => (
                                                    <th key={label}>{label}</th>
                                                ))}
                                                <th aria-label="İşlemler" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {manualForm.items.map((item, idx) => (
                                                <tr key={item.productId}>
                                                    <td className="ec-pg-sort-cell">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            className="ec-pg-sort-input"
                                                            value={item.sortOrder ?? idx}
                                                            onChange={(e) =>
                                                                setManualForm((prev) =>
                                                                    setItemSortOrder(
                                                                        prev,
                                                                        item.productId,
                                                                        e.target.value
                                                                    )
                                                                )
                                                            }
                                                        />
                                                        <div className="ec-pg-sort-btns">
                                                            <button
                                                                type="button"
                                                                className="ec-prod-icon-btn"
                                                                disabled={idx === 0}
                                                                onClick={() =>
                                                                    setManualForm((prev) =>
                                                                        moveProductInForm(prev, item.productId, -1)
                                                                    )
                                                                }
                                                            >
                                                                <FaChevronUp />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ec-prod-icon-btn"
                                                                disabled={idx === manualForm.items.length - 1}
                                                                onClick={() =>
                                                                    setManualForm((prev) =>
                                                                        moveProductInForm(prev, item.productId, 1)
                                                                    )
                                                                }
                                                            >
                                                                <FaChevronDown />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td>{item.productTitle || item.productId}</td>
                                                    {manualForm.variantTypeLabels.map((label) => (
                                                        <td key={label}>
                                                            <input
                                                                className="ec-pg-value-input"
                                                                value={item.values?.[label] || ""}
                                                                onChange={(e) =>
                                                                    setManualForm((prev) =>
                                                                        setItemValue(
                                                                            prev,
                                                                            item.productId,
                                                                            label,
                                                                            e.target.value
                                                                        )
                                                                    )
                                                                }
                                                                placeholder={label}
                                                            />
                                                        </td>
                                                    ))}
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                            onClick={() =>
                                                                setManualForm((prev) =>
                                                                    removeProductFromForm(prev, item.productId)
                                                                )
                                                            }
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}

            <ProductGroupProductPickerModal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                products={products}
                existingProductIds={existingProductIds}
                onAdd={(product) => {
                    setManualForm((prev) => addProductToForm(prev, product));
                }}
            />
        </div>
    );
};

export default StoreProductGroupFormPage;
