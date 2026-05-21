import React from "react";
import { FaLock, FaCrown } from "react-icons/fa";
import { FEATURE_LABELS_TR } from "../constants/planFeatures";

/**
 * Paket kilidi — içerik yerine yükseltme kartı
 */
const PlanFeatureGate = ({
    featureId,
    canAccess,
    planDisplayName,
    upgradeHint,
    onUpgrade,
    children
}) => {
    if (canAccess(featureId)) {
        return children;
    }

    const label = FEATURE_LABELS_TR[featureId] || featureId;
    const hintPlan = upgradeHint === "enterprise" ? "Kurumsal" : upgradeHint === "pro" ? "Profesyonel" : "Giriş";

    return (
        <div style={{
            margin: "24px auto",
            maxWidth: 520,
            padding: "28px 24px",
            textAlign: "center",
            background: "rgba(15,23,42,0.85)",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: 16,
            color: "#e2e8f0"
        }}>
            <FaLock style={{ fontSize: 32, color: "#818cf8", marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{label} — Paket Gerekli</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                Mevcut paketiniz: <strong>{planDisplayName || "Deneme"}</strong>.
                Bu modül <strong>{hintPlan}</strong> paket ve üzerinde açılır.
            </p>
            <button
                type="button"
                onClick={onUpgrade}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 20px",
                    background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14
                }}
            >
                <FaCrown /> Paketleri Gör & Yükselt
            </button>
        </div>
    );
};

export default PlanFeatureGate;
