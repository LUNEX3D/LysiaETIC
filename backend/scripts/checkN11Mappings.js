/**
 * N11 mapping'i olan ürünleri kontrol et
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const ProductMapping = require('../models/ProductMapping');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB bağlantısı kuruldu\n');

        // N11 mapping'i olan ama syncStatus error olmayan ürünleri bul
        const products = await ProductMapping.find({
            'marketplaceMappings': {
                $elemMatch: {
                    marketplaceName: { $regex: /n11/i },
                    syncStatus: { $ne: 'error' }
                }
            }
        }).lean();

        console.log(`📊 N11 mapping (non-error) olan ürün sayısı: ${products.length}\n`);

        // İlk 15 tanesini detaylı göster
        console.log('İlk 15 ürün:\n');
        for (const p of products.slice(0, 15)) {
            const n11m = p.marketplaceMappings.find(m => /n11/i.test(m.marketplaceName));
            const tym = p.marketplaceMappings.find(m => /trendyol/i.test(m.marketplaceName));

            console.log('─────────────────────────────────────────────────────────');
            console.log(`Ürün: ${(p.masterProduct?.name || 'İsimsiz').substring(0, 60)}`);
            console.log(`Barkod: ${p.masterProduct?.barcode || '—'}`);
            console.log(`SKU: ${p.masterProduct?.sku || '—'}`);
            console.log(`Toplam mapping: ${p.marketplaceMappings.length}`);

            if (n11m) {
                console.log(`\n  N11:`);
                console.log(`    syncStatus: ${n11m.syncStatus}`);
                console.log(`    productId: ${n11m.marketplaceProductId || '—'}`);
                console.log(`    SKU: ${n11m.marketplaceSku || '—'}`);
                console.log(`    pulledFrom: ${n11m.pulledFromMarketplace ? 'Evet' : 'Hayır'}`);
                console.log(`    lastSync: ${n11m.lastSyncDate || '—'}`);
            }

            if (tym) {
                console.log(`\n  Trendyol:`);
                console.log(`    syncStatus: ${tym.syncStatus}`);
                console.log(`    productId: ${tym.marketplaceProductId || '—'}`);
                console.log(`    barcode: ${tym.marketplaceBarcode || '—'}`);
            }
            console.log('');
        }

        // Özet istatistikler
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📈 ÖZET İSTATİSTİKLER\n');

        const n11Synced = products.filter(p =>
            p.marketplaceMappings.some(m => /n11/i.test(m.marketplaceName) && m.syncStatus === 'synced')
        ).length;

        const n11Pending = products.filter(p =>
            p.marketplaceMappings.some(m => /n11/i.test(m.marketplaceName) && m.syncStatus === 'pending')
        ).length;

        const n11PulledFrom = products.filter(p =>
            p.marketplaceMappings.some(m => /n11/i.test(m.marketplaceName) && m.pulledFromMarketplace === true)
        ).length;

        const bothPlatforms = products.filter(p => {
            const hasN11 = p.marketplaceMappings.some(m => /n11/i.test(m.marketplaceName));
            const hasTY = p.marketplaceMappings.some(m => /trendyol/i.test(m.marketplaceName));
            return hasN11 && hasTY;
        }).length;

        console.log(`N11 synced: ${n11Synced}`);
        console.log(`N11 pending: ${n11Pending}`);
        console.log(`N11'den çekilmiş: ${n11PulledFrom}`);
        console.log(`Hem N11 hem Trendyol'da: ${bothPlatforms}`);
        console.log(`Sadece N11'de: ${products.length - bothPlatforms}`);

        await mongoose.disconnect();
        console.log('\n✅ Bağlantı kapatıldı');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        process.exit(1);
    }
}

check();
