/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — Maliyet Yönetimi Tab — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * Product cost entry & management for AI accuracy
 * Uses: GET /brain/products, POST /brain/update-cost, POST /brain/bulk-update-cost
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import API from "../../../services/api";
import { T, fmt, fmtN, fmtP, useResponsive } from "../styles";
import { Card, CardHeader, Badge, Btn, StatCard, EmptyState, LoadingState, ErrorState, Input, GlowLine } from "./shared/SharedUI";

const PAGE_SIZE = 30;

const BrainCosts = ({ t, onError }) => {
    const { isMobile, isTablet } = useResponsive();

    /* ═══ STATE ═══ */
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [products, setProducts] = useState([]);
    const [stats, setStats] = useState({ total: 0, withCost: 0, withoutCost: 0 });
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [search, setSearch] = useState("");
    const [filterMode, setFilterMode] = useState("all"); // all | noCost | hasCost
    const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

    // Editing
    const [editingBarcode, setEditingBarcode] = useState(null);
    const [editForm, setEditForm] = useState({ costPrice: "", commissionRate: "", shippingCost: "", packagingCost: "", otherCost: "" });
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(null); // barcode of last saved

    // Bulk edit
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkEdits, setBulkEdits] = useState({}); // { barcode: { costPrice, ... } }
    const [bulkSaving, setBulkSaving] = useState(false);

    // CSV import
    const fileInputRef = useRef(null);
    const [importResult, setImportResult] = useState(null);

    /* ═══ DATA FETCHING ═══ */
    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (filterMode === "noCost") params.set("noCostOnly", "true");
            params.set("limit", "200");

            const res = await API.get(`/ai-engine/brain/products?${params.toString()}`);
            if (res.data.success) {
                let prods = res.data.products || [];
                // Client-side filter for "hasCost"
                if (filterMode === "hasCost") {
                    prods = prods.filter(p => p.hasCostData);
                }
                setProducts(prods);
                setStats(res.data.stats || { total: 0, withCost: 0, withoutCost: 0 });
                setTotalCount(res.data.total || prods.length);
            } else {
                setError(res.data.message || t("error.data_load_fail"));
            }
        } catch (e) {
            setError(e.response?.data?.message || t("error.data_load_fail"));
        } finally {
            setLoading(false);
        }
    }, [search, filterMode, t]);

    useEffect(() => {
        const timer = setTimeout(() => { loadProducts(); }, search ? 400 : 0);
        return () => clearTimeout(timer);
    }, [loadProducts, search]);

    // Reset display limit when filter changes
    useEffect(() => { setDisplayLimit(PAGE_SIZE); }, [filterMode, search]);

    /* ═══ SINGLE SAVE ═══ */
    const handleEdit = (product) => {
        setEditingBarcode(product.barcode);
        setEditForm({
            costPrice: product.costPrice || "",
            commissionRate: product.commissionRate || "",
            shippingCost: product.shippingCost || "",
            packagingCost: product.packagingCost || "",
            otherCost: "",
        });
        setSaveSuccess(null);
    };

    const handleCancelEdit = () => {
        setEditingBarcode(null);
        setEditForm({ costPrice: "", commissionRate: "", shippingCost: "", packagingCost: "", otherCost: "" });
    };

    const handleSave = async (barcode) => {
        setSaving(true);
        setSaveSuccess(null);
        try {
            const body = { barcode };
            if (editForm.costPrice !== "") body.costPrice = Number(editForm.costPrice);
            if (editForm.commissionRate !== "") body.commissionRate = Number(editForm.commissionRate);
            if (editForm.shippingCost !== "") body.shippingCost = Number(editForm.shippingCost);
            if (editForm.packagingCost !== "") body.packagingCost = Number(editForm.packagingCost);
            if (editForm.otherCost !== "") body.otherCost = Number(editForm.otherCost);

            const res = await API.post("/ai-engine/brain/update-cost", body);
            if (res.data.success) {
                // Update local state
                setProducts(prev => prev.map(p =>
                    p.barcode === barcode
                        ? {
                            ...p,
                            costPrice: body.costPrice ?? p.costPrice,
                            commissionRate: body.commissionRate ?? p.commissionRate,
                            shippingCost: body.shippingCost ?? p.shippingCost,
                            hasCostData: (body.costPrice ?? p.costPrice) > 0,
                        }
                        : p
                ));
                // Update stats
                setStats(prev => {
                    const wasMissing = products.find(p => p.barcode === barcode)?.costPrice === 0;
                    const nowHas = (body.costPrice ?? 0) > 0;
                    if (wasMissing && nowHas) {
                        return { ...prev, withCost: prev.withCost + 1, withoutCost: Math.max(0, prev.withoutCost - 1) };
                    }
                    return prev;
                });
                setSaveSuccess(barcode);
                setEditingBarcode(null);
                setTimeout(() => setSaveSuccess(null), 3000);
            } else {
                onError?.(res.data.message || t("cost.save_fail"));
            }
        } catch (e) {
            onError?.(e.response?.data?.message || t("cost.save_fail"));
        } finally {
            setSaving(false);
        }
    };

    /* ═══ BULK SAVE ═══ */
    const handleBulkFieldChange = (barcode, field, value) => {
        setBulkEdits(prev => ({
            ...prev,
            [barcode]: { ...prev[barcode], [field]: value },
        }));
    };

    const handleBulkSave = async () => {
        const entries = Object.entries(bulkEdits).filter(([, vals]) =>
            Object.values(vals).some(v => v !== "" && v !== undefined && v !== null)
        );
        if (entries.length === 0) return;

        setBulkSaving(true);
        try {
            const payload = entries.map(([barcode, vals]) => {
                const item = { barcode };
                if (vals.costPrice !== "" && vals.costPrice !== undefined) item.costPrice = Number(vals.costPrice);
                if (vals.commissionRate !== "" && vals.commissionRate !== undefined) item.commissionRate = Number(vals.commissionRate);
                if (vals.shippingCost !== "" && vals.shippingCost !== undefined) item.shippingCost = Number(vals.shippingCost);
                if (vals.packagingCost !== "" && vals.packagingCost !== undefined) item.packagingCost = Number(vals.packagingCost);
                return item;
            });

            const res = await API.post("/ai-engine/brain/bulk-update-cost", { products: payload });
            if (res.data.success) {
                setBulkEdits({});
                setBulkMode(false);
                loadProducts(); // Refresh all data
            } else {
                onError?.(res.data.message || t("cost.bulk_fail"));
            }
        } catch (e) {
            onError?.(e.response?.data?.message || t("cost.bulk_fail"));
        } finally {
            setBulkSaving(false);
        }
    };

    /* ═══ CSV IMPORT ═══ */
    const handleCSVImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target?.result;
                if (!text) return;
                const lines = text.split("\n").filter(l => l.trim());
                if (lines.length < 2) { onError?.(t("cost.csv_empty")); return; }

                // Parse header
                const header = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
                const barcodeIdx = header.findIndex(h => h === "barcode" || h === "barkod");
                const costIdx = header.findIndex(h => h === "costprice" || h === "cost" || h === "maliyet" || h === "alisfiyati" || h === "alis_fiyati");
                const commIdx = header.findIndex(h => h === "commissionrate" || h === "commission" || h === "komisyon");
                const shipIdx = header.findIndex(h => h === "shippingcost" || h === "shipping" || h === "kargo");
                const packIdx = header.findIndex(h => h === "packagingcost" || h === "packaging" || h === "paketleme");

                if (barcodeIdx === -1 || costIdx === -1) {
                    onError?.(t("cost.csv_format_error"));
                    return;
                }

                const items = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(/[,;\t]/).map(c => c.trim());
                    const barcode = cols[barcodeIdx];
                    if (!barcode) continue;
                    const item = { barcode };
                    if (costIdx >= 0 && cols[costIdx]) item.costPrice = Number(cols[costIdx].replace(",", "."));
                    if (commIdx >= 0 && cols[commIdx]) item.commissionRate = Number(cols[commIdx].replace(",", "."));
                    if (shipIdx >= 0 && cols[shipIdx]) item.shippingCost = Number(cols[shipIdx].replace(",", "."));
                    if (packIdx >= 0 && cols[packIdx]) item.packagingCost = Number(cols[packIdx].replace(",", "."));
                    items.push(item);
                }

                if (items.length === 0) { onError?.(t("cost.csv_empty")); return; }

                const res = await API.post("/ai-engine/brain/bulk-update-cost", { products: items.slice(0, 100) });
                if (res.data.success) {
                    setImportResult({ updated: res.data.updated, failed: res.data.failed, total: items.length });
                    loadProducts();
                    setTimeout(() => setImportResult(null), 8000);
                } else {
                    onError?.(res.data.message || t("cost.bulk_fail"));
                }
            } catch (err) {
                onError?.(t("cost.csv_parse_error"));
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be re-imported
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    /* ═══ CSV EXPORT ═══ */
    const handleCSVExport = () => {
        const header = "barcode,name,costPrice,commissionRate,shippingCost,price,stock";
        const rows = products.map(p =>
            `${p.barcode},"${(p.name || "").replace(/"/g, '""')}",${p.costPrice || 0},${p.commissionRate || 0},${p.shippingCost || 0},${p.price || 0},${p.stock || 0}`
        );
        const csv = [header, ...rows].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lysia_costs_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ═══ HELPERS ═══ */
    const costCoverage = stats.total > 0 ? Math.round((stats.withCost / stats.total) * 100) : 0;
    const coverageColor = costCoverage >= 80 ? T.green : costCoverage >= 50 ? T.yellow : T.red;

    const displayProducts = products.slice(0, displayLimit);
    const hasMore = products.length > displayLimit;

    const bulkEditCount = Object.keys(bulkEdits).filter(k =>
        Object.values(bulkEdits[k] || {}).some(v => v !== "" && v !== undefined && v !== null)
    ).length;

    /* ═══ RENDER ═══ */
    if (loading && products.length === 0) return <LoadingState message={t("cost.loading")} />;
    if (error && products.length === 0) return <ErrorState message={error} onRetry={loadProducts} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* ═══ STATS BAR ═══ */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <StatCard icon="📦" label={t("cost.total_products")} value={fmtN(stats.total)} color={T.accent} />
                <StatCard icon="✅" label={t("cost.with_cost")} value={fmtN(stats.withCost)} color={T.green} />
                <StatCard icon="⚠️" label={t("cost.without_cost")} value={fmtN(stats.withoutCost)} color={stats.withoutCost > 0 ? T.red : T.green} />
                <StatCard icon="📊" label={t("cost.coverage")} value={`%${costCoverage}`} color={coverageColor} />
            </div>

            {/* ═══ COVERAGE WARNING ═══ */}
            {stats.withoutCost > 0 && (
                <div role="alert" style={{
                    padding: isMobile ? "0.85rem" : "1rem 1.25rem",
                    borderRadius: T.rSm,
                    background: T.yellowDim,
                    border: `1px solid ${T.yellow}25`,
                    display: "flex", alignItems: "flex-start", gap: "0.75rem",
                }}>
                    <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }} aria-hidden="true">💡</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.yellow, marginBottom: 4 }}>
                            {t("cost.warning_title").replace("{count}", stats.withoutCost)}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: T.textSec, lineHeight: 1.65 }}>
                            {t("cost.warning_desc")}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TOOLBAR ═══ */}
            <Card>
                <div style={{
                    display: "flex", flexDirection: isMobile ? "column" : "row",
                    gap: "0.75rem", alignItems: isMobile ? "stretch" : "center",
                    justifyContent: "space-between", flexWrap: "wrap",
                }}>
                    {/* Search */}
                    <div style={{ flex: 1, minWidth: 200, maxWidth: isMobile ? "100%" : 360 }}>
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t("cost.search")}
                            icon="🔍"
                            ariaLabel={t("cost.search")}
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {[
                            { id: "all", label: t("cost.filter_all"), count: stats.total },
                            { id: "noCost", label: t("cost.filter_no_cost"), count: stats.withoutCost, color: T.red },
                            { id: "hasCost", label: t("cost.filter_has_cost"), count: stats.withCost, color: T.green },
                        ].map(f => (
                            <button key={f.id} onClick={() => setFilterMode(f.id)}
                                style={{
                                    padding: "6px 12px", borderRadius: T.rSm, cursor: "pointer",
                                    background: filterMode === f.id ? (f.color || T.accent) + "15" : T.bgGlass,
                                    border: `1px solid ${filterMode === f.id ? (f.color || T.accent) + "35" : T.border}`,
                                    color: filterMode === f.id ? (f.color || T.accent) : T.textDim,
                                    fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit",
                                    display: "flex", alignItems: "center", gap: 5,
                                    transition: "all 0.2s",
                                }}>
                                {f.label}
                                <span style={{
                                    fontSize: "0.62rem", fontWeight: 800,
                                    padding: "1px 5px", borderRadius: T.rFull,
                                    background: filterMode === f.id ? (f.color || T.accent) + "20" : T.bgGlass,
                                    color: filterMode === f.id ? (f.color || T.accent) : T.textMuted,
                                }}>{f.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap" }}>
                        <Btn color={bulkMode ? T.yellow : T.accent} variant={bulkMode ? "default" : "ghost"} size="sm"
                            onClick={() => { setBulkMode(p => !p); setBulkEdits({}); }}>
                            {bulkMode ? `✕ ${t("cost.bulk_cancel")}` : `📝 ${t("cost.bulk_edit")}`}
                        </Btn>
                        <Btn color={T.blue} variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                            📥 {t("cost.csv_import")}
                        </Btn>
                        <Btn color={T.purple} variant="ghost" size="sm" onClick={handleCSVExport}>
                            📤 {t("cost.csv_export")}
                        </Btn>
                        <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSVImport}
                            style={{ display: "none" }} aria-hidden="true" />
                    </div>
                </div>

                {/* Import Result */}
                {importResult && (
                    <div style={{
                        marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: T.rSm,
                        background: T.greenDim, border: `1px solid ${T.green}25`,
                        display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                        <span style={{ fontSize: "1rem" }}>✅</span>
                        <span style={{ fontSize: "0.82rem", color: T.green, fontWeight: 600 }}>
                            {t("cost.import_success")
                                .replace("{updated}", importResult.updated)
                                .replace("{failed}", importResult.failed)
                                .replace("{total}", importResult.total)}
                        </span>
                    </div>
                )}

                {/* Bulk Save Bar */}
                {bulkMode && bulkEditCount > 0 && (
                    <div style={{
                        marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: T.rSm,
                        background: T.yellowDim, border: `1px solid ${T.yellow}25`,
                        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem",
                    }}>
                        <span style={{ fontSize: "0.82rem", color: T.yellow, fontWeight: 600 }}>
                            {t("cost.bulk_pending").replace("{count}", bulkEditCount)}
                        </span>
                        <Btn color={T.green} variant="solid" size="sm" onClick={handleBulkSave} disabled={bulkSaving}>
                            {bulkSaving ? "⏳" : "💾"} {t("cost.bulk_save")}
                        </Btn>
                    </div>
                )}
            </Card>

            {/* ═══ PRODUCT LIST ═══ */}
            {displayProducts.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="📦"
                        title={search ? t("cost.no_search_result") : t("cost.no_products")}
                        description={search ? t("cost.no_search_desc") : t("cost.no_products_desc")}
                    />
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {/* Table Header (desktop) */}
                    {!isMobile && (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: bulkMode
                                ? "2.5fr 1fr 1fr 1fr 1fr"
                                : "2.5fr 1fr 1fr 1fr 1fr 1fr 80px",
                            gap: "0.5rem", padding: "0.5rem 1rem",
                            fontSize: "0.68rem", fontWeight: 700, color: T.textDim,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>
                            <span>{t("cost.col_product")}</span>
                            <span style={{ textAlign: "right" }}>{t("cost.col_price")}</span>
                            <span style={{ textAlign: "right" }}>{t("cost.col_cost")}</span>
                            <span style={{ textAlign: "right" }}>{t("cost.col_commission")}</span>
                            <span style={{ textAlign: "right" }}>{t("cost.col_shipping")}</span>
                            {!bulkMode && <span style={{ textAlign: "right" }}>{t("cost.col_margin")}</span>}
                            {!bulkMode && <span />}
                        </div>
                    )}

                    {displayProducts.map((product) => {
                        const isEditing = editingBarcode === product.barcode;
                        const justSaved = saveSuccess === product.barcode;
                        const hasCost = product.hasCostData || product.costPrice > 0;

                        /* ── BULK MODE ROW ── */
                        if (bulkMode) {
                            const bv = bulkEdits[product.barcode] || {};
                            return (
                                <div key={product.barcode} style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile ? "1fr" : "2.5fr 1fr 1fr 1fr 1fr",
                                    gap: isMobile ? "0.5rem" : "0.5rem",
                                    padding: isMobile ? "0.85rem" : "0.65rem 1rem",
                                    borderRadius: T.rSm,
                                    background: bv.costPrice ? T.accentDim : T.bgCard,
                                    border: `1px solid ${bv.costPrice ? T.accent + "25" : T.border}`,
                                    alignItems: "center",
                                    transition: "all 0.2s",
                                }}>
                                    {/* Product Info */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.84rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {product.name}
                                        </div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                                            <span style={{ fontSize: "0.68rem", color: T.textDim, fontFamily: T.fontMono }}>{product.barcode}</span>
                                            {!hasCost && <Badge color={T.red} size="sm">{t("cost.missing")}</Badge>}
                                        </div>
                                    </div>
                                    {/* Editable Fields */}
                                    <input type="number" placeholder={product.costPrice || t("cost.col_cost")}
                                        value={bv.costPrice ?? ""}
                                        onChange={e => handleBulkFieldChange(product.barcode, "costPrice", e.target.value)}
                                        style={inlineInputStyle}
                                        aria-label={`${product.name} ${t("cost.col_cost")}`}
                                    />
                                    <input type="number" placeholder={product.commissionRate || "%"}
                                        value={bv.commissionRate ?? ""}
                                        onChange={e => handleBulkFieldChange(product.barcode, "commissionRate", e.target.value)}
                                        style={inlineInputStyle}
                                        aria-label={`${product.name} ${t("cost.col_commission")}`}
                                    />
                                    <input type="number" placeholder={product.shippingCost || t("cost.col_shipping")}
                                        value={bv.shippingCost ?? ""}
                                        onChange={e => handleBulkFieldChange(product.barcode, "shippingCost", e.target.value)}
                                        style={inlineInputStyle}
                                        aria-label={`${product.name} ${t("cost.col_shipping")}`}
                                    />
                                    <input type="number" placeholder={product.packagingCost || "0"}
                                        value={bv.packagingCost ?? ""}
                                        onChange={e => handleBulkFieldChange(product.barcode, "packagingCost", e.target.value)}
                                        style={inlineInputStyle}
                                        aria-label={`${product.name} ${t("cost.col_packaging")}`}
                                    />
                                </div>
                            );
                        }

                        /* ── NORMAL MODE ROW ── */
                        if (isMobile) {
                            return (
                                <div key={product.barcode}>
                                    <Card style={{
                                        padding: "0.85rem",
                                        border: justSaved ? `1px solid ${T.green}40` : undefined,
                                        background: justSaved ? T.greenDim : undefined,
                                    }}>
                                        {/* Header */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {product.name}
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: T.textDim, fontFamily: T.fontMono, marginTop: 2 }}>{product.barcode}</div>
                                            </div>
                                            {!hasCost && <Badge color={T.red} size="sm">{t("cost.missing")}</Badge>}
                                            {justSaved && <Badge color={T.green} size="sm">✓ {t("cost.saved")}</Badge>}
                                        </div>

                                        {/* Data Grid */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.6rem" }}>
                                            <MiniStat label={t("cost.col_price")} value={fmt(product.price)} />
                                            <MiniStat label={t("cost.col_cost")} value={product.costPrice > 0 ? fmt(product.costPrice) : "—"} color={product.costPrice > 0 ? T.text : T.red} />
                                            <MiniStat label={t("cost.col_margin")} value={product.profitMargin > 0 ? fmtP(product.profitMargin) : "—"} color={product.profitMargin > 15 ? T.green : product.profitMargin > 5 ? T.yellow : T.red} />
                                        </div>

                                        {/* Edit Section */}
                                        {isEditing ? (
                                            <div style={{ padding: "0.75rem", borderRadius: T.rSm, background: T.bgGlass, border: `1px solid ${T.border}` }}>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.6rem" }}>
                                                    <LabeledInput label={t("cost.col_cost")} value={editForm.costPrice} onChange={v => setEditForm(p => ({ ...p, costPrice: v }))} />
                                                    <LabeledInput label={`${t("cost.col_commission")} (%)`} value={editForm.commissionRate} onChange={v => setEditForm(p => ({ ...p, commissionRate: v }))} />
                                                    <LabeledInput label={t("cost.col_shipping")} value={editForm.shippingCost} onChange={v => setEditForm(p => ({ ...p, shippingCost: v }))} />
                                                    <LabeledInput label={t("cost.col_packaging")} value={editForm.packagingCost} onChange={v => setEditForm(p => ({ ...p, packagingCost: v }))} />
                                                </div>
                                                <div style={{ display: "flex", gap: "0.4rem" }}>
                                                    <Btn color={T.green} variant="solid" size="sm" onClick={() => handleSave(product.barcode)} disabled={saving}>
                                                        {saving ? "⏳" : "💾"} {t("common.save")}
                                                    </Btn>
                                                    <Btn color={T.textDim} variant="ghost" size="sm" onClick={handleCancelEdit}>
                                                        {t("common.cancel")}
                                                    </Btn>
                                                </div>
                                            </div>
                                        ) : (
                                            <Btn color={hasCost ? T.accent : T.yellow} variant={hasCost ? "ghost" : "default"} size="sm"
                                                onClick={() => handleEdit(product)} style={{ width: "100%" }}>
                                                {hasCost ? `✏️ ${t("cost.edit")}` : `➕ ${t("cost.add_cost")}`}
                                            </Btn>
                                        )}
                                    </Card>
                                </div>
                            );
                        }

                        /* ── DESKTOP ROW ── */
                        return (
                            <div key={product.barcode}>
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 80px",
                                    gap: "0.5rem", padding: "0.65rem 1rem",
                                    borderRadius: T.rSm, alignItems: "center",
                                    background: justSaved ? T.greenDim : isEditing ? T.accentDim : T.bgCard,
                                    border: `1px solid ${justSaved ? T.green + "30" : isEditing ? T.accent + "25" : T.border}`,
                                    transition: "all 0.25s",
                                }}>
                                    {/* Product */}
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.84rem", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {product.name}
                                        </div>
                                        <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                                            <span style={{ fontSize: "0.68rem", color: T.textDim, fontFamily: T.fontMono }}>{product.barcode}</span>
                                            {!hasCost && <Badge color={T.red} size="sm">{t("cost.missing")}</Badge>}
                                            {justSaved && <Badge color={T.green} size="sm">✓ {t("cost.saved")}</Badge>}
                                        </div>
                                    </div>
                                    {/* Price */}
                                    <div style={{ textAlign: "right", fontWeight: 700, fontSize: "0.84rem", color: T.text, fontFamily: T.fontMono }}>{fmt(product.price)}</div>
                                    {/* Cost */}
                                    <div style={{ textAlign: "right", fontWeight: 700, fontSize: "0.84rem", color: product.costPrice > 0 ? T.text : T.red, fontFamily: T.fontMono }}>
                                        {product.costPrice > 0 ? fmt(product.costPrice) : "—"}
                                    </div>
                                    {/* Commission */}
                                    <div style={{ textAlign: "right", fontSize: "0.82rem", color: T.textSec, fontFamily: T.fontMono }}>
                                        {product.commissionRate > 0 ? `%${product.commissionRate}` : "—"}
                                    </div>
                                    {/* Shipping */}
                                    <div style={{ textAlign: "right", fontSize: "0.82rem", color: T.textSec, fontFamily: T.fontMono }}>
                                        {product.shippingCost > 0 ? fmt(product.shippingCost) : "—"}
                                    </div>
                                    {/* Margin */}
                                    <div style={{ textAlign: "right" }}>
                                        {product.costPrice > 0 ? (
                                            <Badge color={product.profitMargin > 15 ? T.green : product.profitMargin > 5 ? T.yellow : T.red} size="sm">
                                                {fmtP(product.profitMargin)}
                                            </Badge>
                                        ) : (
                                            <span style={{ fontSize: "0.75rem", color: T.textMuted }}>—</span>
                                        )}
                                    </div>
                                    {/* Action */}
                                    <div style={{ textAlign: "right" }}>
                                        <button onClick={() => isEditing ? handleCancelEdit() : handleEdit(product)}
                                            style={{
                                                background: isEditing ? T.redDim : hasCost ? T.bgGlass : T.yellowDim,
                                                border: `1px solid ${isEditing ? T.red + "30" : hasCost ? T.border : T.yellow + "30"}`,
                                                borderRadius: T.rSm, padding: "5px 10px", cursor: "pointer",
                                                color: isEditing ? T.red : hasCost ? T.textSec : T.yellow,
                                                fontSize: "0.72rem", fontWeight: 600, fontFamily: "inherit",
                                                transition: "all 0.2s",
                                            }}>
                                            {isEditing ? "✕" : hasCost ? "✏️" : "➕"}
                                        </button>
                                    </div>
                                </div>

                                {/* Inline Edit Form (desktop) */}
                                {isEditing && (
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: isTablet ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr auto",
                                        gap: "0.5rem", padding: "0.75rem 1rem",
                                        marginTop: 2, borderRadius: T.rSm,
                                        background: T.bgGlass, border: `1px solid ${T.accent}15`,
                                        alignItems: "end",
                                    }}>
                                        <LabeledInput label={`${t("cost.col_cost")} (₺)`} value={editForm.costPrice} onChange={v => setEditForm(p => ({ ...p, costPrice: v }))} />
                                        <LabeledInput label={`${t("cost.col_commission")} (%)`} value={editForm.commissionRate} onChange={v => setEditForm(p => ({ ...p, commissionRate: v }))} />
                                        <LabeledInput label={`${t("cost.col_shipping")} (₺)`} value={editForm.shippingCost} onChange={v => setEditForm(p => ({ ...p, shippingCost: v }))} />
                                        <LabeledInput label={`${t("cost.col_packaging")} (₺)`} value={editForm.packagingCost} onChange={v => setEditForm(p => ({ ...p, packagingCost: v }))} />
                                        <LabeledInput label={`${t("cost.col_other")} (₺)`} value={editForm.otherCost} onChange={v => setEditForm(p => ({ ...p, otherCost: v }))} />
                                        <div style={{ display: "flex", gap: "0.35rem", paddingBottom: 1 }}>
                                            <Btn color={T.green} variant="solid" size="sm" onClick={() => handleSave(product.barcode)} disabled={saving}>
                                                {saving ? "⏳" : "💾"} {t("common.save")}
                                            </Btn>
                                            <Btn color={T.textDim} variant="ghost" size="sm" onClick={handleCancelEdit}>
                                                {t("common.cancel")}
                                            </Btn>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Load More */}
                    {hasMore && (
                        <div style={{ textAlign: "center", padding: "0.75rem" }}>
                            <Btn color={T.accent} variant="ghost" onClick={() => setDisplayLimit(p => p + PAGE_SIZE)}>
                                ▼ {t("cost.load_more")} ({products.length - displayLimit} {t("cost.remaining")})
                            </Btn>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ HELP CARD ═══ */}
            <Card>
                <CardHeader icon="💡" title={t("cost.help_title")} subtitle={t("cost.help_subtitle")} color={T.blue} />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.75rem" }}>
                    {[
                        { icon: "🎯", title: t("cost.help_why_title"), desc: t("cost.help_why_desc") },
                        { icon: "📥", title: t("cost.help_csv_title"), desc: t("cost.help_csv_desc") },
                        { icon: "📝", title: t("cost.help_bulk_title"), desc: t("cost.help_bulk_desc") },
                        { icon: "🔄", title: t("cost.help_auto_title"), desc: t("cost.help_auto_desc") },
                    ].map((item, i) => (
                        <div key={i} style={{
                            padding: "0.85rem", borderRadius: T.rSm,
                            background: T.bgGlass, border: `1px solid ${T.border}`,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 6 }}>
                                <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: T.text }}>{item.title}</span>
                            </div>
                            <div style={{ fontSize: "0.76rem", color: T.textSec, lineHeight: 1.65 }}>{item.desc}</div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

/* ═══ HELPER COMPONENTS ═══ */

const MiniStat = ({ label, value, color = T.text }) => (
    <div>
        <div style={{ fontSize: "0.62rem", color: T.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color, fontFamily: T.fontMono }}>{value}</div>
    </div>
);

const LabeledInput = ({ label, value, onChange }) => (
    <div>
        <label style={{ display: "block", fontSize: "0.65rem", color: T.textDim, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {label}
        </label>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
            style={inlineInputStyle}
            aria-label={label}
        />
    </div>
);

const inlineInputStyle = {
    width: "100%",
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: T.rSm,
    padding: "7px 10px",
    color: T.text,
    fontSize: "0.82rem",
    fontFamily: T.fontMono,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
};

export default React.memo(BrainCosts);
