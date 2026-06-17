import React, { useState } from "react";
import {
    LayersRounded, WidgetsRounded, LockRounded, DragIndicatorRounded,
    ArrowUpwardRounded, ArrowDownwardRounded, ContentCopyRounded, DeleteRounded,
    VisibilityOffRounded,
} from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import BlockLibrary from "./BlockLibrary";
import { BLOCK_CATALOG } from "../blocks/BlockRegistry";
import { BLOCK_TYPE_LABELS } from "../blocks/BlockRegistry";

const BLOCK_ICONS = {
    hero: "🦸", "product-grid": "🛍️", banner: "📢", text: "📝", image: "🖼️",
    slider: "🎠", video: "▶️", testimonials: "💬", newsletter: "📧",
    contact: "✉️", countdown: "⏱️", campaign: "🏷️", "category-grid": "📂",
    html: "⌨️", spacer: "↕️", divider: "➖",
};

function LayersPanel({ sections, selectedSectionId, onSelect, onRemove, onDuplicate, onMoveUp, onMoveDown }) {
    return (
        <div className="wb-sidebar-content">
            {sections.length === 0 ? (
                <div style={{ textAlign: "center", color: "#475569", fontSize: 13, padding: "20px 0" }}>
                    Henüz blok yok.<br />Kütüphaneden blok ekleyin.
                </div>
            ) : (
                <div className="wb-layers-list">
                    {[...sections].sort((a, b) => a.order - b.order).map((section, idx) => (
                        <div
                            key={section.id}
                            className={`wb-layer-item ${selectedSectionId === section.id ? "selected" : ""} ${section.settings?.hidden ? "layer-hidden" : ""}`}
                            onClick={() => onSelect(section.id)}
                        >
                            <span className="wb-layer-drag-handle">
                                <DragIndicatorRounded sx={{ fontSize: 16 }} />
                            </span>
                            <span style={{ fontSize: 16 }}>{BLOCK_ICONS[section.type] || "📦"}</span>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

export default function EditorSidebar({
    sections,
    selectedSectionId,
    onAddBlock,
    onSelect,
    onRemove,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    blockCatalog = BLOCK_CATALOG,
}) {
    const [tab, setTab] = useState("blocks");

    return (
        <div className="wb-sidebar">
            <div className="wb-sidebar-tabs">
                <button type="button" className={`wb-sidebar-tab ${tab === "blocks" ? "active" : ""}`} onClick={() => setTab("blocks")}>
                    <WidgetsRounded sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
                    Kütüphane
                </button>
                <button type="button" className={`wb-sidebar-tab ${tab === "layers" ? "active" : ""}`} onClick={() => setTab("layers")}>
                    <LayersRounded sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
                    Katmanlar
                    {sections.length > 0 && (
                        <span className="wb-sidebar-badge">{sections.length}</span>
                    )}
                </button>
            </div>

            {tab === "blocks" && (
                <BlockLibrary onAddBlock={onAddBlock} blockCatalog={blockCatalog} />
            )}
            {tab === "layers" && (
                <LayersPanel
                    sections={sections}
                    selectedSectionId={selectedSectionId}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onDuplicate={onDuplicate}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                />
            )}
        </div>
    );
}
