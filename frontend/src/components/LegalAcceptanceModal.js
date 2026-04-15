/**
 * LegalAcceptanceModal — Zorunlu Yasal Onay Modalı
 *
 * Login sonrası kullanıcı yasal belgeleri onaylamadıysa bu modal gösterilir.
 * Kullanıcı onaylamadan sayfayı kapatamaz ve programa erişim yapamaz.
 *
 * 3 belge:
 *   1. Gizlilik Politikası (Privacy Policy)
 *   2. Kullanım Şartları (Terms of Service)
 *   3. Çerez Politikası (Cookie Policy)
 */
import React, { useState, useEffect, useCallback } from "react";
import axios from "../services/api";
import "../styles/legal.css";

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const LEGAL_DOCS = [
    {
        id: "privacy",
        icon: "🔒",
        title: "Gizlilik Politikası",
        url: "/privacy",
        summary: "Kişisel verilerinizin nasıl toplandığını, kullanıldığını, saklandığını ve korunduğunu açıklar. KVKK ve GDPR uyumludur. Verileriniz 256-bit SSL şifreleme ile korunur, üçüncü taraflarla yalnızca hizmet sunumu için paylaşılır. Veri sahibi olarak bilgi talep etme, düzeltme, silme ve itiraz haklarınız vardır."
    },
    {
        id: "terms",
        icon: "📋",
        title: "Kullanım Şartları",
        url: "/terms",
        summary: "Platform kullanım koşullarını, tarafların hak ve yükümlülüklerini, ödeme şartlarını düzenler. Hesap güvenliğinden siz sorumlusunuz. Yasak faaliyetler, fikri mülkiyet hakları, sorumluluk sınırlamaları ve uyuşmazlık çözüm yolları bu belgede tanımlanmıştır."
    },
    {
        id: "cookies",
        icon: "🍪",
        title: "Çerez Politikası",
        url: "/cookies",
        summary: "Platform üzerinde kullanılan çerezleri, amaçlarını ve yönetim seçeneklerini açıklar. Zorunlu çerezler (oturum, güvenlik), analitik çerezler (Google Analytics) ve işlevsellik çerezleri (tercih hatırlama) kullanılmaktadır. Çerez tercihlerinizi istediğiniz zaman değiştirebilirsiniz."
    }
];

const LegalAcceptanceModal = ({ onAccepted }) => {
    const [expandedDoc, setExpandedDoc] = useState(null);
    const [checks, setChecks] = useState({
        privacy: false,
        terms: false,
        cookies: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const allChecked = checks.privacy && checks.terms && checks.cookies;

    // Sayfayı kapatmayı engelle — kullanıcı onaylamadan çıkamaz
    const handleBeforeUnload = useCallback((e) => {
        e.preventDefault();
        e.returnValue = "Yasal belgeleri onaylamadan çıkamazsınız. Lütfen belgeleri okuyup onaylayın.";
        return e.returnValue;
    }, []);

    useEffect(() => {
        window.addEventListener("beforeunload", handleBeforeUnload);
        // Body scroll'u kapat
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.body.style.overflow = "";
        };
    }, [handleBeforeUnload]);

    // ESC tuşunu engelle
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, []);

    const toggleCheck = (id) => {
        setChecks(prev => ({ ...prev, [id]: !prev[id] }));
        setError("");
    };

    const handleAccept = async () => {
        if (!allChecked) return;
        setIsSubmitting(true);
        setError("");

        try {
            await axios.post("/auth/accept-legal", {
                privacyPolicy: true,
                termsOfService: true,
                cookiePolicy: true,
                acceptedAt: new Date().toISOString(),
                userAgent: navigator.userAgent,
            });

            // localStorage'a da kaydet (hızlı kontrol için)
            localStorage.setItem("legalAccepted", "true");
            localStorage.setItem("legalAcceptedAt", new Date().toISOString());

            if (onAccepted) onAccepted();
        } catch (err) {
            console.error("Legal acceptance error:", err);
            setError(err.response?.data?.message || "Bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="legal-modal-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="legal-modal-header">
                    <span className="legal-modal-header-icon">📜</span>
                    <h2>Yasal Belgeleri Onaylayın</h2>
                    <p>
                        Platformumuzu kullanabilmek için aşağıdaki yasal belgeleri okumanız ve onaylamanız gerekmektedir.
                        Bu belgeler KVKK, GDPR ve ilgili tüm mevzuata uygun olarak hazırlanmıştır.
                    </p>
                </div>

                {/* Body — Document Cards */}
                <div className="legal-modal-body">
                    {LEGAL_DOCS.map((doc) => (
                        <div key={doc.id} className="legal-modal-doc">
                            <div
                                className="legal-modal-doc-header"
                                onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                            >
                                <div className="legal-modal-doc-title">
                                    <span>{doc.icon}</span>
                                    {doc.title}
                                </div>
                                <span className={`legal-modal-doc-toggle${expandedDoc === doc.id ? " open" : ""}`}>
                                    ▼
                                </span>
                            </div>
                            {expandedDoc === doc.id && (
                                <div className="legal-modal-doc-content">
                                    <p>{doc.summary}</p>
                                    <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="legal-modal-doc-link"
                                    >
                                        Tam metni oku →
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer — Checkboxes + Accept */}
                <div className="legal-modal-footer">
                    <div className="legal-modal-checks">
                        <div
                            className={`legal-modal-check${checks.privacy ? " checked" : ""}`}
                            onClick={() => toggleCheck("privacy")}
                        >
                            <div className="legal-modal-checkbox"><CheckIcon /></div>
                            <span className="legal-modal-check-text">
                                <a href="/privacy" target="_blank" rel="noopener noreferrer">Gizlilik Politikası</a>'nı okudum, anladım ve kabul ediyorum.
                            </span>
                        </div>

                        <div
                            className={`legal-modal-check${checks.terms ? " checked" : ""}`}
                            onClick={() => toggleCheck("terms")}
                        >
                            <div className="legal-modal-checkbox"><CheckIcon /></div>
                            <span className="legal-modal-check-text">
                                <a href="/terms" target="_blank" rel="noopener noreferrer">Kullanım Şartları</a>'nı okudum, anladım ve kabul ediyorum.
                            </span>
                        </div>

                        <div
                            className={`legal-modal-check${checks.cookies ? " checked" : ""}`}
                            onClick={() => toggleCheck("cookies")}
                        >
                            <div className="legal-modal-checkbox"><CheckIcon /></div>
                            <span className="legal-modal-check-text">
                                <a href="/cookies" target="_blank" rel="noopener noreferrer">Çerez Politikası</a>'nı okudum, anladım ve kabul ediyorum.
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: "10px 14px",
                            marginBottom: "14px",
                            borderRadius: "10px",
                            background: "rgba(248, 113, 113, 0.08)",
                            border: "1px solid rgba(248, 113, 113, 0.15)",
                            color: "#f87171",
                            fontSize: "13px",
                            textAlign: "center",
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        className="legal-modal-accept"
                        disabled={!allChecked || isSubmitting}
                        onClick={handleAccept}
                    >
                        {isSubmitting ? (
                            <span style={{
                                width: 20, height: 20, border: "3px solid rgba(255,255,255,0.2)",
                                borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                                animation: "authSpin 0.7s linear infinite"
                            }} />
                        ) : (
                            <>✅ Okudum, Anladım, Onaylıyorum</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LegalAcceptanceModal;
