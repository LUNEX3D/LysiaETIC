const Product = require("../../models/Product");

// ✅ Tüm ürünleri getir
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// ✅ Tek bir ürünü getir
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Ürün bulunamadı." });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// ✅ Ürünü güncelle
exports.updateProduct = async (req, res) => {
    try {
        const { name, price } = req.body;
        const product = await Product.findByIdAndUpdate(req.params.id, { name, price }, { new: true });
        if (!product) {
            return res.status(404).json({ message: "Ürün bulunamadı." });
        }
        res.json({ message: "Ürün bilgileri güncellendi", product });
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};

// ✅ Ürünü sil
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Ürün bulunamadı." });
        }
        res.json({ message: "Ürün başarıyla silindi." });
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası", error });
    }
};
