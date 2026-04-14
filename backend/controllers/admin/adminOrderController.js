const Order = require("../../models/Order");

// ✅ Tüm siparişleri getir
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası" });
    }
};

// ✅ Tek bir siparişi getir
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: "Sipariş bulunamadı." });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası" });
    }
};

// ✅ Sipariş durumunu güncelle
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!order) {
            return res.status(404).json({ message: "Sipariş bulunamadı." });
        }
        res.json({ message: "Sipariş durumu güncellendi", order });
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası" });
    }
};
