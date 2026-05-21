import React from "react";
import { BRAND_NAME } from "../../constants/brand";
import DashtockLogoMark from "./DashtockLogoMark";

/**
 * Dashtock logo — amblem + isteğe bağlı metin
 */
const DashtockLogo = ({
    size = 40,
    showText = false,
    textClassName = "",
    className = "",
    variant = "default",
    animated = false,
}) => {
    const isLight = variant === "light";
    const markSize = typeof size === "number" ? size : 40;

    return (
        <div
            className={`ds-brand-logo ${className}`}
            style={{ display: "inline-flex", alignItems: "center", gap: showText ? 10 : 0 }}
        >
            <DashtockLogoMark size={markSize} animated={animated} title={BRAND_NAME} />
            {showText && (
                <span
                    className={textClassName}
                    style={{
                        fontWeight: 800,
                        fontSize: markSize > 36 ? 18 : 14,
                        letterSpacing: "0.04em",
                        color: isLight ? "#fff" : "inherit",
                        lineHeight: 1.1,
                    }}
                >
                    {BRAND_NAME}
                </span>
            )}
        </div>
    );
};

export default DashtockLogo;
