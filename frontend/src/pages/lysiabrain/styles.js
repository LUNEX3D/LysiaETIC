/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — DARK GLASSMORPHISM — Design Tokens + Responsive
 * ═══════════════════════════════════════════════════════════════
 * Deep space dark + neon cyan/emerald accents + glass cards
 * + responsive breakpoints + useMediaQuery hook
 * ═══════════════════════════════════════════════════════════════
 */
import { useState, useEffect } from "react";

export const T = {
    // ── Backgrounds ──
    bg: "#080b16",
    bgAlt: "#0d1025",
    bgCard: "rgba(15,18,35,0.65)",
    bgCardSolid: "#111430",
    bgGlass: "rgba(255,255,255,0.04)",
    bgGlassHover: "rgba(255,255,255,0.07)",
    bgInput: "rgba(255,255,255,0.06)",
    bgOverlay: "rgba(4,6,18,0.85)",

    // ── Borders ──
    border: "rgba(255,255,255,0.08)",
    borderLight: "rgba(255,255,255,0.04)",
    borderGlow: "rgba(0,212,170,0.25)",
    borderFocus: "#00d4aa",

    // ── Primary — Cyan/Emerald Gradient ──
    accent: "#00d4aa",
    accentAlt: "#00b4d8",
    accentDim: "rgba(0,212,170,0.15)",
    accentGlow: "rgba(0,212,170,0.3)",
    gradient: "linear-gradient(135deg, #00d4aa, #00b4d8)",
    gradientText: "linear-gradient(135deg, #00d4aa, #00e5ff)",
    gradientCard: "linear-gradient(135deg, rgba(0,212,170,0.08), rgba(0,180,216,0.04))",
    gradientHero: "linear-gradient(135deg, rgba(0,212,170,0.12), rgba(0,180,216,0.06), rgba(15,18,35,0))",

    // ── Semantic Colors ──
    green: "#34d399",
    greenDim: "rgba(52,211,153,0.12)",
    red: "#f87171",
    redDim: "rgba(248,113,113,0.12)",
    yellow: "#fbbf24",
    yellowDim: "rgba(251,191,36,0.12)",
    blue: "#60a5fa",
    blueDim: "rgba(96,165,250,0.12)",
    purple: "#a78bfa",
    purpleDim: "rgba(167,139,250,0.12)",
    orange: "#fb923c",
    orangeDim: "rgba(251,146,60,0.12)",
    pink: "#f472b6",
    pinkDim: "rgba(244,114,182,0.12)",
    cyan: "#22d3ee",
    cyanDim: "rgba(34,211,238,0.12)",

    // ── Text ──
    text: "#e8ecf4",
    textSec: "#8b95a8",
    textDim: "#5a6478",
    textMuted: "#3d4556",
    textBright: "#ffffff",

    // ── Typography ──
    font: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontMono: "'JetBrains Mono','Fira Code',monospace",

    // ── Radius ──
    r: 16,
    rSm: 10,
    rXl: 24,
    rFull: 9999,

    // ── Shadows ──
    shadow: "0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
    shadowMd: "0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
    shadowLg: "0 16px 48px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)",
    shadowGlow: "0 0 20px rgba(0,212,170,0.15), 0 0 60px rgba(0,212,170,0.05)",

    // ── Glass ──
    glass: "blur(16px) saturate(180%)",
    glassSm: "blur(8px) saturate(150%)",
};

/* ── Responsive Breakpoints ── */
export const BP = {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
    wide: 1280,
};

/* ── useMediaQuery Hook — SSR-safe ── */
export const useMediaQuery = (maxWidth) => {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
        setMatches(mq.matches);
        const handler = (e) => setMatches(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [maxWidth]);
    return matches;
};

/* ── useResponsive — returns all breakpoint flags at once ── */
export const useResponsive = () => {
    const isMobile = useMediaQuery(BP.mobile);
    const isTablet = useMediaQuery(BP.tablet);
    const isDesktop = useMediaQuery(BP.desktop);
    return { isMobile, isTablet, isDesktop, isWide: !useMediaQuery(BP.wide) };
};

/* ── Formatters ── */
export const fmt = (v) => {
    try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v || 0)); }
    catch { return `${Math.round(Number(v || 0))} ₺`; }
};
export const fmtN = (v) => {
    try { return new Intl.NumberFormat("tr-TR").format(Number(v || 0)); }
    catch { return String(v || 0); }
};
export const fmtP = (v) => `%${Number(v || 0).toFixed(1)}`;

export const colors = T;
export const fmtCurrency = fmt;
export const fmtNum = fmtN;
export const fmtPct = fmtP;
