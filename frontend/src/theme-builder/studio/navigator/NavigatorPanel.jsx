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
import { GripVertical, Copy, EyeOff, Trash2, ChevronUp, ChevronDown, PanelTop, PanelBottom } from "lucide-react";
import {
    HEADER_PANEL, FOOTER_PANEL,
} from "../../registry/constants";

const SECTION_ICONS = {
    hero: "H", slider: "S", "product-grid": "P", "category-grid": "C",
    testimonials: "★", newsletter: "✉", html: "<>", banner: "B", image: "I",
    text: "T", campaign: "!", countdown: "⏱", video: "▶", contact: "✎",
};

function SortableItem({
    id, label, type, selected, hidden, onSelect, onDuplicate, onToggleHide, onRemove, onMoveUp, onMoveDown,
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : hidden ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`tb-nav-item${selected ? " tb-nav-item--active" : ""}`}
            onClick={onSelect}
        >
            <button type="button" className="tb-nav-item__drag" {...attributes} {...listeners}>
                <GripVertical size={14} />
            </button>
            <span className="tb-nav-item__icon">{SECTION_ICONS[type] || label?.slice(0, 1)?.toUpperCase()}</span>
            <span className="tb-nav-item__label">{label}</span>
            <div className="tb-nav-item__actions">
                <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} title="Yukarı"><ChevronUp size={14} /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} title="Aşağı"><ChevronDown size={14} /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Kopyala"><Copy size={14} /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onToggleHide(); }} title="Gizle"><EyeOff size={14} /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Sil"><Trash2 size={14} /></button>
            </div>
        </div>
    );
}

export default function NavigatorPanel({
    sections = [],
    registry = [],
    selectedSectionId,
    selection,
    onSelectSection,
    onSelectGlobal,
    onReorder,
    onDuplicate,
    onToggleHide,
    onRemove,
    onMove,
    onAddSection,
    activePageKey,
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const labelFor = (section) => {
        const reg = registry.find((r) => r.key === section.type || r.defaults?.type === section.type);
        return reg?.label || section.type;
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = sections.findIndex((s) => s.id === active.id);
        const newIndex = sections.findIndex((s) => s.id === over.id);
        onReorder(arrayMove(sections, oldIndex, newIndex));
    };

    const globalActive = selection?.type === "global" ? selection.panel : null;

    return (
        <aside className="tb-navigator">
            <div className="tb-navigator__title">Sayfa yapısı</div>

            <button
                type="button"
                className={`tb-nav-tree-global${globalActive === HEADER_PANEL ? " tb-nav-tree-global--active" : ""}`}
                onClick={() => onSelectGlobal(HEADER_PANEL)}
            >
                <PanelTop size={15} /> Üst menü (Header)
            </button>

            <div className="tb-navigator__header">
                <span>Sayfa bölümleri</span>
                <button type="button" className="tb-btn tb-btn--primary tb-btn--sm" onClick={onAddSection}>
                    + Bölüm
                </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="tb-navigator__list">
                        {sections.map((section, idx) => (
                            <SortableItem
                                key={section.id}
                                id={section.id}
                                label={labelFor(section)}
                                type={section.type}
                                selected={selectedSectionId === section.id}
                                hidden={section.settings?.hidden}
                                onSelect={() => onSelectSection(section.id)}
                                onDuplicate={() => onDuplicate(section.id)}
                                onToggleHide={() => onToggleHide(section.id)}
                                onRemove={() => onRemove(section.id)}
                                onMoveUp={() => onMove(section.id, -1)}
                                onMoveDown={() => onMove(section.id, 1)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {!sections.length && (
                <p className="tb-navigator__empty">Henüz bölüm yok. Bölüm kütüphanesinden ekleyin.</p>
            )}

            <button
                type="button"
                className={`tb-nav-tree-global${globalActive === FOOTER_PANEL ? " tb-nav-tree-global--active" : ""}`}
                onClick={() => onSelectGlobal(FOOTER_PANEL)}
            >
                <PanelBottom size={15} /> Alt menü (Footer)
            </button>
        </aside>
    );
}
