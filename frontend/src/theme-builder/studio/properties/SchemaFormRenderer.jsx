import React from "react";
import WbMediaUpload from "../../../components/websiteBuilder/editor/WbMediaUpload";

export default function SchemaFormRenderer({ schema = [], values = {}, onChange, siteId }) {
    if (!schema.length) {
        return <p className="tb-props-empty">Bu bölüm için ayar yok.</p>;
    }

    return (
        <div className="tb-schema-form">
            {schema.map((field) => {
                const val = values[field.id] ?? field.defaultValue ?? "";
                const handle = (v) => onChange(field.id, v);

                switch (field.type) {
                    case "textarea":
                    case "richtext":
                        return (
                            <div key={field.id} className="tb-field">
                                <label>{field.label}</label>
                                <textarea
                                    className="tb-input tb-input--area"
                                    value={val}
                                    onChange={(e) => handle(e.target.value)}
                                    rows={field.type === "richtext" ? 6 : 3}
                                />
                            </div>
                        );
                    case "number":
                    case "range":
                        return (
                            <div key={field.id} className="tb-field">
                                <label>{field.label}</label>
                                <input
                                    type="number"
                                    className="tb-input"
                                    value={val}
                                    min={field.min}
                                    max={field.max}
                                    step={field.step}
                                    onChange={(e) => handle(Number(e.target.value))}
                                />
                            </div>
                        );
                    case "select":
                        return (
                            <div key={field.id} className="tb-field">
                                <label>{field.label}</label>
                                <select className="tb-input" value={val} onChange={(e) => handle(e.target.value)}>
                                    {(field.options || []).map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    case "checkbox":
                        return (
                            <div key={field.id} className="tb-field">
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                    <input type="checkbox" checked={!!val} onChange={(e) => handle(e.target.checked)} />
                                    {field.label}
                                </label>
                            </div>
                        );
                    case "color":
                        return (
                            <div key={field.id} className="tb-field">
                                <label>{field.label}</label>
                                <input type="color" value={val || "#6366f1"} onChange={(e) => handle(e.target.value)} style={{ width: 48, height: 36, border: "none" }} />
                            </div>
                        );
                    case "image_picker":
                        return (
                            <div key={field.id} className="tb-field">
                                <label>{field.label}</label>
                                {siteId ? (
                                    <WbMediaUpload siteId={siteId} value={val} onChange={handle} />
                                ) : (
                                    <input type="text" className="tb-input" value={val} onChange={(e) => handle(e.target.value)} placeholder="Görsel URL" />
                                )}
                            </div>
                        );
                    case "url":
                    case "video_url":
                    case "text":
                    case "html":
                    default:
                        return (
                            <div key={field.id} className="tb-field">
                                <label>{field.label}</label>
                                <input type="text" className="tb-input" value={val} onChange={(e) => handle(e.target.value)} />
                            </div>
                        );
                }
            })}
        </div>
    );
}
