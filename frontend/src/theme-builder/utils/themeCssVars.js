/** globalStyles → CSS custom properties for live preview */
export function themeVariablesToStyle(vars = {}) {
    const style = {
        "--color-primary": vars.primaryColor || "#008060",
        "--color-secondary": vars.secondaryColor || "#334155",
        "--color-accent": vars.accentColor || vars.primaryColor || "#008060",
        "--color-bg": vars.backgroundColor || "#ffffff",
        "--color-text-primary": vars.textPrimary || "#121212",
        "--font-family": vars.fontFamily || "Inter, system-ui, sans-serif",
        "--font-heading": vars.headingFont || vars.fontFamily || "Inter, system-ui, sans-serif",
        "--border-radius": vars.borderRadius ?? "8px",
    };
    if (vars.bodyFontSize) style["--font-size-base"] = vars.bodyFontSize;
    return style;
}
