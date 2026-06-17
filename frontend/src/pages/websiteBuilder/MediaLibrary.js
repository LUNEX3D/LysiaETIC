import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Grid, Card, Typography, Button, IconButton, Chip, TextField,
    Alert, CircularProgress, Tooltip, Menu, MenuItem, Dialog, DialogTitle,
    DialogContent, DialogActions, LinearProgress, Tabs, Tab, Paper,
    FormControl, InputLabel, Select,
} from "@mui/material";
import {
    UploadFileRounded, DeleteRounded, ContentCopyRounded, ImageRounded,
    VideoFileRounded, InsertDriveFileRounded, SearchRounded, GridViewRounded,
    TableRowsRounded, MoreVertRounded, FolderRounded,
} from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";

const TYPE_ICONS = {
    image: <ImageRounded />,
    video: <VideoFileRounded />,
    document: <InsertDriveFileRounded />,
    other: <InsertDriveFileRounded />,
};

function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaCard({ item, onDelete, onCopyUrl, isSelected, onSelect, viewMode }) {
    const [menuAnchor, setMenuAnchor] = useState(null);

    if (viewMode === "list") {
        return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 1.5, borderRadius: 1, border: "1px solid", borderColor: isSelected ? "primary.main" : "divider", cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, mb: 0.5 }}
                onClick={() => onSelect(item)}>
                <Box sx={{ width: 48, height: 40, borderRadius: 1, overflow: "hidden", flexShrink: 0, bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {item.type === "image" ? <Box component="img" src={item.thumbnailUrl || item.url} alt={item.altText} sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : TYPE_ICONS[item.type]}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>{item.originalName || item.fileName}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatBytes(item.size)} · {item.type}</Typography>
                </Box>
                <Tooltip title="URL Kopyala">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onCopyUrl(item.url); }}>
                        <ContentCopyRounded fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Sil">
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
                        <DeleteRounded fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        );
    }

    return (
        <Card
            sx={{ cursor: "pointer", border: "2px solid", borderColor: isSelected ? "primary.main" : "transparent", borderRadius: 2, transition: "all 0.15s", "&:hover": { borderColor: "primary.light", boxShadow: 2 } }}
            onClick={() => onSelect(item)}
        >
            <Box sx={{ position: "relative", paddingBottom: "66%", bgcolor: "action.hover", borderRadius: "6px 6px 0 0", overflow: "hidden" }}>
                {item.type === "image" ? (
                    <Box component="img" src={item.thumbnailUrl || item.url} alt={item.altText || ""} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                        {TYPE_ICONS[item.type]}
                    </Box>
                )}
                <Box sx={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 0.5, opacity: 0, transition: "opacity 0.15s", ".MuiCard-root:hover &": { opacity: 1 } }}>
                    <Tooltip title="URL Kopyala">
                        <IconButton size="small" sx={{ bgcolor: "rgba(0,0,0,0.5)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); onCopyUrl(item.url); }}>
                            <ContentCopyRounded style={{ fontSize: 14 }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Sil">
                        <IconButton size="small" sx={{ bgcolor: "rgba(220,38,38,0.8)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
                            <DeleteRounded style={{ fontSize: 14 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            <Box sx={{ p: 1 }}>
                <Typography variant="caption" fontWeight={500} display="block" noWrap>{item.originalName || item.fileName}</Typography>
                <Typography variant="caption" color="text.secondary">{formatBytes(item.size)}</Typography>
            </Box>
        </Card>
    );
}

export default function MediaLibrary({ onSelect: onSelectProp, selectable = false }) {
    const { siteId } = useParams();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [viewMode, setViewMode] = useState("grid");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [selected, setSelected] = useState(null);
    const fileInputRef = useRef(null);
    const LIMIT = 40;

    const fetchMedia = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: LIMIT };
            if (typeFilter) params.type = typeFilter;
            const data = await wbApi.getMedia(siteId, params);
            let filtered = data.items || [];
            if (search) filtered = filtered.filter((i) => (i.originalName || i.fileName).toLowerCase().includes(search.toLowerCase()));
            setItems(filtered);
            setTotal(data.total || 0);
        } catch (e) {
            setError("Medya yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId, page, typeFilter, search]);

    useEffect(() => { fetchMedia(); }, [fetchMedia]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploading(true);
        setError("");
        let uploadedCount = 0;
        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append("file", file);
                await wbApi.uploadMedia(siteId, formData, (p) => setUploadProgress(p));
                uploadedCount++;
            } catch (err) {
                setError(`"${file.name}" yüklenemedi: ${err.response?.data?.error || err.message}`);
            }
        }
        setUploading(false);
        setUploadProgress(0);
        if (uploadedCount > 0) {
            setSuccess(`${uploadedCount} dosya yüklendi`);
            fetchMedia();
        }
        e.target.value = "";
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`"${item.originalName || item.fileName}" silinsin mi?`)) return;
        try {
            await wbApi.deleteMedia(siteId, item._id);
            fetchMedia();
        } catch { setError("Silinemedi"); }
    };

    const handleCopyUrl = (url) => {
        navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
        setSuccess("URL kopyalandı!");
        setTimeout(() => setSuccess(""), 2000);
    };

    const handleSelect = (item) => {
        setSelected(item._id === selected?._id ? null : item);
        if (onSelectProp && item._id !== selected?._id) onSelectProp(item);
    };

    const imageCount = items.filter((i) => i.type === "image").length;
    const totalSizeMb = (items.reduce((acc, i) => acc + (i.size || 0), 0) / (1024 * 1024)).toFixed(1);

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={700}>Medya Kütüphanesi</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {total} dosya · {imageCount} görsel · {totalSizeMb} MB
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                    <input type="file" ref={fileInputRef} multiple accept="image/*,video/mp4,application/pdf" style={{ display: "none" }} onChange={handleUpload} />
                    <Button variant="contained" startIcon={<UploadFileRounded />} onClick={() => fileInputRef.current?.click()} disabled={uploading} disableElevation>
                        {uploading ? "Yükleniyor..." : "Yükle"}
                    </Button>
                </Box>
            </Box>

            {uploading && <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 1, borderRadius: 1 }} />}
            {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSuccess("")}>{success}</Alert>}

            {/* Filters */}
            <Box sx={{ display: "flex", gap: 1.5, mb: 2, alignItems: "center" }}>
                <TextField size="small" placeholder="Dosya ara..." value={search} onChange={(e) => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <SearchRounded sx={{ fontSize: 18, mr: 0.5, color: "text.disabled" }} /> }}
                    sx={{ flex: 1 }} />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select value={typeFilter} displayEmpty onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                        <MenuItem value="">Tümü</MenuItem>
                        <MenuItem value="image">Görseller</MenuItem>
                        <MenuItem value="video">Videolar</MenuItem>
                        <MenuItem value="document">Belgeler</MenuItem>
                    </Select>
                </FormControl>
                <Box sx={{ display: "flex", gap: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <IconButton size="small" onClick={() => setViewMode("grid")} color={viewMode === "grid" ? "primary" : "default"}><GridViewRounded fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setViewMode("list")} color={viewMode === "list" ? "primary" : "default"}><TableRowsRounded fontSize="small" /></IconButton>
                </Box>
            </Box>

            {/* Content */}
            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
            ) : items.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8, border: "2px dashed", borderColor: "divider", borderRadius: 2 }}>
                    <ImageRounded sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
                    <Typography color="text.secondary" variant="body2">Medya kütüphanesi boş</Typography>
                    <Button sx={{ mt: 1 }} size="small" onClick={() => fileInputRef.current?.click()}>İlk dosyayı yükle</Button>
                </Box>
            ) : viewMode === "grid" ? (
                <Grid container spacing={1.5} sx={{ flex: 1, overflowY: "auto" }}>
                    {items.map((item) => (
                        <Grid item xs={6} sm={4} md={3} lg={2} key={item._id}>
                            <MediaCard item={item} onDelete={handleDelete} onCopyUrl={handleCopyUrl}
                                isSelected={selected?._id === item._id} onSelect={handleSelect} viewMode="grid" />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Box sx={{ flex: 1, overflowY: "auto" }}>
                    {items.map((item) => (
                        <MediaCard key={item._id} item={item} onDelete={handleDelete} onCopyUrl={handleCopyUrl}
                            isSelected={selected?._id === item._id} onSelect={handleSelect} viewMode="list" />
                    ))}
                </Box>
            )}

            {/* Selected info */}
            {selected && selectable && (
                <Paper sx={{ p: 1.5, mt: 1, borderRadius: 1, border: "1px solid", borderColor: "primary.main", bgcolor: "primary.50" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="caption" fontWeight={600}>Seçili: {selected.originalName || selected.fileName}</Typography>
                        <Button size="small" variant="contained" onClick={() => onSelectProp?.(selected)} disableElevation>Kullan</Button>
                    </Box>
                </Paper>
            )}
        </Box>
    );
}
