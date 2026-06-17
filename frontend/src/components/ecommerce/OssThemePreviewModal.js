import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircularProgress } from "@mui/material";
import { X, Monitor, Smartphone, Download } from "lucide-react";
import * as wbApi from "../../services/websiteBuilderApi";

const PAGE_LABELS = {
    home: "Anasayfa",
    products: "Ürünler",
    collections: "Koleksiyonlar",
    blog: "Blog",
    about: "Hakkımızda",
    contact: "İletişim",
    faq: "SSS",
    cart: "Sepet",
    checkout: "Ödeme",
    account: "Hesabım",
    wishlist: "Favoriler",
};

/** grapes html + paylaşılan css → tam iframe belgesi */
function buildDoc(html, css) {
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=1280, initial-scale=1" />
<style>${css || ""}</style></head>
<body style="margin:0">${html || ""}</body></html>`;
}

export default function OssThemePreviewModal({ slug, onClose, onInstall, installing }) {
    const [theme, setTheme] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [device, setDevice] = useState("desktop");
    const [pageKey, setPageKey] = useState("home");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await wbApi.getOssTheme(slug);
            // Controller yanıtı { theme } sarmalıyor — aç
            setTheme(data?.theme || data);
        } catch {
            setError("Tema önizlemesi yüklenemedi.");
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => { load(); }, [load]);

    // ESC ile kapat
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const pages = useMemo(() => {
        const list = [{ key: "home", label: "Anasayfa" }];
        const pd = theme?.grapes?.pageData || {};
        Object.keys(pd).forEach((k) => list.push({ key: k, label: PAGE_LABELS[k] || k }));
        return list;
    }, [theme]);

    const srcDoc = useMemo(() => {
        if (!theme?.grapes) return "";
        const css = theme.grapes.css || "";
        if (pageKey === "home") return buildDoc(theme.grapes.html, css);
        const pd = theme.grapes.pageData?.[pageKey];
        const html = typeof pd === "string" ? pd : pd?.html || "";
        return buildDoc(html, css);
    }, [theme, pageKey]);

    return (
        <div className="oss-preview-modal" role="dialog" aria-modal="true">
            <div className="oss-preview-modal__backdrop" onClick={onClose} />
            <div className="oss-preview-modal__panel">
                {/* Üst bar */}
                <div className="oss-preview-modal__bar">
                    <div className="oss-preview-modal__title">
                        {theme?.name || "Önizleme"}
                        {theme?.category && <span className="oss-preview-modal__cat">{theme.category}</span>}
                    </div>

                    {/* Sayfa sekmeleri */}
                    {pages.length > 1 && (
                        <div className="oss-preview-modal__pages">
                            {pages.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    className={`oss-preview-modal__page ${pageKey === p.key ? "is-active" : ""}`}
                                    onClick={() => setPageKey(p.key)}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="oss-preview-modal__tools">
                        <div className="oss-preview-modal__device">
                            <button type="button" className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")} aria-label="Masaüstü"><Monitor size={16} /></button>
                            <button type="button" className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")} aria-label="Mobil"><Smartphone size={16} /></button>
                        </div>
                        {onInstall && (
                            <button
                                type="button"
                                className="oss-preview-modal__install"
                                disabled={installing}
                                onClick={() => onInstall(theme?.slug || slug)}
                            >
                                <Download size={16} />
                                {installing ? "Kuruluyor…" : "Kur ve düzenle"}
                            </button>
                        )}
                        <button type="button" className="oss-preview-modal__close" onClick={onClose} aria-label="Kapat"><X size={20} /></button>
                    </div>
                </div>

                {/* Gövde */}
                <div className="oss-preview-modal__stage">
                    {loading ? (
                        <div className="oss-preview-modal__loading"><CircularProgress size={32} /></div>
                    ) : error ? (
                        <div className="oss-preview-modal__error">{error}</div>
                    ) : (
                        <div className={`oss-preview-modal__frame oss-preview-modal__frame--${device}`}>
                            <iframe
                                title="Tema önizleme"
                                srcDoc={srcDoc}
                                className="oss-preview-modal__iframe"
                                sandbox="allow-same-origin"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
