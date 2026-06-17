import { useMemo } from "react";
import { useApp } from "../context/AppContext";

/**
 * Panel sayfalarında AppContext teması ile CSS değişkenleri
 */
export function useDashtockTheme() {
    const { theme: C, resolvedTheme } = useApp();
    const isDark = resolvedTheme === "dark";

    const rootStyle = useMemo(
        () => ({
            background: C.bg,
            color: C.text,
            "--ec-bg": C.bg,
            "--ec-card": C.card,
            "--ec-surface": C.card,
            "--ec-surface-2": isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.03)",
            "--ec-border": C.border,
            "--ec-accent": C.accent,
            "--ec-accent-soft": isDark ? "rgba(78, 205, 196, 0.14)" : "rgba(13, 148, 136, 0.12)",
            "--ec-accent-glow": isDark ? "rgba(78, 205, 196, 0.28)" : "rgba(13, 148, 136, 0.2)",
            "--ec-text": C.text,
            "--ec-muted": C.muted,
            "--ec-dim": C.dim,
            "--ec-green": C.green,
            "--ec-red": C.red,
            "--ec-yellow": C.yellow,
            "--ec-purple": C.purple,
            "--ec-glass": C.glass,
            "--ec-glass-br": C.glassBr,
            "--ec-hover": C.hoverBg,
            "--ec-input-bg": C.inputBg,
            "--ec-input-border": C.inputBorder,
            "--ec-select-option-bg": isDark ? "#1e293b" : "#ffffff",
            "--ec-select-option-text": isDark ? "#f1f5f9" : "#0f172a",
            "--ec-chart-grid": isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(100, 116, 139, 0.2)",
            "--ec-chart-tick": C.muted,
            "--ec-shadow": isDark
                ? "0 8px 32px rgba(0, 0, 0, 0.35)"
                : "0 8px 28px rgba(15, 23, 42, 0.08)",
        }),
        [C, isDark]
    );

    const rootClassName = `ec-theme-root${isDark ? "" : " ec-theme-root--light"}`;

    return { C, isDark, rootClassName, rootStyle };
}
