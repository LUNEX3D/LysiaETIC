import React from "react";
import { Box, CircularProgress } from "@mui/material";
import EcommerceWbChannelHub from "../EcommerceWbChannelHub";
import EcommerceStoreSettingsHub from "./EcommerceStoreSettingsHub";
import AppsMarketplacePage from "./AppsMarketplacePage";
import StorePlaceholder from "../../store/StorePlaceholder";
import { isEcChannelSectionPanel } from "../../../constants/ecStoreChannelNav";
import { isEcWbChannelPanel, STORE_SECTION_META } from "../../../constants/ecommerceMenu";

const CHANNEL_SECTION_META = {
    automations: STORE_SECTION_META["store-automations"],
    notifications: STORE_SECTION_META["store-notifications"],
    customers: STORE_SECTION_META["store-customers"],
    shipping: STORE_SECTION_META["store-shipping"],
};

export default function EcSalesChannelWorkspace({
    panelId,
    siteId,
    language = "tr",
    onNavigate,
    onExitToProgram,
    onOpenEditor,
    editorIntent,
    onEditorIntentConsumed,
}) {
    const en = language === "en";

    if (!siteId && isEcWbChannelPanel(panelId)) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                <CircularProgress sx={{ color: "#0d9488" }} />
            </Box>
        );
    }

    if (isEcWbChannelPanel(panelId)) {
        return (
            <EcommerceWbChannelHub
                key={panelId}
                panelId={panelId}
                siteId={siteId}
                onNavigate={onNavigate}
                onExitToProgram={onExitToProgram}
                onOpenEditor={onOpenEditor}
                editorIntent={editorIntent}
                onEditorIntentConsumed={onEditorIntentConsumed}
                inline
            />
        );
    }

    if (panelId === "ec-channel-plugins") {
        return <AppsMarketplacePage language={language} />;
    }

    if (panelId === "ec-channel-payments") {
        return <EcommerceStoreSettingsHub onNavigate={onNavigate} initialTab="payments" />;
    }

    if (isEcChannelSectionPanel(panelId)) {
        const key = panelId.replace("ec-channel-", "");
        const meta = CHANNEL_SECTION_META[key];
        if (meta) {
            return <StorePlaceholder title={meta.title} description={meta.text} />;
        }
    }

    return (
        <StorePlaceholder
            title={en ? "Section" : "Bölüm"}
            description={en ? "This section will be available soon." : "Bu bölüm yakında eklenecek."}
        />
    );
}
