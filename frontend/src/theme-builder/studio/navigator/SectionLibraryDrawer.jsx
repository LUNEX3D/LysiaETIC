import React from "react";
import { X, Search } from "lucide-react";

export default function SectionLibraryDrawer({ open, onClose, registry = [], categories = [], onAdd }) {
    const [query, setQuery] = React.useState("");
    const [category, setCategory] = React.useState("all");

    if (!open) return null;

    const filtered = registry.filter((s) => {
        const matchCat = category === "all" || s.category === category;
        const q = query.trim().toLowerCase();
        const matchQ = !q || s.label?.toLowerCase().includes(q) || s.key?.toLowerCase().includes(q);
        return matchCat && matchQ;
    });

    const cats = categories.length
        ? categories
        : [...new Set(registry.map((s) => s.category).filter(Boolean))].map((c) => ({ id: c, label: c }));

    return (
        <div className="tb-drawer-overlay" onClick={onClose}>
            <aside className="tb-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="tb-drawer__head">
                    <h2>Bölüm Kütüphanesi</h2>
                    <button type="button" className="tb-btn tb-btn--ghost" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="tb-drawer__search">
                    <Search size={16} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Bölüm ara…"
                    />
                </div>
                <div className="tb-drawer__filters">
                    <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Tümü</button>
                    {cats.map((c) => (
                        <button
                            key={c.id || c}
                            type="button"
                            className={category === (c.id || c) ? "active" : ""}
                            onClick={() => setCategory(c.id || c)}
                        >
                            {c.label || c}
                        </button>
                    ))}
                </div>
                <div className="tb-drawer__grid">
                    {filtered.map((section) => (
                        <button
                            key={section.key}
                            type="button"
                            className="tb-section-card"
                            onClick={() => onAdd(section.key)}
                        >
                            <strong>{section.label}</strong>
                            <span>{section.category}</span>
                        </button>
                    ))}
                </div>
            </aside>
        </div>
    );
}
