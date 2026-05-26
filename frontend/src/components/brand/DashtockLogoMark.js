import React from "react";
import { BRAND_LOGO_SRC } from "../../constants/brand";
import "../../styles/brand-logo.css";

/**
 * Dashtock ikon — public/brand/dashtock-logo.svg (Logo.svg)
 */
const DashtockLogoMark = ({
    size = 48,
    animated = false,
    className = "",
    title = "Dashtock",
}) => {
    const hasFixedSize = typeof size === "number";
    const px = hasFixedSize ? size : 48;

    return (
        <img
            src={BRAND_LOGO_SRC}
            alt={title || "Dashtock"}
            width={px}
            height={px}
            className={[
                "ds-logo-mark",
                animated && "ds-logo-mark--animated",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            style={{ objectFit: "contain", display: "block" }}
            draggable={false}
        />
    );
};

export default DashtockLogoMark;
