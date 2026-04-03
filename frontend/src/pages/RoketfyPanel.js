/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ROKETFY PANEL V4 — BİREBİR ROKETFY KLONU ARAYÜZÜ
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Trendyol pazar istihbaratı paneli — Roketfy'ın birebir aynısı.
 * Trendyol'daki TÜM ürünleri analiz eder, en çok satanları gösterir.
 *
 * 6 Sekme (Roketfy ile aynı):
 *   1. Ürün Araştırması    — Trendyol'da arama, en çok satanlar, kategori filtre
 *   2. Rakip Araştırması   — Ürün URL veya kelime ile rakip analizi
 *   3. Listeleme Analisti  — Kendi ürünlerinin Roketfy skoru
 *   4. AI İçerik Yazarı    — SEO başlık/açıklama üretimi
 *   5. Yorum Analizi       — Trendyol yorumları NLP analizi
 *   6. Kelime & Fiyat      — Anahtar kelime araştırması + fiyat önerisi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from "react";
import {
    Box, Typography, Paper, Grid, Tabs, Tab, Button, TextField, Select,
    MenuItem, FormControl, InputLabel, Chip, LinearProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Card, CardContent, IconButton, Tooltip, CircularProgress, Divider,
    Accordion, AccordionSummary, AccordionDetails, Rating,
} from "@mui/material";
import {
    Search as SearchIcon,
    CompareArrows as CompareIcon,
    Assessment as AssessmentIcon,
    Create as CreateIcon,
    Reviews as ReviewsIcon,
    Key as KeyIcon,
    TrendingUp, TrendingDown, TrendingFlat,
    CheckCircle, Warning,
    ExpandMore, Refresh, ContentCopy,
    Star, LocalOffer, Inventory,
    AttachMoney, Speed, Category, Store,
    Favorite, Visibility, ShoppingCart,
} from "@mui/icons-material";
import API from "../services/api";

// ─── Renk Paleti ────────────────────────────────────────────────────────────
const C = {
    primary: "#ff6000",  // Trendyol turuncu
    secondary: "#0ea5e9",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    pink: "#ec4899",
    bg: "#f8fafc",
    cardBg: "#ffffff",
    border: "#e2e8f0",
    text: "#1e293b",
    textSec: "#64748b",
};

const scoreColor = (s) => s >= 80 ? C.success : s >= 60 ? C.secondary : s >= 40 ? C.warning : C.danger;
const gradeColor = (g) => !g ? C.textSec : g.startsWith("A") ? C.success : g.startsWith("B") ? C.secondary : g.startsWith("C") ? C.warning : C.danger;

// ─── Ortak Bileşenler ──────────────────────────────────────────────────────

const ScoreCircle = ({ score, size = 80, label }) => (
    <Box sx={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <CircularProgress variant="determinate" value={100} size={size} thickness={4} sx={{ color: "#e2e8f0" }} />
            <CircularProgress variant="determinate" value={score} size={size} thickness={4} sx={{ color: scoreColor(score), position: "absolute", left: 0 }} />
            <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: "absolute", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: scoreColor(score), fontSize: size * 0.25 }}>{score}</Typography>
            </Box>
        </Box>
        {label && <Typography variant="caption" sx={{ mt: 0.5, color: C.textSec, fontSize: 11 }}>{label}</Typography>}
    </Box>
);

