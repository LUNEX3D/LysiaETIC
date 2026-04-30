/**
 * ============================================================================
 * LYSIA AI OPERATOR PANEL  ULTRA FUTURISTIC v3.0
 * ============================================================================
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import API from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { useApp } from "../context/AppContext";

const C = {
    bg: "#050a12", bgAlt: "#0a1020",
    card: "rgba(10, 18, 40, 0.85)", cardHover: "rgba(15, 25, 55, 0.95)",
    border: "rgba(0, 240, 255, 0.12)", borderHover: "rgba(0, 240, 255, 0.35)",
    accent: "#00f0ff", accentAlt: "#7b61ff",
    green: "#00ff88", red: "#ff3366", yellow: "#ffcc00",
    purple: "#a855f7", blue: "#3b82f6", pink: "#ff61d8",
    indigo: "#667eea", orange: "#ff8c00",
    text: "#e8edf5", muted: "#7a8ba8", dim: "#4a5568",
    glass: "rgba(255,255,255,0.02)", glassBr: "rgba(255,255,255,0.05)",
    neonGlow: "0 0 20px rgba(0,240,255,0.3), 0 0 40px rgba(0,240,255,0.1)",
    neonGlowStrong: "0 0 30px rgba(0,240,255,0.5), 0 0 60px rgba(0,240,255,0.2)",
    purpleGlow: "0 0 20px rgba(123,97,255,0.3), 0 0 40px rgba(123,97,255,0.1)",
    greenGlow: "0 0 20px rgba(0,255,136,0.3)", redGlow: "0 0 20px rgba(255,51,102,0.3)",
};

const MODES = {
    passive: { label: "Pasif Gzlemci", color: C.green, emoji: "", icon: "", gradient: `linear-gradient(135deg, ${C.green}, #059669)`, desc: "Sadece analiz ve neri", glow: `0 0 20px rgba(0,255,136,0.3)` },
    assisted: { label: "Asistan Mod", color: C.yellow, emoji: "", icon: "", gradient: `linear-gradient(135deg, ${C.yellow}, #d97706)`, desc: "AI nerir, siz onaylarsnz", glow: `0 0 20px rgba(255,204,0,0.3)` },
    autonomous: { label: "Otonom Pilot", color: C.red, emoji: "", icon: "", gradient: `linear-gradient(135deg, ${C.red}, #dc2626)`, desc: "Tam otomatik ynetim", glow: `0 0 20px rgba(255,51,102,0.3)` },
};

const RATINGS = {
    excellent: { color: C.green, label: "Mkemmel", emoji: "" },
    good: { color: C.blue, label: "yi", emoji: "" },
    warning: { color: C.yellow, label: "Dikkat", emoji: "" },
    critical: { color: C.red, label: "Kritik", emoji: "" },
    unknown: { color: C.dim, label: "Bilinmiyor", emoji: "" },
};

const CYCLE_PHASES = [
    { key: "observe", label: "GZLEM", icon: "", color: "#00f0ff", desc: "Veri toplama" },
    { key: "analyze", label: "ANALZ", icon: "", color: "#a855f7", desc: "Metrik hesaplama" },
    { key: "decide", label: "KARAR", icon: "", color: "#ffcc00", desc: "Strateji belirleme" },
    { key: "act", label: "AKSYON", icon: "", color: "#00ff88", desc: "Uygulama" },
    { key: "verify", label: "DORULA", icon: "", color: "#3b82f6", desc: "Sonu kontrol" },
    { key: "learn", label: "REN", icon: "", color: "#ff61d8", desc: "Hafzaya kaydet" },
];

const particlesConfig = {
    particles: {
        number: { value: 50, density: { enable: true, area: 1200 } },
        color: { value: ["#00f0ff", "#7b61ff", "#00ff88", "#ff61d8"] },
        shape: { type: "circle" },
        opacity: { value: { min: 0.1, max: 0.35 }, animation: { enable: true, speed: 0.8, minimumValue: 0.05 } },
        size: { value: { min: 0.5, max: 2 }, animation: { enable: true, speed: 2, minimumValue: 0.3 } },
        links: { enable: true, distance: 120, color: "#00f0ff", opacity: 0.07, width: 0.8 },
        move: { enable: true, speed: 0.5, direction: "none", outModes: "bounce" },
    },
    interactivity: { events: { onHover: { enable: true, mode: "grab" }, onClick: { enable: true, mode: "push" } }, modes: { grab: { distance: 140, links: { opacity: 0.2 } }, push: { quantity: 2 } } },
    detectRetina: true,
};

const playSound = (type) => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        if (type === "click") { o.frequency.setValueAtTime(800, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05); g.gain.setValueAtTime(0.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); o.start(); o.stop(ctx.currentTime + 0.1); }
        else if (type === "success") { o.frequency.setValueAtTime(523, ctx.currentTime); o.frequency.setValueAtTime(659, ctx.currentTime + 0.1); o.frequency.setValueAtTime(784, ctx.currentTime + 0.2); g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); o.start(); o.stop(ctx.currentTime + 0.4); }
        else if (type === "whoosh") { o.type = "sawtooth"; o.frequency.setValueAtTime(200, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.15); g.gain.setValueAtTime(0.03, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2); o.start(); o.stop(ctx.currentTime + 0.2); }
    } catch (e) { /* silent */ }
};

/*  NEURAL NETWORK SVG BG  */
const NeuralNetworkBg = React.memo(() => {
    const nodes = useMemo(() => Array.from({ length: 30 }).map(() => ({ x: Math.random() * 100, y: Math.random() * 100, r: Math.random() * 2 + 1, d: Math.random() * 5 })), []);
    const conns = useMemo(() => {
        const c = [];
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
            if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 25)
                c.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y, d: Math.random() * 3 });
        }
        return c;
    }, [nodes]);
    return (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12, pointerEvents: "none" }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs><linearGradient id="ng" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00f0ff" /><stop offset="100%" stopColor="#7b61ff" /></linearGradient></defs>
            {conns.map((c, i) => (<line key={i} x1={`${c.x1}%`} y1={`${c.y1}%`} x2={`${c.x2}%`} y2={`${c.y2}%`} stroke="url(#ng)" strokeWidth="0.15" opacity="0.4"><animate attributeName="opacity" values="0.1;0.6;0.1" dur={`${3 + c.d}s`} repeatCount="indefinite" /></line>))}
            {nodes.map((n, i) => (<circle key={i} cx={`${n.x}%`} cy={`${n.y}%`} r={n.r * 0.3} fill="#00f0ff"><animate attributeName="r" values={`${n.r * 0.2};${n.r * 0.5};${n.r * 0.2}`} dur={`${2 + n.d}s`} repeatCount="indefinite" /><animate attributeName="opacity" values="0.3;1;0.3" dur={`${2 + n.d}s`} repeatCount="indefinite" /></circle>))}
        </svg>
    );
});

