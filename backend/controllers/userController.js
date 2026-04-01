/**
 * User Controller — LysiaETIC
 * ✅ FIX #18: console.log → logger
 */
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        // Use req.user._id (set by authMiddleware)
        const userId = req.user._id || req.userId;

        logger.info("📝 Profil getiriliyor, userId:", userId);

        const user = await User.findById(userId).select("-password");

        if (!user) {
            logger.error("❌ Kullanıcı bulunamadı:", userId);
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Auto-fix invalid role 'users' -> 'user'
        if (user.role === 'users') {
            logger.info("🔧 Geçersiz role düzeltiliyor: 'users' -> 'user'");
            await User.updateOne(
                { _id: user._id },
                { $set: { role: 'user' } }
            );
            user.role = 'user'; // Update in-memory object
        }

        logger.info("✅ Profil başarıyla getirildi:", user.email);

        // Return user with success flag
        res.json({
            success: true,
            ...user.toObject()
        });
    } catch (error) {
        logger.error("❌ Profil getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası",
            error: error.message
        });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { name, email, phone, company, address, taxInfo, avatar } = req.body;

        logger.info("📝 Profil güncelleme isteği:", { userId, name, email, phone, company });

        const user = await User.findById(userId);

        if (!user) {
            logger.error("❌ Kullanıcı bulunamadı:", userId);
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Check if email is already taken by another user
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser._id.toString() !== userId.toString()) {
                logger.error("❌ E-posta zaten kullanımda:", email);
                return res.status(400).json({
                    success: false,
                    message: "Bu e-posta adresi zaten kullanılıyor"
                });
            }
        }

        // Update basic info (NEVER update role from user input for security)
        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;

        // Initialize profile if not exists
        if (!user.profile) user.profile = {};

        // Update profile info
        if (avatar !== undefined) user.profile.avatar = avatar;
        if (phone !== undefined) user.profile.phone = phone;
        if (company !== undefined) user.profile.company = company;

        if (address) {
            if (!user.profile.address) user.profile.address = {};
            user.profile.address = {
                street: address.street || user.profile.address.street || "",
                city: address.city || user.profile.address.city || "",
                state: address.state || user.profile.address.state || "",
                zipCode: address.zipCode || user.profile.address.zipCode || "",
                country: address.country || user.profile.address.country || "TR"
            };
        }

        if (taxInfo) {
            if (!user.profile.taxInfo) user.profile.taxInfo = {};
            user.profile.taxInfo = {
                taxNumber: taxInfo.taxNumber || user.profile.taxInfo.taxNumber || "",
                taxOffice: taxInfo.taxOffice || user.profile.taxInfo.taxOffice || ""
            };
        }

        // Mark modified for nested objects
        user.markModified('profile');

        // Save with validation, but skip role validation if it's already set
        await user.save({ validateModifiedOnly: true });

        logger.info("✅ Profil başarıyla güncellendi:", userId);

        const updatedUser = await User.findById(userId).select("-password");
        res.json({
            success: true,
            message: "Profil başarıyla güncellendi",
            user: updatedUser
        });
    } catch (error) {
        logger.error("❌ Profil güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Profil güncellenirken bir hata oluştu",
            error: error.message
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { currentPassword, newPassword } = req.body;

        logger.info("🔒 Şifre değiştirme isteği:", userId);

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Mevcut şifre ve yeni şifre gereklidir"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Yeni şifre en az 6 karakter olmalıdır"
            });
        }

        // Get user with password
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            logger.error("❌ Mevcut şifre yanlış");
            return res.status(400).json({
                success: false,
                message: "Mevcut şifre yanlış"
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Update security info
        if (!user.security) user.security = {};
        user.security.lastPasswordChange = new Date();

        await user.save();

        logger.info("✅ Şifre başarıyla değiştirildi");

        res.json({
            success: true,
            message: "Şifre başarıyla değiştirildi"
        });
    } catch (error) {
        logger.error("❌ Şifre değiştirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Şifre değiştirilirken bir hata oluştu",
            error: error.message
        });
    }
};

