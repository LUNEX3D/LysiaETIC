from pathlib import Path

p = Path(__file__).resolve().parents[1] / "frontend/src/pages/ProductManagementCenter.js"
text = p.read_text(encoding="utf-8")

start_marker = "        return (\n            <div className=\"ud-pm-bulk-layout\">"
end_marker = "                {/* SAĞ: İşlem Paneli */}\n                <div className=\"ud-pm-bulk-panel\">"

if start_marker not in text:
    raise SystemExit("start_marker not found")
if end_marker not in text:
    raise SystemExit("end_marker not found")

i0 = text.index(start_marker)
i1 = text.index(end_marker)
replacement = "        return (\n            <div className=\"ud-pm-bulk-panel ud-pm-bulk-panel--drawer\">"
text = text[:i0] + replacement + text[i1:]

old_close = """                    </AnimatePresence>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB: VARYANT GRUPLARI"""

new_close = """                    </AnimatePresence>
            </motion.div>
        );
    };

    const renderBulkDrawer = () => {
        if (!bulkDrawerOpen) return null;
        const title = bulkDrawerMode === "channelPrices" ? "Pazaryeri fiyatları" : "Toplu işlem";
        return ReactDOM.createPortal(
            <AnimatePresence>
                {bulkDrawerOpen && (
                    <motion.div className="ud-pm-drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBulkDrawerOpen(false)}>
                        <motion.aside className={`ud-pm-drawer${bulkDrawerMode === "channelPrices" ? " ud-pm-drawer--wide" : ""}`} initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
                            <header className="ud-pm-drawer-head">
                                <h2>{title}</h2>
                                <p>{selected.size > 0 ? `${selected.size} ürün katalogda seçili` : "Önce katalogdan ürün seçin"}</p>
                                <button type="button" className="ud-pm-drawer-close" onClick={() => setBulkDrawerOpen(false)} aria-label="Kapat"><FaTimes /></button>
                            </header>
                            <div className="ud-pm-drawer-body">
                                {bulkDrawerMode === "channelPrices" ? renderChannelPrices() : renderBulkActionsPanel()}
                            </div>
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       TAB: VARYANT GRUPLARI"""

if old_close not in text:
    raise SystemExit("old_close not found")
text = text.replace(old_close, new_close, 1)

# renderBulkActionsPanel returns div not motion.div - fix erroneous motion closing if any
text = text.replace(
    '            <motion.div className="ud-pm-bulk-panel ud-pm-bulk-panel--drawer">',
    '            <div className="ud-pm-bulk-panel ud-pm-bulk-panel--drawer">',
    1,
)
text = text.replace(
    """                    </AnimatePresence>
            </motion.div>
        );
    };

    const renderBulkDrawer""",
    """                    </AnimatePresence>
            </div>
        );
    };

    const renderBulkDrawer""",
    1,
)

p.write_text(text, encoding="utf-8")
print("patched ok")
