import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Box, Grid, TextField, Button, Typography, Chip, FormControl, InputLabel,
    Select, MenuItem, Alert, CircularProgress, Divider, Paper, Autocomplete,
    Switch, FormControlLabel, Card, CardContent,
} from "@mui/material";
import {
    ArrowBackRounded, SaveRounded, PublishRounded, ImageRounded,
    ScheduleRounded, AccessTimeRounded,
} from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";

const STATUS_OPTIONS = [
    { value: "draft", label: "Taslak" },
    { value: "published", label: "Yayında" },
    { value: "archived", label: "Arşiv" },
];

function SimpleRichEditor({ value, onChange }) {
    return (
        <Box>
            <Box sx={{ borderBottom: "1px solid", borderColor: "divider", p: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {[["B", "bold"], ["I", "italic"], ["U", "underline"]].map(([label, cmd]) => (
                    <Button key={cmd} size="small" variant="text" sx={{ minWidth: 30, fontWeight: label === "B" ? 900 : 400, fontStyle: label === "I" ? "italic" : "normal", textDecoration: label === "U" ? "underline" : "none", fontSize: 13 }}
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd, false); }}>
                        {label}
                    </Button>
                ))}
                <Divider orientation="vertical" flexItem />
                {[["H2", "h2"], ["H3", "h3"], ["P", "p"]].map(([label, tag]) => (
                    <Button key={tag} size="small" variant="text" sx={{ fontSize: 12, minWidth: 30 }}
                        onMouseDown={(e) => { e.preventDefault(); document.execCommand("formatBlock", false, tag); }}>
                        {label}
                    </Button>
                ))}
                <Divider orientation="vertical" flexItem />
                <Button size="small" variant="text" sx={{ fontSize: 12 }} onMouseDown={(e) => { e.preventDefault(); document.execCommand("insertUnorderedList", false); }}>• Liste</Button>
                <Button size="small" variant="text" sx={{ fontSize: 12 }} onMouseDown={(e) => { e.preventDefault(); document.execCommand("insertOrderedList", false); }}>1. Liste</Button>
            </Box>
            <div
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: value }}
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
                style={{ minHeight: 400, padding: 16, outline: "none", fontSize: 15, lineHeight: 1.8, fontFamily: "inherit" }}
            />
        </Box>
    );
}

