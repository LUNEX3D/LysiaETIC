"use strict";

/** Global design system schema */
const GLOBAL_SETTINGS_SCHEMA = [
    { id: "primaryColor", type: "color", label: "Ana renk", defaultValue: "#6366f1" },
    { id: "secondaryColor", type: "color", label: "İkincil renk", defaultValue: "#8b5cf6" },
    { id: "accentColor", type: "color", label: "Vurgu rengi", defaultValue: "#f59e0b" },
    { id: "backgroundColor", type: "color", label: "Arka plan", defaultValue: "#ffffff" },
    { id: "textPrimary", type: "color", label: "Metin rengi", defaultValue: "#0f172a" },
    { id: "fontFamily", type: "text", label: "Gövde fontu", defaultValue: "Inter, sans-serif" },
    { id: "headingFont", type: "text", label: "Başlık fontu", defaultValue: "Inter, sans-serif" },
    { id: "borderRadius", type: "text", label: "Köşe yuvarlaklığı", defaultValue: "8px" },
    { id: "containerWidth", type: "text", label: "Konteyner genişliği", defaultValue: "1280px" },
    { id: "buttonStyle", type: "select", label: "Buton stili", defaultValue: "rounded", options: [
        { value: "rounded", label: "Yuvarlak" },
        { value: "pill", label: "Hap" },
        { value: "square", label: "Kare" },
    ] },
];

module.exports = { GLOBAL_SETTINGS_SCHEMA };
