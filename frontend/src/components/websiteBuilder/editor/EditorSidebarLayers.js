import React from "react";
import {
    LockRounded, DragIndicatorRounded, ArrowUpwardRounded, ArrowDownwardRounded,
    ContentCopyRounded, DeleteRounded, VisibilityOffRounded,
} from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import { BLOCK_TYPE_LABELS } from "../blocks/BlockRegistry";
import BlockLibraryIcon from "../blocks/BlockLibraryIcon";
import { getBlockMeta } from "../blocks/blockLibraryMeta";

export default function EditorSidebarLayers({
    sections,
    selectedSectionId,
    onSelect,
    onRemove,
    onDuplicate,
    onMoveUp,
    onMoveDown,
}) {
    return (
        <div className="wb-sidebar-content">
            {sections.length === 0 ? (
                <div className="wb-editor-empty-hint">
                    Henüz blok yok.<br />Blok ekleyerek başlayın.
                </div>
            ) : (
                <div className="wb-layers-list">
                    {[...sections].sort((a, b) => a.order - b.order).map((section, idx) => (
                        <div
                            key={section.id}
                            className={`wb-layer-item ${selectedSectionId === section.id ? "selected" : ""} ${section.settings?.hidden ? "layer-hidden" : ""}`}
                            onClick={() => onSelect(section.id)}
                            onKeyDown={(e) => e.key === "Enter" && onSelect(section.id)}
                            role="button"
                            tabIndex={0}
                        >
                            <span className="wb-layer-drag-handle">
                                <DragIndicatorRounded sx={{ fontSize: 16 }} />
                            </span>
                            <BlockLibraryIcon
                                name={getBlockMeta(section.type).muiIcon}
                                sx={{ fontSize: 18, color: "primary.main" }}
                            />
                            <span className="wb-layer-label">
                                {BLOCK_TYPE_LABELS[section.type] || section.type}
                            </span>
                            {section.settings?.hidden && (
                                <VisibilityOffRounded sx={{ fontSize: 14, color: "warning.main" }} />
                            )}
                            {section.isLocked && <LockRounded sx={{ fontSize: 13, color: "warning.main" }} />}
                            <div className="wb-layer-actions">
                                <Tooltip title="Yukarı">
                                    <button type="button" className="wb-section-action-btn" onClick={(e) => { e.stopPropagation(); onMoveUp(section.id); }} disabled={idx === 0}>
                                        <ArrowUpwardRounded sx={{ fontSize: 12 }} />
                                    </button>
                                </Tooltip>
                                <Tooltip title="Aşağı">
                                    <button type="button" className="wb-section-action-btn" onClick={(e) => { e.stopPropagation(); onMoveDown(section.id); }} disabled={idx === sections.length - 1}>
                                        <ArrowDownwardRounded sx={{ fontSize: 12 }} />
                                    </button>
                                </Tooltip>
                                <Tooltip title="Çoğalt">
                                    <button type="button" className="wb-section-action-btn" onClick={(e) => { e.stopPropagation(); onDuplicate(section.id); }}>
                                        <ContentCopyRounded sx={{ fontSize: 12 }} />
                                    </button>
                                </Tooltip>
                                <Tooltip title="Sil">
                                    <button type="button" className="wb-section-action-btn danger" onClick={(e) => { e.stopPropagation(); if (!section.isLocked) onRemove(section.id); }}>
                                        <DeleteRounded sx={{ fontSize: 12 }} />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
