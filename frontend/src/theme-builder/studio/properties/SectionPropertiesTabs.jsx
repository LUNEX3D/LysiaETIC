import React, { useState } from "react";
import SchemaFormRenderer from "./SchemaFormRenderer";

const CONTENT_TYPES = new Set(["text", "textarea", "richtext", "html", "image_picker", "url", "video_url"]);
const DESIGN_TYPES = new Set(["color", "range", "select", "checkbox"]);
const LAYOUT_KEYWORDS = /padding|margin|column|width|height|align|gap|spacing|ratio|layout/i;

function classifyField(field) {
    if (LAYOUT_KEYWORDS.test(field.id || "")) return "layout";
    if (DESIGN_TYPES.has(field.type)) return "design";
    if (CONTENT_TYPES.has(field.type)) return "content";
    return "content";
}

function splitSchema(schema = []) {
    const tabs = { content: [], design: [], layout: [], advanced: [] };
    schema.forEach((field) => {
        const tab = classifyField(field);
        tabs[tab].push(field);
    });
    return tabs;
}

const TAB_LABELS = [
    { id: "content", label: "İçerik" },
    { id: "design", label: "Tasarım" },
    { id: "layout", label: "Yerleşim" },
    { id: "advanced", label: "Gelişmiş" },
];

export default function SectionPropertiesTabs({ schema, values, siteId, onChange, onPatchSettings }) {
    const tabs = splitSchema(schema);
    const available = TAB_LABELS.filter((t) => tabs[t.id]?.length > 0);
    const [activeTab, setActiveTab] = useState(available[0]?.id || "content");

    const settingsSchema = schema.filter((f) => f.group === "settings" || f.scope === "settings");

    return (
        <div className="tb-props-tabs">
            <div className="tb-props-tabs__nav">
                {available.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`tb-props-tabs__btn${activeTab === t.id ? " tb-props-tabs__btn--active" : ""}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="tb-props-tabs__body">
                {activeTab === "advanced" && settingsSchema.length > 0 ? (
                    <SchemaFormRenderer
                        schema={settingsSchema}
                        values={values.settings || {}}
                        siteId={siteId}
                        onChange={(fieldId, value) => onPatchSettings?.(fieldId, value)}
                    />
                ) : (
                    <SchemaFormRenderer
                        schema={tabs[activeTab] || []}
                        values={values}
                        siteId={siteId}
                        onChange={onChange}
                    />
                )}
                {!tabs[activeTab]?.length && activeTab !== "advanced" && (
                    <p className="tb-props-empty">Bu sekmede düzenlenecek alan yok.</p>
                )}
            </div>
        </div>
    );
}
