import React, { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress } from "@mui/material";

import { useEditorState } from "../../components/websiteBuilder/editor/useEditorState";
import EditorToolbar from "../../components/websiteBuilder/editor/EditorToolbar";
import EditorShell from "../../components/websiteBuilder/editor/EditorShell";
import EditorCanvas from "../../components/websiteBuilder/editor/EditorCanvas";
import PropertiesPanel from "../../components/websiteBuilder/editor/PropertiesPanel";
import CanvasZoomBar from "../../components/websiteBuilder/editor/CanvasZoomBar";
import { DEFAULT_CONTENT } from "../../components/websiteBuilder/blocks/BlockRegistry";

import * as wbApi from "../../services/websiteBuilderApi";
import { getLiveSiteUrls } from "../../utils/wbStorefrontHost";
import "../../styles/websiteBuilder/editor.css";
import "../../styles/websiteBuilder/blocks.css";

const DEVICE_WIDTH = { desktop: 1280, tablet: 768, mobile: 390 };

export default function PageEditor() {
    const { siteId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [site, setSite] = useState(null);
    const [pages, setPages] = useState([]);
    const [currentPageId, setCurrentPageId] = useState(searchParams.get("page") || null);
    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState(false);
    const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
    const [publishConfirm, setPublishConfirm] = useState(false);
    const [canvasZoom, setCanvasZoom] = useState(100);
    const [fitScale, setFitScale] = useState(1);

    const editor = useEditorState();
    const saveIntervalRef = useRef(null);
    const canvasColumnRef = useRef(null);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const [siteData, pagesData] = await Promise.all([
                    wbApi.getSite(siteId),
                    wbApi.getPages(siteId),
                ]);
                setSite(siteData.site);
                const pageList = pagesData.pages || [];
                setPages(pageList);

                let targetPageId = currentPageId;
                if (!targetPageId) {
                    const home = pageList.find((p) => p.isHomePage) || pageList[0];
                    if (home) targetPageId = home._id;
                }

                if (targetPageId) {
                    await loadPage(targetPageId);
                }
            } catch (e) {
                showToast(e.response?.data?.error || "Yüklenemedi", "error");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId]); // eslint-disable-line

    const loadPage = useCallback(async (pageId) => {
        setPageLoading(true);
        try {
            const data = await wbApi.getPage(siteId, pageId);
            const page = data.page;
            editor.init(siteId, pageId, page.sections || []);
            setCurrentPageId(pageId);
            setSearchParams({ page: pageId }, { replace: true });
        } catch {
            showToast("Sayfa yüklenemedi", "error");
        } finally {
            setPageLoading(false);
        }
    }, [siteId, editor, setSearchParams]);

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
        if (!editor.state.isDirty || editor.state.isSaving || !currentPageId) return;
        clearTimeout(saveIntervalRef.current);
        saveIntervalRef.current = setTimeout(() => {
            handleSave(true);
        }, 3000);
        return () => clearTimeout(saveIntervalRef.current);
    }, [editor.state.sections, editor.state.isDirty]); // eslint-disable-line

    const handleSave = useCallback(async (isAutoSave = false) => {
        if (!currentPageId || editor.state.isSaving) return;
        editor.setSaveStart();
        try {
            await wbApi.updatePage(siteId, currentPageId, { sections: editor.state.sections });
            editor.setSaveSuccess();
            if (!isAutoSave) showToast("Kaydedildi", "success");
        } catch (e) {
            editor.setSaveError(e.message);
            showToast("Kaydedilemedi: " + (e.response?.data?.error || e.message), "error");
        }
    }, [siteId, currentPageId, editor]);

    const refreshPages = useCallback(async () => {
        const pagesData = await wbApi.getPages(siteId);
        setPages(pagesData.pages || []);
        return pagesData.pages || [];
    }, [siteId]);

    const handlePublish = useCallback(async () => {
        setPublishConfirm(false);
        try {
            await handleSave(true);
            await wbApi.publishPage(siteId, currentPageId);
            showToast("Sayfa yayınlandı", "success");
            await refreshPages();
        } catch (e) {
            showToast("Yayınlanamadı: " + (e.response?.data?.error || e.message), "error");
        }
    }, [siteId, currentPageId, handleSave, refreshPages]);

    const handlePreview = useCallback(() => {
        if (!site?.slug) return;
        const urls = getLiveSiteUrls(site);
        const base = urls.path || urls.primary;
        if (!base) return;
        const currentPage = pages.find((p) => p._id === currentPageId);
        const path = currentPage?.isHomePage || !currentPage?.slug
            ? base
            : `${base.replace(/\/$/, "")}/page/${currentPage.slug}`;
        window.open(path, "_blank", "noopener,noreferrer");
    }, [site, currentPageId, pages]);

    const handleAddSection = useCallback((blockType, insertAfterIndex) => {
        editor.addSection(blockType, DEFAULT_CONTENT[blockType] || {}, insertAfterIndex);
    }, [editor]);

    const handleDrop = useCallback((blockType, insertAfterIndex) => {
        handleAddSection(blockType, insertAfterIndex);
        editor.setDragOver(null);
    }, [handleAddSection, editor]);

    const showToast = (message, severity = "success") => {
        setToast({ open: true, message, severity });
    };

    if (loading) {
        return (
            <div className="wb-editor-loading">
                <CircularProgress size={32} />
                <span>Editör yükleniyor…</span>
            </div>
        );
    }

    const currentPage = pages.find((p) => p._id === currentPageId);
    const selectedSection = editor.selectedSection;

    return (
        <div className="wb-editor-root wb-editor-focus">
            <EditorToolbar
                pageName={currentPage?.title}
                pages={pages}
                currentPageId={currentPageId}
                onSelectPage={(pageId) => loadPage(pageId)}
                device={editor.state.device}
                onDeviceChange={editor.setDevice}
                isDirty={editor.state.isDirty}
                isSaving={editor.state.isSaving}
                onPreview={handlePreview}
                onPublish={() => setPublishConfirm(true)}
                onBack={() => navigate(`/website-builder/${siteId}`)}
            />

            <div className="wb-editor-body">
                <EditorShell
                    sections={editor.state.sections}
                    selectedSectionId={editor.state.selectedSectionId}
                    onAddBlock={handleAddSection}
                    onSelectSection={editor.selectSection}
                    onRemoveSection={editor.removeSection}
                    onDuplicateSection={editor.duplicateSection}
                    onMoveUp={editor.moveSectionUp}
                    onMoveDown={editor.moveSectionDown}
                    pages={pages}
                    currentPageId={currentPageId}
                    onSelectPage={(pageId) => loadPage(pageId)}
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
                        {pageLoading ? (
                            <div className="wb-editor-canvas-loading">
                                <CircularProgress size={32} />
                            </div>
                        ) : (
                            <EditorCanvas
                                sections={editor.state.sections}
                                selectedSectionId={editor.state.selectedSectionId}
                                device={editor.state.device}
                                themeVariables={site?.themeVariables}
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
                        )}
                    </div>
                </EditorShell>
            </div>

            <Dialog open={publishConfirm} onClose={() => setPublishConfirm(false)}>
                <DialogTitle>Sayfayı Yayınla</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{currentPage?.title}</strong> sayfası kaydedilip yayınlanacak. Ziyaretçiler bu sayfayı görebilecek.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPublishConfirm(false)}>İptal</Button>
                    <Button variant="contained" color="success" onClick={handlePublish} disableElevation>
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
