import React from "react";
import { BRAND_NAME } from "../../constants/brand";
import PazarYonetLogoMark from "./PazarYonetLogoMark";

/**
 * PazarYonet logo — profesyonel SVG amblem
 */
const PazarYonetLogo = ({
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
            className={`py-brand-logo ${className}`}
            style={{ display: "inline-flex", alignItems: "center", gap: showText ? 10 : 0 }}
        >
            <PazarYonetLogoMark size={markSize} animated={animated} title={BRAND_NAME} />
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

export default PazarYonetLogo;
