/**
 * Faturalandırma Modülü — Ortak Stiller
 * LysiaETIC
 *
 * Tüm billing bileşenlerinde kullanılan ortak stil tanımları.
 * Inline style yerine bu dosyadan import edilerek tutarlılık sağlanır.
 */

/* ═══════════════════════════════════════════════════════════
   RENK PALETİ
   ═══════════════════════════════════════════════════════════ */
export const colors = {
    bg: "#050a12",
    card: "rgba(10, 18, 40, 0.85)",
    cardGradient: "linear-gradient(135deg, rgba(10, 18, 40, 0.85) 0%, rgba(15,20,25,0.85) 100%)",
    border: "rgba(0, 240, 255, 0.12)",
    accent: "#00f0ff",
    green: "#00ff88",
    red: "#ff3366",
    yellow: "#ffcc00",
    purple: "#a855f7",
    blue: "#3b82f6",
    pink: "#ff61d8",
    orange: "#ff8c00",
    text: "#e8edf5",
    muted: "#a8b4c8",
    dim: "#8b97ab",
    textMuted: "#b4c0d4",
    subtle: "#9aa8be",
    glass: "rgba(255,255,255,0.02)",
    glassBr: "rgba(255,255,255,0.05)",
};

/* ═══════════════════════════════════════════════════════════
   ORTAK STİLLER
   ═══════════════════════════════════════════════════════════ */

export const glassCardStyle = {
    background: colors.cardGradient,
    border: "1px solid " + colors.border,
    borderRadius: 16,
    padding: "1.5rem",
};

export const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 8,
    padding: "0.6rem 0.85rem",
    color: "#f4f7fb",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
};

export const textareaStyle = {
    ...inputStyle,
    minHeight: "130px",
    resize: "vertical",
    lineHeight: 1.55,
    fontFamily: "inherit",
};

export const inputFocusStyle = {
    borderColor: colors.accent + "60",
};

export const labelStyle = {
    color: colors.textMuted,
    fontSize: "0.8rem",
    fontWeight: 600,
    marginBottom: "0.35rem",
    display: "block",
    letterSpacing: "0.01em",
};

export const helpTextStyle = {
    color: colors.textMuted,
    fontSize: "0.8rem",
    lineHeight: 1.55,
    margin: "0.35rem 0 0",
};

export const sectionCardStyle = {
    background: colors.glass,
    border: "1px solid " + colors.glassBr,
    borderRadius: 14,
    padding: "1.15rem 1.25rem",
    marginBottom: "1rem",
};

export const formSectionTitleStyle = {
    color: colors.accent,
    fontSize: "0.88rem",
    fontWeight: 700,
    margin: "0 0 0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "0.45rem",
};

export const infoBannerStyle = (tone = "accent") => ({
    background: colors[tone] + "12",
    border: "1px solid " + colors[tone] + "35",
    borderRadius: 10,
    padding: "0.65rem 0.85rem",
    color: colors[tone],
    fontSize: "0.78rem",
    lineHeight: 1.5,
});

export const chipInactiveStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: colors.text,
};

export const selectOptionStyle = {
    background: "#1a2438",
    color: "#f4f7fb",
};

export const selectStyle = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%237a8ba8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.75rem center",
    paddingRight: "2rem",
};

export const buttonPrimary = {
    background: "linear-gradient(135deg, " + colors.accent + ", #44a08d)",
    border: "none",
    borderRadius: 10,
    padding: "0.65rem 1.25rem",
    color: "#fff",
    fontSize: "0.82rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    transition: "opacity 0.2s, transform 0.1s",
};

export const buttonSecondary = {
    background: colors.glass,
    border: "1px solid " + colors.glassBr,
    borderRadius: 10,
    padding: "0.65rem 1.25rem",
    color: colors.muted,
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    transition: "border-color 0.2s, transform 0.1s",
};

