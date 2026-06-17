import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { wbPath } from "../../utils/wbStorefrontPaths";

export default function WbSearchWidget({ siteSlug, products = [] }) {
    const [params, setParams] = useSearchParams();
    const q = (params.get("q") || "").trim();
    const lower = q.toLowerCase();

    const results = useMemo(() => {
        if (!lower) return [];
        return (products || []).filter((p) => {
            const title = String(p.title || p.name || "").toLowerCase();
            const sku = String(p.sku || "").toLowerCase();
            return title.includes(lower) || sku.includes(lower);
        });
    }, [products, lower]);

    const base = wbPath(siteSlug, "urun");

    return (
        <div className="wb-sf-search" style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const v = e.target.elements.q?.value?.trim() || "";
                    if (v) setParams({ q: v });
                    else setParams({});
                }}
                style={{ display: "flex", gap: 8, marginBottom: 24 }}
            >
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="Ürün ara…"
                    style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <button type="submit" style={{ padding: "12px 20px", background: "var(--color-primary, #3b82f6)", color: "#fff", border: "none", borderRadius: 8 }}>
                    Ara
                </button>
            </form>
            {!q && <p style={{ color: "#64748b" }}>Aramak istediğiniz ürün adını yazın.</p>}
            {q && results.length === 0 && <p>Sonuç bulunamadı: &quot;{q}&quot;</p>}
            {results.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                    {results.map((p) => (
                        <Link
                            key={p._id || p.slug}
                            to={`${base}/${p.slug || p._id}`}
                            style={{ textDecoration: "none", color: "inherit", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}
                        >
                            {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />}
                            <div style={{ padding: 12 }}>
                                <strong style={{ fontSize: 14 }}>{p.title || p.name}</strong>
                                {p.price != null && <div style={{ marginTop: 4, color: "var(--color-primary, #3b82f6)" }}>{p.price} ₺</div>}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
