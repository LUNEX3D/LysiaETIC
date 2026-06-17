import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    FaInfoCircle,
    FaSearch,
    FaFilter,
    FaUpload,
    FaPlus,
    FaFileAlt,
    FaGlobe,
    FaChevronDown,
    FaTag,
} from "react-icons/fa";
import {
    fetchStore,
    fetchStoreOrders,
    fetchStoreOrderLabels,
    bulkUpdateStoreOrderLabels,
} from "../../../services/storeApi";
import OrderLabelPickerModal from "./OrderLabelPickerModal";
import {
    fmtTry,
    orderStatusBadgeClass,
    paymentStatusBadgeClass,
    salesChannelLabel,
    lineItemCount,
    ORDER_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
} from "./orderUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";

const PAGE_SIZE = 20;

const BULK_ACTIONS = [
    { id: "add", label: "Etiket Ekle" },
    { id: "replace", label: "Etiket Güncelle" },
    { id: "clear", label: "Etiket Sil" },
];

const EcommerceOrdersListPage = ({ onNavigate, draftMode = false, title = "Siparişler" }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [orders, setOrders] = useState([]);
    const [storeUrl, setStoreUrl] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(() => new Set());
    const [actionsOpen, setActionsOpen] = useState(false);
    const [labelModalOpen, setLabelModalOpen] = useState(false);
    const [bulkLabelMode, setBulkLabelMode] = useState("add");
    const [allLabels, setAllLabels] = useState([]);
    const [bulkSaving, setBulkSaving] = useState(false);
    const actionsRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [storeRes, orderRes] = await Promise.all([
                fetchStore().catch(() => ({})),
                fetchStoreOrders({ draft: draftMode ? "1" : "0" }),
            ]);
            setStoreUrl(storeRes.store?.publicUrl || storeRes.publicUrl || "");
            setOrders(orderRes.orders || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [draftMode]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPage(1);
        setSelected(new Set());
    }, [search, draftMode]);

    useEffect(() => {
        if (!actionsOpen) return undefined;
        const onDoc = (e) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target)) {
                setActionsOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [actionsOpen]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter(
            (o) =>
                String(o.orderNumber).toLowerCase().includes(q) ||
                o.customer?.name?.toLowerCase().includes(q) ||
                o.customer?.email?.toLowerCase().includes(q)
        );
    }, [orders, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    const toggleSelect = (id, e) => {
        e.stopPropagation();
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openOrder = (id) => onNavigate?.(`ec-order-${id}`);

    const openBulkLabels = async (mode) => {
        setBulkLabelMode(mode);
        setActionsOpen(false);
        if (mode === "clear") {
            if (!window.confirm("Seçili siparişlerdeki tüm etiketler kaldırılsın mı?")) return;
            setBulkSaving(true);
            try {
                await bulkUpdateStoreOrderLabels({
                    orderIds: [...selected],
                    labelIds: [],
                    mode: "clear",
                });
                setSelected(new Set());
                load();
            } catch (e) {
                setError(e.response?.data?.error || "Etiketler silinemedi");
            } finally {
                setBulkSaving(false);
            }
            return;
        }
        try {
            const res = await fetchStoreOrderLabels();
            setAllLabels(res.labels || []);
        } catch {
            setAllLabels([]);
        }
        setLabelModalOpen(true);
    };

    const saveBulkLabels = async (labelIds) => {
        setBulkSaving(true);
        try {
            await bulkUpdateStoreOrderLabels({
                orderIds: [...selected],
                labelIds,
                mode: bulkLabelMode,
            });
            setLabelModalOpen(false);
            setSelected(new Set());
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Etiketler kaydedilemedi");
        } finally {
            setBulkSaving(false);
        }
    };

    const modalTitle =
        bulkLabelMode === "replace" ? "Etiket Güncelle" : "Etiket Ekle";

    if (loading && !orders.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-orders-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        {title} <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {!draftMode && (
                            <button type="button" className="ec-prod-btn" disabled title="Yakında">
                                <FaUpload /> Dışa Aktar
                            </button>
                        )}
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => onNavigate?.("ec-order-create")}
                        >
                            <FaPlus /> Sipariş Oluştur
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="ec-purchase-form-error" style={{ margin: 0 }}>
                        {error}
                    </div>
                )}

                <div className="ec-orders-toolbar">
                    <div className="ec-orders-toolbar__left">
                        <input
                            type="checkbox"
                            className="ec-orders-toolbar__master"
                            aria-label="Sayfadaki tümünü seç"
                            checked={
                                paged.length > 0 && paged.every((o) => selected.has(String(o._id)))
                            }
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setSelected(new Set(paged.map((o) => String(o._id))));
                                } else setSelected(new Set());
                            }}
                        />
                        {selected.size > 0 && (
                            <>
                                <span className="ec-orders-toolbar__sel">
                                    {selected.size} Sipariş seçildi
                                </span>
                                <div className="ec-orders-actions" ref={actionsRef}>
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-orders-actions__btn"
                                        disabled={bulkSaving}
                                        onClick={() => setActionsOpen((o) => !o)}
                                    >
                                        Aksiyonlar <FaChevronDown />
                                    </button>
                                    {actionsOpen && (
                                        <ul className="ec-orders-actions__menu" role="menu">
                                            {BULK_ACTIONS.map((a) => (
                                                <li key={a.id}>
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => openBulkLabels(a.id)}
                                                    >
                                                        <FaTag /> {a.label}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <label className="ec-orders-search">
                        <FaSearch />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tabloda arama yapın"
                        />
                    </label>
                    <button type="button" className="ec-prod-btn" disabled title="Yakında">
                        <FaFilter /> Filtre
                    </button>
                </div>

                <div className="ec-orders-table-wrap">
                    {paged.length === 0 ? (
                        <div className="ec-orders-empty">
                            <h2>{draftMode ? "Taslak sipariş yok" : "Sipariş bulunamadı"}</h2>
                            <p>
                                {draftMode
                                    ? "Sipariş oluştururken taslak olarak kaydedilen siparişler burada listelenir."
                                    : "Henüz sipariş yok veya arama kriterlerinize uygun sonuç bulunamadı."}
                            </p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                style={{ marginTop: "1rem" }}
                                onClick={() => onNavigate?.("ec-order-create")}
                            >
                                Sipariş Oluştur
                            </button>
                        </div>
                    ) : (
                        <table className="ec-orders-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }} />
                                    <th>Sipariş</th>
                                    <th>Tarih</th>
                                    <th>Müşteri</th>
                                    <th>Sipariş Durumu</th>
                                    {!draftMode && <th>Ödeme Durumu</th>}
                                    <th>Toplam Tutar</th>
                                    {!draftMode && <th>Satış Kanalı</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((o) => {
                                    const id = String(o._id);
                                    const d = new Date(o.createdAt);
                                    const dateStr = d.toLocaleDateString("tr-TR", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    });
                                    const timeStr = d.toLocaleTimeString("tr-TR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    });
                                    const channel = salesChannelLabel(o, storeUrl);
                                    const isManual = o.source === "manual";
                                    const isDraft = draftMode || o.isDraft;
                                    return (
                                        <tr key={id} onClick={() => openOrder(id)}>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(id)}
                                                    onChange={(e) => toggleSelect(id, e)}
                                                />
                                            </td>
                                            <td>
                                                <span className="ec-orders-table__order-no">
                                                    {o.orderNumber}
                                                </span>
                                            </td>
                                            <td className="ec-orders-table__date">
                                                {dateStr}
                                                <small>{timeStr}</small>
                                            </td>
                                            <td className="ec-orders-table__customer">
                                                <strong>{o.customer?.name || "—"}</strong>
                                                <small>{o.customer?.email || ""}</small>
                                            </td>
                                            <td>
                                                {isDraft ? (
                                                    <span className="ec-order-badge ec-order-badge--default">
                                                        Taslak
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`ec-order-badge ${orderStatusBadgeClass(o.status)}`}
                                                    >
                                                        {ORDER_STATUS_LABELS[o.status] || o.status}
                                                    </span>
                                                )}
                                            </td>
                                            {!draftMode && (
                                                <td>
                                                    <span
                                                        className={`ec-order-badge ${paymentStatusBadgeClass(o.payment?.status)}`}
                                                    >
                                                        {PAYMENT_STATUS_LABELS[o.payment?.status] ||
                                                            o.payment?.status}
                                                    </span>
                                                </td>
                                            )}
                                            <td>
                                                {fmtTry(o.total)}
                                                <br />
                                                <small style={{ opacity: 0.75 }}>
                                                    {lineItemCount(o)} ürün
                                                </small>
                                            </td>
                                            {!draftMode && (
                                                <td className="ec-orders-table__channel">
                                                    {isManual ? (
                                                        <FaFileAlt style={{ marginRight: 4 }} />
                                                    ) : (
                                                        <FaGlobe style={{ marginRight: 4 }} />
                                                    )}
                                                    {channel}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {paged.length > 0 && (
                    <footer className="ec-orders-foot">
                        <span>
                            {filtered.length ? pageStart + 1 : 0} –{" "}
                            {Math.min(pageStart + PAGE_SIZE, filtered.length)} / {filtered.length}{" "}
                            {draftMode ? "Sipariş" : "Sipariş"}
                        </span>
                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Önceki
                            </button>
                            <span>{safePage}</span>
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Sonraki
                            </button>
                        </div>
                    </footer>
                )}
            </div>

            <OrderLabelPickerModal
                open={labelModalOpen}
                title={modalTitle}
                onClose={() => setLabelModalOpen(false)}
                labels={allLabels}
                selectedIds={bulkLabelMode === "replace" ? [] : []}
                onSave={saveBulkLabels}
                saving={bulkSaving}
                onLabelCreated={(label) => {
                    setAllLabels((prev) => {
                        if (prev.some((l) => String(l._id) === String(label._id))) return prev;
                        return [...prev, label].sort((a, b) =>
                            (a.name || "").localeCompare(b.name || "", "tr")
                        );
                    });
                }}
            />
        </div>
    );
};

export default EcommerceOrdersListPage;
