/**
 * API Response Helper — LysiaETIC
 * ✅ P2-2: Tüm API yanıtları için tutarlı format
 *
 * Standart Response Formatı:
 * {
 *   success: true/false,
 *   message: "Açıklama",
 *   data: { ... }           // Başarılı yanıtlarda
 *   error: "Hata detayı"    // Hata yanıtlarında (sadece development)
 * }
 *
 * Kullanım:
 *   const { ok, created, badRequest, notFound, forbidden, serverError } = require("../utils/apiResponse");
 *
 *   return ok(res, "Ürünler getirildi", { products, total: products.length });
 *   return created(res, "Kayıt oluşturuldu", newRecord);
 *   return badRequest(res, "E-posta gerekli");
 *   return notFound(res, "Kullanıcı bulunamadı");
 *   return forbidden(res, "Bu işlem için yetkiniz yok");
 *   return serverError(res, error);
 */

// ── 200 OK ──────────────────────────────────────────────────────────────────
const ok = (res, message = "İşlem başarılı", data = null) => {
    const response = { success: true, message };
    if (data !== null && data !== undefined) response.data = data;
    return res.status(200).json(response);
};

// ── 201 Created ─────────────────────────────────────────────────────────────
const created = (res, message = "Kayıt oluşturuldu", data = null) => {
    const response = { success: true, message };
    if (data !== null && data !== undefined) response.data = data;
    return res.status(201).json(response);
};

// ── 400 Bad Request ─────────────────────────────────────────────────────────
const badRequest = (res, message = "Geçersiz istek") => {
    return res.status(400).json({ success: false, message });
};

// ── 401 Unauthorized ────────────────────────────────────────────────────────
const unauthorized = (res, message = "Yetkisiz erişim") => {
    return res.status(401).json({ success: false, message });
};

// ── 403 Forbidden ───────────────────────────────────────────────────────────
const forbidden = (res, message = "Bu işlem için yetkiniz yok") => {
    return res.status(403).json({ success: false, message });
};

// ── 404 Not Found ───────────────────────────────────────────────────────────
const notFound = (res, message = "Kayıt bulunamadı") => {
    return res.status(404).json({ success: false, message });
};

// ── 409 Conflict ────────────────────────────────────────────────────────────
const conflict = (res, message = "Kayıt zaten mevcut") => {
    return res.status(409).json({ success: false, message });
};

// ── 429 Too Many Requests ───────────────────────────────────────────────────
const tooMany = (res, message = "Çok fazla istek — lütfen bekleyin") => {
    return res.status(429).json({ success: false, message });
};

// ── 500 Internal Server Error ───────────────────────────────────────────────
const serverError = (res, error, message = "Sunucu hatası oluştu") => {
    const response = { success: false, message };
    // Development ortamında hata detayını göster
    if (process.env.NODE_ENV !== "production" && error) {
        response.error = error.message || String(error);
    }
    return res.status(500).json(response);
};

// ── Paginated Response ──────────────────────────────────────────────────────
const paginated = (res, message, items, { page, limit, total }) => {
    return res.status(200).json({
        success: true,
        message,
        data: items,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total: Number(total),
            totalPages: Math.ceil(total / limit),
        },
    });
};

module.exports = {
    ok,
    created,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    tooMany,
    serverError,
    paginated,
};
