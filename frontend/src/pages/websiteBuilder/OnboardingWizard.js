import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    Box, Paper, Typography, TextField, Button, Grid, Card, Chip, Alert,
    CircularProgress, FormControl, InputLabel, Select, MenuItem, Switch,
    FormControlLabel, Divider, Skeleton, Stack,
} from "@mui/material";
import {
    ArrowBackRounded, ArrowForwardRounded, CheckCircleRounded, RocketLaunchRounded,
    PaletteRounded, SyncRounded, HomeRounded, LanguageRounded, PublishRounded,
    OpenInNewRounded, SkipNextRounded, EditRounded, StarRounded,
} from "@mui/icons-material";
import OnboardingProgressHeader from "../../components/websiteBuilder/onboarding/OnboardingProgressHeader";
import OnboardingChecklist from "../../components/websiteBuilder/onboarding/OnboardingChecklist";
import DomainConnectForm from "../../components/websiteBuilder/domain/DomainConnectForm";
import {
    computeSiteSetupProgress, getFirstIncompleteOnboardingStep, isOnboardingComplete,
} from "../../components/websiteBuilder/setup/siteSetupProgress";
import { getLiveSiteUrls, getWbAppDomain } from "../../utils/wbStorefrontHost";
import { goToSiteOverview } from "../../utils/wbNavigation";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";
import * as wbApi from "../../services/websiteBuilderApi";

const LANGUAGES = [
    { code: "tr", label: "Türkçe" }, { code: "en", label: "English" },
    { code: "de", label: "Deutsch" },
];

const CURRENCIES = [
    { code: "TRY", symbol: "₺", label: "Türk Lirası" },
    { code: "USD", symbol: "$", label: "US Dollar" },
    { code: "EUR", symbol: "€", label: "Euro" },
];

const CATEGORY_LABELS = {
    general: "Genel", fashion: "Moda", electronics: "Elektronik",
    food: "Gıda", luxury: "Lüks", kids: "Çocuk", minimal: "Minimal",
};

function resolveThemeKey(theme) {
    return theme._id ? String(theme._id) : theme.slug;
}

