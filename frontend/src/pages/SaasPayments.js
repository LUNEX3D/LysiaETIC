import React, { useEffect, useState } from "react";
import { FaCreditCard, FaSearch, FaCheckCircle, FaTimesCircle, FaClock, FaUndo } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getPayments, updatePaymentStatus } from "../services/saasAdminApi";

const SaasPayments = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    useEffect(() => { loadPayments(); }, []);

    const loadPayments = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getPayments();
            setPayments(res.data.payments || []);
        } catch (err) {
            console.error(err);
            setError("Ödemeler alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id, status) => {
        if (!window.confirm(`Ödeme durumunu "${status}" olarak değiştirmek istediğinize emin misiniz?`)) return;
        setLoading(true);
        try {
            await updatePaymentStatus(id, status);
            loadPayments();
        } catch (err) {
            alert("İşlem başarısız: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const filtered = payments.filter(p => {
        const matchSearch = !search || p.userId?.name?.toLowerCase().includes(search.toLowerCase()) || p.invoiceNumber?.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "all" || p.status === filter;
        return matchSearch && matchFilter;
    });

    const statusLabels = { pending: "Bekliyor", completed: "Tamamlandı", failed: "Başarısız", refunded: "İade Edildi" };
    const statusColors = { pending: "yellow", completed: "green", failed: "red", refunded: "cyan" };
    const fmtMoney = (n, cur) => (cur || "TRY") === "TRY" ? `₺${n?.toLocaleString("tr-TR") || 0}` : `${n || 0} ${cur}`;

    return (
        <AdminLayout
            title="Ödeme & Faturalandırma"
            subtitle="Tüm ödemeleri görüntüle ve yönet"
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}

            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Kullanıcı veya fatura no ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">Tüm Ödemeler</option>
                        <option value="completed">Tamamlandı</option>
                        <option value="pending">Bekliyor</option>
                        <option value="failed">Başarısız</option>
                        <option value="refunded">İade Edildi</option>
                    </select>
                    <span className="ap-toolbar-count">{filtered.length} ödeme</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Kullanıcı</th>
                                    <th>Fatura No</th>
                                    <th>Tutar</th>
                                    <th>Durum</th>
                                    <th>Yöntem</th>
                                    <th>Tarih</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(payment => (
                                    <tr key={payment._id}>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{payment.userId?.name || "—"}</div>
                                                <div className="mono" style={{ fontSize: 11 }}>{payment.userId?.email || "—"}</div>
                                            </div>
                                        </td>
                                        <td className="mono">{payment.invoiceNumber || "—"}</td>
                                        <td style={{ fontWeight: 700 }}>{fmtMoney(payment.amount, payment.currency)}</td>
                                        <td>
                                            <span className={`ap-badge ap-badge--${statusColors[payment.status]}`}>
                                                {statusLabels[payment.status] || payment.status}
                                            </span>
                                        </td>
                                        <td>{payment.paymentMethod || "—"}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>
                                            {new Date(payment.createdAt).toLocaleString("tr-TR")}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                {payment.status === "pending" && (
                                                    <button
                                                        className="ap-btn ap-btn--sm"
                                                        style={{ background: "var(--ap-green-soft)", color: "var(--ap-green)" }}
                                                        onClick={() => handleStatusChange(payment._id, "completed")}
                                                    >
                                                        <FaCheckCircle /> Onayla
                                                    </button>
                                                )}
                                                {payment.status === "completed" && (
                                                    <button
                                                        className="ap-btn ap-btn--sm"
                                                        style={{ background: "var(--ap-cyan-soft)", color: "var(--ap-cyan)" }}
                                                        onClick={() => handleStatusChange(payment._id, "refunded")}
                                                    >
                                                        <FaUndo /> İade
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default SaasPayments;
