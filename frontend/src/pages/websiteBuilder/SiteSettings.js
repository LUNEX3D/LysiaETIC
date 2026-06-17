import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Box, Grid, Card, CardContent, Typography, TextField, Button, Alert,
    CircularProgress, Divider, Switch, FormControlLabel, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem, Chip, IconButton, Tooltip,
} from "@mui/material";
import {
    SaveRounded, LanguageRounded, ShoppingCartRounded, ContactPageRounded,
    DeleteForeverRounded, WarningAmberRounded, AddRounded,
} from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";

const LANGUAGES = [
    { code: "tr", name: "Türkçe", nativeName: "Türkçe", direction: "ltr" },
    { code: "en", name: "İngilizce", nativeName: "English", direction: "ltr" },
    { code: "de", name: "Almanca", nativeName: "Deutsch", direction: "ltr" },
    { code: "ar", name: "Arapça", nativeName: "العربية", direction: "rtl" },
    { code: "fr", name: "Fransızca", nativeName: "Français", direction: "ltr" },
    { code: "ru", name: "Rusça", nativeName: "Русский", direction: "ltr" },
    { code: "es", name: "İspanyolca", nativeName: "Español", direction: "ltr" },
    { code: "zh", name: "Çince", nativeName: "中文", direction: "ltr" },
];

