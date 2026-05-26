import React, { useEffect, useState } from "react";

import { FaCreditCard, FaSearch, FaCheckCircle, FaUndo } from "react-icons/fa";

import AdminLayout from "../components/AdminLayout";

import { getPayments, updatePaymentStatus, refundPayment } from "../services/saasAdminApi";



const SaasPayments = () => {

    const [payments, setPayments] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [filter, setFilter] = useState("all");

    const [refundModal, setRefundModal] = useState(null);



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



    const handleApprove = async (id) => {

        if (!window.confirm("Ödemeyi onaylayıp aboneliği aktifleştirmek istiyor musunuz?")) return;

        setLoading(true);

        try {

            const res = await updatePaymentStatus(id, "completed");

            if (res.data?.subscriptionActivated) {

                alert("Ödeme onaylandı ve abonelik aktifleştirildi.");

            }

            loadPayments();

        } catch (err) {

            alert("İşlem başarısız: " + (err.response?.data?.message || err.message));

        } finally {

            setLoading(false);

        }

    };



    const openRefundModal = (payment) => {

        const already = Number(payment.metadata?.refundedTotal) || 0;

        const max = Math.max(0, Math.round((Number(payment.amount) - already) * 100) / 100);

        setRefundModal({

            payment,

            maxRefund: max,

            returnAmount: String(max),

            refundReason: "",

            referenceNo: "",

            deactivateSubscription: true,

        });

    };



    const submitRefund = async () => {

        if (!refundModal) return;

        const { payment, returnAmount, refundReason, referenceNo, deactivateSubscription, maxRefund } = refundModal;

        const amount = parseFloat(String(returnAmount).replace(",", "."));

        if (!Number.isFinite(amount) || amount <= 0 || amount > maxRefund + 0.001) {

            alert(`İade tutarı 0 ile ${maxRefund} TL arasında olmalı.`);

            return;

        }

        if (!window.confirm(`${amount} TL iade PayTR üzerinden yapılacak. Onaylıyor musunuz?`)) return;



        setLoading(true);

        try {

            const res = await refundPayment(payment._id, {

                returnAmount: amount,

                refundReason: refundReason || undefined,

                referenceNo: referenceNo || undefined,

                deactivateSubscription,

            });

            const msg = res.data?.message || "İade tamamlandı";

            const extra = res.data?.subscriptionDeactivated ? "\nAbonelik sonlandırıldı." : "";

            alert(msg + extra);

            setRefundModal(null);

            loadPayments();

        } catch (err) {

            const paytrMsg = err.response?.data?.paytr?.errMsg;

            alert(

                (err.response?.data?.message || err.message)

                + (paytrMsg ? `\n\nPayTR: ${paytrMsg}` : "")

            );

        } finally {

            setLoading(false);

        }

    };



    const filtered = payments.filter(p => {

        const matchSearch = !search || p.userId?.name?.toLowerCase().includes(search.toLowerCase()) || p.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) || p.transactionId?.toLowerCase().includes(search.toLowerCase());

        const matchFilter = filter === "all" || p.status === filter;

        return matchSearch && matchFilter;

    });



    const statusLabels = { pending: "Bekliyor", completed: "Tamamlandı", failed: "Başarısız", refunded: "İade", processing: "İşleniyor" };

    const statusColors = { pending: "yellow", completed: "green", failed: "red", refunded: "cyan", processing: "yellow" };

    const fmtMoney = (n, cur) => (cur || "TRY") === "TRY" ? `₺${Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${n || 0} ${cur}`;



    const canRefund = (p) => {

        if (p.status !== "completed") return false;

        const already = Number(p.metadata?.refundedTotal) || 0;

        return Number(p.amount) - already > 0.01;

    };



    return (

        <AdminLayout

            title="Ödeme & Faturalandırma"

            subtitle="PayTR iade API ile ödeme yönetimi"

        >

            {error && <div className="ap-alert ap-alert--error">{error}</div>}



            <div className="ap-card">

                <div className="ap-toolbar">

                    <div className="ap-search">

                        <FaSearch />

                        <input

                            type="text"

                            placeholder="Kullanıcı, fatura veya sipariş no..."

                            value={search}

                            onChange={(e) => setSearch(e.target.value)}

                        />

                    </div>

                    <select className="ap-select" value={filter} onChange={(e) => setFilter(e.target.value)}>

                        <option value="all">Tüm Ödemeler</option>

                        <option value="completed">Tamamlandı</option>

                        <option value="pending">Bekliyor</option>

                        <option value="failed">Başarısız</option>

                        <option value="refunded">İade</option>

                    </select>

                    <span className="ap-toolbar-count">{filtered.length} ödeme</span>

                </div>

            </div>



            {loading && !refundModal && <div className="ap-loading">Yükleniyor...</div>}



            {!loading && filtered.length > 0 && (

                <div className="ap-card">

                    <div className="ap-table-wrap">

                        <table className="ap-table">

                            <thead>

                                <tr>

                                    <th>Kullanıcı</th>

                                    <th>Sipariş / Fatura</th>

                                    <th>Tutar</th>

                                    <th>Durum</th>

                                    <th>Yöntem</th>

                                    <th>Tarih</th>

                                    <th>İşlemler</th>

                                </tr>

                            </thead>

                            <tbody>

                                {filtered.map(payment => {

                                    const refundedTotal = Number(payment.metadata?.refundedTotal) || 0;

                                    return (

                                    <tr key={payment._id}>

                                        <td>

                                            <div>

                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{payment.userId?.name || "—"}</div>

                                                <div className="mono" style={{ fontSize: 11 }}>{payment.userId?.email || "—"}</div>

                                            </div>

                                        </td>

                                        <td>

                                            <div className="mono" style={{ fontSize: 11 }}>

                                                {payment.transactionId || "—"}

                                            </div>

                                            <div style={{ fontSize: 11, color: "var(--ap-muted)" }}>

                                                {payment.invoiceNumber || ""}

                                            </div>

                                        </td>

                                        <td>

                                            <div style={{ fontWeight: 700 }}>{fmtMoney(payment.amount, payment.currency)}</div>

                                            {refundedTotal > 0 && (

                                                <div style={{ fontSize: 11, color: "var(--ap-cyan)" }}>

                                                    İade: {fmtMoney(refundedTotal, payment.currency)}

                                                </div>

                                            )}

                                        </td>

                                        <td>

                                            <span className={`ap-badge ap-badge--${statusColors[payment.status] || "yellow"}`}>

                                                {statusLabels[payment.status] || payment.status}

                                            </span>

                                        </td>

                                        <td>{payment.paymentMethod || "—"}</td>

                                        <td className="mono" style={{ fontSize: 11 }}>

                                            {new Date(payment.createdAt).toLocaleString("tr-TR")}

                                        </td>

                                        <td>

                                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>

                                                {payment.status === "pending"
                                                    && payment.paymentMethod !== "paytr" && (

                                                    <button

                                                        type="button"

                                                        className="ap-btn ap-btn--sm"

                                                        style={{ background: "var(--ap-green-soft)", color: "var(--ap-green)" }}

                                                        onClick={() => handleApprove(payment._id)}

                                                    >

                                                        <FaCheckCircle /> Onayla

                                                    </button>

                                                )}

                                                {payment.paymentMethod === "paytr"
                                                    && ["pending", "processing"].includes(payment.status) && (

                                                    <span

                                                        style={{ fontSize: 11, color: "var(--ap-text-muted)" }}

                                                        title="PayTR başarılı ödemede paket kullanıcıda otomatik açılır"

                                                    >

                                                        PayTR — otomatik

                                                    </span>

                                                )}

                                                {canRefund(payment) && (

                                                    <button

                                                        type="button"

                                                        className="ap-btn ap-btn--sm"

                                                        style={{ background: "var(--ap-cyan-soft)", color: "var(--ap-cyan)" }}

                                                        onClick={() => openRefundModal(payment)}

                                                    >

                                                        <FaUndo /> PayTR İade

                                                    </button>

                                                )}

                                            </div>

                                        </td>

                                    </tr>

                                    );

                                })}

                            </tbody>

                        </table>

                    </div>

                </div>

            )}



            {refundModal && (

                <div

                    role="dialog"

                    aria-modal="true"

                    style={{

                        position: "fixed",

                        inset: 0,

                        background: "rgba(0,0,0,0.65)",

                        display: "flex",

                        alignItems: "center",

                        justifyContent: "center",

                        zIndex: 10000,

                        padding: 16,

                    }}

                    onClick={() => setRefundModal(null)}

                >

                    <div

                        className="ap-card"

                        style={{ maxWidth: 440, width: "100%", padding: 24 }}

                        onClick={(e) => e.stopPropagation()}

                    >

                        <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>PayTR İade</h3>

                        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ap-muted)" }}>

                            Sipariş: <code>{refundModal.payment.transactionId}</code>

                            <br />

                            Maks. iade: <strong>{fmtMoney(refundModal.maxRefund)}</strong>

                        </p>



                        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>İade tutarı (TL)</label>

                        <input

                            type="text"

                            className="ap-input"

                            style={{ width: "100%", marginBottom: 12 }}

                            value={refundModal.returnAmount}

                            onChange={(e) => setRefundModal((m) => ({ ...m, returnAmount: e.target.value }))}

                        />



                        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>İade nedeni (isteğe bağlı)</label>

                        <input

                            type="text"

                            className="ap-input"

                            style={{ width: "100%", marginBottom: 12 }}

                            value={refundModal.refundReason}

                            onChange={(e) => setRefundModal((m) => ({ ...m, refundReason: e.target.value }))}

                            placeholder="Müşteri talebi, hatalı tahsilat..."

                        />



                        <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Referans no (isteğe bağlı)</label>

                        <input

                            type="text"

                            className="ap-input"

                            style={{ width: "100%", marginBottom: 12 }}

                            value={refundModal.referenceNo}

                            onChange={(e) => setRefundModal((m) => ({ ...m, referenceNo: e.target.value }))}

                            placeholder="PayTR durum sorguda döner"

                        />



                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16 }}>

                            <input

                                type="checkbox"

                                checked={refundModal.deactivateSubscription}

                                onChange={(e) => setRefundModal((m) => ({ ...m, deactivateSubscription: e.target.checked }))}

                            />

                            Tam iade sonrası kullanıcı aboneliğini sonlandır

                        </label>



                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>

                            <button type="button" className="ap-btn" onClick={() => setRefundModal(null)}>

                                Vazgeç

                            </button>

                            <button

                                type="button"

                                className="ap-btn"

                                style={{ background: "var(--ap-cyan)", color: "#0f172a" }}

                                onClick={submitRefund}

                                disabled={loading}

                            >

                                <FaUndo /> İade gönder

                            </button>

                        </div>

                    </div>

                </div>

            )}

        </AdminLayout>

    );

};



export default SaasPayments;