// Update notification settings
exports.updateNotificationSettings = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { email, sms, push, orderNotifications, stockNotifications, financeNotifications } = req.body;

        logger.info("🔔 Bildirim tercihleri güncelleme:", userId);

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Update preferences
        if (!user.preferences) user.preferences = {};
        if (!user.preferences.notifications) user.preferences.notifications = {};

        if (email !== undefined) user.preferences.notifications.email = email;
        if (sms !== undefined) user.preferences.notifications.sms = sms;
        if (push !== undefined) user.preferences.notifications.push = push;
        if (orderNotifications !== undefined) user.preferences.orderNotifications = orderNotifications;
        if (stockNotifications !== undefined) user.preferences.stockNotifications = stockNotifications;
        if (financeNotifications !== undefined) user.preferences.financeNotifications = financeNotifications;

        user.markModified('preferences');

        await user.save();

        logger.info("✅ Bildirim tercihleri güncellendi");

        res.json({
            success: true,
            message: "Bildirim tercihleri güncellendi"
        });
    } catch (error) {
        logger.error("❌ Bildirim güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Bildirim tercihleri güncellenirken bir hata oluştu",
            error: error.message
        });
    }
};

// Generate API key
exports.generateApiKey = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { name } = req.body;

        logger.info("🔑 API anahtarı oluşturma:", userId, name);

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "API anahtarı adı gereklidir"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Generate random API key
        const apiKey = `lx_${crypto.randomBytes(32).toString('hex')}`;

        // Create API key object
        const newApiKey = {
            name: name.trim(),
            key: apiKey,
            createdAt: new Date(),
            lastUsed: null,
            permissions: ["read", "write"] // Default permissions
        };

        // Add to user's API keys
        if (!user.apiKeys) user.apiKeys = [];
        user.apiKeys.push(newApiKey);

        await user.save();

        logger.info("✅ API anahtarı oluşturuldu");

        res.json({
            success: true,
            ...newApiKey
        });
    } catch (error) {
        logger.error("❌ API anahtarı oluşturma hatası:", error);
        res.status(500).json({
            success: false,
            message: "API anahtarı oluşturulurken bir hata oluştu",
            error: error.message
        });
    }
};

// Revoke API key
exports.revokeApiKey = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { keyId } = req.params;

        logger.info("🗑️ API anahtarı iptal:", userId, keyId);

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        if (!user.apiKeys || user.apiKeys.length === 0) {
            return res.status(404).json({
                success: false,
                message: "API anahtarı bulunamadı"
            });
        }

        // Remove API key
        const initialLength = user.apiKeys.length;
        user.apiKeys = user.apiKeys.filter(key => key._id.toString() !== keyId);

        if (user.apiKeys.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: "API anahtarı bulunamadı"
            });
        }

        await user.save();

        logger.info("✅ API anahtarı iptal edildi");

        res.json({
            success: true,
            message: "API anahtarı iptal edildi"
        });
    } catch (error) {
        logger.error("❌ API anahtarı iptal hatası:", error);
        res.status(500).json({
            success: false,
            message: "API anahtarı iptal edilirken bir hata oluştu",
            error: error.message
        });
    }
};

// Verify password (for showing current password)
exports.verifyPassword = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { password } = req.body;

        logger.info("🔐 Şifre doğrulama isteği:", userId);

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Şifre gereklidir"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            logger.error("❌ Şifre yanlış");
            return res.status(400).json({
                success: false,
                message: "Şifre yanlış"
            });
        }

        logger.info("✅ Şifre doğrulandı");

        res.json({
            success: true,
            message: "Şifre doğrulandı",
            verified: true
        });
    } catch (error) {
        logger.error("❌ Şifre doğrulama hatası:", error);
        res.status(500).json({
            success: false,
            message: "Şifre doğrulanırken bir hata oluştu",
            error: error.message
        });
    }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;

        logger.info("📊 İstatistikler getiriliyor:", userId);

        // Get marketplace count
        const marketplaceCount = await Marketplace.countDocuments({ userId });

        // Try to get orders and products, but don't fail if models don't exist
        let totalOrders = 0;
        let totalRevenue = 0;
        let activeProducts = 0;

        try {
            const Order = require("../models/Order");
            totalOrders = await Order.countDocuments({ userId });

            const revenueResult = await Order.aggregate([
                { $match: { userId } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]);
            totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
        } catch (err) {
            logger.info("⚠️ Order model bulunamadı, varsayılan değerler kullanılıyor");
        }

        try {
            const Product = require("../models/Product");
            activeProducts = await Product.countDocuments({ userId, status: "active" });
        } catch (err) {
            logger.info("⚠️ Product model bulunamadı, varsayılan değerler kullanılıyor");
        }

        logger.info("✅ İstatistikler:", { totalOrders, totalRevenue, activeProducts, marketplaceCount });

        res.json({
            success: true,
            totalOrders,
            totalRevenue,
            activeProducts,
            marketplaceCount
        });
    } catch (error) {
        logger.error("❌ İstatistik getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "İstatistikler getirilirken bir hata oluştu",
            error: error.message,
            totalOrders: 0,
            totalRevenue: 0,
            activeProducts: 0,
            marketplaceCount: 0
        });
    }
};
