import React from "react";
import { FaStore } from "react-icons/fa";
import { ECOMMERCE_MAIN_META, ECOMMERCE_PRODUCTS_PLACEHOLDER_META } from "../../constants/ecommerceMenu";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import "../../styles/ecommerceTheme.css";
import "../../styles/storeIkasPanels.css";

const EcommerceSectionPage = ({ panelId }) => {
    const { C, rootClassName, rootStyle } = useDashtockTheme();
    const meta = ECOMMERCE_PRODUCTS_PLACEHOLDER_META[panelId] || ECOMMERCE_MAIN_META[panelId] || {
        title: "E-Ticaret",
        text: "Bu bölüm yapılandırılacak.",
    };

    return (
        <div className={`ec-theme-root ${rootClassName}`} style={rootStyle}>
            <div className="ec-page-body">
                <div className="store-ikas-page">
                    <header className="store-ikas-page-header">
                        <h1 className="store-ikas-title">{meta.title}</h1>
                        <p className="store-ikas-subtitle">{meta.text}</p>
                    </header>
                    <section
                        className="store-ikas-card store-ikas-card--muted"
                        style={{ textAlign: "center", padding: "2.5rem" }}
                    >
                        <FaStore style={{ fontSize: "2rem", color: C.accent, marginBottom: "0.75rem" }} />
                        <span className="store-ikas-pill store-ikas-pill--pending">Yakında</span>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default EcommerceSectionPage;
