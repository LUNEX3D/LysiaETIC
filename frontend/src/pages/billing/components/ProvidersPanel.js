/**
 * Sağlayıcılar Paneli — Tüm sağlayıcıları listele, bağla/bağlantı kes
 * LysiaETIC
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    FaLink, FaTimes, FaCog, FaCheckCircle, FaClock,
} from "react-icons/fa";
import { colors } from "../styles";
import { Pill } from "./SharedUI";
import { PROVIDERS } from "../constants";
import ProviderConnectModal from "./ProviderConnectModal";

const ProvidersPanel = ({ connectedProviders, connecting, connectionError, onConnect, onDisconnect, onClearError }) => {
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const handleOpenModal = (provider) => {
        setSelectedProvider(provider);
        setShowModal(true);
        if (onClearError) onClearError();
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedProvider(null);
        if (onClearError) onClearError();
    };

    const handleConnect = async (provider, formData, env) => {
        const success = await onConnect(provider, formData, env);
        if (success) {
            handleCloseModal();
        }
    };

    const handleDisconnect = (providerId) => {
        if (window.confirm("Bu sağlayıcı bağlantısını kaldırmak istediğinize emin misiniz?")) {
            onDisconnect(providerId);
        }
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                    <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                        E-Fatura Sağlayıcıları
                    </h3>
                    <p style={{ color: colors.dim, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                        Kullanmak istediğiniz e-Fatura sağlayıcısını seçin ve bağlayın
                    </p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
                {PROVIDERS.map((provider, i) => {
                    const isProviderConnected = connectedProviders.some((p) => p.id === provider.id);
                    const connectedData = connectedProviders.find((p) => p.id === provider.id);

                    return (
                        <motion.div
                            key={provider.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            whileHover={{ y: -4, boxShadow: "0 12px 40px " + provider.color + "20" }}
                            style={{
                                background: "linear-gradient(135deg, " + colors.card + " 0%, rgba(15,20,25,0.9) 100%)",
                                border: "1px solid " + (isProviderConnected ? colors.green + "40" : provider.color + "25"),
                                borderRadius: 16,
                                padding: "1.5rem",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {/* Glow */}
                            <div style={{
                                position: "absolute",
                                top: -20,
                                right: -20,
                                width: 120,
                                height: 120,
                                background: "radial-gradient(circle, " + provider.color + "15 0%, transparent 70%)",
                                pointerEvents: "none",
                            }} />

                            {/* Header */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                                <div style={{
                                    fontSize: "2rem",
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: provider.color + "15",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    {provider.logo}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                                        {provider.name}
                                    </h4>
                                    {isProviderConnected && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                                            <Pill color={colors.green}><FaCheckCircle /> Bağlı</Pill>
                                            <span style={{ color: colors.dim, fontSize: "0.65rem" }}>
                                                {connectedData?.env === "production" ? "Canlı" : "Test"}
                                            </span>
                                        </div>
                                    )}
                                    {provider.comingSoon && (
                                        <Pill color={colors.yellow}><FaClock /> Yakında</Pill>
                                    )}
                                </div>
                            </div>

                            {/* Açıklama */}
                            <p style={{ color: colors.muted, fontSize: "0.8rem", margin: "0 0 1rem", lineHeight: 1.5 }}>
                                {provider.description}
                            </p>

                            {/* Özellikler */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "1.25rem" }}>
                                {provider.features.map((f) => (
                                    <span
                                        key={f}
                                        style={{
                                            background: provider.color + "10",
                                            border: "1px solid " + provider.color + "25",
                                            borderRadius: 6,
                                            padding: "0.2rem 0.5rem",
                                            color: provider.color,
                                            fontSize: "0.68rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {f}
                                    </span>
                                ))}
                            </div>

                            {/* Butonlar */}
                            {provider.comingSoon ? (
                                <div style={{
                                    background: colors.glass,
                                    border: "1px solid " + colors.glassBr,
                                    borderRadius: 10,
                                    padding: "0.6rem",
                                    textAlign: "center",
                                }}>
                                    <span style={{ color: colors.dim, fontSize: "0.8rem", fontWeight: 600 }}>
                                        🔜 Çok yakında kullanıma açılacak
                                    </span>
                                </div>
                            ) : isProviderConnected ? (
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            flex: 1,
                                            background: colors.green + "15",
                                            border: "1px solid " + colors.green + "30",
                                            borderRadius: 10,
                                            padding: "0.6rem",
                                            cursor: "pointer",
                                            color: colors.green,
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "0.4rem",
                                        }}
                                    >
                                        <FaCog /> Ayarlar
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleDisconnect(provider.id)}
                                        style={{
                                            background: colors.red + "15",
                                            border: "1px solid " + colors.red + "30",
                                            borderRadius: 10,
                                            padding: "0.6rem 1rem",
                                            cursor: "pointer",
                                            color: colors.red,
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                        }}
                                    >
                                        <FaTimes />
                                    </motion.button>
                                </div>
                            ) : (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleOpenModal(provider)}
                                    style={{
                                        width: "100%",
                                        background: "linear-gradient(135deg, " + provider.color + " 0%, " + provider.color + "cc 100%)",
                                        border: "none",
                                        borderRadius: 10,
                                        padding: "0.7rem",
                                        cursor: "pointer",
                                        color: "#fff",
                                        fontSize: "0.85rem",
                                        fontWeight: 700,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "0.4rem",
                                        boxShadow: "0 4px 16px " + provider.color + "40",
                                    }}
                                >
                                    <FaLink /> Bağlan
                                </motion.button>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Bağlantı Modalı ── */}
            {showModal && selectedProvider && (
                <ProviderConnectModal
                    provider={selectedProvider}
                    connecting={connecting}
                    connectionError={connectionError}
                    onConnect={handleConnect}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default React.memo(ProvidersPanel);
