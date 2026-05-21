/**
 * ═══════════════════════════════════════════════════════════════
 * LysiaBrain2Page v9 — Standalone full-screen wrapper
 * ═══════════════════════════════════════════════════════════════
 * UserDashboard'dan tamamen bağımsız — hiçbir parent CSS yok
 * /Dashtock AI2 route'unda çalışır — deep space dark bg
 * ═══════════════════════════════════════════════════════════════
 */
import React from "react";
import LysiaBrain from "./lysiabrain/LysiaBrain";

const LysiaBrain2Page = () => {
    return (
        <div style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            background: "#080b16",
            zIndex: 9999,
            margin: 0,
            padding: 0,
        }}>
            <LysiaBrain />
        </div>
    );
};

export default LysiaBrain2Page;
