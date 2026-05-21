# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "frontend/src/pages/ProductManagementCenter.js"
text = path.read_text(encoding="utf-8")
start = text.index("    const renderUploadMarketplace = () => (")
end = text.index("    const renderPriceStock = () => (")

new_fn = r"""    const renderUploadMarketplace = () => (
        <div className="ud-pm-upload-mp-page ud-pm-upload-mp-page--simple">
            <motion.div className="ud-pm-toolbar ud-pm-toolbar--card">
                <div className="ud-pm-search-wrap">
                    <span className="icon"><FaSearch /></span>
                    <input
                        className="ud-pm-search"
                        value={uploadMpSearch}
                        onChange={(e) => setUploadMpSearch(e.target.value)}
                        placeholder="Ürün adı, barkod, SKU..."
                        aria-label="Yüklenecek ürün ara"
                    />
                </div>
                <select className="ud-pm-select" value={uploadMpFilterPl} onChange={(e) => setUploadMpFilterPl(e.target.value)} aria-label="Platform filtresi">
                    <option value="">Tüm platformlar</option>
                    {PLATFORMS.map((pl) => (
                        <option key={pl} value={pl}>{pl}</option>
                    ))}
                </select>
                <select className="ud-pm-select" value={uploadMpFilterType} onChange={(e) => setUploadMpFilterType(e.target.value)} aria-label="Yükleme durumu">
                    <option value="">Tüm durumlar</option>
                    <option value="not_listed">Eksik platformu olanlar</option>
                    <option value="listed">Tamamı yüklü</option>
                </select>
                <motion.div className="ud-pm-spacer" />
                <span className="ud-pm-upload-mp-count">{total} ürün</span>
                <button
                    type="button"
                    className="ud-pm-btn sm outline"
                    onClick={() => {
                        setUploadMpSearch("");
                        setUploadMpFilterPl("");
                        setUploadMpFilterType("");
                    }}
                >
                    <FaTimes /> Temizle
                </button>
            </motion.div>

            <p className="ud-pm-upload-mp-hint">
                Eksik platform için satırdaki yükle düğmesine tıklayın; kategori seçip gönderin. Yüklü platformlar yeşil rozetle görünür.
            </p>

            <div className="ud-pm-product-list-wrap ud-pm-card">
                <div className="ud-pm-product-list ud-pm-upload-mp-simple-list">
                    {uploadMpLoading ? (
                        <div className="ud-pm-product-list-loading"><Loading /></div>
                    ) : products.length === 0 ? (
                        <Empty icon={FaBox} title="Ürün bulunamadı" desc="Filtreleri değiştirin veya önce ürün ekleyin" />
                    ) : (
                        products.map((p, i) => {
                            const mp = p.masterProduct || {};
                            const st = p.stockTracking || {};
                            const plSources = marketplaces.length
                                ? marketplaces
                                : PLATFORMS.map((name) => ({ marketplaceName: name }));
                            return (
                                <motion.div
                                    key={p._id}
                                    className="ud-pm-product-list-item ud-pm-upload-simple-row"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                >
                                    <div className="ud-pm-product-list-item-main">
                                        {mp.images?.[0] ? (
                                            <img src={mp.images[0]} alt="" className="ud-pm-product-list-img" />
                                        ) : (
                                            <div className="ud-pm-product-list-img ud-pm-product-list-img--ph"><FaBox /></motion.div>
                                        )}
                                        <div className="ud-pm-product-list-text">
                                            <motion.div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</motion.div>
                                            <div className="ud-pm-product-list-codes">
                                                <span className="mono">{mp.barcode || "—"}</span>
                                                <span className="mono-dim">{mp.sku || "—"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ud-pm-product-list-item-stats ud-pm-upload-simple-stats">
                                        <span className="price">{fmt(mp.price)}</span>
                                        <span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"}>
                                            Stok: {st.totalStock ?? mp.stock ?? 0}
                                        </span>
                                    </div>
                                    <div className="ud-pm-upload-simple-platforms" onClick={(e) => e.stopPropagation()}>
                                        {plSources.map((m) => {
                                            const plName = m.marketplaceName || m.name;
                                            const ps = getPlStatus(p, plName);
                                            const color = PL_COLOR[plName] || "var(--ud-pm-accent)";
                                            if (ps.exists) {
                                                return (
                                                    <span
                                                        key={plName}
                                                        className="ud-pm-upload-pl-badge ud-pm-upload-pl-badge--ok"
                                                        style={{ borderColor: `${color}55`, color }}
                                                        title={`${plName} — yüklü`}
                                                    >
                                                        <FaCheckCircle size={10} /> {PL_SHORT[plName] || plName}
                                                    </span>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={plName}
                                                    type="button"
                                                    className="ud-pm-upload-pl-btn"
                                                    style={{ borderColor: color, color }}
                                                    title={`${plName}'a yükle`}
                                                    onClick={() => openDistFlow(p, plName)}
                                                >
                                                    <FaCloudUploadAlt size={11} /> {PL_SHORT[plName] || plName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="ud-pm-product-list-item-actions" onClick={(e) => e.stopPropagation()}>
                                        <button type="button" className="ud-pm-btn sm outline" onClick={() => openDetail(p._id)} title="Ürün detayı">
                                            <FaEye />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
                <Pagination
                    currentPage={uploadMpPage}
                    totalPages={Math.ceil(total / LIMIT)}
                    total={total}
                    onPageChange={loadUploadMpProducts}
                />
            </div>
        </motion.div>
    );

"""

