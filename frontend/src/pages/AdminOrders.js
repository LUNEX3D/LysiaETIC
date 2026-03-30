import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaClipboardList } from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

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
            const matchesQuery = !q || order._id?.toLowerCase().includes(q) || order.customerName?.toLowerCase().includes(q);
            const matchesStatus = statusFilter === "all" || (order.status || "").toLowerCase() === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [orders, query, statusFilter]);

    const statusBadge = status => {
        const key = (status || "").toLowerCase();
        if (key.includes("hazir") || key.includes("preparing")) return "ap-badge ap-badge--blue";
        if (key.includes("kargo") || key.includes("shipped")) return "ap-badge ap-badge--yellow";
        if (key.includes("tamam") || key.includes("delivered")) return "ap-badge ap-badge--green";
        if (key.includes("iptal") || key.includes("cancel")) return "ap-badge ap-badge--red";
        return "ap-badge ap-badge--neutral";
    };

    return (
        <AdminLayout
            title="Sipariş Yönetimi"
            subtitle="Durum takibi ve operasyon görünümü"
            actions={
                <div className="ap-actions">
                    <button className="ap-btn ap-btn--ghost">Dışa Aktar</button>
                    <button className="ap-btn ap-btn--primary">Yeni İşlem</button>
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}
            {loading && <div className="ap-loading">Siparişler yükleniyor...</div>}

            {!loading && (
                <>
                    <div className="ap-toolbar">
                        <div className="ap-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Sipariş ID veya müşteri ara"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        <select className="ap-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">Tüm Durumlar</option>
                            <option value="hazirlaniyor">Hazırlanıyor</option>
                            <option value="kargoda">Kargoda</option>
                            <option value="tamamlandi">Tamamlandı</option>
                            <option value="iptal">İptal</option>
                        </select>
                        <div className="ap-toolbar-count">
                            <FaClipboardList style={{ marginRight: 4 }} />
                            {filteredOrders.length} sipariş
                        </div>
                    </div>

                    <div className="ap-table-wrap">
                        <table className="ap-table">
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
                                        <td style={{ fontWeight: 600 }}>{order.customerName || "Bilinmiyor"}</td>
                                        <td style={{ fontWeight: 600 }}>{order.total} TL</td>
                                        <td>
                                            <span className={statusBadge(order.status)}>
                                                {order.status || "Bilinmiyor"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredOrders.length === 0 && (
                            <div className="ap-empty">Sipariş bulunamadı.</div>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminOrders;
