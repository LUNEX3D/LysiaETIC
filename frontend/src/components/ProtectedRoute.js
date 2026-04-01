/**
 * ProtectedRoute — LysiaETIC
 *
 * Auth guard: Token yoksa login'e yönlendirir.
 * Opsiyonel rol kontrolü: requiredRoles prop'u ile belirli rollere erişim kısıtlanır.
 *
 * Kullanım:
 *   <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
 *   <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin","dev"]}><AdminDashboard /></ProtectedRoute>} />
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
    const location = useLocation();
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");

    // Token yoksa login'e yönlendir
    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Rol kontrolü (requiredRoles belirtilmişse)
    if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
        // Yetkisiz kullanıcıyı dashboard'a yönlendir
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;
