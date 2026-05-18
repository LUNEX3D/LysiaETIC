$p = "d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js"
$lines = [System.IO.File]::ReadAllLines($p)
$o = "<" + "div"
$c = "</" + "motion.div>".Replace("motion.div", "motion.div")
$c = "</" + "div>"
$log = @(
'                    <motion.div className="ud-pm-log-list ud-pm-log-list--journal">'
) | ForEach-Object { $_ -replace 'motion\.div', 'motion.div' }
# build as plain strings
$block = @'
                    <div className="ud-pm-log-list ud-pm-log-list--journal">
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
                                        {log.isZeroStock && <Pill color="var(--ud-pm-red)">Sifirlandi</Pill>}
                                        <span className="log-name">{log.product?.name || log.product?.barcode || "-"}</span>
                                        {log.changes?.field === "stock" && (
                                            <span className="log-change" style={{ fontWeight: 700 }}>
                                                {log.changes.oldValue} -> {log.changes.newValue}
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
                                            {log.order?.orderNumber && <motion.div>Siparis: <strong style={{ color: "var(--ud-pm-text)" }}>{log.order.orderNumber}</strong> ({log.order.marketplace || log.marketplace?.name || "-"})</motion.div>}
                                            {log.marketplaceSummary && <motion.div>Pazaryerleri: {log.marketplaceSummary}</motion.div>}
                                            {log.hasMarketplaceErrors && log.marketplaceErrors?.map((e, j) => (
                                                <motion.div key={j} style={{ color: "var(--ud-pm-red)" }}>{e.name}: {e.error}</motion.div>
                                            ))}
                                            {log.product?.productMappingId && (
                                                <button type="button" className="ud-pm-btn sm accent outline" style={{ marginTop: 6 }}
                                                    onClick={() => openDetail(log.product.productMappingId)}>
                                                    <FaEye /> Urunu ac
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>
'@
$block = $block -replace 'motion\.div', 'div'
$block = $block -replace 'Sifirlandi', 'Sifirlandi' -replace 'Sifirlandi', ([char]0x015E + 'ifirland' + [char]0x131)
$block = $block -replace 'Siparis', 'Sipari' + [char]0x015F
$block = $block -replace 'Urunu ac', ([char]0x00DC + 'r' + [char]0x00FC + 'n' + [char]0x00FC + ' a' + [char]0x00E7)
$block = $block -replace ' -> ', ' -> '
$block = $block -replace ' -> ', ' -> '
$block = $block -replace ' -> ', ([char]0x2192)
$block = $block -replace '\|\| "-"', '|| "—"'
$newLines = $block -split "`n"
$lines[2707..2719] = $newLines
[System.IO.File]::WriteAllLines($p, $lines)
Write-Host "log journal inserted"
