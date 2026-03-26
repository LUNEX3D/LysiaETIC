const User = require("../../models/User");

// Tüm kullanıcıları getir
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json(users);
    } catch (error) {
        console.error("Hata: Kullanıcıları getirirken hata oluştu!", error);
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// Tek bir kullanıcıyı getir
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }
        res.json(user);
    } catch (error) {
        console.error("Hata: Kullanıcı bulunamadı!", error);
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// Kullanıcıyı güncelle
exports.updateUser = async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, role },
            { new: true }
        ).select("-password");
        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }
        res.json({ message: "Kullanıcı bilgileri güncellendi!", user });
    } catch (error) {
        console.error("Hata: Kullanıcı güncellenirken hata oluştu!", error);
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// Kullanıcının rolünü güncelle
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ["user", "admin", "dev", "seller", "moderator"];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: "Geçersiz rol!" });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select("-password");
        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        res.json({ message: "Kullanıcı rolü güncellendi!", user });
    } catch (error) {
        console.error("Hata: Kullanıcı rolü güncellenirken hata oluştu!", error);
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// Kullanıcıyı sil
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }
        res.json({ message: "Kullanıcı başarıyla silindi." });
    } catch (error) {
        console.error("Hata: Kullanıcı silinirken hata oluştu!", error);
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};