const mongoose = require("mongoose");
const dns = require("dns");
const Order = require("../models/Order");
const User = require("../models/User");
const Marketplace = require("../models/Marketplace");
require("dotenv").config();

// Force public DNS servers to avoid SRV lookup failures
dns.setServers(["1.1.1.1", "8.8.8.8"]);

/**
 * Script to seed sample orders for analytics testing
 */

const sampleProducts = [
    { name: "Premium Kulaklık XZ-100", barcode: "8690001234567", price: 150, category: "Elektronik" },
    { name: "Akıllı Saat Pro Max", barcode: "8690001234568", price: 300, category: "Elektronik" },
    { name: "Bluetooth Hoparlör Mini", barcode: "8690001234569", price: 120, category: "Elektronik" },
    { name: "Kablosuz Şarj Cihazı", barcode: "8690001234570", price: 100, category: "Elektronik" },
    { name: "USB-C Hub 7in1", barcode: "8690001234571", price: 100, category: "Elektronik" },
    { name: "Laptop Çantası", barcode: "8690001234572", price: 80, category: "Aksesuar" },
    { name: "Wireless Mouse", barcode: "8690001234573", price: 50, category: "Elektronik" },
    { name: "Mekanik Klavye RGB", barcode: "8690001234574", price: 250, category: "Elektronik" },
    { name: "Webcam HD 1080p", barcode: "8690001234575", price: 180, category: "Elektronik" },
    { name: "Telefon Kılıfı", barcode: "8690001234576", price: 30, category: "Aksesuar" }
];

const orderStatuses = ["Created", "Processing", "Shipped", "Delivered", "Cancelled"];

async function seedOrders() {
    try {
        // Connect to MongoDB (try local first, then cloud)
        const mongoUri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce";
        await mongoose.connect(mongoUri);
        console.log("✅ MongoDB bağlantısı başarılı");

        // Find first user (or create one)
        let user = await User.findOne();
        if (!user) {
            console.log("❌ Kullanıcı bulunamadı! Önce bir kullanıcı oluşturun.");
            process.exit(1);
        }

        console.log(`👤 Kullanıcı bulundu: ${user.email} (${user._id})`);

        // Get user's marketplaces
        let marketplaces = await Marketplace.find({ userId: user._id });

        // If no marketplaces exist, create default ones
        if (marketplaces.length === 0) {
            console.log("📦 Marketplace bulunamadı, varsayılan marketplace'ler oluşturuluyor...");
            const defaultMarketplaces = [
                { userId: user._id, marketplaceName: "Trendyol", credentials: { apiKey: "test", apiSecret: "test" } },
                { userId: user._id, marketplaceName: "Hepsiburada", credentials: { apiKey: "test", apiSecret: "test" } },
                { userId: user._id, marketplaceName: "N11", credentials: { apiKey: "test", apiSecret: "test" } }
            ];
            marketplaces = await Marketplace.insertMany(defaultMarketplaces);
            console.log(`✅ ${marketplaces.length} marketplace oluşturuldu`);
        } else {
            console.log(`🏪 ${marketplaces.length} marketplace bulundu:`, marketplaces.map(m => m.marketplaceName).join(", "));
        }

        // Drop old indexes that might cause conflicts
        try {
            await Order.collection.dropIndex("orderId_1");
            console.log("🔧 Eski orderId index'i silindi");
        } catch (err) {
            // Index yoksa hata vermez
        }

        // Delete existing orders for this user
        const deletedCount = await Order.deleteMany({ user: user._id });
        console.log(`🗑️ ${deletedCount.deletedCount} eski sipariş silindi`);

        // Generate orders for last 30 days
        const orders = [];
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const orderDate = new Date(today);
            orderDate.setDate(orderDate.getDate() - i);

            // Random number of orders per day (5-15)
            const ordersPerDay = Math.floor(Math.random() * 11) + 5;

            for (let j = 0; j < ordersPerDay; j++) {
                // Random number of items per order (1-3)
                const itemCount = Math.floor(Math.random() * 3) + 1;
                const items = [];
                let totalPrice = 0;

                for (let k = 0; k < itemCount; k++) {
                    const product = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
                    const quantity = Math.floor(Math.random() * 3) + 1;
                    const itemPrice = product.price * quantity;

                    items.push({
                        productName: product.name,
                        quantity: quantity,
                        barcode: product.barcode,
                        price: product.price,
                        category: product.category,
                        imageUrl: "https://via.placeholder.com/150"
                    });

                    totalPrice += itemPrice;
                }

                // Randomly assign a marketplace
                const randomMarketplace = marketplaces[Math.floor(Math.random() * marketplaces.length)];

                orders.push({
                    user: user._id,
                    marketplace: randomMarketplace._id,
                    marketplaceName: randomMarketplace.marketplaceName,
                    totalPrice: totalPrice,
                    orderDate: orderDate,
                    status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
                    trackingNumber: `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`,
                    items: items
                });
            }
        }

        // Insert orders
        const result = await Order.insertMany(orders);
        console.log(`✅ ${result.length} sipariş başarıyla oluşturuldu!`);

        // Calculate statistics
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
        const avgOrderValue = totalRevenue / orders.length;

        console.log("\n📊 İstatistikler:");
        console.log(`   Toplam Sipariş: ${orders.length}`);
        console.log(`   Toplam Gelir: ₺${totalRevenue.toFixed(2)}`);
        console.log(`   Ortalama Sipariş Değeri: ₺${avgOrderValue.toFixed(2)}`);
        console.log(`   Tarih Aralığı: ${new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')} - ${today.toLocaleDateString('tr-TR')}`);

        // Product statistics
        const productStats = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!productStats[item.productName]) {
                    productStats[item.productName] = { sales: 0, revenue: 0 };
                }
                productStats[item.productName].sales += item.quantity;
                productStats[item.productName].revenue += item.price * item.quantity;
            });
        });

        console.log("\n🔥 En Çok Satan Ürünler:");
        Object.entries(productStats)
            .sort((a, b) => b[1].sales - a[1].sales)
            .slice(0, 5)
            .forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry[0]}: ${entry[1].sales} adet - ₺${entry[1].revenue.toFixed(2)}`);
            });

        // Marketplace statistics
        const marketplaceStats = {};
        orders.forEach(order => {
            if (!marketplaceStats[order.marketplaceName]) {
                marketplaceStats[order.marketplaceName] = { orders: 0, revenue: 0 };
            }
            marketplaceStats[order.marketplaceName].orders += 1;
            marketplaceStats[order.marketplaceName].revenue += order.totalPrice;
        });

        console.log("\n🏪 Pazaryeri Dağılımı:");
        Object.entries(marketplaceStats)
            .sort((a, b) => b[1].orders - a[1].orders)
            .forEach((entry, index) => {
                const percentage = ((entry[1].orders / orders.length) * 100).toFixed(1);
                console.log(`   ${index + 1}. ${entry[0]}: ${entry[1].orders} sipariş (${percentage}%) - ₺${entry[1].revenue.toFixed(2)}`);
            });

        // Close connection
        await mongoose.connection.close();
        console.log("\n👋 MongoDB bağlantısı kapatıldı");
        console.log("\n🎉 Test verileri hazır! Artık Analytics sayfasını test edebilirsiniz.");

    } catch (error) {
        console.error("❌ Hata oluştu:", error);
        process.exit(1);
    }
}

// Run the script
seedOrders();
