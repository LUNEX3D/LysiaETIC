import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CircularProgress, Snackbar, Alert } from "@mui/material";
import ThemeStudioLayout from "./ThemeStudioLayout";
import useThemeDocument from "../state/useThemeDocument";
import * as themeStudioApi from "../api/themeStudioApi";
import { DEVICE_WIDTHS, GLOBAL_PANEL, HEADER_PANEL } from "../registry/constants";
import { STUDIO_MODES, parseStudioMode } from "../registry/editorModes";
import { getLiveSiteUrls } from "../../utils/wbStorefrontHost";
import "../styles/theme-studio.css";
import "../styles/theme-studio-pro.css";

function createSectionFromRegistry(key, registry) {
    const def = registry.find((r) => r.key === key);
    if (!def) return null;
    const base = def.defaults || {};
    return {
        id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: base.type || key,
        order: 0,
        content: JSON.parse(JSON.stringify(base.content || {})),
        settings: JSON.parse(JSON.stringify(base.settings || {})),
        translations: {},
    };
}

export default function ThemeStudioPage() {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { state, dispatch, pushHistory, undo, redo } = useThemeDocument();
    const [site, setSite] = useState(null);
    const [categories, setCategories] = useState([]);
    const [dawnManifest, setDawnManifest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [canvasWidth, setCanvasWidth] = useState(DEVICE_WIDTHS.desktop);
    const [editorMode, setEditorMode] = useState(() => parseStudioMode(searchParams.get("mode")));
    const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
    const saveTimer = useRef(null);
    const stateRef = useRef(state);
    stateRef.current = state;

    const showToast = (message, severity = "success") => setToast({ open: true, message, severity });

    const handleEditorModeChange = useCallback((mode) => {
        setEditorMode(mode);
        const next = new URLSearchParams(searchParams);
        if (mode === STUDIO_MODES.SECTIONS) next.delete("mode");
        else next.set("mode", mode);
        setSearchParams(next, { replace: true });
        if (mode === STUDIO_MODES.BRAND) {
            dispatch({ type: "SELECT", selection: { type: "global", panel: GLOBAL_PANEL } });
        }
        if (mode === STUDIO_MODES.SETTINGS) {
            dispatch({ type: "SELECT", selection: { type: "global", panel: HEADER_PANEL } });
        }
    }, [dispatch, searchParams, setSearchParams]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                setLoading(true);
                const docRes = await themeStudioApi.getThemeDocument(siteId);
                if (cancelled) return;
                const isDawn = docRes.document?.globalStyles?.themePack === "dawn";
                const [regRes, manifestRes] = await Promise.all([
                    themeStudioApi.getSectionRegistry(isDawn ? { pack: "dawn" } : {}),
                    isDawn ? themeStudioApi.getDawnManifest(siteId).catch(() => null) : Promise.resolve(null),
                ]);
                if (cancelled) return;
                setSite(docRes.site);
                dispatch({
                    type: "LOAD",
                    document: docRes.document,
                    revision: docRes.revision,
                });
                dispatch({
                    type: "SET_REGISTRY",
                    registry: regRes.sections || [],
                    pageTemplates: docRes.pageTemplates,
                    locales: docRes.locales,
                });
                setCategories(regRes.categories || []);
                if (manifestRes?.manifest) setDawnManifest(manifestRes.manifest);
                pushHistory(docRes.document);
                const homeSections = docRes.document?.pages?.home?.sections || [];
                if (homeSections[0]?.id) {
                    dispatch({ type: "SELECT", selection: { type: "section", sectionId: homeSections[0].id } });
                }
            } catch (e) {
                showToast(e?.response?.data?.error || e.message || "Yükleme hatası", "error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [siteId, dispatch, pushHistory]);

    const saveDraft = useCallback(async (silent = false) => {
        const doc = stateRef.current.document;
        if (!doc) return;
        try {
            setSaving(true);
            await themeStudioApi.patchThemeDocument(siteId, doc);
            dispatch({ type: "MARK_CLEAN" });
            if (!silent) showToast("Taslak kaydedildi");
        } catch (e) {
            showToast(e?.response?.data?.error || "Kayıt hatası", "error");
        } finally {
            setSaving(false);
        }
    }, [siteId, dispatch]);

    useEffect(() => {
        if (!state.dirty || !state.document) return undefined;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveDraft(true), 5000);
        return () => clearTimeout(saveTimer.current);
    }, [state.document, state.dirty, saveDraft]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                saveDraft(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [saveDraft]);

    const handlePublish = async () => {
        try {
            setPublishing(true);
            await saveDraft(true);
            await themeStudioApi.publishThemeStudio(siteId);
            showToast("Tema yayınlandı");
        } catch (e) {
            showToast(e?.response?.data?.error || "Yayın hatası", "error");
        } finally {
            setPublishing(false);
        }
    };

    const handleUndo = async () => {
        const prev = undo();
        if (!prev) {
            try {
                const res = await themeStudioApi.undoThemeStudio(siteId);
                dispatch({ type: "SET_DOCUMENT", document: res.document });
            } catch { /* ignore */ }
            return;
        }
        await saveDraft(true);
    };

    const handleRedo = async () => {
        const next = redo();
        if (!next) {
            try {
                const res = await themeStudioApi.redoThemeStudio(siteId);
                dispatch({ type: "SET_DOCUMENT", document: res.document });
            } catch { /* ignore */ }
            return;
        }
        await saveDraft(true);
    };

    const handlePreview = () => {
        const live = getLiveSiteUrls(site);
        const href = live.path || live.primary;
        if (href) window.open(href, "_blank", "noopener,noreferrer");
        else showToast("Site henüz yayınlanmamış", "warning");
    };

    const handleNavigate = (url) => {
        if (!url) return;
        const map = {
            "/": "home",
            "/products": "category",
            "/contact": "contact",
            "/blog": "blog",
            "/cart": "cart",
            "/checkout": "checkout",
            "/search": "search",
            "/account": "account",
            "/wishlist": "wishlist",
        };
        const key = map[url] || state.activePageKey;
        dispatch({ type: "SET_PAGE", pageKey: key });
    };

    const handlePickSection = (key) => {
        const section = createSectionFromRegistry(key, state.registry);
        if (!section) return;
        pushHistory(state.document);
        dispatch({ type: "ADD_SECTION", section });
        setLibraryOpen(false);
    };

    const patchWithHistory = (action) => {
        pushHistory(state.document);
        dispatch(action);
    };

    if (loading || !state.document) {
        return (
            <div className="tb-studio-loading">
                <CircularProgress size={32} />
            </div>
        );
    }

    return (
        <>
            <ThemeStudioLayout
                site={site}
                state={state}
                registry={state.registry}
                categories={categories}
                libraryOpen={libraryOpen}
                saving={saving}
                publishing={publishing}
                canvasWidth={canvasWidth}
                dawnManifest={dawnManifest}
                editorMode={editorMode}
                onEditorModeChange={handleEditorModeChange}
                onPageChange={(pageKey) => dispatch({ type: "SET_PAGE", pageKey })}
                onLocaleChange={(locale) => dispatch({ type: "SET_LOCALE", locale })}
                onDeviceChange={(device) => {
                    dispatch({ type: "SET_DEVICE", device });
                    setCanvasWidth(DEVICE_WIDTHS[device] || DEVICE_WIDTHS.desktop);
                }}
                onCanvasWidthChange={setCanvasWidth}
                onSave={() => saveDraft(false)}
                onPublish={handlePublish}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onPreview={handlePreview}
                onBack={() => navigate(`/website-builder/${siteId}`)}
                onExitToProgram={() => navigate("/dashboard")}
                onSelectSection={(sectionId) => dispatch({ type: "SELECT", selection: { type: "section", sectionId } })}
                onSelectGlobal={(panel) => dispatch({ type: "SELECT", selection: { type: "global", panel } })}
                onReorder={(sections) => patchWithHistory({ type: "REORDER_SECTIONS", sections })}
                onDuplicate={(sectionId) => patchWithHistory({ type: "DUPLICATE_SECTION", sectionId })}
                onToggleHide={(sectionId) => patchWithHistory({ type: "TOGGLE_SECTION_HIDE", sectionId })}
                onRemove={(sectionId) => patchWithHistory({ type: "REMOVE_SECTION", sectionId })}
                onMove={(sectionId, delta) => patchWithHistory({ type: "MOVE_SECTION", sectionId, delta })}
                onAddSection={() => setLibraryOpen(true)}
                onCloseLibrary={() => setLibraryOpen(false)}
                onPickSection={handlePickSection}
                onPatchSection={(sectionId, field, value, locale) =>
                    patchWithHistory({ type: "PATCH_SECTION_FIELD", sectionId, field, value, locale })
                }
                onPatchGlobal={(path, value) => patchWithHistory({ type: "PATCH_GLOBAL", path, value })}
                onPatchPageSeo={(pageKey, seo) => patchWithHistory({ type: "PATCH_PAGE_SEO", pageKey, seo })}
                onNavigate={handleNavigate}
            />
            <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast((t) => ({ ...t, open: false }))}>
                <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </>
    );
}
