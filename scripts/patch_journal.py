# -*- coding: utf-8 -*-
from pathlib import Path

d = "motion.div"
d = "motion.div"  # NO
d = "div"

p = Path(r"d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "                    </motion.div>\n                    <button type=\"button\"",
    "                    </motion.div>\n                    <button type=\"button\"",
    1,
)

insert = f"""

                {{logSummary && (
                    <{d} style={{{{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}}}>
                        <{d} className="ud-pm-stat-mini" style={{{{ borderColor: "rgba(78,205,196,0.35)" }}}}>
                            <{d} className="val">{{logSummary.totalEvents}}</{d}>
                            <{d} className="lbl">Toplam olay</{d}>
                        </{d}>
                        <{d} className="ud-pm-stat-mini">
                            <{d} className="val">{{logSummary.uniqueProducts}}</{d}>
                            <{d} className="lbl">Ürün (benzersiz)</{d}>
                        </{d}>
                        <{d} className="ud-pm-stat-mini" style={{{{ borderColor: "rgba(239,68,68,0.35)" }}}}>
                            <{d} className="val" style={{{{ color: "var(--ud-pm-red)" }}}}>{{logSummary.wentToZero}}</{d}>
                            <{d} className="lbl">Stok → 0</{d}>
                        </{d}>
                        <{d} className="ud-pm-stat-mini">
                            <{d} className="val" style={{{{ color: "var(--ud-pm-green)" }}}}>+{{logSummary.stockIncreased}}</{d}>
                            <{d} className="lbl">Stok artışı</{d}>
                        </{d}>
                        <{d} className="ud-pm-stat-mini">
                            <{d} className="val" style={{{{ color: "var(--ud-pm-yellow)" }}}>-{{logSummary.stockDecreased}}</{d}>
                            <{d} className="lbl">Stok düşüşü</{d}>
                        </{d}>
                        <{d} className="ud-pm-stat-mini">
                            <{d} className="val">{{logSummary.orderRelated}}</{d}>
                            <{d} className="lbl">Sipariş kaynaklı</{d}>
                        </{d}>
                    </{d}>
                )}}

                <{d} style={{{{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}}}>
                    <select className="ud-pm-select" style={{{{ minWidth: 100 }}}} value={{logHours}} onChange={{e => setLogHours(e.target.value)}}>
                        <option value="24">Son 24 saat</option>
                        <option value="48">Son 48 saat</option>
                        <option value="168">Son 7 gün</option>
                        <option value="0">Tümü</option>
                    </select>
                    <select className="ud-pm-select" style={{{{ minWidth: 130 }}}} value={{logSourceFilter}} onChange={{e => setLogSourceFilter(e.target.value)}}>
                        <option value="">Tüm kaynaklar</option>
                        <option value="order">Sipariş</option>
                        <option value="manual">Manuel</option>
                        <option value="cron">Cron (oto)</option>
                        <option value="bulk">Toplu işlem</option>
                    </select>
                    <select className="ud-pm-select" style={{{{ minWidth: 140 }}}} value={{logActionFilter}} onChange={{e => setLogActionFilter(e.target.value)}}>
                        <option value="">Tüm işlemler</option>
                        <option value="order_placed">Sipariş düşüşü</option>
                        <option value="manual_sync">Manuel push</option>
                        <option value="auto_sync">Otomatik push</option>
                        <option value="stock_update">Stok güncelleme</option>
                        <option value="bulk_update">Toplu güncelleme</option>
                    </select>
                    <label style={{{{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ud-pm-text-dim)", cursor: "pointer" }}}}>
                        <input type="checkbox" className="ud-pm-checkbox" checked={{logStockOnly}} onChange={{e => setLogStockOnly(e.target.checked)}} />
                        Sadece stok olayları
                    </label>
                    <input
                        className="ud-pm-input"
                        style={{{{ flex: 1, minWidth: 160 }}}}
                        placeholder="Barkod / ürün adı ara…"
                        value={{logSearch}}
                        onChange={{e => setLogSearch(e.target.value)}}
                        onKeyDown={{e => e.key === "Enter" && loadLogs()}}
                    />
                    <button type="button" className="ud-pm-btn sm accent" onClick={{loadLogs}}><FaSearch /> Ara</button>
                </{d}>

                {{logsLoading ? <Loading />
                : syncLogs.length === 0 ? <Empty icon={{FaClipboardList}} title="Bu filtrede kayıt yok" desc="Süreyi genişletin veya 'Sadece stok' işaretini kaldırın" />
                : (
                    <{d} className="ud-pm-log-list ud-pm-log-list--journal">
                        {{syncLogs.map((log, i) => {{
                            const rowId = log._id || i;
                            const expanded = logExpandedId === rowId;
                            const pillColor = log.isZeroStock ? "var(--ud-pm-red)"
                                : log.isStockIncrease ? "var(--ud-pm-green)"
                                : log.isStockDecrease ? "var(--ud-pm-yellow)"
                                : log.actionType === "price_update" ? "var(--ud-pm-yellow)" : "var(--ud-pm-accent)";
                            return (
                                <{d} key={{rowId}} className="ud-pm-log-item ud-pm-log-item--expandable"
                                    onClick={{() => setLogExpandedId(expanded ? null : rowId)}}>
                                    <{d} className="ud-pm-log-item-row">
                                        <span className="dot" style={{{{ background: log.status === "success" ? "var(--ud-pm-green)" : log.status === "error" ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }}}} />
                                        <Pill color={{pillColor}}>{{log.actionLabel || log.actionType}}</Pill>
                                        <Pill color="var(--ud-pm-text-dim)">{{log.sourceLabel || log.source}}</Pill>
                                        {{log.isZeroStock && <Pill color="var(--ud-pm-red)">Sıfırlandı</Pill>}}
                                        <span className="log-name">{{log.product?.name || log.product?.barcode || "—"}}</span>
                                        {{log.changes?.field === "stock" && (
                                            <span className="log-change" style={{{{ fontWeight: 700 }}}}>
                                                {{log.changes.oldValue}} → {{log.changes.newValue}}
                                                {{log.stockDelta != null && log.stockDelta !== 0 && (
                                                    <span style={{{{ color: log.stockDelta > 0 ? "var(--ud-pm-green)" : "var(--ud-pm-red)", marginLeft: 4 }}}}>
                                                        ({{log.stockDelta > 0 ? "+" : ""}}{{log.stockDelta}})
                                                    </span>
                                                )}}
                                            </span>
                                        )}}
                                        <span className="log-date">{{fmtDate(log.timestamp)}}</span>
                                        {{expanded ? <FaChevronDown style={{{{ fontSize: 10, color: "var(--ud-pm-text-dim)" }}}} /> : <FaChevronRight style={{{{ fontSize: 10, color: "var(--ud-pm-text-dim)" }}}} />}}
                                    </{d}>
                                    {{expanded && (
                                        <{d} className="ud-pm-log-item-detail" onClick={{e => e.stopPropagation()}}>
                                            {{log.product?.barcode && <{d}>Barkod: <strong style={{{{ color: "var(--ud-pm-text)" }}}}>{{log.product.barcode}}</strong></{d}>}}
                                            {{log.order?.orderNumber && <{d}>Sipariş: <strong style={{{{ color: "var(--ud-pm-text)" }}}}>{{log.order.orderNumber}}</strong> ({{log.order.marketplace || log.marketplace?.name || "—"}})</{d}>}}
                                            {{log.marketplaceSummary && <{d}>Pazaryerleri: {{log.marketplaceSummary}}</{d}>}}
                                            {{log.hasMarketplaceErrors && log.marketplaceErrors?.map((e, j) => (
                                                <{d} key={{j}} style={{{{ color: "var(--ud-pm-red)" }}}}>{{e.name}}: {{e.error}}</{d}>
                                            ))}}
                                            {{log.product?.productMappingId && (
                                                <button type="button" className="ud-pm-btn sm accent outline" style={{{{ marginTop: 6 }}}}
                                                    onClick={{() => openDetail(log.product.productMappingId)}}>
                                                    <FaEye /> Ürünü aç
                                                </button>
                                            )}}
                                        </{d}>
                                    )}}
                                </{d}>
                            );
                        }})}}
                    </{d}>
                )}}
"""

start_marker = '                {logsLoading ? <Loading />\n                : syncLogs.length === 0 ? <Empty icon={FaClipboardList} title="Henüz log yok" />'
start = text.find(start_marker)
if start < 0:
    raise SystemExit("start marker not found")
idx = text.find('title="Henüz log yok"', start)
end = text.find("                )}", idx) + len("                )}")

text = text[:start] + insert + text[end:]

text = text.replace(
    "                    </motion.div>\n                    <button type=\"button\" className=\"ud-pm-btn sm accent outline\" onClick={loadLogs}",
    "                    </motion.div>\n                    <button type=\"button\" className=\"ud-pm-btn sm accent outline\" onClick={loadLogs}",
    1,
)

p.write_text(text, encoding="utf-8")
bad = text.count("</motion.div>")
print("patched. motion.div closings:", bad)
