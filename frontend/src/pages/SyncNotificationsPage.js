import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBell, FaCheck, FaCheckDouble, FaFilter, FaSync,
    FaExclamationTriangle, FaInfoCircle, FaBoxOpen,
    FaExchangeAlt, FaShoppingCart, FaClock, FaTrash
} from "react-icons/fa";
import { getSyncLogs, getUnreadNotifications, markNotificationRead } from "../services/productManagementApi";
import "../styles/ProductManagementPages.css";

const ACTION_LABELS = {
    stock_update: { label: "Stok Güncelleme", icon: "📦", color: "#4ecdc4" },
    price_update: { label: "Fiyat Güncelleme", icon: "💰", color: "#f59e0b" },
    product_created: { label: "Ürün Oluşturma", icon: "🆕", color: "#22c55e" },
    product_synced: { label: "Ürün Senkronizasyonu", icon: "🔄", color: "#8b5cf6" },
    order_placed: { label: "Sipariş Verildi", icon: "🛒", color: "#ec4899" },
    auto_sync: { label: "Otomatik Senkronizasyon", icon: "⚡", color: "#06b6d4" },
    manual_sync: { label: "Manuel Senkronizasyon", icon: "🔧", color: "#64748b" },
    bulk_update: { label: "Toplu Güncelleme", icon: "📋", color: "#f97316" }
};

