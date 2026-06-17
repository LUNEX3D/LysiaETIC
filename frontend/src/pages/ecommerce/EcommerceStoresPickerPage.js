import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircularProgress } from "@mui/material";
import {
    AddRounded,
    ArrowBackRounded,
    HelpOutlineRounded,
    LaunchRounded,
    OpenInNewRounded,
    RefreshRounded,
    StorefrontRounded,
    TrendingUpRounded,
} from "@mui/icons-material";
import DashtockLogo from "../../components/brand/DashtockLogo";
import { BRAND_NAME, BRAND_PANEL_SUB } from "../../constants/brand";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import * as wbApi from "../../services/websiteBuilderApi";
import { fetchSetupProgress, listFacadeStores } from "../../services/storeFacadeApi";
import { siteDisplayHost } from "../../utils/ecStoreContext";
import { getLiveSiteUrls } from "../../utils/wbStorefrontHost";
import "../../styles/ecommerceStoresPicker.css";

function userInitials() {
    const name = localStorage.getItem("userName") || "";
    const email = localStorage.getItem("userEmail") || "";
    if (name.trim()) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "DS";
}

function storeInitial(name, slug) {
    const base = (name || slug || "M").trim();
    return base.slice(0, 1).toUpperCase();
}

function formatRelativeDate(value, en) {
    if (!value) return null;
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        const diff = Date.now() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days <= 0) return en ? "Today" : "Bugün";
        if (days === 1) return en ? "Yesterday" : "Dün";
        if (days < 7) return en ? `${days} days ago` : `${days} gün önce`;
        return d.toLocaleDateString(en ? "en-GB" : "tr-TR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return null;
    }
}

function normalizeSite(row, wbSite) {
    const site = row?.site || wbSite;
    if (!site) return null;
    const id = String(site.id || site._id || "");
    if (!id) return null;
    return {
        id,
        storeId: site.storeId || row?.store?.id || null,
        name: site.name || row?.store?.name || site.slug || "Mağaza",
        slug: site.slug || "",
        status: site.status || "draft",
        themeId: site.themeId || row?.store?.themeId || "",
        businessType: site.businessType || row?.store?.businessType || "general",
        brandStyle: site.brandStyle || row?.store?.brandStyle || "modern",
        customDomain: site.customDomain || row?.store?.customDomain || null,
        domainStatus: site.domainStatus || "none",
        updatedAt: site.updatedAt || row?.store?.updatedAt,
        host: siteDisplayHost(site),
        linked: row?.linked !== false,
    };
}

function StoreCard({ store, en, onEnter, onPreview, previewLoadingId }) {
    const published = store.status === "published";
    const progress = store.progress?.percent ?? (published ? 100 : 40);
    const productStep = store.progress?.steps?.find((s) => s.id === "first_product");
    const productDone = productStep?.done;
    const updatedLabel = formatRelativeDate(store.updatedAt, en);

    return (
        <article className="ec-store-card">
            <button type="button" className="ec-store-card__main" onClick={() => onEnter(store)}>
                <div className="ec-store-card__head">
                    <span className="ec-store-card__avatar">{storeInitial(store.name, store.slug)}</span>
                    <div className="ec-store-card__titles">
                        <h2>{store.name}</h2>
                        <p className="ec-store-card__host">{store.host}</p>
                    </div>
                    <span className={`ec-store-card__status${published ? " is-live" : ""}`}>
                        {published ? (en ? "Live" : "Yayında") : (en ? "Draft" : "Taslak")}
                    </span>
                </div>
                <div className="ec-store-card__body">
                    <div className="ec-store-card__meta">
                        {store.themeId && (
                            <span>{en ? "Theme" : "Tema"}: {store.themeId}</span>
                        )}
                        <span>{productDone ? (en ? "Products ready" : "Ürünler eklendi") : (en ? "Add products" : "Ürün ekleyin")}</span>
                    </div>
                    <div className="ec-store-card__progress">
                        <div className="ec-store-card__progress-label">
                            <span>{en ? "Setup progress" : "Kurulum"}</span>
                            <strong>{Math.round(progress)}%</strong>
                        </div>
                        <div className="ec-store-card__progress-track">
                            <div
                                className="ec-store-card__progress-fill"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                        </div>
                    </div>
                    {updatedLabel && (
                        <span className="ec-store-card__updated">
                            {en ? "Updated" : "Güncellendi"}: {updatedLabel}
                        </span>
                    )}
                </div>
            </button>
            <div className="ec-store-card__actions">
                <button type="button" className="ec-store-card__btn ec-store-card__btn--primary" onClick={() => onEnter(store)}>
                    <StorefrontRounded sx={{ fontSize: 18 }} />
                    {en ? "Dashboard" : "Yönetim paneli"}
                </button>
                <button
                    type="button"
                    className="ec-store-card__btn"
                    disabled={previewLoadingId === store.id}
                    onClick={(e) => onPreview(store, e)}
                >
                    {previewLoadingId === store.id ? (
                        <CircularProgress size={16} sx={{ color: "var(--ec-accent)" }} />
                    ) : (
                        <OpenInNewRounded sx={{ fontSize: 18 }} />
                    )}
                    {en ? "Preview" : "Önizle"}
                </button>
            </div>
        </article>
    );
}

