# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js")
text = p.read_text(encoding="utf-8")

# 1) Dash card click + sub
old_dash_map = """                {cards.map(c => (
                    <motion.div key={c.label} className="ud-pm-dash-card" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20` }}>
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                        </div>
                    </div>
                ))}"""

new_dash_map = """                {cards.map(c => (
                    <div
                        key={c.label}
                        role={c.onClick ? "button" : undefined}
                        tabIndex={c.onClick ? 0 : undefined}
                        className="ud-pm-dash-card"
                        style={{
                            background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`,
                            borderColor: `${c.color}20`,
                            cursor: c.onClick ? "pointer" : undefined
                        }}
                        onClick={c.onClick}
                        onKeyDown={c.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.onClick(); } } : undefined}
                    >
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</motion.div>
                            {c.sub ? <div style={{ fontSize: 10, color: c.color, marginTop: 2, opacity: 0.85 }}>{c.sub}</div> : null}
                        </div>
                    </div>
                ))}"""

# fix typo in script - use correct closing tags
new_dash_map = new_dash_map.replace("</motion.div>", "</motion.div>", 1)  # no-op if wrong
new_dash_map = """                {cards.map(c => (
                    <div
                        key={c.label}
                        role={c.onClick ? "button" : undefined}
                        tabIndex={c.onClick ? 0 : undefined}
                        className="ud-pm-dash-card"
                        style={{
                            background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`,
                            borderColor: `${c.color}20`,
                            cursor: c.onClick ? "pointer" : undefined
                        }}
                        onClick={c.onClick}
                        onKeyDown={c.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.onClick(); } } : undefined}
                    >
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                            {c.sub ? <div style={{ fontSize: 10, color: c.color, marginTop: 2, opacity: 0.85 }}>{c.sub}</div> : null}
                        </div>
                    </div>
                ))}"""

old_dash_map = """                {cards.map(c => (
                    <div key={c.label} className="ud-pm-dash-card" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20` }}>
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <motion.div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                        </div>
                    </div>
                ))}"""

old_dash_map = """                {cards.map(c => (
                    <div key={c.label} className="ud-pm-dash-card" style={{ background: `linear-gradient(135deg, ${c.color}08, ${c.color}04)`, borderColor: `${c.color}20` }}>
                        <div className="ud-pm-dash-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                        <div>
                            <div className="ud-pm-dash-val" style={{ color: c.color }}>{c.val}</div>
                            <div className="ud-pm-dash-label">{c.label}</div>
                        </div>
                    </div>
                ))}"""

if old_dash_map in text:
    text = text.replace(old_dash_map, new_dash_map, 1)
    print("dash map ok")
else:
    print("dash map SKIP")

RENDER_FA = '''
    const driftSeverityColor = (s) => {
        if (s === "critical") return "var(--ud-pm-red)";
        if (s === "high") return "var(--ud-pm-yellow)";
        if (s === "medium") return "var(--ud-pm-accent)";
        return "var(--ud-pm-text-dim)";
    };

    const renderFieldAudit = () => {
        const faPages = Math.max(1, Math.ceil(faTotal / 30));
        return (
            <div className="ud-pm-card" style={{ padding: 16 }}>
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
                                                <button type="button" className="ud-pm-btn sm outline" onClick={() => handleRefreshFieldAuditOne(item._id)}
                                                    disabled={actionLoading === `fa-refresh-${item._id}`}>
                                                    <FaSync /> Yeniden denetle
                                                </button>
                                            </div>
                                            {(item.platforms || []).map(pl => (
                                                <div key={pl.marketplaceName} style={{ marginBottom: 10, padding: 8, border: "1px solid var(--ud-pm-glass-border)", borderRadius: 8 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 12, color: PL_COLOR[pl.marketplaceName], marginBottom: 6 }}>{pl.marketplaceName}</div>
                                                    {(pl.drifts || []).map((d, di) => (
                                                        <div key={di} style={{ display: "grid", gridTemplateColumns: "minmax(80px,1fr) 1fr 1fr auto", gap: 6, fontSize: 11, marginTop: 6, alignItems: "center" }}>
                                                            <span style={{ color: driftSeverityColor(d.severity) }}>{d.label}</span>
                                                            <span style={{ wordBreak: "break-all" }} title="Master">{d.masterValue || "—"}</span>
                                                            <span style={{ wordBreak: "break-all" }} title="Platform">{d.platformValue || "—"}</span>
                                                            <button type="button" className="ud-pm-btn sm accent outline"
                                                                disabled={actionLoading === `fa-${item._id}-${d.field}`}
                                                                onClick={() => handleApplyPlatformField(item._id, pl.marketplaceName, d.field)}>
                                                                Platformu al
                                                            </button>
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

'''

