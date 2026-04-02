/**
 * PaymentResult — Ödeme Sonuç Sayfası
 *
 * PayTR'dan yönlendirme sonrası gösterilir.
 * /payment/success veya /payment/failed
 *
 * ✅ FIX: Başarılı ödemede abonelik durumunu polling ile kontrol et
 * ✅ FIX: Kullanıcıya anlamlı geri bildirim ver
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaArrowRight, FaSpinner } from "react-icons/fa";
import axios from "../services/api";

const PaymentResult = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isSuccess = location.pathname.includes("success");
    const [subStatus, setSubStatus] = useState(null);
    const [checking, setChecking] = useState(isSuccess);
    const pollRef = useRef(null);

    // Başarılı ödemede abonelik durumunu kontrol et
    useEffect(() => {
        if (!isSuccess) return;

        const token = localStorage.getItem("token");
        if (!token) {
            setChecking(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 15;

        pollRef.current = setInterval(async () => {
            attempts++;
            try {
                const res = await axios.get("/paytr/subscription");
                if (res.data.success && res.data.subscription) {
                    const sub = res.data.subscription;
                    setSubStatus(sub);
                    if (sub.isActive && sub.status === "active" && sub.plan !== "trial") {
                        clearInterval(pollRef.current);
                        setChecking(false);
                    }
                }
            } catch {
                // Token yoksa veya hata varsa sessizce devam et
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollRef.current);
                setChecking(false);
            }
        }, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isSuccess]);

    return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={S.iconWrap(isSuccess)}>
                    {isSuccess ? <FaCheckCircle /> : <FaTimesCircle />}
                </div>
                <h1 style={S.title}>
                    {isSuccess ? "Ödeme Başarılı!" : "Ödeme Başarısız"}
                </h1>
                <p style={S.desc}>
                    {isSuccess
                        ? checking
                            ? "Aboneliğiniz aktifleştiriliyor, lütfen bekleyin..."
                            : subStatus?.isActive
                                ? `${(subStatus.plan || "").toUpperCase()} paketiniz başarıyla aktifleştirildi! Artık tüm özellikleri kullanabilirsiniz.`
                                : "Aboneliğiniz başarıyla aktifleştirildi. Artık tüm özellikleri kullanabilirsiniz."
                        : "Ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin veya farklı bir ödeme yöntemi kullanın."}
                </p>
                {checking && (
                    <div style={S.spinner}>
                        <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Kontrol ediliyor...
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
                <div style={S.actions}>
                    <button
                        style={S.primaryBtn}
                        onClick={() => navigate("/dashboard")}
                    >
                        Panele Git <FaArrowRight />
                    </button>
                    {!isSuccess && (
                        <button
                            style={S.secondaryBtn}
                            onClick={() => navigate("/subscription")}
                        >
                            Tekrar Dene
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const S = {
    page: {
        minHeight: "100vh",
        background: "#06080f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Inter', sans-serif",
    },
    card: {
        background: "rgba(17,22,49,0.8)",
        border: "1px solid rgba(99,102,241,0.12)",
        borderRadius: "24px",
        padding: "60px 48px",
        textAlign: "center",
        maxWidth: "480px",
        width: "100%",
    },
    iconWrap: (isSuccess) => ({
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        background: isSuccess ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
        color: isSuccess ? "#34d399" : "#f87171",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "40px",
        margin: "0 auto 28px",
    }),
    title: {
        fontSize: "28px",
        fontWeight: 800,
        color: "#fff",
        margin: "0 0 16px",
    },
    desc: {
        fontSize: "15px",
        color: "#94a3b8",
        lineHeight: 1.7,
        margin: "0 0 36px",
    },
    spinner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        fontSize: "15px",
        color: "#818cf8",
        marginBottom: "20px",
    },
    actions: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    primaryBtn: {
        padding: "16px 32px",
        background: "linear-gradient(135deg, #6366f1, #7c3aed)",
        border: "none",
        borderRadius: "14px",
        color: "#fff",
        fontSize: "16px",
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
    },
    secondaryBtn: {
        padding: "14px 32px",
        background: "transparent",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "14px",
        color: "#818cf8",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
    },
};

export default PaymentResult;
