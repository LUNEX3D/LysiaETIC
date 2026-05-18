const fs = require("fs");
const p = "d:/LysiaETIC/frontend/src/pages/ProductManagementCenter.js";
let lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
const T = "div";
const close = () => "</" + T + ">";
const set = (n, s) => { lines[n - 1] = s; };

set(2637, "                " + close());
for (const n of [2644, 2648, 2652, 2656, 2660, 2664, 2665]) {
  const pad = lines[n - 1].match(/^\s*/)[0];
  set(n, pad + close());
}
set(2653, '                        <motion.div className="ud-pm-stat-mini">'.replace("motion.div", T));
set(2654, '                            <motion.div className="val" style={{ color: "var(--ud-pm-green)" }}>+{logSummary.stockIncreased}</motion.div>'.replace(/<\/?motion\.motion.div>/g, (x) => x.replace(/motion\.div/g, T)));
set(2655, '                            <motion.div className="lbl">Stok artışı</motion.div>'.replace(/<\/?motion\.motion.div>/g, (x) => x.replace(/motion\.motion.div/g, T)));
set(2653, '                        <div className="ud-pm-stat-mini">');
set(2654, '                            <div className="val" style={{ color: "var(--ud-pm-green)" }}>+{logSummary.stockIncreased}</div>');
set(2655, '                            <div className="lbl">Stok artışi</div>'.replace("artisi", "artışı"));
set(2655, '                            <motion.div className="lbl">Stok artışı</motion.div>'.replace(/motion\.div/g, T));
set(2703, "                " + close());

const toDiv = (s) => s.replace(/<\/?motion\.motion.div>/g, (x) => x.replace(/motion\.div/g, T));

const log = toDiv(`                    <motion.div className="ud-pm-log-list ud-pm-log-list--journal">
                        {syncLogs.map((log, i) => {
                            const rowId = log._id || i;
                            const expanded = logExpandedId === rowId;
                            const pillColor = log.isZeroStock ? "var(--ud-pm-red)"
                                : log.isStockIncrease ? "var(--ud-pm-green)"
                                : log.isStockDecrease ? "var(--ud-pm-yellow)"
                                : log.actionType === "price_update" ? "var(--ud-pm-yellow)" : "var(--ud-pm-accent)";
                            return (
                                <motion.div key={rowId} className="ud-pm-log-item ud-pm-log-item--expandable"
                                    onClick={() => setLogExpandedId(expanded ? null : rowId)}>
                                    <motion.div className="ud-pm-log-item-row">
                                        <span className="dot" style={{ background: log.status === "success" ? "var(--ud-pm-green)" : log.status === "error" ? "var(--ud-pm-red)" : "var(--ud-pm-yellow)" }} />
                                        <Pill color={pillColor}>{log.actionLabel || log.actionType}</Pill>
                                        <Pill color="var(--ud-pm-text-dim)">{log.sourceLabel || log.source}</Pill>
                                        {log.isZeroStock && <Pill color="var(--ud-pm-red)">Sıfırlandı</Pill>}
                                        <span className="log-name">{log.product?.name || log.product?.barcode || "—"}</span>
                                        {log.changes?.field === "stock" && (
                                            <span className="log-change" style={{ fontWeight: 700 }}>
                                                {log.changes.oldValue} → {log.changes.newValue}
                                                {log.stockDelta != null && log.stockDelta !== 0 && (
                                                    <span style={{ color: log.stockDelta > 0 ? "var(--ud-pm-green)" : "var(--ud-pm-red)", marginLeft: 4 }}>
                                                        ({log.stockDelta > 0 ? "+" : ""}{log.stockDelta})
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        <span className="log-date">{fmtDate(log.timestamp)}</span>
                                        {expanded ? <FaChevronDown style={{ fontSize: 10, color: "var(--ud-pm-text-dim)" }} /> : <FaChevronRight style={{ fontSize: 10, color: "var(--ud-pm-text-dim)" }} />}
                                    </motion.div>
                                    {expanded && (
                                        <motion.div className="ud-pm-log-item-detail" onClick={e => e.stopPropagation()}>
                                            {log.product?.barcode && <motion.div>Barkod: <strong style={{ color: "var(--ud-pm-text)" }}>{log.product.barcode}</strong></motion.div>}
                                            {log.order?.orderNumber && <motion.div>Sipariş: <strong style={{ color: "var(--ud-pm-text)" }}>{log.order.orderNumber}</strong> ({log.order.marketplace || log.marketplace?.name || "—"})</motion.div>}
                                            {log.marketplaceSummary && <motion.div>Pazaryerleri: {log.marketplaceSummary}</motion.div>}
                                            {log.hasMarketplaceErrors && log.marketplaceErrors?.map((e, j) => (
                                                <motion.div key={j} style={{ color: "var(--ud-pm-red)" }}>{e.name}: {e.error}</motion.div>
                                            ))}
                                            {log.product?.productMappingId && (
                                                <button type="button" className="ud-pm-btn sm accent outline" style={{ marginTop: 6 }}
                                                    onClick={() => openDetail(log.product.productMappingId)}>
                                                    <FaEye /> Ürünü aç
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>`);

const log2 = log.replace(/motion\.div/g, T);

lines.splice(2707, 14, ...log2.split("\n"));
fs.writeFileSync(p, lines.join("\n"), "utf8");
console.log("ok");
