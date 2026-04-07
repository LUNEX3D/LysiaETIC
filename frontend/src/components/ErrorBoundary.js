/**
 * Global Error Boundary — LysiaETIC
 *
 * ✅ P1-2: Tüm uygulamayı saran hata yakalayıcı.
 * Herhangi bir React render hatası oluştuğunda kullanıcıya
 * anlamlı bir hata ekranı gösterir (beyaz ekran yerine).
 */

import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // Production'da buraya Sentry/LogRocket gibi hata izleme servisi eklenebilir
        console.error("[ErrorBoundary] Yakalanan hata:", error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = "/login";
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #0f1419 0%, #1a1f35 100%)",
                    fontFamily: "Space Grotesk, Inter, sans-serif",
                    padding: "2rem"
                }}>
                    <div style={{
                        background: "rgba(26, 31, 53, 0.9)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "20px",
                        padding: "3rem",
                        maxWidth: "500px",
                        width: "100%",
                        textAlign: "center",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
                    }}>
                        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>⚠️</div>
                        <h1 style={{
                            color: "#ef4444",
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            marginBottom: "0.75rem"
                        }}>
                            Bir Hata Oluştu
                        </h1>
                        <p style={{
                            color: "#94a3b8",
                            fontSize: "0.95rem",
                            lineHeight: 1.6,
                            marginBottom: "2rem"
                        }}>
                            Uygulama beklenmeyen bir hatayla karşılaştı.
                            Lütfen sayfayı yenileyin veya ana sayfaya dönün.
                        </p>

                        {process.env.NODE_ENV !== "production" && this.state.error && (
                            <details style={{
                                textAlign: "left",
                                marginBottom: "1.5rem",
                                background: "rgba(0,0,0,0.3)",
                                borderRadius: "10px",
                                padding: "1rem",
                                maxHeight: "200px",
                                overflow: "auto"
                            }}>
                                <summary style={{ color: "#f59e0b", cursor: "pointer", marginBottom: "0.5rem" }}>
                                    Hata Detayı (Development)
                                </summary>
                                <pre style={{
                                    color: "#ef4444",
                                    fontSize: "0.75rem",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-all"
                                }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    background: "linear-gradient(135deg, #4ecdc4, #0ea5e9)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "12px",
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "transform 0.2s"
                                }}
                                onMouseOver={e => e.target.style.transform = "scale(1.05)"}
                                onMouseOut={e => e.target.style.transform = "scale(1)"}
                            >
                                🔄 Sayfayı Yenile
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                style={{
                                    background: "rgba(255,255,255,0.08)",
                                    color: "#e2e8f0",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    borderRadius: "12px",
                                    padding: "0.75rem 1.5rem",
                                    fontSize: "0.9rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "transform 0.2s"
                                }}
                                onMouseOver={e => e.target.style.transform = "scale(1.05)"}
                                onMouseOut={e => e.target.style.transform = "scale(1)"}
                            >
                                🏠 Ana Sayfa
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
