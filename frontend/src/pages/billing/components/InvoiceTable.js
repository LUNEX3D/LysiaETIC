/**
 * Fatura Tablosu — Belge listeleme, filtreleme, işlem butonları
 * LysiaETIC
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    FaSearch, FaPlus, FaSyncAlt, FaEye, FaDownload, FaSpinner, FaInfoCircle,
} from "react-icons/fa";
import { colors, buttonPrimary, buttonSecondary } from "../styles";
import { StatusBadge, TypeBadge, EmptyState, LoadingState, BillingSelect, SovosCancelBadge } from "./SharedUI";
import { fmtCurrency, fmtDate, filterInvoices, resolveInvoiceIds } from "../utils";

const InvoiceTable = ({
    invoices,
    loading,
    lastFetchTime,
    onRefresh,
    onCreateNew,
    onViewDetail,
    onPreview,
    onDownload,
    isDocLoading,
    isAnyDocLoading,
    showFilters = true,
    showSovosCancelColumn = false,
    title,
    emptyTitle,
    emptyDescription,
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

    const selectFieldStyle = { minWidth: 140, flex: "1 1 140px" };
    const gridCols = showSovosCancelColumn
        ? "2fr 1fr 1.5fr 1fr 1fr 0.9fr 1fr 0.8fr"
        : "2fr 1fr 1.5fr 1fr 1fr 1fr 0.8fr";
    const headers = showSovosCancelColumn
        ? ["Belge No", "Tip", "Müşteri / VKN", "Tarih", "Tutar", "Durum", "İptal Edildi Mi?", "İşlem"]
        : ["Belge No", "Tip", "Müşteri / VKN", "Tarih", "Tutar", "Durum", "İşlem"];

    return (
        <div style={{
            background: colors.cardGradient,
            border: "1px solid " + colors.border,
            borderRadius: 16,
            padding: "1.25rem 1.5rem",
        }}>
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
                    <BillingSelect value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectFieldStyle} options={[
                        { value: "all", label: "Tüm Tipler" },
                        { value: "e-arsiv", label: "e-Arşiv" },
                        { value: "e-fatura", label: "e-Fatura" },
                        { value: "e-fatura-gelen", label: "Gelen e-Fatura" },
                        { value: "e-irsaliye", label: "e-İrsaliye" },
                    ]} />
                    <BillingSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectFieldStyle} options={[
                        { value: "all", label: "Tüm Durumlar" },
                        { value: "approved", label: "Onaylandı" },
                        { value: "succeed", label: "Başarılı" },
                        { value: "sent", label: "Gönderildi" },
                        { value: "pending", label: "Beklemede" },
                        { value: "cancelled", label: "İptal" },
                        { value: "received", label: "Alındı" },
                    ]} />
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
                            gridTemplateColumns: gridCols,
                            gap: "0.5rem",
                            padding: "0.6rem 1rem",
                            marginBottom: "0.4rem",
                            borderBottom: "2px solid " + colors.accent + "20",
                        }}
                    >
                        {headers.map((h) => (
                            <span key={h} style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {h}
                            </span>
                        ))}
                    </div>

                    {/* Satırlar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {filtered.map((inv, idx) => {
                            const ids = resolveInvoiceIds(inv);
                            const rowKey = ids.lookupId || inv.number || idx;
                            const loadingKey = ids.lookupId || ids.uuid;
                            return (
                            <motion.div
                                key={rowKey}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                                whileHover={{ backgroundColor: "rgba(78,205,196,0.04)" }}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: gridCols,
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
                                <StatusBadge status={inv.status} statusCode={inv.statusCode} provider={inv.provider} />
                                {showSovosCancelColumn && (
                                    <SovosCancelBadge
                                        cancelled={inv.sovosCancelled ?? inv.status === "cancelled"}
                                        provider={inv.provider}
                                        profileId={inv.raw?.profileId}
                                    />
                                )}
                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                    {onViewDetail && (
                                        <motion.button
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.9 }}
                                            title="Detay"
                                            onClick={() => onViewDetail(inv)}
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
                                            <FaInfoCircle />
                                        </motion.button>
                                    )}
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="Önizle"
                                        onClick={() => (onPreview || onViewDetail) && (onPreview ? onPreview(inv) : onViewDetail(inv))}
                                        disabled={isAnyDocLoading?.(loadingKey)}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 6,
                                            padding: "0.35rem",
                                            cursor: isAnyDocLoading?.(loadingKey) ? "wait" : "pointer",
                                            color: colors.accent,
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            opacity: isAnyDocLoading?.(loadingKey) ? 0.5 : 1,
                                        }}
                                    >
                                        {isDocLoading?.(loadingKey, "preview") ? (
                                            <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                                        ) : (
                                            <FaEye />
                                        )}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="İndir / Görüntüle"
                                        onClick={() => onDownload && onDownload(inv)}
                                        disabled={isAnyDocLoading?.(loadingKey)}
                                        style={{
                                            background: colors.glass,
                                            border: "1px solid " + colors.glassBr,
                                            borderRadius: 6,
                                            padding: "0.35rem",
                                            cursor: isAnyDocLoading?.(loadingKey) ? "wait" : "pointer",
                                            color: colors.blue,
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            opacity: isAnyDocLoading?.(loadingKey) ? 0.5 : 1,
                                        }}
                                    >
                                        {isDocLoading?.(loadingKey, "download") ? (
                                            <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                                        ) : (
                                            <FaDownload />
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                            );
                        })}
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
                    title={emptyTitle || "Belge bulunamadı"}
                    description={
                        loading
                            ? "Belgeler yükleniyor..."
                            : (emptyDescription || "Bu kategoride sağlayıcınızda kayıtlı belge bulunamadı. Yeni belge oluşturmak için 'Yeni Belge' butonunu kullanabilirsiniz.")
                    }
                />
            )}
        </div>
    );
};

export default React.memo(InvoiceTable);
