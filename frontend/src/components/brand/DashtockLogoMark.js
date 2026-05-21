import React, { useId } from "react";
import "../../styles/brand-logo.css";

/**
 * Dashtock — D monogrami (pembe / mavi / siyah) + veri cizgileri + ok
 * PazarYonet amblem duzenine benzer
 */
const DashtockLogoMark = ({
    size = 48,
    animated = false,
    className = "",
    title = "Dashtock",
}) => {
    const uid = useId().replace(/:/g, "");
    const bg = `ds-bg-${uid}`;
    const accent = `ds-accent-${uid}`;
    const shine = `ds-shine-${uid}`;

    const hasFixedSize = typeof size === "number";
    const px = hasFixedSize ? size : undefined;

    return (
        <svg
            className={[
                "ds-logo-mark",
                animated && "ds-logo-mark--animated",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            width={px}
            height={px}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role={title ? "img" : "presentation"}
            aria-label={title || undefined}
            aria-hidden={title ? undefined : true}
        >
            <defs>
                <linearGradient id={bg} x1="16" y1="12" x2="104" y2="108" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ec4899" />
                    <stop offset="0.42" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id={accent} x1="48" y1="36" x2="96" y2="84" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fce7f3" />
                    <stop offset="1" stopColor="#e0e7ff" />
                </linearGradient>
                <linearGradient id={shine} x1="24" y1="16" x2="96" y2="104" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" stopOpacity="0.38" />
                    <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
            </defs>

            <rect x="8" y="8" width="104" height="104" rx="26" fill={`url(#${bg})`} />
            <rect x="8" y="8" width="104" height="104" rx="26" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
            <path d="M22 28 C38 20 82 22 98 36 L94 44 C78 34 42 32 28 40 Z" fill={`url(#${shine})`} />

            <g stroke={`url(#${accent})`} strokeWidth="3.5" strokeLinecap="round" opacity="0.95">
                <line x1="72" y1="44" x2="92" y2="44" />
                <line x1="72" y1="56" x2="88" y2="56" />
                <line x1="72" y1="68" x2="84" y2="68" />
            </g>

            <path d="M36 34 V86" stroke="#ffffff" strokeWidth="7.5" strokeLinecap="round" />
            <path
                d="M36 34 H52 C72 34 84 48 84 60 C84 72 72 86 52 86 H36"
                stroke="#ffffff"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />

            <path
                className="ds-logo-mark__arrow"
                d="M78 76 L92 62 M92 62 H82 M92 62 V72"
                stroke="#f9a8d4"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

export default DashtockLogoMark;
