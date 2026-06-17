import React from "react";
import SchemaFormRenderer from "../properties/SchemaFormRenderer";

const HEADER_SCHEMA = [
    { id: "logoUrl", type: "image_picker", label: "Logo" },
    { id: "logoWidth", type: "number", label: "Logo genişliği", defaultValue: 140 },
    { id: "sticky", type: "checkbox", label: "Yapışkan header", defaultValue: true },
    { id: "transparent", type: "checkbox", label: "Şeffaf", defaultValue: false },
];

export default function HeaderBuilderPanel({ header = {}, onChange }) {
    const menuItems = header.menuItems || [];

    const patch = (partial) => onChange({ ...header, ...partial });

    const updateMenuItem = (id, field, value) => {
        patch({
            menuItems: menuItems.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
        });
    };

    const addMenuItem = () => {
        patch({
            menuItems: [
                ...menuItems,
                { id: `menu_${Date.now()}`, label: "Yeni link", url: "/", children: [] },
            ],
        });
    };

    const addChild = (parentId) => {
        patch({
            menuItems: menuItems.map((m) => {
                if (m.id !== parentId) return m;
                const children = [...(m.children || []), {
                    id: `sub_${Date.now()}`,
                    label: "Alt link",
                    description: "",
                    image: "",
                    url: "/",
                }];
                return { ...m, children };
            }),
        });
    };

    const updateChild = (parentId, childId, field, value) => {
        patch({
            menuItems: menuItems.map((m) => {
                if (m.id !== parentId) return m;
                return {
                    ...m,
                    children: (m.children || []).map((c) =>
                        c.id === childId ? { ...c, [field]: value } : c
                    ),
                };
            }),
        });
    };

    const removeMenuItem = (id) => patch({ menuItems: menuItems.filter((m) => m.id !== id) });

    return (
        <div className="tb-properties">
            <h3 className="tb-properties__title">Üst Menü</h3>
            <SchemaFormRenderer
                schema={HEADER_SCHEMA}
                values={header}
                onChange={(fieldId, value) => patch({ [fieldId]: value })}
            />
            <div className="tb-panel-section">
                <div className="tb-panel-section__head">
                    <strong>Menü linkleri</strong>
                    <button type="button" className="tb-btn tb-btn--sm" onClick={addMenuItem}>+ Link</button>
                </div>
                {menuItems.map((item) => (
                    <div key={item.id} className="tb-menu-item-card">
                        <input
                            className="tb-input"
                            value={item.label}
                            onChange={(e) => updateMenuItem(item.id, "label", e.target.value)}
                            placeholder="Etiket"
                        />
                        <input
                            className="tb-input"
                            value={item.url}
                            onChange={(e) => updateMenuItem(item.id, "url", e.target.value)}
                            placeholder="URL"
                        />
                        <button type="button" className="tb-btn tb-btn--sm" onClick={() => addChild(item.id)}>
                            Alt linkler
                        </button>
                        <button type="button" className="tb-btn tb-btn--danger tb-btn--sm" onClick={() => removeMenuItem(item.id)}>
                            Sil
                        </button>
                        {(item.children || []).map((child) => (
                            <div key={child.id} className="tb-menu-child">
                                <input className="tb-input" value={child.label} onChange={(e) => updateChild(item.id, child.id, "label", e.target.value)} placeholder="Başlık" />
                                <input className="tb-input" value={child.description || ""} onChange={(e) => updateChild(item.id, child.id, "description", e.target.value)} placeholder="Açıklama" />
                                <input className="tb-input" value={child.image || ""} onChange={(e) => updateChild(item.id, child.id, "image", e.target.value)} placeholder="Görsel URL" />
                                <input className="tb-input" value={child.url} onChange={(e) => updateChild(item.id, child.id, "url", e.target.value)} placeholder="URL" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