export default function EcommerceStoresPickerPage({ language = "tr", onEnterStore, onCreateStore, onExitToProgram }) {
    const en = language === "en";
    const { rootClassName, rootStyle } = useDashtockTheme();
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [previewLoadingId, setPreviewLoadingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [facadeRes, wbRes] = await Promise.all([
                listFacadeStores().catch(() => ({ stores: [] })),
                wbApi.getSites().catch(() => ({ sites: [] })),
            ]);

            const merged = [];
            const seen = new Set();

            for (const row of facadeRes.stores || []) {
                const site = normalizeSite(row);
                if (site && !seen.has(site.id)) {
                    seen.add(site.id);
                    merged.push(site);
                }
            }

            for (const wbSite of wbRes.sites || []) {
                const id = String(wbSite._id);
                if (seen.has(id)) continue;
                const site = normalizeSite(null, { ...wbSite, id: wbSite._id });
                if (site) {
                    seen.add(site.id);
                    merged.push(site);
                }
            }

            const withProgress = await Promise.all(
                merged.map(async (site) => {
                    try {
                        const res = await fetchSetupProgress(site.id);
                        return { ...site, progress: res.progress || null };
                    } catch {
                        return { ...site, progress: null };
                    }
                })
            );

            setStores(withProgress);
        } catch {
            setError(en ? "Stores could not be loaded." : "Mağazalar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    }, [en]);

    useEffect(() => {
        load();
    }, [load]);

    const initials = useMemo(() => userInitials(), []);
    const userName = localStorage.getItem("userName") || (en ? "Account" : "Hesabınız");
    const liveCount = stores.filter((s) => s.status === "published").length;

    const enterStore = (site) => {
        onEnterStore?.({
            _id: site.id,
            id: site.id,
            storeId: site.storeId,
            slug: site.slug,
            name: site.name,
            status: site.status,
            customDomain: site.customDomain,
            themeId: site.themeId,
        });
    };

    const previewStore = async (site, e) => {
        e?.stopPropagation?.();
        setPreviewLoadingId(site.id);
        try {
            const res = await wbApi.createPreviewToken(site.id);
            const slug = res.site?.slug || site.slug;
            if (slug && res.token) {
                const url = `${window.location.origin}/site/${slug}?preview_token=${encodeURIComponent(res.token)}`;
                window.open(url, "_blank", "noopener,noreferrer");
                return;
            }
            const live = getLiveSiteUrls({ slug: site.slug, customDomain: site.customDomain, status: site.status });
            if (live.primary) window.open(live.primary, "_blank", "noopener,noreferrer");
        } catch {
            const live = getLiveSiteUrls({ slug: site.slug, customDomain: site.customDomain, status: site.status });
            if (live.primary) window.open(live.primary, "_blank", "noopener,noreferrer");
        } finally {
            setPreviewLoadingId(null);
        }
    };

    return (
        <div className={`ec-stores-hub ${rootClassName}`} style={rootStyle}>
            <header className="ec-stores-hub__bar">
                <div className="ec-stores-hub__bar-left">
                    {onExitToProgram && (
                        <button type="button" className="ec-stores-hub__back" onClick={onExitToProgram}>
                            <ArrowBackRounded sx={{ fontSize: 18 }} />
                            {en ? "Main program" : "Ana program"}
                        </button>
                    )}
                    <DashtockLogo size={28} full />
                    <span className="ec-stores-hub__bar-tag">{BRAND_PANEL_SUB}</span>
                </div>
                <div className="ec-stores-hub__bar-right">
                    <button type="button" className="ec-stores-hub__icon-btn" onClick={load} disabled={loading} title={en ? "Refresh" : "Yenile"}>
                        <RefreshRounded sx={{ fontSize: 20 }} />
                    </button>
                    <span className="ec-stores-hub__user-name">{userName}</span>
                    <div className="ec-stores-hub__avatar" title={userName}>{initials}</div>
                </div>
            </header>

            <section className="ec-stores-hub__hero">
                <div className="ec-stores-hub__hero-inner">
                    <div className="ec-stores-hub__hero-copy">
                        <p className="ec-stores-hub__eyebrow">{BRAND_NAME} · {en ? "Commerce" : "E-Ticaret"}</p>
                        <h1>{en ? "Your sales channels" : "Satış kanallarınız"}</h1>
                        <p className="ec-stores-hub__lead">
                            {en
                                ? "Select a store to manage products, orders and your storefront."
                                : "Ürün, sipariş ve vitrin yönetimi için mağazanızı seçin."}
                        </p>
                    </div>
                    {!loading && (
                        <div className="ec-stores-hub__hero-aside">
                            <div className="ec-stores-hub__stats">
                                <div className="ec-stores-hub__stat">
                                    <StorefrontRounded sx={{ fontSize: 22 }} />
                                    <div>
                                        <strong>{stores.length}</strong>
                                        <span>{en ? "Stores" : "Mağaza"}</span>
                                    </div>
                                </div>
                                <div className="ec-stores-hub__stat">
                                    <TrendingUpRounded sx={{ fontSize: 22 }} />
                                    <div>
                                        <strong>{liveCount}</strong>
                                        <span>{en ? "Live" : "Yayında"}</span>
                                    </div>
                                </div>
                            </div>
                            <button type="button" className="ec-stores-hub__create-main" onClick={() => onCreateStore?.()}>
                                <AddRounded sx={{ fontSize: 20 }} />
                                {en ? "New store" : "Yeni mağaza"}
                            </button>
                        </div>
                    )}
                </div>
            </section>

            <section className="ec-stores-hub__body">
                <div className="ec-stores-hub__body-inner">
                    <div className="ec-stores-hub__section-head">
                        <h2>{en ? "Your stores" : "Mağazalarınız"}</h2>
                        <p>{en ? "Click a store to open its admin panel." : "Yönetim paneline girmek için mağazaya tıklayın."}</p>
                    </div>

                    {error && <div className="ec-stores-hub__error">{error}</div>}

                    {loading ? (
                        <div className="ec-stores-hub__loading">
                            <CircularProgress size={36} sx={{ color: "var(--ec-accent)" }} />
                            <p>{en ? "Loading stores…" : "Mağazalar yükleniyor…"}</p>
                        </div>
                    ) : stores.length === 0 ? (
                        <div className="ec-stores-hub__empty">
                            <div className="ec-stores-hub__empty-icon">
                                <StorefrontRounded sx={{ fontSize: 44 }} />
                            </div>
                            <h3>{en ? "No store yet" : "Henüz mağazanız yok"}</h3>
                            <p>
                                {en
                                    ? "Launch your first store with guided setup — theme, pages and products included."
                                    : "Rehberli kurulumla ilk mağazanızı oluşturun — tema, sayfalar ve ürünler hazır."}
                            </p>
                            <button type="button" className="ec-stores-hub__create-main" onClick={() => onCreateStore?.()}>
                                <LaunchRounded sx={{ fontSize: 20 }} />
                                {en ? "Start setup" : "Kuruluma başla"}
                            </button>
                        </div>
                    ) : (
                        <div className="ec-stores-hub__grid">
                            {stores.map((store) => (
                                <StoreCard
                                    key={store.id}
                                    store={store}
                                    en={en}
                                    onEnter={enterStore}
                                    onPreview={previewStore}
                                    previewLoadingId={previewLoadingId}
                                />
                            ))}
                            <button type="button" className="ec-stores-hub__add-card" onClick={() => onCreateStore?.()}>
                                <span className="ec-stores-hub__add-icon">
                                    <AddRounded sx={{ fontSize: 32 }} />
                                </span>
                                <strong>{en ? "New store" : "Yeni mağaza"}</strong>
                                <span>{en ? "5-step guided setup" : "5 adımlı rehberli kurulum"}</span>
                            </button>
                        </div>
                    )}
                </div>
            </section>

            <footer className="ec-stores-hub__foot">
                <div className="ec-stores-hub__foot-inner">
                    <span>
                        <HelpOutlineRounded sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} />
                        {en
                            ? "Each store has its own products, orders and theme."
                            : "Her mağazanın kendi ürün, sipariş ve teması vardır."}
                    </span>
                    {onExitToProgram && (
                        <button type="button" className="ec-stores-hub__foot-link" onClick={onExitToProgram}>
                            {en ? "Return to main dashboard" : "Ana panele dön"}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
