import React, { useRef, useCallback, useState } from "react";
import { BlockPreview } from "../blocks/BlockRegistry";
import { AddRounded, PaletteOutlined } from "@mui/icons-material";
import SectionToolbar from "./SectionToolbar";

function DropZone({ index, isActive, onDrop }) {
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData("blockType");
        if (blockType) onDrop(blockType, index);
    };

    return (
        <div
            className={`wb-drop-zone ${isActive ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isActive && <><AddRounded style={{ fontSize: 14 }} /> Buraya bırakın</>}
        </div>
    );
}

function SectionWrapper({
    section,
    isSelected,
    isFirst,
    isLast,
    device,
    onSelect,
    onRemove,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onToggleVisibility,
    children,
}) {
    const [hovered, setHovered] = useState(false);
    const settings = section.settings || {};
    const hiddenOnDevice =
        (device === "mobile" && settings.hiddenOnMobile)
        || (device === "tablet" && settings.hiddenOnMobile)
        || (device === "desktop" && settings.hiddenOnDesktop);

    return (
        <div
            className={[
                "wb-section-wrapper",
                isSelected ? "selected" : "",
                hovered ? "hovered" : "",
                settings.hidden ? "section-hidden" : "",
                hiddenOnDevice ? "section-hidden-device" : "",
            ].filter(Boolean).join(" ")}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
        >
            <SectionToolbar
                section={section}
                isSelected={isSelected}
                isHovered={hovered}
                isFirst={isFirst}
                isLast={isLast}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
                onToggleVisibility={onToggleVisibility}
            />
            <div className="wb-section-preview-body">
                {children}
            </div>
            {(settings.hidden || hiddenOnDevice) && (
                <div className="wb-section-hidden-badge">
                    {settings.hidden ? "Gizli bölüm" : "Bu cihazda gizli"}
                </div>
            )}
        </div>
    );
}

const DEVICE_BASE_WIDTH = {
    desktop: 1280,
    tablet: 768,
    mobile: 390,
};

export default function EditorCanvas({
    sections,
    selectedSectionId,
    device,
    themeVariables,
    dragOverIndex,
    zoom = 100,
    fitScale = 1,
    onSectionSelect,
    onCanvasClick,
    onSectionRemove,
    onSectionDuplicate,
    onMoveSectionUp,
    onMoveSectionDown,
    onToggleVisibility,
    onDragOver,
    onDrop,
    onAddSection,
    previewProduct,
}) {
    const canvasRef = useRef(null);
    const scale = zoom === "fit" ? fitScale : zoom / 100;
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    const handleCanvasClick = useCallback((e) => {
        if (e.target === canvasRef.current || e.currentTarget === e.target) {
            onCanvasClick();
        }
    }, [onCanvasClick]);

    const handleDrop = useCallback((blockType, insertAfterIndex) => {
        onDrop(blockType, insertAfterIndex);
    }, [onDrop]);

    const cssVars = {
        "--color-primary": themeVariables?.primaryColor,
        "--color-secondary": themeVariables?.secondaryColor,
        "--font-body": themeVariables?.fontFamily,
        "--font-heading": themeVariables?.headingFont,
        "--border-radius": themeVariables?.borderRadius,
        "--color-bg": themeVariables?.backgroundColor,
        "--color-surface": themeVariables?.surfaceColor,
        "--color-text-primary": themeVariables?.textPrimary,
        "--color-text-secondary": themeVariables?.textSecondary,
        "--color-border": themeVariables?.borderColor,
    };

    return (
        <div className="wb-canvas-wrapper" onClick={handleCanvasClick}>
            <div
                className="wb-canvas-zoom-stage"
                style={{
                    transform: `scale(${scale})`,
                    width: device === "desktop" ? "100%" : DEVICE_BASE_WIDTH[device],
                    maxWidth: device === "desktop" ? DEVICE_BASE_WIDTH.desktop : DEVICE_BASE_WIDTH[device],
                }}
            >
            <div
                className={`wb-canvas device-${device}`}
                ref={canvasRef}
                style={cssVars}
            >
                {sortedSections.length === 0 && (
                    <div
                        className="wb-empty-canvas"
                        onDragOver={(e) => { e.preventDefault(); onDragOver(0); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            const t = e.dataTransfer.getData("blockType");
                            if (t) onDrop(t, -1);
                        }}
                    >
                        <PaletteOutlined className="wb-empty-canvas-icon" sx={{ fontSize: 48, color: "#94a3b8", opacity: 0.5 }} />
                        <div className="wb-empty-canvas-text">
                            Sol kütüphaneden bir blok sürükleyin veya tıklayarak ekleyin.
                        </div>
                        <div className="wb-empty-canvas-hint">
                            Mobilde + düğmesini kullanabilirsiniz.
                        </div>
                    </div>
                )}

                {sortedSections.length > 0 && (
                    <DropZone index={-1} isActive={dragOverIndex === -1} onDrop={(t) => handleDrop(t, -1)} />
                )}

                {sortedSections.map((section, idx) => (
                    <React.Fragment key={section.id}>
                        <SectionWrapper
                            section={section}
                            isSelected={selectedSectionId === section.id}
                            isFirst={idx === 0}
                            isLast={idx === sortedSections.length - 1}
                            device={device}
                            onSelect={onSectionSelect}
                            onRemove={onSectionRemove}
                            onDuplicate={onSectionDuplicate}
                            onMoveUp={onMoveSectionUp}
                            onMoveDown={onMoveSectionDown}
                            onToggleVisibility={onToggleVisibility}
                        >
                            <BlockPreview
                                section={section}
                                themeVariables={themeVariables}
                                isSelected={selectedSectionId === section.id}
                                device={device}
                                previewProduct={previewProduct}
                            />
                        </SectionWrapper>
                        <DropZone index={idx} isActive={dragOverIndex === idx} onDrop={(t) => handleDrop(t, idx)} />
                    </React.Fragment>
                ))}

                {sortedSections.length > 0 && (
                    <button
                        type="button"
                        className="wb-add-section-cta"
                        onClick={() => onAddSection("hero")}
                    >
                        <AddRounded sx={{ fontSize: 18, mr: 0.5 }} />
                        Blok ekle
                    </button>
                )}
            </div>
            </div>
        </div>
    );
}
