import React from "react";
import { FaStore } from "react-icons/fa";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import "../../styles/storeIkasPanels.css";

const StorePlaceholder = ({ title, description }) => {
    const { C } = useDashtockTheme();

    return (
        <div className="store-ikas-page">
            <header className="store-ikas-page-header">
                <h1 className="store-ikas-title">{title}</h1>
                <p className="store-ikas-subtitle">{description}</p>
            </header>
            <section
                className="store-ikas-card store-ikas-card--muted"
                style={{ textAlign: "center", padding: "2.5rem" }}
            >
                <FaStore style={{ fontSize: "2rem", color: C.accent, marginBottom: "0.75rem" }} />
                <span className="store-ikas-pill store-ikas-pill--pending">Yakında</span>
            </section>
        </div>
    );
};

export default StorePlaceholder;
