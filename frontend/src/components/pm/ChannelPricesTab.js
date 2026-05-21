import React from "react";
import { motion } from "framer-motion";
import {
    FaBox, FaSearch, FaSave, FaGlobe, FaBolt, FaUndo, FaPercentage
} from "react-icons/fa";

/**
 * Pazaryeri fiyatları — dikey liste, ürün altında kanal satırları (mobil uyumlu)
 */
const ChannelPricesTab = ({
    products,
    total,
    page,
    limit,
    loading,
    search,
    onSearchChange,
    onPageChange,
    platforms,
    plShort,
    plColor,
    fmt,
    getPlMappingAny,
    getChRowDraft,
    setChEditField,
    saveChLocal,
    pushChPrice,
    fillChRowFromMaster,
    resetChRowDraft,
    chRowAction,
    Loading,
    Empty,
    Pagination
}) => (
    <motion.div
        className="ud-pm-chpr-root ud-pm-chpr-root--list-clean"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
    >
        <div className="ud-pm-toolbar ud-pm-toolbar--card">
            <div className="ud-pm-search-wrap">
                <span className="icon"><FaSearch /></span>
                <input
                    className="ud-pm-search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Ürün adı, barkod veya SKU…"
                    aria-label="Pazaryeri fiyatlarında ara"
                />
            </div>
            <div className="ud-pm-spacer" />
            <span className="ud-pm-chpr-count-pill">{total} ürün</span>
        </div>

        <div className="ud-pm-product-list-wrap ud-pm-card ud-pm-chpr-list-shell">
            <p className="ud-pm-chpr-list-hint">
                <strong>Kaydet</strong> panel · <strong>Gönder</strong> pazaryeri
            </p>

            <div className="ud-pm-product-list ud-pm-chpr-product-list">
                {loading ? (
                    <div className="ud-pm-product-list-loading"><Loading /></div>
                ) : !products?.length ? (
                    <Empty icon={FaPercentage} title="Ürün bulunamadı" desc="Aramayı değiştirin veya ürün ekleyin." />
                ) : (
                    products.map((p, i) => {
                        const mp = p.masterProduct || {};
                        const draft = getChRowDraft(p);
                        const listed = platforms.filter((pl) => getPlMappingAny(p, pl));
                        const nListed = listed.length;

                        return (
                            <motion.div
                                key={p._id}
                                className="ud-pm-chpr-list-block"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: Math.min(i * 0.012, 0.2) }}
                            >
                                <div className="ud-pm-chpr-list-head-row">
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
                                            <span className="ud-pm-chpr-kanal-tag">{nListed}/{platforms.length} kanal</span>
                                        </div>
                                    </div>
                                    <div className="ud-pm-chpr-list-head-side">
                                        <div className="ud-pm-chpr-master-pill">
                                            <span className="lbl">Master</span>
                                            <strong>{fmt(mp.price)}</strong>
                                        </div>
                                        <div className="ud-pm-chpr-head-btns">
                                            <button
                                                type="button"
                                                className="ud-pm-btn sm outline"
                                                title="Master fiyatıyla doldur"
                                                disabled={nListed === 0 || !!chRowAction}
                                                onClick={() => fillChRowFromMaster(p._id)}
                                            >
                                                <FaBolt />
                                            </button>
                                            <button
                                                type="button"
                                                className="ud-pm-btn sm muted"
                                                title="Sıfırla"
                                                disabled={!!chRowAction}
                                                onClick={() => resetChRowDraft(p._id)}
                                            >
                                                <FaUndo />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {nListed === 0 ? (
                                    <p className="ud-pm-chpr-no-channel">Aktif pazaryeri kaydı yok</p>
                                ) : (
                                    <ul className="ud-pm-chpr-channel-rows">
                                        {listed.map((pl) => {
                                            const m = getPlMappingAny(p, pl);
                                            const d = draft[pl] || { sale: "", list: "" };
                                            const color = plColor[pl] || "var(--ud-pm-accent)";
                                            const busyLocal = chRowAction === `${p._id}-${pl}-local`;
                                            const busyPush = chRowAction === `${p._id}-${pl}-push`;
                                            return (
                                                <li
                                                    key={pl}
                                                    className="ud-pm-chpr-channel-row"
                                                    style={{ "--pl-color": color }}
                                                >
                                                    <span className="ud-pm-chpr-pl-tag">{plShort[pl] || pl}</span>
                                                    <label className="ud-pm-chpr-inp-wrap">
                                                        <span className="ud-pm-chpr-inp-lbl">Satış</span>
                                                        <input
                                                            type="text"
                                                            className="ud-pm-chpr-inp"
                                                            value={d.sale}
                                                            onChange={(e) => setChEditField(p._id, pl, "sale", e.target.value)}
                                                            inputMode="decimal"
                                                            placeholder="—"
                                                            aria-label={`${pl} satış`}
                                                        />
                                                    </label>
                                                    <label className="ud-pm-chpr-inp-wrap">
                                                        <span className="ud-pm-chpr-inp-lbl">Liste</span>
                                                        <input
                                                            type="text"
                                                            className="ud-pm-chpr-inp"
                                                            value={d.list}
                                                            onChange={(e) => setChEditField(p._id, pl, "list", e.target.value)}
                                                            inputMode="decimal"
                                                            placeholder="—"
                                                            aria-label={`${pl} liste`}
                                                        />
                                                    </label>
                                                    {m?.price != null && (
                                                        <span className="ud-pm-chpr-saved" title="Kayıtlı">{fmt(m.price)}</span>
                                                    )}
                                                    <div className="ud-pm-chpr-row-actions">
                                                        <button
                                                            type="button"
                                                            className="ud-pm-btn sm outline"
                                                            disabled={!!chRowAction}
                                                            onClick={() => saveChLocal(p._id, pl)}
                                                            title="Kaydet"
                                                        >
                                                            {busyLocal ? <span className="spinner" /> : <FaSave />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ud-pm-btn sm outline"
                                                            style={{ borderColor: color, color }}
                                                            disabled={!!chRowAction}
                                                            onClick={() => pushChPrice(p._id, pl)}
                                                            title="Gönder"
                                                        >
                                                            {busyPush ? <span className="spinner" /> : <FaGlobe />}
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </motion.div>
                        );
                    })
                )}
            </div>

            <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / limit) || 1}
                total={total}
                onPageChange={onPageChange}
            />
        </div>
    </motion.div>
);

export default ChannelPricesTab;