const PRIORITY_CONFIG = {
    critical: { label: "Kritik", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
    high: { label: "Yüksek", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
    medium: { label: "Orta", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.3)" },
    low: { label: "Düşük", color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)" }
};

const SyncNotificationsPage = ({ userId }) => {
    const [logs, setLogs] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [notifCounts, setNotifCounts] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("notifications"); // notifications, logs
    const [filterAction, setFilterAction] = useState("");
    const [filterPriority, setFilterPriority] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [page, setPage] = useState(0);
    const [totalLogs, setTotalLogs] = useState(0);

    const loadNotifications = useCallback(async () => {
        try {
            const data = await getUnreadNotifications();
            setNotifications(data.notifications || []);
            setNotifCounts(data.counts || { total: 0, critical: 0, high: 0, medium: 0, low: 0 });
        } catch (err) {
            console.error("Bildirimler yüklenemedi:", err);
        }
    }, []);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (filterAction) params.actionType = filterAction;
            if (filterPriority) params.priority = filterPriority;
            if (filterStatus) params.status = filterStatus;

            const data = await getSyncLogs(params);
            setLogs(data.logs || []);
            setTotalLogs(data.total || 0);
        } catch (err) {
            console.error("Loglar yüklenemedi:", err);
        } finally {
            setLoading(false);
        }
    }, [page, filterAction, filterPriority, filterStatus]);

    useEffect(() => { loadNotifications(); }, [loadNotifications]);
    useEffect(() => { loadLogs(); }, [loadLogs]);

    // Otomatik yenileme (10 saniyede bir)
    useEffect(() => {
        const interval = setInterval(() => {
            loadNotifications();
            if (activeTab === "logs") loadLogs();
        }, 10000);
        return () => clearInterval(interval);
    }, [loadNotifications, loadLogs, activeTab]);

    const handleMarkRead = async (id) => {
        try {
            await markNotificationRead(id);
            loadNotifications();
        } catch (err) {
            console.error("Bildirim okundu işaretlenemedi:", err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markNotificationRead("all");
            loadNotifications();
        } catch (err) {
            console.error("Bildirimler okundu işaretlenemedi:", err);
        }
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return "—";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return "Az önce";
        if (diffMin < 60) return `${diffMin} dk önce`;
        if (diffHour < 24) return `${diffHour} saat önce`;
        if (diffDay < 7) return `${diffDay} gün önce`;
        return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    };

    const renderNotificationsTab = () => (
        <div className="pm-notif-section">
            {/* Bildirim Sayaçları */}
            <div className="pm-notif-counters">
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <div key={key} className="pm-notif-counter" style={{ background: config.bg, borderColor: config.border }}>
                        <span className="pm-notif-counter-value" style={{ color: config.color }}>{notifCounts[key] || 0}</span>
                        <span className="pm-notif-counter-label">{config.label}</span>
                    </div>
                ))}
                <div className="pm-notif-counter" style={{ background: "rgba(78,205,196,0.1)", borderColor: "rgba(78,205,196,0.3)" }}>
                    <span className="pm-notif-counter-value" style={{ color: "#4ecdc4" }}>{notifCounts.total || 0}</span>
                    <span className="pm-notif-counter-label">Toplam</span>
                </div>
            </div>

            {/* Tümünü Okundu İşaretle */}
            {notifications.length > 0 && (
                <div className="pm-notif-actions">
                    <button className="pm-btn pm-btn-outline pm-btn-sm" onClick={handleMarkAllRead}>
                        <FaCheckDouble /> Tümünü Okundu İşaretle
                    </button>
                    <button className="pm-btn pm-btn-outline pm-btn-sm" onClick={loadNotifications}>
                        <FaSync /> Yenile
                    </button>
                </div>
            )}

            {/* Bildirim Listesi */}
            {notifications.length === 0 ? (
                <div className="pm-empty-state">
                    <FaBell style={{ fontSize: "3rem", color: "#4ecdc4" }} />
                    <h3>Okunmamış bildirim yok</h3>
                    <p>Tüm bildirimler okunmuş durumda.</p>
                </div>
            ) : (
                <div className="pm-notif-list">
                    {notifications.map((notif, idx) => {
                        const actionConfig = ACTION_LABELS[notif.actionType] || { label: notif.actionType, icon: "📌", color: "#64748b" };
                        const priorityConfig = PRIORITY_CONFIG[notif.notification?.priority] || PRIORITY_CONFIG.medium;

                        return (
                            <motion.div
                                key={notif._id}
                                className="pm-notif-item"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                style={{ borderLeftColor: priorityConfig.color }}
                            >
                                <div className="pm-notif-icon" style={{ background: priorityConfig.bg }}>
                                    <span>{actionConfig.icon}</span>
                                </div>
                                <div className="pm-notif-content">
                                    <div className="pm-notif-header">
                                        <span className="pm-notif-action" style={{ color: actionConfig.color }}>{actionConfig.label}</span>
                                        <span className="pm-notif-priority" style={{ background: priorityConfig.bg, color: priorityConfig.color, borderColor: priorityConfig.border }}>
                                            {priorityConfig.label}
                                        </span>
                                    </div>
                                    <div className="pm-notif-body">
                                        <strong>{notif.product?.name || notif.product?.barcode || "—"}</strong>
                                        {notif.changes?.field === "stock" && (
                                            <span className="pm-notif-change">
                                                Stok: {notif.changes.oldValue} → <strong>{notif.changes.newValue}</strong>
                                                {notif.changes.newValue === 0 && <span className="pm-notif-alert"> ⚠️ STOK BİTTİ</span>}
                                            </span>
                                        )}
                                        {notif.marketplace?.name && (
                                            <span className="pm-notif-mp">🏪 {notif.marketplace.name}</span>
                                        )}
                                        {notif.order?.orderNumber && (
                                            <span className="pm-notif-order">🛒 Sipariş: {notif.order.orderNumber}</span>
                                        )}
                                        {notif.affectedMarketplaces?.length > 0 && (
                                            <div className="pm-notif-affected">
                                                {notif.affectedMarketplaces.map((amp, i) => (
                                                    <span key={i} className={`pm-notif-affected-badge ${amp.syncStatus}`}>
                                                        {amp.syncStatus === "success" ? "✅" : amp.syncStatus === "error" ? "❌" : "⏳"} {amp.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="pm-notif-footer">
                                        <span className="pm-notif-time"><FaClock /> {formatTime(notif.timestamp)}</span>
                                        <button className="pm-btn-icon pm-btn-ghost" onClick={() => handleMarkRead(notif._id)} title="Okundu işaretle">
                                            <FaCheck />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderLogsTab = () => (
        <div className="pm-logs-section">
            {/* Filtreler */}
            <div className="pm-filters">
                <select className="pm-filter-select" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
                    <option value="">Tüm İşlemler</option>
                    {Object.entries(ACTION_LABELS).map(([key, config]) => (
                        <option key={key} value={key}>{config.icon} {config.label}</option>
                    ))}
                </select>
                <select className="pm-filter-select" value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(0); }}>
                    <option value="">Tüm Öncelikler</option>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>
                <select className="pm-filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}>
                    <option value="">Tüm Durumlar</option>
                    <option value="success">Başarılı</option>
                    <option value="error">Hata</option>
                    <option value="pending">Bekliyor</option>
                    <option value="partial">Kısmi</option>
                </select>
                <span className="pm-result-count">{totalLogs} log</span>
            </div>

            {/* Log Listesi */}
            {loading ? (
                <div className="pm-loading"><FaSync className="pm-spin" /> Loglar yükleniyor...</div>
            ) : logs.length === 0 ? (
                <div className="pm-empty-state">
                    <FaInfoCircle style={{ fontSize: "3rem", color: "#4ecdc4" }} />
                    <h3>Henüz log kaydı yok</h3>
                    <p>Senkronizasyon işlemleri başladığında loglar burada görünecek.</p>
                </div>
            ) : (
                <div className="pm-log-list">
                    {logs.map((log, idx) => {
                        const actionConfig = ACTION_LABELS[log.actionType] || { label: log.actionType, icon: "📌", color: "#64748b" };
                        return (
                            <motion.div
                                key={log._id}
                                className={`pm-log-item ${log.status}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.02 }}
                            >
                                <div className="pm-log-icon">{actionConfig.icon}</div>
                                <div className="pm-log-content">
                                    <div className="pm-log-header">
                                        <span style={{ color: actionConfig.color, fontWeight: 700 }}>{actionConfig.label}</span>
                                        <span className={`pm-log-status ${log.status}`}>
                                            {log.status === "success" ? "✅ Başarılı" : log.status === "error" ? "❌ Hata" : log.status === "partial" ? "⚠️ Kısmi" : "⏳ Bekliyor"}
                                        </span>
                                    </div>
                                    <div className="pm-log-body">
                                        <span>{log.product?.name || log.product?.barcode || "—"}</span>
                                        {log.marketplace?.name && <span className="pm-log-mp">🏪 {log.marketplace.name}</span>}
                                        {log.changes?.field === "stock" && (
                                            <span className="pm-log-change">
                                                {log.changes.oldValue} → {log.changes.newValue} ({log.changes.difference > 0 ? "+" : ""}{log.changes.difference})
                                            </span>
                                        )}
                                        {log.error?.message && <span className="pm-log-error">❌ {log.error.message}</span>}
                                    </div>
                                    <span className="pm-log-time">{formatTime(log.timestamp)}</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {Math.ceil(totalLogs / 30) > 1 && (
                <div className="pm-pagination">
                    <button className="pm-btn pm-btn-outline pm-btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</button>
                    <span className="pm-page-info">Sayfa {page + 1} / {Math.ceil(totalLogs / 30)}</span>
                    <button className="pm-btn pm-btn-outline pm-btn-sm" disabled={page >= Math.ceil(totalLogs / 30) - 1} onClick={() => setPage(p => p + 1)}>Sonraki →</button>
                </div>
            )}
        </div>
    );

    return (
        <div className="pm-page">
            <div className="pm-header">
                <h1 className="pm-title"><FaBell /> Senkronizasyon Bildirimleri & Loglar</h1>
                <p className="pm-subtitle">Tüm stok değişiklikleri, senkronizasyon işlemleri ve sistem bildirimleri burada görüntülenir.</p>
            </div>

            {/* Tabs */}
            <div className="pm-tabs">
                <button className={`pm-tab ${activeTab === "notifications" ? "active" : ""}`} onClick={() => setActiveTab("notifications")}>
                    <FaBell /> Bildirimler
                    {notifCounts.total > 0 && <span className="pm-tab-badge">{notifCounts.total}</span>}
                </button>
                <button className={`pm-tab ${activeTab === "logs" ? "active" : ""}`} onClick={() => setActiveTab("logs")}>
                    <FaInfoCircle /> Tüm Loglar
                </button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                    {activeTab === "notifications" && renderNotificationsTab()}
                    {activeTab === "logs" && renderLogsTab()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SyncNotificationsPage;
