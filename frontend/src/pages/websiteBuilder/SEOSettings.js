import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Card, CardContent, Typography, TextField, Button, Alert,
    CircularProgress, Grid, Switch, FormControlLabel, Divider, Chip,
    Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import { SaveRounded, ExpandMoreRounded, SearchRounded, ShareRounded, CodeRounded } from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";

export default function SEOSettings({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const [site, setSite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [seo, setSeo] = useState({ title: "", description: "", keywords: "", ogImage: "", twitterCard: "summary_large_image", noIndex: false, canonicalUrl: "", structuredData: "" });
    const [analytics, setAnalytics] = useState({ googleAnalyticsId: "", googleTagManagerId: "", metaPixelId: "", hotjarId: "", customHeadCode: "", customBodyCode: "" });

    useEffect(() => {
        wbApi.getSite(siteId).then((d) => {
            setSite(d.site);
            setSeo(d.site.seo || {});
            setAnalytics(d.site.analytics || {});
        }).catch(() => setError("Site yüklenemedi")).finally(() => setLoading(false));
    }, [siteId]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            await wbApi.updateSite(siteId, { seo, analytics });
            setSuccess("SEO ayarları kaydedildi!");
        } catch {
            setError("Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const charCount = (str, max) => ({ helperText: `${(str || "").length} / ${max}`, error: (str || "").length > max });

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

    return (
        <Box className="wb-ikas-page">
            <WBIkasPageHeader
                title="SEO ve Alan Adı"
                subtitle="Arama motoru görünümü, sosyal paylaşım ve teknik SEO ayarlarınızı yönetin."
                actions={
                    <Button
                        className="wb-ikas-btn-primary"
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
                        onClick={handleSave}
                        disabled={saving}
                        disableElevation
                        sx={{ textTransform: "none", boxShadow: "none" }}
                    >
                        {saving ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Alert severity="info" sx={{ mb: 3 }}>
                Buradaki ayarlar tüm site için geçerlidir. Her sayfanın kendi SEO ayarları, sayfa editöründen yapılabilir.
            </Alert>

            {/* Google Önizleme */}
            <Card className="wb-ikas-card" sx={{ borderRadius: 2, mb: 3, border: "1px solid #e4e4e7" }}>
                <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                        <SearchRounded color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>Google Önizleme</Typography>
                    </Box>
                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2, background: "#fff" }}>
                        <Typography sx={{ color: "#1a0dab", fontSize: 18, mb: 0.5, fontFamily: "Arial, sans-serif" }}>
                            {seo.title || site?.name || "Site Başlığı"}
                        </Typography>
                        <Typography sx={{ color: "#006621", fontSize: 14, mb: 0.5, fontFamily: "Arial, sans-serif" }}>
                            https://{site?.slug || "site"}.sites.lysia.com.tr
                        </Typography>
                        <Typography sx={{ color: "#545454", fontSize: 14, fontFamily: "Arial, sans-serif" }}>
                            {seo.description || "Site açıklaması buraya gelecek..."}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>

            {/* Meta Bilgileri */}
            <Accordion defaultExpanded sx={{ borderRadius: "8px !important", mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <SearchRounded fontSize="small" />
                        <Typography fontWeight={600}>Meta Bilgileri</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Site Başlığı (Title)" value={seo.title || ""} onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))} {...charCount(seo.title, 60)} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth multiline rows={2} label="Meta Açıklama (Description)" value={seo.description || ""} onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))} {...charCount(seo.description, 160)} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Anahtar Kelimeler" value={seo.keywords || ""} onChange={(e) => setSeo((s) => ({ ...s, keywords: e.target.value }))} placeholder="kelime1, kelime2, kelime3" helperText="Virgülle ayrılmış anahtar kelimeler" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Canonical URL (opsiyonel)" value={seo.canonicalUrl || ""} onChange={(e) => setSeo((s) => ({ ...s, canonicalUrl: e.target.value }))} placeholder="https://www.markam.com" helperText="Boş bırakılırsa varsayılan site adresi kullanılır" />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel control={<Switch checked={seo.noIndex || false} onChange={(e) => setSeo((s) => ({ ...s, noIndex: e.target.checked }))} />} label="Arama motorlarından gizle (noindex)" />
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>

            {/* Open Graph / Social Media */}
            <Accordion sx={{ borderRadius: "8px !important", mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <ShareRounded fontSize="small" />
                        <Typography fontWeight={600}>Sosyal Medya (Open Graph)</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField fullWidth label="OG Görsel URL" value={seo.ogImage || ""} onChange={(e) => setSeo((s) => ({ ...s, ogImage: e.target.value }))} placeholder="https://..." helperText="1200x630px önerilir" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth select label="Twitter Card" value={seo.twitterCard || "summary_large_image"} onChange={(e) => setSeo((s) => ({ ...s, twitterCard: e.target.value }))} SelectProps={{ native: true }}>
                                <option value="summary">Özet</option>
                                <option value="summary_large_image">Büyük Görsel</option>
                            </TextField>
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>

            {/* Analytics */}
            <Accordion sx={{ borderRadius: "8px !important", mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <CodeRounded fontSize="small" />
                        <Typography fontWeight={600}>Analytics & Tracking</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Google Analytics ID" value={analytics.googleAnalyticsId || ""} onChange={(e) => setAnalytics((a) => ({ ...a, googleAnalyticsId: e.target.value }))} placeholder="G-XXXXXXXXXX" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Google Tag Manager ID" value={analytics.googleTagManagerId || ""} onChange={(e) => setAnalytics((a) => ({ ...a, googleTagManagerId: e.target.value }))} placeholder="GTM-XXXXXX" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Meta Pixel ID" value={analytics.metaPixelId || ""} onChange={(e) => setAnalytics((a) => ({ ...a, metaPixelId: e.target.value }))} placeholder="XXXXXXXXXXXXXXXX" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Hotjar ID" value={analytics.hotjarId || ""} onChange={(e) => setAnalytics((a) => ({ ...a, hotjarId: e.target.value }))} placeholder="0000000" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth multiline rows={4} label="Özel <head> Kodu" value={analytics.customHeadCode || ""} onChange={(e) => setAnalytics((a) => ({ ...a, customHeadCode: e.target.value }))} placeholder="<!-- <head> içine eklenir -->" inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }} />
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
}
