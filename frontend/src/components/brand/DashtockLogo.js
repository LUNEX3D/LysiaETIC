import React from "react";
import { BRAND_NAME, BRAND_LOGO_FULL_SRC } from "../../constants/brand";
import DashtockLogoMark from "./DashtockLogoMark";

/**
 * Dashtock logo — ikon veya yatay tam logo (Dashtock.svg)
 */
const DashtockLogo = ({
    size = 40,
    showText = false,
    full = false,
    textClassName = "",
    className = "",
    variant = "default",
    animated = false,
}) => {
    const markSize = typeof size === "number" ? size : 40;
    const useFull = full || showText;

    if (useFull) {
        return (
            <img
                src={BRAND_LOGO_FULL_SRC}
                alt={BRAND_NAME}
                className={`ds-brand-logo ds-brand-logo--full ${className}`.trim()}
                style={{
                    height: markSize,
                    width: "auto",
                    maxWidth: "min(100%, 220px)",
                    objectFit: "contain",
                    objectPosition: "left center",
                    display: "block",
                }}
                draggable={false}
            />
        );
    }

    const isLight = variant === "light";

    return (
        <div
            className={`ds-brand-logo ${className}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 0 }}
        >
            <DashtockLogoMark size={markSize} animated={animated} title={BRAND_NAME} />
            {showText && !useFull && (
                <span
                    className={textClassName}
                    style={{
                        fontWeight: 800,
                        fontSize: markSize > 36 ? 18 : 14,
                        letterSpacing: "0.04em",
                        color: isLight ? "#fff" : "inherit",
                        lineHeight: 1.1,
                        marginLeft: 10,
                    }}
                >
                    {BRAND_NAME}
                </span>
            )}
        </div>
    );
};

export default DashtockLogo;
