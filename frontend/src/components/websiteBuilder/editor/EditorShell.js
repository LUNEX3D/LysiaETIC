import React, { useState, useCallback, useEffect } from "react";
import {
    WidgetsRounded, LayersRounded, DescriptionRounded, CloseRounded,
    TuneRounded, AddRounded,
} from "@mui/icons-material";
import {
    Tooltip, IconButton, Typography, Fab, Drawer, useMediaQuery,
} from "@mui/material";
import BlockLibrary from "./BlockLibrary";
import { BLOCK_CATALOG } from "../blocks/BlockRegistry";
import EditorSidebarLayers from "./EditorSidebarLayers";
import EditorPagesPanel from "./EditorPagesPanel";

const RAIL_ITEMS_ALL = [
    { id: "blocks", icon: WidgetsRounded, label: "Blok ekle" },
    { id: "layers", icon: LayersRounded, label: "Katmanlar" },
    { id: "pages", icon: DescriptionRounded, label: "Sayfalar" },
];

const PANEL_TITLES = {
    blocks: "Blok kütüphanesi",
    layers: "Katmanlar",
    pages: "Sayfalar",
};

function PanelBody({
    leftPanel,
    onAddBlock,
    blockCatalog,
    sections,
    selectedSectionId,
    onSelectSection,
    onRemoveSection,
    onDuplicateSection,
    onMoveUp,
    onMoveDown,
    pages,
    currentPageId,
    onSelectPage,
}) {
    if (leftPanel === "blocks") {
        return <BlockLibrary onAddBlock={onAddBlock} blockCatalog={blockCatalog} />;
    }
    if (leftPanel === "layers") {
        return (
            <EditorSidebarLayers
                sections={sections}
                selectedSectionId={selectedSectionId}
                onSelect={onSelectSection}
                onRemove={onRemoveSection}
                onDuplicate={onDuplicateSection}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
            />
        );
    }
    if (leftPanel === "pages") {
        return (
            <EditorPagesPanel
                pages={pages}
                currentPageId={currentPageId}
                onSelectPage={onSelectPage}
            />
        );
    }
    return null;
}

