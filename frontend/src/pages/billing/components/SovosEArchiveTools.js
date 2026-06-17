/**
 * Sovos e-Arşiv Araçları — rapor listesi / indirme (resmi API)
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaFileArchive, FaDownload, FaSpinner, FaSyncAlt } from "react-icons/fa";
import API from "../../../services/api";
import { colors, buttonSecondary } from "../styles";
import { GlassCard, AlertBox, SpinnerButton } from "./SharedUI";

const SovosEArchiveTools = ({ provider }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [downloadingId, setDownloadingId] = useState("");

    if (!provider || provider.authType !== "sovos") return null;

    const sessionId = provider.sessionId || provider.apiToken;
    const vkn = provider.vknTckn || provider.vkn || "";

    const fetchReports = async () => {
        setLoading(true);
        setError("");
        try {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const res = await API.post("/e-invoice/sovos/earchive/reports/list", {
                sessionId,
                token: sessionId,
                vkn,
                startDate: start.toISOString().split("T")[0],
                endDate: now.toISOString().split("T")[0],
            });
            if (res.data.success) {
                setReports(Array.isArray(res.data.data) ? res.data.data : (res.data.data?.reports || []));
            } else {
                setError(res.data.message || res.data.error || "Rapor listesi alınamadı");
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Rapor listesi hatası");
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = async (reportId) => {
        setDownloadingId(reportId);
        setError("");
        try {
            const res = await API.post(
                "/e-invoice/sovos/earchive/reports/download",
                { sessionId, token: sessionId, vkn, uuid: reportId, reportUuid: reportId },
                { responseType: "blob" }
            );
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = "earsiv-rapor-" + String(reportId).slice(0, 12) + ".zip";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Rapor indirilemedi");
        } finally {
            setDownloadingId("");
        }
    };

    return (
        <GlassCard style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <div>
                    <p style={{ color: colors.accent, fontSize: "0.78rem", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>
                        <FaFileArchive style={{ marginRight: 6 }} /> Sovos e-Arşiv Raporları
                    </p>
                    <p style={{ color: colors.dim, fontSize: "0.72rem", margin: "0.25rem 0 0" }}>
                        getReportList / getReportData — resmi e-Arşiv v2.3 API
                    </p>
                </div>
                <SpinnerButton
                    onClick={fetchReports}
                    loading={loading}
                    icon={<FaSyncAlt />}
                    label="Raporları Listele"
                    style={buttonSecondary}
                />
            </div>

            {error && <AlertBox type="error" message={error} style={{ marginBottom: "0.75rem" }} />}

            {reports.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {reports.map((row, idx) => {
                        const id = row.uuid || row.UUID || row.reportId || row.ReportId || ("rapor-" + idx);
                        const label = row.reportName || row.ReportName || row.periodCode || id;
                        return (
                            <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.55rem 0.65rem", background: colors.glass, borderRadius: 8, border: "1px solid " + colors.glassBr }}>
                                <span style={{ color: colors.text, fontSize: "0.78rem", fontWeight: 600 }}>{label}</span>
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => downloadReport(id)}
                                    disabled={!!downloadingId}
                                    style={{ ...buttonSecondary, padding: "0.35rem 0.65rem", fontSize: "0.72rem", opacity: downloadingId ? 0.6 : 1 }}
                                >
                                    {downloadingId === id ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaDownload />} İndir
                                </motion.button>
                            </div>
                        );
                    })}
                </div>
            )}
        </GlassCard>
    );
};

export default SovosEArchiveTools;
