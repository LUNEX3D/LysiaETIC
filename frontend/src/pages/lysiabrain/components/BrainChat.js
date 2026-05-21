/**
 * ═══════════════════════════════════════════════════════════════
 * LYSIA BRAIN v10 — AI Chat Widget — DARK GLASSMORPHISM
 * ═══════════════════════════════════════════════════════════════
 * Floating chat bubble + expandable chat panel
 * Uses: POST /ai-chat/message, GET /ai-chat/quick-stats
 * ═══════════════════════════════════════════════════════════════
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import API from "../../../services/api";
import { T } from "../styles";

const BrainChat = ({ t }) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [sessionId] = useState(() => `brain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, open]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const sendMessage = useCallback(async (messageOverride) => {
        const raw = typeof messageOverride === "string" ? messageOverride : input;
        const msg = raw.trim();
        if (!msg || sending) return;
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: msg }]);
        setSending(true);
        try {
            const res = await API.post("/ai-chat/message", { message: msg, sessionId });
            if (res.data && res.data.success !== false && res.data.response) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: res.data.response.content || res.data.response.message || "...",
                    suggestions: res.data.response.suggestions || [],
                }]);
            } else {
                setMessages(prev => [...prev, { role: "assistant", content: "Bir hata oluştu. Tekrar deneyin." }]);
            }
        } catch {
            setMessages(prev => [...prev, { role: "assistant", content: "Bağlantı hatası. Tekrar deneyin." }]);
        } finally { setSending(false); }
    }, [input, sending, sessionId]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const handleSuggestion = (text) => {
        setInput(text);
        void sendMessage(text);
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} aria-label={t("chat.title")}
                style={{
                    position: "fixed", bottom: 24, right: 24, zIndex: 9998,
                    width: 56, height: 56, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.5rem", color: "#fff",
                    boxShadow: `0 4px 20px ${T.accent}40, 0 0 40px ${T.accent}15`,
                    transition: "all 0.3s",
                }}>
                💬
            </button>
        );
    }

    return (
        <div style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9998,
            width: 380, maxWidth: "calc(100vw - 32px)",
            height: 520, maxHeight: "calc(100vh - 100px)",
            borderRadius: T.rXl,
            background: T.bgCardSolid,
            border: `1px solid ${T.borderGlow}`,
            boxShadow: T.shadowLg,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            fontFamily: T.font,
        }} role="dialog" aria-label={t("chat.title")}>
            {/* Header */}
            <div style={{
                padding: "0.85rem 1.15rem",
                borderBottom: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: T.bgCard,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: T.accentDim, border: `1px solid ${T.accent}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1rem",
                    }}>🤖</div>
                    <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: T.text }}>{t("chat.title")}</div>
                        <div style={{ fontSize: "0.6rem", color: T.textDim }}>Dashtock AI</div>
                    </div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close chat"
                    style={{
                        background: T.bgGlass, border: `1px solid ${T.border}`,
                        color: T.textSec, cursor: "pointer", fontSize: "0.8rem",
                        width: 30, height: 30, borderRadius: T.rSm,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit",
                    }}>✕</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
                flex: 1, overflow: "auto", padding: "1rem",
                display: "flex", flexDirection: "column", gap: "0.75rem",
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: "center", padding: "2rem 1rem", color: T.textDim, fontSize: "0.85rem" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🧠</div>
                        Merhaba! Size nasıl yardımcı olabilirim?
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}>
                        <div style={{
                            maxWidth: "85%",
                            padding: "0.65rem 0.9rem",
                            borderRadius: msg.role === "user"
                                ? `${T.rSm}px ${T.rSm}px 3px ${T.rSm}px`
                                : `${T.rSm}px ${T.rSm}px ${T.rSm}px 3px`,
                            background: msg.role === "user"
                                ? `linear-gradient(135deg, ${T.accent}25, ${T.accentAlt}15)`
                                : T.bgGlass,
                            border: `1px solid ${msg.role === "user" ? T.accent + "25" : T.border}`,
                            fontSize: "0.82rem", lineHeight: 1.6,
                            color: T.text, whiteSpace: "pre-wrap",
                        }}>
                            {msg.content}
                            {msg.suggestions?.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                                    {msg.suggestions.map((s, j) => (
                                        <button key={j} onClick={() => handleSuggestion(s)}
                                            style={{
                                                background: T.accentDim, border: `1px solid ${T.accent}25`,
                                                borderRadius: T.rFull, padding: "3px 10px",
                                                fontSize: "0.7rem", color: T.accent, fontWeight: 600,
                                                cursor: "pointer", fontFamily: "inherit",
                                            }}>{s}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {sending && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textDim, fontSize: "0.78rem" }}>
                        <span style={{ animation: "v9spin 1s linear infinite", display: "inline-block", width: 14, height: 14, border: `2px solid ${T.borderLight}`, borderTopColor: T.accent, borderRadius: "50%" }} />
                        {t("chat.thinking")}
                    </div>
                )}
            </div>

            {/* Input */}
            <div style={{
                padding: "0.75rem",
                borderTop: `1px solid ${T.border}`,
                display: "flex", gap: "0.5rem",
            }}>
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={t("chat.placeholder")} disabled={sending}
                    aria-label={t("chat.placeholder")}
                    style={{
                        flex: 1, background: T.bgInput,
                        border: `1px solid ${T.border}`, borderRadius: T.rSm,
                        padding: "9px 12px", color: T.text,
                        fontSize: "0.82rem", outline: "none", fontFamily: "inherit",
                    }} />
                <button onClick={sendMessage} disabled={sending || !input.trim()} aria-label={t("chat.send")}
                    style={{
                        width: 38, height: 38, borderRadius: T.rSm,
                        background: input.trim() ? `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})` : T.bgGlass,
                        border: `1px solid ${input.trim() ? T.accent + "40" : T.border}`,
                        color: input.trim() ? "#fff" : T.textMuted,
                        cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.9rem", fontFamily: "inherit",
                        transition: "all 0.2s",
                    }}>▶</button>
            </div>
            <style>{`@keyframes v9spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default React.memo(BrainChat);
