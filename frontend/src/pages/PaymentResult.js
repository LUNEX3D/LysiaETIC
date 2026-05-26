/**
 * PaymentResult — Ödeme Sonuç Sayfası
 *
 * PayTR yönlendirmesi sonrası; sonuç PayTR Durum Sorgu ile doğrulanır.
 * Başarısız → mesaj + paket seçimine (/subscription) yönlendirme.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaArrowRight, FaSpinner } from "react-icons/fa";
import axios from "../services/api";

const PAYTR_OID_KEY = "dashtock_paytr_oid";
const FAIL_REDIRECT_MS = 3000;

const PaymentResult = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isSuccessUrl = location.pathname.includes("success");

    const [phase, setPhase] = useState("verifying");
    const [message, setMessage] = useState("");
    const [subStatus, setSubStatus] = useState(null);
    const [redirectSec, setRedirectSec] = useState(Math.ceil(FAIL_REDIRECT_MS / 1000));
    const pollRef = useRef(null);
    const redirectTimerRef = useRef(null);

    const scheduleFailRedirect = () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        setRedirectSec(Math.ceil(FAIL_REDIRECT_MS / 1000));
        const tick = setInterval(() => {
            setRedirectSec((s) => (s > 1 ? s - 1 : 1));
        }, 1000);
        redirectTimerRef.current = setTimeout(() => {
            clearInterval(tick);
            navigate("/subscription", { replace: true });
        }, FAIL_REDIRECT_MS);
        return () => {
            clearInterval(tick);
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return undefined;
        }

        const params = new URLSearchParams(location.search);
        const failFromUrl = params.get("fail_message") || params.get("fail_reason") || "";
        const oid =
            sessionStorage.getItem(PAYTR_OID_KEY) ||
            params.get("merchant_oid") ||
            params.get("oid") ||
            "";

        let cancelled = false;
        let cleanupRedirect = null;

        const pollSubscription = () => {
            let attempts = 0;
            pollRef.current = setInterval(async () => {
                attempts++;
                try {
                    if (attempts === 2 || attempts === 5) {
                        await axios.post("/paytr/sync-subscription", oid ? { merchant_oid: oid } : {});
                    }
                    const res = await axios.get("/paytr/subscription");
                    if (res.data.success && res.data.subscription?.isActive) {
                        setSubStatus(res.data.subscription);
                        setPhase("success");
                        clearInterval(pollRef.current);
                    }
                } catch {
                    /* sessiz */
                }
                if (attempts >= 12) clearInterval(pollRef.current);
            }, 2000);
        };

        const showFailed = (msg) => {
            setPhase("failed");
            setMessage(msg || "Ödeme başarısız. Paket seçimine yönlendiriliyorsunuz.");
            sessionStorage.removeItem(PAYTR_OID_KEY);
            cleanupRedirect = scheduleFailRedirect();
        };

        const runVerify = async () => {
            try {
                const res = await axios.post("/paytr/verify-payment", {
                    ...(oid ? { merchant_oid: oid } : {}),
                });
                if (cancelled) return;

                const data = res.data;

                if (data.paymentStatus === "success") {
                    sessionStorage.removeItem(PAYTR_OID_KEY);
                    setSubStatus(data.subscription || null);
                    setPhase("success");
                    return;
                }

                if (data.paymentStatus === "pending_activation") {
                    setPhase("success");
                    setMessage(data.message || "Ödeme alındı, paket aktifleştiriliyor...");
                    pollSubscription();
                    return;
                }

                if (data.paymentStatus === "failed") {
                    showFailed(data.message || failFromUrl);
                    return;
                }

                showFailed(
                    data.message ||
                        failFromUrl ||
                        (isSuccessUrl
                            ? "Ödeme doğrulanamadı. Lütfen paket seçiminden tekrar deneyin."
                            : "Ödeme başarısız.")
                );
            } catch (err) {
                if (cancelled) return;
                const apiMsg = err.response?.data?.message;
                if (isSuccessUrl) {
                    showFailed(
                        apiMsg ||
                            failFromUrl ||
                            "Ödeme PayTR üzerinden doğrulanamadı. Paket seçimine yönlendiriliyorsunuz."
                    );
                } else {
                    showFailed(apiMsg || failFromUrl || "Ödeme başarısız.");
                }
            }
        };

        runVerify();

        return () => {
            cancelled = true;
            if (pollRef.current) clearInterval(pollRef.current);
            if (cleanupRedirect) cleanupRedirect();
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    }, [location.pathname, location.search, navigate, isSuccessUrl]);

    const isVerifying = phase === "verifying";
    const isSuccess = phase === "success";
    const isFailed = phase === "failed";

    return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={S.iconWrap(isSuccess && !isVerifying)}>
                    {isVerifying ? (
                        <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                    ) : isSuccess ? (
                        <FaCheckCircle />
                    ) : (
                        <FaTimesCircle />
                    )}
                </div>
                <h1 style={S.title}>
                    {isVerifying
                        ? "Ödeme doğrulanıyor"
                        : isSuccess
                          ? "Ödeme Başarılı!"
                          : "Ödeme Başarısız"}
                </h1>
                <p style={S.desc}>
                    {isVerifying
                        ? "PayTR üzerinden ödeme durumu sorgulanıyor, lütfen bekleyin..."
                        : isSuccess
                          ? message ||
                            (subStatus?.isActive
                                ? `${(subStatus.plan || "").toUpperCase()} paketiniz aktifleştirildi. Panele geçebilirsiniz.`
                                : "Ödemeniz onaylandı. Aboneliğiniz kısa süre içinde aktif olacak.")
                          : message ||
                            `Ödeme tamamlanamadı. ${redirectSec} saniye içinde paket seçimine yönlendirileceksiniz.`}
                </p>
                {isVerifying && (
                    <div style={S.spinner}>
                        <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> PayTR durum sorgusu...
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
                <div style={S.actions}>
                    {isSuccess && (
                        <button style={S.primaryBtn} onClick={() => navigate("/dashboard")}>
                            Panele Git <FaArrowRight />
                        </button>
                    )}
                    {isFailed && (
                        <>
                            <button
                                style={S.primaryBtn}
                                onClick={() => navigate("/subscription", { replace: true })}
                            >
                                Paket seçimine dön <FaArrowRight />
                            </button>
                            <button style={S.secondaryBtn} onClick={() => navigate("/dashboard")}>
                                Panele git
                            </button>
                        </>
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
        color: isSuccess ? "#34d399" : "#818cf8",
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
