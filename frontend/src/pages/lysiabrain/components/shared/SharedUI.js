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
   GLASS CARD — frosted glass with glow border + entrance & hover anim
   ═══════════════════════════════════════════ */
export const Card = ({ children, style, onClick, noPad, glow, role, ariaLabel, className, animate = true }) => {
    const cls = [
        animate ? "lysia-anim-fade" : "",
        onClick ? "lysia-hover-lift lysia-focus" : "",
        className || "",
    ].filter(Boolean).join(" ");
    return (
        <div onClick={onClick} role={role || (onClick ? "button" : undefined)} aria-label={ariaLabel} tabIndex={onClick ? 0 : undefined}
            className={cls}
            onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
            style={{
                background: glow ? "rgba(20, 26, 46, 0.8)" : T.bgCard,
                backdropFilter: T.glass,
                WebkitBackdropFilter: T.glass,
                border: `1px solid ${glow ? T.borderGlow : T.border}`,
                borderRadius: T.r,
                padding: noPad ? 0 : "1.5rem 1.75rem",
                boxShadow: glow ? T.shadowGlow : T.shadowMd,
                cursor: onClick ? "pointer" : "default",
                transition: T.transition.all,
                position: "relative",
                overflow: "hidden",
                ...style,
            }}>
            {children}
        </div>
    );
};

/* ═══════════════════════════════════════════
   CARD HEADER — icon + title + optional badge/action
   ═══════════════════════════════════════════ */
