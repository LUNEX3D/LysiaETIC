/**
 * Sağlayıcı Bağlantı Modalı
 * LysiaETIC
 *
 * Kullanıcının e-Fatura sağlayıcısına bağlanmasını sağlar.
 * Ortam seçimi, credential girişi, bağlantı testi.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaLink, FaSpinner, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { colors, modalOverlay, modalContent, buttonPrimary, buttonSecondary } from "../styles";

const ProviderConnectModal = ({ provider, connecting, connectionError, onConnect, onClose }) => {
    const [formData, setFormData] = useState({});
    const [selectedEnv, setSelectedEnv] = useState("test");

    if (!provider) return null;

    const handleSubmit = () => {
        onConnect(provider, formData, selectedEnv);
    };

    const updateField = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { if (!connecting) onClose(); }}
                style={modalOverlay}
            >
                <motion.div
                    initial={{ scale: 0.92, y: 40 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 40 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...modalContent, maxWidth: 520 }}
                >
                    {/* ── Header ── */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{ fontSize: "2rem" }}>{provider.logo}</span>
                            <div>
                                <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                                    {provider.name}
                                </h3>
                                <p style={{ color: colors.dim, fontSize: "0.75rem", margin: 0 }}>
                                    Bağlantı Kurulumu
                                </p>
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { if (!connecting) onClose(); }}
                            style={{
                                background: colors.red + "15",
                                border: "1px solid " + colors.red + "30",
                                borderRadius: "50%",
                                width: 32,
                                height: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: colors.red,
                                fontSize: "0.9rem",
                            }}
                        >
                            <FaTimes />
                        </motion.button>
                    </div>

                    {/* ── Ortam Seçimi ── */}
                    {provider.environments && provider.environments.length > 0 && (
                        <div style={{ marginBottom: "1.25rem" }}>
                            <label style={{ color: colors.muted, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                                Ortam Seçimi
                            </label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                {provider.environments.map((env) => (
                                    <motion.button
                                        key={env.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setSelectedEnv(env.id)}
                                        style={{
                                            flex: 1,
                                            background: selectedEnv === env.id ? colors.accent + "20" : colors.glass,
                                            border: selectedEnv === env.id
                                                ? "2px solid " + colors.accent
                                                : "1px solid " + colors.glassBr,
                                            borderRadius: 10,
                                            padding: "0.6rem",
                                            cursor: "pointer",
                                            textAlign: "center",
                                        }}
                                    >
                                        <p style={{
                                            color: selectedEnv === env.id ? colors.accent : "#fff",
                                            fontSize: "0.82rem",
                                            fontWeight: 600,
                                            margin: 0,
                                        }}>
                                            {env.label}
                                        </p>
                                        <p style={{ color: colors.dim, fontSize: "0.65rem", margin: "0.15rem 0 0", fontFamily: "monospace" }}>
                                            {env.url}
                                        </p>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Credential Alanları ── */}
                    {(provider.fields || []).map((field) => (
                        <div key={field.key} style={{ marginBottom: "1rem" }}>
                            <label style={{ color: colors.muted, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                                {field.label} {field.required && <span style={{ color: colors.red }}>*</span>}
                            </label>
                            <input
                                type={field.type || "text"}
                                placeholder={field.hint || field.label + " girin..."}
                                value={formData[field.key] || ""}
                                onChange={(e) => updateField(field.key, e.target.value)}
                                style={{
                                    width: "100%",
                                    background: colors.glass,
                                    border: "1px solid " + colors.glassBr,
                                    borderRadius: 10,
                                    padding: "0.65rem 0.85rem",
                                    color: "#fff",
                                    fontSize: "0.85rem",
                                    outline: "none",
                                    boxSizing: "border-box",
                                    transition: "border-color 0.2s",
                                }}
                                onFocus={(e) => { e.target.style.borderColor = colors.accent + "60"; }}
                                onBlur={(e) => { e.target.style.borderColor = colors.glassBr; }}
                            />
                            {field.hint && (
                                <p style={{ color: colors.dim, fontSize: "0.68rem", margin: "0.2rem 0 0" }}>
                                    💡 {field.hint}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* ── Hata Mesajı ── */}
                    {connectionError && (
                        <div style={{
                            background: colors.red + "15",
                            border: "1px solid " + colors.red + "30",
                            borderRadius: 10,
                            padding: "0.6rem 0.85rem",
                            marginBottom: "1rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}>
                            <FaExclamationTriangle style={{ color: colors.red, flexShrink: 0 }} />
                            <span style={{ color: colors.red, fontSize: "0.8rem" }}>{connectionError}</span>
                        </div>
                    )}

                    {/* ── Bilgi Notu ── */}
                    <div style={{
                        background: colors.accent + "08",
                        border: "1px solid " + colors.accent + "20",
                        borderRadius: 10,
                        padding: "0.6rem 0.85rem",
                        marginBottom: "1.25rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                    }}>
                        <FaInfoCircle style={{ color: colors.accent, flexShrink: 0, marginTop: "0.1rem" }} />
                        <span style={{ color: colors.muted, fontSize: "0.75rem", lineHeight: 1.5 }}>
                            Bağlantı bilgileriniz güvenli şekilde işlenir. Şifreler cihazınızda saklanmaz, sadece oturum token'ı tutulur. Test ortamında gerçek fatura kesilmez.
                        </span>
                    </div>

                    {/* ── Butonlar ── */}
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmit}
                            disabled={connecting}
                            style={{
                                ...buttonPrimary,
                                flex: 1,
                                padding: "0.75rem",
                                fontSize: "0.88rem",
                                opacity: connecting ? 0.7 : 1,
                                cursor: connecting ? "not-allowed" : "pointer",
                            }}
                        >
                            {connecting ? (
                                <>
                                    <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Bağlanıyor...
                                </>
                            ) : (
                                <>
                                    <FaLink /> Bağlan
                                </>
                            )}
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { if (!connecting) onClose(); }}
                            style={{
                                ...buttonSecondary,
                                padding: "0.75rem 1.5rem",
                                fontSize: "0.88rem",
                            }}
                        >
                            İptal
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ProviderConnectModal;