const StatCard = ({ icon, title, value, subtitle, color = C.primary }) => (
    <Paper sx={{ p: 2, borderRadius: 3, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}15`, color }}>{icon}</Box>
        <Box>
            <Typography variant="caption" sx={{ color: C.textSec }}>{title}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{value}</Typography>
            {subtitle && <Typography variant="caption" sx={{ color: C.textSec }}>{subtitle}</Typography>}
        </Box>
    </Paper>
);

const PriorityChip = ({ priority }) => {
    const cfg = { critical: { color: "#ef4444", bg: "#fef2f2", label: "Kritik" }, high: { color: "#f59e0b", bg: "#fffbeb", label: "Yüksek" }, medium: { color: "#3b82f6", bg: "#eff6ff", label: "Orta" }, low: { color: "#10b981", bg: "#ecfdf5", label: "Düşük" } };
    const c = cfg[priority] || cfg.medium;
    return <Chip label={c.label} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, fontSize: 11 }} />;
};

const SentimentBar = ({ positive = 0, neutral = 0, negative = 0 }) => (
    <Box sx={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", width: "100%" }}>
        <Box sx={{ width: `${positive}%`, bgcolor: C.success }} />
        <Box sx={{ width: `${neutral}%`, bgcolor: C.warning }} />
        <Box sx={{ width: `${negative}%`, bgcolor: C.danger }} />
    </Box>
);

// Trendyol kategorileri
const CATEGORIES = [
    { key: "kadin", label: "👗 Kadın" },
    { key: "erkek", label: "👔 Erkek" },
    { key: "elektronik", label: "📱 Elektronik" },
    { key: "ev-mobilya", label: "🏠 Ev & Mobilya" },
    { key: "kozmetik", label: "💄 Kozmetik" },
    { key: "ayakkabi", label: "👟 Ayakkabı" },
    { key: "aksesuar", label: "👜 Aksesuar" },
    { key: "supermarket", label: "🛒 Süpermarket" },
    { key: "anne-bebek", label: "👶 Anne & Bebek" },
    { key: "spor-outdoor", label: "⚽ Spor & Outdoor" },
];

const SORT_OPTIONS = [
    { value: "BEST_SELLER", label: "En Çok Satanlar" },
    { value: "MOST_RATED", label: "En Çok Değerlendirilen" },
    { value: "PRICE_BY_ASC", label: "Fiyat: Düşükten Yükseğe" },
    { value: "PRICE_BY_DESC", label: "Fiyat: Yüksekten Düşüğe" },
    { value: "MOST_RECENT", label: "En Yeniler" },
];

// ═════════════════════════════════════════════════════════════════════════════
// ANA PANEL
// ═════════════════════════════════════════════════════════════════════════════

export default function RoketfyPanel() {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Ürün Araştırması state
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSort, setSelectedSort] = useState("BEST_SELLER");
    const [researchResult, setResearchResult] = useState(null);
    const [bestSellers, setBestSellers] = useState(null);

    // Rakip state
    const [compProductUrl, setCompProductUrl] = useState("");
    const [compSearchQuery, setCompSearchQuery] = useState("");
    const [compResult, setCompResult] = useState(null);

    // Listeleme state
    const [listingBarcode, setListingBarcode] = useState("");
    const [listingResult, setListingResult] = useState(null);
    const [bulkResult, setBulkResult] = useState(null);

    // İçerik state
    const [contentBarcode, setContentBarcode] = useState("");
    const [contentKeywords, setContentKeywords] = useState("");
    const [contentProductInfo, setContentProductInfo] = useState("");
    const [titleResult, setTitleResult] = useState(null);
    const [descResult, setDescResult] = useState(null);

    // Yorum state
    const [reviewInput, setReviewInput] = useState("");
    const [reviewResult, setReviewResult] = useState(null);

    // Anahtar kelime state
    const [kwSeed, setKwSeed] = useState("");
    const [kwResult, setKwResult] = useState(null);

    // Fiyat state
    const [priceBarcode, setPriceBarcode] = useState("");
    const [priceResult, setPriceResult] = useState(null);

    // ── API çağrısı ──
    const apiCall = async (method, url, data, setter) => {
        setLoading(true);
        setError("");
        try {
            const res = method === "get" ? await API.get(url) : await API.post(url, data);
            setter(res.data);
        } catch (err) {
            setError(err.response?.data?.message || "İşlem başarısız");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => { navigator.clipboard.writeText(text); };

    // İlk yüklemede en çok satanları getir
    useEffect(() => {
        if (!bestSellers) {
            API.get("/roketfy/research/best-sellers?limit=20")
                .then(res => setBestSellers(res.data.bestSellers))
                .catch(() => {});
        }
    }, [bestSellers]);

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 0: ÜRÜN ARAŞTIRMASI — Roketfy'ın ana özelliği
    // ═════════════════════════════════════════════════════════════════════════
    const renderProductResearch = () => (
        <Box>
            {/* Arama Formu */}
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3, background: `linear-gradient(135deg, ${C.primary}08 0%, #fff 100%)` }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.primary }}>🔍 Trendyol Ürün Araştırması</Typography>
                <Typography variant="body2" sx={{ color: C.textSec, mb: 2 }}>
                    Trendyol'daki tüm ürünleri analiz edin — en çok satanlar, fiyatlar, tahmini satış verileri
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth size="small" label="Arama Kelimesi" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)} placeholder="tişört, iphone kılıf, ayakkabı..."
                            onKeyDown={(e) => e.key === "Enter" && searchQuery && apiCall("post", "/roketfy/research/products", { query: searchQuery, sort: selectedSort }, setResearchResult)}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Kategori</InputLabel>
                            <Select value={selectedCategory} label="Kategori" onChange={(e) => setSelectedCategory(e.target.value)}>
                                <MenuItem value="">Tüm Kategoriler</MenuItem>
                                {CATEGORIES.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Sıralama</InputLabel>
                            <Select value={selectedSort} label="Sıralama" onChange={(e) => setSelectedSort(e.target.value)}>
                                {SORT_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button fullWidth variant="contained" startIcon={<SearchIcon />}
                            onClick={() => apiCall("post", "/roketfy/research/products", {
                                query: searchQuery, categoryName: selectedCategory, sort: selectedSort,
                            }, setResearchResult)}
                            disabled={(!searchQuery && !selectedCategory) || loading}
                            sx={{ bgcolor: C.primary, "&:hover": { bgcolor: "#e55500" }, height: 40 }}
                        >
                            Araştır
                        </Button>
                    </Grid>
                </Grid>

                {/* Kategori Kısa Yolları */}
                <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => (
                        <Chip key={cat.key} label={cat.label} clickable size="small"
                            onClick={() => { setSelectedCategory(cat.key); apiCall("post", "/roketfy/research/products", { categoryName: cat.key, sort: selectedSort }, setResearchResult); }}
                            sx={{ fontSize: 12, fontWeight: 600, bgcolor: selectedCategory === cat.key ? `${C.primary}20` : "transparent", color: selectedCategory === cat.key ? C.primary : C.text, border: `1px solid ${C.border}`, "&:hover": { bgcolor: `${C.primary}10` } }}
                        />
                    ))}
                </Box>
            </Paper>

            {/* En Çok Satanlar (varsayılan) */}
            {!researchResult && bestSellers?.products?.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>🏆 Trendyol En Çok Satanlar</Typography>
                    <ProductTable products={bestSellers.products} />
                </Paper>
            )}

            {/* Arama Sonuçları */}
            {researchResult?.research && (
                <Box>
                    {/* İstatistikler */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} md={3}><StatCard icon={<Category />} title="Toplam Ürün" value={(researchResult.research.totalResults || 0).toLocaleString("tr-TR")} color={C.primary} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<AttachMoney />} title="Ort. Fiyat" value={`₺${researchResult.research.marketStats?.avgPrice || 0}`} subtitle={`₺${researchResult.research.marketStats?.minPrice || 0} — ₺${researchResult.research.marketStats?.maxPrice || 0}`} color={C.success} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<Store />} title="Rekabet" value={({ very_high: "Çok Yüksek", high: "Yüksek", medium: "Orta", low: "Düşük", very_low: "Çok Düşük" })[researchResult.research.marketStats?.competitionLevel] || "—"} color={C.warning} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<TrendingUp />} title="Marka Sayısı" value={researchResult.research.topBrands?.length || 0} color={C.purple} /></Grid>
                    </Grid>

                    {/* Ürün Tablosu */}
                    <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                            📊 Ürün Sonuçları ({researchResult.research.topProducts?.length || 0} ürün)
                        </Typography>
                        <ProductTable products={researchResult.research.topProducts || []} />
                    </Paper>

                    {/* Marka Dağılımı */}
                    {researchResult.research.topBrands?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>🏷️ Marka Dağılımı</Typography>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                {researchResult.research.topBrands.map((b, i) => (
                                    <Chip key={i} label={`${b.name} (${b.count})`} size="small"
                                        sx={{ fontWeight: i < 3 ? 700 : 400, bgcolor: i < 3 ? `${C.primary}15` : "transparent", color: i < 3 ? C.primary : C.text, border: `1px solid ${C.border}` }}
                                    />
                                ))}
                            </Box>
                        </Paper>
                    )}
                </Box>
            )}
        </Box>
    );

    // ── Ürün Tablosu Bileşeni (Roketfy tarzı) ──
    const ProductTable = ({ products }) => (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>SIRA</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>ÜRÜN ADI</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>MARKA</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">FİYAT</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">FAVORİ</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">DEĞERLENDİRME</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">TAH. GÜNLÜK SATIŞ</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">TAH. AYLIK CİRO</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {products.map((p, i) => (
                        <TableRow key={i} sx={{ "&:hover": { bgcolor: `${C.primary}05` }, cursor: "pointer" }}
                            onClick={() => p.url && window.open(p.url, "_blank")}
                        >
                            <TableCell sx={{ fontWeight: 700, color: i < 3 ? C.primary : C.textSec, fontSize: 13 }}>{i + 1}</TableCell>
                            <TableCell sx={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    {p.imageUrl && <Box component="img" src={p.imageUrl} sx={{ width: 36, height: 36, borderRadius: 1, objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />}
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: i < 3 ? 600 : 400, fontSize: 12, lineHeight: 1.3 }}>{(p.name || "").slice(0, 70)}</Typography>
                                        {p.discountPercentage > 0 && <Chip label={`-%${p.discountPercentage}`} size="small" sx={{ fontSize: 9, height: 18, bgcolor: `${C.danger}15`, color: C.danger, fontWeight: 700 }} />}
                                    </Box>
                                </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: 11, color: C.textSec }}>{p.brand || "—"}</TableCell>
                            <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>₺{p.price}</Typography>
                                {p.originalPrice > p.price && <Typography variant="caption" sx={{ textDecoration: "line-through", color: C.textSec, fontSize: 10 }}>₺{p.originalPrice}</Typography>}
                            </TableCell>
                            <TableCell align="right">
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                                    <Favorite sx={{ fontSize: 14, color: C.pink }} />
                                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>{(p.favoriteCount || 0).toLocaleString("tr-TR")}</Typography>
                                </Box>
                            </TableCell>
                            <TableCell align="right">
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                                    <Star sx={{ fontSize: 14, color: C.warning }} />
                                    <Typography variant="body2" sx={{ fontSize: 12 }}>{p.ratingScore || 0}</Typography>
                                    <Typography variant="caption" sx={{ color: C.textSec, fontSize: 10 }}>({p.reviewCount || 0})</Typography>
                                </Box>
                            </TableCell>
                            <TableCell align="right">
                                <Chip label={p.estimatedDailySales || 0} size="small"
                                    sx={{ fontWeight: 700, fontSize: 12, bgcolor: p.estimatedDailySales > 10 ? `${C.success}15` : p.estimatedDailySales > 3 ? `${C.warning}15` : `${C.textSec}10`, color: p.estimatedDailySales > 10 ? C.success : p.estimatedDailySales > 3 ? C.warning : C.textSec }}
                                />
                            </TableCell>
                            <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 700, color: C.success, fontSize: 12 }}>
                                    ₺{(p.estimatedMonthlyRevenue || 0).toLocaleString("tr-TR")}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 1: RAKİP ARAŞTIRMASI
    // ═════════════════════════════════════════════════════════════════════════
    const renderCompetitorAnalysis = () => (
        <Box>
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.warning }}>⚔️ Trendyol Rakip Araştırması</Typography>
                <Typography variant="body2" sx={{ color: C.textSec, mb: 2 }}>
                    Trendyol ürün linki veya anahtar kelime girerek rakiplerinizi analiz edin
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={5}>
                        <TextField fullWidth size="small" label="Trendyol Ürün Linki (opsiyonel)" value={compProductUrl}
                            onChange={(e) => setCompProductUrl(e.target.value)} placeholder="https://www.trendyol.com/...p-123456"
                        />
                    </Grid>
                    <Grid item xs={12} md={5}>
                        <TextField fullWidth size="small" label="Arama Kelimesi" value={compSearchQuery}
                            onChange={(e) => setCompSearchQuery(e.target.value)} placeholder="tişört, spor ayakkabı..."
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button fullWidth variant="contained" startIcon={<CompareIcon />}
                            onClick={() => apiCall("post", "/roketfy/competitor/analyze", { productUrl: compProductUrl, searchQuery: compSearchQuery }, setCompResult)}
                            disabled={(!compProductUrl && !compSearchQuery) || loading}
                            sx={{ bgcolor: C.warning, color: "#fff", "&:hover": { bgcolor: "#d97706" }, height: 40 }}
                        >
                            Analiz Et
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {compResult?.competitor && (
                <Box>
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: 12 }}>📊 {compResult.competitor.dataSource}</Alert>

                    {/* Analiz edilen ürün */}
                    {compResult.competitor.analyzedProduct && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `2px solid ${C.primary}30`, mb: 3, bgcolor: `${C.primary}03` }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>🎯 Analiz Edilen Ürün</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{compResult.competitor.analyzedProduct.name}</Typography>
                            <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                                <Chip label={`₺${compResult.competitor.analyzedProduct.price}`} sx={{ fontWeight: 700 }} />
                                <Chip label={`⭐ ${compResult.competitor.analyzedProduct.ratingScore}`} size="small" />
                                <Chip label={`❤️ ${(compResult.competitor.analyzedProduct.favoriteCount || 0).toLocaleString("tr-TR")} favori`} size="small" />
                            </Box>
                        </Paper>
                    )}

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} md={3}><StatCard icon={<Store />} title="Toplam Rakip" value={compResult.competitor.totalCompetitors || 0} color={C.primary} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<AttachMoney />} title="Ort. Fiyat" value={`₺${compResult.competitor.priceAnalysis?.avgPrice || 0}`} color={C.success} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<TrendingDown />} title="Min Fiyat" value={`₺${compResult.competitor.priceAnalysis?.minPrice || 0}`} color={C.secondary} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<TrendingUp />} title="Max Fiyat" value={`₺${compResult.competitor.priceAnalysis?.maxPrice || 0}`} color={C.danger} /></Grid>
                    </Grid>

                    {/* Rakip Markalar */}
                    {compResult.competitor.topCompetitorBrands?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>🏷️ Rakip Markalar</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead><TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Marka</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Ürün Sayısı</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Ort. Fiyat</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Toplam Favori</TableCell>
                                    </TableRow></TableHead>
                                    <TableBody>
                                        {compResult.competitor.topCompetitorBrands.slice(0, 10).map((b, i) => (
                                            <TableRow key={i}>
                                                <TableCell sx={{ fontWeight: i < 3 ? 700 : 400 }}>{b.brand}</TableCell>
                                                <TableCell align="right">{b.productCount}</TableCell>
                                                <TableCell align="right">₺{b.avgPrice}</TableCell>
                                                <TableCell align="right">{(b.totalFavorites || 0).toLocaleString("tr-TR")}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {/* Rakip Ürünler */}
                    {compResult.competitor.productComparison?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>📋 Rakip Ürünler</Typography>
                            <ProductTable products={compResult.competitor.productComparison} />
                        </Paper>
                    )}

                    {/* Anahtar Kelimeler */}
                    {compResult.competitor.topKeywords?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>🔑 Rakiplerin Anahtar Kelimeleri</Typography>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                {compResult.competitor.topKeywords.map((k, i) => (
                                    <Chip key={i} label={`${k.keyword} (${k.count})`} size="small"
                                        sx={{ fontWeight: i < 5 ? 600 : 400, bgcolor: i < 5 ? `${C.primary}15` : "transparent", border: `1px solid ${C.border}` }}
                                    />
                                ))}
                            </Box>
                        </Paper>
                    )}

                    {/* İçgörüler */}
                    {compResult.competitor.insights?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>💡 İçgörüler</Typography>
                            {compResult.competitor.insights.map((ins, i) => (
                                <Alert key={i} severity="info" sx={{ mb: 1, borderRadius: 2, fontSize: 13 }}>{ins}</Alert>
                            ))}
                        </Paper>
                    )}
                </Box>
            )}
        </Box>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 2: LİSTELEME ANALİSTİ
    // ═════════════════════════════════════════════════════════════════════════
    const renderListingAnalyst = () => (
        <Box>
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.secondary }}>📊 Listeleme Analisti (Roketfy Skoru)</Typography>
                <Typography variant="body2" sx={{ color: C.textSec, mb: 2 }}>
                    Ürününüzü Trendyol'daki en iyi ürünlerle karşılaştırın — SEO, başlık, görsel, fiyat analizi
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <TextField size="small" label="Barkod" value={listingBarcode} onChange={(e) => setListingBarcode(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
                    <Button variant="contained" startIcon={<AssessmentIcon />}
                        onClick={() => apiCall("post", "/roketfy/listing/analyze", { barcode: listingBarcode }, setListingResult)}
                        disabled={!listingBarcode || loading} sx={{ bgcolor: C.secondary, "&:hover": { bgcolor: "#0284c7" } }}
                    >Analiz Et</Button>
                    <Button variant="outlined" startIcon={<Refresh />}
                        onClick={() => apiCall("post", "/roketfy/listing/analyze-all", {}, setBulkResult)}
                        disabled={loading} sx={{ borderColor: C.purple, color: C.purple }}
                    >Tümünü Analiz Et</Button>
                </Box>
            </Paper>

            {listingResult?.analysis && (
                <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
                        <ScoreCircle score={listingResult.analysis.overallScore} size={100} />
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: gradeColor(listingResult.analysis.grade) }}>{listingResult.analysis.grade}</Typography>
                            <Typography variant="body2" sx={{ color: C.textSec }}>Roketfy Listeleme Skoru</Typography>
                            <Typography variant="caption" sx={{ color: C.textSec }}>{listingResult.analysis.priceScore?.comparedWith || 0} Trendyol ürünüyle karşılaştırıldı</Typography>
                        </Box>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {[
                            { label: "Başlık", data: listingResult.analysis.titleScore, icon: "📝" },
                            { label: "Açıklama", data: listingResult.analysis.descriptionScore, icon: "📄" },
                            { label: "Görseller", data: listingResult.analysis.imageScore, icon: "🖼️" },
                            { label: "Fiyat", data: listingResult.analysis.priceScore, icon: "💰" },
                            { label: "Stok", data: listingResult.analysis.stockScore, icon: "📦" },
                        ].map((item, i) => (
                            <Grid item xs={6} md={4} key={i}>
                                <Card sx={{ border: `1px solid ${C.border}`, borderRadius: 2 }}>
                                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.icon} {item.label}</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: scoreColor(item.data?.score || 0) }}>{item.data?.score || 0}/100</Typography>
                                        </Box>
                                        <LinearProgress variant="determinate" value={item.data?.score || 0}
                                            sx={{ height: 6, borderRadius: 3, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: scoreColor(item.data?.score || 0), borderRadius: 3 } }}
                                        />
                                        {(item.data?.issues || []).map((issue, j) => (
                                            <Typography key={j} variant="caption" sx={{ display: "block", mt: 0.5, color: C.danger, fontSize: 10 }}>⚠ {issue}</Typography>
                                        ))}
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* SEO Analizi */}
                    {listingResult.analysis.seoAnalysis && (
                        <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.border}`, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>🔍 SEO Analizi — Trendyol Pazar Anahtar Kelimeleri</Typography>
                            {listingResult.analysis.seoAnalysis.matchedKeywords?.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="caption" sx={{ color: C.success, fontWeight: 600 }}>✅ Eşleşen:</Typography>
                                    {listingResult.analysis.seoAnalysis.matchedKeywords.map((kw, i) => <Chip key={i} label={kw} size="small" sx={{ ml: 0.5, fontSize: 10, bgcolor: `${C.success}15`, color: C.success }} />)}
                                </Box>
                            )}
                            {listingResult.analysis.seoAnalysis.missingKeywords?.length > 0 && (
                                <Box>
                                    <Typography variant="caption" sx={{ color: C.danger, fontWeight: 600 }}>❌ Eksik:</Typography>
                                    {listingResult.analysis.seoAnalysis.missingKeywords.map((kw, i) => <Chip key={i} label={kw} size="small" sx={{ ml: 0.5, fontSize: 10, bgcolor: `${C.danger}15`, color: C.danger }} />)}
                                </Box>
                            )}
                        </Paper>
                    )}

                    {/* Öneriler */}
                    {listingResult.analysis.recommendations?.length > 0 && (
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>💡 Öneriler</Typography>
                            {listingResult.analysis.recommendations.map((rec, i) => (
                                <Alert key={i} severity={rec.priority === "critical" ? "error" : rec.priority === "high" ? "warning" : "info"} sx={{ mb: 1, borderRadius: 2, fontSize: 13 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                        <PriorityChip priority={rec.priority} />
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{rec.message}</Typography>
                                    </Box>
                                    {rec.currentValue && <Typography variant="caption" sx={{ color: C.textSec }}>Mevcut: {rec.currentValue}</Typography>}
                                    {rec.suggestedValue && <Typography variant="caption" sx={{ display: "block", color: C.success }}>Öneri: {rec.suggestedValue}</Typography>}
                                </Alert>
                            ))}
                        </Box>
                    )}

                    {/* Pazar Karşılaştırma */}
                    {listingResult.analysis.marketComparison?.length > 0 && (
                        <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.border}`, mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>🏆 Trendyol'daki En İyi Rakipler</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead><TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Ürün</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Fiyat</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Rating</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Favori</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Tah. Satış/Gün</TableCell>
                                    </TableRow></TableHead>
                                    <TableBody>
                                        {listingResult.analysis.marketComparison.map((p, i) => (
                                            <TableRow key={i}>
                                                <TableCell sx={{ fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>₺{p.price}</TableCell>
                                                <TableCell align="right">⭐ {p.ratingScore}</TableCell>
                                                <TableCell align="right">{(p.favoriteCount || 0).toLocaleString("tr-TR")}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, color: C.success }}>{p.estimatedDailySales}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </Paper>
            )}

            {/* Toplu sonuç */}
            {bulkResult?.products && (
                <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}` }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                        <ScoreCircle score={bulkResult.averageScore} size={80} label="Ortalama" />
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{bulkResult.totalProducts} Ürün Analiz Edildi</Typography>
                            <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                                <Chip label={`${bulkResult.gradeDistribution?.excellent || 0} Mükemmel`} size="small" sx={{ bgcolor: `${C.success}15`, color: C.success, fontSize: 10 }} />
                                <Chip label={`${bulkResult.gradeDistribution?.good || 0} İyi`} size="small" sx={{ bgcolor: `${C.secondary}15`, color: C.secondary, fontSize: 10 }} />
                                <Chip label={`${bulkResult.gradeDistribution?.poor || 0} Zayıf`} size="small" sx={{ bgcolor: `${C.danger}15`, color: C.danger, fontSize: 10 }} />
                            </Box>
                        </Box>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead><TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Ürün</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Barkod</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600 }}>Skor</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600 }}>Not</TableCell>
                            </TableRow></TableHead>
                            <TableBody>
                                {bulkResult.products.slice(0, 30).map((p, i) => (
                                    <TableRow key={i} sx={{ bgcolor: p.score < 40 ? "#fef2f2" : "transparent" }}>
                                        <TableCell sx={{ fontSize: 12 }}>{p.name}</TableCell>
                                        <TableCell sx={{ fontSize: 11, fontFamily: "monospace" }}>{p.barcode}</TableCell>
                                        <TableCell align="center"><Chip label={p.score} size="small" sx={{ bgcolor: `${scoreColor(p.score)}20`, color: scoreColor(p.score), fontWeight: 700 }} /></TableCell>
                                        <TableCell align="center"><Typography sx={{ fontWeight: 800, color: gradeColor(p.grade) }}>{p.grade}</Typography></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Box>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 3: AI İÇERİK YAZARI
    // ═════════════════════════════════════════════════════════════════════════
    const renderContentWriter = () => (
        <Box>
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.purple }}>✍️ AI İçerik Yazarı</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Barkod (opsiyonel)" value={contentBarcode} onChange={(e) => setContentBarcode(e.target.value)} /></Grid>
                    <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Anahtar Kelimeler (virgülle)" value={contentKeywords} onChange={(e) => setContentKeywords(e.target.value)} placeholder="tişört, pamuklu, yazlık" /></Grid>
                    <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Ürün Bilgisi" value={contentProductInfo} onChange={(e) => setContentProductInfo(e.target.value)} placeholder="Erkek pamuklu tişört" /></Grid>
                    <Grid item xs={12}>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <Button variant="contained" startIcon={<CreateIcon />}
                                onClick={() => apiCall("post", "/roketfy/content/title", { barcode: contentBarcode, keywords: contentKeywords.split(",").map(s => s.trim()).filter(Boolean), productInfo: contentProductInfo }, setTitleResult)}
                                disabled={loading} sx={{ bgcolor: C.purple, "&:hover": { bgcolor: "#7c3aed" } }}
                            >Başlık Üret</Button>
                            <Button variant="contained" startIcon={<CreateIcon />}
                                onClick={() => apiCall("post", "/roketfy/content/description", { barcode: contentBarcode, keywords: contentKeywords.split(",").map(s => s.trim()).filter(Boolean), productInfo: contentProductInfo }, setDescResult)}
                                disabled={loading} sx={{ bgcolor: C.pink, "&:hover": { bgcolor: "#db2777" } }}
                            >Açıklama Üret</Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {titleResult?.content?.generatedTitles?.length > 0 && (
                <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>📝 Üretilen Başlıklar</Typography>
                    {titleResult.content.generatedTitles.map((t, i) => (
                        <Box key={i} sx={{ p: 2, mb: 1, borderRadius: 2, border: `1px solid ${C.border}`, bgcolor: i === 0 ? `${C.success}08` : "transparent" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>{t.title}</Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Chip label={`SEO: ${t.seoScore}`} size="small" sx={{ bgcolor: `${scoreColor(t.seoScore)}15`, color: scoreColor(t.seoScore), fontWeight: 600 }} />
                                    <Chip label={`${t.charCount} kar.`} size="small" variant="outlined" />
                                    {t.isReference && <Chip label="Referans" size="small" sx={{ bgcolor: `${C.warning}15`, color: C.warning, fontSize: 10 }} />}
                                    <IconButton size="small" onClick={() => copyToClipboard(t.title)}><ContentCopy fontSize="small" /></IconButton>
                                </Box>
                            </Box>
                        </Box>
                    ))}
                    {titleResult.content.marketKeywords?.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: C.textSec }}>📊 Trendyol Pazar Anahtar Kelimeleri:</Typography>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                                {titleResult.content.marketKeywords.map((k, i) => <Chip key={i} label={k.keyword} size="small" sx={{ fontSize: 10, bgcolor: `${C.primary}10` }} />)}
                            </Box>
                        </Box>
                    )}
                </Paper>
            )}

            {descResult?.content?.generatedDescriptions?.length > 0 && (
                <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>📄 Üretilen Açıklamalar</Typography>
                    {descResult.content.generatedDescriptions.map((d, i) => (
                        <Accordion key={i} defaultExpanded={i === 0} sx={{ border: `1px solid ${C.border}`, borderRadius: "8px !important", mb: 1, "&:before": { display: "none" } }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Varyasyon {i + 1}</Typography>
                                    <Chip label={`SEO: ${d.seoScore}`} size="small" sx={{ bgcolor: `${scoreColor(d.seoScore)}15`, color: scoreColor(d.seoScore), fontWeight: 600 }} />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8 }}>{d.description}</Box>
                                <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                                    <Button size="small" startIcon={<ContentCopy />} onClick={() => copyToClipboard(d.description)}>Kopyala</Button>
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Paper>
            )}
        </Box>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 4: YORUM ANALİZİ
    // ═════════════════════════════════════════════════════════════════════════
    const renderReviewAnalysis = () => (
        <Box>
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.pink }}>💬 Trendyol Yorum Analizi</Typography>
                <Typography variant="body2" sx={{ color: C.textSec, mb: 2 }}>
                    Trendyol ürün linki veya Content ID girerek yorumları NLP ile analiz edin
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField size="small" label="Trendyol Ürün Linki veya Content ID" value={reviewInput}
                        onChange={(e) => setReviewInput(e.target.value)} sx={{ flex: 1 }}
                        placeholder="https://www.trendyol.com/...p-123456 veya 123456"
                    />
                    <Button variant="contained" startIcon={<ReviewsIcon />}
                        onClick={() => {
                            const isUrl = reviewInput.includes("trendyol.com");
                            apiCall("post", "/roketfy/reviews/analyze", isUrl ? { productUrl: reviewInput } : { contentId: reviewInput }, setReviewResult);
                        }}
                        disabled={!reviewInput || loading} sx={{ bgcolor: C.pink, "&:hover": { bgcolor: "#db2777" } }}
                    >Analiz Et</Button>
                </Box>
            </Paper>

            {reviewResult?.reviews && (
                <Box>
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: 12 }}>📊 {reviewResult.reviews.dataSource}</Alert>

                    {reviewResult.reviews.productName && (
                        <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.border}`, mb: 2 }}>
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>{reviewResult.reviews.productName}</Typography>
                            <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                                {reviewResult.reviews.productBrand && <Chip label={reviewResult.reviews.productBrand} size="small" />}
                                {reviewResult.reviews.productPrice > 0 && <Chip label={`₺${reviewResult.reviews.productPrice}`} size="small" sx={{ fontWeight: 600 }} />}
                            </Box>
                        </Paper>
                    )}

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} md={3}>
                            <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, textAlign: "center" }}>
                                <Typography variant="h3" sx={{ fontWeight: 800, color: C.warning }}>{reviewResult.reviews.averageRating}</Typography>
                                <Rating value={reviewResult.reviews.averageRating} precision={0.1} readOnly size="small" />
                                <Typography variant="caption" sx={{ display: "block", color: C.textSec }}>{reviewResult.reviews.totalReviews} değerlendirme</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Duygu Dağılımı</Typography>
                                <SentimentBar {...reviewResult.reviews.sentimentBreakdown} />
                                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                                    <Typography variant="caption" sx={{ color: C.success }}>😊 %{reviewResult.reviews.sentimentBreakdown?.positive}</Typography>
                                    <Typography variant="caption" sx={{ color: C.warning }}>😐 %{reviewResult.reviews.sentimentBreakdown?.neutral}</Typography>
                                    <Typography variant="caption" sx={{ color: C.danger }}>😞 %{reviewResult.reviews.sentimentBreakdown?.negative}</Typography>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: C.success }}>💪 Güçlü</Typography>
                                {(reviewResult.reviews.strengths || []).map((s, i) => <Typography key={i} variant="caption" sx={{ display: "block", mb: 0.3 }}>✅ {s}</Typography>)}
                                {(reviewResult.reviews.strengths || []).length === 0 && <Typography variant="caption" sx={{ color: C.textSec }}>Veri yetersiz</Typography>}
                            </Paper>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: C.danger }}>⚠️ Zayıf</Typography>
                                {(reviewResult.reviews.weaknesses || []).map((w, i) => <Typography key={i} variant="caption" sx={{ display: "block", mb: 0.3 }}>❌ {w}</Typography>)}
                                {(reviewResult.reviews.weaknesses || []).length === 0 && <Typography variant="caption" sx={{ color: C.textSec }}>Sorun yok</Typography>}
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Konu Analizi */}
                    {reviewResult.reviews.topicAnalysis?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>📊 Konu Bazlı Analiz</Typography>
                            {reviewResult.reviews.topicAnalysis.map((topic, i) => (
                                <Box key={i} sx={{ mb: 2, p: 2, borderRadius: 2, border: `1px solid ${C.border}` }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{topic.topic}</Typography>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <Chip label={topic.sentiment === "positive" ? "Pozitif" : topic.sentiment === "negative" ? "Negatif" : "Karışık"} size="small"
                                                sx={{ bgcolor: topic.sentiment === "positive" ? `${C.success}15` : topic.sentiment === "negative" ? `${C.danger}15` : `${C.warning}15`, color: topic.sentiment === "positive" ? C.success : topic.sentiment === "negative" ? C.danger : C.warning, fontWeight: 600, fontSize: 10 }}
                                            />
                                            <Chip label={`${topic.mentionCount} bahsetme`} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                                        </Box>
                                    </Box>
                                    <LinearProgress variant="determinate" value={topic.percentage}
                                        sx={{ height: 6, borderRadius: 3, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: topic.sentiment === "positive" ? C.success : topic.sentiment === "negative" ? C.danger : C.warning } }}
                                    />
                                    {(topic.sampleReviews || []).map((rev, j) => (
                                        <Typography key={j} variant="caption" sx={{ display: "block", mt: 0.5, color: C.textSec, fontStyle: "italic" }}>"{rev}"</Typography>
                                    ))}
                                </Box>
                            ))}
                        </Paper>
                    )}

                    {/* Son Yorumlar */}
                    {reviewResult.reviews.recentReviews?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>💬 Son Yorumlar ({reviewResult.reviews.recentReviews.length})</Typography>
                            {reviewResult.reviews.recentReviews.slice(0, 10).map((r, i) => (
                                <Box key={i} sx={{ mb: 1.5, p: 1.5, borderRadius: 2, border: `1px solid ${C.border}`, bgcolor: r.sentiment === "negative" ? `${C.danger}05` : r.sentiment === "positive" ? `${C.success}05` : "transparent" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{r.userName}</Typography>
                                            <Rating value={r.rate} readOnly size="small" />
                                        </Box>
                                        <Chip label={r.sentiment === "positive" ? "😊 Pozitif" : r.sentiment === "negative" ? "😞 Negatif" : "😐 Nötr"} size="small"
                                            sx={{ fontSize: 10, bgcolor: r.sentiment === "positive" ? `${C.success}15` : r.sentiment === "negative" ? `${C.danger}15` : `${C.warning}15`, color: r.sentiment === "positive" ? C.success : r.sentiment === "negative" ? C.danger : C.warning }}
                                        />
                                    </Box>
                                    <Typography variant="body2" sx={{ fontSize: 12 }}>{r.comment}</Typography>
                                </Box>
                            ))}
                        </Paper>
                    )}

                    {/* AI Özet */}
                    {reviewResult.reviews.aiSummary && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `2px solid ${C.primary}30`, bgcolor: `${C.primary}05` }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>🤖 AI Özet</Typography>
                            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>{reviewResult.reviews.aiSummary}</Typography>
                        </Paper>
                    )}
                </Box>
            )}
        </Box>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // TAB 5: ANAHTAR KELİME & FİYAT
    // ═════════════════════════════════════════════════════════════════════════
    const renderKeywordsAndPrice = () => (
        <Box>
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.primary }}>🔑 Trendyol Anahtar Kelime Araştırması</Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField size="small" label="Anahtar Kelime" value={kwSeed} onChange={(e) => setKwSeed(e.target.value)} sx={{ flex: 1 }} placeholder="tişört, ayakkabı, telefon kılıfı..."
                        onKeyDown={(e) => e.key === "Enter" && kwSeed && apiCall("post", "/roketfy/research/keywords", { seedKeyword: kwSeed }, setKwResult)}
                    />
                    <Button variant="contained" startIcon={<KeyIcon />}
                        onClick={() => apiCall("post", "/roketfy/research/keywords", { seedKeyword: kwSeed }, setKwResult)}
                        disabled={!kwSeed || loading} sx={{ bgcolor: C.primary, "&:hover": { bgcolor: "#e55500" } }}
                    >Araştır</Button>
                </Box>
            </Paper>

            {kwResult?.keywords && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} md={3}><StatCard icon={<Category />} title="Toplam Ürün" value={(kwResult.keywords.totalMarketProducts || 0).toLocaleString("tr-TR")} color={C.primary} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<AttachMoney />} title="Ort. Fiyat" value={`₺${kwResult.keywords.priceStats?.avg || 0}`} color={C.success} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<TrendingDown />} title="Min Fiyat" value={`₺${kwResult.keywords.priceStats?.min || 0}`} color={C.secondary} /></Grid>
                        <Grid item xs={6} md={3}><StatCard icon={<TrendingUp />} title="Max Fiyat" value={`₺${kwResult.keywords.priceStats?.max || 0}`} color={C.danger} /></Grid>
                    </Grid>

                    {kwResult.keywords.keywords?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>📊 Anahtar Kelime Sonuçları</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead><TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Anahtar Kelime</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Ürün Sayısı</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 600 }}>Rekabet</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 600 }}>Uygunluk</TableCell>
                                    </TableRow></TableHead>
                                    <TableBody>
                                        {kwResult.keywords.keywords.slice(0, 25).map((kw, i) => (
                                            <TableRow key={i} sx={{ bgcolor: i === 0 ? `${C.success}08` : "transparent" }}>
                                                <TableCell sx={{ fontWeight: i < 3 ? 600 : 400 }}>{kw.keyword}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>{(kw.searchVolume || 0).toLocaleString("tr-TR")}</TableCell>
                                                <TableCell align="center">
                                                    <Chip label={kw.competition === "low" ? "Düşük" : kw.competition === "high" ? "Yüksek" : kw.competition === "very_high" ? "Çok Yüksek" : "Orta"} size="small"
                                                        sx={{ bgcolor: kw.competition === "low" ? `${C.success}15` : kw.competition === "high" || kw.competition === "very_high" ? `${C.danger}15` : `${C.warning}15`, color: kw.competition === "low" ? C.success : kw.competition === "high" || kw.competition === "very_high" ? C.danger : C.warning, fontWeight: 600, fontSize: 10 }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center"><Chip label={kw.relevanceScore} size="small" sx={{ bgcolor: `${scoreColor(kw.relevanceScore)}15`, color: scoreColor(kw.relevanceScore), fontWeight: 600 }} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {kwResult.keywords.topBrands?.length > 0 && (
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${C.border}` }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>🏷️ Bu Kelimede En Popüler Markalar</Typography>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                {kwResult.keywords.topBrands.map((b, i) => (
                                    <Chip key={i} label={`${b.name} (%${b.percentage})`} size="small"
                                        sx={{ fontWeight: i < 3 ? 700 : 400, bgcolor: i < 3 ? `${C.primary}15` : "transparent", border: `1px solid ${C.border}` }}
                                    />
                                ))}
                            </Box>
                        </Paper>
                    )}
                </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Fiyat Önerisi */}
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${C.border}`, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: C.success }}>💰 Trendyol Fiyat Önerisi</Typography>
                <Typography variant="body2" sx={{ color: C.textSec, mb: 2 }}>Ürününüzü Trendyol pazar fiyatlarıyla karşılaştırın</Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField size="small" label="Barkod" value={priceBarcode} onChange={(e) => setPriceBarcode(e.target.value)} sx={{ flex: 1 }} />
                    <Button variant="contained" startIcon={<LocalOffer />}
                        onClick={() => apiCall("post", "/roketfy/price/suggest", { barcode: priceBarcode }, setPriceResult)}
                        disabled={!priceBarcode || loading} sx={{ bgcolor: C.success, "&:hover": { bgcolor: "#059669" } }}
                    >Fiyat Öner</Button>
                </Box>
            </Paper>

            {priceResult?.pricing && (
                <Paper sx={{ p: 3, borderRadius: 3, border: `2px solid ${C.success}30`, bgcolor: `${C.success}05` }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4} sx={{ textAlign: "center" }}>
                            <Typography variant="caption" sx={{ color: C.textSec }}>Mevcut Fiyat</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 800 }}>₺{priceResult.pricing.currentPrice}</Typography>
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ textAlign: "center" }}>
                            <Typography variant="caption" sx={{ color: C.success, fontWeight: 600 }}>Önerilen Fiyat</Typography>
                            <Typography variant="h3" sx={{ fontWeight: 800, color: C.success }}>₺{priceResult.pricing.suggestedPrice}</Typography>
                            {priceResult.pricing.profitMargin != null && <Chip label={`Kâr: %${priceResult.pricing.profitMargin}`} size="small" sx={{ mt: 0.5, fontWeight: 600, bgcolor: `${C.success}15`, color: C.success }} />}
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ textAlign: "center" }}>
                            <Typography variant="caption" sx={{ color: C.textSec }}>Trendyol Ortalaması</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: C.purple }}>₺{priceResult.pricing.marketAvgPrice}</Typography>
                            <Typography variant="caption" sx={{ color: C.textSec }}>{priceResult.pricing.analyzedProductCount} rakip</Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
                                <Chip label={`Min: ₺${priceResult.pricing.minPrice}`} sx={{ fontWeight: 600 }} />
                                <Chip label={`Medyan: ₺${priceResult.pricing.medianPrice}`} sx={{ fontWeight: 600 }} />
                                <Chip label={`Max: ₺${priceResult.pricing.maxPrice}`} sx={{ fontWeight: 600 }} />
                            </Box>
                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                <Typography variant="body2" sx={{ lineHeight: 1.8 }}>{priceResult.pricing.reasoning}</Typography>
                            </Alert>
                        </Grid>
                    </Grid>

                    {priceResult.pricing.competitorPrices?.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>🏷️ Trendyol Rakip Fiyatları</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead><TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Ürün</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Marka</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Fiyat</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>Rating</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 600 }}>Fark</TableCell>
                                    </TableRow></TableHead>
                                    <TableBody>
                                        {priceResult.pricing.competitorPrices.map((cp, i) => {
                                            const diff = priceResult.pricing.currentPrice > 0 ? Math.round(((cp.price - priceResult.pricing.currentPrice) / priceResult.pricing.currentPrice) * 100) : 0;
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell sx={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.productName}</TableCell>
                                                    <TableCell sx={{ fontSize: 12 }}>{cp.sellerName}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 600 }}>₺{cp.price}</TableCell>
                                                    <TableCell align="right">⭐ {cp.ratingScore || "—"}</TableCell>
                                                    <TableCell align="center">
                                                        <Chip label={`${diff > 0 ? "+" : ""}${diff}%`} size="small" sx={{ bgcolor: diff > 0 ? `${C.danger}15` : diff < 0 ? `${C.success}15` : `${C.warning}15`, color: diff > 0 ? C.danger : diff < 0 ? C.success : C.warning, fontWeight: 600, fontSize: 10 }} />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    );

    // ═════════════════════════════════════════════════════════════════════════
    // ANA RENDER
    // ═════════════════════════════════════════════════════════════════════════
    const tabConfig = [
        { label: "Ürün Araştırması", icon: <SearchIcon /> },
        { label: "Rakip Araştırması", icon: <CompareIcon /> },
        { label: "Listeleme Analisti", icon: <AssessmentIcon /> },
        { label: "AI İçerik Yazarı", icon: <CreateIcon /> },
        { label: "Yorum Analizi", icon: <ReviewsIcon /> },
        { label: "Kelime & Fiyat", icon: <KeyIcon /> },
    ];

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: C.bg, p: { xs: 1, md: 3 } }}>
            {/* Header */}
            <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, background: `linear-gradient(135deg, ${C.primary} 0%, #ff8c00 100%)`, color: "#fff" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>🚀 Trendyol Pazar İstihbaratı</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>Trendyol'daki tüm ürünleri analiz edin — en çok satanlar, fiyatlar, rakipler, yorumlar</Typography>
                    </Box>
                </Box>
            </Paper>

            {loading && <LinearProgress sx={{ mb: 2, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: C.primary } }} />}
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Paper sx={{ mb: 3, borderRadius: 3, border: `1px solid ${C.border}` }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
                    sx={{
                        "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13, minHeight: 56 },
                        "& .Mui-selected": { color: C.primary },
                        "& .MuiTabs-indicator": { bgcolor: C.primary, height: 3, borderRadius: 2 },
                    }}
                >
                    {tabConfig.map((tab, i) => <Tab key={i} label={tab.label} icon={tab.icon} iconPosition="start" />)}
                </Tabs>
            </Paper>

            <Box>
                {activeTab === 0 && renderProductResearch()}
                {activeTab === 1 && renderCompetitorAnalysis()}
                {activeTab === 2 && renderListingAnalyst()}
                {activeTab === 3 && renderContentWriter()}
                {activeTab === 4 && renderReviewAnalysis()}
                {activeTab === 5 && renderKeywordsAndPrice()}
            </Box>
        </Box>
    );
}
