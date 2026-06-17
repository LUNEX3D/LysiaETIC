import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Button, Typography, Alert, CircularProgress,
    TextField, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
    IconButton,
} from "@mui/material";
import { AddRounded, DeleteRounded, DesktopWindowsRounded, TabletMacRounded, PhoneIphoneRounded } from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";
import "../../styles/websiteBuilder/wbDesignSystem.css";
import "../../styles/websiteBuilder/wbProductionMobile.css";

const TRIGGERS = [
    { id: "time_delay", label: "Zaman gecikmesi" },
    { id: "scroll_depth", label: "Scroll %" },
    { id: "exit_intent", label: "Exit intent" },
    { id: "immediate", label: "Anında" },
];

function statusPillClass(status) {
    if (status === "active") return "wb-ds-pill wb-ds-pill--success";
    if (status === "paused") return "wb-ds-pill wb-ds-pill--warning";
    return "wb-ds-pill wb-ds-pill--muted";
}

const DEVICE_FRAMES = [
    { id: "desktop", label: "Desktop", icon: DesktopWindowsRounded, className: "wb-popup-preview-frame--desktop" },
    { id: "tablet", label: "Tablet", icon: TabletMacRounded, className: "wb-popup-preview-frame--tablet" },
    { id: "mobile", label: "Mobile", icon: PhoneIphoneRounded, className: "wb-popup-preview-frame--mobile" },
];

