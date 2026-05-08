import React from "react";
import { motion } from "framer-motion";

export const GlassCard = ({ children, style, C, ...rest }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}dd 100%)`,
                border: `1px solid ${C.border}`,
                borderRadius: mobile ? 12 : 16,
                padding: mobile ? "1rem" : "1.5rem",
                minWidth: 0,
                overflow: "hidden",
                ...style,
            }}
            {...rest}
        >
            {children}
        </motion.div>
    );
};

export const KpiCard = ({ icon, label, value, sub, color, delay = 0, onClick, C }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.35 }}
            whileHover={mobile ? {} : { y: -4, boxShadow: `0 12px 32px ${color}30` }}
            onClick={onClick}
            style={{
                background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg}ee 100%)`,
                border: `1px solid ${color}30`,
                borderRadius: mobile ? 12 : 14,
                padding: mobile ? "0.75rem 0.85rem" : "1.25rem 1.5rem",
                cursor: onClick ? "pointer" : "default",
                position: "relative",
                overflow: "hidden",
                minWidth: 0,
            }}
        >
            <div style={{ position: "absolute", top: 0, right: 0, width: mobile ? 80 : 120, height: mobile ? 80 : 120, background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: mobile ? "0.5rem" : "0.75rem", marginBottom: mobile ? "0.4rem" : "0.75rem", position: "relative", zIndex: 1 }}>
                <div style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, padding: mobile ? "0.4rem" : "0.6rem", borderRadius: mobile ? 8 : 10, fontSize: mobile ? "1rem" : "1.3rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${color}40`, flexShrink: 0 }}>
                    {icon}
                </div>
                <span style={{ color: C.muted, fontSize: mobile ? "0.65rem" : "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: mobile ? "1.15rem" : "1.75rem", fontWeight: 800, color: C.text, margin: 0, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</h3>
                {sub && <p style={{ color: C.dim, fontSize: mobile ? "0.6rem" : "0.75rem", margin: "0.25rem 0 0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>}
            </div>
        </motion.div>
    );
};

export const Pill = ({ color, children }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <span style={{
            background: `${color}15`,
            border: `1px solid ${color}35`,
            padding: mobile ? "0.2rem 0.45rem" : "0.3rem 0.7rem",
            borderRadius: mobile ? 8 : 10,
            color,
            fontSize: mobile ? "0.65rem" : "0.75rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            whiteSpace: "nowrap",
            flexShrink: 0,
        }}>
            {children}
        </span>
    );
};

export const SectionTitle = ({ icon, title, badge, action, C }) => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: mobile ? "0.75rem" : "1.25rem", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: mobile ? "0.9rem" : "1.1rem", fontWeight: 700, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <span style={{ fontSize: mobile ? "1rem" : "1.3rem", flexShrink: 0 }}>{icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                {badge && !mobile && <Pill color={C.accent}>{badge}</Pill>}
                {action}
            </div>
        </div>
    );
};

