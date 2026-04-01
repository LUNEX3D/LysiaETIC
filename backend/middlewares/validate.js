/**
 * Input Validation Middleware — LysiaETIC
 *
 * express-validator ile istek doğrulama.
 * Route'larda kullanım:
 *   router.post("/register", validateRegister, register);
 */

const { body, param, query, validationResult } = require("express-validator");

/**
 * Validation sonuçlarını kontrol eden middleware.
 * Hata varsa 400 döner, yoksa next() çağırır.
 */
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Geçersiz giriş verileri",
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// ─── AUTH VALIDATIONS ────────────────────────────────────────────────────────

const validateRegister = [
    body("name")
        .trim()
        .notEmpty().withMessage("Ad soyad zorunludur")
        .isLength({ min: 2, max: 100 }).withMessage("Ad soyad 2-100 karakter olmalıdır"),
    body("email")
        .trim()
        .notEmpty().withMessage("E-posta zorunludur")
        .isEmail().withMessage("Geçerli bir e-posta adresi girin")
        .normalizeEmail(),
    body("password")
        .notEmpty().withMessage("Şifre zorunludur")
        .isLength({ min: 6 }).withMessage("Şifre en az 6 karakter olmalıdır"),
    handleValidation
];

const validateLogin = [
    body("email")
        .trim()
        .notEmpty().withMessage("E-posta zorunludur")
        .isEmail().withMessage("Geçerli bir e-posta adresi girin")
        .normalizeEmail(),
    body("password")
        .notEmpty().withMessage("Şifre zorunludur"),
    handleValidation
];

const validateForgotPassword = [
    body("email")
        .trim()
        .notEmpty().withMessage("E-posta zorunludur")
        .isEmail().withMessage("Geçerli bir e-posta adresi girin")
        .normalizeEmail(),
    handleValidation
];

const validateResetPassword = [
    body("email")
        .trim()
        .notEmpty().withMessage("E-posta zorunludur")
        .isEmail().withMessage("Geçerli bir e-posta adresi girin"),
    body("code")
        .trim()
        .notEmpty().withMessage("Doğrulama kodu zorunludur")
        .isLength({ min: 6, max: 6 }).withMessage("Kod 6 haneli olmalıdır"),
    body("newPassword")
        .notEmpty().withMessage("Yeni şifre zorunludur")
        .isLength({ min: 6 }).withMessage("Şifre en az 6 karakter olmalıdır"),
    handleValidation
];

// ─── MARKETPLACE VALIDATIONS ─────────────────────────────────────────────────

const validateAddMarketplace = [
    body("marketplaceName")
        .trim()
        .notEmpty().withMessage("Pazaryeri adı zorunludur"),
    body("credentials")
        .notEmpty().withMessage("API bilgileri zorunludur")
        .isObject().withMessage("Credentials bir obje olmalıdır"),
    handleValidation
];

const validateUpdateMarketplace = [
    param("id")
        .isMongoId().withMessage("Geçersiz pazaryeri ID"),
    body("credentials")
        .notEmpty().withMessage("API bilgileri zorunludur")
        .isObject().withMessage("Credentials bir obje olmalıdır"),
    handleValidation
];

// ─── PRODUCT VALIDATIONS ─────────────────────────────────────────────────────

const validateMongoId = [
    param("id")
        .isMongoId().withMessage("Geçersiz ID formatı"),
    handleValidation
];

// ─── USER VALIDATIONS ────────────────────────────────────────────────────────

const validateChangePassword = [
    body("currentPassword")
        .notEmpty().withMessage("Mevcut şifre zorunludur"),
    body("newPassword")
        .notEmpty().withMessage("Yeni şifre zorunludur")
        .isLength({ min: 6 }).withMessage("Yeni şifre en az 6 karakter olmalıdır"),
    handleValidation
];

const validateUpdateProfile = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage("Ad soyad 2-100 karakter olmalıdır"),
    body("email")
        .optional()
        .trim()
        .isEmail().withMessage("Geçerli bir e-posta adresi girin"),
    handleValidation
];

module.exports = {
    handleValidation,
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateAddMarketplace,
    validateUpdateMarketplace,
    validateMongoId,
    validateChangePassword,
    validateUpdateProfile
};
