/**
 * Section Error Boundary — LysiaETIC
 *
 * ✅ FIX #11: Per-section error boundary — bir bölüm çökerse
 * sadece o bölüm hata gösterir, tüm uygulama çökmez.
 *
 * Kullanım:
 *   <SectionErrorBoundary name="Sipariş Yönetimi">
 *       <OrdersPage />
 *   </SectionErrorBoundary>
 */

import React from "react";

class SectionErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error(`[SectionErrorBoundary:${this.props.name || "unknown"}]`, error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            const name = this.props.name || "Bu bölüm";
            return (
                <div style={{
                    background: "rgba(239, 68, 68, 0.06)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "16px",
                    padding: "2rem",
                    textAlign: "center",
                    margin: "1rem 0",
                }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
                    <h3 style={{
                        color: "#ef4444",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        marginBottom: "0.5rem",
                        margin: "0 0 0.5rem",
                    }}>
                        {name} yüklenirken hata oluştu
                    </h3>
                    <p style={{
                        color: "#94a3b8",
                        fontSize: "0.85rem",
                        marginBottom: "1.25rem",
                        margin: "0 0 1.25rem",
                        lineHeight: 1.5,
                    }}>
                        Bu bölümde beklenmeyen bir hata oluştu. Diğer bölümler normal çalışmaya devam ediyor.
                    </p>

                    {process.env.NODE_ENV !== "production" && this.state.error && (
                        <details style={{
                            textAlign: "left",
                            marginBottom: "1rem",
                            background: "rgba(0,0,0,0.2)",
                            borderRadius: "8px",
                            padding: "0.75rem",
                            maxHeight: "150px",
                            overflow: "auto",
                        }}>
                            <summary style={{ color: "#f59e0b", cursor: "pointer", fontSize: "0.8rem" }}>
                                Hata Detayı
                            </summary>
                            <pre style={{
                                color: "#ef4444",
                                fontSize: "0.7rem",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                                marginTop: "0.5rem",
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}

                    <button
                        onClick={this.handleRetry}
                        style={{
                            background: "linear-gradient(135deg, #4ecdc4, #0ea5e9)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            padding: "0.6rem 1.5rem",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "transform 0.2s, opacity 0.2s",
                        }}
                        onMouseOver={e => e.target.style.transform = "scale(1.05)"}
                        onMouseOut={e => e.target.style.transform = "scale(1)"}
                    >
                        🔄 Tekrar Dene
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default SectionErrorBoundary;
