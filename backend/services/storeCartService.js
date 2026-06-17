const StoreCart = require("../models/StoreCart");
const StoreProduct = require("../models/StoreProduct");

const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getOrCreateCart(storeId, sessionId) {
    let cart = await StoreCart.findOne({ storeId, sessionId });
    if (!cart) {
        cart = await StoreCart.create({
            storeId,
            sessionId,
            items: [],
            expiresAt: new Date(Date.now() + CART_TTL_MS),
        });
    } else {
        cart.expiresAt = new Date(Date.now() + CART_TTL_MS);
        await cart.save();
    }
    return cart;
}

async function getCartWithProducts(storeId, sessionId) {
    const cart = await StoreCart.findOne({ storeId, sessionId }).lean();
    if (!cart || !cart.items?.length) {
        return { items: [], subtotal: 0 };
    }
    const ids = cart.items.map((i) => i.storeProductId);
    const products = await StoreProduct.find({ _id: { $in: ids }, storeId, visible: true }).lean();
    const pmap = new Map(products.map((p) => [String(p._id), p]));
    const items = [];
    let subtotal = 0;
    for (const line of cart.items) {
        const p = pmap.get(String(line.storeProductId));
        if (!p || p.stock < line.quantity) continue;
        const lineTotal = p.price * line.quantity;
        subtotal += lineTotal;
        items.push({
            storeProductId: p._id,
            slug: p.slug,
            title: p.title,
            image: p.images?.[0] || "",
            quantity: line.quantity,
            unitPrice: p.price,
            lineTotal,
            stock: p.stock,
        });
    }
    return { items, subtotal, cartId: cart._id };
}

async function addItem(storeId, sessionId, storeProductId, quantity = 1) {
    const product = await StoreProduct.findOne({ _id: storeProductId, storeId, visible: true }).lean();
    if (!product) return { error: "Ürün bulunamadı" };
    const qty = Math.max(1, Math.min(Number(quantity) || 1, product.stock));
    const cart = await getOrCreateCart(storeId, sessionId);
    const idx = cart.items.findIndex((i) => String(i.storeProductId) === String(storeProductId));
    if (idx >= 0) {
        cart.items[idx].quantity = Math.min(product.stock, cart.items[idx].quantity + qty);
        cart.items[idx].unitPrice = product.price;
        cart.items[idx].title = product.title;
    } else {
        cart.items.push({
            storeProductId: product._id,
            quantity: qty,
            unitPrice: product.price,
            title: product.title,
        });
    }
    await cart.save();
    return getCartWithProducts(storeId, sessionId);
}

async function updateItemQty(storeId, sessionId, storeProductId, quantity) {
    const cart = await getOrCreateCart(storeId, sessionId);
    const idx = cart.items.findIndex((i) => String(i.storeProductId) === String(storeProductId));
    if (idx < 0) return { error: "Sepette yok" };
    const product = await StoreProduct.findById(storeProductId).lean();
    if (!product) return { error: "Ürün bulunamadı" };
    const qty = Math.max(0, Math.min(Number(quantity), product.stock));
    if (qty === 0) cart.items.splice(idx, 1);
    else cart.items[idx].quantity = qty;
    await cart.save();
    return getCartWithProducts(storeId, sessionId);
}

async function clearCart(storeId, sessionId) {
    await StoreCart.deleteOne({ storeId, sessionId });
    return { items: [], subtotal: 0 };
}

module.exports = {
    getCartWithProducts,
    addItem,
    updateItemQty,
    clearCart,
};
