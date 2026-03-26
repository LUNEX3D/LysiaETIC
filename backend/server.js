/**
 * server.js
 *
 * Projenin ana backend sunucusudur.
 * Tüm API route'larını, veritabanı bağlantısını ve ana Express yapılandırmasını içerir.
 */

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const dns = require("dns");
const logger = require("./config/logger");

const hepsiburadaRoutes = require("./routes/hepsiburadaRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/ordersRoutes");
const productRoutes = require("./routes/productsRoutes");
const authRoutes = require("./routes/authRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const aiRoutes = require("./routes/aiRoutes");
const cargoRoutes = require("./routes/cargoRoutes");
const financeRoutes = require("./routes/finance");
const adminRoutes = require("./routes/adminRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

dotenv.config();
// Force public DNS servers to avoid SRV lookup failures on some networks.
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Rotaya bağla
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/hepsiburada", hepsiburadaRoutes);
app.use("/api/cargo", cargoRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/user", userRoutes);
app.use("/api/analytics", analyticsRoutes);

mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info("MongoDB bağlantısı başarılı"))
    .catch((error) => logger.error("MongoDB bağlantı hatası:", error));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Sunucu ${PORT} portunda çalışıyor`));
