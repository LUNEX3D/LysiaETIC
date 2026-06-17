import React from "react";
import { Monitor, Laptop, Tablet, Smartphone, Undo2, Redo2, Save, Eye, Upload, ArrowLeft, LayoutTemplate, Palette, Settings2 } from "lucide-react";
import { ThemeStudioExitButton } from "../../components/ThemePageToolbar";
import { PAGE_TEMPLATES, SUPPORTED_LOCALES, DEVICE_WIDTHS } from "../../registry/constants";
import { STUDIO_MODE_META } from "../../registry/editorModes";

const MODE_ICONS = {
    sections: LayoutTemplate,
    brand: Palette,
    settings: Settings2,
};
const DEVICES = [
    { key: "desktop", icon: Monitor, label: "Masaüstü" },
    { key: "laptop", icon: Laptop, label: "Laptop" },
    { key: "tablet", icon: Tablet, label: "Tablet" },
    { key: "mobile", icon: Smartphone, label: "Mobil" },
];

export default function ThemeStudioTopbar({
    siteName,
    activePageKey,
    pageTemplates = PAGE_TEMPLATES,
    activeLocale,
    locales = SUPPORTED_LOCALES,
    device,
    dirty,
    saving,
    publishing,
    canvasWidth,
    onPageChange,
    onLocaleChange,
    onDeviceChange,
    onCanvasWidthChange,
    onSave,
    onPublish,
    onUndo,
    onRedo,
    onPreview,
    onBack,
    onExitToProgram,
    editorMode = "sections",
    onEditorModeChange,
    siteStatus,
}) {
    return (
        <header className="tb-topbar">
            <div className="tb-topbar__left">
                <button type="button" className="tb-topbar__back" onClick={onBack} title="Geri">
                    <ArrowLeft size={18} />
                </button>
                {onExitToProgram && <ThemeStudioExitButton onClick={onExitToProgram} />}
                <div className="tb-topbar__brand">
                    <strong>{siteName || "Tema Stüdyosu"}</strong>
                    <span className="tb-topbar__meta">
                        {siteStatus === "published" && <span className="tb-topbar__live">Yayında</span>}
                        {dirty && <span className="tb-topbar__dirty">Kaydedilmedi</span>}
                    </span>
                </div>
            </div>

            <div className="tb-topbar__modes">
                {STUDIO_MODE_META.map((m) => {
                    const Icon = MODE_ICONS[m.id] || LayoutTemplate;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            className={`tb-mode-tab${editorMode === m.id ? " tb-mode-tab--active" : ""}`}
                            onClick={() => onEditorModeChange?.(m.id)}
                            title={m.hint}
                        >
                            <Icon size={15} />
                            <span className="tb-mode-tab__label">{m.short}</span>
                        </button>
                    );
                })}
            </div>

            <div className="tb-topbar__center">
                <select className="tb-select" value={activePageKey} onChange={(e) => onPageChange(e.target.value)}>
                    {pageTemplates.map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                </select>

                <select className="tb-select" value={activeLocale} onChange={(e) => onLocaleChange(e.target.value)}>
                    {locales.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                </select>

                <div className="tb-device-group">
                    {DEVICES.map(({ key, icon: Icon, label }) => (
                        <button
                            key={key}
                            type="button"
                            className={`tb-device-btn${device === key ? " tb-device-btn--active" : ""}`}
                            onClick={() => onDeviceChange(key)}
                            title={label}
                        >
                            <Icon size={15} />
                        </button>
                    ))}
                </div>

                <input
                    type="range"
                    className="tb-canvas-slider"
                    min={320}
                    max={DEVICE_WIDTHS.desktop}
                    value={canvasWidth}
                    onChange={(e) => onCanvasWidthChange(Number(e.target.value))}
                    title="Tuval genişliği"
                />
                <span className="tb-canvas-width">{canvasWidth}px</span>
            </div>

            <div className="tb-topbar__right">
                <button type="button" className="tb-btn tb-btn--ghost" onClick={onUndo} title="Geri al">
                    <Undo2 size={16} />
                </button>
                <button type="button" className="tb-btn tb-btn--ghost" onClick={onRedo} title="Yinele">
                    <Redo2 size={16} />
                </button>
                <button type="button" className="tb-btn" onClick={onPreview} title="Önizle">
                    <Eye size={16} /> Önizle
                </button>
                <button type="button" className="tb-btn" onClick={onSave} disabled={saving}>
                    <Save size={16} /> {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
                <button type="button" className="tb-btn tb-btn--primary" onClick={onPublish} disabled={publishing}>
                    <Upload size={16} /> {publishing ? "Yayınlanıyor…" : "Yayınla"}
                </button>
            </div>
        </header>
    );
}
