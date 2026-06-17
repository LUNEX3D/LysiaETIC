import React, { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
    Button, CircularProgress, Chip, Tooltip,
} from "@mui/material";
import { RestartAltRounded } from "@mui/icons-material";

import { useEditorState } from "../../components/websiteBuilder/editor/useEditorState";
import EditorToolbar from "../../components/websiteBuilder/editor/EditorToolbar";
import EditorShell from "../../components/websiteBuilder/editor/EditorShell";
import EditorCanvas from "../../components/websiteBuilder/editor/EditorCanvas";
import PropertiesPanel from "../../components/websiteBuilder/editor/PropertiesPanel";
import CanvasZoomBar from "../../components/websiteBuilder/editor/CanvasZoomBar";
import { DEFAULT_CONTENT, PRODUCT_BLOCK_CATALOG } from "../../components/websiteBuilder/blocks/BlockRegistry";
import * as wbApi from "../../services/websiteBuilderApi";
import { fetchStoreProducts } from "../../services/storeApi";
import { getLiveSiteUrls } from "../../utils/wbStorefrontHost";
import "../../styles/websiteBuilder/editor.css";
import "../../styles/websiteBuilder/blocks.css";

const DEVICE_WIDTH = { desktop: 1280, tablet: 768, mobile: 390 };

function normalizePreviewProduct(raw) {
    if (!raw) return null;
    const price = Number(raw.price ?? raw.salePrice ?? 0);
    const salePrice = raw.salePrice != null ? Number(raw.salePrice) : null;
    return {
        _id: raw._id,
        name: raw.name || raw.title || "Ürün",
        slug: raw.slug,
        price,
        salePrice: salePrice != null && salePrice < price ? salePrice : null,
        images: (raw.images || raw.media || []).map((img) => ({
            url: typeof img === "string" ? img : img.url || img.src || "",
        })),
        description: raw.description || raw.bodyHtml || "<p></p>",
        variants: raw.variants || raw.variantOptions || [],
        specifications: raw.specifications || raw.attributes || [],
        rating: raw.rating ?? raw.averageRating,
        reviewCount: raw.reviewCount ?? raw.reviewsCount ?? 0,
        stock: raw.stock ?? raw.quantity,
    };
}

