/**
 * ProtectedRoute — LysiaETIC
 *
 * Auth guard: Token yoksa login'e yönlendirir.
 * Opsiyonel rol kontrolü: requiredRoles prop'u ile belirli rollere erişim kısıtlanır.
 * ✅ LEGAL: Yasal belge onayı kontrolü — onaylanmadıysa modal gösterilir.
 *
 * Kullanım:
 *   <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
 *   <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminDashboard /></ProtectedRoute>} />
 */

import React, { useState, useEffect, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import axios from "../services/api";
import LegalAcceptanceModal from "./LegalAcceptanceModal";
import { restoreSessionIfPossible } from "../utils/authSession";

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
    const location = useLocation();
    const [sessionToken, setSessionToken] = useState(
        () => localStorage.getItem("token") || sessionStorage.getItem("token")
    );
    const [sessionBooting, setSessionBooting] = useState(!sessionToken);
    const token = sessionToken;
    const [resolvedRole, setResolvedRole] = useState(localStorage.getItem("userRole") || null);

    // ✅ LEGAL: Yasal onay durumu
    const [legalChecked, setLegalChecked] = useState(false);
    const [showLegalModal, setShowLegalModal] = useState(false);

    const checkLegalAcceptance = useCallback(async () => {
        // localStorage'da hızlı kontrol
        if (localStorage.getItem("legalAccepted") === "true") {
            setLegalChecked(true);
            setShowLegalModal(false);
            return;
        }

        // Backend'den kontrol et
        try {
            const res = await axios.get("/auth/profile");
            if (res.data?.role) {
                setResolvedRole(res.data.role);
                localStorage.setItem("userRole", res.data.role);
            }
            if (res.data?.legalAcceptance?.accepted) {
                localStorage.setItem("legalAccepted", "true");
                localStorage.setItem("legalAcceptedAt", res.data.legalAcceptance.acceptedAt);
                setLegalChecked(true);
                setShowLegalModal(false);
            } else {
                setLegalChecked(true);
                setShowLegalModal(true);
            }
        } catch {
            // Profile alınamazsa (token geçersiz vs.) legal check'i atla, login'e düşecek
            setLegalChecked(true);
            setShowLegalModal(false);
        }
    }, []);

    useEffect(() => {
        if (token) {
            checkLegalAcceptance();
            return;
        }
        let cancelled = false;
        (async () => {
            const profile = await restoreSessionIfPossible();
            if (cancelled) return;
            if (profile?._id) {
                setSessionToken(localStorage.getItem("token") || sessionStorage.getItem("token"));
                setResolvedRole(profile.role || localStorage.getItem("userRole"));
            }
            setSessionBooting(false);
            if (!profile?._id) setLegalChecked(true);
        })();
        return () => { cancelled = true; };
    }, [token, checkLegalAcceptance]);

    if (sessionBooting) {
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f1419",
            }}>
                <div style={{
                    width: 36, height: 36,
                    border: "3px solid rgba(124,92,252,0.2)",
                    borderTopColor: "#7c5cfc",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Token yoksa login'e yönlendir
    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Rol kontrolü (requiredRoles belirtilmişse)
    if (requiredRoles.length > 0 && resolvedRole && !requiredRoles.includes(resolvedRole)) {
        // Yetkisiz kullanıcıyı dashboard'a yönlendir
        return <Navigate to="/dashboard" replace />;
    }

    // Legal check henüz tamamlanmadıysa loading göster
    if (!legalChecked) {
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f1419",
            }}>
                <div style={{
                    width: 36, height: 36,
                    border: "3px solid rgba(124,92,252,0.2)",
                    borderTopColor: "#7c5cfc",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (requiredRoles.length > 0 && !resolvedRole) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1419", color: "#94a3b8" }}>
                Yetki kontrol ediliyor...
            </div>
        );
    }

    // ✅ LEGAL: Yasal belgeler onaylanmadıysa modal göster — sayfayı kapatamaz
    if (showLegalModal) {
        return (
            <>
                {children}
                <LegalAcceptanceModal
                    onAccepted={() => {
                        setShowLegalModal(false);
                        localStorage.setItem("legalAccepted", "true");
                    }}
                />
            </>
        );
    }

    return children;
};

export default ProtectedRoute;
