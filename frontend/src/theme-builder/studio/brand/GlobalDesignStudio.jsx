import React from "react";
import { Palette, Type, LayoutGrid, MousePointerClick } from "lucide-react";
import SchemaFormRenderer from "../properties/SchemaFormRenderer";
import { COLOR_PRESETS, FONT_PRESETS, BUTTON_STYLE_PRESETS } from "./brandPresets";

const GLOBAL_SCHEMA = [
    { id: "primaryColor", type: "color", label: "Ana renk", defaultValue: "#6366f1" },
    { id: "secondaryColor", type: "color", label: "İkincil renk", defaultValue: "#8b5cf6" },
    { id: "accentColor", type: "color", label: "Vurgu rengi", defaultValue: "#f59e0b" },
    { id: "backgroundColor", type: "color", label: "Sayfa arka planı", defaultValue: "#ffffff" },
    { id: "textPrimary", type: "color", label: "Metin rengi", defaultValue: "#0f172a" },
    { id: "fontFamily", type: "text", label: "Gövde fontu", defaultValue: "Inter, sans-serif" },
    { id: "headingFont", type: "text", label: "Başlık fontu", defaultValue: "Inter, sans-serif" },
    { id: "borderRadius", type: "text", label: "Köşe yuvarlaklığı", defaultValue: "8px" },
    { id: "containerWidth", type: "text", label: "İçerik genişliği", defaultValue: "1280px" },
    {
        id: "buttonStyle",
        type: "select",
        label: "Buton stili",
        defaultValue: "rounded",
        options: [
            { value: "rounded", label: "Yuvarlak" },
            { value: "pill", label: "Hap" },
            { value: "square", label: "Kare" },
        ],
    },
];

function BrandPreviewCard({ styles }) {
    const s = styles || {};
    return (
        <div
            className="tb-brand-preview"
            style={{
                background: s.backgroundColor || "#fff",
                color: s.textPrimary || "#0f172a",
                fontFamily: s.fontFamily || "Inter, sans-serif",
            }}
        >
            <p className="tb-brand-preview__eyebrow" style={{ color: s.secondaryColor }}>Önizleme</p>
            <h3 style={{ fontFamily: s.headingFont || s.fontFamily, margin: "0 0 8px" }}>Mağaza Başlığı</h3>
            <p style={{ fontSize: 13, opacity: 0.85, margin: "0 0 12px" }}>Renk ve font değişiklikleri tüm vitrine uygulanır.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span
                    className="tb-brand-preview__btn"
                    style={{
                        background: s.primaryColor || "#6366f1",
                        borderRadius: s.buttonStyle === "pill" ? "999px" : s.buttonStyle === "square" ? "0" : s.borderRadius || "8px",
                    }}
                >
                    Birincil
                </span>
                <span
                    className="tb-brand-preview__btn tb-brand-preview__btn--ghost"
                    style={{
                        color: s.primaryColor,
                        borderColor: s.primaryColor,
                        borderRadius: s.borderRadius || "8px",
                    }}
                >
                    İkincil
                </span>
            </div>
        </div>
    );
}

export default function GlobalDesignStudio({ styles = {}, onChange }) {
    const applyPreset = (preset) => {
        onChange({ ...styles, ...preset.styles });
    };

    const applyFont = (preset) => {
        onChange({ ...styles, fontFamily: preset.fontFamily, headingFont: preset.headingFont });
    };

    const applyButton = (preset) => {
        onChange({ ...styles, borderRadius: preset.borderRadius, buttonStyle: preset.buttonStyle });
    };

    return (
        <aside className="tb-brand-studio">
            <div className="tb-brand-studio__head">
                <Palette size={18} />
                <div>
                    <strong>Marka & Stil</strong>
                    <p>Tüm sayfalara uygulanan global tasarım tokenları</p>
                </div>
            </div>

            <BrandPreviewCard styles={styles} />

            <section className="tb-brand-studio__section">
                <h4><Palette size={14} /> Renk paletleri</h4>
                <div className="tb-brand-presets">
                    {COLOR_PRESETS.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            className="tb-brand-preset"
                            onClick={() => applyPreset(p)}
                            title={p.name}
                        >
                            <span className="tb-brand-preset__swatch" style={{ background: p.swatch }} />
                            <span>{p.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="tb-brand-studio__section">
                <h4><Type size={14} /> Tipografi</h4>
                <div className="tb-brand-presets tb-brand-presets--fonts">
                    {FONT_PRESETS.map((p) => (
                        <button key={p.id} type="button" className="tb-brand-preset" onClick={() => applyFont(p)}>
                            <span style={{ fontFamily: p.headingFont, fontWeight: 600 }}>{p.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="tb-brand-studio__section">
                <h4><MousePointerClick size={14} /> Buton stili</h4>
                <div className="tb-brand-presets">
                    {BUTTON_STYLE_PRESETS.map((p) => (
                        <button key={p.id} type="button" className="tb-brand-preset" onClick={() => applyButton(p)}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="tb-brand-studio__section">
                <h4><LayoutGrid size={14} /> Detaylı ayarlar</h4>
                <div className="tb-brand-studio__form">
                    <SchemaFormRenderer
                        schema={GLOBAL_SCHEMA}
                        values={styles}
                        onChange={(fieldId, value) => onChange({ ...styles, [fieldId]: value })}
                    />
                </div>
            </section>
        </aside>
    );
}
