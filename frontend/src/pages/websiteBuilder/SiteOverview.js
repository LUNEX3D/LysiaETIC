import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
    Grid, Typography, Button, Box, Alert, Stack,
} from "@mui/material";
import {
    EditRounded, LanguageRounded,
    PublishRounded, OpenInNewRounded,
} from "@mui/icons-material";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";
import "../../styles/websiteBuilder/wbDesignSystem.css";
import "../../styles/websiteBuilder/wbStoreBuilder.css";
import "../../styles/websiteBuilder/wbPremiumUI.css";
import WBStatusChip from "../../components/websiteBuilder/layout/WBStatusChip";
import SetupProgressCard from "../../components/websiteBuilder/overview/SetupProgressCard";
import {
    formatOverviewDate,
    getSitePublishLabel, getOverviewOpenUrl,
} from "../../components/websiteBuilder/overview/siteOverviewUtils";
import { getStorePageEditPath } from "../../constants/storeBuilderNav";
import { rememberWbSiteContext } from "../../utils/wbNavigation";
import { shouldShowSetupReminder } from "../../components/websiteBuilder/setup/siteSetupProgress";
import * as wbApi from "../../services/websiteBuilderApi";
import {
    getLiveSiteUrls, getWbAppDomain, DOMAIN_STATUS_LABELS, SSL_STATUS_LABELS,
} from "../../utils/wbStorefrontHost";

const QUICK_ACTIONS = [
    { key: "pages", label: "Sayfalar", icon: EditRounded, path: "pages", primary: true },
    { key: "open", label: "Mağazayı aç", icon: OpenInNewRounded, external: true },
    { key: "domain", label: "Alan adı", icon: LanguageRounded, path: "domain" },
];

