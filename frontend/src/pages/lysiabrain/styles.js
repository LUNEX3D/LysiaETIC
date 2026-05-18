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
    // ── Backgrounds — hafif cool tint, saf siyah'ın göz yorması önlenir ──
    bg: "#0a0e1c",              // ana zemin (1 ton açık)
    bgAlt: "#10152a",           // alt zemin
    bgCard: "rgba(20,26,46,0.72)",   // glass card (daha okunur arka plan)
    bgCardSolid: "#161c33",     // solid kart
    bgCardHover: "rgba(28,36,60,0.85)", // hover state
    bgGlass: "rgba(255,255,255,0.045)",
    bgGlassHover: "rgba(255,255,255,0.085)",
    bgInput: "rgba(255,255,255,0.06)",
    bgOverlay: "rgba(4,6,18,0.85)",

    // ── Borders — biraz daha görünür ──
    border: "rgba(255,255,255,0.085)",
    borderLight: "rgba(255,255,255,0.04)",
    borderStrong: "rgba(255,255,255,0.18)",
    borderGlow: "rgba(0,212,170,0.4)",
    borderFocus: "#00d4aa",

    // ── Primary — Cyan/Emerald Gradient ──
    accent: "#00f5d4",
    accentAlt: "#00bbf9",
    accentDim: "rgba(0,245,212,0.14)",
    accentGlow: "rgba(0,245,212,0.32)",
    gradient: "linear-gradient(135deg, #00f5d4, #00bbf9)",
    gradientText: "linear-gradient(135deg, #00f5d4, #00e5ff)",
    gradientCard: "linear-gradient(135deg, rgba(0,245,212,0.1), rgba(0,187,249,0.05))",
    gradientHero: "linear-gradient(135deg, rgba(0,245,212,0.15), rgba(0,187,249,0.08), rgba(15,18,35,0))",
    // arka plan için animasyonlu radial gradient
    gradientBgAmbient: "radial-gradient(ellipse at 20% 0%, rgba(0,187,249,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,245,212,0.06) 0%, transparent 50%)",

    // ── Semantic Colors ──
    green: "#34d399",
    greenDim: "rgba(52,211,153,0.14)",
    red: "#f87171",
    redDim: "rgba(248,113,113,0.14)",
    yellow: "#fbbf24",
    yellowDim: "rgba(251,191,36,0.14)",
    blue: "#60a5fa",
    blueDim: "rgba(96,165,250,0.14)",
    purple: "#a78bfa",
    purpleDim: "rgba(167,139,250,0.14)",
    orange: "#fb923c",
    orangeDim: "rgba(251,146,60,0.14)",
    pink: "#f472b6",
    pinkDim: "rgba(244,114,182,0.14)",
    cyan: "#22d3ee",
    cyanDim: "rgba(34,211,238,0.14)",

    // ── Text — AAA kontrast hedefli ──
    // Aşağıdaki tüm renkler bg(#0a0e1c) üzerinde WCAG 2.1 AA+ geçer
    text: "#f1f5fb",            // 16.5:1 ana metin
    textSec: "#c2cad8",         // 9.8:1 ikincil metin (önceden 5.5:1)
    textDim: "#9aa4b8",         // 6.2:1 hafif ikincil (önceden 3.5:1 — fail)
    textMuted: "#7a8499",       // 4.7:1 etiket/caption (önceden 2.3:1 — fail)
    textBright: "#ffffff",
    textOnAccent: "#04141a",    // accent renk üzerine yazı (siyah)

    // ── Typography ──
    font: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontMono: "'JetBrains Mono','Fira Code',monospace",

    // ── Type Scale — tutarlı font boyutu sistemi ──
    fz: {
        xs: "0.72rem",      // 11.5px — küçük etiket (önce 0.6 → çok küçüktü)
        sm: "0.82rem",      // 13.1px — yardımcı metin
        base: "0.92rem",    // 14.7px — gövde metni
        md: "1rem",         // 16px — vurgu
        lg: "1.15rem",      // 18.4px — alt başlık
        xl: "1.4rem",       // 22.4px — kart başlığı
        h2: "1.75rem",      // 28px — bölüm başlığı
        h1: "2.25rem",      // 36px — hero
        hero: "2.75rem",    // 44px — büyük hero
    },

    // ── Spacing Scale ──
    sp: {
        xs: "0.25rem",
        sm: "0.5rem",
        md: "0.75rem",
        base: "1rem",
        lg: "1.5rem",
        xl: "2rem",
        xxl: "3rem",
    },

    // ── Radius ──
    r: 14,
    rSm: 10,
    rMd: 16,
    rXl: 24,
    rFull: 9999,

    // ── Shadows ──
    shadow: "0 4px 14px rgba(0,0,0,0.35)",
    shadowMd: "0 12px 32px rgba(0,0,0,0.45)",
    shadowLg: "0 24px 64px rgba(0,0,0,0.55)",
    shadowHover: "0 18px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,245,212,0.12)",
    shadowGlow: "0 0 30px rgba(0,245,212,0.18), 0 0 80px rgba(0,245,212,0.07)",
    shadowFocus: "0 0 0 3px rgba(0,245,212,0.35)",

    // ── Glass ──
    glass: "blur(22px) saturate(180%)",
    glassSm: "blur(12px) saturate(150%)",

    // ── Animation Tokens ──
    ease: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",       // expo-out, doğal yumuşaklık
        inOut: "cubic-bezier(0.65, 0, 0.35, 1)",    // smooth
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)", // hafif zıplayan
        snap: "cubic-bezier(0.4, 0, 0.2, 1)",       // material standart
    },
    dur: {
        fast: "150ms",
        base: "240ms",
        slow: "400ms",
        slower: "650ms",
    },
    // Hazır transition presetleri
    transition: {
        all: "all 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        colors: "background-color 200ms ease, border-color 200ms ease, color 200ms ease",
        transform: "transform 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: "opacity 200ms ease-out",
    },
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

