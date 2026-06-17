import React from "react";
import { Box } from "@mui/material";

/** SVG placeholder önizlemeler — premium kart görünümü */
const PREVIEWS = {
    hero: (
        <svg viewBox="0 0 160 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="160" height="90" rx="6" fill="url(#hero-g)" />
            <rect x="24" y="28" width="72" height="8" rx="2" fill="white" fillOpacity="0.95" />
            <rect x="24" y="42" width="52" height="5" rx="2" fill="white" fillOpacity="0.6" />
            <rect x="24" y="56" width="36" height="14" rx="4" fill="white" fillOpacity="0.9" />
            <defs>
                <linearGradient id="hero-g" x1="0" y1="0" x2="160" y2="90">
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
            </defs>
        </svg>
    ),
    banner: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#1e293b" />
            <rect x="16" y="32" width="64" height="7" rx="2" fill="#f8fafc" />
            <rect x="16" y="44" width="48" height="5" rx="2" fill="#94a3b8" />
            <rect x="16" y="58" width="40" height="12" rx="3" fill="#3b82f6" />
        </svg>
    ),
    campaign: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#dc2626" />
            <circle cx="130" cy="24" r="14" fill="#fef08a" fillOpacity="0.9" />
            <rect x="14" y="30" width="70" height="8" rx="2" fill="white" />
            <rect x="14" y="48" width="50" height="6" rx="2" fill="#fecaca" />
        </svg>
    ),
    "product-grid": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f1f5f9" />
            {[0, 1, 2, 3].map((i) => (
                <g key={i} transform={`translate(${14 + (i % 2) * 72}, ${14 + Math.floor(i / 2) * 38})`}>
                    <rect width="60" height="32" rx="4" fill="white" stroke="#e2e8f0" />
                    <rect x="6" y="6" width="48" height="12" rx="2" fill="#e2e8f0" />
                    <rect x="6" y="22" width="28" height="4" rx="1" fill="#cbd5e1" />
                </g>
            ))}
        </svg>
    ),
    "category-grid": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f8fafc" />
            {[0, 1, 2].map((i) => (
                <rect key={i} x={14 + i * 48} y="24" width="40" height="42" rx="4" fill="white" stroke="#e2e8f0" />
            ))}
        </svg>
    ),
    newsletter: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#3b82f6" />
            <rect x="20" y="28" width="80" height="6" rx="2" fill="white" fillOpacity="0.9" />
            <rect x="20" y="48" width="100" height="14" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeOpacity="0.5" />
            <rect x="108" y="48" width="32" height="14" rx="3" fill="white" />
        </svg>
    ),
    text: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            <rect x="16" y="20" width="90" height="8" rx="2" fill="#334155" />
            <rect x="16" y="34" width="120" height="4" rx="1" fill="#cbd5e1" />
            <rect x="16" y="42" width="110" height="4" rx="1" fill="#cbd5e1" />
            <rect x="16" y="50" width="80" height="4" rx="1" fill="#cbd5e1" />
        </svg>
    ),
    slider: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#e0e7ff" />
            <rect x="8" y="12" width="144" height="66" rx="4" fill="#c7d2fe" />
            <circle cx="24" cy="45" r="8" fill="white" fillOpacity="0.8" />
            <circle cx="136" cy="45" r="8" fill="white" fillOpacity="0.8" />
        </svg>
    ),
    testimonials: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f8fafc" />
            {[0, 1, 2].map((i) => (
                <rect key={i} x={10 + i * 50} y="18" width="44" height="54" rx="4" fill="white" stroke="#e2e8f0" />
            ))}
        </svg>
    ),
    image: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#e2e8f0" />
            <circle cx="56" cy="38" r="10" fill="#94a3b8" />
            <path d="M8 78 L50 48 L80 62 L120 32 L152 78 Z" fill="#cbd5e1" />
        </svg>
    ),
    video: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#0f172a" />
            <circle cx="80" cy="45" r="18" fill="white" fillOpacity="0.9" />
            <path d="M74 38 L92 45 L74 52 Z" fill="#0f172a" />
        </svg>
    ),
    contact: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            <rect x="16" y="16" width="128" height="10" rx="2" fill="#f1f5f9" />
            <rect x="16" y="32" width="128" height="10" rx="2" fill="#f1f5f9" />
            <rect x="16" y="48" width="128" height="24" rx="2" fill="#f1f5f9" />
            <rect x="16" y="78" width="48" height="10" rx="3" fill="#3b82f6" />
        </svg>
    ),
    countdown: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#fef3c7" />
            {[0, 1, 2, 3].map((i) => (
                <rect key={i} x={18 + i * 34} y="32" width="28" height="28" rx="4" fill="white" stroke="#fcd34d" />
            ))}
        </svg>
    ),
    spacer: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeDasharray="4 4" />
            <rect x="70" y="38" width="20" height="14" rx="2" fill="#cbd5e1" />
        </svg>
    ),
    divider: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            <rect x="16" y="44" width="128" height="2" fill="#cbd5e1" />
        </svg>
    ),
    html: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#0f172a" />
            <text x="16" y="36" fill="#22c55e" fontSize="10" fontFamily="monospace">&lt;section&gt;</text>
            <text x="24" y="52" fill="#94a3b8" fontSize="9" fontFamily="monospace">...</text>
        </svg>
    ),
    "product-gallery": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f1f5f9" />
            <rect x="12" y="12" width="96" height="66" rx="4" fill="#e2e8f0" />
            {[0, 1, 2].map((i) => (
                <rect key={i} x={114} y={12 + i * 22} width="34" height="18" rx="2" fill="#cbd5e1" />
            ))}
        </svg>
    ),
    "product-price": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            <rect x="16" y="28" width="72" height="14" rx="2" fill="#0f172a" />
            <rect x="16" y="48" width="48" height="6" rx="1" fill="#94a3b8" />
        </svg>
    ),
    "product-variants": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            {[0, 1, 2, 3].map((i) => (
                <rect key={i} x={14 + i * 36} y="36" width="30" height="18" rx="4" fill="#f1f5f9" stroke="#e2e8f0" />
            ))}
        </svg>
    ),
    "add-to-cart": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            <rect x="14" y="32" width="56" height="22" rx="4" fill="#f1f5f9" stroke="#e2e8f0" />
            <rect x="78" y="32" width="68" height="22" rx="4" fill="#16a34a" />
        </svg>
    ),
    "product-description": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            <rect x="14" y="18" width="80" height="6" rx="1" fill="#334155" />
            <rect x="14" y="30" width="132" height="4" rx="1" fill="#e2e8f0" />
            <rect x="14" y="38" width="120" height="4" rx="1" fill="#e2e8f0" />
            <rect x="14" y="46" width="100" height="4" rx="1" fill="#e2e8f0" />
        </svg>
    ),
    "product-reviews": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#fffbeb" />
            <text x="20" y="40" fill="#f59e0b" fontSize="16">★★★★★</text>
            <rect x="20" y="50" width="100" height="4" rx="1" fill="#fde68a" />
        </svg>
    ),
    "related-products": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f8fafc" />
            {[0, 1, 2].map((i) => (
                <rect key={i} x={10 + i * 50} y="22" width="44" height="50" rx="3" fill="white" stroke="#e2e8f0" />
            ))}
        </svg>
    ),
    "product-specifications": (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="white" stroke="#e2e8f0" />
            {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                    <rect x="14" y={18 + i * 16} width="50" height="10" rx="1" fill="#f1f5f9" />
                    <rect x="70" y={18 + i * 16} width="76" height="10" rx="1" fill="#f8fafc" />
                </g>
            ))}
        </svg>
    ),
    generic: (
        <svg viewBox="0 0 160 90" fill="none">
            <rect width="160" height="90" rx="6" fill="#f1f5f9" stroke="#e2e8f0" />
            <rect x="48" y="36" width="64" height="18" rx="4" fill="#cbd5e1" />
        </svg>
    ),
};

export default function BlockThumbnail({ variant = "generic", className }) {
    const svg = PREVIEWS[variant] || PREVIEWS.generic;
    return (
        <Box className={className || "wb-block-thumb"} component="div" aria-hidden>
            {svg}
        </Box>
    );
}
