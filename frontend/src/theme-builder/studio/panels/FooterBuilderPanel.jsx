import React from "react";

const BLOCK_TYPES = [
    { value: "about", label: "Hakkında" },
    { value: "categories", label: "Kategoriler" },
    { value: "newsletter", label: "Bülten" },
    { value: "social", label: "Sosyal" },
    { value: "payments", label: "Ödeme ikonları" },
    { value: "policies", label: "Politikalar" },
];

export default function FooterBuilderPanel({ footer = {}, onChange }) {
    const blocks = footer.blocks || [];

    const patch = (partial) => onChange({ ...footer, ...partial });

    const addBlock = () => {
        patch({
            blocks: [
                ...blocks,
                { id: `fb_${Date.now()}`, type: "about", content: { heading: "Hakkımızda", text: "" } },
            ],
        });
    };

    const updateBlock = (id, field, value) => {
        patch({
            blocks: blocks.map((b) =>
                b.id === id ? { ...b, content: { ...(b.content || {}), [field]: value } } : b
            ),
        });
    };

    const changeType = (id, type) => {
        patch({ blocks: blocks.map((b) => (b.id === id ? { ...b, type } : b)) });
    };

    const removeBlock = (id) => patch({ blocks: blocks.filter((b) => b.id !== id) });

    return (
        <div className="tb-properties">
            <h3 className="tb-properties__title">Alt Menü</h3>
            <label className="tb-field">
                <span>Telif metni</span>
                <input
                    className="tb-input"
                    value={footer.copyright || ""}
                    onChange={(e) => patch({ copyright: e.target.value })}
                />
            </label>
            <div className="tb-panel-section">
                <div className="tb-panel-section__head">
                    <strong>Bloklar</strong>
                    <button type="button" className="tb-btn tb-btn--sm" onClick={addBlock}>+ Blok</button>
                </div>
                {blocks.map((block) => (
                    <div key={block.id} className="tb-menu-item-card">
                        <select className="tb-input" value={block.type} onChange={(e) => changeType(block.id, e.target.value)}>
                            {BLOCK_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                        <input
                            className="tb-input"
                            value={block.content?.heading || ""}
                            onChange={(e) => updateBlock(block.id, "heading", e.target.value)}
                            placeholder="Başlık"
                        />
                        <textarea
                            className="tb-input tb-input--area"
                            value={block.content?.text || ""}
                            onChange={(e) => updateBlock(block.id, "text", e.target.value)}
                            placeholder="İçerik"
                            rows={3}
                        />
                        <button type="button" className="tb-btn tb-btn--danger tb-btn--sm" onClick={() => removeBlock(block.id)}>
                            Sil
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
