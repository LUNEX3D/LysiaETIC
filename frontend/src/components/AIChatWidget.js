/**
 * 
 * AI CHAT WIDGET  Pazarynetim AI Operatör
 * 
 *
 * Floating chat widget  her sayfada görünür.
 * Kullanıcı AI ile doal dilde konuabilir.
 *
 * zellikler:
 *  - Floating button (sa alt köe)
 *  - Açılır chat penceresi
 *  - Mesaj geçmii
 *  - Quick reply butonları
 *  - Proaktif uyarı badge'i
 *  - Typing indicator
 *  - Session management
 *
 * 
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Box, IconButton, Typography, TextField, Paper, Chip, Badge,
    CircularProgress, Fade, Slide, Tooltip, Divider
} from "@mui/material";
import {
    SmartToy as BotIcon,
    Close as CloseIcon,
    Send as SendIcon,
    DeleteOutline as ClearIcon,
    Refresh as RefreshIcon,
    NotificationsActive as AlertIcon,
    FiberManualRecord as DotIcon,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";

//  Helpers 
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

// Simple markdown-like bold: **text**  <strong>text</strong>
const renderContent = (text) => {
    if (!text) return "";
    // SEC: nce HTML entity escape  XSS koruması
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    // Sonra güvenli markdown dönüümleri
    return escaped
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br/>");
};

//  Main Component 
const AIChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() => {
        return localStorage.getItem("ai_chat_session") || generateSessionId();
    });
    const [alertCount, setAlertCount] = useState(0);
    const [quickStats, setQuickStats] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    //  Scroll to bottom 
    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }, []);

    //  Load conversation history 
    const loadHistory = useCallback(async () => {
        try {
            const res = await API.get(`/ai-chat/history/${sessionId}`);
            if (res.data.success && res.data.messages?.length > 0) {
                setMessages(res.data.messages);
            }
        } catch {
            // No history yet  that's fine
        }
    }, [sessionId]);

    //  Load alerts count 
    const loadAlerts = useCallback(async () => {
        try {
            const res = await API.get("/ai-chat/alerts");
            if (res.data.success) {
                setAlertCount(res.data.alerts?.filter(a => a.severity === "critical" || a.severity === "high").length || 0);
            }
        } catch {
            // Ignore
        }
    }, []);

    //  Load quick stats 
    const loadQuickStats = useCallback(async () => {
        try {
            const res = await API.get("/ai-chat/quick-stats");
            if (res.data.success) {
                setQuickStats(res.data.stats);
            }
        } catch {
            // Ignore
        }
    }, []);

    //  Init 
    useEffect(() => {
        localStorage.setItem("ai_chat_session", sessionId);
        loadAlerts();
        loadQuickStats();
        // Refresh alerts every 5 minutes
        const interval = setInterval(() => {
            loadAlerts();
            loadQuickStats();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [sessionId, loadAlerts, loadQuickStats]);

    //  Load history when opened 
    useEffect(() => {
        if (isOpen) {
            loadHistory();
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, loadHistory]);

    //  Scroll on new messages 
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    //  Send message 
    const sendMessage = async (text) => {
        const msg = (text || input).trim();
        if (!msg || loading) return;

        // Add user message immediately
        const userMsg = { role: "user", content: msg, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await API.post("/ai-chat/message", {
                message: msg,
                sessionId,
            });

            if (res.data.success && res.data.response) {
                const aiMsg = {
                    role: "ai",
                    content: res.data.response.content,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        intent: res.data.response.intent,
                        suggestions: res.data.response.suggestions || [],
                    },
                };
                setMessages(prev => [...prev, aiMsg]);
            } else {
                setMessages(prev => [...prev, {
                    role: "ai",
                    content: "Bir hata olutu. Lütfen tekrar deneyin. ",
                    timestamp: new Date().toISOString(),
                    metadata: { suggestions: ["Tekrar dene"] },
                }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: "ai",
                content: "Balantı hatası. Sunucu eriilebilir olduundan emin olun. ",
                timestamp: new Date().toISOString(),
                metadata: { suggestions: ["Tekrar dene"] },
            }]);
        } finally {
            setLoading(false);
        }
    };

    //  New conversation 
    const startNewConversation = () => {
        const newSid = generateSessionId();
        setSessionId(newSid);
        setMessages([]);
        localStorage.setItem("ai_chat_session", newSid);
    };

    //  Handle key press 
    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    //  Health color 
    const getHealthColor = () => {
        if (!quickStats) return "#9e9e9e";
        if (quickStats.rating === "excellent") return "#22c55e";
        if (quickStats.rating === "good") return "#3b82f6";
        if (quickStats.rating === "warning") return "#f59e0b";
        return "#ef4444";
    };

    //  Last suggestions 
    const lastAiMessage = [...messages].reverse().find(m => m.role === "ai");
    const suggestions = lastAiMessage?.metadata?.suggestions || [];

    return (
        <>
            {/*  Floating Button  */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        style={{
                            position: "fixed",
                            bottom: 24,
                            right: 24,
                            zIndex: 9999,
                        }}
                    >
                        <Tooltip title="AI Operatör ile konu" placement="left">
                            <Badge
                                badgeContent={alertCount}
                                color="error"
                                overlap="circular"
                                sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 18, height: 18 } }}
                            >
                                <IconButton
                                    onClick={() => setIsOpen(true)}
                                    sx={{
                                        width: 60,
                                        height: 60,
                                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                        color: "#fff",
                                        boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
                                        "&:hover": {
                                            background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                                            transform: "scale(1.1)",
                                        },
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    <BotIcon sx={{ fontSize: 30 }} />
                                </IconButton>
                            </Badge>
                        </Tooltip>
                    </motion.div>
                )}
            </AnimatePresence>

            {/*  Chat Window  */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        style={{
                            position: "fixed",
                            bottom: 24,
                            right: 24,
                            zIndex: 10000,
                            width: 400,
                            maxWidth: "calc(100vw - 48px)",
                            height: 600,
                            maxHeight: "calc(100vh - 48px)",
                        }}
                    >
                        <Paper
                            elevation={12}
                            sx={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                borderRadius: 3,
                                overflow: "hidden",
                                border: "1px solid rgba(255,255,255,0.1)",
                            }}
                        >
                            {/*  Header  */}
                            <Box sx={{
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                color: "#fff",
                                p: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <BotIcon />
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                                            AI Operatör
                                        </Typography>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            <DotIcon sx={{ fontSize: 8, color: getHealthColor() }} />
                                            <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                                {quickStats ? `Salık: ${quickStats.healthScore}/100` : "Balanıyor..."}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box>
                                    <Tooltip title="Yeni konuma">
                                        <IconButton size="small" sx={{ color: "#fff" }} onClick={startNewConversation}>
                                            <RefreshIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Kapat">
                                        <IconButton size="small" sx={{ color: "#fff" }} onClick={() => setIsOpen(false)}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>

                            {/*  Messages  */}
                            <Box sx={{
                                flex: 1,
                                overflowY: "auto",
                                p: 2,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.5,
                                bgcolor: "#f8f9fa",
                                "&::-webkit-scrollbar": { width: 6 },
                                "&::-webkit-scrollbar-thumb": { bgcolor: "#ccc", borderRadius: 3 },
                            }}>
                                {/* Welcome message if empty */}
                                {messages.length === 0 && (
                                    <Box sx={{ textAlign: "center", py: 4 }}>
                                        <BotIcon sx={{ fontSize: 48, color: "#667eea", mb: 1 }} />
                                        <Typography variant="body1" fontWeight={600} color="text.primary">
                                            Merhaba! 
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                                            Ben Pazarynetim AI Operatör.<br />
                                            İletmenizi yönetmek için buradayım.
                                        </Typography>
                                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "center" }}>
                                            {["Nasıl gidiyor?", "Stok durumu", "Ne yapmalıyım?", "Yardım"].map(s => (
                                                <Chip
                                                    key={s}
                                                    label={s}
                                                    size="small"
                                                    onClick={() => sendMessage(s)}
                                                    sx={{
                                                        cursor: "pointer",
                                                        bgcolor: "#fff",
                                                        border: "1px solid #e0e0e0",
                                                        "&:hover": { bgcolor: "#667eea", color: "#fff" },
                                                        transition: "all 0.2s",
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                )}

                                {/* Messages */}
                                {messages.map((msg, i) => (
                                    <Fade in key={i} timeout={300}>
                                        <Box sx={{
                                            display: "flex",
                                            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                        }}>
                                            <Box sx={{
                                                maxWidth: "85%",
                                                p: 1.5,
                                                borderRadius: 2,
                                                bgcolor: msg.role === "user" ? "#667eea" : "#fff",
                                                color: msg.role === "user" ? "#fff" : "text.primary",
                                                boxShadow: msg.role === "user"
                                                    ? "0 2px 8px rgba(102, 126, 234, 0.3)"
                                                    : "0 1px 4px rgba(0,0,0,0.08)",
                                                borderBottomRightRadius: msg.role === "user" ? 4 : 16,
                                                borderBottomLeftRadius: msg.role === "user" ? 16 : 4,
                                            }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        whiteSpace: "pre-wrap",
                                                        wordBreak: "break-word",
                                                        lineHeight: 1.6,
                                                        "& strong": { fontWeight: 700 },
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: "block",
                                                        textAlign: "right",
                                                        mt: 0.5,
                                                        opacity: 0.6,
                                                        fontSize: "0.65rem",
                                                    }}
                                                >
                                                    {formatTime(msg.timestamp)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Fade>
                                ))}

                                {/* Typing indicator */}
                                {loading && (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 1 }}>
                                        <CircularProgress size={16} sx={{ color: "#667eea" }} />
                                        <Typography variant="caption" color="text.secondary">
                                            AI düünüyor...
                                        </Typography>
                                    </Box>
                                )}

                                <div ref={messagesEndRef} />
                            </Box>

                            {/*  Quick Replies  */}
                            {suggestions.length > 0 && !loading && (
                                <Box sx={{
                                    px: 2, py: 1,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                    borderTop: "1px solid #eee",
                                    bgcolor: "#fff",
                                }}>
                                    {suggestions.slice(0, 4).map(s => (
                                        <Chip
                                            key={s}
                                            label={s}
                                            size="small"
                                            onClick={() => sendMessage(s)}
                                            sx={{
                                                cursor: "pointer",
                                                fontSize: "0.7rem",
                                                height: 26,
                                                bgcolor: "#f0f0ff",
                                                border: "1px solid #e0e0ff",
                                                "&:hover": { bgcolor: "#667eea", color: "#fff" },
                                                transition: "all 0.2s",
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}

                            {/*  Input  */}
                            <Box sx={{
                                p: 1.5,
                                borderTop: "1px solid #eee",
                                bgcolor: "#fff",
                                display: "flex",
                                gap: 1,
                                alignItems: "flex-end",
                            }}>
                                <TextField
                                    inputRef={inputRef}
                                    fullWidth
                                    multiline
                                    maxRows={3}
                                    size="small"
                                    placeholder="Mesajınızı yazın..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    disabled={loading}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 2,
                                            fontSize: "0.875rem",
                                        },
                                    }}
                                />
                                <IconButton
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || loading}
                                    sx={{
                                        bgcolor: "#667eea",
                                        color: "#fff",
                                        width: 40,
                                        height: 40,
                                        "&:hover": { bgcolor: "#5a6fd6" },
                                        "&:disabled": { bgcolor: "#e0e0e0", color: "#999" },
                                    }}
                                >
                                    <SendIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Paper>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AIChatWidget;