/*  DATA STREAM (Matrix Rain)  */
const DataStream = React.memo(() => {
    const chars = "01";
    const cols = useMemo(() => Array.from({ length: 18 }).map((_, i) => ({ left: `${i * 5.5 + Math.random() * 3}%`, delay: Math.random() * 8, dur: 6 + Math.random() * 8, ch: Array.from({ length: 10 }).map(() => chars[Math.floor(Math.random() * chars.length)]) })), []);
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: 0.035, zIndex: 0 }}>
            {cols.map((c, i) => (<div key={i} style={{ position: "absolute", left: c.left, top: -180, animation: `matrixFall ${c.dur}s ${c.delay}s linear infinite`, fontSize: "0.7rem", color: C.accent, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 2 }}>{c.ch.map((ch, j) => <span key={j} style={{ opacity: 1 - j * 0.09 }}>{ch}</span>)}</div>))}
        </div>
    );
});

/*  HOLO RING  */
const HoloRing = ({ size = 180, score = 0, color = C.accent, children }) => {
    const circ = Math.PI * (size - 20);
    const off = circ - (score / 100) * circ;
    return (
        <div style={{ position: "relative", width: size, height: size }}>
            <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: `conic-gradient(from 0deg, ${color}00, ${color}30, ${color}00)`, animation: "holoSpin 8s linear infinite", filter: "blur(8px)" }} />
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "relative", zIndex: 2 }}>
                <defs>
                    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="50%" stopColor={C.accentAlt} /><stop offset="100%" stopColor={color} /></linearGradient>
                    <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <circle cx={size / 2} cy={size / 2} r={(size - 20) / 2} fill="none" stroke={C.glassBr} strokeWidth={6} />
                <circle cx={size / 2} cy={size / 2} r={(size - 20) / 2} fill="none" stroke="url(#sg)" strokeWidth={6} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} filter="url(#glow)" style={{ transition: "stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1)" }} />
                {Array.from({ length: 36 }).map((_, i) => { const a = (i * 10) * Math.PI / 180; const r1 = (size - 20) / 2 + 4; const r2 = (size - 20) / 2 + (i % 3 === 0 ? 10 : 6); return (<line key={i} x1={size / 2 + r1 * Math.cos(a)} y1={size / 2 + r1 * Math.sin(a)} x2={size / 2 + r2 * Math.cos(a)} y2={size / 2 + r2 * Math.sin(a)} stroke={i % 3 === 0 ? `${color}60` : `${color}20`} strokeWidth={i % 3 === 0 ? 1.5 : 0.5} />); })}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 3 }}>{children}</div>
        </div>
    );
};

/*  GLASS CARD  */
const GlassCard = ({ children, style, delay = 0, glow, onClick }) => (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -2, transition: { duration: 0.2 } }} onClick={onClick}
        style={{ background: `linear-gradient(135deg, ${C.card} 0%, rgba(5,10,18,0.9) 100%)`, border: `1px solid ${C.border}`, borderRadius: 20, padding: "1.5rem", position: "relative", overflow: "hidden", backdropFilter: "blur(20px)", boxShadow: glow || "0 4px 30px rgba(0,0,0,0.3)", cursor: onClick ? "pointer" : "default", ...style }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: 40, height: 40, borderTop: `2px solid ${C.accent}30`, borderLeft: `2px solid ${C.accent}30`, borderRadius: "20px 0 0 0", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 40, height: 40, borderBottom: `2px solid ${C.accentAlt}20`, borderRight: `2px solid ${C.accentAlt}20`, borderRadius: "0 0 20px 0", pointerEvents: "none" }} />
        {children}
    </motion.div>
);

