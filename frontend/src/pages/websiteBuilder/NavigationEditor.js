import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Card, CardContent, Typography, Button, TextField, IconButton,
    Switch, FormControlLabel, Alert, CircularProgress, Divider, Tabs, Tab,
    List, ListItem, Chip, Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import {
    AddRounded, DeleteRounded, DragIndicatorRounded, SaveRounded,
    ExpandMoreRounded, ExpandLessRounded, LinkRounded,
} from "@mui/icons-material";
import { v4 as uuidv4 } from "../../utils/uuid";
import * as wbApi from "../../services/websiteBuilderApi";

function NavItemEditor({ item, onUpdate, onDelete, depth = 0 }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Box sx={{ ml: depth * 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, px: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 0.5, background: "background.paper" }}>
                <DragIndicatorRounded sx={{ fontSize: 16, color: "text.disabled", cursor: "grab" }} />
                <TextField
                    size="small"
                    placeholder="Menü etiketi"
                    value={item.label}
                    onChange={(e) => onUpdate(item.id, { label: e.target.value })}
                    sx={{ flex: "0 0 160px" }}
                    inputProps={{ style: { fontSize: 13 } }}
                />
                <TextField
                    size="small"
                    placeholder="URL (/products)"
                    value={item.url}
                    onChange={(e) => onUpdate(item.id, { url: e.target.value })}
                    sx={{ flex: 1 }}
                    inputProps={{ style: { fontSize: 13 } }}
                    InputProps={{ startAdornment: <LinkRounded sx={{ fontSize: 14, mr: 0.5, color: "text.disabled" }} /> }}
                />
                <Select size="small" value={item.target || "_self"} onChange={(e) => onUpdate(item.id, { target: e.target.value })} sx={{ fontSize: 12, minWidth: 90 }}>
                    <MenuItem value="_self" sx={{ fontSize: 13 }}>Aynı sekme</MenuItem>
                    <MenuItem value="_blank" sx={{ fontSize: 13 }}>Yeni sekme</MenuItem>
                </Select>
                <Switch size="small" checked={item.isVisible !== false} onChange={(e) => onUpdate(item.id, { isVisible: e.target.checked })} />
                <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
                    <DeleteRounded fontSize="small" />
                </IconButton>
            </Box>
        </Box>
    );
}

export default function NavigationEditor({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const [navigations, setNavigations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [tab, setTab] = useState(0);

    const POSITIONS = ["header", "footer"];
    const POSITION_LABELS = { header: "Header Menüsü", footer: "Footer Menüsü" };

    useEffect(() => {
        wbApi.getNavigation(siteId).then((d) => {
            setNavigations(d.navigations || []);
        }).catch(() => setError("Menüler yüklenemedi")).finally(() => setLoading(false));
    }, [siteId]);

    const currentPosition = POSITIONS[tab];
    const currentNav = navigations.find((n) => n.position === currentPosition) || { position: currentPosition, items: [] };

    const setItems = (newItems) => {
        setNavigations((prev) => {
            const existing = prev.find((n) => n.position === currentPosition);
            if (existing) return prev.map((n) => n.position === currentPosition ? { ...n, items: newItems } : n);
            return [...prev, { position: currentPosition, items: newItems }];
        });
    };

    const addItem = () => {
        const newItem = { id: uuidv4(), label: "Yeni Link", url: "/", target: "_self", isVisible: true, children: [], order: currentNav.items.length };
        setItems([...currentNav.items, newItem]);
    };

    const updateItem = (id, updates) => {
        setItems(currentNav.items.map((item) => item.id === id ? { ...item, ...updates } : item));
    };

    const deleteItem = (id) => {
        setItems(currentNav.items.filter((item) => item.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            await wbApi.updateNavigation(siteId, currentPosition, { items: currentNav.items });
            setSuccess(`${POSITION_LABELS[currentPosition]} kaydedildi!`);
        } catch (e) {
            setError("Kaydedilemedi: " + (e.response?.data?.error || e.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Typography variant="h6" fontWeight={700}>Menü Editörü</Typography>
                <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />} onClick={handleSave} disabled={saving} disableElevation>
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
                {POSITIONS.map((pos) => <Tab key={pos} label={POSITION_LABELS[pos]} />)}
            </Tabs>

            <Card sx={{ borderRadius: 2 }}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={600}>{POSITION_LABELS[currentPosition]}</Typography>
                        <Button size="small" startIcon={<AddRounded />} onClick={addItem} variant="outlined">Bağlantı Ekle</Button>
                    </Box>

                    {currentNav.items.length === 0 ? (
                        <Box sx={{ textAlign: "center", py: 4, border: "2px dashed", borderColor: "divider", borderRadius: 2 }}>
                            <LinkRounded sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                            <Typography color="text.secondary" variant="body2">Menü boş. Bağlantı ekleyin.</Typography>
                        </Box>
                    ) : (
                        <Box>
                            <Box sx={{ display: "flex", gap: 1, px: 1, mb: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ flex: "0 0 160px" }}>Etiket</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>URL</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ width: 90 }}>Hedef</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ width: 40 }}>Görünür</Typography>
                            </Box>
                            {currentNav.items.map((item) => (
                                <NavItemEditor key={item.id} item={item} onUpdate={updateItem} onDelete={deleteItem} />
                            ))}
                        </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Header Config (only for header) */}
                    {currentPosition === "header" && (
                        <Box>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Header Ayarları</Typography>
                            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                {[
                                    { label: "Sabit (sticky)", key: "isSticky" },
                                    { label: "Arama Göster", key: "showSearch" },
                                    { label: "Sepet Göster", key: "showCart" },
                                    { label: "Dil Seçici", key: "showLanguageSwitcher" },
                                    { label: "Para Birimi", key: "showCurrencySwitcher" },
                                ].map(({ label, key }) => (
                                    <FormControlLabel key={key} control={<Switch size="small" defaultChecked />} label={<Typography variant="caption">{label}</Typography>} />
                                ))}
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