const CURRENCIES = [
    { code: "TRY", symbol: "₺", name: "Türk Lirası" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
];

const TIMEZONES = ["Europe/Istanbul", "UTC", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Dubai", "Asia/Riyadh"];

export default function SiteSettings({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const navigate = useNavigate();
    const [site, setSite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [tab, setTab] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const [general, setGeneral] = useState({ name: "", displayName: "", description: "", contactEmail: "", contactPhone: "", address: "", timezone: "Europe/Istanbul" });
    const [commerce, setCommerce] = useState({ syncProductsFromLysia: true, autoPublishProducts: true, productCatalogMode: "all" });
    const [checkout, setCheckout] = useState({ guestCheckout: true, requirePhone: true, minOrderAmount: 0, flatShippingCost: 0, freeShippingOver: 0, paymentMethods: ["paytr"] });
    const [languages, setLanguages] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [newLang, setNewLang] = useState("");
    const [newCurr, setNewCurr] = useState("");

    useEffect(() => {
        wbApi.getSite(siteId).then((d) => {
            const s = d.site;
            setSite(s);
            setGeneral({ name: s.name || "", displayName: s.displayName || "", description: s.description || "", contactEmail: s.contactEmail || "", contactPhone: s.contactPhone || "", address: s.address || "", timezone: s.timezone || "Europe/Istanbul" });
            setCommerce({ syncProductsFromLysia: s.syncProductsFromLysia !== false, autoPublishProducts: s.autoPublishProducts !== false, productCatalogMode: s.productCatalogMode || "all" });
            setCheckout(s.checkoutSettings || { guestCheckout: true, requirePhone: true, minOrderAmount: 0, flatShippingCost: 0, freeShippingOver: 0, paymentMethods: ["paytr"] });
            setLanguages(s.languages || []);
            setCurrencies(s.currencies || []);
        }).catch(() => setError("Site yüklenemedi")).finally(() => setLoading(false));
    }, [siteId]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const updates = { ...general, ...commerce, checkoutSettings: checkout, languages, currencies };
            await wbApi.updateSite(siteId, updates);
            setSuccess("Ayarlar kaydedildi!");
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const addLanguage = () => {
        if (!newLang) return;
        const langDef = LANGUAGES.find((l) => l.code === newLang);
        if (!langDef || languages.find((l) => l.code === newLang)) return;
        setLanguages([...languages, { ...langDef, isDefault: false, isActive: true }]);
        setNewLang("");
    };

    const removeLanguage = (code) => {
        if (languages.find((l) => l.code === code)?.isDefault) return;
        setLanguages(languages.filter((l) => l.code !== code));
    };

    const setDefaultLanguage = (code) => {
        setLanguages(languages.map((l) => ({ ...l, isDefault: l.code === code })));
    };

    const addCurrency = () => {
        if (!newCurr) return;
        const currDef = CURRENCIES.find((c) => c.code === newCurr);
        if (!currDef || currencies.find((c) => c.code === newCurr)) return;
        setCurrencies([...currencies, { ...currDef, isDefault: false, isActive: true, exchangeRate: 1, position: "before" }]);
        setNewCurr("");
    };

    const removeCurrency = (code) => {
        if (currencies.find((c) => c.code === code)?.isDefault) return;
        setCurrencies(currencies.filter((c) => c.code !== code));
    };

    const handleDelete = async () => {
        try {
            await wbApi.deleteSite(siteId);
            navigate("/website-builder");
        } catch (e) {
            setError("Site silinemedi: " + (e.response?.data?.error || e.message));
            setDeleteConfirm(false);
        }
    };

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Typography variant="h6" fontWeight={700}>Site Ayarları — {site?.name}</Typography>
                <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />} onClick={handleSave} disabled={saving} disableElevation>
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
                <Tab label="Genel" />
                <Tab label="Dil & Para Birimi" />
                <Tab label="E-Ticaret" />
                <Tab label="Tehlike Bölgesi" />
            </Tabs>

            {/* GENEL */}
            {tab === 0 && (
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Site Adı" value={general.name} onChange={(e) => setGeneral((g) => ({ ...g, name: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Panel Görünen Adı" value={general.displayName} onChange={(e) => setGeneral((g) => ({ ...g, displayName: e.target.value }))} helperText="Admin panelinde görünür" />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={2} label="Kısa Açıklama" value={general.description} onChange={(e) => setGeneral((g) => ({ ...g, description: e.target.value }))} inputProps={{ maxLength: 500 }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="İletişim E-postası" type="email" value={general.contactEmail} onChange={(e) => setGeneral((g) => ({ ...g, contactEmail: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Telefon" value={general.contactPhone} onChange={(e) => setGeneral((g) => ({ ...g, contactPhone: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={2} label="Adres" value={general.address} onChange={(e) => setGeneral((g) => ({ ...g, address: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Saat Dilimi</InputLabel>
                            <Select label="Saat Dilimi" value={general.timezone} onChange={(e) => setGeneral((g) => ({ ...g, timezone: e.target.value }))}>
                                {TIMEZONES.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            )}

            {/* DİL & PARA BİRİMİ */}
            {tab === 1 && (
                <Box>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>Aktif Diller</Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                        {languages.map((lang) => (
                            <Chip key={lang.code} label={`${lang.nativeName || lang.name} (${lang.code.toUpperCase()})`}
                                color={lang.isDefault ? "primary" : "default"}
                                onDelete={lang.isDefault ? undefined : () => removeLanguage(lang.code)}
                                onClick={() => setDefaultLanguage(lang.code)}
                                variant={lang.isDefault ? "filled" : "outlined"}
                            />
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <Select value={newLang} displayEmpty onChange={(e) => setNewLang(e.target.value)}>
                                <MenuItem value="" disabled>Dil seç...</MenuItem>
                                {LANGUAGES.filter((l) => !languages.find((a) => a.code === l.code)).map((l) => (
                                    <MenuItem key={l.code} value={l.code}>{l.nativeName} — {l.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="outlined" startIcon={<AddRounded />} onClick={addLanguage} disabled={!newLang}>Dil Ekle</Button>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>Aktif Para Birimleri</Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                        {currencies.map((curr) => (
                            <Chip key={curr.code} label={`${curr.symbol} ${curr.code} — ${curr.name}`}
                                color={curr.isDefault ? "primary" : "default"}
                                onDelete={curr.isDefault ? undefined : () => removeCurrency(curr.code)}
                                variant={curr.isDefault ? "filled" : "outlined"}
                            />
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <Select value={newCurr} displayEmpty onChange={(e) => setNewCurr(e.target.value)}>
                                <MenuItem value="" disabled>Para birimi seç...</MenuItem>
                                {CURRENCIES.filter((c) => !currencies.find((a) => a.code === c.code)).map((c) => (
                                    <MenuItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="outlined" startIcon={<AddRounded />} onClick={addCurrency} disabled={!newCurr}>Ekle</Button>
                    </Box>
                    <Alert severity="info" sx={{ mt: 2 }}>Dil çevirileri için Dil Yönetimi sayfasını kullanın.</Alert>
                </Box>
            )}

            {/* E-TİCARET */}
            {tab === 2 && (
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <FormControlLabel control={<Switch checked={commerce.syncProductsFromLysia} onChange={(e) => setCommerce((c) => ({ ...c, syncProductsFromLysia: e.target.checked }))} />} label="LysiaETIC ürünleri otomatik senkronize et" />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel control={<Switch checked={commerce.autoPublishProducts} onChange={(e) => setCommerce((c) => ({ ...c, autoPublishProducts: e.target.checked }))} />} label="Yeni ürünleri otomatik yayınla" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Ürün Kataloğu Modu</InputLabel>
                            <Select label="Ürün Kataloğu Modu" value={commerce.productCatalogMode} onChange={(e) => setCommerce((c) => ({ ...c, productCatalogMode: e.target.value }))}>
                                <MenuItem value="all">Tüm ürünler</MenuItem>
                                <MenuItem value="filtered">Filtrelenmiş</MenuItem>
                                <MenuItem value="manual">Manuel seçim</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}><Divider /></Grid>
                    <Grid item xs={12}><Typography variant="subtitle2" fontWeight={600}>Ödeme & Sepet</Typography></Grid>
                    <Grid item xs={12}>
                        <FormControlLabel control={<Switch checked={checkout.guestCheckout} onChange={(e) => setCheckout((c) => ({ ...c, guestCheckout: e.target.checked }))} />} label="Üye olmadan ödeme" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="Min. Sipariş Tutarı (₺)" type="number" value={checkout.minOrderAmount} onChange={(e) => setCheckout((c) => ({ ...c, minOrderAmount: +e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="Sabit Kargo (₺)" type="number" value={checkout.flatShippingCost} onChange={(e) => setCheckout((c) => ({ ...c, flatShippingCost: +e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="Ücretsiz Kargo Üzeri (₺)" type="number" value={checkout.freeShippingOver} onChange={(e) => setCheckout((c) => ({ ...c, freeShippingOver: +e.target.value }))} />
                    </Grid>
                </Grid>
            )}

            {/* TEHLİKE */}
            {tab === 3 && (
                <Card sx={{ border: "1px solid", borderColor: "error.light", borderRadius: 2 }}>
                    <CardContent>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <WarningAmberRounded color="error" />
                            <Typography variant="subtitle1" fontWeight={700} color="error">Siteyi Sil</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Bu işlem geri alınamaz. Tüm sayfalar, blog yazıları, medya ve ayarlar kalıcı olarak silinir.
                        </Typography>
                        {!deleteConfirm ? (
                            <Button variant="outlined" color="error" startIcon={<DeleteForeverRounded />} onClick={() => setDeleteConfirm(true)}>
                                Siteyi Sil
                            </Button>
                        ) : (
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button variant="contained" color="error" onClick={handleDelete} disableElevation>
                                    Evet, Kalıcı Olarak Sil
                                </Button>
                                <Button variant="outlined" onClick={() => setDeleteConfirm(false)}>İptal</Button>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}
