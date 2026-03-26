const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Yetkilendirme hatası: Token bulunamadı!"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Yetkilendirme hatası: Kullanıcı bulunamadı!"
            });
        }

        // Set both user object and userId for compatibility
        req.user = user;
        req.userId = user._id;

        next();
    } catch (error) {
        console.error("Auth middleware hatası:", error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: "Yetkilendirme hatası: Geçersiz token!"
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Yetkilendirme hatası: Token süresi dolmuş!"
            });
        }

        res.status(500).json({
            success: false,
            message: "Sunucu hatası: Yetkilendirme işlemi başarısız!"
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Yetkilendirme hatası: Kullanıcı bulunamadı!"
        });
    }

    const role = (req.user.role || "").toLowerCase();
    if (!(["admin", "dev"].includes(role))) {
        return res.status(403).json({
            success: false,
            message: "Yetki yok: Admin erişimi gerekli!"
        });
    }

    next();
};

module.exports = { authMiddleware, adminMiddleware };