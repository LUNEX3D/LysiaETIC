import React, { useId } from "react";
import "../../styles/brand-logo.css";

/**
 * PazarYonet — profesyonel marka amblemi
 * P monogramı + panel çizgileri + büyüme oku (pazaryeri yönetim platformu)
 */
const PazarYonetLogoMark = ({
    size = 48,
    animated = false,
    className = "",
    title = "PazarYonet",
}) => {
    const uid = useId().replace(/:/g, "");
    const bg = `py-bg-${uid}`;
    const accent = `py-accent-${uid}`;
    const shine = `py-shine-${uid}`;

    const hasFixedSize = typeof size === "number";
    const px = hasFixedSize ? size : undefined;

    return (
        <svg
            className={[
                "py-logo-mark",
                animated && "py-logo-mark--animated",
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
                    <stop stopColor="#5b21b6" />
                    <stop offset="0.5" stopColor="#7c3aed" />
                    <stop offset="1" stopColor="#4c1d95" />
                </linearGradient>
                <linearGradient id={accent} x1="48" y1="36" x2="88" y2="84" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f5f3ff" />
                    <stop offset="1" stopColor="#ddd6fe" />
                </linearGradient>
                <linearGradient id={shine} x1="24" y1="16" x2="96" y2="104" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fff" stopOpacity="0.35" />
                    <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Zemin */}
            <rect x="8" y="8" width="104" height="104" rx="26" fill={`url(#${bg})`} />
            <rect
                x="8"
                y="8"
                width="104"
                height="104"
                rx="26"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
            />
            <path d="M22 28 C38 20 82 22 98 36 L94 44 C78 34 42 32 28 40 Z" fill={`url(#${shine})`} />

            {/* Panel çizgileri — tek panelden yönetim */}
            <g stroke={`url(#${accent})`} strokeWidth="3.5" strokeLinecap="round" opacity="0.95">
                <line x1="72" y1="44" x2="92" y2="44" />
                <line x1="72" y1="56" x2="88" y2="56" />
                <line x1="72" y1="68" x2="84" y2="68" />
            </g>

            {/* P monogramı */}
            <path
                d="M38 36 V84"
                stroke="#fff"
                strokeWidth="7"
                strokeLinecap="round"
            />
            <path
                d="M38 36 H56 C66 36 72 42 72 52 C72 62 66 68 56 68 H38"
                stroke="#fff"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />

            {/* Büyüme / senkron oku */}
            <path
                className="py-logo-mark__arrow"
                d="M78 76 L92 62 M92 62 H82 M92 62 V72"
                stroke="#c4b5fd"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

export default PazarYonetLogoMark;
