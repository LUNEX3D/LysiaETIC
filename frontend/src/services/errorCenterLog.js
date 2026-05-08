/**
 * Hata Merkezi — ürün yükleme / pazaryeri işlemlerini merkezi günlüğe yazar.
 * API hataları axios interceptor'ında otomatik kaydedilir.
 */
import { pushClientError, pushUserActivity } from "./clientErrorStore";

/** API'ye gitmeden oluşan hata mesajları (doğrulama veya istemci) */
export function logUiClientError(source, message, meta = {}) {
    const m = typeof meta === "object" && meta !== null ? meta : {};
    const { path: _omitPath, ...restMeta } = m;
    void _omitPath;
    const path = String(m.path || "/ui").slice(0, 300) || "/ui";
    pushClientError({
        source,
        statusCode: 0,
        path,
        method: "UI",
        message: String(message || "Hata").slice(0, 500),
        meta: restMeta,
    });
}


/** Başarılı veya bilgi işlemleri (son işlemler listesi) */
export function logUserActivity(source, title, message, level = "info", meta = {}) {
    pushUserActivity({
        source,
        title: String(title || "").slice(0, 200),
        message: String(message || "").slice(0, 500),
        level,
        meta: typeof meta === "object" && meta !== null ? meta : {},
    });
}
