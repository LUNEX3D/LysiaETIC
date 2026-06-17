import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Box, Grid, Card, CardContent, Typography, Button, Chip, Alert,
    CircularProgress, TextField, FormControl, InputLabel, Select, MenuItem,
    LinearProgress, IconButton, Tooltip, Paper, Divider, Tabs, Tab,
    List, ListItem, ListItemText, ListItemSecondaryAction, Avatar,
} from "@mui/material";
import {
    AutoAwesomeRounded, SendRounded, StopRounded, ContentCopyRounded,
    CheckRounded, RefreshRounded, ArticleRounded, PaletteRounded,
    SearchRounded, CampaignRounded, TrendingUpRounded, AbcRounded,
    SaveRounded, DeleteRounded,
} from "@mui/icons-material";
import * as wbAIApi from "../../services/websiteBuilderApi";

const JOB_TYPES = [
    { value: "blog_writer", label: "Blog Yazısı Yaz", icon: <ArticleRounded />, color: "#3b82f6", desc: "SEO uyumlu, okunabilir blog yazısı oluştur" },
    { value: "product_description", label: "Ürün Açıklaması", icon: <AbcRounded />, color: "#8b5cf6", desc: "Dönüşüm odaklı ürün tanıtım metni" },
    { value: "seo_meta_generator", label: "SEO Meta Üret", icon: <SearchRounded />, color: "#22c55e", desc: "Sayfa başlığı ve açıklaması üret" },
    { value: "color_palette_generator", label: "Renk Paleti", icon: <PaletteRounded />, color: "#f59e0b", desc: "Marka için renk paleti oluştur" },
    { value: "banner_generator", label: "Banner İçeriği", icon: <CampaignRounded />, color: "#ef4444", desc: "Kampanya banner metni üret" },
    { value: "landing_page_generator", label: "Landing Page", icon: <TrendingUpRounded />, color: "#0ea5e9", desc: "Tam sayfa düzeni oluştur (ağır işlem)" },
    { value: "product_faq_generator", label: "Ürün SSS", icon: <ArticleRounded />, color: "#6366f1", desc: "Ürüne özel sık sorulan sorular" },
    { value: "category_description", label: "Kategori Açıklaması", icon: <AbcRounded />, color: "#ec4899", desc: "Kategori sayfası için SEO metni" },
];

const STATUS_COLORS = { queued: "#f59e0b", processing: "#3b82f6", completed: "#22c55e", failed: "#ef4444", cancelled: "#6b7280" };
const STATUS_LABELS = { queued: "Sırada", processing: "İşleniyor", completed: "Tamamlandı", failed: "Başarısız", cancelled: "İptal" };