export default function OnboardingWizard() {
    const { siteId: routeSiteId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [siteId, setSiteId] = useState(routeSiteId || null);
    const [site, setSite] = useState(null);
    const [pages, setPages] = useState([]);
    const [themeInstall, setThemeInstall] = useState(null);
    const [domainRecord, setDomainRecord] = useState(null);
    const [themes, setThemes] = useState([]);
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(Boolean(routeSiteId));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [domainInput, setDomainInput] = useState("");
    const [stepInitialized, setStepInitialized] = useState(false);

    const [form, setForm] = useState({
        name: "",
        themeId: "aurora",
        defaultLanguage: "tr",
        defaultCurrency: "TRY",
        syncProducts: true,
        autoPublishProducts: true,
        productCatalogMode: "all",
    });

    const progress = useMemo(
        () => computeSiteSetupProgress({ site, pages, themeInstall, domainRecord }),
        [site, pages, themeInstall, domainRecord]
    );

    const homePage = progress.homePage;
    const live = useMemo(() => getLiveSiteUrls(site || {}), [site]);

    const reload = useCallback(async (id) => {
        const sid = id || siteId;
        if (!sid) return;
        const [siteRes, pagesRes, domainRes] = await Promise.all([
            wbApi.getSite(sid),
            wbApi.getPages(sid),
            wbApi.getDomain(sid).catch(() => ({ domain: null })),
        ]);
        setSite(siteRes.site);
        setPages(pagesRes.pages || []);
        setThemeInstall(null);
        setDomainRecord(domainRes.domain || null);
        return siteRes.site;
    }, [siteId]);

    useEffect(() => {
        if (!routeSiteId) {
            setLoading(false);
            return;
        }
        setSiteId(routeSiteId);
        (async () => {
            try {
                await reload(routeSiteId);
            } catch {
                setError("Site yüklenemedi");
            } finally {
                setLoading(false);
            }
        })();
    }, [routeSiteId, reload]);

    useEffect(() => {
        if (siteId && activeStep === 0) setActiveStep(1);
    }, [siteId]);

    useEffect(() => {
        if (!site) return;
        setForm((f) => ({
            ...f,
            themeId: site.themeId || f.themeId,
            defaultLanguage: site.defaultLanguage || f.defaultLanguage,
            defaultCurrency: site.defaultCurrency || f.defaultCurrency,
            syncProducts: site.syncProductsFromLysia !== false,
            autoPublishProducts: site.autoPublishProducts !== false,
            productCatalogMode: site.productCatalogMode || f.productCatalogMode,
        }));
    }, [site]);

    useEffect(() => {
        const stepParam = searchParams.get("step");
        if (stepParam != null && !Number.isNaN(Number(stepParam))) {
            const n = Math.min(5, Math.max(0, Number(stepParam)));
            if (siteId || n === 0) setActiveStep(n);
        }
    }, [searchParams, siteId]);

    useEffect(() => {
        if (!routeSiteId || loading || !site || stepInitialized) return;
        const p = computeSiteSetupProgress({ site, pages, themeInstall, domainRecord });
        if (searchParams.get("step") == null) {
            if (isOnboardingComplete(p)) {
                setActiveStep(5);
            } else {
                setActiveStep(Math.max(1, getFirstIncompleteOnboardingStep(p)));
            }
        }
        setStepInitialized(true);
    }, [routeSiteId, loading, site, pages, themeInstall, domainRecord, stepInitialized, searchParams]);

    const filteredThemes = filterCategory === "all" ? themes : themes.filter((t) => t.category === filterCategory);

    const handleCreateSite = async () => {
        if (!form.name.trim()) {
            setError("Site adı zorunlu");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const data = await wbApi.createSite({
                name: form.name.trim(),
                themeId: form.themeId,
                defaultLanguage: form.defaultLanguage,
                defaultCurrency: form.defaultCurrency,
            });
            const newSite = data.site;
            setSiteId(newSite._id);
            setSite(newSite);
            navigate(`/website-builder/${newSite._id}/onboarding`, { replace: true });
            await reload(newSite._id);
            setActiveStep(1);
        } catch (e) {
            setError(e.response?.data?.error || "Site oluşturulamadı");
        } finally {
            setBusy(false);
        }
    };

    const handleInstallTheme = async () => {
        setActiveStep(2);
    };

    const handleSaveProducts = async () => {
        if (progress.checks.products && site?.syncProductsFromLysia !== false) {
            setActiveStep(3);
            return;
        }
        setBusy(true);
        setError("");
        try {
            await wbApi.updateSite(siteId, {
                syncProductsFromLysia: form.syncProducts,
                autoPublishProducts: form.autoPublishProducts,
                productCatalogMode: form.productCatalogMode,
            });
            await reload();
            setActiveStep(3);
        } catch (e) {
            setError(e.response?.data?.error || "Ayarlar kaydedilemedi");
        } finally {
            setBusy(false);
        }
    };

    const handlePublishHomepage = async () => {
        if (!homePage?._id) return;
        setBusy(true);
        setError("");
        try {
            await wbApi.publishPage(siteId, homePage._id);
            await reload();
        } catch (e) {
            setError(e.response?.data?.error || "Ana sayfa yayınlanamadı");
        } finally {
            setBusy(false);
        }
    };

    const handleAddDomain = async () => {
        if (!domainInput.trim()) return;
        setBusy(true);
        setError("");
        try {
            const data = await wbApi.addDomain(siteId, domainInput.trim());
            setDomainRecord(data.domain);
            setDomainInput("");
            await reload();
        } catch (e) {
            setError(e.response?.data?.error || "Domain eklenemedi");
        } finally {
            setBusy(false);
        }
    };

    const handlePublishSite = async () => {
        setBusy(true);
        setError("");
        try {
            if (homePage?._id && homePage.status !== "published") {
                await wbApi.publishPage(siteId, homePage._id);
            }
            await wbApi.publishSite(siteId);
            await reload();
            setActiveStep(5);
        } catch (e) {
            setError(e.response?.data?.error || "Yayınlanamadı");
        } finally {
            setBusy(false);
        }
    };

    if (routeSiteId && loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    const appDomain = getWbAppDomain();
    const productCount = site?.stats?.totalProducts ?? 0;

    const inSiteWorkspace = Boolean(routeSiteId);

    return (
        <Box
            className={inSiteWorkspace ? "wb-onboarding-in-workspace" : ""}
            sx={{
                minHeight: inSiteWorkspace ? "auto" : "100vh",
                bgcolor: "background.default",
                py: { xs: 2, md: inSiteWorkspace ? 2 : 4 },
                px: { xs: 0, md: 0 },
            }}
        >
            <Box className={inSiteWorkspace ? "wb-ikas-page" : ""} sx={{ maxWidth: 1100, mx: "auto", px: inSiteWorkspace ? 0 : { xs: 2, md: 3 } }}>
                <Button
                    startIcon={<ArrowBackRounded />}
                    onClick={() => goToSiteOverview(navigate, siteId)}
                    color="inherit"
                    sx={{ mb: 2, textTransform: "none" }}
                >
                    {siteId ? "Site özetine dön" : "Tüm siteler"}
                </Button>

                <header className="wb-ikas-page-header">
                    <h1>Mağazanızı 5 dakikada yayına alın</h1>
                    <p>Adım adım kurulum — İkas tarzı sade akış. İlerleme site özetinizle senkronize edilir.</p>
                </header>

                <OnboardingProgressHeader
                    activeStep={activeStep}
                    percent={progress.percent}
                    completed={progress.completed}
                    total={progress.total}
                />

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

                <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                {/* Step 0 — Site bilgileri */}
                {activeStep === 0 && !siteId && (
                    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>Site bilgileri</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Mağaza adınız ve varsayılan dil/para birimini belirleyin.
                        </Typography>
                        <TextField
                            label="Mağaza / site adı"
                            fullWidth
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            sx={{ mb: 2 }}
                            autoFocus
                        />
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Dil</InputLabel>
                                    <Select label="Dil" value={form.defaultLanguage} onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}>
                                        {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Para birimi</InputLabel>
                                    <Select label="Para birimi" value={form.defaultCurrency} onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}>
                                        {CURRENCIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.symbol} {c.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        {form.name.trim() && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Adres: <strong>{form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}.{appDomain}</strong>
                            </Alert>
                        )}
                        <Button variant="contained" endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardRounded />} onClick={handleCreateSite} disabled={busy} disableElevation>
                            Siteyi oluştur ve devam et
                        </Button>
                    </Paper>
                )}

                {/* Step 1 — Tema */}
                {activeStep === 1 && siteId && (
                    <Box>
                        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                <PaletteRounded sx={{ verticalAlign: "middle", mr: 1 }} />
                                Tema
                            </Typography>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Tema sistemi sıfırdan yeniden kuruluyor. Bu adımı atlayıp kuruluma devam edebilirsiniz.
                            </Alert>
                        </Paper>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
                            <Button onClick={() => setActiveStep(0)}>Geri</Button>
                            <Button variant="contained" onClick={handleInstallTheme} endIcon={<ArrowForwardRounded />} disableElevation>
                                Devam et
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* Step 2 — Ürünler */}
                {activeStep === 2 && siteId && (
                    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                            <SyncRounded sx={{ verticalAlign: "middle", mr: 1 }} />
                            Ürün senkronizasyonu
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            LysiaETIC ürün kataloğunuzu mağazaya bağlayın. Senkronizasyon arka planda devam eder.
                        </Typography>
                        <FormControlLabel
                            control={<Switch checked={form.syncProducts} onChange={(e) => setForm((f) => ({ ...f, syncProducts: e.target.checked }))} />}
                            label="LysiaETIC ürünlerini otomatik senkronize et"
                        />
                        <FormControlLabel
                            control={<Switch checked={form.autoPublishProducts} onChange={(e) => setForm((f) => ({ ...f, autoPublishProducts: e.target.checked }))} />}
                            label="Yeni ürünleri otomatik vitrine ekle"
                        />
                        <FormControl fullWidth size="small" sx={{ mt: 2, mb: 2 }}>
                            <InputLabel>Katalog modu</InputLabel>
                            <Select label="Katalog modu" value={form.productCatalogMode} onChange={(e) => setForm((f) => ({ ...f, productCatalogMode: e.target.value }))}>
                                <MenuItem value="all">Tüm ürünler</MenuItem>
                                <MenuItem value="filtered">Filtrelenmiş</MenuItem>
                                <MenuItem value="manual">Manuel seçim</MenuItem>
                            </Select>
                        </FormControl>
                        <Alert severity={productCount > 0 ? "success" : "info"} sx={{ mb: 2 }}>
                            {productCount > 0
                                ? `Şu an ${productCount} ürün vitrinde görünüyor.`
                                : "Senkronizasyon açıldıktan sonra ürünler kataloğa eklenir. Sayı Site Özetinde güncellenir."}
                        </Alert>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Button onClick={() => setActiveStep(1)}>Geri</Button>
                            <Button variant="contained" onClick={handleSaveProducts} disabled={busy || !form.syncProducts} disableElevation>
                                {progress.checks.products ? "Devam" : "Kaydet ve devam"}
                            </Button>
                        </Box>
                    </Paper>
                )}

                {/* Step 3 — Ana sayfa */}
                {activeStep === 3 && siteId && (
                    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                            <HomeRounded sx={{ verticalAlign: "middle", mr: 1 }} />
                            Ana sayfa oluşturma
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Tema ile birlikte ana sayfa taslağı oluşturuldu. İsterseniz düzenleyin, ardından yayınlayın.
                        </Typography>
                        {homePage ? (
                            <Alert severity={homePage.status === "published" ? "success" : "info"} sx={{ mb: 2 }}>
                                <strong>{homePage.title}</strong> — {(homePage.sections || []).length} blok
                                {homePage.status === "published" ? " · Yayında" : " · Taslak"}
                            </Alert>
                        ) : (
                            <Skeleton height={48} sx={{ mb: 2 }} />
                        )}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button variant="outlined" startIcon={<EditRounded />} onClick={() => navigate(`/website-builder/${siteId}/editor`)}>
                                Sayfa editöründe düzenle
                            </Button>
                            <Button variant="contained" onClick={handlePublishHomepage} disabled={busy || !homePage || homePage.status === "published"} disableElevation>
                                Ana sayfayı yayınla
                            </Button>
                        </Stack>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Button onClick={() => setActiveStep(2)}>Geri</Button>
                            <Button
                                variant="contained"
                                onClick={() => setActiveStep(4)}
                                disabled={!homePage || homePage.status !== "published"}
                                endIcon={<ArrowForwardRounded />}
                                disableElevation
                            >
                                Devam
                            </Button>
                        </Box>
                    </Paper>
                )}

                {/* Step 4 — Domain */}
                {activeStep === 4 && siteId && (
                    <Box>
                        <DomainConnectForm
                            value={domainInput}
                            onChange={setDomainInput}
                            onSubmit={handleAddDomain}
                            loading={busy}
                            defaultHost={site?.slug ? `${site.slug}.${appDomain}` : ""}
                        />
                        {domainRecord && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                Domain kaydı oluşturuldu: <strong>{domainRecord.domain}</strong>. DNS doğrulaması Domain Merkezinden yapılır.
                            </Alert>
                        )}
                        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3, flexWrap: "wrap", gap: 1 }}>
                            <Button onClick={() => setActiveStep(3)}>Geri</Button>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button startIcon={<SkipNextRounded />} onClick={() => setActiveStep(5)}>
                                    Şimdilik atla
                                </Button>
                                <Button variant="contained" onClick={() => setActiveStep(5)} endIcon={<ArrowForwardRounded />} disableElevation>
                                    Devam
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Step 5 — Yayın */}
                {activeStep === 5 && siteId && (
                    <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, textAlign: "center" }}>
                        {site?.status === "published" ? (
                            <>
                                <CheckCircleRounded sx={{ fontSize: 72, color: "success.main", mb: 2 }} />
                                <Typography variant="h5" fontWeight={800} gutterBottom>Mağazanız yayında!</Typography>
                                <Typography color="text.secondary" sx={{ mb: 3 }}>
                                    Kurulum tamamlandı (%{progress.percent}). Ziyaretçiler sitenizi görebilir.
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
                                    <Button variant="contained" href={live.path || live.primary} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewRounded />} disableElevation>
                                        Canlı siteyi aç
                                    </Button>
                                    <Button variant="outlined" onClick={() => goToSiteOverview(navigate, siteId)}>
                                        Site özetine git
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <>
                                <PublishRounded sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
                                <Typography variant="h6" fontWeight={700} gutterBottom>Yayınlama</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Siteyi ve taslak sayfaları yayına alın. Varsayılan adres: {live.path || `/${site?.slug}`}
                                </Typography>
                                <Button variant="contained" size="large" startIcon={busy ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchRounded />} onClick={handlePublishSite} disabled={busy} disableElevation>
                                    {busy ? "Yayınlanıyor…" : "Siteyi yayınla"}
                                </Button>
                                <Box sx={{ mt: 2 }}>
                                    <Button onClick={() => setActiveStep(4)}>Geri</Button>
                                </Box>
                            </>
                        )}
                    </Paper>
                )}
                    </Grid>
                    {siteId && (
                        <Grid item xs={12} md={4}>
                            <OnboardingChecklist
                                steps={progress.steps}
                                activeStep={activeStep}
                                percent={progress.percent}
                            />
                        </Grid>
                    )}
                </Grid>
            </Box>
        </Box>
    );
}
