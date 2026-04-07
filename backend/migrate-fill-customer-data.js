/**
 * ═══════════════════════════════════════════════════════════════════════
 * MİGRASYON: Mevcut siparişlere gerçek müşteri bilgisi doldur
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SORUN: DB'deki 212 siparişte customerName ve customerAddress boş.
 *        Faturalar hep aynı kişiye ("Nihai Tüketici") kesiliyor.
 *
 * ÇÖZÜM: Trendyol API'den siparişleri tekrar çekip, DB'deki kayıtları
 *        gerçek müşteri adı ve adresiyle güncelle.
 *
 * KULLANIM:
 *   node migrate-fill-customer-data.js
 *
 * GÜVENLİ: Sadece boş olan customerName alanlarını günceller.
 *          Zaten dolu olan kayıtlara dokunmaz.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const logger = require("./config/logger");
const Order = require("./models/Order");
const Marketplace = require("./models/Marketplace");
const { decryptCredentials } = require("./utils/encryption");

async function main() {
    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║  MİGRASYON: Mevcut Siparişlere Müşteri Bilgisi Doldurma    ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝\n");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB bağlantısı başarılı\n");

    // Müşteri bilgisi boş olan siparişleri bul
    const emptyOrders = await Order.find({
        $or: [
            { customerName: { $exists: false } },
            { customerName: "" },
            { customerName: null }
        ]
    }).select("trackingNumber marketplaceName user orderDate").lean();

    console.log(`📊 Müşteri bilgisi boş olan sipariş sayısı: ${emptyOrders.length}`);

    if (emptyOrders.length === 0) {
        console.log("✅ Tüm siparişlerde müşteri bilgisi mevcut, migrasyon gerekmiyor.");
        await mongoose.disconnect();
        return;
    }

    // Marketplace'e göre grupla
    const byMarketplace = {};
    emptyOrders.forEach(o => {
        const key = `${o.user}_${o.marketplaceName}`;
        if (!byMarketplace[key]) {
            byMarketplace[key] = {
                userId: o.user,
                marketplaceName: o.marketplaceName,
                orders: []
            };
        }
        byMarketplace[key].orders.push(o);
    });

    console.log(`\n📦 ${Object.keys(byMarketplace).length} marketplace grubu bulundu:\n`);
    Object.values(byMarketplace).forEach(g => {
        console.log(`   ${g.marketplaceName}: ${g.orders.length} sipariş`);
    });

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const group of Object.values(byMarketplace)) {
        const { userId, marketplaceName, orders } = group;

        console.log(`\n${"═".repeat(60)}`);
        console.log(`📦 ${marketplaceName} — ${orders.length} sipariş güncelleniyor`);
        console.log("═".repeat(60));

        // Marketplace credentials'ı al
        const mp = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: new RegExp("^" + marketplaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") },
            isActive: true
        });

        if (!mp) {
            console.log(`⚠️  ${marketplaceName} marketplace bulunamadı, atlanıyor`);
            totalSkipped += orders.length;
            continue;
        }

        const credentials = decryptCredentials(mp.credentials);
        const mpNameLower = marketplaceName.toLowerCase().trim();

        if (mpNameLower === "trendyol") {
            await migrateTrendyol(credentials, orders);
        } else if (mpNameLower === "n11") {
            await migrateN11(credentials, orders);
        } else if (mpNameLower === "çiçeksepeti" || mpNameLower === "ciceksepeti") {
            await migrateCiceksepeti(credentials, orders);
        } else if (mpNameLower === "hepsiburada") {
            await migrateHepsiburada(credentials, orders);
        } else {
            console.log(`⚠️  ${marketplaceName} için migrasyon desteklenmiyor`);
            totalSkipped += orders.length;
            continue;
        }
    }

    // ═══ Trendyol Migrasyon ═══
    async function migrateTrendyol(credentials, orders) {
        const { apiKey, apiSecret, sellerId, supplierId } = credentials;
        const actualSellerId = sellerId || supplierId;
        const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;

        // Sipariş tarih aralığını bul
        const dates = orders.map(o => new Date(o.orderDate).getTime()).filter(d => !isNaN(d));
        const minDate = Math.min(...dates) - 24 * 60 * 60 * 1000; // 1 gün öncesi
        const maxDate = Math.max(...dates) + 24 * 60 * 60 * 1000; // 1 gün sonrası

        // orderNumber → order map oluştur (hızlı lookup için)
        const orderMap = new Map(orders.map(o => [o.trackingNumber, o]));

        console.log(`\n🌐 Trendyol API'den siparişler çekiliyor...`);
        console.log(`   Tarih aralığı: ${new Date(minDate).toISOString()} — ${new Date(maxDate).toISOString()}`);

        let apiOrders = [];
        let currentStart = minDate;

        while (currentStart < maxDate) {
            const currentEnd = Math.min(currentStart + 14 * 24 * 60 * 60 * 1000, maxDate);
            let page = 0;
            let totalPages = 1;

            do {
                try {
                    const url = `https://apigw.trendyol.com/integration/order/sellers/${actualSellerId}/orders` +
                        `?page=${page}&size=200&startDate=${currentStart}&endDate=${currentEnd}` +
                        `&orderByField=PackageLastModifiedDate&orderByDirection=DESC`;

                    const resp = await axios.get(url, {
                        headers: {
                            Authorization: authHeader,
                            "User-Agent": `${actualSellerId} - SelfIntegration`,
                            "Content-Type": "application/json"
                        },
                        timeout: 30000
                    });

                    if (!resp.data || !Array.isArray(resp.data.content)) break;

                    apiOrders.push(...resp.data.content);
                    totalPages = resp.data.totalPages || 1;
                    page++;

                    // Rate limit
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    console.log(`   ❌ API hatası (page ${page}): ${err.response?.status || err.message}`);
                    break;
                }
            } while (page < totalPages);

            currentStart = currentEnd + 1;
        }

        console.log(`   ✅ API'den ${apiOrders.length} sipariş çekildi`);

        // API siparişlerini orderNumber'a göre map'le
        const apiMap = new Map();
        apiOrders.forEach(pkg => {
            if (pkg.orderNumber) {
                apiMap.set(String(pkg.orderNumber), pkg);
            }
        });

        // DB siparişlerini güncelle
        let updated = 0;
        let skipped = 0;

        for (const dbOrder of orders) {
            const pkg = apiMap.get(dbOrder.trackingNumber);
            if (!pkg) {
                skipped++;
                continue;
            }

            const customerName = pkg.shipmentAddress?.fullName
                || ((pkg.customerFirstName || "") + " " + (pkg.customerLastName || "")).trim()
                || "";

            if (!customerName) {
                skipped++;
                continue;
            }

            // Fatura adresi varsa onu tercih et, yoksa kargo adresi
            const invAddr = pkg.invoiceAddress || {};
            const shipAddr = pkg.shipmentAddress || {};
            const addrSource = (invAddr.city || invAddr.fullAddress) ? invAddr : shipAddr;

            try {
                await Order.updateOne({ _id: dbOrder._id }, {
                    customerName: customerName,
                    customerAddress: {
                        city: addrSource.city || shipAddr.city || "",
                        district: addrSource.district || shipAddr.district || "",
                        street: addrSource.fullAddress || shipAddr.fullAddress || addrSource.address1 || shipAddr.address1 || "",
                        country: addrSource.countryCode || shipAddr.countryCode || "Turkiye",
                        phone: shipAddr.phone || "",
                        email: pkg.customerEmail || "",
                    }
                });
                updated++;

                if (updated <= 5) {
                    console.log(`   ✅ ${dbOrder.trackingNumber} → "${customerName}" (${addrSource.city || "?"})`);
                }
            } catch (err) {
                console.log(`   ❌ ${dbOrder.trackingNumber}: ${err.message}`);
                totalErrors++;
            }
        }

        if (updated > 5) {
            console.log(`   ... ve ${updated - 5} sipariş daha güncellendi`);
        }

        console.log(`\n   📊 Trendyol: ${updated} güncellendi, ${skipped} atlandı (API'de bulunamadı)`);
        totalUpdated += updated;
        totalSkipped += skipped;
    }

    // ═══ N11 Migrasyon ═══
    async function migrateN11(credentials, orders) {
        const { apiKey, secretKey } = credentials;
        const cleanAscii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");

        const dates = orders.map(o => new Date(o.orderDate).getTime()).filter(d => !isNaN(d));
        const minDate = Math.min(...dates) - 24 * 60 * 60 * 1000;
        const maxDate = Math.max(...dates) + 24 * 60 * 60 * 1000;

        console.log(`\n🌐 N11 API'den siparişler çekiliyor...`);

        let apiOrders = [];
        let page = 0;
        let totalPages = 1;

        while (page < totalPages) {
            try {
                const url = `https://api.n11.com/rest/delivery/v1/shipmentPackages` +
                    `?startDate=${minDate}&endDate=${maxDate}&page=${page}&size=100` +
                    `&orderByDirection=DESC&orderByField=true`;

                const resp = await axios.get(url, {
                    headers: {
                        appkey: cleanAscii(apiKey),
                        appsecret: cleanAscii(secretKey),
                        "Content-Type": "application/json"
                    },
                    timeout: 30000
                });

                const data = resp.data?.content || [];
                if (!data.length) break;

                apiOrders.push(...data);
                totalPages = resp.data.totalPages || 1;
                page++;
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                console.log(`   ❌ N11 API hatası: ${err.response?.status || err.message}`);
                break;
            }
        }

        console.log(`   ✅ API'den ${apiOrders.length} sipariş çekildi`);

        const apiMap = new Map();
        apiOrders.forEach(pkg => {
            if (pkg.orderNumber) apiMap.set(String(pkg.orderNumber), pkg);
        });

        let updated = 0;
        let skipped = 0;

        for (const dbOrder of orders) {
            const pkg = apiMap.get(dbOrder.trackingNumber);
            if (!pkg) { skipped++; continue; }

            const customerName = pkg.customerfullName || "";
            if (!customerName) { skipped++; continue; }

            const shipAddr = pkg.shippingAddress || {};

            try {
                await Order.updateOne({ _id: dbOrder._id }, {
                    customerName: customerName,
                    customerAddress: {
                        city: shipAddr.city || "",
                        district: shipAddr.district || "",
                        street: shipAddr.address || shipAddr.fullAddress || "",
                        country: shipAddr.country || "Turkiye",
                        phone: shipAddr.phone || "",
                        email: pkg.customerEmail || "",
                    }
                });
                updated++;
                if (updated <= 5) {
                    console.log(`   ✅ ${dbOrder.trackingNumber} → "${customerName}" (${shipAddr.city || "?"})`);
                }
            } catch (err) {
                console.log(`   ❌ ${dbOrder.trackingNumber}: ${err.message}`);
                totalErrors++;
            }
        }

        if (updated > 5) console.log(`   ... ve ${updated - 5} sipariş daha güncellendi`);
        console.log(`\n   📊 N11: ${updated} güncellendi, ${skipped} atlandı`);
        totalUpdated += updated;
        totalSkipped += skipped;
    }

    // ═══ ÇiçekSepeti Migrasyon ═══
    async function migrateCiceksepeti(credentials, orders) {
        const { apiKey, sellerId, integratorName } = credentials;
        const cleanSellerId = String(sellerId || "").replace(/[^\x00-\x7F]/g, "");
        const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, "") : "";
        const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : cleanSellerId;
        const moment = require("moment");

        console.log(`\n🌐 ÇiçekSepeti API'den siparişler çekiliyor...`);

        let apiOrders = [];
        let page = 0;
        const pageSize = 100;

        // Son 90 gün (tüm siparişleri kapsaması için)
        const startDate = moment().subtract(90, "days").startOf("day");
        const endDate = moment().endOf("day");

        while (true) {
            try {
                // Rate limit: 5 saniyede 1
                await new Promise(r => setTimeout(r, 5500));

                const resp = await axios.post("https://apis.ciceksepeti.com/api/v1/Order/GetOrders", {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    pageSize,
                    page
                }, {
                    headers: {
                        "x-api-key": apiKey,
                        "user-agent": userAgent || "LysiaETIC",
                        "Content-Type": "application/json"
                    },
                    timeout: 30000
                });

                const items = resp.data?.supplierOrderListWithBranch || [];
                if (!items.length) break;

                apiOrders.push(...items);
                console.log(`   Sayfa ${page}: ${items.length} sipariş`);

                if (items.length < pageSize) break;
                page++;
            } catch (err) {
                if (err.response?.status === 429) {
                    console.log("   ⏳ Rate limit, 60sn bekleniyor...");
                    await new Promise(r => setTimeout(r, 60000));
                    continue;
                }
                console.log(`   ❌ ÇiçekSepeti API hatası: ${err.response?.status || err.message}`);
                break;
            }
        }

        console.log(`   ✅ API'den ${apiOrders.length} sipariş çekildi`);

        const apiMap = new Map();
        apiOrders.forEach(o => {
            if (o.orderId) apiMap.set(String(o.orderId), o);
        });

        let updated = 0;
        let skipped = 0;

        for (const dbOrder of orders) {
            const csOrder = apiMap.get(dbOrder.trackingNumber);
            if (!csOrder) { skipped++; continue; }

            const customerName = csOrder.receiverName || csOrder.senderName || "";
            if (!customerName) { skipped++; continue; }

            try {
                await Order.updateOne({ _id: dbOrder._id }, {
                    customerName: customerName,
                    customerAddress: {
                        city: csOrder.receiverCity || csOrder.accountCityName || "",
                        district: csOrder.receiverDistrict || csOrder.accountDistrictName || "",
                        street: csOrder.receiverAddress || "",
                        country: "Turkiye",
                        phone: csOrder.receiverPhone || "",
                        email: "",
                    }
                });
                updated++;
                if (updated <= 5) {
                    console.log(`   ✅ ${dbOrder.trackingNumber} → "${customerName}" (${csOrder.receiverCity || "?"})`);
                }
            } catch (err) {
                console.log(`   ❌ ${dbOrder.trackingNumber}: ${err.message}`);
                totalErrors++;
            }
        }

        if (updated > 5) console.log(`   ... ve ${updated - 5} sipariş daha güncellendi`);
        console.log(`\n   📊 ÇiçekSepeti: ${updated} güncellendi, ${skipped} atlandı`);
        totalUpdated += updated;
        totalSkipped += skipped;
    }

    // ═══ Hepsiburada Migrasyon ═══
    async function migrateHepsiburada(credentials, orders) {
        const { merchantId, apiKey } = credentials;
        const moment = require("moment");
        const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;

        const dates = orders.map(o => new Date(o.orderDate).getTime()).filter(d => !isNaN(d));
        const minDate = Math.min(...dates) - 24 * 60 * 60 * 1000;
        const maxDate = Math.max(...dates) + 24 * 60 * 60 * 1000;

        console.log(`\n🌐 Hepsiburada API'den siparişler çekiliyor...`);

        let apiOrders = [];
        let offset = 0;
        const limit = 200;

        while (true) {
            try {
                const url = `https://marketplace.hepsiburada.com/orders?` +
                    `startDate=${encodeURIComponent(moment(minDate).format("YYYY-MM-DD HH:mm:ss"))}` +
                    `&endDate=${encodeURIComponent(moment(maxDate).format("YYYY-MM-DD HH:mm:ss"))}` +
                    `&offset=${offset}&limit=${limit}`;

                const resp = await axios.get(url, {
                    headers: {
                        Authorization: authHeader,
                        "User-Agent": "lysiaaccessory_dev",
                        "Content-Type": "application/json"
                    },
                    timeout: 30000
                });

                const data = resp.data?.orders || resp.data?.data || resp.data?.content || [];
                if (!Array.isArray(data) || data.length === 0) break;

                apiOrders.push(...data);
                if (data.length < limit) break;
                offset += limit;
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                console.log(`   ❌ Hepsiburada API hatası: ${err.response?.status || err.message}`);
                break;
            }
        }

        console.log(`   ✅ API'den ${apiOrders.length} sipariş çekildi`);

        const apiMap = new Map();
        apiOrders.forEach(o => {
            const num = o.orderNumber || o.merchantOrderNumber || o.id;
            if (num) apiMap.set(String(num), o);
        });

        let updated = 0;
        let skipped = 0;

        for (const dbOrder of orders) {
            const hbOrder = apiMap.get(dbOrder.trackingNumber);
            if (!hbOrder) { skipped++; continue; }

            const customerName = hbOrder.customerName || hbOrder.buyerName || hbOrder.shippingAddress?.fullName || "";
            if (!customerName) { skipped++; continue; }

            const shipAddr = hbOrder.shippingAddress || {};

            try {
                await Order.updateOne({ _id: dbOrder._id }, {
                    customerName: customerName,
                    customerAddress: {
                        city: shipAddr.city || shipAddr.province || "",
                        district: shipAddr.district || shipAddr.county || "",
                        street: shipAddr.fullAddress || shipAddr.address || shipAddr.addressLine1 || "",
                        country: shipAddr.country || "Turkiye",
                        phone: shipAddr.phone || shipAddr.phoneNumber || "",
                        email: hbOrder.customerEmail || hbOrder.buyerEmail || "",
                    }
                });
                updated++;
                if (updated <= 5) {
                    console.log(`   ✅ ${dbOrder.trackingNumber} → "${customerName}" (${shipAddr.city || "?"})`);
                }
            } catch (err) {
                console.log(`   ❌ ${dbOrder.trackingNumber}: ${err.message}`);
                totalErrors++;
            }
        }

        if (updated > 5) console.log(`   ... ve ${updated - 5} sipariş daha güncellendi`);
        console.log(`\n   📊 Hepsiburada: ${updated} güncellendi, ${skipped} atlandı`);
        totalUpdated += updated;
        totalSkipped += skipped;
    }

    // ═══ SONUÇ ═══
    console.log("\n" + "═".repeat(60));
    console.log("📊 MİGRASYON SONUCU");
    console.log("═".repeat(60));
    console.log(`   ✅ Güncellenen: ${totalUpdated}`);
    console.log(`   ⏭️  Atlanan: ${totalSkipped}`);
    console.log(`   ❌ Hata: ${totalErrors}`);
    console.log(`   📊 Toplam: ${emptyOrders.length}`);

    // Doğrulama
    const stillEmpty = await Order.countDocuments({
        $or: [
            { customerName: { $exists: false } },
            { customerName: "" },
            { customerName: null }
        ]
    });
    console.log(`\n   🔍 Hâlâ boş olan sipariş: ${stillEmpty} / ${await Order.countDocuments({})}`);

    console.log("\n✅ Migrasyon tamamlandı!\n");
    await mongoose.disconnect();
}

main().catch(e => {
    console.error("\n❌ FATAL:", e.message);
    console.error(e.stack);
    process.exit(1);
});