/* ───────────────────────────────────────────────────────────────
   GLOBAL ANIMATION CSS — bir kez DOM'a inject edilir
   Tüm @keyframes, hover utility class'ları, focus-ring stilleri
   prefers-reduced-motion'a saygı duyar
   ─────────────────────────────────────────────────────────────── */
export const LYSIA_GLOBAL_CSS = `
/* ─── KEYFRAMES ─── */
@keyframes lysia-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes lysia-slide-up {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes lysia-slide-down {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes lysia-zoom-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
}
@keyframes lysia-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.04); }
}
@keyframes lysia-pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(0,245,212,0.35); }
    50% { box-shadow: 0 0 0 8px rgba(0,245,212,0); }
}
@keyframes lysia-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
@keyframes lysia-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
}
@keyframes lysia-spin {
    to { transform: rotate(360deg); }
}
@keyframes lysia-orbit {
    0% { transform: rotate(0deg) translateX(20px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(20px) rotate(-360deg); }
}
@keyframes lysia-gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
}
@keyframes lysia-status-blink {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px currentColor; }
    50% { opacity: 0.55; box-shadow: 0 0 14px currentColor; }
}

/* ─── ENTRANCE UTILITIES ─── */
.lysia-anim-fade { animation: lysia-fade-in ${T.dur.base} ${T.ease.out} both; }
.lysia-anim-slide-up { animation: lysia-slide-up ${T.dur.slow} ${T.ease.out} both; }
.lysia-anim-zoom { animation: lysia-zoom-in ${T.dur.base} ${T.ease.out} both; }
.lysia-anim-slide-down { animation: lysia-slide-down ${T.dur.base} ${T.ease.out} both; }
.lysia-anim-stagger > * { animation: lysia-slide-up ${T.dur.slow} ${T.ease.out} both; }
.lysia-anim-stagger > *:nth-child(1) { animation-delay: 40ms; }
.lysia-anim-stagger > *:nth-child(2) { animation-delay: 90ms; }
.lysia-anim-stagger > *:nth-child(3) { animation-delay: 140ms; }
.lysia-anim-stagger > *:nth-child(4) { animation-delay: 190ms; }
.lysia-anim-stagger > *:nth-child(5) { animation-delay: 240ms; }
.lysia-anim-stagger > *:nth-child(6) { animation-delay: 290ms; }
.lysia-anim-stagger > *:nth-child(7) { animation-delay: 340ms; }
.lysia-anim-stagger > *:nth-child(8) { animation-delay: 390ms; }

/* ─── HOVER UTILITIES ─── */
.lysia-hover-lift { transition: transform ${T.dur.base} ${T.ease.out}, box-shadow ${T.dur.base} ${T.ease.out}, border-color ${T.dur.base} ${T.ease.out}; }
.lysia-hover-lift:hover { transform: translateY(-2px); box-shadow: ${T.shadowHover}; }
.lysia-hover-scale { transition: transform ${T.dur.base} ${T.ease.out}; }
.lysia-hover-scale:hover { transform: scale(1.03); }
.lysia-hover-glow { transition: box-shadow ${T.dur.base} ${T.ease.out}, border-color ${T.dur.base} ${T.ease.out}; }
.lysia-hover-glow:hover { box-shadow: ${T.shadowGlow}; border-color: ${T.borderGlow}; }

/* ─── FOCUS RING (klavye erişilebilirliği) ─── */
.lysia-focus:focus-visible {
    outline: none;
    box-shadow: ${T.shadowFocus};
    border-color: ${T.borderFocus};
}

/* ─── BUTTON PRESS EFFECT ─── */
.lysia-btn { transition: transform ${T.dur.fast} ${T.ease.snap}, background-color ${T.dur.fast} ease, box-shadow ${T.dur.base} ${T.ease.out}, border-color ${T.dur.fast} ease, opacity ${T.dur.fast} ease; }
.lysia-btn:hover:not(:disabled) { transform: translateY(-1px); }
.lysia-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

/* ─── BUTTON SHIMMER GLOW (solid variant) ─── */
.lysia-btn-solid { position: relative; overflow: hidden; }
.lysia-btn-solid::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
    transform: translateX(-100%);
    transition: transform 600ms ${T.ease.out};
    pointer-events: none;
}
.lysia-btn-solid:hover::after { transform: translateX(100%); }

/* ─── TAB ACTIVE INDICATOR ─── */
.lysia-tab-indicator { position: relative; }
.lysia-tab-indicator::after {
    content: ""; position: absolute; left: 50%; bottom: -6px;
    width: 0; height: 2px; background: ${T.accent};
    border-radius: 2px;
    transition: width ${T.dur.base} ${T.ease.out}, left ${T.dur.base} ${T.ease.out};
    box-shadow: 0 0 8px ${T.accent};
}
.lysia-tab-indicator.active::after,
.lysia-tab-indicator:hover::after { width: 60%; left: 20%; }

/* ─── STATUS DOT BLINKING ─── */
.lysia-status-blink { animation: lysia-status-blink 2s ease-in-out infinite; }

/* ─── PULSE GLOW (kritik öğeler için) ─── */
.lysia-pulse-glow { animation: lysia-pulse-glow 2.4s ${T.ease.inOut} infinite; }
.lysia-pulse-soft { animation: lysia-pulse 2.8s ${T.ease.inOut} infinite; }

/* ─── FLOATING ICON ─── */
.lysia-float { animation: lysia-float 4s ease-in-out infinite; }

/* ─── SHIMMER LOADING ─── */
.lysia-shimmer {
    background: linear-gradient(90deg, ${T.bgGlass} 0%, ${T.bgGlassHover} 50%, ${T.bgGlass} 100%);
    background-size: 200% 100%;
    animation: lysia-shimmer 1.6s linear infinite;
}

/* ─── AMBIENT BG (subtle slow gradient drift) ─── */
.lysia-ambient-bg {
    background: ${T.gradientBgAmbient};
    background-size: 200% 200%;
    animation: lysia-gradient-shift 18s ease-in-out infinite;
}

/* ─── SCROLLBAR ─── */
.lysia-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.lysia-scroll::-webkit-scrollbar-track { background: ${T.bgAlt}; border-radius: 4px; }
.lysia-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; transition: background ${T.dur.base} ease; }
.lysia-scroll::-webkit-scrollbar-thumb:hover { background: ${T.borderStrong}; }

/* ─── TYPOGRAPHY UTILITIES ─── */
.lysia-text-gradient {
    background: ${T.gradientText};
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* ─── REDUCED MOTION DESTEĞİ ─── */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
`;

/* DOM'a bir kez enjekte eden helper — PazarYonet AI.js mount'unda çağrılır */
export function ensureLysiaGlobalStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById("lysia-global-styles")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "lysia-global-styles";
    styleEl.textContent = LYSIA_GLOBAL_CSS;
    document.head.appendChild(styleEl);
}
