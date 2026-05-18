import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "../services/api";
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaChartLine } from "react-icons/fa";
import { BRAND_EMAIL } from "../constants/brand";
import "../styles/login.css";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState("loading"); // loading | success | error | manual
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState(searchParams.get("email") || "");
    const [code, setCode] = useState(searchParams.get("code") || "");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const token = searchParams.get("token");

    useEffect(() => {
        if (!token) {
            setStatus("manual");
            setMessage(`E-postanızdaki 6 haneli kodu girin. Mesaj ${BRAND_EMAIL} adresinden gelir.`);
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await axios.get(`/auth/verify-email?token=${token}`);
                setStatus("success");
                setMessage(response.data.message || "E-posta adresiniz başarıyla doğrulandı!");
            } catch (error) {
                setStatus("error");
                setMessage(
                    error.response?.data?.message ||
                    "Doğrulama başarısız oldu. Bağlantı geçersiz veya süresi dolmuş olabilir."
                );
            }
        };

        verifyEmail();
    }, [token]);

    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");
        try {
            const response = await axios.post("/auth/verify-email-code", { email, code });
            setStatus("success");
            setMessage(response.data.message || "E-posta adresiniz başarıyla doğrulandı!");
        } catch (error) {
            setStatus("error");
            setMessage(error.response?.data?.message || "Doğrulama kodu geçersiz veya süresi dolmuş.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-page" style={{ justifyContent: "center", alignItems: "center" }}>
            <div style={{ position: "absolute", inset: 0, background: "var(--bg, #06080f)" }} />
            <div className="auth-orb auth-orb--1" />
            <div className="auth-orb auth-orb--2" />

            <div style={{
                position: "relative",
                zIndex: 5,
                textAlign: "center",
                maxWidth: 460,
                padding: "48px 40px",
                background: "rgba(14, 18, 24, 0.6)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(99, 102, 241, 0.08)",
                borderRadius: 24,
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 36 }}>
                    <div className="auth-logo-icon" style={{ width: 40, height: 40, fontSize: 18 }}>
                        <FaChartLine />
                    </div>
                    <span className="auth-logo-text" style={{ fontSize: 20 }}>PazarYonet</span>
                </div>

                {status === "loading" && (
                    <>
                        <FaSpinner style={{
                            fontSize: 56,
                            color: "#6366f1",
                            animation: "authSpin 0.8s linear infinite",
                            marginBottom: 24
                        }} />
                        <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                            Doğrulanıyor...
                        </h2>
                        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
                            E-posta adresiniz doğrulanıyor, lütfen bekleyin.
                        </p>
                    </>
                )}

                {status === "manual" && (
                    <>
                        <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                            E-posta Doğrulama
                        </h2>
                        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                            {message}
                        </p>
                        <form onSubmit={handleCodeSubmit} style={{ textAlign: "left" }}>
                            <label style={{ display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>
                                E-posta
                            </label>
                            <input
                                type="email"
                                className="auth-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                style={{ marginBottom: 16, width: "100%" }}
                            />
                            <label style={{ display: "block", color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>
                                6 haneli kod
                            </label>
                            <input
                                type="text"
                                className="auth-input"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                required
                                maxLength={6}
                                inputMode="numeric"
                                placeholder="123456"
                                style={{ marginBottom: 20, width: "100%", letterSpacing: "0.2em", textAlign: "center" }}
                            />
                            <button
                                type="submit"
                                className="auth-submit"
                                disabled={submitting || code.length !== 6}
                                style={{ width: "100%" }}
                            >
                                {submitting ? "Doğrulanıyor..." : "Kodu Doğrula"}
                            </button>
                        </form>
                    </>
                )}

                {status === "success" && (
                    <>
                        <FaCheckCircle style={{ fontSize: 56, color: "#34d399", marginBottom: 24 }} />
                        <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                            Doğrulama Başarılı!
                        </h2>
                        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                            {message}
                        </p>
                        <button
                            className="auth-submit"
                            onClick={() => navigate("/login")}
                            style={{ maxWidth: 280, margin: "0 auto" }}
                        >
                            Giriş Yap →
                        </button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <FaTimesCircle style={{ fontSize: 56, color: "#f87171", marginBottom: 24 }} />
                        <h2 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                            Doğrulama Başarısız
                        </h2>
                        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                            {message}
                        </p>
                        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                                className="auth-submit"
                                onClick={() => setStatus("manual")}
                                style={{ maxWidth: 200, flex: "1 1 auto" }}
                            >
                                Kod ile dene
                            </button>
                            <button
                                className="auth-google-btn"
                                onClick={() => navigate("/login")}
                                style={{ maxWidth: 200, flex: "1 1 auto", marginTop: 0 }}
                            >
                                Giriş Yap
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
