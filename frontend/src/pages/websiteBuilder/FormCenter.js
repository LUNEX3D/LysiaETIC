import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Button, Tabs, Tab, Typography, Alert, CircularProgress, Card, CardContent,
    TextField, IconButton, Select, MenuItem, FormControl, InputLabel, Chip,
    Switch, FormControlLabel,
} from "@mui/material";
import { AddRounded, DeleteRounded, DragIndicatorRounded, SaveRounded } from "@mui/icons-material";
import { v4 as uuidv4 } from "../../utils/uuid";
import * as wbApi from "../../services/websiteBuilderApi";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";
import "../../styles/websiteBuilder/wbDesignSystem.css";
import "../../styles/websiteBuilder/wbProductionMobile.css";

function formStatusPill(status) {
    if (status === "active") return "wb-ds-pill wb-ds-pill--success";
    return "wb-ds-pill wb-ds-pill--muted";
}

function submissionStatusPill(status) {
    if (status === "new") return "wb-ds-pill wb-ds-pill--active";
    if (status === "archived") return "wb-ds-pill wb-ds-pill--muted";
    return "wb-ds-pill wb-ds-pill--warning";
}

const FIELD_TYPES = [
    { id: "text", label: "Metin" },
    { id: "email", label: "E-posta" },
    { id: "phone", label: "Telefon" },
    { id: "textarea", label: "Uzun metin" },
    { id: "select", label: "Seçim" },
    { id: "checkbox", label: "Onay kutusu" },
];

