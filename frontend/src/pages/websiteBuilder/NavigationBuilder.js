import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Button, TextField, IconButton, Switch, FormControlLabel, Alert,
    CircularProgress, Divider, Tabs, Tab, Typography, Select, MenuItem,
    FormControl, InputLabel,
} from "@mui/material";
import {
    AddRounded, DeleteRounded, SaveRounded, DragIndicatorRounded,
    LinkRounded, PhoneIphoneRounded, ViewColumnRounded,
} from "@mui/icons-material";
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "../../utils/uuid";
import * as wbApi from "../../services/websiteBuilderApi";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import "../../styles/websiteBuilder/wbNavigationBuilder.css";
import "../../styles/websiteBuilder/wbDesignSystem.css";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";
import "../../styles/websiteBuilder/wbProductionMobile.css";

const POSITIONS = ["header", "footer", "mobile"];
const POSITION_LABELS = {
    header: "Header Menüsü",
    footer: "Footer Menüsü",
    mobile: "Mobil Menü",
};

const DEFAULT_HEADER_CONFIG = {
    isSticky: true, showSearch: true, showCart: true,
    showLanguageSwitcher: false, showCurrencySwitcher: false,
};
const DEFAULT_FOOTER_CONFIG = {
    showSocialLinks: true, showNewsletterSignup: true, showPaymentIcons: true, copyrightText: "",
};

function SortableTreeItem({ item, active, onSelect }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.85 : 1 };
    return (
        <div ref={setNodeRef} style={style} className={`wb-nav-tree-item${active ? " is-active" : ""}${item.isVisible === false ? " is-hidden" : ""}`}>
            <button type="button" className="wb-nav-row__drag" {...attributes} {...listeners} aria-label="Sürükle" onClick={(e) => e.stopPropagation()}>
                <DragIndicatorRounded fontSize="small" />
            </button>
            <button type="button" style={{ flex: 1, border: "none", background: "none", cursor: "pointer", textAlign: "left", padding: 0 }} onClick={() => onSelect(item.id)}>
                {item.label || "Bağlantı"}
                {item.isMegaMenu && <ViewColumnRounded sx={{ fontSize: 14, ml: 0.5, verticalAlign: "middle", color: "#6366f1" }} />}
            </button>
        </div>
    );
}

function NavItemSettings({ item, onUpdate, onDelete }) {
    if (!item) {
        return (
            <Typography color="text.secondary" sx={{ py: 4 }}>
                Soldan bir menü öğesi seçin veya yeni bağlantı ekleyin.
            </Typography>
        );
    }
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>Bağlantı ayarları</Typography>
            <TextField size="small" fullWidth label="Etiket" value={item.label || ""}
                onChange={(e) => onUpdate(item.id, { label: e.target.value })} />
            <TextField size="small" fullWidth label="URL" value={item.url || ""}
                onChange={(e) => onUpdate(item.id, { url: e.target.value })}
                InputProps={{ startAdornment: <LinkRounded sx={{ fontSize: 16, mr: 1, color: "text.disabled" }} /> }} />
            <FormControl size="small" fullWidth>
                <InputLabel>Hedef</InputLabel>
                <Select label="Hedef" value={item.target || "_self"} onChange={(e) => onUpdate(item.id, { target: e.target.value })}>
                    <MenuItem value="_self">Aynı sekme</MenuItem>
                    <MenuItem value="_blank">Yeni sekme</MenuItem>
                </Select>
            </FormControl>
            <FormControlLabel
                control={<Switch checked={!!item.isMegaMenu} onChange={(e) => onUpdate(item.id, { isMegaMenu: e.target.checked })} />}
                label="Mega menü"
            />
            <FormControlLabel
                control={<Switch checked={item.isVisible !== false} onChange={(e) => onUpdate(item.id, { isVisible: e.target.checked })} />}
                label="Görünür"
            />
            {item.isMegaMenu && (
                <Box sx={{ pl: 1, borderLeft: "2px solid #c7d2fe" }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Alt bağlantılar</Typography>
                    {(item.children || []).map((child, idx) => (
                        <Box key={child.id || idx} sx={{ display: "flex", gap: 1, mb: 1 }}>
                            <TextField size="small" placeholder="Etiket" value={child.label || ""}
                                onChange={(e) => {
                                    const children = [...(item.children || [])];
                                    children[idx] = { ...child, label: e.target.value };
                                    onUpdate(item.id, { children });
                                }} sx={{ width: 120 }} />
                            <TextField size="small" placeholder="/url" value={child.url || ""}
                                onChange={(e) => {
                                    const children = [...(item.children || [])];
                                    children[idx] = { ...child, url: e.target.value };
                                    onUpdate(item.id, { children });
                                }} sx={{ flex: 1 }} />
                            <IconButton size="small" color="error" onClick={() => {
                                onUpdate(item.id, { children: (item.children || []).filter((_, i) => i !== idx) });
                            }}><DeleteRounded fontSize="small" /></IconButton>
                        </Box>
                    ))}
                    <Button size="small" startIcon={<AddRounded />} onClick={() => {
                        onUpdate(item.id, {
                            children: [...(item.children || []), { id: uuidv4(), label: "Alt link", url: "/", target: "_self" }],
                            isMegaMenu: true,
                        });
                    }}>Alt link ekle</Button>
                </Box>
            )}
            <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => onDelete(item.id)} sx={{ alignSelf: "flex-start", mt: 1 }}>
                Bağlantıyı sil
            </Button>
        </Box>
    );
}

