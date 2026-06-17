import React from "react";
import ThemeStudioTopbar from "./topbar/ThemeStudioTopbar";
import NavigatorPanel from "./navigator/NavigatorPanel";
import SettingsNavigator from "./navigator/SettingsNavigator";
import GlobalDesignStudio from "./brand/GlobalDesignStudio";
import LivePreviewCanvas from "./preview/LivePreviewCanvas";
import PropertiesPanel from "./properties/PropertiesPanel";
import SectionLibraryDrawer from "./navigator/SectionLibraryDrawer";
import { STUDIO_MODES } from "../registry/editorModes";
import { isDawnTheme } from "../dawn";
import DawnCustomizerNav from "../dawn/customizer/DawnCustomizerNav";
import "../dawn/customizer/dawn-customizer.css";

export default function ThemeStudioLayout({
    site,
    state,
    registry,
    categories,
    libraryOpen,
    saving,
    publishing,
    canvasWidth,
    dawnManifest,
    editorMode = STUDIO_MODES.SECTIONS,
    onEditorModeChange,
    onPageChange,
    onLocaleChange,
    onDeviceChange,
    onCanvasWidthChange,
    onSave,
    onPublish,
    onUndo,
    onRedo,
    onPreview,
    onBack,
    onExitToProgram,
    onSelectSection,
    onSelectGlobal,
    onReorder,
    onDuplicate,
    onToggleHide,
    onRemove,
    onMove,
    onAddSection,
    onCloseLibrary,
    onPickSection,
    onPatchSection,
    onPatchGlobal,
    onPatchPageSeo,
    onNavigate,
}) {
    const { document, activePageKey, activeLocale, device, selection } = state;
    const page = document?.pages?.[activePageKey];
    const sections = activePageKey === "product"
        ? (document?.productPage?.sections || [])
        : (page?.sections || []);
    const localeMeta = (state.locales || []).find((l) => l.code === activeLocale);
    const direction = localeMeta?.direction || "ltr";
    const useDawn = isDawnTheme(document) && editorMode === STUDIO_MODES.SECTIONS;

    const navProps = {
        sections,
        registry,
        selectedSectionId: selection?.type === "section" ? selection.sectionId : null,
        selection,
        activePageKey,
        onSelectSection,
        onSelectGlobal,
        onReorder,
        onDuplicate,
        onToggleHide,
        onRemove,
        onMove,
        onAddSection,
    };

    const renderLeftPanel = () => {
        if (editorMode === STUDIO_MODES.BRAND) {
            return (
                <GlobalDesignStudio
                    styles={document.globalStyles || {}}
                    onChange={(globalStyles) => onPatchGlobal("globalStyles", globalStyles)}
                />
            );
        }
        if (editorMode === STUDIO_MODES.SETTINGS) {
            return (
                <SettingsNavigator
                    selection={selection}
                    onSelectGlobal={onSelectGlobal}
                    activePageKey={activePageKey}
                    pageTemplates={state.pageTemplates}
                />
            );
        }
        if (useDawn) {
            return (
                <DawnCustomizerNav
                    manifest={dawnManifest}
                    document={document}
                    activePageKey={activePageKey}
                    onPageChange={onPageChange}
                    onPatchGlobal={onPatchGlobal}
                    {...navProps}
                />
            );
        }
        return <NavigatorPanel {...navProps} />;
    };

    const bodyClass = [
        "tb-studio__body",
        editorMode === STUDIO_MODES.BRAND ? "tb-studio__body--brand" : "",
        editorMode === STUDIO_MODES.SETTINGS ? "tb-studio__body--settings" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className={`tb-studio tb-studio--pro${useDawn ? " tb-studio--dawn" : ""}`} dir={direction}>
            <ThemeStudioTopbar
                siteName={site?.name}
                siteStatus={site?.status}
                activePageKey={activePageKey}
                pageTemplates={state.pageTemplates}
                activeLocale={activeLocale}
                locales={state.locales}
                device={device}
                dirty={state.dirty}
                saving={saving}
                publishing={publishing}
                canvasWidth={canvasWidth}
                editorMode={editorMode}
                onEditorModeChange={onEditorModeChange}
                onPageChange={onPageChange}
                onLocaleChange={onLocaleChange}
                onDeviceChange={onDeviceChange}
                onCanvasWidthChange={onCanvasWidthChange}
                onSave={onSave}
                onPublish={onPublish}
                onUndo={onUndo}
                onRedo={onRedo}
                onPreview={onPreview}
                onBack={onBack}
                onExitToProgram={onExitToProgram}
            />

            <div className={bodyClass}>
                <div className="tb-studio__navigator">{renderLeftPanel()}</div>
                <div className="tb-studio__preview">
                    <LivePreviewCanvas
                        document={document}
                        activePageKey={activePageKey}
                        device={device}
                        canvasWidth={canvasWidth}
                        siteSlug={site?.slug}
                        siteId={site?.id || site?._id}
                        siteName={site?.name}
                        selection={selection}
                        onSelectSection={onSelectSection}
                        onNavigate={onNavigate}
                    />
                </div>

                {editorMode !== STUDIO_MODES.BRAND && (
                    <PropertiesPanel
                        selection={selection}
                        document={document}
                        activePageKey={activePageKey}
                        activeLocale={activeLocale}
                        registry={registry}
                        siteId={site?.id || site?._id}
                        editorMode={editorMode}
                        onPatchSection={onPatchSection}
                        onPatchGlobal={onPatchGlobal}
                        onPatchPageSeo={onPatchPageSeo}
                    />
                )}
            </div>

            <SectionLibraryDrawer
                open={libraryOpen}
                onClose={onCloseLibrary}
                registry={registry}
                categories={categories}
                onAdd={onPickSection}
            />
        </div>
    );
}
