import React from "react";
import {
    DragIndicatorRounded, DeleteRounded, ContentCopyRounded,
    ArrowUpwardRounded, ArrowDownwardRounded, LockRounded,
    VisibilityRounded, VisibilityOffRounded,
} from "@mui/icons-material";
import { Tooltip, Chip } from "@mui/material";
import { BLOCK_TYPE_LABELS } from "../blocks/BlockRegistry";

export default function SectionToolbar({
    section,
    isSelected,
    isHovered,
    isFirst,
    isLast,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onRemove,
    onToggleVisibility,
}) {
    const visible = isSelected || isHovered;
    const label = BLOCK_TYPE_LABELS[section.type] || section.type;

    return (
        <>
            <div className={`wb-section-label-bar ${visible ? "visible" : ""}`}>
                <span className="wb-section-drag-hint">
                    <DragIndicatorRounded sx={{ fontSize: 14 }} />
                </span>
                <Chip
                    label={label}
                    size="small"
                    sx={{
                        height: 22,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        bgcolor: isSelected ? "primary.main" : "grey.800",
                        color: "#fff",
                    }}
                />
                {section.settings?.hidden && (
                    <Chip label="Gizli" size="small" color="warning" sx={{ height: 20, fontSize: 9 }} />
                )}
                {section.isLocked && (
                    <LockRounded sx={{ fontSize: 14, color: "warning.main" }} />
                )}
            </div>

            <div className={`wb-section-overlay ${visible ? "visible" : ""}`}>
                <Tooltip title={section.settings?.hidden ? "Göster" : "Gizle"}>
                    <button
                        type="button"
                        className="wb-section-action-btn"
                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(section.id); }}
                    >
                        {section.settings?.hidden
                            ? <VisibilityOffRounded sx={{ fontSize: 15 }} />
                            : <VisibilityRounded sx={{ fontSize: 15 }} />}
                    </button>
                </Tooltip>
                <Tooltip title="Yukarı taşı">
                    <button
                        type="button"
                        className="wb-section-action-btn"
                        onClick={(e) => { e.stopPropagation(); onMoveUp(section.id); }}
                        disabled={isFirst}
                        style={{ opacity: isFirst ? 0.35 : 1 }}
                    >
                        <ArrowUpwardRounded sx={{ fontSize: 15 }} />
                    </button>
                </Tooltip>
                <Tooltip title="Aşağı taşı">
                    <button
                        type="button"
                        className="wb-section-action-btn"
                        onClick={(e) => { e.stopPropagation(); onMoveDown(section.id); }}
                        disabled={isLast}
                        style={{ opacity: isLast ? 0.35 : 1 }}
                    >
                        <ArrowDownwardRounded sx={{ fontSize: 15 }} />
                    </button>
                </Tooltip>
                <Tooltip title="Çoğalt">
                    <button
                        type="button"
                        className="wb-section-action-btn"
                        onClick={(e) => { e.stopPropagation(); onDuplicate(section.id); }}
                    >
                        <ContentCopyRounded sx={{ fontSize: 15 }} />
                    </button>
                </Tooltip>
                {!section.isLocked && (
                    <Tooltip title="Sil">
                        <button
                            type="button"
                            className="wb-section-action-btn danger"
                            onClick={(e) => { e.stopPropagation(); onRemove(section.id); }}
                        >
                            <DeleteRounded sx={{ fontSize: 15 }} />
                        </button>
                    </Tooltip>
                )}
            </div>
        </>
    );
}
