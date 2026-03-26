import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaClipboardList } from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";
import "../styles/admin.css";

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await axios.get("/admin/orders", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                setOrders(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
                setError("Sipariş verileri alınamadı.");
                setOrders([]);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        const q = query.trim().toLowerCase();
        return orders.filter(order => {
            const matchesQuery =
                !q ||
                order._id?.toLowerCase().includes(q) ||
                order.customerName?.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === "all" ||
                (order.status || "").toLowerCase() === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [orders, query, statusFilter]);

    const statusClass = status => {
        const key = (status || "").toLowerCase();
        if (key.includes("hazir") || key.includes("preparing")) return "admin-pill admin-pill--info";
        if (key.includes("kargo") || key.includes("shipped")) return "admin-pill admin-pill--warn";
        if (key.includes("tamam") || key.includes("delivered")) return "admin-pill admin-pill--success";
        if (key.includes("iptal") || key.includes("cancel")) return "admin-pill admin-pill--danger";
        return "admin-pill admin-pill--neutral";
    };

    return (
        <AdminLayout
            title="Sipariş Yönetimi"
            subtitle="Durum takibi ve operasyon görünümü"
            actions={
                <div className="admin-action-row">
                    <button className="admin-btn admin-btn--ghost" type="button">
                        Dışa aktar
                    </button>
                    <button className="admin-btn admin-btn--primary" type="button">
                        Yeni işlem
                    </button>
                </div>
            }
        >
            {error && <div className="admin-alert admin-alert--error">{error}</div>}
            {loading && <div className="admin-loading">Siparişler yükleniyor...</div>}

            {!loading && (
                <>
                    <div className="admin-toolbar">
                        <div className="admin-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Sipariş ID veya müşteri ara"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        <div className="admin-filter">
                            <FaClipboardList />
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="all">Tüm durumlar</option>
                                <option value="hazirlaniyor">Hazırlanıyor</option>
                                <option value="kargoda">Kargoda</option>
                                <option value="tamamlandi">Tamamlandı</option>
                                <option value="iptal">İptal</option>
                            </select>
                        </div>
                        <div className="admin-toolbar-meta">
                            {filteredOrders.length} sipariş
                        </div>
                    </div>

                    <div className="admin-card admin-card--table">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Müşteri</th>
                                    <th>Tutar</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map(order => (
                                    <tr key={order._id}>
                                        <td className="mono">{order._id}</td>
                                        <td>{order.customerName || "Bilinmiyor"}</td>
                                        <td>{order.total} TL</td>
                                        <td>
                                            <span className={statusClass(order.status)}>
                                                {order.status || "Bilinmiyor"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredOrders.length === 0 && (
                            <div className="admin-empty">Sipariş bulunamadı.</div>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminOrders;