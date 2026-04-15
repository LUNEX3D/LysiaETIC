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
            message: "Sunucu hatası"
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
            message: "Profil güncellenirken bir hata oluştu"
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

        // ✅ SEC: Güçlü şifre politikası — authController ile tutarlı
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Yeni şifre en az 8 karakter olmalıdır"
            });
        }
        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir"
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
            message: "Şifre değiştirilirken bir hata oluştu"
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
            message: "Bildirim tercihleri güncellenirken bir hata oluştu"
        });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 ÜRÜN EŞLEŞTİRME ÖNCELİK AYARLARI
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün eşleştirme öncelik sırasını getir
 * GET /user/product-match-priority
 */
exports.getProductMatchPriority = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const user = await User.findById(userId).select("preferences.productMatchPriority");

        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const priority = user.preferences?.productMatchPriority || {
            primary: "sku",
            secondary: "barcode",
            tertiary: "name"
        };

        res.json({ success: true, productMatchPriority: priority });
    } catch (error) {
        logger.error("❌ Ürün eşleştirme ayarı getirme hatası:", error);
        res.status(500).json({ success: false, message: "Ayar getirilemedi" });
    }
};

/**
 * Ürün eşleştirme öncelik sırasını güncelle
 * PUT /user/product-match-priority
 * Body: { primary: "sku"|"barcode"|"name", secondary: ..., tertiary: ... }
 */
exports.updateProductMatchPriority = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { primary, secondary, tertiary } = req.body;

        const validValues = ["sku", "barcode", "name"];

        // Validasyon: 3 değer de farklı olmalı
        if (!validValues.includes(primary) || !validValues.includes(secondary) || !validValues.includes(tertiary)) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz değer. Kabul edilen: sku, barcode, name"
            });
        }

        const uniqueCheck = new Set([primary, secondary, tertiary]);
        if (uniqueCheck.size !== 3) {
            return res.status(400).json({
                success: false,
                message: "Her öncelik farklı bir alan olmalıdır"
            });
        }

        logger.info(`🔧 Ürün eşleştirme önceliği güncelleniyor — userId: ${userId} → 1: ${primary}, 2: ${secondary}, 3: ${tertiary}`);

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        if (!user.preferences) user.preferences = {};
        if (!user.preferences.productMatchPriority) user.preferences.productMatchPriority = {};

        user.preferences.productMatchPriority.primary = primary;
        user.preferences.productMatchPriority.secondary = secondary;
        user.preferences.productMatchPriority.tertiary = tertiary;

        user.markModified("preferences");
        await user.save();

        logger.info(`✅ Ürün eşleştirme önceliği güncellendi — userId: ${userId}`);

        res.json({
            success: true,
            message: "Ürün eşleştirme önceliği kaydedildi",
            productMatchPriority: { primary, secondary, tertiary }
        });
    } catch (error) {
        logger.error("❌ Ürün eşleştirme ayarı güncelleme hatası:", error);
        res.status(500).json({ success: false, message: "Ayar kaydedilemedi" });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 GENEL TERCİHLER (PREFERENCES) — GET & UPDATE
// ═══════════════════════════════════════════════════════════════

/**
 * Tüm kullanıcı tercihlerini getir
 * GET /user/preferences
 */
exports.getPreferences = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const user = await User.findById(userId).select("preferences");

        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const prefs = user.preferences || {};

        res.json({
            success: true,
            preferences: {
                language: prefs.language || "tr",
                timezone: prefs.timezone || "Europe/Istanbul",
                currency: prefs.currency || "TRY",
                dateFormat: prefs.dateFormat || "DD/MM/YYYY",
                tablePageSize: prefs.tablePageSize || 25,
                notifications: prefs.notifications || { email: true, sms: false, push: true },
                orderNotifications: prefs.orderNotifications !== false,
                stockNotifications: prefs.stockNotifications !== false,
                financeNotifications: prefs.financeNotifications !== false,
                syncErrorNotifications: prefs.syncErrorNotifications !== false,
                lowStockAlertThreshold: prefs.lowStockAlertThreshold || 10,
                productMatchPriority: prefs.productMatchPriority || { primary: "sku", secondary: "barcode", tertiary: "name" },
                defaultSafetyStock: prefs.defaultSafetyStock || 0,
                defaultVatRate: prefs.defaultVatRate != null ? prefs.defaultVatRate : 20,
                autoSyncEnabled: prefs.autoSyncEnabled !== false,
                autoSyncStock: prefs.autoSyncStock !== false,
                autoSyncPrice: prefs.autoSyncPrice !== false,
                autoSyncInterval: prefs.autoSyncInterval || 5,
                platformPriceMultipliers: prefs.platformPriceMultipliers || { Trendyol: 0, Hepsiburada: 0, N11: 0, Amazon: 0, "ÇiçekSepeti": 0 },
                platformCommissionRates: prefs.platformCommissionRates || { Trendyol: 0, Hepsiburada: 0, N11: 0, Amazon: 0, "ÇiçekSepeti": 0 },
            }
        });
    } catch (error) {
        logger.error("❌ Tercihler getirme hatası:", error);
        res.status(500).json({ success: false, message: "Tercihler getirilemedi" });
    }
};

