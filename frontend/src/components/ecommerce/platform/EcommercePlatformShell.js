import React, { useEffect, useState } from "react";
import EcommercePlatformSidebar from "./EcommercePlatformSidebar";
import EcommercePlatformTopbar from "./EcommercePlatformTopbar";
import {
    isEcPlatformEditorPanel,
    isEcPlatformFullBleed,
} from "../../../constants/ecommercePlatform";
import { isEcWbFullBleedPanel } from "../../../constants/ecommerceMenu";
import { isEcSalesChannelWorkspacePanel } from "../../../constants/ecStoreChannelNav";
import { isSbV5FullBleedPanel } from "../../../constants/storeBuilderV5";
import * as wbApi from "../../../services/websiteBuilderApi";
import { getLiveSiteUrls } from "../../../utils/wbStorefrontHost";
import "../../../styles/ecommercePlatform.css";
import "../../../styles/ecStoreHubLight.css";

/**
 * V6 — Tek platform kabuğu (Shopify Admin / İkas panel)
 */
export default function EcommercePlatformShell({
    activePanel,
    activeSite,
    language,
    onNavigate,
    onSwitchStore,
    onExitToProgram,
    children,
}) {
    const [liveUrl, setLiveUrl] = useState("");
    const fullBleed = isSbV5FullBleedPanel(activePanel) || isEcWbFullBleedPanel(activePanel);
    const isEditor = isEcPlatformEditorPanel(activePanel);
    const inSalesChannel = isEcSalesChannelWorkspacePanel(activePanel);
    const hideTopbar = fullBleed || isEditor || inSalesChannel;

    useEffect(() => {
        if (!activeSite?.id) return;
        let cancelled = false;
        wbApi.getSite(activeSite.id)
            .then((d) => {
                if (cancelled) return;
                const urls = getLiveSiteUrls(d.site || {});
                setLiveUrl(urls.primary || urls.path || "");
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [activeSite?.id]);

    const handleAddProduct = () => {
        onNavigate?.("ec-product-add-simple");
    };

    return (
        <div className="ec-platform">
            <div className="ec-platform__body">
                {!fullBleed && !isEditor && (
                    <EcommercePlatformSidebar
                        activePanel={activePanel}
                        activeSite={activeSite}
                        language={language}
                        onNavigate={onNavigate}
                        onSwitchStore={onSwitchStore}
                        onExitToProgram={onExitToProgram}
                    />
                )}
                <div
                    className={`ec-platform-stage${isEditor ? " ec-platform-stage--editor" : ""}${fullBleed ? " ec-platform-stage--fullbleed" : ""}`}
                >
                    {!hideTopbar && (
                        <EcommercePlatformTopbar
                            activePanel={activePanel}
                            language={language}
                            liveUrl={liveUrl}
                            onNavigate={onNavigate}
                            onAddProduct={handleAddProduct}
                        />
                    )}
                    <main
                        className={`ec-platform-main${isEditor ? " ec-platform-main--editor" : ""}${fullBleed ? " ec-platform-main--fullbleed" : ""}${inSalesChannel ? " ec-platform-main--channel" : ""}`}
                    >
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
