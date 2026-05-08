import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaCheckCircle,
    FaCloudUploadAlt,
    FaExclamationTriangle,
    FaFileExport,
    FaInfoCircle,
    FaRedo,
    FaServer,
    FaTrash,
} from "react-icons/fa";
import API from "../services/api";
import { clearClientErrors, getClientErrors, removeClientErrorsByIds } from "../services/clientErrorStore";

const serverRowToView = (row) => ({
    id: `srv-${row._id}`,
    fromServer: true,
    kind: "error",
    ts: row.createdAt || new Date().toISOString(),
    source: row.source || "api",
    statusCode: row.statusCode || 0,
    path: row.path || "",
    method: row.method || "GET",
    message: row.message || "",
    meta: row.meta || {},
});

const ErrorCenterPage = () => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    const [items, setItems] = useState(() => getClientErrors());
    const [filter, setFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sending, setSending] = useState(false);
    const [loadingServer, setLoadingServer] = useState(false);
    const [serverItems, setServerItems] = useState([]);
    const [info, setInfo] = useState("");

    const loadServer = useCallback(async () => {
        if (!userId) return;
        setLoadingServer(true);
        try {
            const { data } = await API.get("/client-errors/me", { params: { limit: 80 } });
            setServerItems(Array.isArray(data.errors) ? data.errors.map(serverRowToView) : []);
        } catch {
            setServerItems([]);
        } finally {
            setLoadingServer(false);
        }
    }, [userId]);

    useEffect(() => {
        const reload = () => setItems(getClientErrors());
        window.addEventListener("client-errors:changed", reload);
        return () => window.removeEventListener("client-errors:changed", reload);
    }, []);

    useEffect(() => {
        loadServer();
    }, [loadServer]);

    const merged = useMemo(() => {
        const seen = new Set();
        const out = [];
        const keyOf = (x) => {
            const t = new Date(x.ts).getTime();
            return `${x.kind}|${x.message}|${x.path}|${Math.floor(t / 5000)}`;
        };
        for (const x of [...items, ...serverItems]) {
            const k = keyOf(x);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(x);
        }
        return out.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    }, [items, serverItems]);

    const filtered = merged.filter((item) => {
        const kind = item.kind || "error";
        if (typeFilter === "errors" && kind !== "error") return false;
        if (typeFilter === "activity" && kind !== "activity") return false;
        if (filter === "all") return true;
        if (kind === "activity") return filter === "all" || filter === "network";
        if (filter === "4xx") return item.statusCode >= 400 && item.statusCode < 500;
        if (filter === "5xx") return item.statusCode >= 500;
        if (filter === "network") return !item.statusCode;
        return true;
    });

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hata-merkezi-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sendToServer = async () => {
        const toSend = filtered.filter((x) => !x.fromServer && (x.kind || "error") === "error");
        if (!toSend.length) return;
        setSending(true);
        setInfo("");
        try {
            const payload = toSend.map((x) => ({
                source: x.source,
                statusCode: x.statusCode,
                path: x.path,
                method: x.method,
                message: x.message,
                stack: x.stack || "",
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
                meta: { ...(x.meta || {}), kind: x.kind || "error", ts: x.ts },
            }));
            await API.post("/client-errors/bulk", { items: payload });
            removeClientErrorsByIds(toSend.map((x) => x.id));
            setItems(getClientErrors());
            await loadServer();
            setInfo(`${payload.length} kayıt sunucuya gönderildi (yalnızca sizin hesabınıza yazıldı).`);
        } catch (e) {
            setInfo(e.response?.data?.message || "Sunucuya gönderim başarısız.");
        } finally {
            setSending(false);
        }
    };

    const renderCard = (item) => {
        const kind = item.kind || "error";
        const isActivity = kind === "activity";
        const level = item.level || "info";
        const border = isActivity
            ? level === "success"
                ? "rgba(34,197,94,0.25)"
                : level === "warning"
                  ? "rgba(234,179,8,0.3)"
                  : "rgba(56,189,248,0.25)"
            : "rgba(248,113,113,0.2)";
        const titleColor = isActivity
            ? level === "success"
                ? "#4ade80"
                : level === "warning"
                  ? "#facc15"
                  : "#38bdf8"
            : "#f87171";

        return (
            <div
                key={item.id}
                style={{
                    border: `1px solid ${border}`,
                    background: "rgba(15,23,42,0.72)",
                    borderRadius: 12,
                    padding: 14,
                }}
            >
                <div style={{ color: titleColor, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {isActivity ? (
                        level === "success" ? (
                            <FaCheckCircle />
                        ) : level === "warning" ? (
                            <FaExclamationTriangle />
                        ) : (
                            <FaInfoCircle />
                        )
                    ) : (
                        <FaExclamationTriangle />
                    )}
                    {isActivity ? item.title || "İşlem" : item.statusCode ? `HTTP ${item.statusCode}` : "Hata / uyarı"}
                    {item.fromServer && (
                        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FaServer /> Sunucu
                        </span>
                    )}
                    {!item.fromServer && isActivity && (
                        <span style={{ fontSize: 11, opacity: 0.75 }}>Bu cihaz</span>
                    )}
                    {!item.fromServer && !isActivity && (
                        <span style={{ fontSize: 11, opacity: 0.75 }}>Bu cihaz</span>
                    )}
                </div>
                <div style={{ color: "#e2e8f0", marginTop: 6 }}>
                    {isActivity ? item.message : item.message}
                </div>
                {!isActivity && item.source && (
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>Kaynak: {item.source}</div>
                )}
                {isActivity && item.source && (
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>Kaynak: {item.source}</div>
                )}
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
                    {new Date(item.ts).toLocaleString("tr-TR")}
                    {!isActivity && (
                        <>
                            {" "}
                            • {item.method} {item.path}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const selectStyle = {
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: 8,
        padding: "7px 9px",
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div>
                    <h2 style={{ margin: 0, color: "#fff", fontSize: 22 }}>Hata ve işlem merkezi</h2>
                    <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 13, maxWidth: 720 }}>
                        Yalnızca oturumunuzdaki kullanıcıya ait kayıtlar listelenir. Bu cihazdaki günlük kullanıcı ID ile ayrılır; sunucuya
                        gönderdiğiniz kayıtlar hesabınıza özel saklanır.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => loadServer()}
                    disabled={loadingServer}
                    style={{
                        border: "1px solid rgba(148,163,184,0.35)",
                        background: "rgba(148,163,184,0.12)",
                        color: "#cbd5e1",
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <FaRedo /> {loadingServer ? "Yenileniyor..." : "Sunucudan yenile"}
                </button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
                    <option value="all">Tüm kayıtlar</option>
                    <option value="errors">Sadece hatalar</option>
                    <option value="activity">Son işlemler (başarı / bilgi)</option>
                </select>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} style={selectStyle}>
                    <option value="all">HTTP: tümü</option>
                    <option value="4xx">Sadece 4xx</option>
                    <option value="5xx">Sadece 5xx</option>
                    <option value="network">Ağ / timeout</option>
                </select>
                <button
                    type="button"
                    onClick={exportJson}
                    style={{
                        border: "1px solid rgba(148,163,184,0.35)",
                        background: "rgba(148,163,184,0.12)",
                        color: "#cbd5e1",
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <FaFileExport /> JSON
                </button>
                <button
                    type="button"
                    onClick={sendToServer}
                    disabled={sending || filtered.filter((x) => !x.fromServer && (x.kind || "error") === "error").length === 0}
                    style={{
                        border: "1px solid rgba(56,189,248,0.35)",
                        background: "rgba(56,189,248,0.12)",
                        color: "#38bdf8",
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        opacity: sending ? 0.6 : 1,
                    }}
                >
                    <FaCloudUploadAlt /> {sending ? "Gönderiliyor..." : "Sunucuya Gönder"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        clearClientErrors();
                        setItems([]);
                    }}
                    style={{
                        border: "1px solid rgba(248,113,113,0.35)",
                        background: "rgba(248,113,113,0.12)",
                        color: "#f87171",
                        borderRadius: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <FaTrash /> Bu cihaz günlüğünü temizle
                </button>
            </div>
            {info && <div style={{ marginBottom: 10, color: "#93c5fd", fontSize: 13 }}>{info}</div>}

            {filtered.length === 0 ? (
                <div style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 18, color: "#94a3b8" }}>
                    Şu an görüntülenecek kayıt yok. Ürün yükleme, pazaryeri API hataları ve başarılı işlemler zamanla burada birikir.
                </div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>{filtered.map(renderCard)}</div>
            )}
        </div>
    );
};

export default ErrorCenterPage;
