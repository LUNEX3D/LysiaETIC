import React from "react";
import { OpenInNewRounded, AddRounded, PaletteRounded } from "@mui/icons-material";
import { getPlatformTopbarTitle } from "./EcommercePlatformSidebar";
import { SB_V5_EDITOR_PANEL, SB_V5_MARKETPLACE_PANEL, SB_V5_DESIGN_STUDIO_PANEL } from "../../../constants/storeBuilderV5";

export default function EcommercePlatformTopbar({
    activePanel,
    language = "tr",
    liveUrl,
    onNavigate,
    onAddProduct,
}) {
    const en = language === "en";
    const title = getPlatformTopbarTitle(activePanel, language);

    return (
        <header className="ec-platform-topbar">
            <h1 className="ec-platform-topbar__title">{title}</h1>
            <div className="ec-platform-topbar__actions">
                {liveUrl && (
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="ec-platform-topbar__btn">
                        <OpenInNewRounded sx={{ fontSize: 16 }} />
                        {en ? "View store" : "Mağazayı aç"}
                    </a>
                )}
                <button type="button" className="ec-platform-topbar__btn" onClick={() => onNavigate?.(SB_V5_DESIGN_STUDIO_PANEL)}>
                    <PaletteRounded sx={{ fontSize: 16 }} />
                    {en ? "Theme styles" : "Tema stilleri"}
                </button>
                <button type="button" className="ec-platform-topbar__btn" onClick={() => onNavigate?.(SB_V5_MARKETPLACE_PANEL)}>
                    {en ? "Themes" : "Temalar"}
                </button>
                <button type="button" className="ec-platform-topbar__btn ec-platform-topbar__btn--primary" onClick={onAddProduct}>
                    <AddRounded sx={{ fontSize: 16 }} />
                    {en ? "Add product" : "Ürün ekle"}
                </button>
            </div>
        </header>
    );
}