# fix motion.div typo in RENDER_FA header
RENDER_FA = RENDER_FA.replace(
    '<motion.div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>',
    '<motion.div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>'
).replace('</div>\n                <p style', '</motion.div>\n                <p style', 1)

marker = "    /* ═══════════════════════════════════════════════════════════════\n       TAB: PAZARYERİ BAZLI FİYATLAR"
if "const renderFieldAudit" not in text and marker in text:
    text = text.replace(marker, RENDER_FA + marker, 1)
    print("renderFieldAudit ok")
else:
    print("renderFieldAudit SKIP")

tab_line = '        { id: "sync", icon: <FaSync />, label: "Senkâronizasyon" },'
tab_insert = '        { id: "fieldAudit", icon: <FaShieldAlt />, label: "Alan denetimi" },\n        { id: "sync", icon: <FaSync />, label: "Senkâronizasyon" },'
if tab_line in text and '"fieldAudit"' not in text.split("const tabs =")[1].split("];")[0]:
    text = text.replace(tab_line, tab_insert, 1)
    print("tab ok")

panel_line = '                    {tab === "sync" && renderSync()}'
panel_insert = '                    {tab === "fieldAudit" && renderFieldAudit()}\n                    {tab === "sync" && renderSync()}'
if panel_line in text and 'tab === "fieldAudit"' not in text:
    text = text.replace(panel_line, panel_insert, 1)
    print("panel ok")

log_src = '                        <option value="bulk">Toplu işlem</option>\n                    </select>'
log_src_new = '                        <option value="bulk">Toplu işlem</option>\n                        <option value="catalog">Katalog denetimi</option>\n                    </select>'
if log_src in text and 'value="catalog"' not in text[text.find("logSourceFilter"):text.find("logSourceFilter")+800]:
    text = text.replace(log_src, log_src_new, 1)
    print("log source ok")

log_act = '                        <option value="bulk_update">Toplu güncelleme</option>\n                    </select>'
log_act_new = '                        <option value="bulk_update">Toplu güncelleme</option>\n                        <option value="product_field_drift">Katalog alan farkı</option>\n                    </select>'
if log_act in text:
    text = text.replace(log_act, log_act_new, 1)
    print("log action ok")

detail_marker = "                                {Array.isArray(p.categoryFieldOverview) && p.categoryFieldOverview.length > 0 && ("
detail_block = """                                {p.fieldAuditSummary?.hasAnyDrift && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ color: "var(--ud-pm-text)", fontSize: 13, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            <FaShieldAlt style={{ color: p.fieldAuditSummary.hasCritical ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} /> Alan farkı (master vs platform)
                                            {p.fieldAuditSummary.hasCritical && <Pill color="var(--ud-pm-red)">Kritik</Pill>}
                                            <button type="button" className="ud-pm-btn sm outline" style={{ marginLeft: "auto" }}
                                                onClick={() => handleRefreshFieldAuditOne(p._id)}
                                                disabled={actionLoading === `fa-refresh-${p._id}`}>
                                                <FaSync /> Yeniden denetle
                                            </button>
                                        </div>
                                        {(p.fieldAuditSummary.platforms || []).map((pl) => (
                                            <div key={pl.marketplaceName} style={{ marginBottom: 10, padding: 8, border: "1px solid var(--ud-pm-glass-border)", borderRadius: 8 }}>
                                                <div style={{ fontWeight: 700, fontSize: 12, color: PL_COLOR[pl.marketplaceName], marginBottom: 6 }}>
                                                    {pl.marketplaceName}
                                                    {pl.hasCritical && <Pill color="var(--ud-pm-red)" style={{ marginLeft: 6 }}>Kritik</Pill>}
                                                </div>
                                                {(pl.drifts || []).map((d, di) => (
                                                    <div key={di} style={{ display: "grid", gridTemplateColumns: "minmax(80px,1fr) 1fr 1fr auto", gap: 6, fontSize: 11, marginTop: 6, alignItems: "center" }}>
                                                        <span style={{ color: driftSeverityColor(d.severity) }}>{d.label}</span>
                                                        <span style={{ wordBreak: "break-all" }}>{d.masterValue || "—"}</span>
                                                        <span style={{ wordBreak: "break-all" }}>{d.platformValue || "—"}</span>
                                                        <button type="button" className="ud-pm-btn sm accent outline"
                                                            disabled={actionLoading === `fa-${p._id}-${d.field}`}
                                                            onClick={() => handleApplyPlatformField(p._id, pl.marketplaceName, d.field)}>
                                                            Platformu al
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}

"""
if detail_marker in text and "fieldAuditSummary?.hasAnyDrift" not in text:
    text = text.replace(detail_marker, detail_block + detail_marker, 1)
    print("detail ok")

p.write_text(text, encoding="utf-8")
print("done")
