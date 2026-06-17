import React, { useState, useMemo } from "react";
import { FaInfoCircle, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { SEO_LIMITS } from "../../../constants/ecommerceProductForm";
import { slugifyForUrl, normalizeCanonicalPath, buildProductPreviewUrl } from "../../../utils/productSeo";

const CharField = ({ label, value, onChange, max, multiline, prefix, onBlur }) => {
    const len = (value || "").length;
    return (
        <div className={`ec-prod-field ec-prod-field--full ${multiline ? "" : "ec-prod-char-field"}`}>
            <label>{label}</label>
            <div className={prefix ? "ec-prod-slug-wrap" : undefined}>
                {prefix && <span className="ec-prod-slug-prefix">/</span>}
                {multiline ? (
                    <textarea
                        rows={3}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlur}
                        maxLength={max}
                    />
                ) : (
                    <input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlur}
                        maxLength={max}
                    />
                )}
                <span className="ec-prod-char-count">
                    {len}/{max}
                </span>
            </div>
        </div>
    );
};

const ProductFormSeoSection = ({ form, setForm, storeHost, visible }) => {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [canonicalDraft, setCanonicalDraft] = useState("");

    const updateSeo = (patch) => setForm({ ...form, seo: { ...form.seo, ...patch } });

    const displaySlug = form.seo.slug || "";
    const previewSlug = slugifyForUrl(displaySlug || form.title);

    const seoTitle = form.seo.metaTitle?.trim() || form.title?.trim() || "";
    const seoDesc =
        form.seo.metaDescription?.trim() ||
        (form.description ? form.description.replace(/<[^>]+>/g, "").slice(0, 160) : "");

    const previewUrl = useMemo(
        () => buildProductPreviewUrl({ storeHost, slug: previewSlug }),
        [storeHost, previewSlug]
    );

    const hasPreview = !!(previewSlug || seoTitle || seoDesc);

    const applyCanonical = () => {
        const path = normalizeCanonicalPath(canonicalDraft);
        if (!path) return;
        updateSeo({ canonicalUrl: path });
        setCanonicalDraft("");
    };

    if (!visible) return null;

    return (
        <section className="ec-prod-section" id="ec-sec-seo">
            <h3>
                Arama Motoru Optimizasyonu (SEO){" "}
                <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
            </h3>

            <div className="ec-prod-seo-split">
                <div className="ec-prod-seo-fields">
                    <CharField
                        label="Slug"
                        prefix
                        max={SEO_LIMITS.slug}
                        value={displaySlug}
                        onChange={(v) => updateSeo({ slug: v })}
                        onBlur={() => {
                            const s = slugifyForUrl(displaySlug);
                            if (s && s !== displaySlug) updateSeo({ slug: s });
                        }}
                    />
                    <CharField
                        label="Sayfa Başlığı"
                        max={SEO_LIMITS.metaTitle}
                        value={form.seo.metaTitle}
                        onChange={(v) => updateSeo({ metaTitle: v })}
                    />
                    <CharField
                        label="Açıklama"
                        multiline
                        max={SEO_LIMITS.metaDescription}
                        value={form.seo.metaDescription}
                        onChange={(v) => updateSeo({ metaDescription: v })}
                    />

                    <button
                        type="button"
                        className={`ec-prod-seo-advanced-toggle ${advancedOpen ? "ec-prod-seo-advanced-toggle--open" : ""}`}
                        onClick={() => setAdvancedOpen(!advancedOpen)}
                        aria-expanded={advancedOpen}
                    >
                        Gelişmiş SEO Ayarları
                        {advancedOpen ? <FaChevronUp /> : <FaChevronDown />}
                    </button>

                    {advancedOpen && (
                        <div className="ec-prod-seo-advanced">
                            <label className="ec-prod-check-label ec-prod-seo-noindex">
                                <input
                                    type="checkbox"
                                    checked={!!form.seo.noindex}
                                    onChange={(e) => updateSeo({ noindex: e.target.checked })}
                                />
                                Bu sayfayı arama motorlarının taramasını engelle.
                            </label>

                            <div className="ec-prod-field ec-prod-field--full">
                                <label>Canonical URL</label>
                                <div className="ec-prod-canonical-row">
                                    <div className="ec-prod-slug-wrap ec-prod-canonical-input">
                                        <span className="ec-prod-slug-prefix">/</span>
                                        <input
                                            value={canonicalDraft}
                                            onChange={(e) =>
                                                setCanonicalDraft(
                                                    e.target.value.replace(/^\//, "")
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    applyCanonical();
                                                }
                                            }}
                                            placeholder="URL değerini giriniz ve ENTER'a basınız."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--canonical"
                                        onClick={applyCanonical}
                                    >
                                        Ekle
                                    </button>
                                </div>
                                {form.seo.canonicalUrl && (
                                    <div className="ec-prod-canonical-set">
                                        <span>{form.seo.canonicalUrl}</span>
                                        <button
                                            type="button"
                                            className="ec-prod-link"
                                            onClick={() => updateSeo({ canonicalUrl: "" })}
                                        >
                                            Kaldır
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="ec-prod-seo-preview-col">
                    <label className="ec-prod-preview-label">Önizleme</label>
                    <div className="ec-prod-seo-preview">
                        {hasPreview ? (
                            <>
                                <div className="ec-prod-seo-preview__url">{previewUrl}</div>
                                <strong>{seoTitle || form.title || "Sayfa başlığı"}</strong>
                                <p>{seoDesc || "Meta açıklama"}</p>
                                {form.seo.noindex && (
                                    <p className="ec-prod-seo-preview__badge">noindex</p>
                                )}
                            </>
                        ) : (
                            <p className="ec-prod-muted">
                                Henüz önizlemeniz görünmüyor. Önizleme için bilgi girmeniz gerekmektedir.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProductFormSeoSection;
