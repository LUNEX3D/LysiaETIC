/**
 * Faturalandırma Modülü — Paylaşılan UI Bileşenleri
 * LysiaETIC
 *
 * Pill, StatusBadge, TypeBadge, GlassCard, EmptyState, LoadingState, AlertBox
 */
import React from "react";
import { motion } from "framer-motion";
import {
    FaCheckCircle, FaTimesCircle, FaClock, FaArrowRight,
    FaDownload, FaFileInvoice, FaSpinner, FaExclamationTriangle, FaInfoCircle,
} from "react-icons/fa";
import { colors, pillStyle, glassCardStyle, emptyStateStyle, alertStyle, selectStyle, selectOptionStyle } from "../styles";
import { DOC_TYPES, STATUS_MAP } from "../constants";
import { resolveSovosStatusLabel, resolveSovosMappedStatus } from "../sovosStatusCodes";

/* ═══════════════════════════════════════════════════════════
   PILL — Renkli etiket
   ═══════════════════════════════════════════════════════════ */
export const Pill = ({ color, children, style: extraStyle }) => (
    <span style={{ ...pillStyle(color), ...extraStyle }}>{children}</span>
);

/* ═══════════════════════════════════════════════════════════
   BILLING SELECT — Okunaklı açılır liste
   ═══════════════════════════════════════════════════════════ */
export const BillingSelect = ({ value, onChange, options = [], style, className = "", ...rest }) => (
    <select
        className={`billing-select ${className}`.trim()}
        value={value}
        onChange={onChange}
        style={{ ...selectStyle, ...style }}
        {...rest}
    >
        {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const label = typeof opt === "string" ? opt : opt.label;
            return (
                <option key={val} value={val} style={selectOptionStyle}>
                    {label}
                </option>
            );
        })}
    </select>
);

/* ═══════════════════════════════════════════════════════════
   STATUS BADGE — Durum etiketi
   ═══════════════════════════════════════════════════════════ */
const STATUS_ICONS = {
    approved: <FaCheckCircle />,
    succeed: <FaCheckCircle />,
    completed: <FaCheckCircle />,
    sent: <FaArrowRight />,
    waiting: <FaClock />,
    pending: <FaClock />,
    queued: <FaClock />,
    cancelled: <FaTimesCircle />,
    failed: <FaTimesCircle />,
    error: <FaTimesCircle />,
    received: <FaDownload />,
    draft: <FaFileInvoice />,
};

export const StatusBadge = ({ status, statusCode, provider, profileId }) => {
    const codeLabel = provider === "sovos" && statusCode != null && String(statusCode) !== ""
        ? resolveSovosStatusLabel(statusCode)
        : "";
    const mappedFromCode = codeLabel
        ? resolveSovosMappedStatus(statusCode, status)
        : (status || "").toLowerCase();
    const s = mappedFromCode || (status || "").toLowerCase();
    const config = STATUS_MAP[s] || { color: colors.dim, label: status || "Bilinmiyor" };
    const icon = STATUS_ICONS[s] || <FaFileInvoice />;
    const label = codeLabel ? (codeLabel + " (" + statusCode + ")") : config.label;
    return (
        <Pill color={config.color}>
            {icon} {label}
        </Pill>
    );
};

/* ═══════════════════════════════════════════════════════════
   TYPE BADGE — Belge tipi etiketi
   ═══════════════════════════════════════════════════════════ */
export const TypeBadge = ({ type }) => {
    const config = DOC_TYPES[type] || { color: colors.dim, label: type };
    return <Pill color={config.color}>{config.label}</Pill>;
};

/** Etiket yanında hover ile açıklama — otomatik kesim gecikmesi vb. */
export const InfoTooltip = ({ label, children, width = 320 }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", position: "relative" }}>
        {label && <span>{label}</span>}
        <span
            title=""
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: colors.accent + "22",
                border: "1px solid " + colors.accent + "44",
                color: colors.accent,
                fontSize: "0.65rem",
                cursor: "help",
                flexShrink: 0,
            }}
            className="billing-info-tooltip-trigger"
        >
            <FaInfoCircle />
            <span
                className="billing-info-tooltip-body"
                style={{
                    display: "none",
                    position: "absolute",
                    left: 0,
                    top: "calc(100% + 8px)",
                    zIndex: 50,
                    width,
                    maxWidth: "min(92vw, " + width + "px)",
                    padding: "0.75rem 0.85rem",
                    background: "rgba(15,23,42,0.98)",
                    border: "1px solid " + colors.accent + "40",
                    borderRadius: 10,
                    color: colors.text,
                    fontSize: "0.76rem",
                    lineHeight: 1.55,
                    fontWeight: 400,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                    pointerEvents: "none",
                }}
            >
                {children}
            </span>
        </span>
        <style>{`
            .billing-info-tooltip-trigger:hover .billing-info-tooltip-body,
            .billing-info-tooltip-trigger:focus-within .billing-info-tooltip-body {
                display: block !important;
            }
        `}</style>
    </span>
);

/** Sovos portal — İptal Edildi Mi? */
export const SovosCancelBadge = ({ cancelled, provider, profileId }) => {
    const isEarsiv = String(profileId || "").toUpperCase().includes("EARSIV")
        || String(profileId || "").toLowerCase().includes("arsiv");
    if (provider !== "sovos" && !isEarsiv) return null;
    const yes = cancelled === true || cancelled === "yes" || cancelled === "Evet";
    return (
        <Pill color={yes ? colors.red : colors.green}>
            {yes ? "Evet" : "Hayır"}
        </Pill>
    );
};

/* ═══════════════════════════════════════════════════════════
   GLASS CARD — Cam efektli kart
   ═══════════════════════════════════════════════════════════ */
