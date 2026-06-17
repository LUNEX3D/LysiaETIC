import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    FaArrowLeft,
    FaInfoCircle,
    FaUpload,
    FaTrash,
    FaChevronDown,
    FaChevronUp,
    FaSearch,
} from "react-icons/fa";
import {
    fetchStore,
    fetchStoreCategory,
    fetchStoreCategories,
    createStoreCategory,
    updateStoreCategory,
    deleteStoreCategory,
} from "../../../services/storeApi";
import { uploadProductImage } from "../../../services/productManagementApi";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcFieldLabel from "../../../components/ecommerce/EcFieldLabel";
import ProductRichHtmlEditor from "../products/ProductRichHtmlEditor";
import { EC_FIELD_HINTS } from "../../../constants/ecFieldHints";
import {
    emptyCategoryForm,
    categoryToForm,
    formToCategoryPayload,
    slugifyCategoryName,
    getStoreDisplayDomain,
    SORT_CRITERIA_OPTIONS,
    DYNAMIC_CONDITION_FIELDS,
    operatorsForConditionField,
    defaultOperatorForField,
    emptyDynamicConditionRow,
} from "./categoryFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreCategoryFormPage = ({ categoryId, categoryType = "normal", onNavigate }) => {
    const isEdit = !!categoryId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [store, setStore] = useState(null);
    const [flatCategories, setFlatCategories] = useState([]);
    const [form, setForm] = useState(() => emptyCategoryForm(categoryType));
    const [seoAdvancedOpen, setSeoAdvancedOpen] = useState(false);
    const slugTouched = useRef(false);
    const titleTouched = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [storeRes, catListRes] = await Promise.all([
                fetchStore(),
                fetchStoreCategories(),
            ]);
            setStore(storeRes.store || null);
            setFlatCategories(catListRes.flat || []);

            if (isEdit) {
                const res = await fetchStoreCategory(categoryId);
                setForm(categoryToForm(res.category));
            } else {
                setForm(emptyCategoryForm(categoryType));
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [categoryId, categoryType, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    const parentOptions = useMemo(
        () =>
            flatCategories.filter(
                (c) => !isEdit || String(c._id) !== String(categoryId)
            ),
        [flatCategories, categoryId, isEdit]
    );

    const storeDomain = useMemo(() => getStoreDisplayDomain(store), [store]);
    const seoPreviewTitle = form.seo.pageTitle?.trim() || form.name.trim() || "Kategori";
    const seoPreviewSlug = form.seo.slug?.trim() || slugifyCategoryName(form.name) || "kategori";
    const seoPreviewDesc = form.seo.metaDescription?.trim();
    const hasSeoPreview = !!(form.name.trim() || form.seo.pageTitle?.trim() || form.seo.metaDescription?.trim());

    const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

    const onNameChange = (name) => {
        setForm((prev) => {
            const next = { ...prev, name };
            const seo = { ...prev.seo };
            if (!slugTouched.current) seo.slug = slugifyCategoryName(name);
            if (!titleTouched.current) seo.pageTitle = name;
            next.seo = seo;
            return next;
        });
    };

    const onSeoChange = (patch) => {
        if (patch.slug != null) slugTouched.current = true;
        if (patch.pageTitle != null) titleTouched.current = true;
        setForm((prev) => ({ ...prev, seo: { ...prev.seo, ...patch } }));
    };

    const handleImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const res = await uploadProductImage(file);
            const url = res?.url || res?.imageUrl || res?.path;
            if (url) setField({ imageUrl: url });
        } catch {
            window.alert("Görsel yüklenemedi");
        }
    };

    const save = async () => {
        if (!form.name.trim()) {
            setError("Kategori adı zorunludur");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToCategoryPayload(form);
            if (isEdit) {
                await updateStoreCategory(categoryId, payload);
            } else {
                await createStoreCategory(payload);
            }
            onNavigate?.("ec-products-definitions-categories");
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
            await deleteStoreCategory(categoryId);
            onNavigate?.("ec-products-definitions-categories");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    const typeLabel = form.categoryType === "dynamic" ? "Dinamik Kategori" : "Normal Kategori";

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
                            onClick={() => onNavigate?.("ec-products-definitions-categories")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-definitions-categories")}
                            >
                                Kategoriler
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{isEdit ? "Kategori Düzenle" : "Kategori Ekle"}</span>
                            <span className="ec-cat-type-badge">{typeLabel}</span>
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

                <div className="ec-prod-form-body ec-cat-form-body">
                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>
                                Temel Bilgi <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                            </h3>
                        </div>
                        <div className="ec-prod-grid ec-purchase-grid--2">
                            <div className="ec-prod-field">
                                <label>Kategori Adı *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => onNameChange(e.target.value)}
                                    placeholder="e.g. Aksesuar, Giyim..."
                                />
                            </div>
                            {form.categoryType === "normal" && (
                                <div className="ec-prod-field">
                                    <EcFieldLabel hint={EC_FIELD_HINTS.categoryParent}>
                                        Ebeveyn Kategori
                                    </EcFieldLabel>
                                    <EcSelect
                                        value={form.parentId}
                                        onChange={(e) => setField({ parentId: e.target.value })}
                                    >
                                        <option value="">Üst kategori yok</option>
                                        {parentOptions.map((c) => (
                                            <option key={c._id} value={c._id}>
                                                {c.path}
                                            </option>
                                        ))}
                                    </EcSelect>
                                </div>
                            )}
                        </div>
                        <div className="ec-prod-field ec-prod-field--full">
                            <label>Açıklama</label>
                            <ProductRichHtmlEditor
                                value={form.description}
                                onChange={(html) => setField({ description: html })}
                                loadKey={categoryId || "new"}
                                placeholder="Kategori açıklaması…"
                                compact
                            />
                        </div>
                    </section>

                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>Görsel</h3>
                        </div>
                        {form.imageUrl ? (
                            <div className="ec-cat-image-preview">
                                <img src={form.imageUrl} alt="" />
                                <button type="button" className="ec-prod-btn" onClick={() => setField({ imageUrl: "" })}>
                                    Kaldır
                                </button>
                            </div>
                        ) : (
                            <label className="ec-cat-image-drop">
                                <FaUpload />
                                <p>Maksimum 10MB — .jpeg, .jpg, .png, .webp</p>
                                <span>+ Görsel Ekle</span>
                                <input type="file" accept="image/*" hidden onChange={handleImage} />
                            </label>
                        )}
                    </section>

                    {form.categoryType === "dynamic" && (
                        <section className="ec-prod-section">
                            <div className="ec-prod-section__head">
                                <h3>Koşullar</h3>
                            </div>
                            <p className="ec-cat-section-hint">
                                Belirlediğiniz koşullara uyan mevcut ve ileride eklenecek ürünler bu kategoriye
                                otomatik eklenir.
                            </p>
                            <div className="ec-cat-condition-match" role="radiogroup" aria-label="Koşul eşleştirme">
                                <label className="ec-cat-condition-match__option">
                                    <input
                                        type="radio"
                                        name="conditionMatch"
                                        checked={form.conditionMatch === "all"}
                                        onChange={() => setField({ conditionMatch: "all" })}
                                    />
                                    <span className="ec-cat-condition-match__dot" aria-hidden="true" />
                                    Tüm koşulları sağlamalı
                                </label>
                                <label className="ec-cat-condition-match__option">
                                    <input
                                        type="radio"
                                        name="conditionMatch"
                                        checked={form.conditionMatch === "any"}
                                        onChange={() => setField({ conditionMatch: "any" })}
                                    />
                                    <span className="ec-cat-condition-match__dot" aria-hidden="true" />
                                    En az bir koşulu sağlamalı
                                </label>
                            </div>

                            <div className="ec-cat-condition-table">
                                <div className="ec-cat-condition-table__head">
                                    <span>Koşullar</span>
                                    <span>Metot</span>
                                    <span>Tanımlanmış Değerler</span>
                                    <span aria-hidden="true" />
                                </div>
                                {form.dynamicConditions.map((row, idx) => {
                                    const operatorOptions = operatorsForConditionField(row.field);
                                    const valueDisabled = row.field === "discounted";
                                    return (
                                        <div key={idx} className="ec-cat-condition-row">
                                            <EcSelect
                                                value={row.field}
                                                onChange={(e) => {
                                                    const field = e.target.value;
                                                    const next = [...form.dynamicConditions];
                                                    next[idx] = {
                                                        field,
                                                        operator: defaultOperatorForField(field),
                                                        value: field === "discounted" ? "yes" : "",
                                                    };
                                                    setField({ dynamicConditions: next });
                                                }}
                                            >
                                                {DYNAMIC_CONDITION_FIELDS.map((o) => (
                                                    <option key={o.id || "empty"} value={o.id}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </EcSelect>
                                            <EcSelect
                                                value={row.operator}
                                                disabled={!row.field}
                                                onChange={(e) => {
                                                    const next = [...form.dynamicConditions];
                                                    next[idx] = { ...next[idx], operator: e.target.value };
                                                    setField({ dynamicConditions: next });
                                                }}
                                            >
                                                {operatorOptions.map((o) => (
                                                    <option key={o.id} value={o.id}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </EcSelect>
                                            <div className="ec-cat-condition-value">
                                                <input
                                                    value={row.value}
                                                    disabled={!row.field || valueDisabled}
                                                    onChange={(e) => {
                                                        const next = [...form.dynamicConditions];
                                                        next[idx] = { ...next[idx], value: e.target.value };
                                                        setField({ dynamicConditions: next });
                                                    }}
                                                    placeholder="Arama Yapınız"
                                                />
                                                <FaSearch className="ec-cat-condition-value__icon" aria-hidden="true" />
                                            </div>
                                            <button
                                                type="button"
                                                className="ec-prod-icon-btn ec-cat-condition-row__del"
                                                aria-label="Koşulu kaldır"
                                                disabled={form.dynamicConditions.length <= 1}
                                                onClick={() =>
                                                    setField({
                                                        dynamicConditions: form.dynamicConditions.filter(
                                                            (_, i) => i !== idx
                                                        ),
                                                    })
                                                }
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="ec-cat-condition-foot">
                                <button
                                    type="button"
                                    className="ec-prod-btn"
                                    onClick={() =>
                                        setField({
                                            dynamicConditions: [
                                                ...form.dynamicConditions,
                                                emptyDynamicConditionRow(),
                                            ],
                                        })
                                    }
                                >
                                    Koşul Ekle
                                </button>
                            </div>
                        </section>
                    )}

                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>Ürünler</h3>
                        </div>
                        <p className="ec-cat-section-hint">
                            Belirlediğiniz sıralama ölçütüne göre bu kategorideki ürünler sitenizde sıralanır.
                        </p>
                        <div className="ec-prod-field">
                            <EcFieldLabel hint={EC_FIELD_HINTS.categorySortCriteria}>
                                Sıralama Ölçütü
                            </EcFieldLabel>
                            <EcSelect
                                value={form.sortCriteria}
                                onChange={(e) => setField({ sortCriteria: e.target.value })}
                            >
                                {SORT_CRITERIA_OPTIONS.map((o) => (
                                    <option key={o.id || "empty"} value={o.id}>
                                        {o.label}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>
                    </section>

                    <section className="ec-prod-section ec-cat-seo-section">
                        <div className="ec-prod-section__head">
                            <h3>Arama Motoru Optimizasyonu (SEO)</h3>
                        </div>
                        <div className="ec-cat-seo-grid">
                            <div className="ec-cat-seo-fields">
                                <div className="ec-prod-field">
                                    <EcFieldLabel hint={EC_FIELD_HINTS.categorySlug}>Slug</EcFieldLabel>
                                    <div className="ec-cat-slug-input">
                                        <span>/</span>
                                        <input
                                            value={form.seo.slug}
                                            onChange={(e) => onSeoChange({ slug: e.target.value })}
                                            maxLength={185}
                                        />
                                    </div>
                                    <span className="ec-cat-char-count">{form.seo.slug.length}/185</span>
                                </div>
                                <div className="ec-prod-field">
                                    <EcFieldLabel hint={EC_FIELD_HINTS.categoryPageTitle}>
                                        Sayfa Başlığı
                                    </EcFieldLabel>
                                    <input
                                        value={form.seo.pageTitle}
                                        onChange={(e) => onSeoChange({ pageTitle: e.target.value })}
                                        maxLength={256}
                                    />
                                    <span className="ec-cat-char-count">{form.seo.pageTitle.length}/256</span>
                                </div>
                                <div className="ec-prod-field">
                                    <EcFieldLabel hint={EC_FIELD_HINTS.categoryMetaDescription}>
                                        Açıklama
                                    </EcFieldLabel>
                                    <textarea
                                        rows={4}
                                        value={form.seo.metaDescription}
                                        onChange={(e) => onSeoChange({ metaDescription: e.target.value })}
                                        maxLength={320}
                                    />
                                    <span className="ec-cat-char-count">
                                        {form.seo.metaDescription.length}/320
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="ec-cat-seo-advanced-toggle"
                                    onClick={() => setSeoAdvancedOpen((v) => !v)}
                                >
                                    Gelişmiş SEO Ayarları {seoAdvancedOpen ? <FaChevronUp /> : <FaChevronDown />}
                                </button>
                                {seoAdvancedOpen && (
                                    <div className="ec-cat-seo-advanced">
                                        <label className="ec-cat-check-row">
                                            <input
                                                type="checkbox"
                                                checked={form.seo.noIndex}
                                                onChange={(e) => onSeoChange({ noIndex: e.target.checked })}
                                            />
                                            Bu sayfayı arama motorlarının taramasını engelle.
                                        </label>
                                        <div className="ec-prod-field">
                                            <label>Canonical URL</label>
                                            <input
                                                value={form.seo.canonicalUrl}
                                                onChange={(e) => onSeoChange({ canonicalUrl: e.target.value })}
                                                placeholder="URL değerini giriniz"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <aside className="ec-cat-seo-preview">
                                <h4>Önizleme</h4>
                                {hasSeoPreview ? (
                                    <div className="ec-cat-seo-preview__card">
                                        <p className="ec-cat-seo-preview__url">
                                            {storeDomain} › {seoPreviewSlug}
                                        </p>
                                        <p className="ec-cat-seo-preview__title">{seoPreviewTitle}</p>
                                        {seoPreviewDesc && (
                                            <p className="ec-cat-seo-preview__desc">{seoPreviewDesc}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="ec-cat-seo-preview__empty">
                                        Henüz önizlemeniz görünmüyor. Önizleme için bilgi girmeniz gerekmektedir.
                                    </p>
                                )}
                            </aside>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default StoreCategoryFormPage;
