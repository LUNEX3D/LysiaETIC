import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box, Grid, Card, CardContent, CardActions, Typography, Button, Chip,
    IconButton, Menu, MenuItem, Divider, CircularProgress, Alert,
    Skeleton, Tooltip, LinearProgress, Stack,
} from "@mui/material";
import {
    AddRounded, LanguageRounded, MoreVertRounded, EditRounded, DeleteRounded,
    VisibilityRounded, PublishRounded, UnpublishedRounded, OpenInNewRounded,
    WebRounded, TrendingUpRounded, RocketLaunchRounded,
} from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";
import { loadSiteSetupBundle, shouldShowSetupReminder } from "../../components/websiteBuilder/setup/siteSetupProgress";
import { openWebsiteBuilder } from "../../utils/wbNavigation";

const STATUS_CONFIG = {
    draft: { label: "Taslak", color: "default" },
    published: { label: "Yayında", color: "success" },
    suspended: { label: "Askıda", color: "error" },
    archived: { label: "Arşiv", color: "default" },
};

function SiteCard({ site, onDelete, onPublish, onUnpublish, onRefresh }) {
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [loading, setLoading] = useState(false);

    const status = STATUS_CONFIG[site.status] || STATUS_CONFIG.draft;
    const appDomain = process.env.REACT_APP_WB_DOMAIN || "sites.lysia.com.tr";
    const publicUrl = site.domainStatus === "active" && site.sslStatus === "active" && site.customDomain
        ? `https://${site.customDomain}`
        : `https://${site.slug}.${appDomain}`;

    const handleAction = async (action) => {
        setMenuAnchor(null);
        setLoading(true);
        try {
            await action();
            onRefresh();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card sx={{ height: "100%", display: "flex", flexDirection: "column", border: "1px solid", borderColor: "divider", borderRadius: 2, transition: "box-shadow 0.2s", "&:hover": { boxShadow: 4 } }}>
            {loading && <LinearProgress />}

            <Box sx={{ height: 140, background: `linear-gradient(135deg, ${site.themeVariables?.primaryColor || "#3b82f6"} 0%, ${site.themeVariables?.secondaryColor || "#8b5cf6"} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <WebRounded sx={{ fontSize: 56, color: "rgba(255,255,255,0.3)" }} />
                <Box sx={{ position: "absolute", top: 10, right: 10 }}>
                    <Chip label={status.label} color={status.color} size="small" />
                </Box>
                {site.customDomain && (
                    <Box sx={{ position: "absolute", bottom: 10, left: 10 }}>
                        <Chip icon={<LanguageRounded />} label={site.customDomain} size="small" sx={{ background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: "11px" }} />
                    </Box>
                )}
            </Box>

            <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>{site.name}</Typography>
                        <Typography variant="caption" color="text.secondary">/{site.slug}</Typography>
                    </Box>
                    <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                        <MoreVertRounded fontSize="small" />
                    </IconButton>
                </Box>

                <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip label={`Tema: ${site.themeId}`} size="small" variant="outlined" />
                    <Chip label={site.defaultLanguage?.toUpperCase()} size="small" variant="outlined" />
                    <Chip label={site.defaultCurrency} size="small" variant="outlined" />
                </Box>

                {site.stats && (
                    <Box sx={{ mt: 1.5, display: "flex", gap: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <TrendingUpRounded sx={{ fontSize: 14, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">{site.stats.totalOrders || 0} sipariş</Typography>
                        </Box>
                    </Box>
                )}
            </CardContent>

            <CardActions sx={{ borderTop: "1px solid", borderColor: "divider", gap: 1, px: 2, py: 1.5 }}>
                {site.status === "published" ? (
                    <Button
                        size="small"
                        startIcon={<OpenInNewRounded />}
                        variant="contained"
                        disableElevation
                        onClick={() => openWebsiteBuilder(`/website-builder/${site._id}`)}
                    >
                        Yeni Sekmede Aç
                    </Button>
                ) : (
                    <Button
                        size="small"
                        startIcon={<OpenInNewRounded />}
                        variant="contained"
                        disableElevation
                        onClick={() => openWebsiteBuilder(`/website-builder/${site._id}/onboarding`)}
                    >
                        Yeni Sekmede Aç
                    </Button>
                )}
                <Tooltip title="Siteyi Görüntüle">
                    <IconButton size="small" href={publicUrl} target="_blank"><OpenInNewRounded fontSize="small" /></IconButton>
                </Tooltip>
            </CardActions>

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                <MenuItem onClick={() => { setMenuAnchor(null); openWebsiteBuilder(`/website-builder/${site._id}`); }}>
                    <OpenInNewRounded fontSize="small" sx={{ mr: 1 }} /> Genel Bakış
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); openWebsiteBuilder(`/website-builder/${site._id}/editor`); }}>
                    <OpenInNewRounded fontSize="small" sx={{ mr: 1 }} /> Sayfa Editörü
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); openWebsiteBuilder(`/website-builder/${site._id}/settings`); }}>
                    <OpenInNewRounded fontSize="small" sx={{ mr: 1 }} /> Ayarlar
                </MenuItem>
                <Divider />
                {site.status !== "published" ? (
                    <MenuItem onClick={() => handleAction(() => onPublish(site._id))}>
                        <PublishRounded fontSize="small" sx={{ mr: 1 }} /> Yayınla
                    </MenuItem>
                ) : (
                    <MenuItem onClick={() => handleAction(() => onUnpublish(site._id))}>
                        <UnpublishedRounded fontSize="small" sx={{ mr: 1 }} /> Yayından Kaldır
                    </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={() => { setMenuAnchor(null); onDelete(site); }} sx={{ color: "error.main" }}>
                    <DeleteRounded fontSize="small" sx={{ mr: 1 }} /> Sil
                </MenuItem>
            </Menu>
        </Card>
    );
}

export default function WebsiteBuilderDashboard() {
    const navigate = useNavigate();
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const fetchSites = useCallback(async () => {
        try {
            setLoading(true);
            const data = await wbApi.getSites();
            setSites(data.sites || []);
        } catch (e) {
            setError(e.response?.data?.error || "Siteler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSites(); }, [fetchSites]);

    useEffect(() => {
        if (loading || sites.length !== 1) return;
        let cancelled = false;
        (async () => {
            try {
                const { progress } = await loadSiteSetupBundle(sites[0]._id);
                if (cancelled) return;
                if (shouldShowSetupReminder(progress)) {
                    navigate(`/website-builder/${sites[0]._id}/onboarding`, { replace: true });
                }
            } catch {
                /* dashboard yine gösterilir */
            }
        })();
        return () => { cancelled = true; };
    }, [loading, sites, navigate]);

    const handlePublish = async (siteId) => {
        await wbApi.publishSite(siteId);
    };

    const handleUnpublish = async (siteId) => {
        await wbApi.unpublishSite(siteId);
    };

    const handleDelete = async (site) => {
        if (!window.confirm(`"${site.name}" sitesini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
        await wbApi.deleteSite(site._id);
        fetchSites();
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Website Builder</Typography>
                    <Typography variant="body2" color="text.secondary">Sürükle-bırak ile kendi e-ticaret sitenizi oluşturun</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate("/website-builder/onboarding")} disableElevation sx={{ borderRadius: 2 }}>
                    Yeni Site Oluştur
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            {/* Sites Grid */}
            {loading ? (
                <Grid container spacing={2}>
                    {[1, 2, 3].map((i) => (
                        <Grid item xs={12} sm={6} md={4} key={i}>
                            <Skeleton variant="rounded" height={320} />
                        </Grid>
                    ))}
                </Grid>
            ) : sites.length === 0 ? (
                <Card
                    sx={{
                        textAlign: "center",
                        py: { xs: 6, md: 10 },
                        px: 3,
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        background: (t) => `linear-gradient(180deg, ${t.palette.primary.main}08 0%, transparent 55%)`,
                    }}
                >
                    <Box
                        sx={{
                            width: 88,
                            height: 88,
                            borderRadius: "50%",
                            mx: "auto",
                            mb: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                        }}
                    >
                        <RocketLaunchRounded sx={{ fontSize: 44 }} />
                    </Box>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        İlk web sitenizi oluşturun
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, mx: "auto", mb: 3 }}>
                        Lysia ürünlerinizle bağlantılı mağazanızı birkaç adımda kurun: site bilgileri, tema, ürünler ve yayın.
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<RocketLaunchRounded />}
                            onClick={() => navigate("/website-builder/onboarding")}
                            disableElevation
                            sx={{ borderRadius: 2 }}
                        >
                            Kuruluma başla
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            startIcon={<AddRounded />}
                            onClick={() => navigate("/website-builder/create")}
                            sx={{ borderRadius: 2 }}
                        >
                            Hızlı site oluştur
                        </Button>
                    </Stack>
                </Card>
            ) : (
                <Grid container spacing={2}>
                    {sites.map((site) => (
                        <Grid item xs={12} sm={6} md={4} key={site._id}>
                            <SiteCard
                                site={site}
                                onDelete={handleDelete}
                                onPublish={handlePublish}
                                onUnpublish={handleUnpublish}
                                onRefresh={fetchSites}
                            />
                        </Grid>
                    ))}
                    <Grid item xs={12} sm={6} md={4}>
                        <Card onClick={() => navigate("/website-builder/onboarding")} sx={{ height: "100%", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed", borderColor: "divider", borderRadius: 2, cursor: "pointer", transition: "all 0.2s", "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}>
                            <Box sx={{ textAlign: "center" }}>
                                <AddRounded sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">Yeni Site Ekle</Typography>
                            </Box>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
