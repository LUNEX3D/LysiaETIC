/**
 * Sağlayıcı Bağlantı Modalı — gruplu, anlaşılır form
 */
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaLink, FaSpinner, FaExclamationTriangle, FaInfoCircle, FaShieldAlt } from "react-icons/fa";
import { colors, modalOverlay, modalContent, buttonPrimary, buttonSecondary, inputStyle, labelStyle, helpTextStyle, infoBannerStyle, formSectionTitleStyle } from "../styles";
import { isValidSovosGbIdentifier } from "../constants";

const ProviderConnectModal = ({ provider, connecting, connectionError, onConnect, onClose }) => {
    const [formData, setFormData] = useState({});
    const [selectedEnv, setSelectedEnv] = useState("test");

    const fieldMap = useMemo(() => {
        const map = {};
        (provider?.fields || []).forEach((f) => { map[f.key] = f; });
        return map;
    }, [provider]);

    if (!provider) return null;

    const handleSubmit = () => {
        if (connecting) return;
        onConnect(provider, formData, selectedEnv);
    };

    const updateField = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const groups = provider.fieldGroups?.length
        ? provider.fieldGroups
        : [{ title: "Bağlantı Bilgileri", subtitle: "", keys: (provider.fields || []).map((f) => f.key) }];

    const gbInvalid = provider.authType === "sovos"
        && formData.senderIdentifier?.trim()
        && !isValidSovosGbIdentifier(formData.senderIdentifier);

    const renderField = (field) => (
        <div key={field.key}>
            <label style={labelStyle}>
                {field.label} {field.required && <span style={{ color: colors.red }}>*</span>}
            </label>
            <input
                type={field.type || "text"}
                placeholder={field.placeholder || field.hint || ""}
                value={formData[field.key] || ""}
                onChange={(e) => updateField(field.key, e.target.value)}
                style={inputStyle}
            />
            {field.hint && <p style={{ ...helpTextStyle, fontSize: "0.72rem" }}>{field.hint}</p>}
        </div>
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { if (!connecting) onClose(); }}
                style={{ ...modalOverlay, overflowY: "auto" }}
            >
                <motion.div
                    initial={{ scale: 0.92, y: 40 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 40 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...modalContent, maxWidth: 560, maxHeight: "92vh", overflowY: "auto" }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                            <span style={{ fontSize: "2.25rem" }}>{provider.logo}</span>
                            <div>
                                <h3 style={{ color: "#fff", fontSize: "1.15rem", fontWeight: 800, margin: 0 }}>{provider.name}</h3>
                                <p style={{ color: colors.dim, fontSize: "0.76rem", margin: "0.2rem 0 0" }}>Güvenli bağlantı kurulumu</p>
                            </div>
                        </div>
                        <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                            onClick={() => { if (!connecting) onClose(); }}
                            style={{ background: colors.red + "15", border: "1px solid " + colors.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: colors.red }}>
                            <FaTimes />
                        </motion.button>
                    </div>

                    {provider.environments?.length > 0 && (
                        <div style={{ marginBottom: "1.25rem" }}>
                            <label style={labelStyle}>Ortam</label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                {provider.environments.map((env) => (
                                    <motion.button key={env.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={() => setSelectedEnv(env.id)}
                                        style={{
                                            flex: 1,
                                            background: selectedEnv === env.id ? colors.accent + "20" : colors.glass,
                                            border: selectedEnv === env.id ? "2px solid " + colors.accent : "1px solid " + colors.glassBr,
                                            borderRadius: 10, padding: "0.65rem", cursor: "pointer", textAlign: "center",
                                        }}>
                                        <p style={{ color: selectedEnv === env.id ? colors.accent : "#fff", fontSize: "0.82rem", fontWeight: 700, margin: 0 }}>{env.label}</p>
                                        <p style={{ color: colors.dim, fontSize: "0.62rem", margin: "0.2rem 0 0", fontFamily: "monospace", wordBreak: "break-all" }}>{env.url}</p>
                                    </motion.button>
                                ))}
                            </div>
                            {provider.authType === "sovos" && selectedEnv === "production" && (
                                <div style={{ ...infoBannerStyle("orange"), marginTop: "0.65rem" }}>
                                    cloudtest hesabı için <strong>Test Ortamı</strong> seçin.
                                </div>
                            )}
                        </div>
                    )}

                    {groups.map((group, gi) => (
                        <div key={gi} style={{ marginBottom: "1.15rem", padding: "1rem", background: colors.glass, border: "1px solid " + colors.glassBr, borderRadius: 12 }}>
                            <h4 style={{ ...formSectionTitleStyle, marginBottom: group.subtitle ? "0.25rem" : "0.75rem" }}>
                                {group.title}
                                {group.optional && <span style={{ color: colors.dim, fontSize: "0.68rem", fontWeight: 500, marginLeft: 8 }}>(opsiyonel)</span>}
                            </h4>
                            {group.subtitle && <p style={{ ...helpTextStyle, marginBottom: "0.75rem", fontSize: "0.74rem" }}>{group.subtitle}</p>}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                                {group.keys.map((key) => {
                                    const field = fieldMap[key];
                                    return field ? renderField(field) : null;
                                })}
                            </div>
                        </div>
                    ))}

                    {gbInvalid && (
                        <div style={{ ...infoBannerStyle("yellow"), marginBottom: "1rem" }}>
                            GB etiketi <strong>urn:mail:...</strong> formatında olmalı. Düz e-posta yazmayın.
                        </div>
                    )}

                    {connectionError && (
                        <div style={{ ...infoBannerStyle("red"), marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                            <FaExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{connectionError}</span>
                        </div>
                    )}

                    <div style={{ ...infoBannerStyle("accent"), marginBottom: "1.15rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <FaShieldAlt style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>
                            {provider.connectNote || "Şifreler cihazınızda saklanmaz; yalnızca oturum token'ı tutulur."}
                        </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={handleSubmit} disabled={connecting}
                            style={{ ...buttonPrimary, flex: 1, padding: "0.75rem", opacity: connecting ? 0.7 : 1 }}>
                            {connecting ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Bağlanıyor...</> : <><FaLink /> Bağlantıyı Test Et ve Kaydet</>}
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => { if (!connecting) onClose(); }}
                            style={{ ...buttonSecondary, padding: "0.75rem 1.25rem" }}>
                            İptal
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ProviderConnectModal;
