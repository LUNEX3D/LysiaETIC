/**
 * TÜM platformlar için phantom kontrol:
 * Her platformun API'sinden gerçek ürün listesini çek,
 * DB'deki synced mapping'lerle karşılaştır, phantom'ları bul ve temizle.
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

        // Tüm marketplace'leri bul
        const allMPs = await Marketplace.find({});
        console.log(`Toplam marketplace: ${allMPs.length}`);
        for (const mp of allMPs) {
            console.log(`  - ${mp.marketplaceName} (userId: ${mp.userId})`);
        }

        // Tüm ürünleri çek
        const allProducts = await ProductMapping.find({}).lean();
        console.log(`\nToplam ürün: ${allProducts.length}\n`);

        // Her ürünün mapping durumunu analiz et
        console.log('═══════════════════════════════════════════════════════════');
        console.log('MAPPING DURUM ANALİZİ\n');

        const statusCounts = {};
        const platformCounts = {};

        for (const p of allProducts) {
            for (const m of (p.marketplaceMappings || [])) {
                const mpName = (m.marketplaceName || 'unknown').toLowerCase();
                const status = m.syncStatus || 'no-status';

                const key = `${mpName}:${status}`;
                statusCounts[key] = (statusCounts[key] || 0) + 1;

                if (!platformCounts[mpName]) platformCounts[mpName] = { total: 0, synced: 0, error: 0, pending: 0, other: 0, noStatus: 0 };
                platformCounts[mpName].total++;
                if (status === 'synced') platformCounts[mpName].synced++;
                else if (status === 'error') platformCounts[mpName].error++;
                else if (status === 'pending') platformCounts[mpName].pending++;
                else if (status === 'no-status') platformCounts[mpName].noStatus++;
                else platformCounts[mpName].other++;
            }
        }

        for (const [platform, counts] of Object.entries(platformCounts)) {
            console.log(`📊 ${platform.toUpperCase()}:`);
            console.log(`   total: ${counts.total} | synced: ${counts.synced} | error: ${counts.error} | pending: ${counts.pending} | no-status: ${counts.noStatus} | other: ${counts.other}`);
        }

        // syncStatus boş veya undefined olan mapping'leri bul
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('⚠️  syncStatus BOŞ/UNDEFINED OLAN MAPPİNG\'LER\n');

        let noStatusCount = 0;
        for (const p of allProducts) {
            for (const m of (p.marketplaceMappings || [])) {
                if (!m.syncStatus || (m.syncStatus !== 'synced' && m.syncStatus !== 'error' && m.syncStatus !== 'pending')) {
                    if (noStatusCount < 10) {
                        console.log(`  ⚠️  "${(p.masterProduct?.name || '').substring(0, 40)}" — ${m.marketplaceName} — syncStatus: "${m.syncStatus}" — productId: ${m.marketplaceProductId || '—'}`);
                    }
                    noStatusCount++;
                }
            }
        }
        console.log(`\nToplam syncStatus boş/garip mapping: ${noStatusCount}`);

        // N11 API kontrolü
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('N11 API KARŞILAŞTIRMA\n');

        const n11MP = allMPs.find(m => /n11/i.test(m.marketplaceName));
        if (n11MP) {
            const creds = decryptCredentials(n11MP.credentials);
            const allN11Products = [];
            let page = 0;
            let hasMore = true;
            while (hasMore) {
                const result = await n11Service.getProducts(creds, { page, size: 250 });
                if (!result.success || !result.products || result.products.length === 0) { hasMore = false; break; }
                allN11Products.push(...result.products);
                page++;
                if (result.totalPages && page >= result.totalPages) hasMore = false;
                if (result.products.length < 250) hasMore = false;
            }
            console.log(`N11 API gerçek ürün: ${allN11Products.length}`);

            // N11 API'deki stockCode setini oluştur
            const liveStockCodes = new Set();
            const liveBarcodes = new Set();
            const liveProductIds = new Set();
            for (const p of allN11Products) {
                if (p.stockCode) liveStockCodes.add(p.stockCode);
                if (p.barcode) liveBarcodes.add(p.barcode);
                if (p.id) liveProductIds.add(String(p.id));
                if (p.n11ProductId) liveProductIds.add(String(p.n11ProductId));
            }

            // DB'de N11 mapping'i olan (error hariç) ürünleri kontrol et
            const dbN11Products = allProducts.filter(p =>
                (p.marketplaceMappings || []).some(m =>
                    /n11/i.test(m.marketplaceName) && m.syncStatus !== 'error'
                )
            );
            console.log(`DB'de N11 non-error mapping: ${dbN11Products.length}`);

            let phantomCount = 0;
            const phantoms = [];
            for (const dbProduct of dbN11Products) {
                const n11m = (dbProduct.marketplaceMappings || []).find(m =>
                    /n11/i.test(m.marketplaceName) && m.syncStatus !== 'error'
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
                    phantomCount++;
                    phantoms.push({ id: dbProduct._id, name: dbProduct.masterProduct?.name, barcode: masterBc });
                    if (phantomCount <= 20) {
                        console.log(`  👻 PHANTOM: "${(dbProduct.masterProduct?.name || '').substring(0, 50)}" — bc: ${masterBc} — n11Status: ${n11m.syncStatus} — n11Pid: ${mpPid}`);
                    }
                }
            }
            console.log(`\n👻 N11 PHANTOM TOPLAM: ${phantomCount}`);

            // Phantom'ları temizle
            if (phantomCount > 0) {
                console.log('\n🔧 Phantom\'lar temizleniyor...');
                let fixed = 0;
                for (const ph of phantoms) {
                    const result = await ProductMapping.updateOne(
                        { _id: ph.id },
                        {
                            $set: {
                                'marketplaceMappings.$[elem].syncStatus': 'error',
                                'marketplaceMappings.$[elem].syncError': 'N11 API\'de bulunamadı — full phantom temizlik',
                                'marketplaceMappings.$[elem].isSynced': false
                            }
                        },
                        {
                            arrayFilters: [{
                                'elem.marketplaceName': { $regex: /n11/i },
                                'elem.syncStatus': { $ne: 'error' }
                            }]
                        }
                    );
                    if (result.modifiedCount > 0) fixed++;
                }
                console.log(`✅ ${fixed} phantom temizlendi`);
            }
        }

        // Son doğrulama
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('SON DURUM\n');

        const finalProducts = await ProductMapping.find({}).lean();
        const finalPlatformCounts = {};
        for (const p of finalProducts) {
            for (const m of (p.marketplaceMappings || [])) {
                const mpName = (m.marketplaceName || 'unknown').toLowerCase();
                if (!finalPlatformCounts[mpName]) finalPlatformCounts[mpName] = { synced: 0, error: 0, other: 0 };
                if (m.syncStatus === 'synced') finalPlatformCounts[mpName].synced++;
                else if (m.syncStatus === 'error') finalPlatformCounts[mpName].error++;
                else finalPlatformCounts[mpName].other++;
            }
        }
        for (const [platform, counts] of Object.entries(finalPlatformCounts)) {
            console.log(`${platform.toUpperCase()}: synced=${counts.synced} | error=${counts.error} | other=${counts.other}`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Bitti');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

run();
