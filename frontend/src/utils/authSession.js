/**
 * Oturum kalıcılığı — "Beni hatırla" (30 gün) vs tarayıcı oturumu
 */
import axios from "axios";
import API, { clearSession as apiClearSession } from "../services/api";

const REMEMBER_KEY = "rememberMe";

export function isRememberMeEnabled() {
    return localStorage.getItem(REMEMBER_KEY) === "true";
}

/** Giriş / yenileme sonrası token'ları doğru depoya yaz */
export function persistAuthSession({ token, refreshToken, rememberMe, user }) {
    const remember = rememberMe === true;

    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");

    if (remember) {
        if (token) localStorage.setItem("token", token);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("refreshToken");
    } else {
        if (token) sessionStorage.setItem("token", token);
        if (refreshToken) sessionStorage.setItem("refreshToken", refreshToken);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
    }

    if (user) {
        localStorage.setItem("userId", user._id || user.id || "");
        localStorage.setItem("userEmail", user.email || "");
        localStorage.setItem("userName", user.name || "Bilinmiyor");
        localStorage.setItem("userRole", user.role || "user");
    }
}

/** Çıkış — tüm oturum verileri + beni hatırla */
export function clearAuthSession() {
    localStorage.removeItem(REMEMBER_KEY);
    apiClearSession();
}

function getApiBase() {
    if (process.env.NODE_ENV === "production") return "";
    return process.env.REACT_APP_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
}

/** Access token yoksa refresh ile oturumu geri yükle */
export async function tryRefreshSession() {
    const remember = isRememberMeEnabled();
    const refreshToken = remember
        ? localStorage.getItem("refreshToken")
        : sessionStorage.getItem("refreshToken") || localStorage.getItem("refreshToken");

    if (!refreshToken) return false;

    try {
        const { data } = await axios.post(`${getApiBase()}/api/auth/refresh-token`, {
            refreshToken,
        });
        if (!data?.token) return false;
        persistAuthSession({
            token: data.token,
            refreshToken: data.refreshToken,
            rememberMe: remember,
        });
        return true;
    } catch {
        return false;
    }
}

/** Mevcut token veya refresh ile oturum geçerli mi */
export async function restoreSessionIfPossible() {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
        try {
            const res = await API.get("/auth/profile");
            return res.data;
        } catch {
            /* access süresi dolmuş olabilir */
        }
    }
    const refreshed = await tryRefreshSession();
    if (!refreshed) return null;
    try {
        const res = await API.get("/auth/profile");
        return res.data;
    } catch {
        return null;
    }
}
