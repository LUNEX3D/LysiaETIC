import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
    Box, Button, Chip, IconButton, Menu, MenuItem, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, CircularProgress, Alert,
} from "@mui/material";
import { MoreHorizRounded } from "@mui/icons-material";
import { Pencil, Copy, Rocket, Trash2, Plus } from "lucide-react";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import WBEmptyState from "../../components/websiteBuilder/layout/WBEmptyState";
import { getStorePageEditPath, pageTypeLabel } from "../../constants/storeBuilderNav";
import * as wbApi from "../../services/websiteBuilderApi";
import "../../styles/websiteBuilder/wbStoreBuilder.css";

export default function PagesManager() {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const { site: ctxSite } = useOutletContext() || {};
    const [site, setSite] = useState(ctxSite);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuPage, setMenuPage] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [siteRes, pagesRes] = await Promise.all([
                wbApi.getSite(siteId),
                wbApi.getPages(siteId),
            ]);
            setSite(siteRes.site);
            setPages(pagesRes.pages || []);
        } catch (e) {
            setError(e.response?.data?.error || "Sayfalar yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        load();
    }, [load]);

    const openMenu = (e, page) => {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
        setMenuPage(page);
    };

    const closeMenu = () => {
        setMenuAnchor(null);
        setMenuPage(null);
    };

    const handleEdit = (page) => {
        navigate(getStorePageEditPath(siteId, page._id));
    };

    const handleDuplicate = async (page) => {
        closeMenu();
        setBusyId(page._id);
        try {
            const full = await wbApi.getPage(siteId, page._id);
            const p = full.page;
            const suffix = Date.now().toString(36).slice(-4);
            await wbApi.createPage(siteId, {
                title: `${p.title || "Sayfa"} (Kopya)`,
                type: p.type,
                slug: p.slug ? `${p.slug}-copy-${suffix}` : `copy-${suffix}`,
                sections: p.sections || [],
            });
            await load();
        } catch (e) {
            setError(e.response?.data?.error || "Kopyalanamadı");
        } finally {
            setBusyId(null);
        }
    };

    const handlePublish = async (page) => {
        closeMenu();
        setBusyId(page._id);
        try {
            await wbApi.publishPage(siteId, page._id);
            await load();
        } catch (e) {
            setError(e.response?.data?.error || "Yayınlanamadı");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (page) => {
        closeMenu();
        if (page.isHomePage) {
            setError("Ana sayfa silinemez.");
            return;
        }
        if (!window.confirm(`"${page.title}" sayfasını silmek istediğinize emin misiniz?`)) return;
        setBusyId(page._id);
        try {
            await wbApi.deletePage(siteId, page._id);
            await load();
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        } finally {
            setBusyId(null);
        }
    };

    const homePage = pages.find((p) => p.isHomePage || p.type === "home");

    return (
        <Box className="wb-ikas-page wb-store-pages">
            <WBIkasPageHeader
                title="Sayfalar"
                subtitle="Mağaza sayfalarınızı yönetin — düzenlemek için Düzenle'ye tıklayın."
                actions={
                    homePage ? (
                        <Button
                            variant="contained"
                            className="wb-ikas-btn-primary"
                            startIcon={<Pencil size={18} />}
                            onClick={() => handleEdit(homePage)}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                        >
                            Ana sayfayı düzenle
                        </Button>
                    ) : null
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress size={32} />
                </Box>
            ) : pages.length === 0 ? (
                <WBEmptyState
                    variant="grid"
                    title="Henüz sayfa yok"
                    description="Tema kurulumu tamamlandığında sayfalar otomatik oluşur. Mağaza sihirbazından devam edebilirsiniz."
                    actionLabel="Mağaza sihirbazı"
                    onAction={() => navigate(`/website-builder/${siteId}/store/onboarding`)}
                />
            ) : (
                <TableContainer component={Paper} className="wb-store-pages__table" elevation={0}>
                    <Table size="medium">
                        <TableHead>
                            <TableRow>
                                <TableCell>Sayfa</TableCell>
                                <TableCell>Tür</TableCell>
                                <TableCell>URL</TableCell>
                                <TableCell>Durum</TableCell>
                                <TableCell align="right">İşlemler</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pages.map((page) => (
                                <TableRow key={page._id} hover className="wb-store-pages__row">
                                    <TableCell>
                                        <strong>{page.title || pageTypeLabel(page)}</strong>
                                        {page.isHomePage && (
                                            <Chip label="Ana" size="small" sx={{ ml: 1, height: 20, fontSize: 10 }} />
                                        )}
                                    </TableCell>
                                    <TableCell>{pageTypeLabel(page)}</TableCell>
                                    <TableCell className="wb-store-pages__slug">/{page.slug || ""}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={page.status === "published" ? "Yayında" : "Taslak"}
                                            size="small"
                                            color={page.status === "published" ? "success" : "default"}
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<Pencil size={16} />}
                                            onClick={() => handleEdit(page)}
                                            sx={{ mr: 1, textTransform: "none" }}
                                        >
                                            Düzenle
                                        </Button>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => openMenu(e, page)}
                                            disabled={busyId === page._id}
                                        >
                                            <MoreHorizRounded />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                <MenuItem onClick={() => { handleEdit(menuPage); closeMenu(); }}>
                    <Pencil size={16} style={{ marginRight: 8 }} /> Düzenle
                </MenuItem>
                <MenuItem onClick={() => handleDuplicate(menuPage)}>
                    <Copy size={16} style={{ marginRight: 8 }} /> Kopyala
                </MenuItem>
                <MenuItem onClick={() => handlePublish(menuPage)}>
                    <Rocket size={16} style={{ marginRight: 8 }} /> Yayınla
                </MenuItem>
                <MenuItem onClick={() => handleDelete(menuPage)} sx={{ color: "error.main" }}>
                    <Trash2 size={16} style={{ marginRight: 8 }} /> Sil
                </MenuItem>
            </Menu>
        </Box>
    );
}