export default function BlogPostEditor() {
    const { siteId, postId } = useParams();
    const navigate = useNavigate();
    const isNew = !postId || postId === "new";

    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!isNew);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [form, setForm] = useState({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        thumbnailUrl: "",
        status: "draft",
        categoryId: "",
        tags: [],
        isFeatured: false,
        allowComments: true,
        seo: { title: "", description: "", keywords: "" },
    });

    const [tagInput, setTagInput] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const [catData] = await Promise.all([wbApi.getBlogCategories(siteId)]);
                setCategories(catData.categories || []);

                if (!isNew) {
                    const postData = await wbApi.getBlogPost(siteId, postId);
                    const p = postData.post;
                    setForm({
                        title: p.title || "",
                        slug: p.slug || "",
                        excerpt: p.excerpt || "",
                        content: p.content || "",
                        thumbnailUrl: p.thumbnailUrl || "",
                        status: p.status || "draft",
                        categoryId: p.categoryId?._id || p.categoryId || "",
                        tags: p.tags || [],
                        isFeatured: p.isFeatured || false,
                        allowComments: p.allowComments !== false,
                        seo: p.seo || { title: "", description: "", keywords: "" },
                    });
                }
            } catch {
                setError("Veriler yüklenemedi");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId, postId, isNew]);

    const handleTitleChange = (title) => {
        setForm((f) => ({
            ...f,
            title,
            slug: f.slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        }));
    };

    const handleSave = async (publishNow = false) => {
        if (!form.title.trim()) { setError("Başlık zorunlu"); return; }
        setSaving(true);
        setError("");
        try {
            const payload = { ...form };
            if (publishNow) { payload.status = "published"; payload.publishedAt = new Date().toISOString(); }

            if (isNew) {
                const data = await wbApi.createBlogPost(siteId, payload);
                setSuccess("Yazı oluşturuldu!");
                navigate(`/website-builder/${siteId}/blog/${data.post._id}`, { replace: true });
            } else {
                await wbApi.updateBlogPost(siteId, postId, payload);
                setSuccess("Yazı kaydedildi!");
            }
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const addTag = () => {
        const t = tagInput.trim().toLowerCase();
        if (t && !form.tags.includes(t)) {
            setForm((f) => ({ ...f, tags: [...f.tags, t] }));
        }
        setTagInput("");
    };

    const removeTag = (tag) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(`/website-builder/${siteId}/blog`)} color="inherit">
                        Blog
                    </Button>
                    <Typography variant="h6" fontWeight={700}>{isNew ? "Yeni Yazı" : "Yazıyı Düzenle"}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button variant="outlined" startIcon={<SaveRounded />} onClick={() => handleSave(false)} disabled={saving}>
                        {saving ? <CircularProgress size={16} /> : "Taslak Kaydet"}
                    </Button>
                    <Button variant="contained" color="success" startIcon={<PublishRounded />} onClick={() => handleSave(true)} disabled={saving} disableElevation>
                        Yayınla
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Grid container spacing={3}>
                {/* Main Content */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
                        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                            <TextField
                                fullWidth
                                variant="standard"
                                placeholder="Yazı Başlığı"
                                value={form.title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                inputProps={{ style: { fontSize: 24, fontWeight: 700 } }}
                                InputProps={{ disableUnderline: true }}
                            />
                            <TextField
                                fullWidth
                                variant="standard"
                                placeholder="slug (otomatik doldurulur)"
                                value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                                inputProps={{ style: { fontSize: 13, fontFamily: "monospace" } }}
                                InputProps={{ disableUnderline: true, startAdornment: <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>/blog/</Typography> }}
                            />
                        </Box>
                        <SimpleRichEditor value={form.content} onChange={(html) => setForm((f) => ({ ...f, content: html }))} />
                    </Paper>
                </Grid>

                {/* Sidebar */}
                <Grid item xs={12} md={4}>
                    {/* Status */}
                    <Card sx={{ borderRadius: 2, mb: 2 }}>
                        <CardContent>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Durum</Typography>
                            <FormControl fullWidth size="small">
                                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                                    {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControlLabel control={<Switch checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} size="small" />} label="Öne Çıkar" sx={{ mt: 1, display: "flex" }} />
                        </CardContent>
                    </Card>

                    {/* Category & Tags */}
                    <Card sx={{ borderRadius: 2, mb: 2 }}>
                        <CardContent>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Kategori & Etiketler</Typography>
                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                <InputLabel>Kategori</InputLabel>
                                <Select label="Kategori" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                                    <MenuItem value=""><em>Kategori Yok</em></MenuItem>
                                    {categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                                <TextField size="small" placeholder="Etiket ekle..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} sx={{ flex: 1 }} inputProps={{ style: { fontSize: 13 } }} />
                                <Button size="small" onClick={addTag} variant="outlined">Ekle</Button>
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                {form.tags.map((tag) => <Chip key={tag} label={tag} size="small" onDelete={() => removeTag(tag)} />)}
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Thumbnail */}
                    <Card sx={{ borderRadius: 2, mb: 2 }}>
                        <CardContent>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Kapak Görseli</Typography>
                            {form.thumbnailUrl ? (
                                <Box sx={{ position: "relative" }}>
                                    <img src={form.thumbnailUrl} alt="Kapak" style={{ width: "100%", borderRadius: 8, objectFit: "cover", aspectRatio: "16/9" }} />
                                    <Button size="small" onClick={() => setForm((f) => ({ ...f, thumbnailUrl: "" }))} sx={{ mt: 1 }}>Kaldır</Button>
                                </Box>
                            ) : (
                                <TextField fullWidth size="small" placeholder="Görsel URL..." value={form.thumbnailUrl} onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))} InputProps={{ startAdornment: <ImageRounded sx={{ mr: 1, color: "text.disabled", fontSize: 18 }} /> }} />
                            )}
                        </CardContent>
                    </Card>

                    {/* Excerpt */}
                    <Card sx={{ borderRadius: 2, mb: 2 }}>
                        <CardContent>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Özet</Typography>
                            <TextField fullWidth multiline rows={3} size="small" placeholder="Kısa özet..." value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} inputProps={{ maxLength: 500 }} helperText={`${form.excerpt.length}/500`} />
                        </CardContent>
                    </Card>

                    {/* SEO */}
                    <Card sx={{ borderRadius: 2 }}>
                        <CardContent>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>SEO</Typography>
                            <TextField fullWidth size="small" label="Meta Başlık" value={form.seo.title} onChange={(e) => setForm((f) => ({ ...f, seo: { ...f.seo, title: e.target.value } }))} sx={{ mb: 1 }} />
                            <TextField fullWidth size="small" label="Meta Açıklama" multiline rows={2} value={form.seo.description} onChange={(e) => setForm((f) => ({ ...f, seo: { ...f.seo, description: e.target.value } }))} sx={{ mb: 1 }} />
                            <TextField fullWidth size="small" label="Anahtar Kelimeler" value={form.seo.keywords} onChange={(e) => setForm((f) => ({ ...f, seo: { ...f.seo, keywords: e.target.value } }))} placeholder="kelime1, kelime2" />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