/**
 * Kullanıcı tercihlerini güncelle (kısmi güncelleme destekli)
 * PUT /user/preferences
 * Body: { timezone?, currency?, dateFormat?, tablePageSize?, defaultSafetyStock?, ... }
 */
exports.updatePreferences = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const updates = req.body;

        logger.info(`🔧 Tercihler güncelleniyor — userId: ${userId}`);

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        if (!user.preferences) user.preferences = {};

        // Basit alanlar — doğrudan güncelle
        const simpleFields = [
            "timezone", "currency", "dateFormat", "tablePageSize",
            "orderNotifications", "stockNotifications", "financeNotifications",
            "syncErrorNotifications", "lowStockAlertThreshold",
            "defaultSafetyStock", "defaultVatRate",
            "autoSyncEnabled", "autoSyncStock", "autoSyncPrice", "autoSyncInterval"
        ];

        for (const field of simpleFields) {
            if (updates[field] !== undefined) {
                user.preferences[field] = updates[field];
            }
        }

        // Nested notifications objesi
        if (updates.notifications) {
            if (!user.preferences.notifications) user.preferences.notifications = {};
            if (updates.notifications.email !== undefined) user.preferences.notifications.email = updates.notifications.email;
            if (updates.notifications.sms !== undefined) user.preferences.notifications.sms = updates.notifications.sms;
            if (updates.notifications.push !== undefined) user.preferences.notifications.push = updates.notifications.push;
        }

        // Platform çarpanları
        if (updates.platformPriceMultipliers) {
            if (!user.preferences.platformPriceMultipliers) user.preferences.platformPriceMultipliers = {};
            for (const [platform, value] of Object.entries(updates.platformPriceMultipliers)) {
                user.preferences.platformPriceMultipliers[platform] = Number(value) || 0;
            }
        }

        // Platform komisyon oranları
        if (updates.platformCommissionRates) {
            if (!user.preferences.platformCommissionRates) user.preferences.platformCommissionRates = {};
            for (const [platform, value] of Object.entries(updates.platformCommissionRates)) {
                user.preferences.platformCommissionRates[platform] = Number(value) || 0;
            }
        }

        // productMatchPriority ayrı endpoint'ten yönetiliyor ama buradan da güncellenebilir
        if (updates.productMatchPriority) {
            const { primary, secondary, tertiary } = updates.productMatchPriority;
            const validValues = ["sku", "barcode", "name"];
            if (validValues.includes(primary) && validValues.includes(secondary) && validValues.includes(tertiary)) {
                const uniqueCheck = new Set([primary, secondary, tertiary]);
                if (uniqueCheck.size === 3) {
                    if (!user.preferences.productMatchPriority) user.preferences.productMatchPriority = {};
                    user.preferences.productMatchPriority.primary = primary;
                    user.preferences.productMatchPriority.secondary = secondary;
                    user.preferences.productMatchPriority.tertiary = tertiary;
                }
            }
        }

        user.markModified("preferences");
        await user.save();

        logger.info(`✅ Tercihler güncellendi — userId: ${userId}`);

        res.json({
            success: true,
            message: "Tercihler kaydedildi",
            preferences: user.preferences
        });
    } catch (error) {
        logger.error("❌ Tercihler güncelleme hatası:", error);
        res.status(500).json({ success: false, message: "Tercihler kaydedilemedi" });
    }
};

