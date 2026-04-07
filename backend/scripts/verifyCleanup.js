const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const PM = require('../models/ProductMapping');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);

    const errCount = await PM.countDocuments({
        'marketplaceMappings': {
            $elemMatch: { marketplaceName: /n11/i, syncStatus: 'error' }
        }
    });
    const syncedCount = await PM.countDocuments({
        'marketplaceMappings': {
            $elemMatch: { marketplaceName: /n11/i, syncStatus: 'synced' }
        }
    });
    const totalProducts = await PM.countDocuments({});

    console.log('Toplam ürün:', totalProducts);
    console.log('N11 synced mapping:', syncedCount);
    console.log('N11 error mapping:', errCount);
    console.log('\nBeklenen: synced=371, error artmış olmalı');

    await mongoose.disconnect();
}
run();
