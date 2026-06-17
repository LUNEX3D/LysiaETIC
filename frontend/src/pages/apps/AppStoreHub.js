/**
 * Uygulama Mağazası & Uygulamalarım — ikas apps benzeri
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaStore, FaRocket, FaBrain, FaChartBar, FaCrosshairs, FaBox, FaSitemap,
    FaClipboardList, FaEnvelope, FaRobot, FaUsers, FaWindowMaximize, FaTag,
    FaCreditCard, FaSearch, FaExternalLinkAlt, FaTrash, FaPlug,
} from "react-icons/fa";
import { fetchAppCatalog, fetchInstalledApps, installApp, uninstallApp } from "../../services/appStoreApi";
import "../../styles/appStoreHub.css";

const ICON_MAP = {
    store: FaStore,
    trendyol: FaPlug,
    hepsiburada: FaPlug,
    n11: FaPlug,
    ciceksepeti: FaPlug,
    amazon: FaPlug,
    paytr: FaCreditCard,
    products: FaBox,
    category: FaSitemap,
    invoice: FaClipboardList,
    email: FaEnvelope,
    automation: FaRobot,
    segments: FaUsers,
    popup: FaWindowMaximize,
    discount: FaTag,
    brain: FaBrain,
    radar: FaCrosshairs,
    rocket: FaRocket,
    chart: FaChartBar,
    orders: FaClipboardList,
};

function AppIcon({ icon, color }) {
    const Ico = ICON_MAP[icon] || FaPlug;
    return (
        <div className="app-store-card-icon" style={{ background: color || "#6366f1" }}>
            <Ico />
        </div>
    );
}

const AppStoreHub = ({ mode = "catalog", onOpenPanel, onUpgrade }) => {
    const isMyApps = mode === "my-apps";
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [categories, setCategories] = useState([]);
    const [apps, setApps] = useState([]);
    const [categoryId, setCategoryId] = useState("");
    const [search, setSearch] = useState("");
    const [searchDebounced, setSearchDebounced] = useState("");
    const [busyKey, setBusyKey] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            if (isMyApps) {
                const data = await fetchInstalledApps();
                setApps(data.apps || []);
            } else {
                const data = await fetchAppCatalog({
                    category: categoryId || undefined,
                    search: searchDebounced || undefined,
                });
                setCategories(data.categories || []);
                setApps(data.apps || []);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [isMyApps, categoryId, searchDebounced]);

    useEffect(() => {
        load();
    }, [load]);

    const handleInstall = async (app) => {
        if (app.comingSoon) return;
        if (!app.canInstall && app.installBlockedReason) {
            if (app.installBlockedReason.includes("Paket") && onUpgrade) onUpgrade();
            setError(app.installBlockedReason);
            return;
        }
        setBusyKey(app.appKey);
        setError("");
        try {
            await installApp(app.appKey);
            await load();
            if (app.panelRoute && onOpenPanel) onOpenPanel(app.panelRoute);
        } catch (e) {
            const msg = e.response?.data?.error || e.message;
            setError(msg);
            if (e.response?.data?.upgrade && onUpgrade) onUpgrade();
        } finally {
            setBusyKey(null);
        }
    };

    const handleUninstall = async (appKey) => {
        setBusyKey(appKey);
        try {
            await uninstallApp(appKey);
            await load();
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setBusyKey(null);
        }
    };

    const sortedCategories = useMemo(
        () => [...categories].sort((a, b) => (a.order || 0) - (b.order || 0)),
        [categories]
    );

    if (isMyApps) {
        return (
            <div className="app-store-hub">
                <div className="app-store-hero">
                    <h1>Uygulamalarım</h1>
                    <p>Kurulu uygulamalarınızı yönetin ve panele geçin.</p>
                </div>
                {error && <div className="app-store-error">{error}</div>}
                {loading ? (
                    <p className="app-store-empty">Yükleniyor…</p>
                ) : apps.length === 0 ? (
                    <div className="app-store-empty">
                        <p>Henüz kurulu uygulama yok.</p>
                        {onOpenPanel && (
                            <button type="button" className="app-store-btn app-store-btn--primary" onClick={() => onOpenPanel("app-store")}>
                                Mağazaya git
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="app-store-my-list">
                        {apps.map((app) => (
                            <div key={app.appKey} className="app-store-my-row">
                                <AppIcon icon={app.icon} color={app.color} />
                                <div className="app-store-my-info">
                                    <h3>{app.name}</h3>
                                    <p>{app.shortDescription}</p>
                                </div>
                                <div className="app-store-card-actions">
                                    {app.panelRoute && app.canOpen && onOpenPanel && (
                                        <button
                                            type="button"
                                            className="app-store-btn app-store-btn--primary"
                                            onClick={() => onOpenPanel(app.panelRoute)}
                                        >
                                            <FaExternalLinkAlt style={{ marginRight: 6 }} />
                                            Aç
                                        </button>
                                    )}
                                    {!app.isCore && (
                                        <button
                                            type="button"
                                            className="app-store-btn app-store-btn--ghost"
                                            disabled={busyKey === app.appKey}
                                            onClick={() => handleUninstall(app.appKey)}
                                            title="Kaldır"
                                        >
                                            <FaTrash />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="app-store-hub">
            <div className="app-store-hero">
                <h1>Uygulama Mağazası</h1>
                <p>Mağaza, pazaryeri, ödeme ve pazarlama uygulamalarını keşfedin — ikas benzeri entegrasyon merkezi.</p>
            </div>

            <div className="app-store-toolbar">
                <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                    <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4, fontSize: 14 }} />
                    <input
                        className="app-store-search"
                        style={{ width: "100%", paddingLeft: 36 }}
                        placeholder="Uygulama ara…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="app-store-categories">
                <button
                    type="button"
                    className={`app-store-cat-pill ${!categoryId ? "active" : ""}`}
                    onClick={() => setCategoryId("")}
                >
                    Tümü
                </button>
                {sortedCategories.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        className={`app-store-cat-pill ${categoryId === c.id ? "active" : ""}`}
                        onClick={() => setCategoryId(c.id)}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            {error && <div className="app-store-error">{error}</div>}

            {loading ? (
                <p className="app-store-empty">Yükleniyor…</p>
            ) : (
                <div className="app-store-grid">
                    {apps.map((app) => (
                        <article key={app.appKey} className="app-store-card">
                            <div className="app-store-card-head">
                                <AppIcon icon={app.icon} color={app.color} />
                                <div>
                                    <h3>
                                        {app.name}
                                        {app.installed && <span className="app-store-badge app-store-badge--installed">Kurulu</span>}
                                        {app.comingSoon && <span className="app-store-badge">Yakında</span>}
                                    </h3>
                                </div>
                            </div>
                            <p className="app-store-card-desc">{app.shortDescription}</p>
                            <div className="app-store-card-actions">
                                {app.installed ? (
                                    <>
                                        {app.panelRoute && onOpenPanel && (
                                            <button
                                                type="button"
                                                className="app-store-btn app-store-btn--primary"
                                                onClick={() => onOpenPanel(app.panelRoute)}
                                            >
                                                Aç
                                            </button>
                                        )}
                                        {!app.isCore && (
                                            <button
                                                type="button"
                                                className="app-store-btn app-store-btn--ghost"
                                                disabled={busyKey === app.appKey}
                                                onClick={() => handleUninstall(app.appKey)}
                                            >
                                                Kaldır
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="app-store-btn app-store-btn--primary"
                                        disabled={app.comingSoon || busyKey === app.appKey}
                                        onClick={() => handleInstall(app)}
                                    >
                                        {app.comingSoon ? "Yakında" : "Kur"}
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {!loading && apps.length === 0 && (
                <div className="app-store-empty">Bu filtrede uygulama bulunamadı.</div>
            )}
        </div>
    );
};

export default AppStoreHub;
