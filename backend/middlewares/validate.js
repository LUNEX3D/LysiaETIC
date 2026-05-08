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
        .notEmpty().withMessage("Ad zorunludur")
        .isLength({ min: 2, max: 100 }).withMessage("Ad 2-100 karakter olmalıdır"),
    body("surname")
        .trim()
        .notEmpty().withMessage("Soyad zorunludur")
        .isLength({ min: 1, max: 100 }).withMessage("Soyad 1-100 karakter olmalıdır"),
    body("email")
        .trim()
        .notEmpty().withMessage("E-posta zorunludur")
        .isEmail().withMessage("Geçerli bir e-posta adresi girin")
        .normalizeEmail(),
    body("password")
        .notEmpty().withMessage("Şifre zorunludur")
        .isLength({ min: 8 }).withMessage("Şifre en az 8 karakter olmalıdır")
        .matches(/[A-Z]/).withMessage("Şifre en az bir büyük harf içermelidir")
        .matches(/[a-z]/).withMessage("Şifre en az bir küçük harf içermelidir")
        .matches(/[0-9]/).withMessage("Şifre en az bir rakam içermelidir"),
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
        .isLength({ min: 8 }).withMessage("Şifre en az 8 karakter olmalıdır")
        .matches(/[A-Z]/).withMessage("Şifre en az bir büyük harf içermelidir")
        .matches(/[a-z]/).withMessage("Şifre en az bir küçük harf içermelidir")
        .matches(/[0-9]/).withMessage("Şifre en az bir rakam içermelidir"),
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
        .isLength({ min: 8 }).withMessage("Yeni şifre en az 8 karakter olmalıdır")
        .matches(/[A-Z]/).withMessage("Şifre en az bir büyük harf içermelidir")
        .matches(/[a-z]/).withMessage("Şifre en az bir küçük harf içermelidir")
        .matches(/[0-9]/).withMessage("Şifre en az bir rakam içermelidir"),
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