export default function ProductPageEditor() {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const [site, setSite] = useState(null);
    const [previewProduct, setPreviewProduct] = useState(null);
    const [productPageStatus, setProductPageStatus] = useState("draft");
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
    const [resetConfirm, setResetConfirm] = useState(false);
    const [publishConfirm, setPublishConfirm] = useState(false);
    const [canvasZoom, setCanvasZoom] = useState(100);
    const [fitScale, setFitScale] = useState(1);

    const editor = useEditorState();
    const saveIntervalRef = useRef(null);
    const canvasColumnRef = useRef(null);

    const showToast = (message, severity = "success") => setToast({ open: true, message, severity });

    useEffect(() => {
        async function load() {
            try {
                const [siteData, ppData] = await Promise.all([
                    wbApi.getSite(siteId),
                    wbApi.getProductPage(siteId),
                ]);
                setSite(siteData.site);
                setProductPageStatus(ppData.productPage?.status || "draft");
                editor.init(siteId, "product-page", ppData.productPage?.sections || []);

                try {
                    const storeData = await fetchStoreProducts();
                    const list = storeData.products || storeData.items || [];
                    if (list.length > 0) {
                        setPreviewProduct(normalizePreviewProduct(list[0]));
                    }
                } catch {
                    /* mağaza ürünü yoksa önizleme alanları boş kalır */
                }
            } catch (e) {
                showToast(e.response?.data?.error || "Yüklenemedi", "error");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId]); // eslint-disable-line

    useEffect(() => {
        const el = canvasColumnRef.current;
        if (!el) return undefined;

        const updateFit = () => {
            const padding = 32;
            const avail = Math.max(200, el.clientWidth - padding);
            const target = editor.state.device === "desktop"
                ? Math.min(DEVICE_WIDTH.desktop, avail)
                : DEVICE_WIDTH[editor.state.device] || DEVICE_WIDTH.desktop;
            setFitScale(Math.min(1, avail / target));
        };

        updateFit();
        const ro = new ResizeObserver(updateFit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [editor.state.device, canvasZoom]);

    useEffect(() => {
        const handleKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); editor.undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); editor.redo(); }
            if (e.key === "Escape") editor.deselect();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [editor]); // eslint-disable-line

    useEffect(() => {
        if (!editor.state.isDirty || editor.state.isSaving) return;
        clearTimeout(saveIntervalRef.current);
        saveIntervalRef.current = setTimeout(() => {
            handleSave(true);
        }, 3000);
        return () => clearTimeout(saveIntervalRef.current);
    }, [editor.state.sections, editor.state.isDirty]); // eslint-disable-line

    const handleSave = useCallback(async (silent = false) => {
        if (editor.state.isSaving) return;
        editor.setSaveStart();
        try {
            await wbApi.updateProductPage(siteId, { sections: editor.state.sections });
            editor.setSaveSuccess();
            if (!silent) showToast("Kaydedildi", "success");
        } catch (e) {
            editor.setSaveError(e.message);
            showToast(e.response?.data?.error || "Kaydedilemedi", "error");
        }
    }, [siteId, editor]);

    const handlePublish = useCallback(async () => {
        setPublishConfirm(false);
        await handleSave(true);
        try {
            const data = await wbApi.publishProductPage(siteId);
            setProductPageStatus(data.productPage?.status || "active");
            showToast("Ürün sayfası yayınlandı", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Yayınlanamadı", "error");
        }
    }, [siteId, handleSave]);

    const handleReset = useCallback(async () => {
        setResetConfirm(false);
        try {
            const data = await wbApi.resetProductPage(siteId);
            editor.init(siteId, "product-page", data.productPage?.sections || []);
            setProductPageStatus(data.productPage?.status || "draft");
            editor.setSaveSuccess();
            showToast("Varsayılan düzene sıfırlandı", "success");
        } catch (e) {
            showToast(e.response?.data?.error || "Sıfırlanamadı", "error");
        }
    }, [siteId, editor]);

    const handlePreview = useCallback(() => {
        if (!site?.slug) return;
        const urls = getLiveSiteUrls(site);
        const base = urls.path || urls.primary;
        if (!base) return;
        const slug = previewProduct?.slug;
        if (!slug) {
            showToast("Önizleme için mağazada en az bir ürün gerekli", "warning");
            return;
        }
        const path = `${base.replace(/\/$/, "")}/urun/${slug}`;
        window.open(path, "_blank", "noopener,noreferrer");
    }, [site, previewProduct]);

    const handleAddSection = useCallback((blockType, insertAfterIndex) => {
        editor.addSection(blockType, DEFAULT_CONTENT[blockType] || {}, insertAfterIndex);
    }, [editor]);

    const handleDrop = useCallback((blockType, insertAfterIndex) => {
        handleAddSection(blockType, insertAfterIndex);
        editor.setDragOver(null);
    }, [handleAddSection, editor]);

    if (loading) {
        return (
            <div className="wb-editor-loading">
                <CircularProgress size={32} />
                <span>Ürün sayfası editörü yükleniyor…</span>
            </div>
        );
    }

    const selectedSection = editor.selectedSection;
    const statusLabel = productPageStatus === "active" ? "Yayında" : "Taslak";

    const toolbarExtras = (
        <>
            <Chip
                label={statusLabel}
                size="small"
                color={productPageStatus === "active" ? "success" : "default"}
                variant="outlined"
                sx={{ height: 24, fontSize: 11 }}
            />
            {previewProduct && (
                <Chip
                    label={previewProduct.name}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ height: 24, fontSize: 11, maxWidth: 160 }}
                />
            )}
            <Tooltip title="Varsayılan düzene sıfırla">
                <button type="button" className="wb-btn wb-btn-ghost" onClick={() => setResetConfirm(true)}>
                    <RestartAltRounded sx={{ fontSize: 18 }} />
                    <span>Sıfırla</span>
                </button>
            </Tooltip>
        </>
    );

    return (
        <div className="wb-editor-root wb-editor-focus">
            <EditorToolbar
                pageName="Ürün sayfası"
                pageSubtitle={site?.name ? `${site.name} · Tüm ürünlere uygulanır` : "Tüm ürünlere uygulanır"}
                showPagePicker={false}
                device={editor.state.device}
                onDeviceChange={editor.setDevice}
                isDirty={editor.state.isDirty}
                isSaving={editor.state.isSaving}
                onPreview={handlePreview}
                onPublish={() => setPublishConfirm(true)}
                onBack={() => navigate(`/website-builder/${siteId}`)}
                extraActions={toolbarExtras}
            />

            <div className="wb-editor-body">
                <EditorShell
                    railIds={["blocks", "layers"]}
                    blockCatalog={PRODUCT_BLOCK_CATALOG}
                    sections={editor.state.sections}
                    selectedSectionId={editor.state.selectedSectionId}
                    onAddBlock={handleAddSection}
                    onSelectSection={editor.selectSection}
                    onRemoveSection={editor.removeSection}
                    onDuplicateSection={editor.duplicateSection}
                    onMoveUp={editor.moveSectionUp}
                    onMoveDown={editor.moveSectionDown}
                    canvasToolbar={<CanvasZoomBar zoom={canvasZoom} onZoomChange={setCanvasZoom} />}
                    inspector={selectedSection ? (
                        <PropertiesPanel
                            section={selectedSection}
                            themeVariables={site?.themeVariables}
                            onContentChange={editor.updateSectionContent}
                            onSettingsChange={editor.updateSectionSettings}
                            onMobileChange={editor.updateSectionMobile}
                            onRemove={editor.removeSection}
                            onDuplicate={editor.duplicateSection}
                            onToggleLock={editor.toggleLock}
                            onClose={() => editor.deselect()}
                        />
                    ) : null}
                >
                    <div ref={canvasColumnRef} className="wb-editor-canvas-viewport">
                        <EditorCanvas
                            sections={editor.state.sections}
                            selectedSectionId={editor.state.selectedSectionId}
                            device={editor.state.device}
                            themeVariables={site?.themeVariables}
                            previewProduct={previewProduct}
                            dragOverIndex={editor.state.dragOverIndex}
                            zoom={canvasZoom}
                            fitScale={fitScale}
                            onSectionSelect={editor.selectSection}
                            onCanvasClick={editor.deselect}
                            onSectionRemove={editor.removeSection}
                            onSectionDuplicate={editor.duplicateSection}
                            onMoveSectionUp={editor.moveSectionUp}
                            onMoveSectionDown={editor.moveSectionDown}
                            onToggleVisibility={editor.toggleSectionVisibility}
                            onDragOver={editor.setDragOver}
                            onDrop={handleDrop}
                            onAddSection={handleAddSection}
                        />
                    </div>
                </EditorShell>
            </div>

            <Dialog open={resetConfirm} onClose={() => setResetConfirm(false)}>
                <DialogTitle>Varsayılana sıfırla</DialogTitle>
                <DialogContent>
                    Ürün sayfası düzeni varsayılan hale getirilecek. Bu işlem geri alınamaz.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetConfirm(false)}>İptal</Button>
                    <Button color="warning" variant="contained" onClick={handleReset} disableElevation>
                        Sıfırla
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={publishConfirm} onClose={() => setPublishConfirm(false)}>
                <DialogTitle>Ürün sayfasını yayınla</DialogTitle>
                <DialogContent>
                    Ürün sayfası kaydedilip tüm ürünlere uygulanacak.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPublishConfirm(false)}>İptal</Button>
                    <Button color="success" variant="contained" onClick={handlePublish} disableElevation>
                        Yayınla
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </div>
    );
}
