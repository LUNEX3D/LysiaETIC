const Product = require("../models/Product");

const createProduct = async (productData) => {
    try {
        const newProduct = new Product(productData);
        await newProduct.save();
        return { success: true, product: newProduct };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { createProduct };
