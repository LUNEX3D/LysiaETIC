/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Shared UI Kit — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * Glass cards, neon accents, glow effects, gradient borders
 * + Responsive support + Accessibility (aria)
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useId } from "react";
import { T } from "../../styles";

/* ═══════════════════════════════════════════
   GLASS CARD — frosted glass with glow border
   ═══════════════════════════════════════════ */
export const Card = ({ children, style, onClick, noPad, glow, role, ariaLabel }) => (
    <div onClick={onClick} role={role || (onClick ? "button" : undefined)} aria-label={ariaLabel} tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
        style={{
            background: T.bgCard,
            backdropFilter: T.glass,
            WebkitBackdropFilter: T.glass,
            border: `1px solid ${glow ? T.borderGlow : T.border}`,
            borderRadius: T.r,
            padding: noPad ? 0 : "1.35rem 1.5rem",
            boxShadow: glow ? T.shadowGlow : T.shadow,
            cursor: onClick ? "pointer" : "default",
            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
            position: "relative",
            overflow: "hidden",
            ...style,
        }}>
        {children}
    </div>
);

/* ═══════════════════════════════════════════
   CARD HEADER — icon + title + optional badge/action
   ═══════════════════════════════════════════ */
export const CardHeader = ({ icon, title, subtitle, badge, action, color = T.accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
            {icon && (
                <div style={{
                    width: 42, height: 42, borderRadius: T.rSm,
                    background: `${color}15`,
                    border: `1px solid ${color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.2rem", flexShrink: 0,
                }} aria-hidden="true">{icon}</div>
            )}
            <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.01em" }}>{title}</h3>
                {subtitle && <p style={{ fontSize: "0.73rem", color: T.textDim, margin: "3px 0 0", letterSpacing: "0.01em" }}>{subtitle}</p>}
            </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap" }}>
            {badge && <Badge color={color}>{badge}</Badge>}
            {action}
        </div>
    </div>
);

/* ═══════════════════════════════════════════
   STAT CARD — metric display with icon (responsive)
   ═══════════════════════════════════════════ */
export const StatCard = ({ icon, label, value, color = T.accent, suffix }) => (
    <div style={{
        background: T.bgCard,
        backdropFilter: T.glassSm,
        WebkitBackdropFilter: T.glassSm,
        border: `1px solid ${T.border}`,
        borderRadius: T.r,
        padding: "1.1rem 1.2rem",
        flex: "1 1 140px", minWidth: 140,
        position: "relative",
        overflow: "hidden",
    }}>
        <div style={{
            position: "absolute", top: -20, right: -20,
            width: 70, height: 70, borderRadius: "50%",
            background: `${color}08`,
            filter: "blur(12px)",
        }} aria-hidden="true" />
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", position: "relative", zIndex: 1 }}>
            <div style={{
                width: 44, height: 44, borderRadius: T.rSm,
                background: `${color}12`,
                border: `1px solid ${color}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.2rem", flexShrink: 0,
            }} aria-hidden="true">{icon}</div>
            <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span style={{ fontSize: "1.35rem", fontWeight: 800, color: T.text, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{value}</span>
                    {suffix && <span style={{ fontSize: "0.7rem", color: T.textDim, fontWeight: 600, marginLeft: 4 }}>{suffix}</span>}
                </div>
                <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 600, marginTop: 4, letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
            </div>
        </div>
    </div>
);

/* ═══════════════════════════════════════════
   SCORE RING — animated SVG circular progress
   ═══════════════════════════════════════════ */
export const ScoreRing = ({ score = 0, size = 56, thickness = 3.5, label }) => {
    const uid = useId();
    const r = (size - thickness * 2) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.min(Math.max(score, 0), 100);
    const offset = c - (pct / 100) * c;
    const color = pct >= 80 ? T.green : pct >= 60 ? T.accent : pct >= 40 ? T.yellow : T.red;
    const fs = size >= 80 ? "1.5rem" : size >= 56 ? "1.05rem" : "0.8rem";
    return (
        <div role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label ? `${label}: ${Math.round(pct)}` : `Score: ${Math.round(pct)}`}
            style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }} aria-hidden="true">
                <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness} fill="none" stroke={T.borderLight} />
                <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness} fill="none"
                    stroke={`url(#${uid})`} strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 4px ${color}40)` }} />
                <defs>
                    <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={`${color}80`} />
                    </linearGradient>
                </defs>
            </svg>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", lineHeight: 1 }}>
                <span style={{ fontSize: fs, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{Math.round(pct)}</span>
                {label && <span style={{ display: "block", fontSize: "0.48rem", color: T.textDim, marginTop: 2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════
   HEALTH BAR — horizontal progress with glow
   ═══════════════════════════════════════════ */
export const HealthBar = ({ value = 0, label, color: c }) => {
    const barColor = c || (value >= 80 ? T.green : value >= 60 ? T.accent : value >= 40 ? T.yellow : T.red);
    const pct = Math.min(Math.max(value, 0), 100);
    return (
        <div style={{ marginBottom: "0.85rem" }} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                <span style={{ color: T.textSec, fontSize: "0.78rem", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: barColor, fontFamily: T.fontMono }}>{Math.round(pct)}</span>
            </div>
            <div style={{ width: "100%", height: 6, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: `${pct}%`, borderRadius: T.rFull,
                    background: `linear-gradient(90deg, ${barColor}, ${barColor}99)`,
                    boxShadow: `0 0 8px ${barColor}30`,
                    transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
                }} />
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════
   BADGE — pill-shaped label
   ═══════════════════════════════════════════ */
export const Badge = ({ color: c = T.accent, children, size = "md" }) => {
    const pad = size === "sm" ? "3px 8px" : size === "lg" ? "6px 14px" : "4px 10px";
    const fs = size === "sm" ? "0.63rem" : size === "lg" ? "0.78rem" : "0.7rem";
    return (
        <span style={{
            background: `${c}15`,
            color: c,
            border: `1px solid ${c}25`,
            borderRadius: T.rFull,
            padding: pad, fontSize: fs, fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 4,
            whiteSpace: "nowrap", lineHeight: 1.4,
            letterSpacing: "0.01em",
        }}>
            {children}
        </span>
    );
};

/* ═══════════════════════════════════════════
   BUTTON — glass-style with glow variants + aria
   ═══════════════════════════════════════════ */
export const Btn = ({ children, color: c = T.accent, onClick, disabled, variant = "default", size = "md", style: sx, ariaLabel }) => {
    const pad = size === "sm" ? "7px 13px" : size === "lg" ? "12px 24px" : "9px 18px";
    const fs = size === "sm" ? "0.75rem" : size === "lg" ? "0.88rem" : "0.82rem";
    const base = variant === "solid"
        ? { background: `linear-gradient(135deg, ${c}, ${c}cc)`, border: `1px solid ${c}60`, color: "#fff", boxShadow: `0 4px 16px ${c}25` }
        : variant === "ghost"
            ? { background: "transparent", border: `1px solid ${T.border}`, color: T.textSec }
            : { background: `${c}12`, border: `1px solid ${c}30`, color: c };
    return (
        <button onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={ariaLabel} aria-disabled={disabled || undefined} style={{
            ...base, borderRadius: T.rSm, padding: pad, fontSize: fs, fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)", fontFamily: "inherit", lineHeight: 1.4,
            letterSpacing: "0.01em", ...sx,
        }}>
            {children}
        </button>
    );
};

/* ═══════════════════════════════════════════
   ICON BOX — small icon container
   ═══════════════════════════════════════════ */
export const IconBox = ({ icon, color: c = T.accent, size = 38 }) => (
    <div aria-hidden="true" style={{
        width: size, height: size, borderRadius: T.rSm,
        background: `${c}12`,
        border: `1px solid ${c}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size > 38 ? "1.2rem" : "1rem", flexShrink: 0,
    }}>{icon}</div>
);

