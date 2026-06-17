import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { Monitor, Smartphone } from "lucide-react";
import * as themeStudioApi from "../api/themeStudioApi";
import "../styles/theme-studio.css";
import "../styles/theme-studio-pro.css";
import ThemePageToolbar from "../components/ThemePageToolbar";

const CATEGORY_LABELS = {
    books: "Kitap & Kırtasiye",
    food: "Gıda & Market",
    electronics: "Elektronik",
    minimal: "Minimal",
};

const THEME_GRADIENTS = {
    bookly: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    freshcart: "linear-gradient(135deg, #059669, #10b981)",
    quickcart: "linear-gradient(135deg, #0f172a, #334155)",
    dawn: "linear-gradient(135deg, #202223, #008060)",
};

function ThemeCover({ theme, device = "desktop" }) {
    const url = theme.thumbnailUrl || theme.previewUrl || "";
    const frameClass = device === "mobile" ? " tb-market-card-pro__frame--mobile" : "";

    const inner = () => {
        if (url.startsWith("css:")) {
            return <div style={{ width: "100%", height: "100%", background: url.slice(4) }} />;
        }
        if (url) {
            return <img src={url} alt={theme.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
        }
        const grad = THEME_GRADIENTS[theme.slug] || "linear-gradient(135deg, #6366f1, #8b5cf6)";
        return (
            <div style={{ width: "100%", height: "100%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 22 }}>
                {theme.name}
            </div>
        );
    };

    return (
        <div className={`tb-market-card-pro__frame${frameClass}`}>
            <div className="tb-market-card-pro__viewport">{inner()}</div>
        </div>
    );
}

function ThemeMarketCard({ theme, busy, onInstall, onPreview, device, onDeviceChange }) {
    return (
        <article className="tb-market-card-pro">
            <div style={{ position: "relative" }}>
                <ThemeCover theme={theme} device={device} />
                <div className="tb-market-card-pro__device-toggle">
                    <button type="button" className={device === "desktop" ? "active" : ""} onClick={() => onDeviceChange("desktop")} title="Masaüstü">
                        <Monitor size={14} />
                    </button>
                    <button type="button" className={device === "mobile" ? "active" : ""} onClick={() => onDeviceChange("mobile")} title="Mobil">
                        <Smartphone size={14} />
                    </button>
                </div>
            </div>
            <div className="tb-market-card-pro__body">
                {theme.isFeatured && <span className="tb-market-card-pro__tag">Öne çıkan</span>}
                <h3>{theme.name}</h3>
                <p>{theme.description || `${CATEGORY_LABELS[theme.category] || theme.category} mağaza teması`}</p>
                <div className="tb-market-card-pro__tags">
                    <span className="tb-market-card-pro__tag">{CATEGORY_LABELS[theme.category] || theme.category}</span>
                    <span className="tb-market-card-pro__tag">{theme.license || "MIT"}</span>
                </div>
                <div className="tb-market-card-pro__actions">
                    <button type="button" className="tb-btn tb-btn--primary" onClick={() => onInstall(theme.slug)} disabled={busy === theme.slug}>
                        {busy === theme.slug ? "Kuruluyor…" : "Özelleştir"}
                    </button>
                    <button type="button" className="tb-btn" onClick={onPreview}>Önizle</button>
                </div>
            </div>
        </article>
    );
}

export default function ThemeMarketplacePage({ siteId: siteIdProp, embedded, onPanelNavigate, onExitToProgram }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const navigate = useNavigate();
    const exitToMain = onExitToProgram || (() => navigate("/dashboard"));
    const [themes, setThemes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [category, setCategory] = useState("all");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [cardDevices, setCardDevices] = useState({});

    useEffect(() => {
        themeStudioApi.getThemeMarketplace()
            .then((res) => {
                setThemes(res.themes || []);
                setCategories(res.categories || []);
            })
            .catch((e) => setError(e?.response?.data?.error || "Tema mağazası yüklenemedi"))
            .finally(() => setLoading(false));
    }, []);

    const filtered = category === "all" ? themes : themes.filter((t) => t.category === category);

    const openEditor = (mode) => {
        const qs = mode ? `?mode=${mode}` : "";
        navigate(`/website-builder/${siteId}/themes/editor${qs}`);
    };

    const openMyThemes = () => {
        if (embedded && onPanelNavigate) {
            onPanelNavigate("ec-wb-my-themes");
            return;
        }
        navigate(`/website-builder/${siteId}/themes/my`);
    };

    const install = async (slug) => {
        try {
            setBusy(slug);
            setError("");
            await themeStudioApi.installThemeStudio(siteId, slug);
            openEditor();
        } catch (e) {
            setError(e?.response?.data?.error || "Tema kurulamadı");
        } finally {
            setBusy("");
        }
    };

    const setCardDevice = (slug, device) => {
        setCardDevices((prev) => ({ ...prev, [slug]: device }));
    };

    if (loading) {
        return <div className="tb-market tb-market--pro" style={{ display: "flex", justifyContent: "center", padding: 48 }}><CircularProgress /></div>;
    }

    return (
        <div className="tb-market tb-market--pro">
            <ThemePageToolbar onExitToProgram={exitToMain} />

            <div className="tb-market-hero">
                <h1>Tema Mağazası</h1>
                <p>
                    Bookly, FreshCart, QuickCart ve Shopify Dawn — profesyonel e-ticaret şablonları.
                    Kurulum sonrası görsel editör, marka stüdyosu ve bölüm kütüphanesi ile özelleştirin.
                </p>
                <div className="tb-market-hero__actions">
                    <button type="button" className="tb-btn" onClick={openMyThemes}>Temalarım</button>
                    <button type="button" className="tb-btn tb-btn--primary" onClick={() => openEditor()}>Mevcut temayı düzenle</button>
                </div>
            </div>

            <div className="tb-market-body">
                {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}

                <div className="tb-market__filters">
                    <button type="button" className={`tb-btn${category === "all" ? " tb-btn--primary" : ""}`} onClick={() => setCategory("all")}>Tümü</button>
                    {categories.map((c) => (
                        <button
                            key={c}
                            type="button"
                            className={`tb-btn${category === c ? " tb-btn--primary" : ""}`}
                            onClick={() => setCategory(c)}
                        >
                            {CATEGORY_LABELS[c] || c}
                        </button>
                    ))}
                </div>

                <div className="tb-market__grid tb-market__grid--pro">
                    {filtered.map((theme) => (
                        <ThemeMarketCard
                            key={theme.id || theme.slug}
                            theme={theme}
                            busy={busy}
                            device={cardDevices[theme.slug] || "desktop"}
                            onDeviceChange={(d) => setCardDevice(theme.slug, d)}
                            onInstall={install}
                            onPreview={() => openEditor()}
                        />
                    ))}
                </div>

                {!loading && !filtered.length && !error && (
                    <p style={{ color: "#94a3b8", padding: 24 }}>Tema bulunamadı. Backend&apos;i yeniden başlatıp tekrar deneyin.</p>
                )}
            </div>
        </div>
    );
}