export default function FormCenter({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const [tab, setTab] = useState(0);
    const [forms, setForms] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [selectedFormId, setSelectedFormId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formAnalytics, setFormAnalytics] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [f, s, a] = await Promise.all([
                wbApi.listForms(siteId),
                wbApi.listFormSubmissions(siteId, {}),
                wbApi.getFormAnalytics(siteId).catch(() => null),
            ]);
            setForms(f.forms || []);
            setSubmissions(s.submissions || []);
            setFormAnalytics(a);
            if (!selectedFormId && f.forms?.[0]) setSelectedFormId(f.forms[0]._id);
        } catch {
            setError("Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { load(); }, [load]);

    const startNewForm = () => {
        setEditForm({
            name: "Yeni Form",
            slug: "yeni-form",
            status: "active",
            fields: [
                { id: uuidv4(), type: "text", label: "Ad Soyad", required: true, order: 0 },
                { id: uuidv4(), type: "email", label: "E-posta", required: true, order: 1 },
            ],
            settings: { notifyEmail: "", submitButtonText: "Gönder", successMessage: "Teşekkürler!" },
        });
        setTab(0);
    };

    const saveForm = async () => {
        try {
            if (editForm._id) {
                await wbApi.updateForm(siteId, editForm._id, editForm);
            } else {
                await wbApi.createForm(siteId, editForm);
            }
            setEditForm(null);
            setSuccess("Form kaydedildi");
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        }
    };

    const moveField = (index, dir) => {
        const fields = [...editForm.fields];
        const j = index + dir;
        if (j < 0 || j >= fields.length) return;
        [fields[index], fields[j]] = [fields[j], fields[index]];
        setEditForm({ ...editForm, fields: fields.map((f, i) => ({ ...f, order: i })) });
    };

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;

    return (
        <Box className="wb-ikas-page wb-ws-page--premium">
            <WBIkasPageHeader
                title="Form Merkezi"
                subtitle="Form oluşturucu, alan sıralama ve gelen cevaplar."
                actions={
                    <Button variant="contained" startIcon={<AddRounded />} onClick={startNewForm}>Yeni form</Button>
                }
            />
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            {formAnalytics && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Son 30 gün: {formAnalytics.total} gönderim
                    <Button size="small" sx={{ ml: 2 }} onClick={async () => {
                        const blob = await wbApi.exportFormSubmissionsCsv(siteId);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "form-submissions.csv";
                        a.click();
                    }}>CSV indir</Button>
                </Alert>
            )}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label="Formlar" />
                <Tab label={`Cevaplar (${submissions.length})`} />
            </Tabs>

            {tab === 0 && !editForm && (
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
                    {forms.map((f) => (
                        <article key={f._id} className="wb-ds-card" style={{ cursor: "pointer" }} onClick={() => setEditForm({ ...f })} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditForm({ ...f })}>
                            <div className="wb-ds-card__body">
                                <Typography fontWeight={700} fontSize={16}>{f.name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                                    /{f.slug || "form"}
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                                    <span className={formStatusPill(f.status)}>{f.status}</span>
                                    <span className="wb-ds-pill wb-ds-pill--muted">{f.fields?.length || 0} alan</span>
                                    <span className="wb-ds-pill wb-ds-pill--muted">{f.stats?.submissions ?? 0} gönderim</span>
                                </Box>
                                <Button size="small" variant="outlined" className="wb-ikas-btn-outline" onClick={(e) => { e.stopPropagation(); setEditForm({ ...f }); }}>
                                    Düzenle
                                </Button>
                            </div>
                        </article>
                    ))}
                </Box>
            )}

            {tab === 0 && editForm && (
                <Card variant="outlined" className="wb-ds-card" sx={{ p: 2, borderRadius: 2 }}>
                    <TextField fullWidth label="Form adı" sx={{ mb: 2 }} value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <TextField fullWidth label="Slug (public ID)" sx={{ mb: 2 }} value={editForm.slug}
                        onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
                    <TextField fullWidth label="Bildirim e-postası" sx={{ mb: 2 }}
                        value={editForm.settings?.notifyEmail || ""}
                        onChange={(e) => setEditForm({ ...editForm, settings: { ...editForm.settings, notifyEmail: e.target.value } })} />

                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Alanlar</Typography>
                    {(editForm.fields || []).map((field, idx) => (
                        <Box key={field.id} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
                            <DragIndicatorRounded color="disabled" />
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <Select value={field.type} onChange={(e) => {
                                    const fields = [...editForm.fields];
                                    fields[idx] = { ...field, type: e.target.value };
                                    setEditForm({ ...editForm, fields });
                                }}>
                                    {FIELD_TYPES.map((t) => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <TextField size="small" label="Etiket" value={field.label}
                                onChange={(e) => {
                                    const fields = [...editForm.fields];
                                    fields[idx] = { ...field, label: e.target.value };
                                    setEditForm({ ...editForm, fields });
                                }} sx={{ flex: 1 }} />
                            <FormControlLabel control={<Switch size="small" checked={!!field.required}
                                onChange={(e) => {
                                    const fields = [...editForm.fields];
                                    fields[idx] = { ...field, required: e.target.checked };
                                    setEditForm({ ...editForm, fields });
                                }} />} label="Zorunlu" />
                            <Button size="small" onClick={() => moveField(idx, -1)}>↑</Button>
                            <Button size="small" onClick={() => moveField(idx, 1)}>↓</Button>
                            <IconButton size="small" color="error" onClick={() => setEditForm({
                                ...editForm, fields: editForm.fields.filter((_, i) => i !== idx),
                            })}><DeleteRounded fontSize="small" /></IconButton>
                        </Box>
                    ))}
                    <Button size="small" startIcon={<AddRounded />} sx={{ mb: 2 }} onClick={() => setEditForm({
                        ...editForm,
                        fields: [...(editForm.fields || []), { id: uuidv4(), type: "text", label: "Alan", required: false, order: editForm.fields.length }],
                    })}>Alan ekle</Button>

                    <Box sx={{ display: "flex", gap: 1 }}>
                        <Button variant="contained" startIcon={<SaveRounded />} onClick={saveForm}>Kaydet</Button>
                        <Button onClick={() => setEditForm(null)}>İptal</Button>
                    </Box>
                </Card>
            )}

            {tab === 1 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {submissions.length === 0 && (
                        <Typography color="text.secondary">Henüz gönderim yok.</Typography>
                    )}
                    {submissions.map((s) => (
                        <article key={s._id} className="wb-ds-card">
                            <div className="wb-ds-card__body">
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 1 }}>
                                    <Typography fontWeight={600} fontSize={14}>
                                        {new Date(s.createdAt).toLocaleString("tr-TR")}
                                    </Typography>
                                    <span className={submissionStatusPill(s.status)}>{s.status}</span>
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                    Form: {s.formId || "İletişim / section"}
                                </Typography>
                                <Typography variant="body2" component="pre" sx={{ whiteSpace: "pre-wrap", m: 0, fontFamily: "inherit", color: "#3f3f46" }}>
                                    {Object.entries(s.fields || {}).map(([k, v]) => `${k}: ${v}`).join("\n")}
                                </Typography>
                            </div>
                        </article>
                    ))}
                </Box>
            )}
        </Box>
    );
}