function JobCard({ job, onRefresh, onApply }) {
    const [expanded, setExpanded] = useState(false);
    const status = job.status;

    return (
        <Card sx={{ mb: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    {status === "processing" ? <CircularProgress size={20} /> : (
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: STATUS_COLORS[status] || "#6b7280" }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{job.input?.prompt?.slice(0, 80) || job.jobType}</Typography>
                        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                            <Chip label={STATUS_LABELS[status] || status} size="small" sx={{ fontSize: 10, height: 20, bgcolor: STATUS_COLORS[status] + "20", color: STATUS_COLORS[status] }} />
                            <Chip label={JOB_TYPES.find((t) => t.value === job.jobType)?.label || job.jobType} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                        </Box>
                    </Box>
                    {status === "completed" && (
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Tooltip title="İçeriği Göster">
                                <IconButton size="small" onClick={() => setExpanded(!expanded)}>{expanded ? <RefreshRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}</IconButton>
                            </Tooltip>
                            {onApply && <Button size="small" variant="contained" disableElevation onClick={() => onApply(job)}>Uygula</Button>}
                        </Box>
                    )}
                </Box>

                {expanded && status === "completed" && job.output?.generatedContent && (
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 1, maxHeight: 300, overflowY: "auto" }}>
                        {typeof job.output.generatedContent === "string" ? (
                            <Typography variant="caption" sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{job.output.generatedContent}</Typography>
                        ) : (
                            <Typography variant="caption" sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{JSON.stringify(job.output.generatedContent, null, 2)}</Typography>
                        )}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default function AIContentStudio() {
    const { siteId } = useParams();
    const [tab, setTab] = useState(0);
    const [jobType, setJobType] = useState("blog_writer");
    const [prompt, setPrompt] = useState("");
    const [tone, setTone] = useState("professional");
    const [language, setLanguage] = useState("tr");
    const [wordCount, setWordCount] = useState(300);
    const [jobs, setJobs] = useState([]);
    const [contents, setContents] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [streamJobId, setStreamJobId] = useState(null);
    const [streamStatus, setStreamStatus] = useState(null);
    const eventSourceRef = useRef(null);

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const API_BASE = process.env.REACT_APP_API_URL || "";

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetch(`${API_BASE}/api/website-builder/sites/${siteId}/ai/jobs?limit=15`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json());
            setJobs(data.jobs || []);
        } catch { }
        setLoading(false);
    }, [siteId, token, API_BASE]);

    const fetchContents = useCallback(async () => {
        try {
            const data = await fetch(`${API_BASE}/api/website-builder/sites/${siteId}/ai/contents?isSaved=true&limit=20`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json());
            setContents(data.items || []);
        } catch { }
    }, [siteId, token, API_BASE]);

    useEffect(() => { fetchJobs(); fetchContents(); }, [fetchJobs, fetchContents]);

    const watchJobStream = useCallback((jobId) => {
        if (eventSourceRef.current) eventSourceRef.current.close();
        setStreamJobId(jobId);
        setStreamStatus("queued");

        const es = new EventSource(`${API_BASE}/api/website-builder/sites/${siteId}/ai/jobs/${jobId}/stream?token=${token}`);
        eventSourceRef.current = es;

        es.onmessage = (e) => {
            const data = JSON.parse(e.data);
            setStreamStatus(data.status);
            if (["completed", "failed", "cancelled"].includes(data.status)) {
                es.close();
                fetchJobs();
                setStreamJobId(null);
                if (data.status === "completed") setSuccess("İçerik üretildi! 🎉");
                if (data.status === "failed") setError("İçerik üretilemedi. Tekrar deneyin.");
            }
        };

        es.onerror = () => { es.close(); setStreamJobId(null); fetchJobs(); };
    }, [siteId, token, API_BASE, fetchJobs]);

    const handleSubmit = async () => {
        if (!prompt.trim()) { setError("Prompt girin"); return; }
        setSubmitting(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`${API_BASE}/api/website-builder/sites/${siteId}/ai/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ jobType, prompt, parameters: { tone, language, wordCount } }),
            }).then((r) => r.json());

            if (!res.success) throw new Error(res.error || "Hata");
            watchJobStream(res.job._id);
            fetchJobs();
        } catch (e) {
            setError(e.message || "İstek gönderilemedi");
        } finally {
            setSubmitting(false);
        }
    };

    const selectedType = JOB_TYPES.find((t) => t.value === jobType);

    const processingJobs = jobs.filter((j) => ["queued", "processing"].includes(j.status));
    const completedJobs = jobs.filter((j) => j.status === "completed");

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                <AutoAwesomeRounded color="primary" />
                <Typography variant="h6" fontWeight={700}>AI İçerik Stüdyosu</Typography>
                {processingJobs.length > 0 && (
                    <Chip label={`${processingJobs.length} aktif`} size="small" color="info" />
                )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Grid container spacing={3}>
                {/* Sol: Generator */}
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>İçerik Üret</Typography>

                        {/* Type Selector */}
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                            {JOB_TYPES.map((type) => (
                                <Chip
                                    key={type.value}
                                    icon={type.icon}
                                    label={type.label}
                                    size="small"
                                    variant={jobType === type.value ? "filled" : "outlined"}
                                    sx={{ cursor: "pointer", ...(jobType === type.value ? { bgcolor: type.color, color: "#fff", "& .MuiChip-icon": { color: "#fff" } } : {}) }}
                                    onClick={() => setJobType(type.value)}
                                />
                            ))}
                        </Box>

                        {selectedType && (
                            <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={selectedType.icon}>
                                <Typography variant="caption">{selectedType.desc}</Typography>
                            </Alert>
                        )}

                        <TextField
                            fullWidth multiline rows={4} label="Ne üretmek istiyorsunuz?"
                            placeholder={jobType === "blog_writer" ? "Organik tarım ürünlerinin sağlığa faydaları hakkında..." : jobType === "color_palette_generator" ? "Modern, minimalist ve güven veren bir teknoloji markası..." : "Açıklayın..."}
                            value={prompt} onChange={(e) => setPrompt(e.target.value)}
                            sx={{ mb: 2 }}
                        />

                        <Grid container spacing={1.5} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Ton</InputLabel>
                                    <Select label="Ton" value={tone} onChange={(e) => setTone(e.target.value)}>
                                        <MenuItem value="professional">Profesyonel</MenuItem>
                                        <MenuItem value="casual">Samimi</MenuItem>
                                        <MenuItem value="friendly">Sıcak</MenuItem>
                                        <MenuItem value="enthusiastic">Enerjik</MenuItem>
                                        <MenuItem value="formal">Resmi</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Dil</InputLabel>
                                    <Select label="Dil" value={language} onChange={(e) => setLanguage(e.target.value)}>
                                        <MenuItem value="tr">Türkçe</MenuItem>
                                        <MenuItem value="en">English</MenuItem>
                                        <MenuItem value="de">Deutsch</MenuItem>
                                        <MenuItem value="ar">العربية</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            {["blog_writer", "product_description", "category_description"].includes(jobType) && (
                                <Grid item xs={12}>
                                    <TextField fullWidth size="small" type="number" label="Kelime sayısı" value={wordCount} onChange={(e) => setWordCount(+e.target.value)} inputProps={{ min: 50, max: 2000 }} />
                                </Grid>
                            )}
                        </Grid>

                        <Button
                            fullWidth variant="contained" size="large"
                            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendRounded />}
                            onClick={handleSubmit} disabled={submitting || !prompt.trim()} disableElevation
                            sx={{ borderRadius: 2, py: 1.2 }}
                        >
                            {submitting ? "Gönderiliyor..." : "Üret"}
                        </Button>

                        {/* Stream status */}
                        {streamJobId && (
                            <Box sx={{ mt: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1, display: "flex", alignItems: "center", gap: 1 }}>
                                <CircularProgress size={16} />
                                <Typography variant="caption" color="text.secondary">
                                    {streamStatus === "queued" ? "Sırada bekleniyor..." : "AI içerik üretiyor..."}
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* Sağ: Jobs & Contents */}
                <Grid item xs={12} md={7}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
                        <Tab label={`Son İşler (${jobs.length})`} />
                        <Tab label={`Kayıtlı (${contents.length})`} />
                    </Tabs>

                    {tab === 0 && (
                        <Box>
                            {loading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>
                            ) : jobs.length === 0 ? (
                                <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
                                    <AutoAwesomeRounded sx={{ fontSize: 40, mb: 1 }} />
                                    <Typography variant="body2">Henüz içerik üretilmedi</Typography>
                                </Box>
                            ) : (
                                jobs.map((job) => <JobCard key={job._id} job={job} onRefresh={fetchJobs} />)
                            )}
                            {jobs.length > 0 && (
                                <Button startIcon={<RefreshRounded />} onClick={fetchJobs} size="small" sx={{ mt: 1 }}>Yenile</Button>
                            )}
                        </Box>
                    )}

                    {tab === 1 && (
                        <Box>
                            {contents.length === 0 ? (
                                <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
                                    <SaveRounded sx={{ fontSize: 40, mb: 1 }} />
                                    <Typography variant="body2">Kaydedilmiş içerik yok</Typography>
                                </Box>
                            ) : (
                                contents.map((item) => (
                                    <Card key={item._id} sx={{ mb: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                                        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                                            <Typography variant="body2" fontWeight={600} noWrap>{item.title || item.contentType}</Typography>
                                            <Typography variant="caption" color="text.secondary">{item.contentType} · {new Date(item.createdAt).toLocaleDateString("tr-TR")}</Typography>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </Box>
                    )}
                </Grid>
            </Grid>
        </Box>
    );
}