export const GlassCard = ({ children, style, onClick, animate = true }) => {
    if (!animate) {
        return (
            <div onClick={onClick} style={{ ...glassCardStyle, ...style }}>
                {children}
            </div>
        );
    }
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onClick}
            style={{ ...glassCardStyle, ...style }}
        >
            {children}
        </motion.div>
    );
};

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE — Boş durum gösterimi
   ═══════════════════════════════════════════════════════════ */
export const EmptyState = ({ icon, title, description, action }) => (
    <div style={emptyStateStyle}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>{icon}</div>
        <p
            style={{
                color: colors.muted,
                fontSize: "1rem",
                fontWeight: 600,
                margin: "0 0 0.35rem",
            }}
        >
            {title}
        </p>
        <p
            style={{
                fontSize: "0.82rem",
                margin: "0 0 1rem",
                maxWidth: 400,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.5,
            }}
        >
            {description}
        </p>
        {action}
    </div>
);

/* ═══════════════════════════════════════════════════════════
   LOADING STATE — Yükleme gösterimi
   ═══════════════════════════════════════════════════════════ */
export const LoadingState = ({ message = "Yükleniyor...", sub }) => (
    <div style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <FaSpinner
            style={{
                fontSize: "2rem",
                color: colors.accent,
                animation: "spin 1s linear infinite",
                marginBottom: "0.75rem",
            }}
        />
        <p style={{ color: colors.muted, fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
            {message}
        </p>
        {sub && <p style={{ color: colors.dim, fontSize: "0.8rem", margin: 0 }}>{sub}</p>}
    </div>
);

/* ═══════════════════════════════════════════════════════════
   ALERT BOX — Uyarı/hata kutusu
   ═══════════════════════════════════════════════════════════ */
export const AlertBox = ({ type = "error", message, onAction, actionLabel, onClose }) => {
    const colorMap = {
        error: colors.red,
        warning: colors.yellow,
        success: colors.green,
        info: colors.accent,
    };
    const color = colorMap[type] || colors.red;
    const iconMap = {
        error: <FaExclamationTriangle style={{ color, flexShrink: 0 }} />,
        warning: <FaExclamationTriangle style={{ color, flexShrink: 0 }} />,
        success: <FaCheckCircle style={{ color, flexShrink: 0 }} />,
        info: <FaFileInvoice style={{ color, flexShrink: 0 }} />,
    };

    return (
        <div style={alertStyle(color)}>
            {iconMap[type]}
            <span style={{ color, fontSize: "0.82rem", flex: 1 }}>{message}</span>
            {onAction && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onAction}
                    style={{
                        background: color + "20",
                        border: "1px solid " + color + "40",
                        borderRadius: 8,
                        padding: "0.3rem 0.7rem",
                        cursor: "pointer",
                        color,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        flexShrink: 0,
                    }}
                >
                    {actionLabel || "İşlem"}
                </motion.button>
            )}
            {onClose && (
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    style={{
                        background: "none",
                        border: "none",
                        color: colors.dim,
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        padding: "0.2rem",
                    }}
                >
                    ✕
                </motion.button>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   SECTION TITLE — Bölüm başlığı
   ═══════════════════════════════════════════════════════════ */
export const SectionTitle = ({ icon, title, color }) => (
    <h4
        style={{
            color: "#fff",
            fontSize: "0.9rem",
            fontWeight: 700,
            margin: "0 0 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
        }}
    >
        {icon && <span style={{ color: color || colors.accent }}>{icon}</span>}
        {title}
    </h4>
);

/* ═══════════════════════════════════════════════════════════
   PROGRESS BAR — İlerleme çubuğu
   ═══════════════════════════════════════════════════════════ */
export const ProgressBar = ({ value, max, color, height = 7 }) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ height, background: colors.glass, borderRadius: 4, overflow: "hidden" }}>
            <div
                style={{
                    height: "100%",
                    width: pct + "%",
                    background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                }}
            />
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   SPINNER BUTTON — Yükleme durumlu buton
   ═══════════════════════════════════════════════════════════ */
export const SpinnerButton = ({
    onClick,
    loading,
    disabled,
    children,
    loadingText,
    style: extraStyle,
}) => (
    <motion.button
        whileHover={!disabled && !loading ? { scale: 1.03 } : {}}
        whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
        onClick={onClick}
        disabled={disabled || loading}
        style={{
            opacity: loading ? 0.7 : 1,
            cursor: disabled || loading ? "not-allowed" : "pointer",
            ...extraStyle,
        }}
    >
        {loading ? (
            <>
                <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                {loadingText || "Yükleniyor..."}
            </>
        ) : (
            children
        )}
    </motion.button>
);

/* ═══════════════════════════════════════════════════════════
   DETAIL FIELD — Detay alanı (modal içinde)
   ═══════════════════════════════════════════════════════════ */
export const DetailField = ({ icon, label, value, color, mono, span2 }) => (
    <div
        style={{
            background: colors.glass,
            border: "1px solid " + colors.glassBr,
            borderRadius: 10,
            padding: "0.75rem 0.85rem",
            gridColumn: span2 ? "1 / -1" : undefined,
        }}
    >
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
            {icon && <span style={{ color: color || colors.accent, fontSize: "0.7rem" }}>{icon}</span>}
            <span style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 600 }}>{label}</span>
        </div>
        <p
            style={{
                color: "#fff",
                fontSize: "0.84rem",
                fontWeight: 600,
                margin: 0,
                fontFamily: mono ? "monospace" : "inherit",
                wordBreak: "break-all",
                lineHeight: 1.4,
            }}
        >
            {value || "—"}
        </p>
    </div>
);