function PopupPreviewMock({ popup, device = "desktop" }) {
    if (!popup) {
        return (
            <Typography color="text.secondary" textAlign="center">
                Soldan bir popup seçin veya yeni oluşturun
            </Typography>
        );
    }
    const sections = [...(popup.design?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const frameClass = DEVICE_FRAMES.find((d) => d.id === device)?.className || DEVICE_FRAMES[0].className;
    const widthMap = { desktop: popup.design?.width || 440, tablet: 360, mobile: 320 };
    return (
        <div className={`wb-popup-preview-frame ${frameClass}`}>
        <div
            className="wb-ds-card wb-ds-card--elevated"
            style={{
                maxWidth: widthMap[device] || 440,
                width: "100%",
                borderRadius: popup.design?.borderRadius || 12,
                padding: device === "mobile" ? 16 : 24,
                position: "relative",
            }}
        >
            {popup.design?.showCloseButton !== false && (
                <span style={{ position: "absolute", top: 12, right: 14, fontSize: 20, color: "#71717a" }}>×</span>
            )}
            {sections.map((sec) => (
                <div key={sec.id} style={{ marginBottom: 12, textAlign: "center" }}>
                    {sec.type === "heading" && <h3 style={{ margin: 0, fontSize: 20 }}>{sec.content?.text || "Başlık"}</h3>}
                    {sec.type === "text" && <p style={{ margin: 0, color: "#52525b" }}>{sec.content?.text || "Metin"}</p>}
                    {sec.type === "button" && (
                        <button
                            type="button"
                            className="wb-ds-btn wb-ds-btn--primary"
                            style={{ marginTop: 8 }}
                        >
                            {sec.content?.text || "Tamam"}
                        </button>
                    )}
                </div>
            ))}
            {!sections.length && (
                <Typography variant="body2" color="text.secondary">İçerik bölümü ekleyin (kaydet sonrası görünür)</Typography>
            )}
        </div>
        </div>
    );
}

export default function PopupCenter({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const [popups, setPopups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [edit, setEdit] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [previewDevice, setPreviewDevice] = useState("desktop");

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            wbApi.listPopups(siteId),
            wbApi.getPopupAnalytics(siteId).catch(() => ({ popups: [] })),
        ]).then(([p, a]) => {
            const list = p.popups || [];
            setPopups(list);
            setAnalytics(a);
            setSelectedId((prev) => {
                const keep = list.find((x) => x._id === prev);
                const next = keep || list[0];
                if (next) setEdit({ ...next });
                else setEdit(null);
                return next?._id || null;
            });
        }).catch(() => setError("Popup listesi yüklenemedi"))
            .finally(() => setLoading(false));
    }, [siteId]);

    useEffect(() => { load(); }, [load]);

    const selectPopup = (p) => {
        setSelectedId(p._id);
        setEdit({ ...p });
    };

    const handleCreate = async (preset) => {
        try {
            await wbApi.createPopup(siteId, preset ? { preset: "coupon", name: "Kupon Popup" } : { name: "Yeni Popup" });
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Oluşturulamadı");
        }
    };

    const handleSaveEdit = async () => {
        if (!edit?._id) return;
        try {
            await wbApi.updatePopup(siteId, edit._id, edit);
            setSuccessMsg("Kaydedildi");
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        }
    };

    const [successMsg, setSuccessMsg] = useState("");

    const handleDelete = async (id) => {
        if (!window.confirm("Popup silinsin mi?")) return;
        await wbApi.deletePopup(siteId, id);
        if (selectedId === id) {
            setSelectedId(null);
            setEdit(null);
        }
        load();
    };

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;

    return (
        <Box className="wb-ikas-page wb-ws-page--premium">
            <WBIkasPageHeader
                title="Popup Merkezi"
                subtitle="Sol listeden seçin, ortada önizleyin, sağda ayarlayın."
                actions={
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Button variant="outlined" className="wb-ikas-btn-outline" onClick={() => handleCreate("coupon")}>+ Kupon</Button>
                        <Button variant="contained" className="wb-ikas-btn-primary" startIcon={<AddRounded />} onClick={() => handleCreate()}>Yeni popup</Button>
                    </Box>
                }
            />
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}

            {analytics?.popups?.length > 0 && (
                <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {analytics.popups.map((p) => (
                        <span key={p.id} className="wb-ds-pill wb-ds-pill--muted">
                            {p.name}: {p.views} görüntülenme · %{p.conversionRate} tıklama
                        </span>
                    ))}
                </Box>
            )}

            <div className="wb-ds-studio">
                <aside className="wb-ds-studio__list">
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, px: 0.5 }}>
                        Popuplar
                    </Typography>
                    {popups.length === 0 && (
                        <Typography variant="body2" color="text.secondary">Henüz popup yok.</Typography>
                    )}
                    {popups.map((p) => (
                        <button
                            key={p._id}
                            type="button"
                            className={`wb-ds-studio-list-item${selectedId === p._id ? " is-active" : ""}`}
                            onClick={() => selectPopup(p)}
                        >
                            <Typography fontWeight={600} fontSize={14}>{p.name}</Typography>
                            <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, flexWrap: "wrap" }}>
                                <span className={statusPillClass(p.status)}>{p.status}</span>
                                <span className="wb-ds-pill wb-ds-pill--muted">{p.stats?.views || 0} görüntülenme</span>
                            </Box>
                        </button>
                    ))}
                </aside>

                <main className="wb-ds-studio__canvas wb-ds-studio__canvas--popup">
                    <div className="wb-popup-device-bar">
                        {DEVICE_FRAMES.map((d) => {
                            const Icon = d.icon;
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    className={`wb-popup-device-btn${previewDevice === d.id ? " is-active" : ""}`}
                                    onClick={() => setPreviewDevice(d.id)}
                                >
                                    <Icon sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} />
                                    {d.label}
                                </button>
                            );
                        })}
                    </div>
                    <PopupPreviewMock popup={edit} device={previewDevice} />
                </main>

                <aside className="wb-ds-studio__settings">
                    {!edit ? (
                        <Typography color="text.secondary" fontSize={14}>Ayarlar için popup seçin.</Typography>
                    ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700}>Ayarlar</Typography>
                            <TextField label="Ad" size="small" fullWidth value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                            <FormControl fullWidth size="small">
                                <InputLabel>Durum</InputLabel>
                                <Select label="Durum" value={edit.status || "draft"} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                                    <MenuItem value="draft">Taslak</MenuItem>
                                    <MenuItem value="active">Aktif</MenuItem>
                                    <MenuItem value="paused">Duraklatıldı</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>Tetikleyici</InputLabel>
                                <Select label="Tetikleyici" value={edit.trigger?.type || "time_delay"}
                                    onChange={(e) => setEdit({ ...edit, trigger: { ...edit.trigger, type: e.target.value } })}>
                                    {TRIGGERS.map((t) => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                            {edit.trigger?.type === "time_delay" && (
                                <TextField type="number" size="small" label="Gecikme (sn)" value={edit.trigger?.delaySeconds ?? 3}
                                    onChange={(e) => setEdit({ ...edit, trigger: { ...edit.trigger, delaySeconds: Number(e.target.value) } })} />
                            )}
                            {edit.trigger?.type === "scroll_depth" && (
                                <TextField type="number" size="small" label="Scroll %" value={edit.trigger?.scrollDepthPercent ?? 50}
                                    onChange={(e) => setEdit({ ...edit, trigger: { ...edit.trigger, scrollDepthPercent: Number(e.target.value) } })} />
                            )}
                            <FormControlLabel
                                control={<Switch checked={edit.design?.overlay !== false}
                                    onChange={(e) => setEdit({ ...edit, design: { ...edit.design, overlay: e.target.checked } })} />}
                                label="Arka plan karartma"
                            />
                            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                                <Button variant="contained" className="wb-ikas-btn-primary" fullWidth onClick={handleSaveEdit}>Kaydet</Button>
                                <IconButton color="error" onClick={() => handleDelete(edit._id)} aria-label="Sil"><DeleteRounded /></IconButton>
                            </Box>
                        </Box>
                    )}
                </aside>
            </div>
        </Box>
    );
}
