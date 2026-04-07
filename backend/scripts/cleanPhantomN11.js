/**
 * Tek seferlik script: N11'de olmayan ama DB'de "synced" görünen phantom mapping'leri temizle
 * Çalıştır: cd backend && node scripts/cleanPhantomN11.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const PM = require('../models/ProductMapping');
    const Marketplace = require('../models/Marketplace');
    const { decryptCredentials } = require('../utils/encryption');
    const n11Service = require('../services/n11Service');

    const mp = await Marketplace.findOne({ marketplaceName: new RegExp('n11', 'i') });
    if (!mp) { console.log('N11 marketplace not found'); mongoose.disconnect(); return; }

    // Fetch ALL N11 products from API
    const creds = decryptCredentials(mp.credentials);
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
    console.log('N11 API total:', allN11Products.length);

    // Build live sets
    const liveBarcodes = new Set();
    const liveSkus = new Set();
    for (const p of allN11Products) {
        if (p.barcode) liveBarcodes.add(p.barcode);
        if (p.sku) liveSkus.add(p.sku);
        if (p.marketplaceProductId) liveBarcodes.add(String(p.marketplaceProductId));
    }

    // Find and fix phantoms
    const dbProducts = await PM.find({
        userId: mp.userId,
        'marketplaceMappings': {
            $elemMatch: {
                marketplaceName: new RegExp('^N11$', 'i'),
                syncStatus: { $in: ['synced', 'pending'] }
            }
        }
    });

    let fixed = 0;
    for (const dbProduct of dbProducts) {
        const n11m = dbProduct.marketplaceMappings.find(
            m => /^n11$/i.test(m.marketplaceName) && (m.syncStatus === 'synced' || m.syncStatus === 'pending')
        );
        if (!n11m) continue;

        const masterBc = dbProduct.masterProduct?.barcode;
        const masterSku = dbProduct.masterProduct?.sku;
        const mpBc = n11m.marketplaceBarcode;
        const mpSku = n11m.marketplaceSku;
        const mpPid = n11m.marketplaceProductId;

        const exists =
            (masterBc && (liveBarcodes.has(masterBc) || liveSkus.has(masterBc))) ||
            (masterSku && (liveBarcodes.has(masterSku) || liveSkus.has(masterSku))) ||
            (mpBc && (liveBarcodes.has(mpBc) || liveSkus.has(mpBc))) ||
            (mpSku && (liveBarcodes.has(mpSku) || liveSkus.has(mpSku))) ||
            (mpPid && liveBarcodes.has(mpPid));

        if (!exists) {
            n11m.syncStatus = 'error';
            n11m.syncError = `N11 platformunda bu ürün bulunamadı (temizlik: ${new Date().toLocaleString('tr-TR')})`;
            n11m.isSynced = false;
            await dbProduct.save();
            fixed++;
            console.log('FIXED:', dbProduct.masterProduct?.name, '| bc:', masterBc);
        }
    }

    console.log(`\nDone! Fixed ${fixed} phantom N11 mappings.`);
    mongoose.disconnect();
}).catch(e => console.error(e));
