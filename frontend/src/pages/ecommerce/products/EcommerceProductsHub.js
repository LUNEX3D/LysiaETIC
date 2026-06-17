import React from "react";
import { ECOMMERCE_PRODUCTS_PLACEHOLDER_META } from "../../../constants/ecommerceMenu";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import EcommerceSectionPage from "../EcommerceSectionPage";
import EcommerceDefinitionsHub from "../definitions/EcommerceDefinitionsHub";
import StoreCategoriesPage from "../definitions/StoreCategoriesPage";
import StoreCategoryFormPage from "../definitions/StoreCategoryFormPage";
import StoreBrandsPage from "../definitions/StoreBrandsPage";
import StoreTagsPage from "../definitions/StoreTagsPage";
import StoreUnitsPage from "../definitions/StoreUnitsPage";
import StoreBrandFormPage from "../definitions/StoreBrandFormPage";
import StoreCustomFieldsPage from "../definitions/StoreCustomFieldsPage";
import StoreVariantTypesPage from "../definitions/StoreVariantTypesPage";
import StoreProductGroupsPage from "../definitions/StoreProductGroupsPage";
import StoreProductGroupFormPage from "../definitions/StoreProductGroupFormPage";
import StoreSuppliersPage from "../definitions/StoreSuppliersPage";
import StoreSupplierFormPage from "../definitions/StoreSupplierFormPage";
import StoreProductPersonalizationsPage from "../definitions/StoreProductPersonalizationsPage";
import StoreProductPersonalizationFormPage from "../definitions/StoreProductPersonalizationFormPage";
import StoreProductPersonalizationOptionPage from "../definitions/StoreProductPersonalizationOptionPage";
import StoreCartLinkFormPage from "../definitions/StoreCartLinkFormPage";
import EcommerceProductsList from "./EcommerceProductsList";
import EcommerceProductForm from "./EcommerceProductForm";
import EcommercePurchasesPage from "../purchases/EcommercePurchasesPage";
import EcommercePurchaseAddPage from "../purchases/EcommercePurchaseAddPage";
import EcommerceTransfersPage from "../transfers/EcommerceTransfersPage";
import EcommerceTransferAddPage from "../transfers/EcommerceTransferAddPage";
import EcommerceStockCountsPage from "../stockCount/EcommerceStockCountsPage";
import EcommerceStockCountAddPage from "../stockCount/EcommerceStockCountAddPage";
import EcommerceStockCountWorkPage from "../stockCount/EcommerceStockCountWorkPage";
import EcommerceBarcodeLabelPage from "../barcode/EcommerceBarcodeLabelPage";
import EcommerceBarcodeLabelContinuePage from "../barcode/EcommerceBarcodeLabelContinuePage";
import "../../../styles/ecommerceProducts.css";

const EcommerceProductsHub = ({ panelId, onNavigate }) => {
    const { rootClassName, rootStyle, isDark } = useDashtockTheme();

    if (panelId === "ec-product-add-simple") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <EcommerceProductForm mode="simple" onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-product-add-variant") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <EcommerceProductForm mode="variant" onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId?.startsWith("ec-product-edit-")) {
        const id = panelId.replace("ec-product-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <EcommerceProductForm productId={id} onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-products") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommerceProductsList onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-purchase") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommercePurchasesPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-purchase-add" || panelId?.startsWith("ec-purchase-edit-")) {
        const purchaseId = panelId?.startsWith("ec-purchase-edit-")
            ? panelId.replace("ec-purchase-edit-", "")
            : null;
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommercePurchaseAddPage onNavigate={onNavigate} purchaseId={purchaseId} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-transfers") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommerceTransfersPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-transfer-add" || panelId?.startsWith("ec-transfer-edit-")) {
        const transferId = panelId?.startsWith("ec-transfer-edit-")
            ? panelId.replace("ec-transfer-edit-", "")
            : null;
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommerceTransferAddPage onNavigate={onNavigate} transferId={transferId} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-stock-count") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommerceStockCountsPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-stock-count-add") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommerceStockCountAddPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-stock-count-work-")) {
        const countId = panelId.replace("ec-stock-count-work-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <EcommerceStockCountWorkPage countId={countId} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-barcode") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <EcommerceBarcodeLabelPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-barcode-label-continue") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <EcommerceBarcodeLabelContinuePage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-definitions") {
        return (
            <EcommerceDefinitionsHub onNavigate={onNavigate} />
        );
    }

    if (panelId === "ec-products-definitions-categories") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreCategoriesPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-category-add-normal" || panelId === "ec-category-add-dynamic") {
        const categoryType = panelId === "ec-category-add-dynamic" ? "dynamic" : "normal";
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreCategoryFormPage categoryType={categoryType} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-category-edit-")) {
        const categoryId = panelId.replace("ec-category-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreCategoryFormPage categoryId={categoryId} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-definitions-brands") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreBrandsPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-products-definitions-tags") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreTagsPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-products-definitions-units") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreUnitsPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-products-definitions-cart-link" || panelId === "ec-cart-link-add") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreCartLinkFormPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-cart-link-edit-")) {
        const cartLinkId = panelId.replace("ec-cart-link-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreCartLinkFormPage cartLinkId={cartLinkId} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-definitions-suppliers") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreSuppliersPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-supplier-add") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreSupplierFormPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-supplier-edit-")) {
        const supplierId = panelId.replace("ec-supplier-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreSupplierFormPage supplierId={supplierId} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-brand-add") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreBrandFormPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-brand-edit-")) {
        const brandId = panelId.replace("ec-brand-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreBrandFormPage brandId={brandId} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-definitions-custom") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreCustomFieldsPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-products-definitions-variant-types") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreVariantTypesPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-products-definitions-product-groups") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreProductGroupsPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-product-group-add-manual") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <StoreProductGroupFormPage mode="manual" onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-product-group-add-automatic") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <StoreProductGroupFormPage mode="automatic" onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-product-group-edit-")) {
        const groupId = panelId.replace("ec-product-group-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body">
                    <StoreProductGroupFormPage groupId={groupId} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId === "ec-products-definitions-personalizations") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <StoreProductPersonalizationsPage onNavigate={onNavigate} />
            </div>
        );
    }

    if (panelId === "ec-personalization-add") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreProductPersonalizationFormPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-personalization-edit-")) {
        const personalizationId = panelId.replace("ec-personalization-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreProductPersonalizationFormPage
                        personalizationId={personalizationId}
                        onNavigate={onNavigate}
                    />
                </div>
            </div>
        );
    }

    if (panelId === "ec-personalization-option-add") {
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreProductPersonalizationOptionPage onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (panelId?.startsWith("ec-personalization-option-edit-")) {
        const optionKey = panelId.replace("ec-personalization-option-edit-", "");
        return (
            <div
                className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
                style={rootStyle}
            >
                <div className="ec-page-body ec-page-body--flush">
                    <StoreProductPersonalizationOptionPage optionKey={optionKey} onNavigate={onNavigate} />
                </div>
            </div>
        );
    }

    if (ECOMMERCE_PRODUCTS_PLACEHOLDER_META[panelId]) {
        return <EcommerceSectionPage panelId={panelId} />;
    }

    return (
        <div
            className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={rootStyle}
        >
            <div className="ec-page-body">
                <EcommerceProductsList onNavigate={onNavigate} />
            </div>
        </div>
    );
};

export default EcommerceProductsHub;
