import React from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, Button } from "@mui/material";
import {
    GripVertical, Copy, EyeOff, Trash2, ChevronDown, LayoutGrid,
} from "lucide-react";
import WBEmptyState from "../layout/WBEmptyState";
import { BLOCK_TYPE_LABELS } from "../blocks/BlockRegistry";

function sectionDisplayLabel(section) {
    return BLOCK_TYPE_LABELS[section.type] || section.type || "Bölüm";
}

function SortableSectionNode({
    section,
    selectedSectionId,
    onSelectSection,
    onDuplicate,
    onToggleVisibility,
    onRemove,
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
    });
    const label = sectionDisplayLabel(section) || BLOCK_TYPE_LABELS[section.type] || section.type;
    const active = selectedSectionId === section.id;
    const hidden = section.settings?.hidden;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.9 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`wb-store-section-node${active ? " is-active" : ""}${hidden ? " is-hidden" : ""}${isDragging ? " is-dragging" : ""}`}
        >
            <button type="button" className="wb-store-section-node__drag lysia-transition" {...attributes} {...listeners}>
                <GripVertical size={14} />
            </button>
            <ChevronDown size={14} className="wb-store-section-node__chev" />
            <button type="button" className="wb-store-section-node__label lysia-transition" onClick={() => onSelectSection(section)}>
                {label}
            </button>
            <div className="wb-store-section-node__actions">
                <button type="button" title="Kopyala" className="lysia-transition" onClick={() => onDuplicate?.(section.id)}>
                    <Copy size={14} />
                </button>
                <button type="button" title={hidden ? "Göster" : "Gizle"} className="lysia-transition" onClick={() => onToggleVisibility?.(section.id)}>
                    <EyeOff size={14} />
                </button>
                <button type="button" title="Sil" className="wb-store-section-node__danger lysia-transition" onClick={() => onRemove?.(section.id)}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

export default function StoreSectionTree({
    sections = [],
    selectedSectionId,
    onSelectSection,
    onAddSection,
    onReorder,
    onDuplicate,
    onToggleVisibility,
    onRemove,
}) {
    const sorted = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const ids = sorted.map((s) => s.id);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = sorted.findIndex((s) => s.id === active.id);
        const newIndex = sorted.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const reordered = arrayMove(sorted, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
        onReorder?.(reordered);
    };

    return (
        <Box className="wb-store-section-tree">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="wb-store-section-tree__list">
                        {sorted.map((section) => (
                            <SortableSectionNode
                                key={section.id}
                                section={section}
                                selectedSectionId={selectedSectionId}
                                onSelectSection={onSelectSection}
                                onDuplicate={onDuplicate}
                                onToggleVisibility={onToggleVisibility}
                                onRemove={onRemove}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            {!sorted.length && (
                <WBEmptyState variant="sections" compact title="Bölüm yok" description="Bölüm kütüphanesinden ekleyin." />
            )}
            <Button
                fullWidth
                size="small"
                startIcon={<LayoutGrid size={16} />}
                onClick={onAddSection}
                className="wb-store-section-tree__library-btn lysia-transition"
                sx={{
                    mt: 2,
                    textTransform: "none",
                    color: "#e4e4e7",
                    borderStyle: "dashed",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                }}
            >
                Bölüm kütüphanesi
            </Button>
        </Box>
    );
}