# fix JSX typos in template
new_fn = new_fn.replace(
    '<div className="ud-pm-product-list-img ud-pm-product-list-img--ph"><FaBox /></motion.div>',
    '<div className="ud-pm-product-list-img ud-pm-product-list-img--ph"><FaBox /></div>',
)
new_fn = new_fn.replace(
    '<motion.div className="ud-pm-product-list-name">',
    '<div className="ud-pm-product-list-name">',
).replace(
    '</motion.div>\n                                            <div className="ud-pm-product-list-codes">',
    '</motion.div>\n                                            <div className="ud-pm-product-list-codes">',
)
# fix name div
new_fn = new_fn.replace(
    '<motion.div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</motion.div>',
    '<motion.div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</motion.div>'.replace("motion.", ""),
)
# manual fix name
new_fn = new_fn.replace(
    '<div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</motion.div>',
    '<div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</div>',
)

# simplify - rewrite clean block without motion typos
new_fn = """    const renderUploadMarketplace = () => (
        <div className="ud-pm-upload-mp-page ud-pm-upload-mp-page--simple">
            <div className="ud-pm-toolbar ud-pm-toolbar--card">
                <motion.div className="ud-pm-search-wrap">
                    <span className="icon"><FaSearch /></span>
                    <input
                        className="ud-pm-search"
                        value={uploadMpSearch}
                        onChange={(e) => setUploadMpSearch(e.target.value)}
                        placeholder="Ürün adı, barkod, SKU..."
                        aria-label="Yüklenecek ürün ara"
                    />
                </div>
                <select className="ud-pm-select" value={uploadMpFilterPl} onChange={(e) => setUploadMpFilterPl(e.target.value)} aria-label="Platform filtresi">
                    <option value="">Tüm platformlar</option>
                    {PLATFORMS.map((pl) => (
                        <option key={pl} value={pl}>{pl}</option>
                    ))}
                </select>
                <select className="ud-pm-select" value={uploadMpFilterType} onChange={(e) => setUploadMpFilterType(e.target.value)} aria-label="Yükleme durumu">
                    <option value="">Tüm durumlar</option>
                    <option value="not_listed">Eksik platformu olanlar</option>
                    <option value="listed">Tamamı yüklü</option>
                </select>
                <div className="ud-pm-spacer" />
                <span className="ud-pm-upload-mp-count">{total} ürün</span>
                <button
                    type="button"
                    className="ud-pm-btn sm outline"
                    onClick={() => {
                        setUploadMpSearch("");
                        setUploadMpFilterPl("");
                        setUploadMpFilterType("");
                    }}
                >
                    <FaTimes /> Temizle
                </button>
            </div>

            <p className="ud-pm-upload-mp-hint">
                Eksik platform için satırdaki yükle düğmesine tıklayın; kategori seçip gönderin. Yüklü platformlar yeşil rozetle görünür.
            </p>

            <div className="ud-pm-product-list-wrap ud-pm-card">
                <div className="ud-pm-product-list ud-pm-upload-mp-simple-list">
                    {uploadMpLoading ? (
                        <div className="ud-pm-product-list-loading"><Loading /></div>
                    ) : products.length === 0 ? (
                        <Empty icon={FaBox} title="Ürün bulunamadı" desc="Filtreleri değiştirin veya önce ürün ekleyin" />
                    ) : (
                        products.map((p, i) => {
                            const mp = p.masterProduct || {};
                            const st = p.stockTracking || {};
                            const plSources = marketplaces.length
                                ? marketplaces
                                : PLATFORMS.map((name) => ({ marketplaceName: name }));
                            return (
                                <motion.div
                                    key={p._id}
                                    className="ud-pm-product-list-item ud-pm-upload-simple-row"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                >
                                    <div className="ud-pm-product-list-item-main">
                                        {mp.images?.[0] ? (
                                            <img src={mp.images[0]} alt="" className="ud-pm-product-list-img" />
                                        ) : (
                                            <div className="ud-pm-product-list-img ud-pm-product-list-img--ph"><FaBox /></div>
                                        )}
                                        <div className="ud-pm-product-list-text">
                                            <div className="ud-pm-product-list-name">{mp.name || "İsimsiz"}</div>
                                            <div className="ud-pm-product-list-codes">
                                                <span className="mono">{mp.barcode || "—"}</span>
                                                <span className="mono-dim">{mp.sku || "—"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <motion.div className="ud-pm-product-list-item-stats ud-pm-upload-simple-stats">
                                        <span className="price">{fmt(mp.price)}</span>
                                        <span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"}>
                                            Stok: {st.totalStock ?? mp.stock ?? 0}
                                        </span>
                                    </div>
                                    <div className="ud-pm-upload-simple-platforms" onClick={(e) => e.stopPropagation()}>
                                        {plSources.map((m) => {
                                            const plName = m.marketplaceName || m.name;
                                            const ps = getPlStatus(p, plName);
                                            const color = PL_COLOR[plName] || "var(--ud-pm-accent)";
                                            if (ps.exists) {
                                                return (
                                                    <span
                                                        key={plName}
                                                        className="ud-pm-upload-pl-badge ud-pm-upload-pl-badge--ok"
                                                        style={{ borderColor: `${color}55`, color }}
                                                        title={`${plName} — yüklü`}
                                                    >
                                                        <FaCheckCircle size={10} /> {PL_SHORT[plName] || plName}
                                                    </span>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={plName}
                                                    type="button"
                                                    className="ud-pm-upload-pl-btn"
                                                    style={{ borderColor: color, color }}
                                                    title={`${plName}'a yükle`}
                                                    onClick={() => openDistFlow(p, plName)}
                                                >
                                                    <FaCloudUploadAlt size={11} /> {PL_SHORT[plName] || plName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="ud-pm-product-list-item-actions" onClick={(e) => e.stopPropagation()}>
                                        <button type="button" className="ud-pm-btn sm outline" onClick={() => openDetail(p._id)} title="Ürün detayı">
                                            <FaEye />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
                <Pagination
                    currentPage={uploadMpPage}
                    totalPages={Math.ceil(total / LIMIT)}
                    total={total}
                    onPageChange={loadUploadMpProducts}
                />
            </div>
        </div>
    );

"""

# fix motion.div typo in stats
new_fn = new_fn.replace(
    '<motion.div className="ud-pm-product-list-item-stats ud-pm-upload-simple-stats">',
    '<div className="ud-pm-product-list-item-stats ud-pm-upload-simple-stats">',
).replace(
    '</motion.div>\n                                    <div className="ud-pm-upload-simple-platforms"',
    '</div>\n                                    <div className="ud-pm-upload-simple-platforms"',
)

# fix search wrap - use div not motion
new_fn = new_fn.replace('<motion.div className="ud-pm-search-wrap">', '<div className="ud-pm-search-wrap">')
new_fn = new_fn.replace('<motion.div className="ud-pm-spacer" />', '<motion.div className="ud-pm-spacer" />'.replace("motion.", ""))
new_fn = new_fn.replace('<motion.div className="ud-pm-spacer" />', '<div className="ud-pm-spacer" />')

path.write_text(text[:start] + new_fn + text[end:], encoding="utf-8")
print("patched", end - start, "->", len(new_fn))