/* ═══════════════════════════════════════════
   EMPTY STATE — centered placeholder
   ═══════════════════════════════════════════ */
export const EmptyState = ({ icon = "📭", title, description }) => (
    <div style={{ textAlign: "center", padding: "3.5rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.65rem" }}>
        <div aria-hidden="true" style={{
            width: 72, height: 72, borderRadius: "50%",
            background: T.accentDim,
            border: `1px solid ${T.accent}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", marginBottom: "0.5rem",
        }}>{icon}</div>
        <p style={{ color: T.text, fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>{title}</p>
        {description && <p style={{ color: T.textDim, fontSize: "0.85rem", margin: 0, maxWidth: 360, lineHeight: 1.65 }}>{description}</p>}
    </div>
);

/* ═══════════════════════════════════════════
   LOADING STATE — spinner with message
   ═══════════════════════════════════════════ */
export const LoadingState = ({ message = "Yükleniyor..." }) => (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 1.5rem", gap: "1.5rem" }}>
        <div aria-hidden="true" style={{
            width: 44, height: 44,
            border: `3px solid ${T.borderLight}`,
            borderTopColor: T.accent,
            borderRadius: "50%",
            animation: "v9spin 0.75s linear infinite",
            boxShadow: `0 0 12px ${T.accent}20`,
        }} />
        <span style={{ color: T.textDim, fontSize: "0.88rem", fontWeight: 600 }}>{message}</span>
        <style>{`@keyframes v9spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

/* ═══════════════════════════════════════════
   ERROR STATE — error display with retry
   ═══════════════════════════════════════════ */
export const ErrorState = ({ message, onRetry, retryLabel = "Tekrar Dene" }) => (
    <div role="alert" style={{ textAlign: "center", padding: "3.5rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>
        <div aria-hidden="true" style={{
            width: 72, height: 72, borderRadius: "50%",
            background: T.redDim,
            border: `1px solid ${T.red}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", marginBottom: "0.5rem",
        }}>⚠️</div>
        <p style={{ color: T.text, fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>{message}</p>
        {onRetry && <Btn color={T.accent} onClick={onRetry}>{retryLabel}</Btn>}
    </div>
);

/* ═══════════════════════════════════════════
   GLOW LINE — subtle separator
   ═══════════════════════════════════════════ */
export const GlowLine = ({ color: c = T.accent }) => (
    <div aria-hidden="true" style={{
        height: 1, width: "100%", margin: "0.85rem 0",
        background: `linear-gradient(90deg, transparent, ${c}30, transparent)`,
    }} />
);

/* ═══════════════════════════════════════════
   DIVIDER — simple line separator
   ═══════════════════════════════════════════ */
export const Divider = ({ spacing = "1rem" }) => (
    <div aria-hidden="true" style={{ height: 1, background: T.border, margin: `${spacing} 0` }} />
);

/* ═══════════════════════════════════════════
   SEVERITY DOT — colored status indicator
   ═══════════════════════════════════════════ */
export const SeverityDot = ({ severity }) => {
    const c = severity === "critical" ? T.red : severity === "high" ? T.yellow : severity === "medium" ? T.blue : T.green;
    return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0, boxShadow: `0 0 6px ${c}40` }} />;
};

/* ═══════════════════════════════════════════
   MODAL WRAPPER — accessible modal overlay
   ═══════════════════════════════════════════ */
export const Modal = ({ open, onClose, children, maxWidth = 700 }) => {
    if (!open) return null;
    return (
        <div role="dialog" aria-modal="true" onClick={onClose} style={{
            position: "fixed", inset: 0,
            background: T.bgOverlay,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 10000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: T.bgCardSolid,
                border: `1px solid ${T.borderGlow}`,
                borderRadius: T.rXl,
                width: "100%", maxWidth, maxHeight: "85vh",
                overflow: "auto", boxShadow: T.shadowLg,
            }}>
                {children}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════
   MODAL HEADER — sticky header for modals
   ═══════════════════════════════════════════ */
export const ModalHeader = ({ icon, iconColor = T.accent, title, subtitle, onClose }) => (
    <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1.25rem 1.5rem",
        borderBottom: `1px solid ${T.border}`,
        position: "sticky", top: 0, zIndex: 1,
        background: T.bgCardSolid,
    }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: T.rSm, background: `${iconColor}15`, border: `1px solid ${iconColor}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>{icon}</div>
            <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: T.text }}>{title}</h3>
                {subtitle && <p style={{ margin: 0, fontSize: "0.72rem", color: T.textDim }}>{subtitle}</p>}
            </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: T.bgGlass, border: `1px solid ${T.border}`, color: T.textSec, cursor: "pointer", fontSize: "0.9rem", width: 36, height: 36, borderRadius: T.rSm, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>✕</button>
    </div>
);

/* ═══════════════════════════════════════════
   INPUT — styled text input
   ═══════════════════════════════════════════ */
export const Input = ({ value, onChange, placeholder, type = "text", style: sx, ariaLabel, icon }) => (
    <div style={{ position: "relative", ...sx }}>
        {icon && <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", pointerEvents: "none", color: T.textDim }} aria-hidden="true">{icon}</span>}
        <input value={value} onChange={onChange} placeholder={placeholder} type={type} aria-label={ariaLabel || placeholder}
            style={{
                width: "100%", background: T.bgInput,
                border: `1px solid ${T.border}`, borderRadius: T.rSm,
                padding: icon ? "9px 14px 9px 36px" : "9px 14px", color: T.text,
                fontSize: "0.83rem", outline: "none", fontFamily: "inherit",
                transition: "border-color 0.2s",
            }} />
    </div>
);