export default function SiteOverview() {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const { site: ctxSite, setupProgress: ctxSetupProgress, reloadSetup } = useOutletContext() || {};
    const [site, setSite] = useState(ctxSite);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        if (ctxSite) setSite(ctxSite);
    }, [ctxSite]);

    useEffect(() => {
        if (!siteId || !site) return;
        rememberWbSiteContext(siteId, getOverviewOpenUrl(site));
    }, [siteId, site]);

    const loadOverview = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        try {
            const [siteRes, pagesRes] = await Promise.all([
                wbApi.getSite(siteId),
                wbApi.getPages(siteId),
            ]);

            setSite(siteRes.site);
            setPages(pagesRes.pages || []);
        } catch {
            setError("Özet verileri yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    const live = useMemo(() => getLiveSiteUrls(site), [site]);
    const openUrl = useMemo(() => getOverviewOpenUrl(site), [site]);
    const setup = ctxSetupProgress;

    const homePage = pages.find((p) => p.isHomePage || p.type === "home") || pages[0];
    const lastPublished = pages
        .filter((p) => p.publishedAt)
        .map((p) => p.publishedAt)
        .sort()
        .reverse()[0] || site?.publishedAt;

    const handlePublish = async () => {
        setPublishing(true);
        setError("");
        try {
            await wbApi.publishSite(siteId);
            await loadOverview();
            await reloadSetup?.();
        } catch (e) {
            setError(e.response?.data?.error || "Yayınlanamadı");
        } finally {
            setPublishing(false);
        }
    };

    const go = (path) => navigate(`/website-builder/${siteId}/${path}`);

    if (!site && !loading) return null;

    const appDomain = getWbAppDomain();
    const displayUrl = live.path || live.primary || `/${site?.slug}`;
    const displayHost = site?.customDomain || (site?.slug ? `${site.slug}.${appDomain}` : "");

    return (
        <Box className="wb-ikas-page wb-ws-page--premium" sx={{ pb: 4 }}>
            <WBIkasPageHeader
                title={site?.displayName || site?.name || "Genel Bakış"}
                subtitle={site ? `${displayHost || `${site.slug}.${appDomain}`} — mağaza durumu ve hızlı işlemler` : "Yükleniyor…"}
                actions={
                    site && (
                        <>
                            {site.status !== "published" ? (
                                <Button
                                    variant="contained"
                                    startIcon={<PublishRounded />}
                                    onClick={handlePublish}
                                    disabled={publishing}
                                    disableElevation
                                    className="wb-ikas-btn-primary"
                                    sx={{ borderRadius: 2, textTransform: "none" }}
                                >
                                    {publishing ? "Yayınlanıyor…" : "Siteyi yayınla"}
                                </Button>
                            ) : (
                                <WBStatusChip status="published" />
                            )}
                            <Button
                                variant="outlined"
                                startIcon={<OpenInNewRounded />}
                                href={openUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                disabled={!openUrl}
                                sx={{ borderRadius: 2 }}
                            >
                                Siteyi aç
                            </Button>
                        </>
                    )
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {site?.status !== "published" && !loading && setup && !shouldShowSetupReminder(setup) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Site taslak modunda. Ziyaretçilerin görmesi için siteyi yayınlayın.
                </Alert>
            )}
            {!loading && site && (
                <section className="wb-overview-hero">
                    <div>
                        <span className={`wb-overview-hero__status${site.status === "published" ? " wb-overview-hero__status--live" : ""}`}>
                            {site.status === "published" ? "● Canlı mağaza" : "○ Taslak"}
                        </span>
                        <h2 className="wb-overview-hero__title">{site.displayName || site.name}</h2>
                        <p className="wb-overview-hero__url">{displayUrl}</p>
                    </div>
                    <Stack direction="column" spacing={1} alignItems="flex-end">
                        <Button
                            variant="contained"
                            className="wb-ikas-btn-primary"
                            startIcon={<EditRounded />}
                            onClick={() => {
                                if (homePage?._id) {
                                    navigate(getStorePageEditPath(siteId, homePage._id));
                                } else {
                                    go("pages");
                                }
                            }}
                            sx={{ borderRadius: 2, textTransform: "none", bgcolor: "#6366f1", minWidth: 200 }}
                        >
                            Ana sayfayı düzenle
                        </Button>
                        {site.status !== "published" ? (
                            <Button
                                variant="outlined"
                                onClick={handlePublish}
                                disabled={publishing}
                                sx={{ borderRadius: 2, textTransform: "none", color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}
                            >
                                {publishing ? "Yayınlanıyor…" : "Yayına al"}
                            </Button>
                        ) : (
                            <WBStatusChip status="published" />
                        )}
                        <Button
                            variant="outlined"
                            size="small"
                            href={openUrl || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            disabled={!openUrl}
                            sx={{ borderRadius: 2, color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}
                        >
                            Mağazayı aç
                        </Button>
                    </Stack>
                </section>
            )}

            {!loading && site && (
                <div className="wb-store-status-grid">
                    <div className="wb-store-status-card">
                        <div className="wb-store-status-card__label">Yayın durumu</div>
                        <div className={`wb-store-status-card__value${site.status === "published" ? " wb-store-status-card__value--ok" : " wb-store-status-card__value--warn"}`}>
                            {getSitePublishLabel(site.status)}
                        </div>
                    </div>
                    <div className="wb-store-status-card">
                        <div className="wb-store-status-card__label">Domain</div>
                        <div className={`wb-store-status-card__value${site.customDomain || site.domainStatus === "active" ? " wb-store-status-card__value--ok" : ""}`}>
                            {DOMAIN_STATUS_LABELS[site?.domainStatus] || (site?.customDomain ? "Bağlı" : "Varsayılan")}
                        </div>
                    </div>
                    <div className="wb-store-status-card">
                        <div className="wb-store-status-card__label">SSL</div>
                        <div className={`wb-store-status-card__value${site?.sslStatus === "active" ? " wb-store-status-card__value--ok" : " wb-store-status-card__value--warn"}`}>
                            {SSL_STATUS_LABELS[site?.sslStatus] || "—"}
                        </div>
                    </div>
                    <div className="wb-store-status-card">
                        <div className="wb-store-status-card__label">Son yayın</div>
                        <div className="wb-store-status-card__value">
                            {lastPublished ? formatOverviewDate(lastPublished) : "Henüz yok"}
                        </div>
                    </div>
                </div>
            )}

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Hızlı işlemler
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} className="wb-store-quick-actions">
                {QUICK_ACTIONS.map(({ key, label, icon: Icon, path, external }) => (
                    <Button
                        key={key}
                        size="medium"
                        variant={key === "pages" ? "contained" : "outlined"}
                        disableElevation={key === "pages"}
                        className={key === "pages" ? "wb-ikas-btn-primary" : undefined}
                        startIcon={<Icon />}
                        href={external ? (openUrl || undefined) : undefined}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        disabled={external && !openUrl}
                        onClick={!external && path ? () => go(path) : undefined}
                        sx={{ borderRadius: 2, textTransform: "none" }}
                    >
                        {label}
                    </Button>
                ))}
            </Stack>

            {setup && shouldShowSetupReminder(setup) && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={8}>
                        <SetupProgressCard
                            steps={setup?.steps || []}
                            percent={setup?.percent ?? 0}
                            completed={setup?.completed ?? 0}
                            total={setup?.total ?? 0}
                            onNavigate={(href) => {
                                if (href === "onboarding") {
                                    navigate(`/website-builder/${siteId}/store/onboarding`);
                                } else {
                                    go(href);
                                }
                            }}
                            loading={loading}
                        />
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
