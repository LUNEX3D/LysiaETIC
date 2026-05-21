import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
    FaBox, FaSearch, FaTimes, FaCheckCircle, FaEye, FaMinusCircle, FaClock
} from "react-icons/fa";

const STATUS_LABEL = {
    on: "Var",
    off: "Yok",
    pending: "Bekliyor",
    error: "Hata"
};

const getCellState = (product, plName, getPlStatus, getPlMappingAny) => {
    const ps = getPlStatus(product, plName);
    if (ps.exists) {
        const st = ps.status;
        if (st === "pending" || st === "syncing" || st === "pulled") return "pending";
        return "on";
    }
    if (getPlMappingAny) {
        const m = getPlMappingAny(product, plName);
        if (m?.syncStatus === "error") return "error";
    }
    return "off";
};

const PlatformCell = ({ plName, state, color, shortLabel, title, onUpload }) => {
    const label = STATUS_LABEL[state] || "Yok";
    const isOff = state === "off";
    const isOn = state === "on";
    const isPending = state === "pending";
    const isError = state === "error";

    const inner = (
        <>
            <span className="ud-pm-pl-cell-code">{shortLabel}</span>
            <span className="ud-pm-pl-cell-state">{label}</span>
            {isOn && <FaCheckCircle className="ud-pm-pl-cell-icon" aria-hidden />}
            {isOff && <FaMinusCircle className="ud-pm-pl-cell-icon" aria-hidden />}
            {isPending && <FaClock className="ud-pm-pl-cell-icon" aria-hidden />}
            {isError && <FaTimes className="ud-pm-pl-cell-icon" aria-hidden />}
        </>
    );

    if ((isOff || isError) && onUpload) {
        return (
            <button
                type="button"
                className={`ud-pm-pl-cell ud-pm-pl-cell--${state}`}
                style={{ "--pl-color": color }}
                title={title}
                onClick={onUpload}
            >
                {inner}
            </button>
        );
    }

    return (
        <div
            className={`ud-pm-pl-cell ud-pm-pl-cell--${state}`}
            style={{ "--pl-color": color }}
            title={title}
            role="img"
            aria-label={title}
        >
            {inner}
        </div>
    );
};

/**
 * Ürünleri pazaryerine yükle — tek liste, platform durumu satır satır net
 */
