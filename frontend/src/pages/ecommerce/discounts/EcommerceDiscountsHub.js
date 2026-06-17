import React from "react";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import EcommerceCampaignsListPage from "./EcommerceCampaignsListPage";
import EcommerceCouponsListPage from "./EcommerceCouponsListPage";
import EcommerceCampaignFormPage from "./EcommerceCampaignFormPage";
import EcommerceCouponFormPage from "./EcommerceCouponFormPage";
import EcommerceCampaignEditRouter from "./EcommerceCampaignEditRouter";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceDiscounts.css";

const EcommerceDiscountsHub = ({ panelId, onNavigate }) => {
    const { rootClassName, rootStyle, isDark } = useDashtockTheme();

    const wrap = (content) => (
        <div
            className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={rootStyle}
        >
            <div className="ec-page-body ec-page-body--flush">{content}</div>
        </div>
    );

    if (panelId === "ec-discounts-campaigns" || panelId === "ec-discounts") {
        return wrap(<EcommerceCampaignsListPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-discounts-coupons") {
        return wrap(<EcommerceCouponsListPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-campaign-auto-create") {
        return wrap(<EcommerceCampaignFormPage initialKind="automatic" onNavigate={onNavigate} />);
    }

    if (panelId === "ec-campaign-code-create") {
        return wrap(<EcommerceCouponFormPage onNavigate={onNavigate} />);
    }

    if (panelId?.startsWith("ec-campaign-edit-")) {
        const id = panelId.replace("ec-campaign-edit-", "");
        if (id) return wrap(<EcommerceCampaignEditRouter campaignId={id} onNavigate={onNavigate} />);
    }

    return wrap(<EcommerceCampaignsListPage onNavigate={onNavigate} />);
};

export default EcommerceDiscountsHub;
