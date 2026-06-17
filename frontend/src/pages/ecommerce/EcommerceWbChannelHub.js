import React, { useEffect, useState } from "react";
import { FaGlobe } from "react-icons/fa";
import { Box, CircularProgress } from "@mui/material";
import EcSeoHub from "./platform/EcSeoHub";
import SiteSettings from "../websiteBuilder/SiteSettings";
import BlogPostList from "../websiteBuilder/BlogPostList";
import NavigationBuilder from "../websiteBuilder/NavigationBuilder";
import PopupCenter from "../websiteBuilder/PopupCenter";
import FormCenter from "../websiteBuilder/FormCenter";
import DomainCenter from "../websiteBuilder/DomainCenter";
import EcPublishHub from "./platform/EcPublishHub";
import EcBrandEmailHub from "./platform/EcBrandEmailHub";
import EcUrlRedirectsHub from "./platform/EcUrlRedirectsHub";
import EcPerformanceHub from "./platform/EcPerformanceHub";
import EcThemeStudioRedirect from "./platform/EcThemeStudioRedirect";
import MyThemesPage from "../../theme-builder/pages/MyThemesPage";
import ThemeMarketplacePage from "../../theme-builder/pages/ThemeMarketplacePage";
import {
    ecWbPanelToSegment,
    ecWbSegmentToPanel,
} from "../../constants/ecommerceMenu";
import "../../styles/ecommerceWbChannel.css";
import "../../styles/ecStoreHubLight.css";

function segmentFromPanel(panelId) {
    return ecWbPanelToSegment(panelId);
}

export default function EcommerceWbChannelHub({
    panelId,
    siteId,
    onNavigate,
    onExitToProgram,
    language = "tr",
    inline = false,
}) {
    const segment = segmentFromPanel(panelId);

    const [site, setSite] = useState(null);

    useEffect(() => {
        if (!siteId) {
            setSite(null);
            return;
        }
        let cancelled = false;
        import("../../services/websiteBuilderApi")
            .then((wbApi) => wbApi.getSite(siteId))
            .then((d) => {
                if (!cancelled) setSite(d.site || null);
            })
            .catch(() => {
                if (!cancelled) setSite(null);
            });
        return () => {
            cancelled = true;
        };
    }, [siteId]);

    if (!siteId) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                <CircularProgress sx={{ color: "#6366f1" }} />
            </Box>
        );
    }

    const wrapMain = (node) =>
        inline ? (
            <div className="ec-hub-canvas">{node}</div>
        ) : (
            <div className="ec-wb-channel-main ec-wb-channel-main--workspace ec-hub-canvas">{node}</div>
        );

    let content;
    switch (segment) {
        case "publish":
            content = (
                <EcPublishHub
                    siteId={siteId}
                    onNavigate={(seg) => onNavigate?.(ecWbSegmentToPanel(seg))}
                />
            );
            break;
        case "brand-email":
            content = <EcBrandEmailHub siteId={siteId} />;
            break;
        case "url-redirects":
            content = <EcUrlRedirectsHub siteId={siteId} />;
            break;
        case "performance":
            content = <EcPerformanceHub siteId={siteId} />;
            break;
        case "seo":
            content = <EcSeoHub siteId={siteId} />;
            break;
        case "popups":
            content = <PopupCenter siteId={siteId} />;
            break;
        case "forms":
            content = <FormCenter siteId={siteId} />;
            break;
        case "settings":
            content = <SiteSettings siteId={siteId} />;
            break;
        case "blog":
            content = <BlogPostList siteId={siteId} />;
            break;
        case "navigation":
            content = <NavigationBuilder siteId={siteId} />;
            break;
        case "domain":
            content = (
                <div className="eph-page eph-page--light ec-domain-hub">
                    <header className="eph-header">
                        <div className="eph-header-icon"><FaGlobe /></div>
                        <div>
                            <h1>Alan Adları</h1>
                            <p>Özel domain bağlayın — DNS otomatik kontrol, SSL otomatik üretilir</p>
                        </div>
                    </header>
                    <DomainCenter siteId={siteId} embedded />
                </div>
            );
            break;
        case "my-themes":
        case "theme-manage":
        case "themes":
        case "center":
            content = (
                <MyThemesPage
                    siteId={siteId}
                    embedded
                    site={site}
                    onPanelNavigate={onNavigate}
                    onExitToProgram={onExitToProgram}
                />
            );
            break;
        case "marketplace":
        case "themes-marketplace":
            content = (
                <ThemeMarketplacePage
                    siteId={siteId}
                    embedded
                    onPanelNavigate={onNavigate}
                    onExitToProgram={onExitToProgram}
                />
            );
            break;
        case "editor":
        case "themes-editor":
            content = <EcThemeStudioRedirect siteId={siteId} language={language} mode="sections" />;
            break;
        case "design-studio":
            content = <EcThemeStudioRedirect siteId={siteId} language={language} mode="brand" />;
            break;
        default:
            content = (
                <MyThemesPage
                    siteId={siteId}
                    embedded
                    site={site}
                    onPanelNavigate={onNavigate}
                    onExitToProgram={onExitToProgram}
                />
            );
            break;
    }

    return wrapMain(content);
}
