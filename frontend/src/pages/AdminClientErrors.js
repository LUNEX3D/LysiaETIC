import React, { useEffect, useState } from "react";
import { FaBug, FaExclamationTriangle, FaFileExport, FaSearch, FaSync } from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import { getClientErrorsAdmin } from "../services/saasAdminApi";

const AdminClientErrors = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [userFilter, setUserFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [datePreset, setDatePreset] = useState("all");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const params = { limit: 300 };
            if (statusFilter !== "all") params.statusCode = Number(statusFilter);
            if (sourceFilter !== "all") params.source = sourceFilter;
            if (userFilter !== "all") params.userId = userFilter;
            if (fromDate) params.from = `${fromDate}T00:00:00.000Z`;
            if (toDate) params.to = `${toDate}T23:59:59.999Z`;
            const res = await getClientErrorsAdmin(params);
            setRows(res.data?.errors || []);
        } catch (e) {
            setError(e.response?.data?.message || "İstemci hata kayıtları alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [statusFilter, sourceFilter, userFilter, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = rows.filter((r) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            String(r.message || "").toLowerCase().includes(q) ||
            String(r.path || "").toLowerCase().includes(q) ||
            String(r.method || "").toLowerCase().includes(q) ||
            String(r.userId?.email || "").toLowerCase().includes(q) ||
            String(r.userId?.name || "").toLowerCase().includes(q)
        );
    });

    const userOptions = rows.reduce((acc, r) => {
        if (!r.userId?._id) return acc;
        if (!acc.some((x) => x._id === r.userId._id)) {
            acc.push({
                _id: r.userId._id,
                label: `${r.userId.name || "-"} / ${r.userId.email || "-"}`,
            });
        }
        return acc;
    }, []);

    const exportCsv = () => {
        const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
        const header = ["Tarih", "Status", "Source", "Method", "Path", "Message", "UserName", "UserEmail"];
        const lines = filtered.map((r) => ([
            new Date(r.createdAt).toLocaleString("tr-TR"),
            r.statusCode || "",
            r.source || "",
            r.method || "",
            r.path || "",
            r.message || "",
            r.userId?.name || "",
            r.userId?.email || "",
        ].map(escapeCsv).join(",")));
        const csv = [header.join(","), ...lines].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `istemci-hata-kayitlari-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const applyDatePreset = (preset) => {
        setDatePreset(preset);
        if (preset === "all") {
            setFromDate("");
            setToDate("");
            return;
        }

        const now = new Date();
        const to = now.toISOString().slice(0, 10);
        let fromDateObj = new Date(now);

        if (preset === "today") {
            fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (preset === "24h") {
            fromDateObj = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        } else if (preset === "7d") {
            fromDateObj = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (preset === "30d") {
            fromDateObj = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        }

        setFromDate(fromDateObj.toISOString().slice(0, 10));
        setToDate(to);
    };

    return (
        <AdminLayout
            title="İstemci Hata Kayıtları"
            subtitle="Kullanıcılardan gelen frontend hata/uyarı kayıtlarını inceleyin"
            actions={
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="ap-btn ap-btn--ghost" onClick={exportCsv} disabled={loading || !filtered.length}>
                        <FaFileExport /> CSV
                    </button>
                    <button className="ap-btn ap-btn--ghost" onClick={load} disabled={loading}>
                        <FaSync /> Yenile
                    </button>
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error"><FaExclamationTriangle /> {error}</div>}

            <div className="ap-card">
                <div className="ap-toolbar">
                    <div className="ap-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Mesaj, endpoint, kullanıcı ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="ap-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Tüm Status</option>
                        <option value="400">400</option>
                        <option value="401">401</option>
                        <option value="403">403</option>
                        <option value="404">404</option>
                        <option value="429">429</option>
                        <option value="500">500</option>
                        <option value="502">502</option>
                        <option value="503">503</option>
                    </select>
                    <select className="ap-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                        <option value="all">Tüm Kaynaklar</option>
                        <option value="api">api</option>
                        <option value="frontend">frontend</option>
                    </select>
                    <select className="ap-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                        <option value="all">Tüm Kullanıcılar</option>
                        {userOptions.map((u) => (
                            <option key={u._id} value={u._id}>{u.label}</option>
                        ))}
                    </select>
                    <select className="ap-select" value={datePreset} onChange={(e) => applyDatePreset(e.target.value)}>
                        <option value="all">Tüm Tarihler</option>
                        <option value="today">Bugün</option>
                        <option value="24h">Son 24 Saat</option>
                        <option value="7d">Son 7 Gün</option>
                        <option value="30d">Son 30 Gün</option>
                    </select>
                    <input className="ap-select" type="date" value={fromDate} onChange={(e) => { setDatePreset("all"); setFromDate(e.target.value); }} />
                    <input className="ap-select" type="date" value={toDate} onChange={(e) => { setDatePreset("all"); setToDate(e.target.value); }} />
                    <span className="ap-toolbar-count">{filtered.length} kayıt</span>
                </div>
            </div>

            {loading && <div className="ap-loading">Yükleniyor...</div>}

            {!loading && filtered.length === 0 && (
                <div className="ap-card"><div className="ap-empty"><FaBug /> Kayıt bulunamadı.</div></div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="ap-card">
                    <div className="ap-terminal" style={{ maxHeight: "none" }}>
                        {filtered.map((r) => (
                            <div key={r._id} className="ap-log-line">
                                <span className="ap-log-time">{new Date(r.createdAt).toLocaleString("tr-TR")}</span>
                                <span className={`ap-badge ap-badge--${r.statusCode >= 500 ? "red" : r.statusCode >= 400 ? "yellow" : "neutral"}`} style={{ fontSize: 10, padding: "2px 8px" }}>
                                    {r.statusCode || "N/A"}
                                </span>
                                <span className="ap-log-msg" style={{ flex: 1 }}>
                                    <strong style={{ color: "var(--ap-text2)" }}>{r.method} {r.path || "/"}</strong>
                                    <span style={{ marginLeft: 8, color: "var(--ap-muted)" }}>— {r.message}</span>
                                </span>
                                <span style={{ fontSize: 11, color: "var(--ap-muted)" }}>
                                    {(r.userId?.name || "-")} / {(r.userId?.email || "-")}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminClientErrors;
