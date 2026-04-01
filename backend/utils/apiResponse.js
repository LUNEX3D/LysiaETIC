/**
 * Standard API Response Wrapper — LysiaETIC
 *
 * Tüm API yanıtları için tutarlı format sağlar.
 *
 * Kullanım:
 *   const { success, error, paginated } = require("../utils/apiResponse");
 *   return success(res, "İşlem başarılı", { user });
 *   return error(res, "Kullanıcı bulunamadı", 404);
 */

/**
 * Başarılı yanıt
 * @param {Object} res — Express response
 * @param {string} message — Başarı mesajı
 * @param {Object} data — Yanıt verisi
 * @param {number} statusCode — HTTP status (default: 200)
 */
function success(res, message = "İşlem başarılı", data = {}, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        message,
        ...data
    });
}

/**
 * Hata yanıtı
 * @param {Object} res — Express response
 * @param {string} message — Hata mesajı
 * @param {number} statusCode — HTTP status (default: 500)
 * @param {Object} details — Ek hata detayları (sadece development'ta)
 */
function error(res, message = "Sunucu hatası", statusCode = 500, details = null) {
    const response = {
        success: false,
        message
    };

    if (details && process.env.NODE_ENV !== "production") {
        response.details = details;
    }

    return res.status(statusCode).json(response);
}

/**
 * Sayfalanmış yanıt
 * @param {Object} res — Express response
 * @param {string} message — Mesaj
 * @param {Array} items — Veri listesi
 * @param {number} total — Toplam kayıt sayısı
 * @param {number} page — Mevcut sayfa
 * @param {number} limit — Sayfa başına kayıt
 */
function paginated(res, message, items, total, page = 1, limit = 20) {
    return res.status(200).json({
        success: true,
        message,
        data: items,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
        }
    });
}

module.exports = { success, error, paginated };
