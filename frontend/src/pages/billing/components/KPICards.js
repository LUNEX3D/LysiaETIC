/**
 * KPI Kartları — Genel Bakış İstatistikleri
 * LysiaETIC
 */
import React from "react";
import { motion } from "framer-motion";
import {
    FaFileInvoice, FaMoneyBillWave, FaClock,
    FaClipboardList, FaFileInvoiceDollar, FaTruck,
} from "react-icons/fa";
import { colors, kpiCardStyle } from "../styles";
import { fmtCurrency } from "../utils";

const KPICards = ({ stats }) => {
    const cards = [
        {
            icon: <FaFileInvoice />,
            label: "Toplam Belge",
            value: stats.totalInvoices,
            sub: stats.totalInvoices === 0 ? "Henüz belge yok" : stats.totalInvoices + " İadet belge",
            color: colors.accent,
        },
        {
            icon: <FaMoneyBillWave />,
            label: "Toplam Tutar",
            value: fmtCurrency(stats.totalAmount),
            sub: "KDV dahil toplam",
            color: colors.green,
        },
        {
            icon: <FaClock />,
            label: "Bekleyen",
            value: stats.pendingCount,
            sub: stats.pendingCount === 0 ? "Bekleyen belge yok" : "Onay bekliyor",
            color: colors.yellow,
        },
        {
            icon: <FaClipboardList />,
            label: "e-Arşiv",
            value: stats.eArchiveCount,
            sub: stats.eArchiveCount === 0 ? "Henüz e-Arşiv yok" : stats.eArchiveCount + " belge",
            color: colors.blue,
        },
        {
            icon: <FaFileInvoiceDollar />,
            label: "e-Fatura",
            value: stats.eInvoiceCount,
            sub: stats.eInvoiceCount === 0 ? "Henüz e-Fatura yok" : stats.eInvoiceCount + " belge",
            color: colors.orange,
        },
        {
            icon: <FaTruck />,
            label: "e-İrsaliye",
            value: stats.eDespatchCount,
            sub: stats.eDespatchCount === 0 ? "Henüz e-İrsaliye yok" : stats.eDespatchCount + " belge",
            color: colors.pink,
        },
    ];

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
            }}
        >
            {cards.map((kpi, i) => (
                <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -3, boxShadow: "0 12px 32px " + kpi.color + "25" }}
                    style={kpiCardStyle(kpi.color)}
                >
                    {/* Glow efekti */}
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            width: 100,
                            height: 100,
                            background: "radial-gradient(circle, " + kpi.color + "12 0%, transparent 70%)",
                            pointerEvents: "none",
                        }}
                    />
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            marginBottom: "0.6rem",
                        }}
                    >
                        <div
                            style={{
                                background: kpi.color + "20",
                                padding: "0.5rem",
                                borderRadius: 10,
                                fontSize: "1.1rem",
                                display: "flex",
                                color: kpi.color,
                            }}
                        >
                            {kpi.icon}
                        </div>
                        <span style={{ color: colors.muted, fontSize: "0.78rem", fontWeight: 600 }}>
                            {kpi.label}
                        </span>
                    </div>
                    <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                        {kpi.value}
                    </h3>
                    <p
                        style={{
                            color: colors.dim,
                            fontSize: "0.72rem",
                            margin: "0.25rem 0 0",
                            fontWeight: 500,
                        }}
                    >
                        {kpi.sub}
                    </p>
                </motion.div>
            ))}
        </div>
    );
};

export default React.memo(KPICards);
