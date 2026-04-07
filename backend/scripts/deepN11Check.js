/**
 * Derin N11 kontrol:
 * 1. N11 API'den gerçek ürün listesini çek
 * 2. DB'deki N11 synced mapping'lerle karşılaştır
 * 3. Phantom'ları bul ve temizle
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ProductMapping = require('../models/ProductMapping');
const Marketplace = require('../models/Marketplace');
const { decryptCredentials } = require('../utils/encryption');
const n11Service = require('../services/n11Service');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB bağlantısı kuruldu\n');

        // 1. N11 marketplace bul
        const mp = await Marketplace.findOne({ marketplaceName: new RegExp('n11', 'i') });
        if (!mp) { console.log('❌ N11 marketplace bulunamadı'); return; }
        console.log(`N11 marketplace bulundu — userId: ${mp.userId}\n`);

        // 2. N11 API'den TÜM ürünleri çek
        console.log('📡 N11 API\'den ürünler çekiliyor...');
        const creds = decryptCredentials(mp.credentials);
        const allN11Products = [];
        let page = 0;
        let hasMore = true;
        while (hasMore) {
            const result = await n11Service.getProducts(creds, { page, size: 250 });
            if (!result.success || !result.products || result.products.length === 0) { hasMore = false; break; }
            allN11Products.push(...result.products);
            console.log(`  Sayfa ${page}: ${result.products.length} ürün (toplam: ${allN11Products.length})`);
            page++;
            if (result.totalPages && page >= result.totalPages) hasMore = false;
            if (result.products.length < 250) hasMore = false;
        }
        console.log(`\n✅ N11 API toplam: ${allN11Products.length} ürün\n`);

        // 3. N11 API'deki ürünlerin stockCode/barcode/productId setlerini oluştur
        const liveStockCodes = new Set();
        const liveBarcodes = new Set();
        const liveProductIds = new Set();
        for (const p of allN11Products) {
            if (p.stockCode) liveStockCodes.add(p.stockCode);
            if (p.barcode) liveBarcodes.add(p.barcode);
            if (p.sku) liveStockCodes.add(p.sku);
            if (p.marketplaceProductId) liveProductIds.add(String(p.marketplaceProductId));
            if (p.id) liveProductIds.add(String(p.id));
        }
        console.log(`N11 API setleri — stockCodes: ${liveStockCodes.size}, barcodes: ${liveBarcodes.size}, productIds: ${liveProductIds.size}\n`);

        // 4. DB'deki N11 synced mapping'leri bul
        const dbProducts = await ProductMapping.find({
            userId: mp.userId,
            'marketplaceMappings': {
                $elemMatch: {
                    marketplaceName: new RegExp('^N11$', 'i'),
                    syncStatus: { $in: ['synced', 'pending'] }
                }
            }
        });
        console.log(`📊 DB'de N11 synced/pending mapping: ${dbProducts.length}\n`);

        // 5. Her DB ürününü N11 API ile karşılaştır
        const phantoms = [];
        const real = [];
        for (const dbProduct of dbProducts) {
            const n11m = dbProduct.marketplaceMappings.find(
                m => /^n11$/i.test(m.marketplaceName) && (m.syncStatus === 'synced' || m.syncStatus === 'pending')
            );
            if (!n11m) continue;

            const masterBc = dbProduct.masterProduct?.barcode;
            const masterSku = dbProduct.masterProduct?.sku;
            const mpBc = n11m.marketplaceBarcode;
            const mpSku = n11m.marketplaceSku;
            const mpPid = n11m.marketplaceProductId ? String(n11m.marketplaceProductId) : null;

            const existsInAPI =
                (mpPid && liveProductIds.has(mpPid)) ||
                (masterBc && (liveStockCodes.has(masterBc) || liveBarcodes.has(masterBc))) ||
                (masterSku && (liveStockCodes.has(masterSku) || liveBarcodes.has(masterSku))) ||
                (mpBc && (liveStockCodes.has(mpBc) || liveBarcodes.has(mpBc))) ||
                (mpSku && (liveStockCodes.has(mpSku) || liveBarcodes.has(mpSku)));

            if (!existsInAPI) {
                phantoms.push({
                    id: dbProduct._id,
                    name: (dbProduct.masterProduct?.name || '').substring(0, 50),
                    barcode: masterBc,
                    sku: masterSku,
                    n11ProductId: mpPid,
                    n11Sku: mpSku,
                    n11Barcode: mpBc,
                    n11m: n11m
                });
            } else {
                real.push(dbProduct);
            }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log(`✅ Gerçek N11 ürünleri (API'de var): ${real.length}`);
        console.log(`👻 PHANTOM N11 ürünleri (API'de YOK): ${phantoms.length}`);
        console.log('═══════════════════════════════════════════════════════════\n');

        if (phantoms.length > 0) {
            console.log('👻 PHANTOM ÜRÜNLER:\n');
            for (const ph of phantoms) {
                console.log(`  ❌ ${ph.name}`);
                console.log(`     barcode: ${ph.barcode} | sku: ${ph.sku}`);
                console.log(`     n11ProductId: ${ph.n11ProductId} | n11Sku: ${ph.n11Sku}`);
                console.log('');
            }

            // 6. Phantom'ları temizle — syncStatus: "error" yap
            console.log('\n🔧 Phantom mapping\'ler temizleniyor...\n');
            let fixed = 0;
            for (const ph of phantoms) {
                const dbProduct = await ProductMapping.findById(ph.id);
                if (!dbProduct) continue;

                const n11m = dbProduct.marketplaceMappings.find(
                    m => /^n11$/i.test(m.marketplaceName) && (m.syncStatus === 'synced' || m.syncStatus === 'pending')
                );
                if (!n11m) continue;

                n11m.syncStatus = 'error';
                n11m.syncError = `N11 API'de bulunamadı — phantom temizlik (${new Date().toLocaleString('tr-TR')})`;
                n11m.isSynced = false;
                await dbProduct.save();
                fixed++;
                console.log(`  ✅ Temizlendi: ${ph.name} (barcode: ${ph.barcode})`);
            }
            console.log(`\n🎉 ${fixed} phantom N11 mapping temizlendi!`);
        } else {
            console.log('✅ Phantom N11 mapping bulunamadı — tüm mapping\'ler gerçek.\n');
            console.log('⚠️  Sorun başka yerde olabilir. Backend filtreleme kontrolü yapılmalı.');
        }

        await mongoose.disconnect();
        console.log('\n✅ Bağlantı kapatıldı');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

run();
