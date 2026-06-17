import React from "react";
import SchemaFormRenderer from "../../studio/properties/SchemaFormRenderer";

export default function DawnThemeSettingsPanel({ groups = [], values = {}, onChange }) {
    if (!groups.length) {
        return <p className="dawn-settings-empty">Tema ayarları yükleniyor…</p>;
    }

    return (
        <div className="dawn-settings">
            {groups.slice(0, 8).map((group) => (
                <details key={group.id} className="dawn-settings__group" open={group.id === "group-1"}>
                    <summary>{group.name.replace(/settings_schema\./g, "").replace(/\.name/g, "") || "Ayarlar"}</summary>
                    <SchemaFormRenderer
                        schema={group.settings}
                        values={values}
                        onChange={(fieldId, value) => onChange(fieldId, value)}
                    />
                </details>
            ))}
        </div>
    );
}
