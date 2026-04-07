const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const PM = require('../models/ProductMapping');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB bağlantısı kuruldu\n');

    // Phantom 1: barcode 86912345225
    // Phantom 2: barcode 86912345242
    const phantomBarcodes = ['86912345225', '86912345242'];

    for (const bc of phantomBarcodes) {
        const product = await PM.findOne({ 'masterProduct.barcode': bc });
        if (!product) {
            console.log(`❌ Ürün bulunamadı: ${bc}`);
            continue;
        }

        console.log(`\n═══ ${product.masterProduct.name} (${bc}) ═══`);
        console.log(`Toplam mapping: ${product.marketplaceMappings.length}`);

        // Tüm N11 mapping'leri göster
        const n11Mappings = product.marketplaceMappings.filter(m => /n11/i.test(m.marketplaceName));
        console.log(`N11 mapping sayısı: ${n11Mappings.length}`);

        for (let i = 0; i < n11Mappings.length; i++) {
            const m = n11Mappings[i];
            console.log(`\n  N11 mapping [${i}]:`);
            console.log(`    syncStatus: ${m.syncStatus}`);
            console.log(`    productId: ${m.marketplaceProductId}`);
            console.log(`    sku: ${m.marketplaceSku}`);
            console.log(`    barcode: ${m.marketplaceBarcode}`);
            console.log(`    pulledFrom: ${m.pulledFromMarketplace}`);
            console.log(`    isSynced: ${m.isSynced}`);
        }

        // TÜM N11 mapping'leri error yap (direkt DB update ile)
        const result = await PM.updateOne(
            { _id: product._id },
            {
                $set: {
                    'marketplaceMappings.$[elem].syncStatus': 'error',
                    'marketplaceMappings.$[elem].syncError': 'N11 API\'de bulunamadı — phantom temizlik v2',
                    'marketplaceMappings.$[elem].isSynced': false
                }
            },
            {
                arrayFilters: [
                    {
                        'elem.marketplaceName': { $regex: /n11/i },
                        'elem.syncStatus': { $ne: 'error' }
                    }
                ]
            }
        );
        console.log(`\n  DB update result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    }

    // Doğrulama
    console.log('\n\n═══ DOĞRULAMA ═══');
    const syncedCount = await PM.countDocuments({
        'marketplaceMappings': {
            $elemMatch: { marketplaceName: /n11/i, syncStatus: 'synced' }
        }
    });
    const errCount = await PM.countDocuments({
        'marketplaceMappings': {
            $elemMatch: { marketplaceName: /n11/i, syncStatus: 'error' }
        }
    });
    console.log(`N11 synced: ${syncedCount}`);
    console.log(`N11 error: ${errCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Bitti');
}

run().catch(e => { console.error(e); process.exit(1); });
