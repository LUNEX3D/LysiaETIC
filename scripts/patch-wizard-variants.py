# -*- coding: utf-8 -*-
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(root, "frontend", "src", "pages", "ProductUploadWizard.js")
with open(path, encoding="utf-8") as f:
    s = f.read()

s = s.replace(
    "    const canSubmit = uf.name && uf.barcode && uf.sku && uf.price;",
    """    const variantsReady = uploadMode === "variants" && uf.name && productMainId.trim().length >= 2
        && variantRows.filter((r) => r.barcode?.trim() && r.sku?.trim() && r.price).length >= 2;
    const canSubmit = uploadMode === "variants"
        ? variantsReady
        : (uf.name && uf.barcode && uf.sku && uf.price);""",
    1,
)

ui_block = """
                            <div className="puw-card" style={{ marginBottom: 14 }}>
                                <motion.div className="puw-card-header">
                                    <span className="icon"><FaCubes /></span>
                                    <div style={{ flex: 1 }}>
                                        <div className="title">Yükleme modu</div>
                                        <motion.div className="subtitle">Tek ürün veya renk/beden varyant ailesi (Trendyol tek sayfa)</motion.div>
                                    </div>
                                </motion.div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                                    <button type="button" className={`puw-btn sm ${uploadMode === "single" ? "accent" : "outline"}`}
                                        onClick={() => setUploadMode("single")}>Tek ürün</button>
                                    <button type="button" className={`puw-btn sm ${uploadMode === "variants" ? "accent" : "outline"}`}
                                        onClick={() => setUploadMode("variants")}>Varyantlı aile</button>
                                </div>
                                {uploadMode === "variants" && (
                                    <>
                                        <div className="puw-field full" style={{ marginBottom: 12 }}>
                                            <label>Ortak model kodu (productMainId) <span className="required">*</span></label>
                                            <input value={productMainId} onChange={(e) => setProductMainId(e.target.value)}
                                                placeholder="Örn. HSKI-1106 — tüm renk/bedenlerde aynı" />
                                            <div style={{ fontSize: 11, color: "var(--puw-text-dim)", marginTop: 6 }}>
                                                Trendyol&apos;da müşteri tek ürün sayfasında renk/beden seçer; her satırın barkodu farklı olmalı.
                                            </div>
                                        </div>
                                        <div style={{ overflowX: "auto" }}>
                                            <table className="puw-variant-table" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ textAlign: "left", color: "var(--puw-text-dim)" }}>
                                                        <th style={{ padding: 6 }}>Barkod</th>
                                                        <th style={{ padding: 6 }}>Stok kodu</th>
                                                        <th style={{ padding: 6 }}>Renk</th>
                                                        <th style={{ padding: 6 }}>Beden</th>
                                                        <th style={{ padding: 6 }}>Stok</th>
                                                        <th style={{ padding: 6 }}>Fiyat</th>
                                                        <th style={{ padding: 6 }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {variantRows.map((row, idx) => (
                                                        <tr key={idx}>
                                                            <td style={{ padding: 4 }}><input className="puw-input" value={row.barcode}
                                                                onChange={(e) => setVariantRows((prev) => prev.map((r, i) => i === idx ? { ...r, barcode: e.target.value } : r))} placeholder="Barkod" /></td>
                                                            <td style={{ padding: 4 }}><input className="puw-input" value={row.sku}
                                                                onChange={(e) => setVariantRows((prev) => prev.map((r, i) => i === idx ? { ...r, sku: e.target.value } : r))} placeholder="SKU" /></td>
                                                            <td style={{ padding: 4 }}><input className="puw-input" value={row.color}
                                                                onChange={(e) => setVariantRows((prev) => prev.map((r, i) => i === idx ? { ...r, color: e.target.value } : r))} placeholder="Mavi" /></td>
                                                            <td style={{ padding: 4 }}><input className="puw-input" value={row.size}
                                                                onChange={(e) => setVariantRows((prev) => prev.map((r, i) => i === idx ? { ...r, size: e.target.value } : r))} placeholder="M" /></td>
                                                            <td style={{ padding: 4 }}><input className="puw-input" type="number" value={row.stock}
                                                                onChange={(e) => setVariantRows((prev) => prev.map((r, i) => i === idx ? { ...r, stock: e.target.value } : r))} /></td>
                                                            <td style={{ padding: 4 }}><input className="puw-input" type="number" value={row.price}
                                                                onChange={(e) => setVariantRows((prev) => prev.map((r, i) => i === idx ? { ...r, price: e.target.value } : r))} /></td>
                                                            <td style={{ padding: 4 }}>
                                                                {variantRows.length > 2 && (
                                                                    <button type="button" className="puw-btn sm muted"
                                                                        onClick={() => setVariantRows((prev) => prev.filter((_, i) => i !== idx))}><FaTimes /></button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <button type="button" className="puw-btn sm outline" style={{ marginTop: 8 }}
                                            onClick={() => setVariantRows((prev) => [...prev, { barcode: "", sku: "", stock: "0", price: "", listPrice: "", color: "", size: "" }])}>
                                            <FaPlus /> Varyant satırı ekle
                                        </button>
                                    </>
                                )}
                            </div>
"""

# fix motion.div typos in ui_block - use div only
ui_block = ui_block.replace("motion.div", "motion.div").replace('<motion.div className="puw-card-header">', '<div className="puw-card-header">').replace('</motion.div>', '</div>', 2)
ui_block = ui_block.replace("motion.div", "div")

anchor = '                    {step === 1 && (\n                        <div className="puw-step-content puw-step-content--wide-split">'
if ui_block.strip() not in s and anchor in s:
    s = s.replace(anchor, anchor + ui_block, 1)
    print("variant UI inserted")
else:
    print("variant UI skip", anchor in s, "already" if "Yükleme modu" in s else "no")

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("done")
