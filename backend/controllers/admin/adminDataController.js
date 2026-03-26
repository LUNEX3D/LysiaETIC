const Product = require("../../models/Product");
const Order = require("../../models/Order");

exports.getAllProductsAdmin = async (req, res) => {
    try {
        const products = await Product.find().select("name price");
        res.json(products || []);
    } catch (error) {
        console.error("Admin ürün listesi hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
};

exports.deleteProductAdmin = async (req, res) => {
    try {
        const deleted = await Product.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: "Ürün bulunamadı." });
        }
        res.json({ message: "Ürün silindi." });
    } catch (error) {
        console.error("Admin ürün silme hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
};

exports.getAllOrdersAdmin = async (req, res) => {
    try {
        const orders = await Order.find().populate("user", "name email");
        const mapped = (orders || []).map(order => ({
            _id: order._id,
            customerName: order.user?.name || "Bilinmiyor",
            total: order.totalPrice,
            status: order.status
        }));
        res.json(mapped);
    } catch (error) {
        console.error("Admin sipariş listesi hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
};