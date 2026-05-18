# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js")
text = p.read_text(encoding="utf-8")

RENDER_FIELD_AUDIT = '''
    const driftSeverityColor = (s) => {
        if (s === "critical") return "var(--ud-pm-red)";
        if (s === "high") return "var(--ud-pm-yellow)";
        if (s === "medium") return "var(--ud-pm-accent)";
        return "var(--ud-pm-text-dim)";
    };

    const renderFieldAudit = () => {
        const faPages = Math.max(1, Math.ceil(faTotal / 30));
        return (
            <motion.div className="ud-pm-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <FaShieldAlt style={{ color: "var(--ud-pm-purple)" }} /> Alan denetimi
                    </h3>
                    {faSummary && <Pill color="var(--ud-pm-purple)">{faSummary.productsWithDrift} ürün</Pill>}
                    {faSummary?.criticalProducts > 0 && <Pill color="var(--ud-pm-red)">{faSummary.criticalProducts} kritik</Pill>}
                </div>
                <p style={{ fontSize: 12, color: "var(--ud-pm-text-dim)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Master kayıt ile pazaryeri snapshot karşılaştırması (barkod, SKU, ad, model, marka, kategori, fiyat).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <input className="ud-pm-input" style={{ flex: 1, minWidth: 180 }} placeholder="Ürün / barkod / SKU ara…" value={faSearch}
                        onChange={e => setFaSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && loadFieldAudit(0)} />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ud-pm-text-dim)" }}>
                        <input type="checkbox" className="ud-pm-checkbox" checked={faCriticalOnly} onChange={e => setFaCriticalOnly(e.target.checked)} />
                        Sadece kritik (barkod/SKU)
                    </label>
                    <button type="button" className="ud-pm-btn sm accent" onClick={() => loadFieldAudit(0)}><FaSearch /> Listele</button>
                </div>
                {faLoading ? <Loading /> : faItems.length === 0 ? (
                    <Empty icon={FaShieldAlt} title="Alan farkı yok" desc="Uyumlu veya henüz ürün çekilmedi." />
                ) : (
                    <div className="ud-pm-log-list ud-pm-log-list--journal">
                        {faItems.map(item => {
                            const expanded = faExpandedId === item._id;
                            return (
                                <div key={item._id} className="ud-pm-log-item ud-pm-log-item--expandable"
                                    onClick={() => setFaExpandedId(expanded ? null : item._id)}>
                                    <div className="ud-pm-log-item-row">
                                        <span className="dot" style={{ background: item.hasCritical ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} />
                                        {item.hasCritical && <Pill color="var(--ud-pm-red)">Kritik</Pill>}
                                        <span className="log-name">{item.name}</span>
                                        <span style={{ fontSize: 11, color: "var(--ud-pm-text-dim)" }}>{item.barcode} · {item.sku}</span>
                                        <Pill color="var(--ud-pm-purple)">{item.driftPlatformCount} platform</Pill>
                                        {expanded ? <FaChevronDown style={{ fontSize: 10 }} /> : <FaChevronRight style={{ fontSize: 10 }} />}
                                    </div>
                                    {expanded && (
                                        <div className="ud-pm-log-item-detail" onClick={e => e.stopPropagation()}>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                                <button type="button" className="ud-pm-btn sm outline" onClick={() => openDetail(item._id)}><FaEye /> Ürün detayı</button>
                                                <button type="button" className="ud-pm-btn sm outline" onClick={() => handleRefreshFieldAuditOne(item._id)}><FaSync /> Yeniden denetle</button>
                                            </div>
                                            {(item.platforms || []).map(pl => (
                                                <div key={pl.marketplaceName} style={{ marginBottom: 10, padding: 8, border: "1px solid var(--ud-pm-glass-border)", borderRadius: 8 }}>
                                                    <motion.div style={{ fontWeight: 700, fontSize: 12, color: PL_COLOR[pl.marketplaceName], marginBottom: 6 }}>{pl.marketplaceName}</motion.div>
                                                    {(pl.drifts || []).map((d, di) => (
                                                        <div key={di} style={{ display: "grid", gridTemplateColumns: "minmax(80px,1fr) 1fr 1fr auto", gap: 6, fontSize: 11, marginTop: 6, alignItems: "center" }}>
                                                            <span style={{ color: driftSeverityColor(d.severity) }}>{d.label}</span>
                                                            <span style={{ wordBreak: "break-all" }}>{d.masterValue || "—"}</span>
                                                            <span style={{ wordBreak: "break-all" }}>{d.platformValue || "—"}</span>
                                                            <button type="button" className="ud-pm-btn sm accent outline"
                                                                onClick={() => handleApplyPlatformField(item._id, pl.marketplaceName, d.field)}>Platformu al</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {faTotal > 30 && <Pagination currentPage={faPage} totalPages={faPages} total={faTotal} onPageChange={pg => loadFieldAudit(pg)} />}
            </div>
        );
    };
'''.replace("<motion.div style={{ fontWeight: 700", "<div style={{ fontWeight: 700").replace("{pl.marketplaceName}</motion.div>", "{pl.marketplaceName}</div>").replace("<motion.div className=\"ud-pm-card\"", "<div className=\"ud-pm-card\"").replace("</div>\n        );\n    };", "</div>\n        );\n    };", 1)

marker = "    /* ═══════════════════════════════════════════════════════════════\n       TAB: PAZARYERİ BAZLI FİYATLAR"
if "const renderFieldAudit" not in text and marker in text:
    text = text.replace(marker, RENDER_FIELD_AUDIT + "\n" + marker)

needle = '            { icon: <FaStore />, label: "Platform", val: (db.marketplaces || marketplaces || []).length, color: "var(--ud-pm-purple)" },'
insert = '''            {
                icon: <FaShieldAlt />,
                label: "Alan farkı",
                val: dbP.withFieldDrift ?? "—",
                sub: dbP.criticalFieldDrift > 0 ? `${dbP.criticalFieldDrift} kritik` : "",
                color: dbP.criticalFieldDrift > 0 ? "var(--ud-pm-red)" : "var(--ud-pm-purple)",
                onClick: () => setTab("fieldAudit")
            },
            { icon: <FaStore />, label: "Platform", val: (db.marketplaces || marketplaces || []).length, color: "var(--ud-pm-purple)" },'''
if needle in text and 'label: "Alan farkı"' not in text[:text.find("renderDashCards")+500 if "renderDashCards" in text else 0]:
    text = text.replace(needle, insert, 1)

old_card = """                    <div key={c.label} className=\"ud-pm-dash-card\" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20` }}>
                        <motion.div className=\"ud-pm-dash-icon\" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</motion.div>
                        <div>
                            <div className=\"ud-pm-dash-val\" style={{ color: c.color }}>{c.val}</div>
                            <div className=\"ud-pm-dash-label\">{c.label}</div>
                        </div>
                    </div>"""
# fix old_card - use exact from file
old_card = """                    <div key={c.label} className="ud-pm-dash-card" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20` }}>
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</motion.div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                        </div>
                    </div>"""

p.write_text(text, encoding="utf-8")
print("wrote")
