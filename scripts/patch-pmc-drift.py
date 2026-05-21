# -*- coding: utf-8 -*-
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(root, "frontend", "src", "pages", "ProductManagementCenter.js")
with open(path, encoding="utf-8") as f:
    s = f.read()

old_btn = """                                                        <button type="button" className="ud-pm-btn sm accent outline"
                                                            disabled={actionLoading === `fa-${p._id}-${d.field}`}
                                                            onClick={() => handleApplyPlatformField(p._id, pl.marketplaceName, d.field)}>
                                                            Platformu al
                                                        </button>"""

new_btn = "                                                        {renderDriftFieldAction(p._id, pl.marketplaceName, d)}"

if old_btn in s:
    s = s.replace(old_btn, new_btn, 1)
    print("detail drift button patched")
else:
    print("detail drift button NOT FOUND")

old_ps = '                                                    <div className="mono-dim">{mp.barcode}</div>'
new_ps = """                                                    <motion.div className="mono-dim">{mp.barcode} · {mp.sku}</div>
                                                    {productHasBarcodeDrift(p) && (
                                                        <button type="button" className="ud-pm-btn sm" style={{ marginTop: 4, fontSize: 10, padding: "2px 8px", background: "var(--ud-pm-red)", color: "#fff" }}
                                                            onClick={(e) => { e.stopPropagation(); handleApplyMasterToPlatform(p._id, "Trendyol"); }}>
                                                            Barkod uyumsuz — düzelt
                                                        </button>
                                                    )}"""

# fix typo in new_ps - use div only
new_ps = """                                                    <div className="mono-dim">{mp.barcode} · {mp.sku}</div>
                                                    {productHasBarcodeDrift(p) && (
                                                        <button type="button" className="ud-pm-btn sm" style={{ marginTop: 4, fontSize: 10, padding: "2px 8px", background: "var(--ud-pm-red)", color: "#fff" }}
                                                            onClick={(e) => { e.stopPropagation(); handleApplyMasterToPlatform(p._id, "Trendyol"); }}>
                                                            Barkod uyumsuz — düzelt
                                                        </button>
                                                    )}"""

if old_ps in s:
    s = s.replace(old_ps, new_ps, 1)
    print("pricestock row patched")
else:
    print("pricestock row NOT FOUND")

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("written", path)
