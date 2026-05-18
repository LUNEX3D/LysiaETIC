# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "frontend" / "src" / "pages" / "ProductManagementCenter.js"
text = p.read_text(encoding="utf-8")
start = text.index("    const renderChannelPrices = () => {")
end = text.index("    /* ═══════════════════════════════════════════════════════════════\n       TAB 1: ÜRÜN LİSTESİ")

new_fn = r'''    const renderChannelPrices = () => {
        const chPages = Math.max(1, Math.ceil(chTabTotal / LIMIT));
        const colSpan = 3 + PLATFORMS.length * 2 + 1;
        return (
            <motion.div className="ud-pm-chpr-root ud-pm-chpr-root--list">
                <div className="ud-pm-toolbar ud-pm-toolbar--card ud-pm-chpr-toolbar">
                    <div className="ud-pm-search-wrap">
                        <span className="icon"><FaSearch /></span>
                        <input
                            className="ud-pm-search"
                            value={chTabSearch}
                            onChange={(e) => setChTabSearch(e.target.value)}
                            placeholder="Ürün adı, barkod veya SKU…"
                            aria-label="Pazaryeri fiyatlarında ara"
                        />
                    </div>
                    <div className="ud-pm-spacer" />
                    <Pill color="var(--ud-pm-accent)">{chTabTotal} ürün</Pill>
                </div>
                <p className="ud-pm-chpr-list-hint">
                    <FaInfoCircle /> Satırda fiyatları düzenleyin. <strong>Kaydet</strong> panel veritabanını günceller; <strong>Gönder</strong> ilgili pazaryerine canlı iletir.
                </p>
                <div className="ud-pm-table-wrap ud-pm-chpr-table-wrap">
                    <div className="ud-pm-table-scroll">
                        <table className="ud-pm-table ud-pm-chpr-table">
                            <thead>
                                <tr className="ud-pm-chpr-head-main">
                                    <th rowSpan={2} className="ud-pm-chpr-sticky-col">Ürün</th>
                                    <th rowSpan={2} className="right ud-pm-chpr-sticky-master">Master</th>
                                    {PLATFORMS.map((pl) => (
                                        <th key={pl} colSpan={2} className="center ud-pm-chpr-pl-head" style={{ "--pl-color": PL_COLOR[pl] }}>
                                            <span className="ud-pm-chpr-pl-label">{MP_LOGO[pl]} {PL_SHORT[pl]}</span>
                                        </th>
                                    ))}
                                    <th rowSpan={2} className="center ud-pm-chpr-sticky-actions">Satır</th>
                                </tr>
                                <tr className="ud-pm-chpr-head-sub">
                                    {PLATFORMS.map((pl) => (
                                        <React.Fragment key={`${pl}-sub`}>
                                            <th className="center ud-pm-chpr-sub-th">Satış</th>
                                            <th className="center ud-pm-chpr-sub-th">Liste</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {chTabLoading ? (
                                    <tr><td colSpan={colSpan}><Loading /></td></tr>
                                ) : chTabProducts.length === 0 ? (
                                    <tr><td colSpan={colSpan}><Empty icon={FaPercentage} title="Ürün bulunamadı" desc="Aramayı değiştirin veya ürün ekleyin." /></td></tr>
                                ) : chTabProducts.map((p) => {
                                    const mp = p.masterProduct || {};
                                    const draft = getChRowDraft(p);
                                    const nListed = PLATFORMS.filter((pl) => getPlMappingAny(p, pl)).length;
                                    return (
                                        <tr key={p._id}>
                                            <td className="ud-pm-chpr-sticky-col">
                                                <div className="product-cell">
                                                    {mp.images?.[0] ? (
                                                        <img src={mp.images[0]} alt="" className="product-img" />
                                                    ) : (
                                                        <div className="product-img-placeholder"><FaBox /></div>
                                                    )}
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div className="product-name ps-product-name" title={mp.name}>{mp.name || "İsimsiz"}</motion.div>
                                                        <div className="mono-dim">{mp.barcode || "—"}</div>
                                                        <span className="ud-pm-chpr-row-channels">{nListed}/{PLATFORMS.length} kanal</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="right ud-pm-chpr-sticky-master">
                                                <div className="ud-pm-chpr-master-cell">
                                                    <strong>{fmt(mp.price)}</strong>
                                                    {mp.listPrice != null && mp.listPrice !== mp.price && (
                                                        <small>Liste {fmt(mp.listPrice)}</small>
                                                    )}
                                                </div>
                                            </td>
                                            {PLATFORMS.map((pl) => {
                                                const m = getPlMappingAny(p, pl);
                                                const listed = !!m;
                                                const d = draft[pl] || { sale: "", list: "" };
                                                const busyLocal = chRowAction === `${p._id}-${pl}-local`;
                                                const busyPush = chRowAction === `${p._id}-${pl}-push`;
                                                if (!listed) {
                                                    return (
                                                        <React.Fragment key={pl}>
                                                            <td colSpan={2} className="center ud-pm-chpr-cell-off">—</td>
                                                        </React.Fragment>
                                                    );
                                                }
                                                return (
                                                    <React.Fragment key={pl}>
                                                        <td className="center ud-pm-chpr-price-td">
                                                            <input
                                                                type="text"
                                                                className="ud-pm-inline-input ud-pm-chpr-mini-input"
                                                                value={d.sale}
                                                                onChange={(e) => setChEditField(p._id, pl, "sale", e.target.value)}
                                                                inputMode="decimal"
                                                                placeholder="Satış"
                                                                aria-label={`${pl} satış fiyatı`}
                                                            />
                                                            <div className="ud-pm-chpr-cell-actions">
                                                                <button
                                                                    type="button"
                                                                    className="ud-pm-chpr-icon-btn"
                                                                    title="Panelde kaydet"
                                                                    disabled={!!chRowAction}
                                                                    onClick={() => saveChLocal(p._id, pl)}
                                                                >
                                                                    {busyLocal ? <span className="spinner" /> : <FaSave />}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="ud-pm-chpr-icon-btn ud-pm-chpr-icon-btn--mp"
                                                                    title="Pazaryerine gönder"
                                                                    disabled={!!chRowAction}
                                                                    onClick={() => pushChPrice(p._id, pl)}
                                                                >
                                                                    {busyPush ? <span className="spinner" /> : <FaGlobe />}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="center ud-pm-chpr-price-td">
                                                            <input
                                                                type="text"
                                                                className="ud-pm-inline-input ud-pm-chpr-mini-input"
                                                                value={d.list}
                                                                onChange={(e) => setChEditField(p._id, pl, "list", e.target.value)}
                                                                inputMode="decimal"
                                                                placeholder="Liste"
                                                                aria-label={`${pl} liste fiyatı`}
                                                            />
                                                            {m.price != null && (
                                                                <motion.div className="ud-pm-chpr-saved-hint" title="Kayıtlı fiyat">
                                                                    {fmt(m.price)}
                                                                </motion.div>
                                                            )}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className="center ud-pm-chpr-sticky-actions">
                                                <div className="ud-pm-chpr-row-btns">
                                                    <button type="button" className="ud-pm-btn sm accent outline" onClick={() => fillChRowFromMaster(p._id)} disabled={nListed === 0} title="Master fiyatıyla doldur">
                                                        <FaBolt />
                                                    </button>
                                                    <button type="button" className="ud-pm-btn sm muted" onClick={() => resetChRowDraft(p._id)} title="Sıfırla">
                                                        <FaUndo />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <Pagination currentPage={chTabPage} totalPages={chPages} total={chTabTotal} onPageChange={(pg) => loadChTabProducts(pg)} />
            </motion.div>
        );
    };

'''

# fix typo in template
new_fn = new_fn.replace(
    '{mp.name || "İsimsiz"}</motion.div>',
    '{mp.name || "İsimsiz"}</motion.div>'.replace('</motion.div>', '</motion.div>')  # noop
)
new_fn = new_fn.replace(
    '<div className="product-name ps-product-name" title={mp.name}>{mp.name || "İsimsiz"}</motion.div>',
    '<motion.div className="product-name ps-product-name" title={mp.name}>{mp.name || "İsimsiz"}</motion.div>'
)
# actually should be div not motion.div
new_fn = new_fn.replace(
    '<motion.div className="product-name ps-product-name" title={mp.name}>{mp.name || "İsimsiz"}</motion.div>',
    '<div className="product-name ps-product-name" title={mp.name}>{mp.name || "İsimsiz"}</div>'
)
new_fn = new_fn.replace(
    '<motion.div className="ud-pm-chpr-saved-hint"',
    '<div className="ud-pm-chpr-saved-hint"'
)
new_fn = new_fn.replace(
    '</motion.div>\n                                                            )}',
    '</div>\n                                                            )}',
    1
)

p.write_text(text[:start] + new_fn + text[end:], encoding="utf-8")
print("patched", start, end)