export const buttonDanger = {
    background: colors.red + "15",
    border: "1px solid " + colors.red + "30",
    borderRadius: 10,
    padding: "0.65rem 1.25rem",
    color: colors.red,
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
};

export const buttonSuccess = {
    background: colors.green + "15",
    border: "1px solid " + colors.green + "30",
    borderRadius: 10,
    padding: "0.65rem 1.25rem",
    color: colors.green,
    fontSize: "0.82rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
};

export const buttonIcon = {
    background: colors.glass,
    border: "1px solid " + colors.glassBr,
    borderRadius: 6,
    padding: "0.35rem",
    cursor: "pointer",
    fontSize: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.1s, background 0.15s",
};

export const pillStyle = (color) => ({
    background: color + "15",
    border: "1px solid " + color + "35",
    padding: "0.25rem 0.6rem",
    borderRadius: 8,
    color: color,
    fontSize: "0.72rem",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    whiteSpace: "nowrap",
});

export const modalOverlay = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    background: "rgba(0,0,0,0.8)",
    backdropFilter: "blur(8px)",
};

export const modalContent = {
    background: "linear-gradient(135deg, " + colors.card + " 0%, rgba(15,20,25,0.98) 100%)",
    border: "1px solid " + colors.border,
    borderRadius: 20,
    padding: "2rem",
    width: "100%",
    maxHeight: "92vh",
    overflowY: "auto",
};

export const tableHeaderStyle = {
    color: colors.dim,
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

export const alertStyle = (color) => ({
    background: color + "10",
    border: "1px solid " + color + "30",
    borderRadius: 12,
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
});

export const sectionTitleStyle = {
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: 700,
    margin: "1.5rem 0 0.75rem",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
};

export const collapsibleHeaderStyle = (open) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.85rem 1rem",
    background: open ? "rgba(0,240,255,0.08)" : "rgba(255,255,255,0.04)",
    border: "1px solid " + (open ? "rgba(0,240,255,0.22)" : "rgba(255,255,255,0.1)"),
    borderRadius: open ? "12px 12px 0 0" : 12,
    cursor: "pointer",
    color: "#fff",
    textAlign: "left",
});

export const collapsibleBodyStyle = {
    padding: "1rem",
    border: "1px solid rgba(255,255,255,0.1)",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    background: "rgba(0,0,0,0.15)",
};

export const kpiCardStyle = (color) => ({
    background: "linear-gradient(135deg, " + colors.card + " 0%, rgba(15,20,25,0.9) 100%)",
    border: "1px solid " + color + "30",
    borderRadius: 14,
    padding: "1.25rem",
    position: "relative",
    overflow: "hidden",
    transition: "transform 0.2s, box-shadow 0.2s",
});

export const emptyStateStyle = {
    textAlign: "center",
    padding: "3rem 1.5rem",
    color: colors.textMuted,
};

/* ═══════════════════════════════════════════════════════════
   CSS KEYFRAMES (inline <style> tag için)
   ═══════════════════════════════════════════════════════════ */
export const globalKeyframes = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
    .billing-page select,
    .billing-select {
        color-scheme: dark;
        color: #f4f7fb !important;
        background-color: #1a2438 !important;
    }
    .billing-page select option,
    .billing-select option {
        color: #f4f7fb !important;
        background-color: #1a2438 !important;
    }
`;

/* ═══════════════════════════════════════════════════════════
   YARDIMCI STİL FONKSİYONLARI
   ═══════════════════════════════════════════════════════════ */

/**
 * Renk ile glow efekti oluştur
 */
export const glowShadow = (color, intensity = 25) =>
    `0 8px 32px ${color}${intensity}`;

/**
 * Gradient arka plan oluştur
 */
export const gradientBg = (color1, color2) =>
    `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;

/**
 * Renk ile şeffaf varyant oluştur
 */
export const withAlpha = (color, alpha) => {
    if (color.startsWith("#")) {
        const hex = color.slice(1);
        const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
        return "#" + hex + alphaHex;
    }
    return color;
};
