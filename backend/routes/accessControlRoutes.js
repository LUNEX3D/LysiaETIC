/**
 * Access Control Routes — LysiaETIC
 *
 * Admin tarafı: incident listesi, kullanıcı bloklama/açma, kullanıcı geçmişi.
 * Kullanıcı tarafı: erişim yardım talebi (bloklu da olsa).
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/admin/adminAccessController");

const router = express.Router();

/**
 * Soft auth — block check yapmaz, sadece token'ı doğrular.
 * Yardım talebi gibi "bloklu kullanıcının da erişebilmesi gereken" endpoint'ler için.
 */
async function softAuth(req, res, next) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, message: "Token gerekli." });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("_id name email role accessStatus");
        if (!user) {
            return res.status(401).json({ success: false, message: "Kullanıcı bulunamadı." });
        }
        req.user = user;
        req.userId = user._id;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: err.name === "TokenExpiredError"
                ? "Oturum süresi dolmuş, lütfen tekrar giriş yapın."
                : "Geçersiz yetki.",
        });
    }
}

// ── Kullanıcı tarafı (bloklu/abonelik bitmiş olsa bile erişebilir) ───────────
router.post("/help",       softAuth, ctrl.requestHelp);
router.get("/my-status",   softAuth, ctrl.getMyStatus);

// ── Admin tarafı ─────────────────────────────────────────────────────────────
router.get("/incidents",            authMiddleware, adminMiddleware, ctrl.listIncidents);
router.get("/blocked-users",        authMiddleware, adminMiddleware, ctrl.listBlockedUsers);
router.get("/troubled-users",       authMiddleware, adminMiddleware, ctrl.listTroubledUsers);
router.get("/diagnose",             authMiddleware, adminMiddleware, ctrl.diagnoseUser);
router.get("/users/:id/history",    authMiddleware, adminMiddleware, ctrl.getUserAccessHistory);
router.post("/users/:id/block",     authMiddleware, adminMiddleware, ctrl.blockUser);
router.post("/users/:id/unblock",   authMiddleware, adminMiddleware, ctrl.unblockUser);
router.post("/incidents/:id/resolve", authMiddleware, adminMiddleware, ctrl.resolveIncident);

module.exports = router;