export default function EditorShell({
    children,
    sections,
    selectedSectionId,
    onAddBlock,
    onSelectSection,
    onRemoveSection,
    onDuplicateSection,
    onMoveUp,
    onMoveDown,
    blockCatalog = BLOCK_CATALOG,
    pages = [],
    currentPageId,
    onSelectPage,
    inspector,
    canvasToolbar,
    railIds,
}) {
    const isMobile = useMediaQuery("(max-width:768px)");
    const isTablet = useMediaQuery("(max-width:1024px)");
    const isCompact = isMobile || isTablet;

    const [leftPanel, setLeftPanel] = useState(isCompact ? null : "blocks");
    const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);

    const railItems = RAIL_ITEMS_ALL.filter((item) => {
        if (!railIds) return true;
        return railIds.includes(item.id);
    });

    const togglePanel = useCallback((id) => {
        setLeftPanel((prev) => (prev === id ? null : id));
        if (isCompact) setInspectorSheetOpen(false);
    }, [isCompact]);

    const hasInspector = Boolean(inspector);

    useEffect(() => {
        if (!isCompact) return;
        if (hasInspector) setInspectorSheetOpen(true);
        else setInspectorSheetOpen(false);
    }, [hasInspector, isCompact]);

    useEffect(() => {
        if (!isCompact && leftPanel === null) {
            setLeftPanel("blocks");
        }
    }, [isCompact, leftPanel]);

    const openBlocks = useCallback(() => {
        setLeftPanel("blocks");
        setInspectorSheetOpen(false);
    }, []);

    const closeLeftSheet = useCallback(() => setLeftPanel(null), []);

    const closeInspectorSheet = useCallback(() => {
        setInspectorSheetOpen(false);
        if (inspector?.props?.onClose) inspector.props.onClose();
    }, [inspector]);

    const inspectorNode = hasInspector
        ? (isCompact
            ? React.cloneElement(inspector, { onClose: closeInspectorSheet })
            : inspector)
        : null;

    const panelBody = (
        <PanelBody
            leftPanel={leftPanel}
            onAddBlock={onAddBlock}
            blockCatalog={blockCatalog}
            sections={sections}
            selectedSectionId={selectedSectionId}
            onSelectSection={onSelectSection}
            onRemoveSection={onRemoveSection}
            onDuplicateSection={onDuplicateSection}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            pages={pages}
            currentPageId={currentPageId}
            onSelectPage={onSelectPage}
        />
    );

    const shellClass = [
        "wb-editor-shell",
        hasInspector && !isCompact ? "wb-editor-shell--inspector-open" : "",
        isCompact ? "wb-editor-shell--compact" : "",
        isMobile ? "wb-editor-shell--mobile" : "",
        isTablet && !isMobile ? "wb-editor-shell--tablet" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className={shellClass}>
            {!isCompact && (
                <nav className="wb-editor-rail" aria-label="Editör araçları">
                    {railItems.map(({ id, icon: Icon, label }) => (
                        <Tooltip key={id} title={label} placement="right">
                            <button
                                type="button"
                                className={`wb-editor-rail-btn ${leftPanel === id ? "active" : ""}`}
                                onClick={() => togglePanel(id)}
                                aria-label={label}
                                aria-expanded={leftPanel === id}
                            >
                                <Icon sx={{ fontSize: 22 }} />
                            </button>
                        </Tooltip>
                    ))}
                </nav>
            )}

            {!isCompact && leftPanel && (
                <aside className="wb-editor-slide-panel">
                    <div className="wb-editor-slide-panel-header">
                        <Typography variant="subtitle2" fontWeight={700}>
                            {PANEL_TITLES[leftPanel]}
                        </Typography>
                        <IconButton size="small" onClick={() => setLeftPanel(null)} aria-label="Paneli kapat">
                            <CloseRounded fontSize="small" />
                        </IconButton>
                    </div>
                    <div className="wb-editor-slide-panel-body">{panelBody}</div>
                </aside>
            )}

            <div className="wb-editor-canvas-column">
                {canvasToolbar}
                <div className="wb-editor-canvas-main">{children}</div>
            </div>

            {hasInspector && !isCompact && (
                <aside className="wb-editor-inspector">{inspectorNode}</aside>
            )}

            {isCompact && (
                <>
                    <Drawer
                        anchor="bottom"
                        open={Boolean(leftPanel)}
                        onClose={closeLeftSheet}
                        className="wb-editor-bottom-sheet"
                        PaperProps={{ className: "wb-editor-bottom-sheet-paper" }}
                    >
                        <div className="wb-editor-bottom-sheet-handle" aria-hidden />
                        <div className="wb-editor-slide-panel-header">
                            <Typography variant="subtitle2" fontWeight={700}>
                                {PANEL_TITLES[leftPanel] || ""}
                            </Typography>
                            <IconButton size="small" onClick={closeLeftSheet} aria-label="Paneli kapat">
                                <CloseRounded fontSize="small" />
                            </IconButton>
                        </div>
                        <div className="wb-editor-bottom-sheet-body">{panelBody}</div>
                    </Drawer>

                    {hasInspector && (
                        <Drawer
                            anchor="bottom"
                            open={inspectorSheetOpen}
                            onClose={closeInspectorSheet}
                            className="wb-editor-bottom-sheet wb-editor-inspector-sheet"
                            PaperProps={{ className: "wb-editor-bottom-sheet-paper wb-editor-inspector-sheet-paper" }}
                        >
                            <div className="wb-editor-bottom-sheet-handle" aria-hidden />
                            <div className="wb-editor-inspector-sheet-body">{inspectorNode}</div>
                        </Drawer>
                    )}

                    <nav className="wb-editor-bottom-rail" aria-label="Mobil editör">
                        {railItems.map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                type="button"
                                className={`wb-editor-bottom-rail-btn ${leftPanel === id ? "active" : ""}`}
                                onClick={() => togglePanel(id)}
                                aria-label={label}
                            >
                                <Icon sx={{ fontSize: 22 }} />
                                <span>{id === "blocks" ? "Bloklar" : id === "layers" ? "Katman" : "Sayfa"}</span>
                            </button>
                        ))}
                        {hasInspector && (
                            <button
                                type="button"
                                className={`wb-editor-bottom-rail-btn ${inspectorSheetOpen ? "active" : ""}`}
                                onClick={() => {
                                    setLeftPanel(null);
                                    setInspectorSheetOpen(true);
                                }}
                                aria-label="Düzenle"
                            >
                                <TuneRounded sx={{ fontSize: 22 }} />
                                <span>Düzenle</span>
                            </button>
                        )}
                    </nav>

                    <Fab
                        color="primary"
                        className="wb-editor-fab"
                        onClick={openBlocks}
                        aria-label="Blok ekle"
                    >
                        <AddRounded />
                    </Fab>
                </>
            )}
        </div>
    );
}