export default function NavigationBuilder({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const [navigations, setNavigations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [tab, setTab] = useState(0);
    const [selectedId, setSelectedId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        wbApi.getNavigation(siteId).then((d) => setNavigations(d.navigations || []))
            .catch(() => setError("Menüler yüklenemedi"))
            .finally(() => setLoading(false));
    }, [siteId]);

    useEffect(() => { load(); }, [load]);

    const currentPosition = POSITIONS[tab];
    const currentNav = useMemo(() => {
        const found = navigations.find((n) => n.position === currentPosition);
        return found || {
            position: currentPosition,
            items: [],
            headerConfig: { ...DEFAULT_HEADER_CONFIG },
            footerConfig: { ...DEFAULT_FOOTER_CONFIG },
        };
    }, [navigations, currentPosition]);

    const setNavSlice = (patch) => {
        setNavigations((prev) => {
            const exists = prev.some((n) => n.position === currentPosition);
            if (!exists) return [...prev, { position: currentPosition, items: [], ...patch }];
            return prev.map((n) => (n.position === currentPosition ? { ...n, ...patch } : n));
        });
    };

    const items = [...(currentNav.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const selectedItem = items.find((i) => i.id === selectedId) || null;

    useEffect(() => {
        if (items.length && !items.some((i) => i.id === selectedId)) {
            setSelectedId(items[0].id);
        }
        if (!items.length) setSelectedId(null);
    }, [items, selectedId, currentPosition]);

    const setItems = (newItems) => setNavSlice({ items: newItems.map((it, i) => ({ ...it, order: i })) });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        setItems(arrayMove(items, oldIndex, newIndex));
    };

    const addItem = () => {
        const id = uuidv4();
        setItems([...items, {
            id, label: "Yeni Link", url: "/", target: "_self",
            isVisible: true, children: [], isMegaMenu: false, order: items.length,
        }]);
        setSelectedId(id);
    };

    const updateItem = (id, updates) => setItems(items.map((it) => (it.id === id ? { ...it, ...updates } : it)));
    const deleteItem = (id) => {
        setItems(items.filter((it) => it.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const syncMobileFromHeader = () => {
        const header = navigations.find((n) => n.position === "header");
        if (!header?.items?.length) return;
        setNavigations((prev) => {
            const rest = prev.filter((n) => n.position !== "mobile");
            return [...rest, { position: "mobile", items: header.items.map((i) => ({ ...i, id: uuidv4() })) }];
        });
        setSuccess("Mobil menü header'dan kopyalandı — kaydetmeyi unutmayın.");
        setTab(2);
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const payload = { items: currentNav.items };
            if (currentPosition === "header") payload.headerConfig = currentNav.headerConfig || DEFAULT_HEADER_CONFIG;
            if (currentPosition === "footer") payload.footerConfig = currentNav.footerConfig || DEFAULT_FOOTER_CONFIG;
            await wbApi.updateNavigation(siteId, currentPosition, payload);
            setSuccess(`${POSITION_LABELS[currentPosition]} kaydedildi.`);
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const headerConfig = currentNav.headerConfig || DEFAULT_HEADER_CONFIG;
    const footerConfig = currentNav.footerConfig || DEFAULT_FOOTER_CONFIG;

    if (loading) {
        return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
    }

    return (
        <Box className="wb-ikas-page wb-nav-builder wb-ws-page--premium">
            <WBIkasPageHeader
                title="Menü Oluşturucu"
                subtitle="Sol: menü ağacı · Sağ: bağlantı ve konum ayarları"
                actions={
                    <Button variant="contained" className="wb-ikas-btn-primary" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
                        onClick={handleSave} disabled={saving}>
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </Button>
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
                <Tab label={POSITION_LABELS.header} />
                <Tab label={POSITION_LABELS.footer} />
                <Tab icon={<PhoneIphoneRounded sx={{ fontSize: 18 }} />} iconPosition="start" label={POSITION_LABELS.mobile} />
            </Tabs>

            {currentPosition === "mobile" && (
                <Button size="small" variant="outlined" className="wb-ikas-btn-outline" sx={{ mb: 2 }} onClick={syncMobileFromHeader}>
                    Header menüsünü mobile kopyala
                </Button>
            )}

            <div className="wb-nav-studio">
                <aside className="wb-nav-studio__tree">
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                            Menü ağacı
                        </Typography>
                        <Button size="small" startIcon={<AddRounded />} onClick={addItem}>Ekle</Button>
                    </Box>
                    {items.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">Menü boş.</Typography>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                {items.map((item) => (
                                    <SortableTreeItem
                                        key={item.id}
                                        item={item}
                                        active={selectedId === item.id}
                                        onSelect={setSelectedId}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </aside>

                <section className="wb-nav-studio__settings">
                    <NavItemSettings item={selectedItem} onUpdate={updateItem} onDelete={deleteItem} />

                    {currentPosition === "header" && (
                        <>
                            <Divider sx={{ my: 3 }} />
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Header ayarları</Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                {[
                                    ["isSticky", "Sabit (sticky)"],
                                    ["showSearch", "Arama"],
                                    ["showCart", "Sepet"],
                                    ["showLanguageSwitcher", "Dil"],
                                    ["showCurrencySwitcher", "Para birimi"],
                                ].map(([key, label]) => (
                                    <FormControlLabel key={key}
                                        control={<Switch size="small" checked={!!headerConfig[key]}
                                            onChange={(e) => setNavSlice({ headerConfig: { ...headerConfig, [key]: e.target.checked } })} />}
                                        label={label}
                                    />
                                ))}
                            </Box>
                        </>
                    )}

                    {currentPosition === "footer" && (
                        <>
                            <Divider sx={{ my: 3 }} />
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Footer ayarları</Typography>
                            {[
                                ["showSocialLinks", "Sosyal"],
                                ["showNewsletterSignup", "Bülten"],
                                ["showPaymentIcons", "Ödeme ikonları"],
                            ].map(([key, label]) => (
                                <FormControlLabel key={key}
                                    control={<Switch size="small" checked={!!footerConfig[key]}
                                        onChange={(e) => setNavSlice({ footerConfig: { ...footerConfig, [key]: e.target.checked } })} />}
                                    label={label}
                                />
                            ))}
                            <TextField fullWidth size="small" label="Telif metni" sx={{ mt: 1 }}
                                value={footerConfig.copyrightText || ""}
                                onChange={(e) => setNavSlice({ footerConfig: { ...footerConfig, copyrightText: e.target.value } })} />
                        </>
                    )}
                </section>
            </div>
        </Box>
    );
}
