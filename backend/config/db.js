/**
 * Database Connection — LysiaETIC
 * ✅ FIX #9: console.log → logger, artık server.js'den çağrılıyor
 * ✅ Retry mekanizması, timeout ayarları ve DNS çözümleme iyileştirmesi
 * ✅ IP whitelist tespiti ve açıklayıcı hata mesajları
 */
const mongoose = require("mongoose");
const https    = require("https");
const dns      = require("dns");
const logger   = require("./logger");

// ─── DNS Fix: Sistem DNS'i 127.0.0.1 olabilir — Google/Cloudflare DNS zorla ──
try {
    const currentDns = dns.getServers();
    if (currentDns.includes("127.0.0.1") || currentDns.length === 0) {
        dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
        logger.info(`DNS sunucuları güncellendi: ${currentDns.join(",")} → 8.8.8.8, 1.1.1.1`);
    }
} catch (e) {
    // DNS ayarı başarısız olursa sessizce devam et
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000; // 5 saniye

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mevcut public IP adresini öğren (hata teşhisi için)
 */
const getPublicIP = () => {
    return new Promise((resolve) => {
        const req = https.get("https://api.ipify.org", { timeout: 5000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve(data.trim()));
        });
        req.on("error", () => resolve("tespit edilemedi"));
        req.on("timeout", () => { req.destroy(); resolve("tespit edilemedi"); });
    });
};

const connectDB = async () => {
    // ─── Her bağlantı denemesinde DNS'i zorla ayarla ─────────────────────────
    // Mongoose/MongoDB driver kendi iç DNS resolver'ını kullanır
    // Sistem DNS'i 127.0.0.1 olduğunda SRV çözümlemesi başarısız olur
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        logger.error("MONGO_URI ortam değişkeni tanımlı değil!");
        process.exit(1);
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const conn = await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 30000,   // 30 saniye (varsayılan 10s)
                connectTimeoutMS: 30000,           // bağlantı timeout
                socketTimeoutMS: 60000,            // soket timeout (uzatıldı)
                maxPoolSize: 20,                   // bağlantı havuzu (artırıldı)
                minPoolSize: 5,                    // minimum bağlantı sayısı
                heartbeatFrequencyMS: 10000,       // daha sık heartbeat
                retryWrites: true,
                retryReads: true,
                family: 4                          // IPv4 zorla (DNS sorunlarını önler)
            });
            logger.info(`MongoDB bağlantısı başarılı ✅ Host: ${conn.connection.host} (deneme ${attempt}/${MAX_RETRIES})`);
            return; // başarılı — çık
        } catch (error) {
            logger.error(`MongoDB bağlantı hatası (deneme ${attempt}/${MAX_RETRIES}): ${error.message}`);

            // IP whitelist sorununu tespit et ve kullanıcıya açıklayıcı mesaj göster
            if (error.message.includes("whitelist") || error.message.includes("Could not connect to any servers")) {
                const currentIP = await getPublicIP();
                logger.error(`╔══════════════════════════════════════════════════════════════╗`);
                logger.error(`║  ❌ MongoDB Atlas IP Whitelist Sorunu                       ║`);
                logger.error(`║                                                            ║`);
                logger.error(`║  Mevcut IP adresiniz: ${currentIP.padEnd(37)}║`);
                logger.error(`║                                                            ║`);
                logger.error(`║  Bu IP, Atlas cluster'ınızın izin listesinde yok.           ║`);
                logger.error(`║                                                            ║`);
                logger.error(`║  Çözüm:                                                    ║`);
                logger.error(`║  1. https://cloud.mongodb.com adresine gidin                ║`);
                logger.error(`║  2. Cluster → Network Access → Add IP Address              ║`);
                logger.error(`║  3. "${currentIP}" ekleyin veya                ${" ".repeat(Math.max(0, 14 - currentIP.length))}║`);
                logger.error(`║     "Allow Access from Anywhere" (0.0.0.0/0) seçin          ║`);
                logger.error(`╚══════════════════════════════════════════════════════════════╝`);
            }

            if (attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * attempt; // artan bekleme
                logger.info(`⏳ ${delay / 1000} saniye sonra tekrar denenecek...`);
                await sleep(delay);
            } else {
                logger.error("❌ MongoDB bağlantısı kurulamadı — tüm denemeler başarısız!");
                process.exit(1);
            }
        }
    }
};

module.exports = connectDB;
