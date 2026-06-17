import React from "react";
import ThemeMarketplacePage from "../../../theme-builder/pages/ThemeMarketplacePage";
import { SB_V5_MARKETPLACE_PANEL, SB_V5_MY_THEMES_PANEL } from "../../../constants/storeBuilderV5";

/** E-ticaret görünüm mağazası — v3 tema mağazası (dashboard içi) */
export default function AppearanceMarketplacePage({ siteId, onNavigate, onExitToProgram }) {
    if (!siteId) {
        return (
            <div style={{ padding: 24, color: "#64748b" }}>
                Önce bir mağaza seçin.
            </div>
        );
    }

    return (
        <ThemeMarketplacePage
            siteId={siteId}
            embedded
            onExitToProgram={onExitToProgram}
            onPanelNavigate={(panelId) => {
                if (panelId === "ec-wb-my-themes") onNavigate?.(SB_V5_MY_THEMES_PANEL);
                else onNavigate?.(SB_V5_MARKETPLACE_PANEL);
            }}
        />
    );
}
