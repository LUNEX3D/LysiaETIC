import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    FaArrowLeft,
    FaInfoCircle,
    FaUpload,
    FaChevronDown,
    FaChevronUp,
} from "react-icons/fa";
import {
    fetchStore,
    fetchStoreBrand,
    createStoreBrand,
    updateStoreBrand,
    deleteStoreBrand,
} from "../../../services/storeApi";
import { uploadProductImage } from "../../../services/productManagementApi";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcFieldLabel from "../../../components/ecommerce/EcFieldLabel";
import ProductRichHtmlEditor from "../products/ProductRichHtmlEditor";
import { EC_FIELD_HINTS } from "../../../constants/ecFieldHints";
import {
    emptyBrandForm,
    brandToForm,
    formToBrandPayload,
    slugifyBrandName,
    getStoreDisplayDomain,
    BRAND_SORT_CRITERIA_OPTIONS,
} from "./brandFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreBrandFormPage = ({ brandId, onNavigate }) => {
    const isEdit = !!brandId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [store, setStore] = useState(null);
    const [form, setForm] = useState(() => emptyBrandForm());
    const [seoAdvancedOpen, setSeoAdvancedOpen] = useState(false);
    const slugTouched = useRef(false);
    const titleTouched = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            setStore(storeRes.store || null);

            if (isEdit) {
                const res = await fetchStoreBrand(brandId);
                setForm(brandToForm(res.brand));
            } else {
                setForm(emptyBrandForm());
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [brandId, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    const storeDomain = useMemo(() => getStoreDisplayDomain(store), [store]);
    const seoPreviewTitle = form.seo.pageTitle?.trim() || form.name.trim() || "Marka";
    const seoPreviewSlug = form.seo.slug?.trim() || slugifyBrandName(form.name) || "marka";
    const seoPreviewDesc = form.seo.metaDescription?.trim();
    const hasSeoPreview = !!(form.name.trim() || form.seo.pageTitle?.trim() || form.seo.metaDescription?.trim());

    const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

    const onNameChange = (name) => {
        setForm((prev) => {
            const next = { ...prev, name };
            const seo = { ...prev.seo };
            if (!slugTouched.current) seo.slug = slugifyBrandName(name);
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
            setError("Marka adı zorunludur");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToBrandPayload(form);
            if (isEdit) {
                await updateStoreBrand(brandId, payload);
            } else {
                await createStoreBrand(payload);
            }
            onNavigate?.("ec-products-definitions-brands");
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
            await deleteStoreBrand(brandId);
            onNavigate?.("ec-products-definitions-brands");
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
                            onClick={() => onNavigate?.("ec-products-definitions-brands")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-definitions-brands")}
                            >
                                Markalar
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{isEdit ? "Marka Düzenle" : "Marka Ekle"}</span>
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
                        <div className="ec-prod-field">
                            <label>Marka Adı *</label>
                            <input
                                value={form.name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="Marka Adı"
                            />
                        </div>
                        <div className="ec-prod-field ec-prod-field--full">
                            <label>Açıklama</label>
                            <ProductRichHtmlEditor
                                value={form.description}
                                onChange={(html) => setField({ description: html })}
                                loadKey={brandId || "new-brand"}
                                placeholder="Marka açıklaması…"
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
                                <p>
                                    Maksimum 10MB boyutunda .jpeg, .jpg, .png, .webp ya da .heic türlerinde dosya
                                    yükleyebilirsiniz.
                                </p>
                                <span>+ Görsel Ekle</span>
                                <input type="file" accept="image/*" hidden onChange={handleImage} />
                            </label>
                        )}
                    </section>

                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>Ürünler</h3>
                        </div>
                        <p className="ec-cat-section-hint">
                            Belirlediğiniz sıralama ölçütüne göre bu markadaki ürünleriniz sitenizde aşağıdaki gibi
                            sıralanacaktır.
                        </p>
                        <div className="ec-prod-field">
                            <EcFieldLabel hint={EC_FIELD_HINTS.categorySortCriteria}>
                                Sıralama Ölçütü
                            </EcFieldLabel>
                            <EcSelect
                                value={form.sortCriteria}
                                onChange={(e) => setField({ sortCriteria: e.target.value })}
                            >
                                {BRAND_SORT_CRITERIA_OPTIONS.map((o) => (
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

export default StoreBrandFormPage;
