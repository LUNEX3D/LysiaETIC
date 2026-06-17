import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { FaPaintBrush, FaExternalLinkAlt, FaStore } from "react-icons/fa";
import * as themeStudioApi from "../api/themeStudioApi";
import "../styles/theme-studio.css";
import "../styles/theme-studio-pro.css";
import ThemePageToolbar from "../components/ThemePageToolbar";

const THEME_GRADIENTS = {
    bookly: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    freshcart: "linear-gradient(135deg, #059669, #10b981)",
    quickcart: "linear-gradient(135deg, #0f172a, #334155)",
    dawn: "linear-gradient(135deg, #202223, #008060)",
};

function ThemePreview({ item }) {
    const slug = (item.themeId || item.themeName || "").toLowerCase();
    const grad = THEME_GRADIENTS[slug] || "linear-gradient(135deg, #6366f1, #8b5cf6)";
    if (item.thumbnailUrl?.startsWith("css:")) {
        return <div style={{ width: "100%", height: "100%", background: item.thumbnailUrl.slice(4) }} />;
    }
    if (item.thumbnailUrl) {
        return <img src={item.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
    }
    return (
        <div style={{ width: "100%", height: "100%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 800 }}>
            {(item.themeName || "Tema").slice(0, 1)}
        </div>
    );
}

export default function MyThemesPage({ siteId: siteIdProp, embedded, site: siteProp, onPanelNavigate, onExitToProgram }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const navigate = useNavigate();
    const exitToMain = onExitToProgram || (() => navigate("/dashboard"));
    const outlet = useOutletContext() || {};
    const siteFromOutlet = siteProp || outlet.site;
    const [installs, setInstalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        themeStudioApi.getMyThemes()
            .then((res) => {
                const list = res.installs || [];
                if (!list.length && siteFromOutlet) {
                    setInstalls([{
                        siteId: String(siteFromOutlet._id || siteFromOutlet.id || siteId),
                        siteName: siteFromOutlet.name,
                        slug: siteFromOutlet.slug,
                        themeId: siteFromOutlet.themeId || "bookly",
                        themeName: siteFromOutlet.themeId || "Bookly",
                        status: siteFromOutlet.status,
                        engine: siteFromOutlet.themeBuilderVersion || "v3",
                    }]);
                } else {
                    setInstalls(list);
                }
            })
            .catch((e) => {
                setError(e?.response?.data?.error || "Temalar yüklenemedi");
                if (siteFromOutlet) {
                    setInstalls([{
                        siteId: String(siteFromOutlet._id || siteFromOutlet.id || siteId),
                        siteName: siteFromOutlet.name,
                        slug: siteFromOutlet.slug,
                        themeId: siteFromOutlet.themeId || "bookly",
                        themeName: "Bookly",
                        status: siteFromOutlet.status,
                        engine: siteFromOutlet.themeBuilderVersion || "v3",
                    }]);
                }
            })
            .finally(() => setLoading(false));
    }, [siteFromOutlet, siteId]);

    const openEditor = (targetSiteId, mode) => {
        const qs = mode ? `?mode=${mode}` : "";
        navigate(`/website-builder/${targetSiteId || siteId}/themes/editor${qs}`);
    };

    const openMarketplace = () => {
        if (embedded && onPanelNavigate) {
            onPanelNavigate("ec-wb-marketplace");
            return;
        }
        navigate(`/website-builder/${siteId}/themes`);
    };

    const primary = installs.find((i) => String(i.siteId) === String(siteId)) || installs[0];

    if (loading) {
        return <div className="tb-market tb-market--pro" style={{ display: "flex", justifyContent: "center", padding: 48 }}><CircularProgress /></div>;
    }

    return (
        <div className="tb-market tb-market--pro">
            <ThemePageToolbar onExitToProgram={exitToMain} />

            <div className="tb-market-hero">
                <h1><FaStore style={{ marginRight: 10, opacity: 0.9 }} />Temalarım</h1>
                <p>
                    Mağazanızın görünümünü İkas ve Shopify tarzı editörle özelleştirin.
                    Bölüm düzeni, marka renkleri ve header/footer ayarları tek yerden yönetilir.
                </p>
                <div className="tb-market-hero__actions">
                    <button type="button" className="tb-btn tb-btn--primary" onClick={() => openEditor(siteId)}>
                        <FaPaintBrush /> Temayı özelleştir
                    </button>
                    <button type="button" className="tb-btn" onClick={() => openEditor(siteId, "brand")}>
                        Marka & stil
                    </button>
                    <button type="button" className="tb-btn" onClick={openMarketplace}>
                        Tema mağazası
                    </button>
                </div>
            </div>

            <div className="tb-market-body">
                {error && <p style={{ color: "#dc2626", marginBottom: 12, fontSize: 14 }}>{error}</p>}

                {primary && (
                    <article className="tb-active-theme">
                        <div className="tb-active-theme__preview">
                            <span className="tb-active-theme__badge">
                                {primary.status === "published" ? "Yayındaki tema" : "Taslak"}
                            </span>
                            <ThemePreview item={primary} />
                        </div>
                        <div className="tb-active-theme__info">
                            <h2>{primary.siteName}</h2>
                            <p className="tb-active-theme__meta">
                                <strong>{primary.themeName}</strong> · /{primary.slug}<br />
                                Motor: {primary.engine} · Durum: {primary.status || "draft"}
                            </p>
                            <div className="tb-active-theme__cta">
                                <button type="button" className="tb-btn tb-btn--primary" onClick={() => openEditor(primary.siteId)}>
                                    Temayı özelleştir
                                </button>
                                <button type="button" className="tb-btn" onClick={() => openEditor(primary.siteId, "brand")}>
                                    Marka stili
                                </button>
                                <button type="button" className="tb-btn" onClick={() => window.open(`/s/${primary.slug}`, "_blank")}>
                                    <FaExternalLinkAlt /> Canlı önizleme
                                </button>
                            </div>
                        </div>
                    </article>
                )}

                {installs.length > 1 && (
                    <>
                        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Diğer mağazalar</h3>
                        <div className="tb-market__grid tb-market__grid--pro">
                            {installs.filter((i) => i !== primary).map((item) => (
                                <article key={item.siteId} className="tb-market-card-pro">
                                    <div className="tb-market-card-pro__frame">
                                        <div className="tb-market-card-pro__viewport">
                                            <ThemePreview item={item} />
                                        </div>
                                    </div>
                                    <div className="tb-market-card-pro__body">
                                        <h3>{item.siteName}</h3>
                                        <p>{item.themeName} · /{item.slug}</p>
                                        <div className="tb-market-card-pro__actions">
                                            <button type="button" className="tb-btn tb-btn--primary" onClick={() => openEditor(item.siteId)}>
                                                Düzenle
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                {!installs.length && (
                    <div style={{ padding: 32, textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 12 }}>
                        <p>Henüz kurulu tema yok.</p>
                        <button type="button" className="tb-btn tb-btn--primary" style={{ marginTop: 12 }} onClick={openMarketplace}>
                            Tema mağazasından seç
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
