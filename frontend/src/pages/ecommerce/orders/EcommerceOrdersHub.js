import React from "react";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import EcommerceOrdersListPage from "./EcommerceOrdersListPage";
import EcommerceOrderDetailPage from "./EcommerceOrderDetailPage";
import EcommerceOrderCreatePage from "./EcommerceOrderCreatePage";
import EcommerceOrderTagsPage from "./EcommerceOrderTagsPage";
import EcommerceAbandonedCartsPage from "./EcommerceAbandonedCartsPage";
import EcommerceGiftCardsListPage from "./EcommerceGiftCardsListPage";
import EcommerceGiftCardFormPage from "./EcommerceGiftCardFormPage";
import EcommerceGiftCardDetailPage from "./EcommerceGiftCardDetailPage";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceGiftCards.css";

const EcommerceOrdersHub = ({ panelId, onNavigate }) => {
    const { rootClassName, rootStyle, isDark } = useDashtockTheme();

    const wrap = (content) => (
        <div
            className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={rootStyle}
        >
            <div className="ec-page-body ec-page-body--flush">{content}</div>
        </div>
    );

    if (panelId === "ec-orders" || panelId === "ec-orders-list") {
        return wrap(<EcommerceOrdersListPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-orders-drafts") {
        return wrap(
            <EcommerceOrdersListPage
                onNavigate={onNavigate}
                draftMode
                title="Taslak Siparişler"
            />
        );
    }

    if (panelId === "ec-orders-abandoned") {
        return wrap(<EcommerceAbandonedCartsPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-orders-tags") {
        return wrap(<EcommerceOrderTagsPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-order-create") {
        return wrap(<EcommerceOrderCreatePage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-orders-gift-cards") {
        return wrap(<EcommerceGiftCardsListPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-gift-card-create") {
        return wrap(<EcommerceGiftCardFormPage onNavigate={onNavigate} />);
    }

    if (panelId?.startsWith("ec-gift-card-edit-")) {
        const id = panelId.replace("ec-gift-card-edit-", "");
        if (id) return wrap(<EcommerceGiftCardFormPage giftCardId={id} onNavigate={onNavigate} />);
    }

    if (panelId?.startsWith("ec-gift-card-") && panelId !== "ec-gift-card-create") {
        const id = panelId.replace("ec-gift-card-", "");
        if (id && !id.startsWith("edit-")) {
            return wrap(<EcommerceGiftCardDetailPage giftCardId={id} onNavigate={onNavigate} />);
        }
    }

    if (panelId?.startsWith("ec-order-") && panelId !== "ec-order-create") {
        const id = panelId.replace("ec-order-", "");
        if (id && id !== "create") {
            return wrap(<EcommerceOrderDetailPage orderId={id} onNavigate={onNavigate} />);
        }
    }

    return wrap(<EcommerceOrdersListPage onNavigate={onNavigate} />);
};

export default EcommerceOrdersHub;
