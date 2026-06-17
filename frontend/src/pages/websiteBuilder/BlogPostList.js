import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Box, Typography, Button, Card, CardContent, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Paper, IconButton,
    Menu, MenuItem, TextField, Select, FormControl, InputLabel, Alert,
    CircularProgress, Divider, Avatar, Tooltip, Pagination,
} from "@mui/material";
import {
    AddRounded, MoreVertRounded, EditRounded, DeleteRounded, VisibilityRounded,
    SearchRounded, FilterListRounded, ArticleRounded,
} from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";

const STATUS_CONFIG = {
    draft: { label: "Taslak", color: "default" },
    published: { label: "Yayında", color: "success" },
    archived: { label: "Arşiv", color: "warning" },
    scheduled: { label: "Zamanlanmış", color: "info" },
};

function PostRow({ post, onEdit, onDelete, onStatusChange }) {
    const [menuAnchor, setMenuAnchor] = useState(null);
    const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;

    const readingMinutes = post.readingTimeMinutes || 1;

    return (
        <TableRow hover>
            <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    {post.thumbnailUrl ? (
                        <Box component="img" src={post.thumbnailUrl} alt="" sx={{ width: 56, height: 40, borderRadius: 1, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                        <Box sx={{ width: 56, height: 40, borderRadius: 1, bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <ArticleRounded sx={{ fontSize: 20, color: "text.disabled" }} />
                        </Box>
                    )}
                    <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>{post.title}</Typography>
                        <Typography variant="caption" color="text.secondary">/blog/{post.slug}</Typography>
                    </Box>
                </Box>
            </TableCell>
            <TableCell>
                {post.categoryId ? (
                    <Chip label={post.categoryId.name || "Kategori"} size="small" variant="outlined" />
                ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                )}
            </TableCell>
            <TableCell>
                <Chip label={status.label} color={status.color} size="small" />
            </TableCell>
            <TableCell>
                <Typography variant="caption" color="text.secondary">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("tr-TR") : "—"}
                </Typography>
            </TableCell>
            <TableCell>
                <Typography variant="caption" color="text.secondary">{readingMinutes} dk</Typography>
            </TableCell>
            <TableCell align="right">
                <Tooltip title="Düzenle">
                    <IconButton size="small" onClick={() => onEdit(post._id)}>
                        <EditRounded fontSize="small" />
                    </IconButton>
                </Tooltip>
                <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                    <MoreVertRounded fontSize="small" />
                </IconButton>
                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                    {post.status !== "published" && (
                        <MenuItem onClick={() => { setMenuAnchor(null); onStatusChange(post._id, "published"); }}>
                            Yayınla
                        </MenuItem>
                    )}
                    {post.status === "published" && (
                        <MenuItem onClick={() => { setMenuAnchor(null); onStatusChange(post._id, "draft"); }}>
                            Taslağa Al
                        </MenuItem>
                    )}
                    <Divider />
                    <MenuItem sx={{ color: "error.main" }} onClick={() => { setMenuAnchor(null); onDelete(post); }}>
                        <DeleteRounded fontSize="small" sx={{ mr: 1 }} /> Sil
                    </MenuItem>
                </Menu>
            </TableCell>
        </TableRow>
    );
}

export default function BlogPostList({ siteId: siteIdProp }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [filters, setFilters] = useState({ search: "", status: "", categoryId: "" });
    const LIMIT = 15;

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: LIMIT };
            if (filters.status) params.status = filters.status;
            if (filters.categoryId) params.categoryId = filters.categoryId;
            const data = await wbApi.getBlogPosts(siteId, params);
            let filtered = data.posts || [];
            if (filters.search) {
                const q = filters.search.toLowerCase();
                filtered = filtered.filter((p) => p.title.toLowerCase().includes(q) || p.slug.includes(q));
            }
            setPosts(filtered);
            setTotal(data.total || 0);
        } catch (e) {
            setError(e.response?.data?.error || "Yazılar yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId, page, filters]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    useEffect(() => {
        wbApi.getBlogCategories(siteId).then((d) => setCategories(d.categories || [])).catch(() => {});
    }, [siteId]);

    const handleDelete = async (post) => {
        if (!window.confirm(`"${post.title}" yazısını silmek istediğinizden emin misiniz?`)) return;
        try {
            await wbApi.deleteBlogPost(siteId, post._id);
            fetchPosts();
        } catch { setError("Silinemedi"); }
    };

    const handleStatusChange = async (postId, status) => {
        try {
            await wbApi.updateBlogPost(siteId, postId, { status, ...(status === "published" ? { publishedAt: new Date().toISOString() } : {}) });
            fetchPosts();
        } catch { setError("Durum güncellenemedi"); }
    };

    const publishedCount = posts.filter((p) => p.status === "published").length;
    const draftCount = posts.filter((p) => p.status === "draft").length;

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box>
                    <Typography variant="h6" fontWeight={700}>Blog Yazıları</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {total} yazı · {publishedCount} yayında · {draftCount} taslak
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate(`/website-builder/${siteId}/blog/new`)} disableElevation sx={{ borderRadius: 2 }}>
                    Yeni Yazı
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                    <TextField
                        size="small" placeholder="Yazı ara..."
                        value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        InputProps={{ startAdornment: <SearchRounded sx={{ fontSize: 18, mr: 0.5, color: "text.disabled" }} /> }}
                        sx={{ flex: 1, minWidth: 200 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>Durum</InputLabel>
                        <Select label="Durum" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                            <MenuItem value="">Tümü</MenuItem>
                            <MenuItem value="draft">Taslak</MenuItem>
                            <MenuItem value="published">Yayında</MenuItem>
                            <MenuItem value="archived">Arşiv</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Kategori</InputLabel>
                        <Select label="Kategori" value={filters.categoryId} onChange={(e) => { setFilters((f) => ({ ...f, categoryId: e.target.value })); setPage(1); }}>
                            <MenuItem value="">Tümü</MenuItem>
                            {categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>
            </Paper>

            {/* Table */}
            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Yazı</TableCell>
                            <TableCell>Kategori</TableCell>
                            <TableCell>Durum</TableCell>
                            <TableCell>Tarih</TableCell>
                            <TableCell>Okuma</TableCell>
                            <TableCell align="right">İşlem</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
                        ) : posts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                    <ArticleRounded sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                                    <Typography color="text.secondary" variant="body2">Henüz blog yazısı yok</Typography>
                                    <Button sx={{ mt: 1 }} size="small" onClick={() => navigate(`/website-builder/${siteId}/blog/new`)}>İlk yazıyı oluştur</Button>
                                </TableCell>
                            </TableRow>
                        ) : (
                            posts.map((post) => (
                                <PostRow key={post._id} post={post}
                                    onEdit={(id) => navigate(`/website-builder/${siteId}/blog/${id}`)}
                                    onDelete={handleDelete}
                                    onStatusChange={handleStatusChange}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {total > LIMIT && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                    <Pagination count={Math.ceil(total / LIMIT)} page={page} onChange={(_, v) => setPage(v)} color="primary" />
                </Box>
            )}
        </Box>
    );
}
