import React from "react";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import EcommerceCustomersListPage from "./EcommerceCustomersListPage";
import EcommerceCustomerFormPage from "./EcommerceCustomerFormPage";
import EcommerceCustomerDetailPage from "./EcommerceCustomerDetailPage";
import EcommerceCustomerGroupsPage from "./EcommerceCustomerGroupsPage";
import EcommerceCustomerGroupFormPage from "./EcommerceCustomerGroupFormPage";
import EcommerceCustomerTagsPage from "./EcommerceCustomerTagsPage";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const EcommerceCustomersHub = ({ panelId, onNavigate }) => {
    const { rootClassName, rootStyle, isDark } = useDashtockTheme();

    const wrap = (content) => (
        <div
            className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={rootStyle}
        >
            <div className="ec-page-body ec-page-body--flush">{content}</div>
        </div>
    );

    if (panelId === "ec-customers") {
        return wrap(<EcommerceCustomersListPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-customers-groups") {
        return wrap(<EcommerceCustomerGroupsPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-customer-group-create") {
        return wrap(<EcommerceCustomerGroupFormPage onNavigate={onNavigate} />);
    }

    if (panelId?.startsWith("ec-customer-group-edit-")) {
        const id = panelId.replace("ec-customer-group-edit-", "");
        if (id) return wrap(<EcommerceCustomerGroupFormPage groupId={id} onNavigate={onNavigate} />);
    }

    if (panelId === "ec-customers-tags") {
        return wrap(<EcommerceCustomerTagsPage onNavigate={onNavigate} />);
    }

    if (panelId === "ec-customer-create") {
        return wrap(<EcommerceCustomerFormPage onNavigate={onNavigate} />);
    }

    if (panelId?.startsWith("ec-customer-edit-")) {
        const id = panelId.replace("ec-customer-edit-", "");
        if (id) return wrap(<EcommerceCustomerFormPage customerId={id} onNavigate={onNavigate} />);
    }

    if (panelId?.startsWith("ec-customer-") && !panelId.startsWith("ec-customer-group")) {
        const id = panelId.replace("ec-customer-", "");
        if (id && id !== "create" && !id.startsWith("edit-")) {
            return wrap(<EcommerceCustomerDetailPage customerId={id} onNavigate={onNavigate} />);
        }
    }

    return wrap(<EcommerceCustomersListPage onNavigate={onNavigate} />);
};

export default EcommerceCustomersHub;
