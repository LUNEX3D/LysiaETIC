import React from "react";
import { Box } from "@mui/material";
import { FileText, ChevronDown, PanelTop, PanelBottom } from "lucide-react";
import StoreSectionTree from "./StoreSectionTree";
import { pageTypeLabel } from "../../../constants/storeBuilderNav";

export default function StorePageTree({
    currentPage,
    sections = [],
    selectedSectionId,
    selectedGlobalKey,
    onSelectSection,
    onSelectGlobal,
    onAddSection,
    onReorder,
    onDuplicate,
    onToggleVisibility,
    onRemove,
}) {
    const pageLabel = pageTypeLabel(currentPage) || currentPage?.title || "Ana Sayfa";

    return (
        <Box className="wb-store-page-tree">
            <div className="wb-store-page-tree__root">
                <FileText size={16} className="wb-store-page-tree__root-icon" />
                <span className="wb-store-page-tree__root-label">{pageLabel}</span>
                <ChevronDown size={14} className="wb-store-page-tree__root-chev" />
            </div>
            <div className="wb-store-page-tree__branch">
                <button
                    type="button"
                    className={`wb-store-global-node${selectedGlobalKey === "header" ? " is-active" : ""}`}
                    onClick={() => onSelectGlobal?.("header")}
                >
                    <PanelTop size={14} />
                    <span>Header</span>
                </button>
                <StoreSectionTree
                    sections={sections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={onSelectSection}
                    onAddSection={onAddSection}
                    onReorder={onReorder}
                    onDuplicate={onDuplicate}
                    onToggleVisibility={onToggleVisibility}
                    onRemove={onRemove}
                />
                <button
                    type="button"
                    className={`wb-store-global-node${selectedGlobalKey === "footer" ? " is-active" : ""}`}
                    onClick={() => onSelectGlobal?.("footer")}
                >
                    <PanelBottom size={14} />
                    <span>Footer</span>
                </button>
            </div>
        </Box>
    );
}