const UploadMarketplaceTab = ({
    products,
    total,
    page,
    limit,
    loading,
    search,
    onSearchChange,
    filterPl,
    onFilterPlChange,
    filterType,
    onFilterTypeChange,
    onClearFilters,
    onPageChange,
    platforms,
    plShort,
    plColor,
    plFullName,
    fmt,
    getPlStatus,
    getPlMappingAny,
    onUploadPlatform,
    onOpenDetail,
    Loading,
    Empty,
    Pagination
}) => {
    const plList = useMemo(() => {
        const base = platforms?.length ? platforms : [];
        return base;
    }, [platforms]);

    const countOnPlatform = (product) =>
        plList.filter((pl) => {
            const s = getCellState(product, pl, getPlStatus, getPlMappingAny);
            return s === "on" || s === "pending";
        }).length;

    const buildTitle = (product, plName, state) => {
        const ps = getPlStatus(product, plName);
        const full = plFullName?.[plName] || plName;
        if (state === "on") return `${full}: Pazaryerinde yüklü${ps.lastSync ? ` · Son senkron: ${new Date(ps.lastSync).toLocaleString("tr-TR")}` : ""}`;
        if (state === "pending") return `${full}: Yükleme veya senkron bekleniyor`;
        if (state === "error") return `${full}: Hata — yeniden yüklemeyi deneyin`;
        return `${full}: Yüklü değil — tıklayarak yükleyin`;
    };

    return (
        <motion.div
            className="ud-pm-upload-mp-page ud-pm-upload-mp-page--simple"
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
                        placeholder="Ürün adı, barkod, SKU..."
                        aria-label="Yüklenecek ürün ara"
                    />
                </div>
                <select className="ud-pm-select" value={filterPl} onChange={(e) => onFilterPlChange(e.target.value)} aria-label="Platform filtresi">
                    <option value="">Tüm platformlar</option>
                    {plList.map((pl) => (
                        <option key={pl} value={pl}>{plFullName?.[pl] || pl}</option>
                    ))}
                </select>
                <select className="ud-pm-select" value={filterType} onChange={(e) => onFilterTypeChange(e.target.value)} aria-label="Yükleme durumu">
                    <option value="">Tüm durumlar</option>
                    <option value="not_listed">Eksik platformu olanlar</option>
                    <option value="listed">Tamamı yüklü</option>
                </select>
                <div className="ud-pm-spacer" />
                <span className="ud-pm-upload-mp-count">{total} ürün</span>
                <button type="button" className="ud-pm-btn sm outline" onClick={onClearFilters}>
                    <FaTimes /> Temizle
                </button>
            </div>

            <div className="ud-pm-upload-pl-legend ud-pm-card">
                <span className="ud-pm-upload-pl-legend-title">Platform durumu:</span>
                <span className="ud-pm-pl-cell ud-pm-pl-cell--on ud-pm-pl-cell--sample" style={{ "--pl-color": "var(--ud-pm-green)" }}>
                    <span className="ud-pm-pl-cell-code">TY</span>
                    <span className="ud-pm-pl-cell-state">Var</span>
                </span>
                <span className="ud-pm-pl-cell ud-pm-pl-cell--off ud-pm-pl-cell--sample" style={{ "--pl-color": "var(--ud-pm-text-dim)" }}>
                    <span className="ud-pm-pl-cell-code">HB</span>
                    <span className="ud-pm-pl-cell-state">Yok</span>
                </span>
                <span className="ud-pm-pl-cell ud-pm-pl-cell--pending ud-pm-pl-cell--sample" style={{ "--pl-color": "var(--ud-pm-yellow)" }}>
                    <span className="ud-pm-pl-cell-code">N11</span>
                    <span className="ud-pm-pl-cell-state">Bekliyor</span>
                </span>
                <span className="ud-pm-upload-pl-legend-hint">
                    Yeşil = yüklü · Gri çizgili = yok (tıkla yükle) · Sarı = kuyrukta
                </span>
            </div>

            <div
                className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-simple-wrap"
                style={{ "--pl-cols": plList.length }}
            >
                {!loading && products?.length > 0 && (
                    <div className="ud-pm-upload-list-head" aria-hidden>
                        <span className="ud-pm-upload-head-product">Ürün</span>
                        <span className="ud-pm-upload-head-stats">Fiyat / Stok</span>
                        <span className="ud-pm-upload-head-platforms">
                            {plList.map((pl) => (
                                <span key={pl} className="ud-pm-upload-head-pl" style={{ color: plColor[pl] }}>
                                    {plShort[pl] || pl}
                                </span>
                            ))}
                        </span>
                        <span className="ud-pm-upload-head-action" />
                    </div>
                )}
                <div className="ud-pm-product-list ud-pm-upload-mp-simple-list">
                    {loading ? (
                        <div className="ud-pm-product-list-loading"><Loading /></div>
                    ) : !products?.length ? (
                        <Empty icon={FaBox} title="Ürün bulunamadı" desc="Filtreleri değiştirin veya önce ürün ekleyin" />
                    ) : (
                        products.map((p, i) => {
                            const mp = p.masterProduct || {};
                            const st = p.stockTracking || {};
                            const listed = countOnPlatform(p);
                            const totalPl = plList.length;
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
                                            <div className={`ud-pm-upload-pl-summary ${listed === totalPl ? "ud-pm-upload-pl-summary--full" : listed === 0 ? "ud-pm-upload-pl-summary--none" : ""}`}>
                                                <strong>{listed}</strong> / {totalPl} platformda yüklü
                                                {listed < totalPl && (
                                                    <span className="ud-pm-upload-pl-missing">
                                                        · Eksik: {plList.filter((pl) => getCellState(p, pl, getPlStatus, getPlMappingAny) === "off").map((pl) => plShort[pl] || pl).join(", ") || "—"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ud-pm-product-list-item-stats ud-pm-upload-simple-stats">
                                        <span className="price">{fmt(mp.price)}</span>
                                        <span className={st.isOutOfStock ? "stock-out" : st.isLowStock ? "stock-low" : "stock-ok"}>
                                            Stok: {st.totalStock ?? mp.stock ?? 0}
                                        </span>
                                    </div>
                                    <div className="ud-pm-upload-pl-grid" onClick={(e) => e.stopPropagation()}>
                                        {plList.map((plName) => {
                                            const state = getCellState(p, plName, getPlStatus, getPlMappingAny);
                                            const color = plColor[plName] || "var(--ud-pm-accent)";
                                            return (
                                                <PlatformCell
                                                    key={plName}
                                                    plName={plName}
                                                    state={state}
                                                    color={color}
                                                    shortLabel={plShort[plName] || plName}
                                                    title={buildTitle(p, plName, state)}
                                                    onUpload={state === "off" || state === "error" ? () => onUploadPlatform(p, plName) : undefined}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="ud-pm-product-list-item-actions" onClick={(e) => e.stopPropagation()}>
                                        <button type="button" className="ud-pm-btn sm outline" onClick={() => onOpenDetail(p._id)} title="Ürün detayı">
                                            <FaEye />
                                        </button>
                                    </div>
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
};

export default UploadMarketplaceTab;