export const CardHeader = ({ icon, title, subtitle, badge, action, color = T.accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 0 }}>
            {icon && (
                <div style={{
                    width: 48, height: 48, borderRadius: T.rSm,
                    background: `${color}15`,
                    border: `1px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem", flexShrink: 0,
                    boxShadow: `inset 0 0 16px ${color}15, 0 0 12px ${color}10`,
                    transition: T.transition.all,
                }} aria-hidden="true">{icon}</div>
            )}
            <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: T.fz.lg, fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{title}</h3>
                {subtitle && <p style={{ fontSize: T.fz.sm, color: T.textDim, margin: "4px 0 0", letterSpacing: "0.01em", fontWeight: 500, lineHeight: 1.5 }}>{subtitle}</p>}
            </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0, flexWrap: "wrap" }}>
            {badge && <Badge color={color}>{badge}</Badge>}
            {action}
        </div>
    </div>
);

/* ═══════════════════════════════════════════
   STAT CARD — metric display with icon (responsive)
   ═══════════════════════════════════════════ */
export const StatCard = ({ icon, label, value, color = T.accent, suffix, trend, onClick }) => {
    const cls = ["lysia-anim-slide-up", "lysia-hover-lift", onClick ? "lysia-focus" : ""].filter(Boolean).join(" ");
    return (
        <div
            className={cls}
            onClick={onClick}
            tabIndex={onClick ? 0 : undefined}
            role={onClick ? "button" : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
            style={{
                background: T.bgCard,
                backdropFilter: T.glassSm,
                WebkitBackdropFilter: T.glassSm,
                border: `1px solid ${T.border}`,
                borderRadius: T.r,
                padding: "1.25rem 1.5rem",
                flex: "1 1 180px", minWidth: 180,
                position: "relative",
                overflow: "hidden",
                transition: T.transition.all,
                boxShadow: T.shadow,
                cursor: onClick ? "pointer" : "default",
            }}>
            <div style={{
                position: "absolute", top: -30, right: -30,
                width: 120, height: 120, borderRadius: "50%",
                background: `${color}18`,
                filter: "blur(28px)",
            }} aria-hidden="true" />
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: T.rSm,
                        background: `${color}18`,
                        border: `1px solid ${color}35`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", flexShrink: 0,
                        boxShadow: `0 0 14px ${color}20`,
                    }} aria-hidden="true">{icon}</div>
                    {trend !== undefined && trend !== null && (
                        <span style={{
                            fontSize: T.fz.xs,
                            fontWeight: 800,
                            color: trend >= 0 ? T.green : T.red,
                            background: trend >= 0 ? T.greenDim : T.redDim,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontFamily: T.fontMono,
                            border: `1px solid ${trend >= 0 ? T.green : T.red}35`,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                        }}>
                            {trend >= 0 ? "↑" : "↓"}{Math.abs(trend)}%
                        </span>
                    )}
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: T.fz.xs, color: T.textMuted, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: "1.85rem", fontWeight: 900, color: T.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</span>
                        {suffix && <span style={{ fontSize: T.fz.sm, color: T.textDim, fontWeight: 700 }}>{suffix}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

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
                <span style={{ color: T.textSec, fontSize: T.fz.sm, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: T.fz.sm, fontWeight: 700, color: barColor, fontFamily: T.fontMono }}>{Math.round(pct)}</span>
            </div>
            <div style={{ width: "100%", height: 8, background: T.borderLight, borderRadius: T.rFull, overflow: "hidden", position: "relative" }}>
                <div style={{
                    height: "100%", width: `${pct}%`, borderRadius: T.rFull,
                    background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                    boxShadow: `0 0 10px ${barColor}40`,
                    transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
                    position: "relative",
                    overflow: "hidden",
                }}>
                    {/* Shimmer overlay — sürekli akan parıltı */}
                    <div aria-hidden="true" style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "lysia-shimmer 2.4s linear infinite",
                    }} />
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════
   BADGE — pill-shaped label
   ═══════════════════════════════════════════ */
export const Badge = ({ color: c = T.accent, children, size = "md", style = {}, pulse = false }) => {
    const pad = size === "sm" ? "3px 9px" : size === "lg" ? "6px 14px" : "4px 11px";
    const fs = size === "sm" ? T.fz.xs : size === "lg" ? T.fz.sm : "0.74rem";
    return (
        <span className={pulse ? "lysia-pulse-glow" : ""} style={{
            background: `${c}18`,
            color: c,
            border: `1px solid ${c}40`,
            borderRadius: T.rFull,
            padding: pad, fontSize: fs, fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 4,
            whiteSpace: "nowrap", lineHeight: 1.4,
            letterSpacing: "0.02em",
            ...style
        }}>
            {children}
        </span>
    );
};

/* ═══════════════════════════════════════════
   BUTTON — glass-style with glow variants + aria
   ═══════════════════════════════════════════ */
export const Btn = ({ children, color: c = T.accent, onClick, disabled, variant = "default", size = "md", style: sx, ariaLabel, glow, loading, type = "button" }) => {
    const pad = size === "sm" ? "7px 13px" : size === "lg" ? "12px 24px" : "9px 18px";
    const fs = size === "sm" ? T.fz.xs : size === "lg" ? T.fz.base : T.fz.sm;
    const base = variant === "solid" || variant === "outline" ? null : null;
    let style;
    if (variant === "solid") {
        style = { background: `linear-gradient(135deg, ${c}, ${c}dd)`, border: `1px solid ${c}80`, color: T.textOnAccent, boxShadow: `0 4px 16px ${c}30` };
    } else if (variant === "ghost") {
        style = { background: "transparent", border: `1px solid ${T.border}`, color: T.textSec };
    } else if (variant === "outline") {
        style = { background: "transparent", border: `1.5px solid ${c}`, color: c };
    } else {
        style = { background: `${c}15`, border: `1px solid ${c}40`, color: c };
    }
    const cls = ["lysia-btn", "lysia-focus", variant === "solid" ? "lysia-btn-solid" : "", glow ? "lysia-pulse-glow" : ""].filter(Boolean).join(" ");
    return (
        <button
            type={type}
            onClick={disabled || loading ? undefined : onClick}
            disabled={disabled || loading}
            aria-label={ariaLabel}
            aria-disabled={disabled || loading || undefined}
            aria-busy={loading || undefined}
            className={cls}
            style={{
                ...style, borderRadius: T.rSm, padding: pad, fontSize: fs, fontWeight: 700,
                cursor: disabled || loading ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", lineHeight: 1.4, letterSpacing: "0.01em",
                userSelect: "none", whiteSpace: "nowrap",
                ...sx,
            }}>
            {loading && (
                <span aria-hidden="true" style={{
                    width: 12, height: 12, borderRadius: "50%",
                    border: `2px solid currentColor`, borderTopColor: "transparent",
                    animation: "lysia-spin 0.7s linear infinite",
                }} />
            )}
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
export const EmptyState = ({ icon = "📭", title, description, action }) => (
    <div className="lysia-anim-fade" style={{ textAlign: "center", padding: "3.5rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>
        <div aria-hidden="true" className="lysia-float" style={{
            width: 80, height: 80, borderRadius: "50%",
            background: `radial-gradient(circle, ${T.accent}25 0%, ${T.accentDim} 70%)`,
            border: `1px solid ${T.accent}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.1rem", marginBottom: "0.5rem",
            boxShadow: `0 0 30px ${T.accent}20`,
        }}>{icon}</div>
        <p style={{ color: T.text, fontSize: T.fz.lg, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{title}</p>
        {description && <p style={{ color: T.textDim, fontSize: T.fz.sm, margin: 0, maxWidth: 380, lineHeight: 1.65 }}>{description}</p>}
        {action && <div style={{ marginTop: "0.5rem" }}>{action}</div>}
    </div>
);

/* ═══════════════════════════════════════════
   LOADING STATE — spinner with message
   ═══════════════════════════════════════════ */
export const LoadingState = ({ message = "Yükleniyor..." }) => (
    <div role="status" aria-live="polite" className="lysia-anim-fade" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 1.5rem", gap: "1.5rem" }}>
        {/* Yörünge orbital animasyon — daha eğlenceli loading */}
        <div aria-hidden="true" style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{
                position: "absolute", inset: 0,
                border: `2px solid ${T.borderLight}`,
                borderTopColor: T.accent,
                borderRadius: "50%",
                animation: "lysia-spin 0.85s linear infinite",
                boxShadow: `0 0 20px ${T.accent}30`,
            }} />
            <div style={{
                position: "absolute", inset: 8,
                border: `2px solid ${T.borderLight}`,
                borderRightColor: T.accentAlt,
                borderRadius: "50%",
                animation: "lysia-spin 1.4s linear infinite reverse",
            }} />
            <span style={{ fontSize: "1rem" }}>🧠</span>
        </div>
        <span style={{ color: T.textSec, fontSize: T.fz.sm, fontWeight: 600, letterSpacing: "0.02em" }}>{message}</span>
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
   INSIGHT CARD — Focus on a single observation
   ═══════════════════════════════════════════ */
export const InsightCard = ({ icon, title, value, status, description, action, onClick, trend }) => {
    const accentColor = status === "danger" ? T.red : status === "warning" ? T.yellow : status === "success" ? T.green : T.accent;
    const cls = ["lysia-anim-slide-up", onClick ? "lysia-hover-lift lysia-focus" : ""].filter(Boolean).join(" ");
    return (
        <div
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
            className={cls}
            style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.r,
                padding: "1.35rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
                transition: T.transition.all,
                position: "relative",
                overflow: "hidden",
                cursor: onClick ? "pointer" : "default",
                boxShadow: T.shadow,
            }}>
            {/* Sol kenar accent şerit */}
            <div aria-hidden="true" style={{
                position: "absolute", top: 0, left: 0, width: 3, height: "100%",
                background: `linear-gradient(180deg, ${accentColor}, ${accentColor}55)`,
                boxShadow: `0 0 12px ${accentColor}50`,
            }} />
            {/* Sağ üst soft glow */}
            <div aria-hidden="true" style={{
                position: "absolute", top: -20, right: -20,
                width: 80, height: 80, borderRadius: "50%",
                background: `${accentColor}15`, filter: "blur(24px)",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", position: "relative" }}>
                <span style={{ fontSize: "1.25rem" }} aria-hidden="true">{icon}</span>
                <span style={{ fontSize: T.fz.xs, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.65rem", flexWrap: "wrap", position: "relative" }}>
                <span style={{ fontSize: "1.55rem", fontWeight: 900, color: accentColor === T.accent ? T.text : accentColor, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                    {value}
                </span>
                {trend !== undefined && trend !== null && (
                    <span style={{
                        fontSize: T.fz.xs, fontWeight: 800,
                        color: trend >= 0 ? T.green : T.red,
                        fontFamily: T.fontMono,
                        background: trend >= 0 ? T.greenDim : T.redDim,
                        padding: "2px 7px", borderRadius: 4,
                    }}>{trend >= 0 ? "↑" : "↓"}{Math.abs(Number(trend))}%</span>
                )}
            </div>
            {description ? <p style={{ fontSize: T.fz.sm, color: T.textDim, margin: 0, lineHeight: 1.5, position: "relative" }}>{description}</p> : null}
            {action && (
                <div style={{ marginTop: "0.5rem", borderTop: `1px solid ${T.borderLight}`, paddingTop: "0.75rem" }}>
                    {action}
                </div>
            )}
        </div>
    );
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
        {icon && <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: T.fz.base, pointerEvents: "none", color: T.textDim }} aria-hidden="true">{icon}</span>}
        <input value={value} onChange={onChange} placeholder={placeholder} type={type} aria-label={ariaLabel || placeholder}
            className="lysia-focus"
            style={{
                width: "100%", background: T.bgInput,
                border: `1px solid ${T.border}`, borderRadius: T.rSm,
                padding: icon ? "10px 14px 10px 38px" : "10px 14px", color: T.text,
                fontSize: T.fz.sm, outline: "none", fontFamily: "inherit",
                transition: T.transition.colors,
            }} />
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE HEADER — Tüm Brain sayfaları için ortak TLDR + KPI + filtre barı.
   Kullanıcı 5 saniyede sayfanın ne anlattığını anlasın.

   Props:
     icon, title, subtitle             — başlık bilgisi
     tldr (string|node)                — "TEK CÜMLELİK ÖZET" (en önemli takeaway)
     kpis [{ label, value, color, hint, trend }]  — sayfa için 2-5 KPI chip
     filters [{ id, label, active, onClick, count, color }]  — filtre/segment butonları
     actions (node)                    — sağ üstte "Refresh / Yenile" gibi butonlar
     status                            — "good" | "warning" | "danger" — sol şerit rengi
     onClickTLDR                       — TLDR'a tıklanınca yapılacak aksiyon
   ═══════════════════════════════════════════════════════════════════════════ */
export const PageHeader = ({
    icon = "🧠", title, subtitle, tldr,
    kpis = [], filters = [], actions = null,
    status = "good", onClickTLDR,
}) => {
    const statusColor = status === "danger" ? T.red : status === "warning" ? T.yellow : status === "info" ? T.blue : T.accent;
    return (
        <div className="lysia-anim-fade" style={{
            position: "relative",
            background: `linear-gradient(135deg, ${statusColor}10, ${T.bgCard} 60%)`,
            backdropFilter: T.glass,
            WebkitBackdropFilter: T.glass,
            border: `1px solid ${statusColor}30`,
            borderRadius: T.rMd,
            padding: "1.5rem 1.75rem",
            marginBottom: "1.25rem",
            boxShadow: T.shadowMd,
            overflow: "hidden",
        }}>
            {/* Sol şerit */}
            <div aria-hidden="true" style={{
                position: "absolute", top: 0, left: 0, width: 4, height: "100%",
                background: `linear-gradient(180deg, ${statusColor}, ${statusColor}55)`,
                boxShadow: `0 0 16px ${statusColor}50`,
            }} />

            {/* Üst bölge: başlık + actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: tldr ? 14 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                    <div aria-hidden="true" style={{
                        width: 52, height: 52, borderRadius: T.rSm,
                        background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.5rem", flexShrink: 0,
                        boxShadow: `inset 0 0 18px ${statusColor}20`,
                    }}>{icon}</div>
                    <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: T.fz.h2, fontWeight: 900, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{title}</h2>
                        {subtitle && <p style={{ margin: "4px 0 0", fontSize: T.fz.sm, color: T.textDim, lineHeight: 1.5 }}>{subtitle}</p>}
                    </div>
                </div>
                {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>{actions}</div>}
            </div>

            {/* TLDR rozeti */}
            {tldr && (
                <div onClick={onClickTLDR}
                    role={onClickTLDR ? "button" : undefined}
                    tabIndex={onClickTLDR ? 0 : undefined}
                    onKeyDown={onClickTLDR ? (e) => { if (e.key === "Enter") onClickTLDR(e); } : undefined}
                    style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px",
                        background: `${statusColor}10`,
                        border: `1px solid ${statusColor}25`,
                        borderRadius: T.rSm,
                        cursor: onClickTLDR ? "pointer" : "default",
                        transition: T.transition.all,
                    }}>
                    <span style={{ fontSize: "1.1rem" }} aria-hidden="true">💡</span>
                    <div style={{ fontSize: T.fz.base, color: T.text, fontWeight: 600, lineHeight: 1.5, flex: 1 }}>
                        <span style={{ color: statusColor, fontWeight: 800, marginRight: 6 }}>ÖZET:</span>
                        {tldr}
                    </div>
                </div>
            )}

            {/* KPI Chips */}
            {kpis && kpis.length > 0 && (
                <div className="lysia-anim-stagger" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                    {kpis.map((k, i) => {
                        const c = k.color || T.accent;
                        return (
                            <div key={i} title={k.hint} style={{
                                display: "inline-flex", alignItems: "center", gap: 10,
                                padding: "8px 14px", background: `${c}15`,
                                border: `1px solid ${c}30`, borderRadius: 999,
                                fontSize: T.fz.sm,
                                cursor: k.hint ? "help" : "default",
                            }}>
                                <span style={{ color: T.textDim, fontWeight: 600 }}>{k.label}:</span>
                                <span style={{ color: c, fontWeight: 800, fontFamily: T.fontMono }}>{k.value}</span>
                                {k.trend !== undefined && k.trend !== null && (
                                    <span style={{ fontSize: T.fz.xs, color: k.trend >= 0 ? T.green : T.red, fontWeight: 700 }}>
                                        {k.trend >= 0 ? "↑" : "↓"}{Math.abs(k.trend)}%
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filtreler */}
            {filters && filters.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                    {filters.map(f => (
                        <button key={f.id} onClick={f.onClick}
                            className="lysia-btn lysia-focus"
                            style={{
                                padding: "8px 14px",
                                background: f.active ? (f.color || T.accent) : T.bgGlass,
                                color: f.active ? T.textOnAccent : T.textDim,
                                border: `1px solid ${f.active ? (f.color || T.accent) : T.border}`,
                                borderRadius: T.rSm, fontWeight: 700, fontSize: T.fz.sm,
                                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                            }}>
                            {f.label}
                            {(f.count !== undefined && f.count !== null) && (
                                <span style={{
                                    padding: "2px 8px", borderRadius: 999,
                                    background: f.active ? "rgba(0,0,0,0.2)" : T.bgInput,
                                    fontSize: T.fz.xs, fontWeight: 800,
                                }}>{f.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
