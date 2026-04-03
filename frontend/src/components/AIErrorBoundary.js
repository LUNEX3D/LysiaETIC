/**
 * AI Error Boundary — LysiaETIC
 *
 * Catches React rendering errors in the AI Command Center
 * and shows a friendly error UI instead of a white screen.
 */
import React from "react";
import { FaExclamationTriangle, FaSync, FaBrain } from "react-icons/fa";

class AIErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("[AI Error Boundary]", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: "60vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2rem",
                    background: "linear-gradient(135deg, #0a0a0f 0%, #111118 100%)",
                    borderRadius: "16px",
                    margin: "1rem",
                    border: "1px solid rgba(248,113,113,0.15)",
                }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: "50%",
                        background: "rgba(248,113,113,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: "1.5rem",
                        border: "2px solid rgba(248,113,113,0.2)",
                    }}>
                        <FaExclamationTriangle style={{ fontSize: "2rem", color: "#f87171" }} />
                    </div>

                    <h2 style={{
                        color: "#fff", fontSize: "1.3rem", fontWeight: 700,
                        marginBottom: "0.5rem", textAlign: "center",
                    }}>
                        <FaBrain style={{ color: "#4ecdc4", marginRight: "0.5rem" }} />
                        AI Modülünde Bir Hata Oluştu
                    </h2>

                    <p style={{
                        color: "#a1a1aa", fontSize: "0.85rem", textAlign: "center",
                        maxWidth: 500, lineHeight: 1.6, marginBottom: "1.5rem",
                    }}>
                        AI Operations Brain beklenmeyen bir hatayla karşılaştı.
                        Bu durum geçici olabilir — sayfayı yenileyerek tekrar deneyin.
                    </p>

                    {this.state.error && (
                        <div style={{
                            background: "rgba(248,113,113,0.06)",
                            border: "1px solid rgba(248,113,113,0.15)",
                            borderRadius: "10px",
                            padding: "0.75rem 1rem",
                            marginBottom: "1.5rem",
                            maxWidth: 500,
                            width: "100%",
                        }}>
                            <div style={{ fontSize: "0.7rem", color: "#f87171", fontWeight: 600, marginBottom: "0.3rem" }}>
                                Hata Detayı:
                            </div>
                            <div style={{
                                fontSize: "0.72rem", color: "#fca5a5",
                                fontFamily: "monospace", wordBreak: "break-all",
                                lineHeight: 1.5,
                            }}>
                                {this.state.error.toString()}
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.65rem 1.5rem",
                                background: "linear-gradient(135deg, #4ecdc4, #44b8b0)",
                                color: "#fff", border: "none", borderRadius: "10px",
                                fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={e => e.target.style.transform = "translateY(-1px)"}
                            onMouseLeave={e => e.target.style.transform = "translateY(0)"}
                        >
                            <FaSync /> Tekrar Dene
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                padding: "0.65rem 1.5rem",
                                background: "rgba(255,255,255,0.05)",
                                color: "#a1a1aa", border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "10px", fontSize: "0.82rem", fontWeight: 600,
                                cursor: "pointer", transition: "all 0.2s",
                            }}
                            onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.08)"}
                            onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.05)"}
                        >
                            Sayfayı Yenile
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AIErrorBoundary;
