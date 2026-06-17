/**
 * EcUrlRedirectsHub — URL yapısı ve 301/302 yönlendirmeler
 */
import React, { useEffect, useState } from "react";
import {
    FaLink, FaPlus, FaTrash, FaSave, FaSpinner, FaExclamationTriangle,
} from "react-icons/fa";
import * as wbApi from "../../../services/websiteBuilderApi";
import "../../../styles/ecPublishHub.css";

export default function EcUrlRedirectsHub({ siteId }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [redirects, setRedirects] = useState([]);
    const [urlSettings, setUrlSettings] = useState({
        productPath: "/products",
        categoryPath: "/category",
        blogPath: "/blog",
        pagePath: "/pages",
    });
    const [newRedirect, setNewRedirect] = useState({ fromPath: "", toPath: "", type: "301" });

    const load = () => {
        setLoading(true);
        Promise.all([
            wbApi.getSeoCenter(siteId),
            wbApi.getSite(siteId),
        ])
            .then(([seoData, siteData]) => {
                setRedirects(seoData.redirects || []);
                const us = siteData.site?.urlSettings || {};
                setUrlSettings({
                    productPath: us.productPath || "/products",
                    categoryPath: us.categoryPath || "/category",
                    blogPath: us.blogPath || "/blog",
                    pagePath: us.pagePath || "/pages",
                });
            })
            .catch(() => setError("Veriler yüklenemedi"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [siteId]);

    const saveUrlSettings = async () => {
        setSaving(true);
        setError("");
        try {
            await wbApi.updateSite(siteId, { urlSettings });
            load();
        } catch (e) {
            setError(e?.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const addRedirect = async () => {
        if (!newRedirect.fromPath || !newRedirect.toPath) return;
        try {
            await wbApi.createRedirect(siteId, newRedirect);
            setNewRedirect({ fromPath: "", toPath: "", type: "301" });
            load();
        } catch (e) {
            setError(e?.response?.data?.error || "Yönlendirme eklenemedi");
        }
    };

    const removeRedirect = async (id) => {
        await wbApi.deleteRedirect(siteId, id);
        load();
    };

    if (loading) {
        return (
            <div className="eph-page eph-page--light">
                <div className="eph-loading"><FaSpinner className="eph-spin" /><p>Yükleniyor…</p></div>
            </div>
        );
    }

    return (
        <div className="eph-page eph-page--light">
            <header className="eph-header">
                <div className="eph-header-icon"><FaLink /></div>
                <div>
                    <h1>URL & Yönlendirme</h1>
                    <p>Profesyonel URL yapısı ve eski link yönetimi</p>
                </div>
            </header>

            {error && (
                <div className="eph-banner eph-banner--error">
                    <FaExclamationTriangle /><span>{error}</span>
                </div>
            )}

            <section className="eph-panel">
                <h3>URL yapısı</h3>
                <div className="eph-form-grid">
                    <label>
                        Ürün
                        <input
                            value={urlSettings.productPath}
                            onChange={(e) => setUrlSettings({ ...urlSettings, productPath: e.target.value })}
                        />
                        <small>Örnek: {urlSettings.productPath}/iphone-16</small>
                    </label>
                    <label>
                        Kategori
                        <input
                            value={urlSettings.categoryPath}
                            onChange={(e) => setUrlSettings({ ...urlSettings, categoryPath: e.target.value })}
                        />
                    </label>
                    <label>
                        Blog
                        <input
                            value={urlSettings.blogPath}
                            onChange={(e) => setUrlSettings({ ...urlSettings, blogPath: e.target.value })}
                        />
                    </label>
                    <label>
                        Sayfa
                        <input
                            value={urlSettings.pagePath}
                            onChange={(e) => setUrlSettings({ ...urlSettings, pagePath: e.target.value })}
                        />
                    </label>
                </div>
                <button type="button" className="eph-btn-ghost" onClick={saveUrlSettings} disabled={saving}>
                    {saving ? <FaSpinner className="eph-spin" /> : <FaSave />} URL yapısını kaydet
                </button>
            </section>

            <section className="eph-panel">
                <h3>Yönlendirmeler</h3>
                <p className="eph-panel-desc">
                    Eski URL&apos;leri yeni adreslere yönlendirin. Ürün slug değiştiğinde otomatik 301 önerilir.
                </p>

                <div className="eph-redirect-form">
                    <input
                        placeholder="/eski-url"
                        value={newRedirect.fromPath}
                        onChange={(e) => setNewRedirect({ ...newRedirect, fromPath: e.target.value })}
                    />
                    <span>→</span>
                    <input
                        placeholder="/yeni-url"
                        value={newRedirect.toPath}
                        onChange={(e) => setNewRedirect({ ...newRedirect, toPath: e.target.value })}
                    />
                    <select
                        value={newRedirect.type}
                        onChange={(e) => setNewRedirect({ ...newRedirect, type: e.target.value })}
                    >
                        <option value="301">301 Kalıcı</option>
                        <option value="302">302 Geçici</option>
                    </select>
                    <button type="button" className="eph-btn-publish eph-btn-sm" onClick={addRedirect}>
                        <FaPlus /> Ekle
                    </button>
                </div>

                {redirects.length === 0 ? (
                    <p className="eph-muted">Henüz yönlendirme yok.</p>
                ) : (
                    <div className="eph-table-wrap">
                        <table className="eph-table">
                            <thead>
                                <tr>
                                    <th>Kaynak</th>
                                    <th>Hedef</th>
                                    <th>Tip</th>
                                    <th>Hit</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {redirects.map((r) => (
                                    <tr key={r._id}>
                                        <td><code>{r.fromPath}</code></td>
                                        <td><code>{r.toPath}</code></td>
                                        <td>{r.type || "301"}</td>
                                        <td>{r.hitCount ?? 0}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="eph-btn-icon"
                                                onClick={() => removeRedirect(r._id)}
                                                aria-label="Sil"
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
        </div>
    );
}
