import React from "react";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import MarketingDashboardPage from "./MarketingDashboardPage";
import MarketingCampaignsPage from "./MarketingCampaignsPage";
import MarketingAutomationsPage from "./MarketingAutomationsPage";
import MarketingAutomationBuilderPage from "./MarketingAutomationBuilderPage";
import MarketingSegmentsPage from "./MarketingSegmentsPage";
import MarketingPopupsPage from "./MarketingPopupsPage";
import MarketingAffiliatePage from "./MarketingAffiliatePage";
import MarketingReportsPage from "./MarketingReportsPage";
import MarketingSettingsPage from "./MarketingSettingsPage";
import { MARKETING_DEFAULT_PANEL } from "../../constants/marketingMenu";
import MarketingSubNav from "./components/MarketingSubNav";
import "../../styles/ecommerceTheme.css";
import "../../styles/marketing.css";

const MarketingHub = ({ panelId, onNavigate }) => {
    const { rootClassName, rootStyle, isDark } = useDashtockTheme();
    const pid = panelId || MARKETING_DEFAULT_PANEL;

    let content = <MarketingDashboardPage />;
    if (pid === "mkt-dashboard") content = <MarketingDashboardPage onNavigate={onNavigate} />;
    else if (pid === "mkt-campaigns-email") content = <MarketingCampaignsPage campaignType="EMAIL" />;
    else if (pid === "mkt-campaigns-sms") content = <MarketingCampaignsPage campaignType="SMS" />;
    else if (pid === "mkt-automations") content = <MarketingAutomationsPage onNavigate={onNavigate} />;
    else if (pid.startsWith("mkt-automation-")) {
        const id = pid.replace("mkt-automation-", "");
        content = <MarketingAutomationBuilderPage automationId={id} onNavigate={onNavigate} />;
    } else if (pid === "mkt-segments") content = <MarketingSegmentsPage />;
    else if (pid === "mkt-popups") content = <MarketingPopupsPage />;
    else if (pid === "mkt-affiliate") content = <MarketingAffiliatePage />;
    else if (pid === "mkt-reports") content = <MarketingReportsPage />;
    else if (pid === "mkt-settings") content = <MarketingSettingsPage onNavigate={onNavigate} />;

    return (
        <div
            className={`dashboard-home-layout ec-theme-root ec-prod-layout-full mkt-layout ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={rootStyle}
        >
            <div className="ec-page-body ec-page-body--flush">
                <MarketingSubNav activePanel={pid} onNavigate={onNavigate} />
                {content}
            </div>
        </div>
    );
};

export default MarketingHub;
