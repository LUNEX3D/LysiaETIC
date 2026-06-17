import React from "react";

const SEO_FIELDS = [
    { id: "metaTitle", label: "Meta başlık" },
    { id: "metaDescription", label: "Meta açıklama" },
    { id: "keywords", label: "Anahtar kelimeler" },
    { id: "canonical", label: "Canonical URL" },
    { id: "ogTitle", label: "OG başlık" },
    { id: "ogDescription", label: "OG açıklama" },
    { id: "ogImage", label: "OG görsel URL" },
    { id: "robots", label: "Robots", defaultValue: "index,follow" },
    { id: "twitterCard", label: "Twitter kart", defaultValue: "summary_large_image" },
    { id: "jsonLd", label: "JSON-LD (opsiyonel)" },
];

export default function SeoPanel({ seo = {}, onChange }) {
    const patch = (id, value) => onChange({ ...seo, [id]: value });

    return (
        <div className="tb-properties">
            <h3 className="tb-properties__title">Sayfa SEO</h3>
            {SEO_FIELDS.map((f) => (
                <label key={f.id} className="tb-field">
                    <span>{f.label}</span>
                    {f.id === "metaDescription" || f.id === "jsonLd" ? (
                        <textarea
                            className="tb-input tb-input--area"
                            rows={f.id === "jsonLd" ? 5 : 3}
                            value={seo[f.id] || f.defaultValue || ""}
                            onChange={(e) => patch(f.id, e.target.value)}
                        />
                    ) : (
                        <input
                            className="tb-input"
                            value={seo[f.id] || f.defaultValue || ""}
                            onChange={(e) => patch(f.id, e.target.value)}
                        />
                    )}
                </label>
            ))}
        </div>
    );
}
