/**
 * EcSeoHub — Shopify seviyesi SEO merkezi (genel, ürün, kategori, blog, teknik, AI)
 */
import React, { useCallback, useEffect, useState } from "react";
import {
    FaSearch, FaBox, FaFolder, FaBlog, FaCog, FaMagic, FaCheckCircle,
    FaExclamationTriangle, FaSpinner, FaExternalLinkAlt,
} from "react-icons/fa";
import SEOSettings from "../../websiteBuilder/SEOSettings";
import SEOCenter from "../../websiteBuilder/SEOCenter";
import * as wbApi from "../../../services/websiteBuilderApi";
import "../../../styles/ecPublishHub.css";

const TABS = [
    { key: "general", label: "Genel", icon: FaSearch },
    { key: "products", label: "Ürünler", icon: FaBox },
    { key: "categories", label: "Kategoriler", icon: FaFolder },
    { key: "blog", label: "Blog", icon: FaBlog },
    { key: "technical", label: "Teknik SEO", icon: FaCog },
    { key: "ai", label: "AI Asistan", icon: FaMagic },
];

function EntitySeoPanel({ siteId, entityType, titleField = "metaTitle", descField = "metaDescription" }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [edit, setEdit] = useState(null);
    const [saving, setSaving] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        wbApi.listSeoEntities(siteId, entityType, { filter, limit: 50 })
            .then((d) => setItems(d.items || []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [siteId, entityType, filter]);

    useEffect(() => { load(); }, [load]);

    const openEdit = (item) => {
        const seo = item.seo || {};
        setEdit({
            id: item.id,
            name: item.name,
            title: seo[titleField] || seo.title || seo.pageTitle || "",
            description: seo[descField] || seo.description || seo.metaDescription || "",
            slug: item.slug || seo.slug || "",
        });
    };

    const saveEdit = async () => {
        if (!edit) return;
        setSaving(true);
        try {
            const seo = entityType === "blog"
                ? { title: edit.title, description: edit.description, slug: edit.slug }
                : entityType === "category"
                    ? { pageTitle: edit.title, metaDescription: edit.description, slug: edit.slug }
                    : { metaTitle: edit.title, metaDescription: edit.description, slug: edit.slug };
            await wbApi.updateSeoEntity(siteId, entityType, edit.id, seo);
            setEdit(null);
            load();
        } finally {
            setSaving(false);
        }
    };

    const aiFill = async (item) => {
        const gen = await wbApi.generateSeoAi(siteId, entityType, { name: item.name, title: item.name });
        const seo = gen.seo || {};
        setEdit({
            id: item.id,
            name: item.name,
            title: seo.metaTitle || seo.title || seo.pageTitle || "",
            description: seo.metaDescription || seo.description || "",
            slug: seo.slug || item.slug || "",
        });
    };

    const bulkAi = async () => {
        setBulkLoading(true);
        setMsg("");
        try {
            const r = await wbApi.bulkGenerateSeo(siteId, entityType, 25);
            setMsg(`${r.processed} kayıt için SEO üretildi`);
            load();
        } catch {
            setMsg("Toplu üretim başarısız");
        } finally {
            setBulkLoading(false);
        }
    };

    const incomplete = items.filter((i) => !i.complete).length;

    return (
        <div className="eph-seo-entity">
            <div className="eph-seo-toolbar">
                <div className="eph-filter-pills">
                    <button type="button" className={`eph-pill ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>Tümü</button>
                    <button type="button" className={`eph-pill ${filter === "incomplete" ? "is-active" : ""}`} onClick={() => setFilter("incomplete")}>
                        Eksik SEO {incomplete > 0 && `(${incomplete})`}
                    </button>
                </div>
                <button type="button" className="eph-btn-hero eph-btn-sm" onClick={bulkAi} disabled={bulkLoading}>
                    {bulkLoading ? <FaSpinner className="eph-spin" /> : <FaMagic />}
                    Eksikler için AI üret
                </button>
            </div>
            {msg && <div className="eph-banner eph-banner--success"><FaCheckCircle /><span>{msg}</span></div>}

            {loading ? (
                <div className="eph-loading"><FaSpinner className="eph-spin" /></div>
            ) : items.length === 0 ? (
                <p className="eph-muted">Kayıt bulunamadı. Mağaza ürün/kategori bağlantısını kontrol edin.</p>
            ) : (
                <div className="eph-table-wrap">
                    <table className="eph-table">
                        <thead>
                            <tr>
                                <th>Ad</th>
                                <th>Slug</th>
                                <th>Durum</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td><code>{item.slug || "—"}</code></td>
                                    <td>
                                        {item.complete ? (
                                            <span className="eph-badge eph-badge--ok"><FaCheckCircle /> Tamam</span>
                                        ) : (
                                            <span className="eph-badge eph-badge--warn"><FaExclamationTriangle /> Eksik</span>
                                        )}
                                    </td>
                                    <td className="eph-row-actions">
                                        <button type="button" className="eph-btn-ghost eph-btn-sm" onClick={() => openEdit(item)}>Düzenle</button>
                                        <button type="button" className="eph-btn-ghost eph-btn-sm" onClick={() => aiFill(item)}><FaMagic /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {edit && (
                <div className="eph-modal-backdrop" onClick={() => setEdit(null)} role="presentation">
                    <div className="eph-modal" onClick={(e) => e.stopPropagation()} role="dialog">
                        <h3>SEO — {edit.name}</h3>
                        <label>SEO başlığı<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={60} /></label>
                        <label>SEO açıklaması<textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={160} /></label>
                        <label>URL slug<input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></label>
                        <div className="eph-modal-foot">
                            <button type="button" className="eph-btn-ghost" onClick={() => setEdit(null)}>İptal</button>
                            <button type="button" className="eph-btn-publish" onClick={saveEdit} disabled={saving}>
                                {saving ? <FaSpinner className="eph-spin" /> : null} Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AiAssistantPanel({ siteId, siteName }) {
    const [entityType, setEntityType] = useState("product");
    const [context, setContext] = useState({ name: siteName || "", description: "" });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        try {
            const r = await wbApi.generateSeoAi(siteId, entityType, context);
            setResult(r);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="eph-panel">
            <h3><FaMagic /> AI SEO Yardımcısı</h3>
            <div className="eph-form-grid">
                <label>
                    İçerik tipi
                    <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                        <option value="site">Site geneli</option>
                        <option value="product">Ürün</option>
                        <option value="category">Kategori</option>
                        <option value="blog">Blog</option>
                    </select>
                </label>
                <label>
                    Başlık / ürün adı
                    <input value={context.name} onChange={(e) => setContext({ ...context, name: e.target.value })} />
                </label>
                <label className="eph-form-full">
                    Açıklama (opsiyonel)
                    <textarea rows={3} value={context.description} onChange={(e) => setContext({ ...context, description: e.target.value })} />
                </label>
            </div>
            <button type="button" className="eph-btn-publish" onClick={generate} disabled={loading}>
                {loading ? <FaSpinner className="eph-spin" /> : <FaMagic />} SEO üret
            </button>
            {result && (
                <pre className="eph-ai-result">{JSON.stringify(result.seo, null, 2)}</pre>
            )}
            {result?.source && (
                <p className="eph-muted">Kaynak: {result.source === "ai" ? "AI" : "Şablon"}</p>
            )}
        </section>
    );
}

export default function EcSeoHub({ siteId }) {
    const [tab, setTab] = useState("general");
    const [siteName, setSiteName] = useState("");

    useEffect(() => {
        if (!siteId) return;
        wbApi.getSite(siteId).then((d) => setSiteName(d.site?.name || "")).catch(() => {});
    }, [siteId]);

    return (
        <div className="eph-page eph-page--light eph-seo-hub">
            <header className="eph-header">
                <div className="eph-header-icon"><FaSearch /></div>
                <div>
                    <h1>SEO Merkezi</h1>
                    <p>Meta, Open Graph, ürün/kategori/blog SEO ve teknik optimizasyon</p>
                </div>
            </header>

            <nav className="eph-tabbar eph-tabbar--seo">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            className={`eph-tabbar-item ${tab === t.key ? "is-active" : ""}`}
                            onClick={() => setTab(t.key)}
                        >
                            <Icon />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </nav>

            {tab === "general" && <SEOSettings siteId={siteId} />}
            {tab === "products" && <EntitySeoPanel siteId={siteId} entityType="product" />}
            {tab === "categories" && (
                <EntitySeoPanel siteId={siteId} entityType="category" titleField="pageTitle" descField="metaDescription" />
            )}
            {tab === "blog" && (
                <EntitySeoPanel siteId={siteId} entityType="blog" titleField="title" descField="description" />
            )}
            {tab === "technical" && <SEOCenter siteId={siteId} embeddedMetaOnly={false} />}
            {tab === "ai" && <AiAssistantPanel siteId={siteId} siteName={siteName} />}
        </div>
    );
}
