import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Box, Button, TextField, Typography, Alert, CircularProgress, Paper, Grid, Card, CardActionArea,
} from "@mui/material";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getStorePageEditPath } from "../../constants/storeBuilderNav";
import { getLiveSiteUrls } from "../../utils/wbStorefrontHost";
import * as wbApi from "../../services/websiteBuilderApi";
import "../../styles/websiteBuilder/wbStoreBuilder.css";

const STEPS = [
    { id: "name", title: "Mağaza adı", desc: "Mağazanızın görünen adını belirleyin." },
    { id: "sector", title: "Sektör", desc: "Sektörünüz vitrin önerilerini şekillendirir (yalnızca arayüz)." },
    { id: "products", title: "Ürün ekle", desc: "Ürün kataloğunuzu ERP üzerinden bağlayın." },
    { id: "publish", title: "Yayınla", desc: "Mağazanızı ziyaretçilere açın." },
];

const SECTORS = [
    { id: "fashion", label: "Moda" },
    { id: "electronics", label: "Elektronik" },
    { id: "food", label: "Gıda" },
    { id: "general", label: "Genel" },
];

export default function StoreBuilderOnboarding() {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [site, setSite] = useState(null);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [storeName, setStoreName] = useState("");
    const [sector, setSector] = useState("general");

    const load = useCallback(async () => {
        try {
            const [siteRes, pagesRes] = await Promise.all([
                wbApi.getSite(siteId),
                wbApi.getPages(siteId),
            ]);
            setSite(siteRes.site);
            setStoreName(siteRes.site?.displayName || siteRes.site?.name || "");
            setPages(pagesRes.pages || []);
        } catch {
            setError("Mağaza bilgileri yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        load();
    }, [load]);

    const saveName = async () => {
        setBusy(true);
        try {
            await wbApi.updateSite(siteId, { name: storeName, displayName: storeName });
            setStep((s) => s + 1);
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setBusy(false);
        }
    };

    const publishStore = async () => {
        setBusy(true);
        try {
            await wbApi.publishSite(siteId);
            const home = pages.find((p) => p.isHomePage || p.type === "home") || pages[0];
            if (home?._id) {
                navigate(getStorePageEditPath(siteId, home._id));
            } else {
                navigate(`/website-builder/${siteId}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || "Yayınlanamadı");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
                <CircularProgress />
            </Box>
        );
    }

    const current = STEPS[step];
    const live = getLiveSiteUrls(site || {});

    return (
        <Box className="wb-store-onboarding">
            <div className="wb-store-onboarding__progress">
                {STEPS.map((s, i) => (
                    <div
                        key={s.id}
                        className={`wb-store-onboarding__step-dot${i <= step ? " done" : ""}${i === step ? " active" : ""}`}
                    >
                        {i < step ? <Check size={14} /> : i + 1}
                    </div>
                ))}
            </div>

            <Paper className="wb-store-onboarding__card" elevation={0}>
                <Typography variant="overline" color="text.secondary">
                    Mağaza oluştur · Adım {step + 1}/{STEPS.length}
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
                    {current.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {current.desc}
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

                {step === 0 && (
                    <TextField
                        fullWidth
                        label="Mağaza adı"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                )}

                {step === 1 && (
                    <Grid container spacing={1.5}>
                        {SECTORS.map((s) => (
                            <Grid item xs={6} sm={3} key={s.id}>
                                <Card
                                    variant={sector === s.id ? "elevation" : "outlined"}
                                    sx={{
                                        borderColor: sector === s.id ? "primary.main" : "divider",
                                        bgcolor: sector === s.id ? "primary.50" : "background.paper",
                                    }}
                                >
                                    <CardActionArea onClick={() => setSector(s.id)} sx={{ p: 2, textAlign: "center" }}>
                                        <Typography fontWeight={600} fontSize={14}>{s.label}</Typography>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}

                {step === 2 && (
                    <Box sx={{ py: 2 }}>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Ürünlerinizi Lysia ERP ürün modülünden mağazaya senkronize edin. Bu adımı atlayıp sonra da ekleyebilirsiniz.
                        </Typography>
                        <Button variant="outlined" href="/dashboard" sx={{ textTransform: "none" }}>
                            Ürün modülüne git
                        </Button>
                    </Box>
                )}

                {step === 3 && (
                    <Box sx={{ py: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {live.primary ? `Mağaza adresi: ${live.primary}` : "Yayın sonrası mağaza adresiniz oluşturulur."}
                        </Typography>
                        <Typography variant="body2">
                            Sektör (yerel): <strong>{SECTORS.find((s) => s.id === sector)?.label}</strong>
                        </Typography>
                    </Box>
                )}

                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
                    <Button
                        startIcon={<ArrowLeft size={18} />}
                        disabled={step === 0 || busy}
                        onClick={() => setStep((s) => s - 1)}
                        sx={{ textTransform: "none" }}
                    >
                        Geri
                    </Button>
                    {step < 3 ? (
                        <Button
                            variant="contained"
                            endIcon={<ArrowRight size={18} />}
                            disabled={busy || (step === 0 && !storeName.trim())}
                            onClick={() => {
                                if (step === 0) saveName();
                                else setStep((s) => s + 1);
                            }}
                            sx={{ textTransform: "none" }}
                        >
                            {busy ? "…" : "Devam"}
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            disabled={busy}
                            onClick={publishStore}
                            sx={{ textTransform: "none" }}
                        >
                            {busy ? "Yayınlanıyor…" : "Mağazayı yayınla"}
                        </Button>
                    )}
                </Box>
            </Paper>
        </Box>
    );
}
