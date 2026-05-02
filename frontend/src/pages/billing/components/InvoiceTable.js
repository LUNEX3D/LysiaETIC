/**
 * Fatura Tablosu — Belge listeleme, filtreleme, işlem butonları
 * LysiaETIC
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    FaSearch, FaPlus, FaSyncAlt, FaEye, FaDownload, FaPrint, FaSpinner,
} from "react-icons/fa";
import { colors, buttonPrimary, buttonSecondary } from "../styles";
import { StatusBadge, TypeBadge, EmptyState, LoadingState } from "./SharedUI";
import { fmtCurrency, fmtDate, filterInvoices } from "../utils";

const InvoiceTable = ({
    invoices,
    loading,
    lastFetchTime,
    onRefresh,
    onCreateNew,
    onViewDetail,
    onDownload,
    pdfLoading,
    showFilters = true,
    title,
}) => {
    const [filterType, setFilterType] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const filtered = useMemo(
        () =>
            showFilters
                ? filterInvoices(invoices, { type: filterType, status: filterStatus, query: searchQuery })
                : invoices,
        [invoices, filterType, filterStatus, searchQuery, showFilters]
    );

    if (loading && invoices.length === 0) {
        return <LoadingState message="Belgeler yükleniyor..." sub="Sağlayıcınızdan veriler çekiliyor, lütfen bekleyin." />;
    }

    const selectStyle = {
        background: colors.glass,
        border: "1px solid " + colors.glassBr,
        borderRadius: 10,
        padding: "0.65rem 0.75rem",
        color: "#fff",
        fontSize: "0.8rem",
        outline: "none",
        cursor: "pointer",
    };
    const optionStyle = { background: "#1a1f35" };

    return (
        <div>
            {/* ── Filtreler ── */}
            {showFilters && (
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: "1 1 250px", position: "relative" }}>
                        <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.dim, fontSize: "0.8rem" }} />
                        <input
                            type="text"
                            placeholder="Fatura no, müşteri adı veya VKN ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: "100%",
                                background: colors.glass,
                                border: "1px solid " + colors.glassBr,
                                borderRadius: 10,
                                padding: "0.65rem 0.75rem 0.65rem 2.2rem",
                                color: "#fff",
                                fontSize: "0.82rem",
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
                        <option value="all" style={optionStyle}>Tüm Tipler</option>
                        <option value="e-arsiv" style={optionStyle}>e-Arşiv</option>
                        <option value="e-fatura" style={optionStyle}>e-Fatura</option>
                        <option value="e-fatura-gelen" style={optionStyle}>Gelen e-Fatura</option>
                        <option value="e-irsaliye" style={optionStyle}>e-İrsaliye</option>
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
                        <option value="all" style={optionStyle}>Tüm Durumlar</option>
                        <option value="approved" style={optionStyle}>Onaylandı</option>
                        <option value="succeed" style={optionStyle}>Başarılı</option>
                        <option value="sent" style={optionStyle}>Gönderildi</option>
                        <option value="pending" style={optionStyle}>Beklemede</option>
                        <option value="cancelled" style={optionStyle}>İptal</option>
                        <option value="received" style={optionStyle}>Alındı</option>
                    </select>
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onRefresh}
                        disabled={loading}
                        style={{ ...buttonSecondary, padding: "0.65rem 0.85rem", color: colors.accent }}
                    >
                        {loading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaSyncAlt />} Yenile
                    </motion.button>
                    {onCreateNew && (
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onCreateNew}
                            style={buttonPrimary}
                        >
                            <FaPlus /> Yeni Belge
                        </motion.button>
                    )}
                </div>
            )}

            {/* ── Alt sekme başlığı (filtre yoksa) ── */}
            {!showFilters && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ color: colors.muted, fontSize: "0.82rem" }}>{filtered.length} belge</span>
                        {lastFetchTime && (
                            <span style={{ color: colors.dim, fontSize: "0.7rem" }}>
                                • Son güncelleme: {lastFetchTime.toLocaleTimeString("tr-TR")}
                            </span>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onRefresh}
                            disabled={loading}
                            style={{ ...buttonSecondary, padding: "0.45rem 0.75rem", fontSize: "0.78rem", color: colors.accent }}
                        >
                            {loading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaSyncAlt />} Yenile
                        </motion.button>
                        {onCreateNew && (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={onCreateNew}
                                style={{ ...buttonPrimary, padding: "0.45rem 1rem", fontSize: "0.78rem" }}
                            >
                                <FaPlus /> Yeni Belge
                            </motion.button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tablo ── */}
            {filtered.length > 0 ? (
                <>
                    {/* Tablo Header */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr 0.8fr",
                            gap: "0.5rem",
                            padding: "0.6rem 1rem",
                            marginBottom: "0.4rem",
                            borderBottom: "2px solid " + colors.accent + "20",
                        }}
                    >
                        {["Belge No", "Tip", "Müşteri / VKN", "Tarih", "Tutar", "Durum", "İşlem"].map((h) => (
                            <span key={h} style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {h}
                            </span>
                        ))}
                    </div>

                    {/* Satırlar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {filtered.map((inv, idx) => (
                            <motion.div
                                key={inv.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                                whileHover={{ backgroundColor: "rgba(78,205,196,0.04)" }}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr 0.8fr",
                                    gap: "0.5rem",
                                    alignItems: "center",
                                    padding: "0.7rem 1rem",
                                    borderRadius: 8,
                                    background: idx % 2 === 0 ? colors.glass : "transparent",
                                    border: "1px solid transparent",
                                    transition: "all 0.15s",
                                }}
                            >
                                <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace" }}>
                                    {inv.number || "—"}
                                </span>
                                <TypeBadge type={inv.type} />
                                <div>
                                    <p style={{ color: colors.text, fontSize: "0.78rem", margin: 0, fontWeight: 500 }}>
                                        {inv.customer || "—"}
                                    </p>
                                    <p style={{ color: colors.dim, fontSize: "0.65rem", margin: 0, fontFamily: "monospace" }}>
                                        {inv.vkn || ""}
                                    </p>
                                </div>
                                <span style={{ color: colors.muted, fontSize: "0.78rem" }}>{fmtDate(inv.date)}</span>
                                <span style={{ color: colors.green, fontSize: "0.82rem", fontWeight: 700 }}>
                                    {inv.total > 0 ? fmtCurrency(inv.total) : "—"}
                                </span>
                                <StatusBadge status={inv.status} />
                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="Detay Görüntüle"
                                        onClick={() => onViewDetail && onViewDetail(inv)}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 6,
                                            padding: "0.35rem",
                                            cursor: "pointer",
                                            color: colors.accent,
                                            fontSize: "0.75rem",
                                            display: "flex",
                                        }}
                                    >
                                        <FaEye />
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="İndir"
                                        onClick={() => onDownload && onDownload(inv.id, inv.number)}
                                        disabled={pdfLoading === inv.id}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 6,
                                            padding: "0.35rem",
                                            cursor: "pointer",
                                            color: colors.blue,
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            opacity: pdfLoading === inv.id ? 0.5 : 1,
                                        }}
                                    >
                                        {pdfLoading === inv.id ? (
                                            <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                                        ) : (
                                            <FaDownload />
                                        )}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="Yazdır"
                                        onClick={() => onDownload && onDownload(inv.id, inv.number)}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 6,
                                            padding: "0.35rem",
                                            cursor: "pointer",
                                            color: colors.muted,
                                            fontSize: "0.75rem",
                                            display: "flex",
                                        }}
                                    >
                                        <FaPrint />
                                    </motion.button>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Alt bilgi */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: "1rem",
                            paddingTop: "0.75rem",
                            borderTop: "1px solid " + colors.glassBr,
                        }}
                    >
                        <span style={{ color: colors.dim, fontSize: "0.75rem" }}>
                            {filtered.length} belge gösteriliyor
                        </span>
                        <span style={{ color: colors.muted, fontSize: "0.75rem", fontWeight: 600 }}>
                            Toplam: {fmtCurrency(filtered.reduce((s, i) => s + (i.total || 0), 0))}
                        </span>
                    </div>
                </>
            ) : (
                <EmptyState
                    icon="📭"
                    title="Belge bulunamadı"
                    description={
                        loading
                            ? "Belgeler yükleniyor..."
                            : "Bu kategoride sağlayıcınızda kayıtlıı belge bulunamadı. Yeni belge oluşturmak için 'Yeni Belge' butonunu kullanabilirsiniz."
                    }
                />
            )}
        </div>
    );
};

export default React.memo(InvoiceTable);