/**
 * Aktif oturumları getir
 * GET /user/sessions
 */
exports.getActiveSessions = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const user = await User.findById(userId).select("refreshTokens security.loginHistory");

        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        // Aktif refresh token'lar (süresi dolmamış)
        const now = new Date();
        const activeSessions = (user.refreshTokens || [])
            .filter(rt => rt.expiresAt > now)
            .map(rt => ({
                id: rt._id,
                device: rt.device || "Bilinmeyen Cihaz",
                createdAt: rt.createdAt,
                expiresAt: rt.expiresAt
            }));

        // Son giriş geçmişi (son 20)
        const loginHistory = (user.security?.loginHistory || [])
            .slice(-20)
            .reverse()
            .map(lh => ({
                ip: lh.ip || "—",
                device: lh.device || "—",
                location: lh.location || "—",
                timestamp: lh.timestamp
            }));

        res.json({
            success: true,
            activeSessions,
            loginHistory,
            totalActive: activeSessions.length
        });
    } catch (error) {
        logger.error("❌ Oturum bilgisi getirme hatası:", error);
        res.status(500).json({ success: false, message: "Oturum bilgileri getirilemedi" });
    }
};

/**
 * Belirli bir oturumu sonlandır
 * DELETE /user/sessions/:sessionId
 */
exports.revokeSession = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { sessionId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const initialLen = (user.refreshTokens || []).length;
        user.refreshTokens = (user.refreshTokens || []).filter(rt => rt._id.toString() !== sessionId);

        if (user.refreshTokens.length === initialLen) {
            return res.status(404).json({ success: false, message: "Oturum bulunamadı" });
        }

        await user.save();

        logger.info(`✅ Oturum sonlandırıldı — userId: ${userId}, sessionId: ${sessionId}`);

        res.json({ success: true, message: "Oturum sonlandırıldı" });
    } catch (error) {
        logger.error("❌ Oturum sonlandırma hatası:", error);
        res.status(500).json({ success: false, message: "Oturum sonlandırılamadı" });
    }
};

/**
 * Tüm oturumları sonlandır (mevcut hariç)
 * DELETE /user/sessions
 */
exports.revokeAllSessions = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const currentToken = req.headers.authorization?.replace("Bearer ", "");

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });
        }

        const count = (user.refreshTokens || []).length;
        user.refreshTokens = [];
        await user.save();

        logger.info(`✅ Tüm oturumlar sonlandırıldı — userId: ${userId}, count: ${count}`);

        res.json({ success: true, message: `${count} oturum sonlandırıldı`, count });
    } catch (error) {
        logger.error("❌ Toplu oturum sonlandırma hatası:", error);
        res.status(500).json({ success: false, message: "Oturumlar sonlandırılamadı" });
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
            message: "API anahtarı oluşturulurken bir hata oluştu"
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
            message: "API anahtarı iptal edilirken bir hata oluştu"
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
            message: "Şifre doğrulanırken bir hata oluştu"
        });
    }
};

// ✅ FIX E8: Hesap silme
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { password } = req.body;

        logger.info("🗑️ Hesap silme isteği:", userId);

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı"
            });
        }

        // Google hesabı değilse şifre doğrulaması yap
        if (user.authProvider !== "google" && user.password) {
            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: "Hesabınızı silmek için şifrenizi girin"
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Şifre yanlış"
                });
            }
        }

        // Kullanıcının marketplace entegrasyonlarını sil
        await Marketplace.deleteMany({ userId });

        // Kullanıcıyı sil
        await User.findByIdAndDelete(userId);

        logger.info(`✅ Hesap silindi: ${user.email}`);

        res.json({
            success: true,
            message: "Hesabınız ve tüm verileriniz başarıyla silindi"
        });
    } catch (error) {
        logger.error("❌ Hesap silme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Hesap silinirken bir hata oluştu"
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
            // ✅ FIX H12: Order model'de field adı "user" (userId değil), "totalPrice" (totalAmount değil)
            totalOrders = await Order.countDocuments({ user: userId });

            const revenueResult = await Order.aggregate([
                { $match: { user: userId } },
                { $group: { _id: null, total: { $sum: "$totalPrice" } } }
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
            totalOrders: 0,
            totalRevenue: 0,
            activeProducts: 0,
            marketplaceCount: 0
        });
    }
};
