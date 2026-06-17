import React from "react";
import { ArrowLeft, LayoutGrid } from "lucide-react";

/** E-ticaret / tema sayfaları üst çubuğu */
export default function ThemePageToolbar({ title, subtitle, onExitToProgram, children }) {
    if (!onExitToProgram && !children) return null;

    return (
        <div className="tb-page-toolbar">
            <div className="tb-page-toolbar__left">
                {onExitToProgram && (
                    <button type="button" className="tb-btn tb-btn--exit tb-btn--exit-prominent" onClick={onExitToProgram}>
                        <LayoutGrid size={16} />
                        Dashtock Ana Sayfa
                    </button>
                )}
                {(title || subtitle) && (
                    <div className="tb-page-toolbar__titles">
                        {title && <strong>{title}</strong>}
                        {subtitle && <span>{subtitle}</span>}
                    </div>
                )}
            </div>
            {children && <div className="tb-page-toolbar__right">{children}</div>}
        </div>
    );
}

export function ThemeStudioExitButton({ onClick }) {
    return (
        <button type="button" className="tb-btn tb-btn--exit tb-btn--exit-prominent" onClick={onClick} title="Dashtock Ana Sayfa">
            <LayoutGrid size={16} />
            Dashtock Ana Sayfa
        </button>
    );
}