/*  SECTION TITLE  */
const SectionTitle = ({ icon, title, badge, action, color = C.accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}12`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{icon}</div>
            <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "0.02em" }}>{title}</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {badge && <span style={{ background: `${color}12`, border: `1px solid ${color}30`, padding: "0.25rem 0.65rem", borderRadius: 20, color, fontSize: "0.7rem", fontWeight: 700 }}>{badge}</span>}
            {action}
        </div>
    </div>
);

/*  NEON BUTTON  */
const NeonButton = ({ children, color = C.accent, onClick, disabled, size = "md", style: sx }) => {
    const s = { sm: { padding: "0.4rem 0.8rem", fontSize: "0.72rem", borderRadius: 10 }, md: { padding: "0.55rem 1.1rem", fontSize: "0.8rem", borderRadius: 12 }, lg: { padding: "0.7rem 1.5rem", fontSize: "0.9rem", borderRadius: 14 } };
    return (
        <motion.button whileHover={!disabled ? { scale: 1.04, boxShadow: `0 0 25px ${color}40` } : {}} whileTap={!disabled ? { scale: 0.96 } : {}} onClick={() => { if (!disabled) { playSound("click"); onClick?.(); } }} disabled={disabled}
            style={{ background: disabled ? `${C.dim}30` : `${color}15`, border: `1px solid ${disabled ? C.dim : color}40`, color: disabled ? C.dim : color, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "0.4rem", transition: "all 0.3s ease", ...s[size], ...sx }}>
            {children}
        </motion.button>
    );
};

/*  STAT CARD  */
const StatCard = ({ icon, label, value, color, delay = 0, suffix = "" }) => (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.5 }} whileHover={{ y: -4, boxShadow: `0 8px 30px ${color}20` }}
        style={{ background: `linear-gradient(145deg, ${C.card}, ${C.bgAlt})`, border: `1px solid ${color}18`, borderRadius: 16, padding: "1.1rem", display: "flex", alignItems: "center", gap: "0.85rem", flex: 1, minWidth: 155, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: `radial-gradient(circle, ${color}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${color}18, ${color}08)`, border: `1px solid ${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{icon}</div>
        <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{value}</span>
                {suffix && <span style={{ fontSize: "0.7rem", color: C.dim, fontWeight: 600 }}>{suffix}</span>}
            </div>
            <div style={{ fontSize: "0.68rem", color: C.muted, fontWeight: 600, marginTop: 3 }}>{label}</div>
        </div>
    </motion.div>
);

/*  PILL  */
const Pill = ({ color, children, style: sx }) => (
    <span style={{ background: `${color}12`, border: `1px solid ${color}30`, padding: "0.25rem 0.6rem", borderRadius: 20, color, fontSize: "0.7rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem", ...sx }}>{children}</span>
);

/*  PROGRESS BAR  */
const ProgressBar = ({ value, max, color, label, sublabel }) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 600 }}>{label}</span>
                <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>{sublabel || value}</span>
            </div>
            <div style={{ width: "100%", height: 6, background: C.glassBr, borderRadius: 3, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 10px ${color}40` }} />
            </div>
        </div>
    );
};

/*  CYCLE VISUALIZER  */
const CycleVisualizer = ({ activePhase, completedPhases }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flexWrap: "wrap", padding: "0.5rem 0" }}>
        {CYCLE_PHASES.map((phase, i) => {
            const isActive = activePhase === phase.key;
            const isDone = completedPhases?.includes(phase.key);
            return (
                <React.Fragment key={phase.key}>
                    <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: isActive ? 1.08 : 1, boxShadow: isActive ? `0 0 30px ${phase.color}40` : "none" }} transition={{ delay: i * 0.06, duration: 0.4 }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem", padding: "0.7rem 0.6rem", borderRadius: 14, minWidth: 78, background: isActive ? `${phase.color}12` : isDone ? `${C.green}06` : C.glass, border: isActive ? `2px solid ${phase.color}` : isDone ? `1px solid ${C.green}30` : `1px solid ${C.glassBr}`, position: "relative" }}>
                        {isActive && <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ position: "absolute", inset: -2, borderRadius: 16, border: `2px solid ${phase.color}50`, pointerEvents: "none" }} />}
                        <span style={{ fontSize: "1.4rem", filter: isActive ? `drop-shadow(0 0 8px ${phase.color})` : "none" }}>{isDone && !isActive ? "" : phase.icon}</span>
                        <span style={{ fontSize: "0.58rem", fontWeight: 900, letterSpacing: "0.08em", color: isActive ? phase.color : isDone ? C.green : C.dim }}>{phase.label}</span>
                        <span style={{ fontSize: "0.5rem", color: C.dim }}>{phase.desc}</span>
                    </motion.div>
                    {i < CYCLE_PHASES.length - 1 && (
                        <div style={{ position: "relative", width: 28, height: 2, flexShrink: 0 }}>
                            <div style={{ width: "100%", height: "100%", borderRadius: 1, background: isDone ? `linear-gradient(90deg, ${C.green}, ${CYCLE_PHASES[i + 1] && completedPhases?.includes(CYCLE_PHASES[i + 1].key) ? C.green : C.dim})` : C.glassBr }} />
                            {isActive && <motion.div animate={{ x: [0, 28, 0] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ position: "absolute", top: -2, left: 0, width: 6, height: 6, borderRadius: "50%", background: phase.color, boxShadow: `0 0 10px ${phase.color}` }} />}
                        </div>
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

/*  TYPING INDICATOR  */
const TypingIndicator = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.2rem" }}>
            {[0, 1, 2].map(j => (<motion.div key={j} animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: j * 0.15 }} style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent }} />))}
        </div>
        <span style={{ color: C.muted, fontSize: "0.72rem", fontStyle: "italic" }}>AI sinir alar alyor...</span>
    </div>
);

/* 
   MAIN COMPONENT
    */
const AIOperatorPanel = () => {
    const { theme: _theme } = useApp();
    void _theme; // tema deiikliinde re-render tetiklenir
    const [loading, setLoading] = useState(true);
    const [cycleLoading, setCycleLoading] = useState(false);
    const [operatorStatus, setOperatorStatus] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [quickStats, setQuickStats] = useState(null);
    const [cycleResult, setCycleResult] = useState(null);
    const [activePhase, setActivePhase] = useState(null);
    const [completedPhases, setCompletedPhases] = useState([]);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatSessionId] = useState(() => `panel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [pulseActive, setPulseActive] = useState(false);
    const chatEndRef = useRef(null);
    const chatInputRef = useRef(null);

    const particlesInit = useCallback(async (engine) => { await loadSlim(engine); }, []);

    const loadStatus = useCallback(async () => {
        try {
            setError(null);
            const [statusRes, alertsRes, statsRes] = await Promise.all([
                API.get("/ai-chat/operator/status"),
                API.get("/ai-chat/alerts"),
                API.get("/ai-chat/quick-stats"),
            ]);
            if (statusRes.data.success) setOperatorStatus(statusRes.data);
            if (alertsRes.data.success) setAlerts(alertsRes.data.alerts || []);
            if (statsRes.data.success) setQuickStats(statsRes.data.stats);
        } catch (err) {
            setError("Operatr durumu yklenemedi: " + (err.response?.data?.message || err.message));
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadStatus(); }, [loadStatus]);
    useEffect(() => { const iv = setInterval(loadStatus, 60000); return () => clearInterval(iv); }, [loadStatus]);

    const changeMode = async (mode) => {
        try {
            playSound("whoosh");
            const res = await API.post("/ai-chat/operator/mode", { mode });
            if (res.data.success) { setOperatorStatus(prev => ({ ...prev, operationMode: mode })); playSound("success"); }
        } catch (err) { setError("Mod deitirilemedi: " + (err.response?.data?.message || err.message)); }
    };

    const runCycle = async () => {
        setCycleLoading(true); setCycleResult(null); setCompletedPhases([]); setActivePhase(null); setPulseActive(true); playSound("whoosh");
        const phases = ["observe", "analyze", "decide", "act", "verify", "learn"];
        for (let i = 0; i < phases.length; i++) { setActivePhase(phases[i]); await new Promise(r => setTimeout(r, 500)); setCompletedPhases(prev => [...prev, phases[i]]); }
        try {
            const mode = operatorStatus?.operationMode || "assisted";
            const res = await API.post("/ai-chat/operator/cycle", { mode });
            if (res.data.success) { setCycleResult(res.data); loadStatus(); playSound("success"); }
        } catch (err) { setError("Dng altrlamad: " + (err.response?.data?.message || err.message)); }
        finally { setCycleLoading(false); setActivePhase(null); setPulseActive(false); }
    };

    const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    const sendChat = async (text) => {
        const msg = (text || chatInput).trim();
        if (!msg || chatLoading) return;
        setChatMessages(prev => [...prev, { role: "user", content: msg, ts: new Date().toISOString() }]);
        setChatInput(""); setChatLoading(true); scrollChat(); playSound("click");
        try {
            const res = await API.post("/ai-chat/message", { message: msg, sessionId: chatSessionId });
            if (res.data.success && res.data.response) {
                setChatMessages(prev => [...prev, { role: "ai", content: res.data.response.content, ts: new Date().toISOString(), suggestions: res.data.response.suggestions || [] }]);
                playSound("success");
            } else {
                setChatMessages(prev => [...prev, { role: "ai", content: "Bir hata olutu. Tekrar deneyin. ", ts: new Date().toISOString(), suggestions: ["Tekrar dene"] }]);
            }
        } catch {
            setChatMessages(prev => [...prev, { role: "ai", content: "Balant hatas. Sunucu eriilebilir olduundan emin olun. ", ts: new Date().toISOString(), suggestions: ["Tekrar dene"] }]);
        } finally { setChatLoading(false); scrollChat(); }
    };

    useEffect(() => { scrollChat(); }, [chatMessages]);

    const currentMode = operatorStatus?.operationMode || "assisted";
    const modeConfig = MODES[currentMode];
    const rating = RATINGS[operatorStatus?.businessHealth?.rating] || RATINGS.unknown;
    const healthScore = operatorStatus?.businessHealth?.score || 0;
    const criticalAlerts = alerts.filter(a => a.severity === "critical" || a.severity === "high");
    const lastSuggestions = chatMessages.length > 0 ? ([...chatMessages].reverse().find(m => m.role === "ai")?.suggestions || []) : [];
    // SEC: nce HTML entity escape  XSS korumas, sonra gvenli markdown dnmleri
    const renderContent = (text) => {
        if (!text) return "";
        const escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        return escaped
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br/>");
    };

    const TABS = [
        { id: "overview", label: "Genel Bak", icon: "", color: C.accent },
        { id: "alerts", label: `Uyarlar (${alerts.length})`, icon: "", color: criticalAlerts.length > 0 ? C.red : C.green },
        { id: "memory", label: "Hafza & renme", icon: "", color: C.purple },
        { id: "chat", label: "AI Sohbet", icon: "", color: C.accentAlt },
        { id: "cycle", label: "Dng Sonular", icon: "", color: C.blue },
    ];

    if (loading) return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, gap: "1.5rem" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} style={{ position: "relative", width: 80, height: 80 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${C.glassBr}`, borderTop: `3px solid ${C.accent}` }} />
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} style={{ position: "absolute", inset: 10, borderRadius: "50%", border: `2px solid ${C.glassBr}`, borderTop: `2px solid ${C.accentAlt}` }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}></div>
            </motion.div>
            <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ color: C.accent, fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.1em" }}>NEURAL NETWORK BALATILIYOR...</motion.span>
        </div>
    );

    /*  RENDER  */
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: `linear-gradient(180deg, ${C.bg} 0%, #080d18 50%, ${C.bg} 100%)`, position: "relative", overflow: "hidden", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
            {/* BG Effects */}
            <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}><Particles id="bg-p" init={particlesInit} options={particlesConfig} /></div>
            <NeuralNetworkBg />
            <DataStream />
            <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
                <motion.div animate={{ x: [0, 100, -50, 0], y: [0, -80, 60, 0], scale: [1, 1.3, 0.8, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", top: "10%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${C.accent}06 0%, transparent 70%)`, filter: "blur(60px)" }} />
                <motion.div animate={{ x: [0, -80, 60, 0], y: [0, 100, -40, 0], scale: [1, 0.8, 1.2, 1] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", bottom: "20%", right: "10%", width: 350, height: 350, borderRadius: "50%", background: `radial-gradient(circle, ${C.accentAlt}05 0%, transparent 70%)`, filter: "blur(60px)" }} />
            </div>

            {/*  HEADER  */}
            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} style={{ background: `linear-gradient(180deg, rgba(5,10,18,0.95) 0%, rgba(5,10,18,0.8) 100%)`, borderBottom: `1px solid ${C.border}`, padding: "1rem clamp(1rem,4vw,2.5rem)", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <motion.div animate={pulseActive ? { scale: [1, 1.15, 1], boxShadow: [`0 0 20px ${C.accent}30`, `0 0 40px ${C.accent}60`, `0 0 20px ${C.accent}30`] } : {}} transition={{ duration: 1.5, repeat: pulseActive ? Infinity : 0 }}
                            style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}20, ${C.accentAlt}20)`, border: `1px solid ${C.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", boxShadow: C.neonGlow }}></motion.div>
                        <div>
                            <h1 style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentAlt} 50%, ${C.pink} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "clamp(1.1rem,2.5vw,1.5rem)", fontWeight: 900, margin: 0, letterSpacing: "0.02em" }}>LYSIA AI OPERATR</h1>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                                <Pill color={modeConfig.color}>{modeConfig.emoji} {modeConfig.label}</Pill>
                                <Pill color={rating.color}>{rating.emoji} Salk: {healthScore}/100</Pill>
                                {criticalAlerts.length > 0 && <Pill color={C.red}> {criticalAlerts.length} uyar</Pill>}
                                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                                <span style={{ color: C.green, fontSize: "0.65rem", fontWeight: 600 }}>ONLINE</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                        <NeonButton color={C.muted} onClick={loadStatus} size="sm"> Yenile</NeonButton>
                        <NeonButton color={C.accent} onClick={runCycle} disabled={cycleLoading} style={{ background: cycleLoading ? `${C.accent}10` : `linear-gradient(135deg, ${C.accent}20, ${C.accentAlt}20)`, boxShadow: cycleLoading ? "none" : C.neonGlow }}>
                            {cycleLoading ? <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}></motion.span> alyor...</> : <> Dng altr</>}
                        </NeonButton>
                    </div>
                </div>
                {/* Tabs */}
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "1rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
                    {TABS.map((tab, i) => (
                        <motion.button key={tab.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => { setActiveTab(tab.id); playSound("click"); }}
                            style={{ background: activeTab === tab.id ? `${tab.color}15` : "transparent", border: activeTab === tab.id ? `1px solid ${tab.color}40` : `1px solid transparent`, borderRadius: 10, padding: "0.5rem 0.9rem", cursor: "pointer", color: activeTab === tab.id ? tab.color : C.muted, fontSize: "0.78rem", fontWeight: activeTab === tab.id ? 700 : 600, display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0, boxShadow: activeTab === tab.id ? `0 0 15px ${tab.color}15` : "none" }}>
                            <span>{tab.icon}</span> {tab.label}
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* Error */}
            <AnimatePresence>{error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ background: `${C.red}10`, borderBottom: `1px solid ${C.red}25`, padding: "0.6rem clamp(1rem,4vw,2.5rem)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 50 }}>
                    <span style={{ color: C.red, fontSize: "0.8rem", fontWeight: 600 }}> {error}</span>
                    <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: "1rem" }}></button>
                </motion.div>
            )}</AnimatePresence>

            {/*  CONTENT  */}
            <div style={{ padding: "clamp(1rem,3vw,1.75rem) clamp(1rem,4vw,2.5rem)", position: "relative", zIndex: 1 }}>
                {/* Cycle Visualizer */}
                <GlassCard delay={0.05} style={{ marginBottom: "1.25rem" }} glow={pulseActive ? C.neonGlowStrong : undefined}>
                    <SectionTitle icon="" title="AI Otonom Dngs" badge={cycleLoading ? " alyor..." : cycleResult ? `${cycleResult.durationMs || 0}ms` : " Hazr"} color={cycleLoading ? C.yellow : C.accent} />
                    <CycleVisualizer activePhase={activePhase} completedPhases={completedPhases} />
                </GlassCard>

                <AnimatePresence mode="wait">
                    {/*  OVERVIEW TAB  */}
                    {activeTab === "overview" && (
                        <motion.div key="ov" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                                <StatCard icon="" label="Toplam rn" value={operatorStatus?.stats?.productCount || 0} color={C.accent} delay={0.1} />
                                <StatCard icon="" label="Sipari (30g)" value={operatorStatus?.stats?.orderCount || 0} color={C.green} delay={0.15} />
                                <StatCard icon="" label="Bekleyen neri" value={operatorStatus?.stats?.pendingRecs || 0} color={C.yellow} delay={0.2} />
                                <StatCard icon="" label="AI Hafza" value={operatorStatus?.memory?.totalMemories || 0} color={C.purple} delay={0.25} />
                                <StatCard icon="" label="Uyar" value={alerts.length} color={alerts.length > 0 ? C.red : C.green} delay={0.3} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
                                {/* Health */}
                                <GlassCard delay={0.15} glow={`0 0 30px ${rating.color}15`}>
                                    <SectionTitle icon="" title="letme Sal" color={rating.color} />
                                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                                        <HoloRing size={170} score={healthScore} color={rating.color}>
                                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 200 }} style={{ fontSize: "2.5rem", fontWeight: 900, color: rating.color, textShadow: `0 0 20px ${rating.color}60`, lineHeight: 1 }}>{healthScore}</motion.span>
                                            <span style={{ fontSize: "0.6rem", color: C.muted, fontWeight: 600 }}>/ 100</span>
                                            <Pill color={rating.color} style={{ marginTop: 4, fontSize: "0.65rem" }}>{rating.emoji} {rating.label}</Pill>
                                        </HoloRing>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                            {[{ l: "rn", v: operatorStatus?.stats?.productCount || 0, i: "", c: C.accent }, { l: "Sipari", v: operatorStatus?.stats?.orderCount || 0, i: "", c: C.green }, { l: "Bekleyen", v: operatorStatus?.stats?.pendingRecs || 0, i: "", c: C.yellow }].map((s, idx) => (
                                                <motion.div key={s.l} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + idx * 0.1 }} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                    <span style={{ fontSize: "1rem" }}>{s.i}</span>
                                                    <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 600, minWidth: 65 }}>{s.l}</span>
                                                    <span style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 800 }}>{s.v}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </GlassCard>
                                {/* Mode */}
                                <GlassCard delay={0.2}>
                                    <SectionTitle icon="" title="Kontrol Modu" color={modeConfig.color} />
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {Object.entries(MODES).map(([key, mode]) => {
                                            const isA = currentMode === key;
                                            return (
                                                <motion.button key={key} whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.99 }} onClick={() => changeMode(key)}
                                                    style={{ background: isA ? `${mode.color}10` : C.glass, border: isA ? `2px solid ${mode.color}60` : `1px solid ${C.glassBr}`, borderRadius: 14, padding: "0.9rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left", position: "relative", overflow: "hidden", boxShadow: isA ? mode.glow : "none" }}>
                                                    {isA && <motion.div animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ duration: 3, repeat: Infinity }} style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${mode.color}10, transparent)`, pointerEvents: "none" }} />}
                                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: isA ? mode.gradient : `${mode.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0, boxShadow: isA ? `0 4px 15px ${mode.color}40` : "none" }}>{mode.icon}</div>
                                                    <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                            <span style={{ color: isA ? mode.color : C.text, fontSize: "0.88rem", fontWeight: 700 }}>{mode.label}</span>
                                                            {isA && <span style={{ color: mode.color, fontSize: "0.7rem" }}></span>}
                                                        </div>
                                                        <span style={{ color: C.dim, fontSize: "0.7rem" }}>{mode.desc}</span>
                                                    </div>
                                                    {isA && <motion.div animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: 10, height: 10, borderRadius: "50%", background: mode.color, boxShadow: `0 0 10px ${mode.color}` }} />}
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </GlassCard>
                                {/* Guardrails */}
                                <GlassCard delay={0.25}>
                                    <SectionTitle icon="" title="Gvenlik Limitleri" color={C.yellow} />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                        {operatorStatus?.guardrails && Object.entries(operatorStatus.guardrails).map(([key, value]) => {
                                            const cfg = { maxPriceChangePercent: { l: "Max Fiyat Deiimi", i: "", u: "%", c: C.yellow }, maxStockOrderQuantity: { l: "Max Stok Siparii", i: "", u: " adet", c: C.blue }, minProfitMarginPercent: { l: "Min Kr Marj", i: "", u: "%", c: C.green }, maxActionsPerHour: { l: "Max Aksiyon/Saat", i: "", u: "", c: C.accent }, requireApprovalForCritical: { l: "Kritik Onay", i: "", u: "", c: C.red }, cooldownMinutes: { l: "Cooldown", i: "", u: " dk", c: C.purple } };
                                            const cc = cfg[key] || { l: key, i: "", u: "", c: C.dim };
                                            return (
                                                <div key={key} style={{ background: `${cc.c}06`, border: `1px solid ${cc.c}15`, borderRadius: 12, padding: "0.7rem 0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <span style={{ fontSize: "1.1rem" }}>{cc.i}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ color: C.dim, fontSize: "0.6rem", fontWeight: 600 }}>{cc.l}</div>
                                                        <div style={{ color: cc.c, fontSize: "0.95rem", fontWeight: 800 }}>{typeof value === "boolean" ? (value ? " Evet" : " Hayr") : `${value}${cc.u}`}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </GlassCard>
                            </div>
                            {/* Quick Commands */}
                            <GlassCard delay={0.3}>
                                <SectionTitle icon="" title="Hzl Komutlar" color={C.accent} />
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                    {[
                                        { label: "Genel Durum", msg: "Nasl gidiyor?", icon: "", color: C.accent },
                                        { label: "Sat Analizi", msg: "Satlarm nasl?", icon: "", color: C.green },
                                        { label: "Stok Kontrol", msg: "Stok durumu nedir?", icon: "", color: C.blue },
                                        { label: "Sorun Tespiti", msg: "Sorunlar gster", icon: "", color: C.red },
                                        { label: "neriler", msg: "Ne yapmalym?", icon: "", color: C.yellow },
                                        { label: "Pazaryeri Karlatr", msg: "Pazaryerlerini karlatr", icon: "", color: C.purple },
                                        { label: "Kr Analizi", msg: "Kr marjlarm nasl?", icon: "", color: C.pink },
                                        { label: "Tahmin", msg: "nmzdeki hafta tahmini", icon: "", color: C.accentAlt },
                                    ].map((cmd, i) => (
                                        <motion.button key={cmd.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.04 }}
                                            whileHover={{ scale: 1.06, y: -3, boxShadow: `0 6px 20px ${cmd.color}20` }} whileTap={{ scale: 0.95 }}
                                            onClick={() => { setActiveTab("chat"); setTimeout(() => sendChat(cmd.msg), 300); }}
                                            style={{ background: `${cmd.color}08`, border: `1px solid ${cmd.color}20`, borderRadius: 12, padding: "0.6rem 0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            <span style={{ fontSize: "1rem" }}>{cmd.icon}</span>
                                            <span style={{ color: cmd.color, fontSize: "0.75rem", fontWeight: 700 }}>{cmd.label}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}

                    {/*  ALERTS TAB  */}
                    {activeTab === "alerts" && (
                        <motion.div key="al" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            <GlassCard delay={0.1}>
                                <SectionTitle icon="" title="Proaktif Uyarlar" badge={`${alerts.length} uyar`} color={criticalAlerts.length > 0 ? C.red : C.green} />
                                {alerts.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} style={{ fontSize: "3.5rem", marginBottom: "1rem" }}></motion.div>
                                        <p style={{ color: C.green, fontSize: "1.1rem", fontWeight: 800, margin: 0, textShadow: `0 0 20px ${C.green}40` }}>Tm sistemler normal!</p>
                                        <p style={{ color: C.dim, fontSize: "0.82rem", margin: "0.4rem 0 0" }}>Kritik uyar bulunmuyor.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                        {alerts.map((alert, i) => {
                                            const sc = alert.severity === "critical" ? C.red : alert.severity === "high" ? C.yellow : C.blue;
                                            return (
                                                <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                                    style={{ background: `${sc}06`, borderLeft: `4px solid ${sc}`, borderRadius: "0 14px 14px 0", padding: "0.9rem 1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${sc}12`, border: `1px solid ${sc}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                                                        {alert.icon || (alert.severity === "critical" ? "" : alert.severity === "high" ? "" : "")}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                            <span style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700 }}>{alert.title}</span>
                                                            <Pill color={sc}>{alert.severity === "critical" ? "Kritik" : alert.severity === "high" ? "Yksek" : "Bilgi"}</Pill>
                                                        </div>
                                                        <p style={{ color: C.muted, fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}>{alert.message}</p>
                                                        {alert.suggestion && <div style={{ marginTop: "0.4rem" }}><span style={{ fontSize: "0.75rem" }}></span> <span style={{ color: C.accent, fontSize: "0.72rem", fontWeight: 600 }}>{alert.suggestion}</span></div>}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </GlassCard>
                        </motion.div>
                    )}

                    {/*  MEMORY TAB  */}
                    {activeTab === "memory" && (
                        <motion.div key="mem" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
                                <GlassCard delay={0.1}>
                                    <SectionTitle icon="" title="AI Hafza statistikleri" color={C.purple} />
                                    <ProgressBar label="Toplam Hafza" value={operatorStatus?.memory?.totalMemories || 0} max={200} color={C.accentAlt} sublabel={`${operatorStatus?.memory?.totalMemories || 0} kayt`} />
                                    <ProgressBar label="Aksiyon Sonular" value={operatorStatus?.memory?.actionMemories || 0} max={100} color={C.green} sublabel={`${operatorStatus?.memory?.actionMemories || 0} sonu`} />
                                    <ProgressBar label="renilen Patternler" value={operatorStatus?.memory?.learnedPatterns || 0} max={50} color={C.yellow} sublabel={`${operatorStatus?.memory?.learnedPatterns || 0} pattern`} />
                                    <ProgressBar label="Kullanc Tercihleri" value={operatorStatus?.memory?.userPreferences || 0} max={30} color={C.purple} sublabel={`${operatorStatus?.memory?.userPreferences || 0} tercih`} />
                                    <ProgressBar label="Pazar grleri" value={operatorStatus?.memory?.marketInsights || 0} max={50} color={C.blue} sublabel={`${operatorStatus?.memory?.marketInsights || 0} igr`} />
                                </GlassCard>
                                <GlassCard delay={0.15}>
                                    <SectionTitle icon="" title="Son AI Aksiyonlar" color={C.green} />
                                    {operatorStatus?.memory?.recentActions?.length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                            {operatorStatus.memory.recentActions.map((a, i) => (
                                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                                                    style={{ background: `${a.success ? C.green : C.red}06`, borderLeft: `3px solid ${a.success ? C.green : C.red}`, borderRadius: "0 10px 10px 0", padding: "0.65rem 0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <span style={{ fontSize: "0.95rem" }}>{a.success ? "" : ""}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>{a.action}</span>
                                                        <span style={{ color: C.dim, fontSize: "0.68rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.target}</span>
                                                    </div>
                                                    <Pill color={a.success ? C.green : C.red}>{a.success ? "Baarl" : "Baarsz"}</Pill>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                                            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.5rem" }}></span>
                                            <p style={{ color: C.dim, fontSize: "0.88rem", margin: 0, fontWeight: 600 }}>Henz aksiyon kayd yok</p>
                                            <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.3rem 0 0" }}>Dng altrarak AI'n renmesini balatn</p>
                                        </div>
                                    )}
                                </GlassCard>
                                <GlassCard delay={0.2}>
                                    <SectionTitle icon="" title="renme Dngs" color={C.pink} />
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                        {[
                                            { icon: "", title: "Otonom Dng", desc: "6 fazl dng: Gzlem  Analiz  Karar  Aksiyon  Dorulama  renme", color: C.accent },
                                            { icon: "", title: "Veri Toplama", desc: "rnler, sipariler, pazaryeri verileri srekli izleniyor", color: C.blue },
                                            { icon: "", title: "Pattern Tanma", desc: "Baarl/baarsz aksiyonlar hafzaya kaydediliyor", color: C.purple },
                                            { icon: "", title: "Srekli yileme", desc: "Her dngde AI daha iyi kararlar almay reniyor", color: C.green },
                                            { icon: "", title: "Gvenlik Katman", desc: "Guardrail limitleri alamaz, kritik aksiyonlar onay gerektirir", color: C.yellow },
                                        ].map((item, i) => (
                                            <motion.div key={item.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                                                style={{ background: `${item.color}05`, border: `1px solid ${item.color}12`, borderRadius: 12, padding: "0.75rem 0.9rem", display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                                                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${item.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.05rem", flexShrink: 0 }}>{item.icon}</div>
                                                <div>
                                                    <span style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 700 }}>{item.title}</span>
                                                    <p style={{ color: C.dim, fontSize: "0.7rem", margin: "0.15rem 0 0", lineHeight: 1.4 }}>{item.desc}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </GlassCard>
                            </div>
                        </motion.div>
                    )}

                    {/*  CHAT TAB  */}
                    {activeTab === "chat" && (
                        <motion.div key="ch" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            <GlassCard delay={0.1} style={{ padding: 0, overflow: "hidden" }} glow={C.purpleGlow}>
                                <div style={{ background: `linear-gradient(135deg, ${C.accentAlt}12, ${C.accent}08)`, borderBottom: `1px solid ${C.glassBr}`, padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <motion.div animate={{ boxShadow: [`0 0 15px ${C.accentAlt}30`, `0 0 25px ${C.accentAlt}50`, `0 0 15px ${C.accentAlt}30`] }} transition={{ duration: 3, repeat: Infinity }}
                                            style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${C.accentAlt}, ${C.accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}></motion.div>
                                        <div>
                                            <span style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 800 }}>AI Operatr Sohbet</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                                                <span style={{ color: C.muted, fontSize: "0.7rem" }}>evrimii  Neural Network Aktif</span>
                                            </div>
                                        </div>
                                    </div>
                                    <NeonButton color={C.muted} size="sm" onClick={() => setChatMessages([])}> Temizle</NeonButton>
                                </div>
                                <div style={{ height: 480, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", background: `linear-gradient(180deg, rgba(5,10,18,0.5) 0%, rgba(5,10,18,0.8) 100%)` }}>
                                    {chatMessages.length === 0 && (
                                        <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                                            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }} style={{ fontSize: "3.5rem", marginBottom: "1rem" }}></motion.div>
                                            <p style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Merhaba! </p>
                                            <p style={{ color: C.muted, fontSize: "0.85rem", margin: "0.4rem 0 1.2rem" }}>Ben Pazarynetim AI Operatr. letmenizi ynetmek iin buradaym.</p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", justifyContent: "center" }}>
                                                {["Nasl gidiyor?", "Satlarm nasl?", "Stok durumu", "Ne yapmalym?"].map((s, i) => (
                                                    <motion.button key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                                                        whileHover={{ scale: 1.06, boxShadow: `0 4px 15px ${C.accent}20` }} whileTap={{ scale: 0.95 }}
                                                        onClick={() => sendChat(s)}
                                                        style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}25`, borderRadius: 20, padding: "0.45rem 0.85rem", cursor: "pointer", color: C.accent, fontSize: "0.75rem", fontWeight: 600 }}>{s}</motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {chatMessages.map((msg, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                                            <div style={{ maxWidth: "82%", padding: "0.8rem 1.1rem", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.role === "user" ? `linear-gradient(135deg, ${C.accentAlt}, ${C.accent}80)` : `linear-gradient(135deg, ${C.card}, rgba(15,22,40,0.95))`, border: msg.role === "user" ? "none" : `1px solid ${C.glassBr}`, boxShadow: msg.role === "user" ? `0 4px 20px ${C.accentAlt}25` : `0 2px 10px rgba(0,0,0,0.2)` }}>
                                                <div style={{ color: msg.role === "user" ? "#fff" : C.text, fontSize: "0.83rem", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
                                                <div style={{ textAlign: "right", marginTop: "0.3rem", fontSize: "0.58rem", color: msg.role === "user" ? "rgba(255,255,255,0.5)" : C.dim }}>{msg.ts ? new Date(msg.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {chatLoading && <TypingIndicator />}
                                    <div ref={chatEndRef} />
                                </div>
                                {lastSuggestions.length > 0 && !chatLoading && (
                                    <div style={{ padding: "0.5rem 1.25rem", borderTop: `1px solid ${C.glassBr}`, display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                        {lastSuggestions.slice(0, 4).map(s => (
                                            <motion.button key={s} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => sendChat(s)}
                                                style={{ background: `${C.accent}06`, border: `1px solid ${C.accent}18`, borderRadius: 18, padding: "0.3rem 0.7rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>{s}</motion.button>
                                        ))}
                                    </div>
                                )}
                                <div style={{ padding: "0.8rem 1.25rem", borderTop: `1px solid ${C.glassBr}`, display: "flex", gap: "0.5rem", alignItems: "flex-end", background: "rgba(5,10,18,0.5)" }}>
                                    <textarea ref={chatInputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                                        placeholder="AI Operatr'e mesaj yazn..." disabled={chatLoading} rows={1}
                                        style={{ flex: 1, background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 14, padding: "0.7rem 0.9rem", color: "#fff", fontSize: "0.83rem", resize: "none", outline: "none", fontFamily: "inherit", maxHeight: 80 }}
                                        onFocus={(e) => { e.target.style.borderColor = `${C.accent}50`; e.target.style.boxShadow = `0 0 15px ${C.accent}10`; }}
                                        onBlur={(e) => { e.target.style.borderColor = C.glassBr; e.target.style.boxShadow = "none"; }} />
                                    <motion.button whileHover={{ scale: 1.1, boxShadow: `0 0 20px ${C.accentAlt}40` }} whileTap={{ scale: 0.9 }} onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
                                        style={{ width: 44, height: 44, borderRadius: 14, background: chatInput.trim() && !chatLoading ? `linear-gradient(135deg, ${C.accentAlt}, ${C.accent})` : C.glass, border: `1px solid ${chatInput.trim() && !chatLoading ? `${C.accent}40` : C.glassBr}`, cursor: chatInput.trim() && !chatLoading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0, color: chatInput.trim() && !chatLoading ? "#fff" : C.dim }}></motion.button>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}

                    {/*  CYCLE RESULTS TAB  */}
                    {activeTab === "cycle" && (
                        <motion.div key="cy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            {cycleResult ? (<>
                                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                                    {[{ l: "AI Skor", v: cycleResult.analysis?.aiScore?.overall || 0, c: C.accentAlt, i: "" }, { l: "Kararlar", v: cycleResult.decisions?.decisions?.length || 0, c: C.yellow, i: "" }, { l: "Uygulanan", v: cycleResult.actionResults?.length || 0, c: C.green, i: "" }, { l: "Kritik", v: cycleResult.decisions?.criticalCount || 0, c: C.red, i: "" }, { l: "Sre", v: `${cycleResult.durationMs || 0}`, c: C.blue, i: "", s: "ms" }].map((s, i) => (
                                        <StatCard key={s.l} icon={s.i} label={s.l} value={s.v} color={s.c} delay={i * 0.08} suffix={s.s} />
                                    ))}
                                </div>
                                {cycleResult.analysis?.focusItems?.length > 0 && (
                                    <GlassCard delay={0.15} style={{ marginBottom: "1.25rem" }}>
                                        <SectionTitle icon="" title="ncelikli Konular" color={C.yellow} />
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                            {cycleResult.analysis.focusItems.map((item, i) => (
                                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                                    style={{ background: C.glass, border: `1px solid ${C.glassBr}`, borderRadius: 10, padding: "0.7rem 0.9rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                    <span style={{ fontSize: "1.1rem" }}>{item.icon || ""}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 700 }}>{item.title}</span>
                                                        <span style={{ color: C.dim, fontSize: "0.72rem", marginLeft: "0.5rem" }}>{item.description}</span>
                                                    </div>
                                                    <Pill color={C.yellow}>{item.impact}</Pill>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </GlassCard>
                                )}
                                {cycleResult.decisions?.decisions?.length > 0 && (
                                    <GlassCard delay={0.2}>
                                        <SectionTitle icon="" title="AI Kararlar" badge={`${cycleResult.decisions.decisions.length} karar`} color={C.accentAlt} />
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 400, overflowY: "auto" }}>
                                            {cycleResult.decisions.decisions.slice(0, 15).map((d, i) => {
                                                const uc = d.urgency === "critical" ? C.red : d.urgency === "high" ? C.yellow : C.blue;
                                                return (
                                                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                                        style={{ background: `${uc}05`, borderLeft: `3px solid ${uc}`, borderRadius: "0 10px 10px 0", padding: "0.7rem 0.9rem" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                                                            <span style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 700 }}>{d.icon || ""} {d.title}</span>
                                                            <Pill color={uc}>{d.urgency}</Pill>
                                                        </div>
                                                        <p style={{ color: C.dim, fontSize: "0.72rem", margin: 0 }}>{d.description}</p>
                                                        {d.impactLabel && <span style={{ color: C.green, fontSize: "0.7rem", fontWeight: 600 }}> {d.impactLabel}</span>}
                                                        {d._memoryNote && <span style={{ color: C.accentAlt, fontSize: "0.68rem", display: "block", marginTop: "0.15rem" }}> {d._memoryNote}</span>}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </GlassCard>
                                )}
                            </>) : (
                                <GlassCard delay={0.1}>
                                    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                                        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} style={{ fontSize: "3.5rem", marginBottom: "1rem" }}></motion.div>
                                        <p style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Henz dng altrlmad</p>
                                        <p style={{ color: C.dim, fontSize: "0.85rem", margin: "0.4rem 0 1.2rem" }}>Yukardaki "Dng altr" butonuna tklayarak AI'n tam analiz dngsn balatn.</p>
                                        <NeonButton color={C.accent} onClick={runCycle} disabled={cycleLoading} size="lg"> imdi altr</NeonButton>
                                    </div>
                                </GlassCard>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/*  GLOBAL STYLES  */}
            <style>{`
                @keyframes holoSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes matrixFall { 0% { transform: translateY(-200px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(calc(100vh + 200px)); opacity: 0; } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(0,240,255,0.2); border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(0,240,255,0.4); }
            `}</style>
        </div>
    );
};

export default AIOperatorPanel;

