/**
 * Product Controller — LysiaETIC
 * ✅ FIX #2: IDOR düzeltildi — req.user._id kullanılıyor
 * ✅ FIX #18: console.log → logger
 * ✅ Stok verileri düzeltildi — tüm marketplace'ler tutarlı veri döner
 */
const axios = require("axios");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { ok, notFound, serverError } = require("../utils/apiResponse");

/**
 * Normalize product data — ensures every marketplace returns the same shape
 */
const normalizeProduct = (raw, marketplace) => ({
    marketplace:    marketplace,
    productId:      raw.productId      || "",
    productName:    raw.productName    || "İsimsiz Ürün",
    productImage:   raw.productImage   || "",
    stock:          Number(raw.stock)  || 0,
    price:          Number(raw.price)  || 0,
    listPrice:      Number(raw.listPrice) || Number(raw.price) || 0,
    barcode:        raw.barcode        || "",
    stockCode:      raw.stockCode      || "",
    categoryName:   raw.categoryName   || "",
    brand:          raw.brand          || "",
    commissionRate: raw.commissionRate || "",
    status:         raw.status         || "",
    deliveryTime:   raw.deliveryTime   || "",
    productUrl:     raw.productUrl     || "",
    description:    raw.description    || "",
    color:          raw.color          || "",
    size:           raw.size           || "",
    attributes:     raw.attributes     || [],
    isActive:       raw.isActive ?? true,
});

exports.getAllProducts = async (req, res) => {
    try {
        // ✅ FIX #2: IDOR — URL'deki userId yerine token'dan gelen kullanıcı ID'si
        const userId = req.user._id;
        const { marketplaceId } = req.query;

        const integration = await Marketplace.findOne({ _id: marketplaceId, userId });
        if (!integration) {
            return notFound(res, "Mağaza entegrasyonu bulunamadı.");
        }

        const marketplaceName = integration.marketplaceName;
        // ✅ FIX H5: Credential'ları decrypt et
        const credentials = decryptCredentials(integration.credentials);
        let products = [];

        // ✅ Hepsiburada
        if (marketplaceName === "Hepsiburada") {
            const {
                normalizeCredentials,
                getEndpoints,
                getHeaders,
                buildHepsiburadaCategoryNameMap
            } = require("../services/hepsiburadaService");
            const hbCreds = normalizeCredentials(credentials);
            const { merchantId, secretKey, userAgent } = hbCreds;
            const ep = getEndpoints(hbCreds);
            const hbHeaders = getHeaders(merchantId, secretKey, userAgent);
            try {
                // ── Adım 0: Kategori map — HB+HX+HC (resmi get-all-categories type birleşimi)
                let categoryMap = new Map();
                try {
                    categoryMap = await buildHepsiburadaCategoryNameMap(merchantId, secretKey, userAgent, {
                        onlyLeaf: true
                    });
                    logger.info(`[Hepsiburada CAT] ${categoryMap.size} kategori çekildi`);
                } catch (catErr) {
                    logger.warn(`[Hepsiburada CAT] Kategori çekme hatası (ürünler yine de çekilecek): ${catErr.message}`);
                }

                // ── Adım 1: MPOP API'den toplu ürün detaylarını çek (ad, resim, kategori, marka) ──
                const mpopDetailMap = new Map(); // merchantSku → product details
                const mpopStatuses = ["CREATED", "MATCHED", "WAITING", "IN_EXTERNAL_PROGRESS", "PRE_MATCHED"];
                let mpopFetched = false;

                for (const status of mpopStatuses) {
                    try {
                        let page = 0;
                        let hasMorePages = true;
                        while (hasMorePages) {
                            const mpopUrl = `${ep.MPOP}/product/api/products/products-by-merchant-and-status` +
                                `?merchantId=${merchantId}&productStatus=${status}&version=1&page=${page}&size=1000`;
                            const mpopResp = await axios.get(mpopUrl, { headers: hbHeaders, timeout: 20000 });
                            const mpopData = mpopResp.data;

                            // İlk başarılı yanıtın yapısını logla (debug)
                            if (!mpopFetched && mpopData) {
                                const debugItems = Array.isArray(mpopData) ? mpopData : (mpopData?.data || mpopData?.products || mpopData?.content || []);
                                if (debugItems.length > 0) {
                                    logger.info(`[Hepsiburada MPOP] İlk MPOP ürün keys: [${Object.keys(debugItems[0]).join(", ")}]`);
                                    logger.info(`[Hepsiburada MPOP] İlk MPOP ürün örnek: ${JSON.stringify(debugItems[0]).substring(0, 1500)}`);
                                    mpopFetched = true;
                                }
                            }

                            // Yanıt formatını parse et
                            let items = [];
                            if (Array.isArray(mpopData)) {
                                items = mpopData;
                            } else if (mpopData?.data && Array.isArray(mpopData.data)) {
                                items = mpopData.data;
                            } else if (mpopData?.products && Array.isArray(mpopData.products)) {
                                items = mpopData.products;
                            } else if (mpopData?.content && Array.isArray(mpopData.content)) {
                                items = mpopData.content;
                            }

                            for (const item of items) {
                                const sku = item.merchantSku || item.sku || "";
                                const hbSku = item.hepsiburadaSku || item.hbSku || "";
                                if (sku) mpopDetailMap.set(sku, item);
                                if (hbSku) mpopDetailMap.set(hbSku, item);
                            }

                            hasMorePages = items.length >= 1000;
                            page++;
                        }
                    } catch (mpopErr) {
                        logger.warn(`[Hepsiburada MPOP] status=${status} hatası: ${mpopErr.response?.status || ""} ${mpopErr.message}`);
                    }
                }

                logger.info(`[Hepsiburada MPOP] Toplu detay: ${mpopDetailMap.size} ürün detayı çekildi`);

                // ── Adım 2: Listing API'den fiyat/stok/SKU bilgilerini çek ──
                const apiUrl = `${ep.LISTING}/listings/merchantid/${merchantId}?offset=0&limit=200`;
                const response = await axios.get(apiUrl, { headers: hbHeaders, timeout: 15000 });

                const rawData = response?.data;
                let apiData = [];
                if (Array.isArray(rawData)) {
                    apiData = rawData;
                } else if (rawData?.listings && Array.isArray(rawData.listings)) {
                    apiData = rawData.listings;
                } else if (rawData?.data && Array.isArray(rawData.data)) {
                    apiData = rawData.data;
                } else if (rawData?.items && Array.isArray(rawData.items)) {
                    apiData = rawData.items;
                } else if (rawData?.products && Array.isArray(rawData.products)) {
                    apiData = rawData.products;
                }

                if (!apiData.length) {
                    return ok(res, "Hepsiburada'da ürün bulunamadı.", { marketplace: marketplaceName, total: 0, products: [] });
                }

                logger.info(`[Hepsiburada Products] ${apiData.length} listing çekildi — MPOP detaylarıyla birleştiriliyor`);

                // ── Adım 3: Listing + MPOP detaylarını birleştir ──
                let firstDetailLogged = false;
                products = apiData.map(listing => {
                    // MPOP detayını merchantSku veya hepsiburadaSku ile bul
                    const detail = mpopDetailMap.get(listing.merchantSku) || mpopDetailMap.get(listing.hepsiburadaSku) || null;

                    // İlk eşleşen MPOP detayını logla (field isimlerini görmek için)
                    if (detail && !firstDetailLogged) {
                        logger.info(`[Hepsiburada MERGE] İlk eşleşen MPOP detail keys: [${Object.keys(detail).join(", ")}]`);
                        logger.info(`[Hepsiburada MERGE] İlk eşleşen MPOP detail örnek: ${JSON.stringify(detail).substring(0, 1500)}`);
                        firstDetailLogged = true;
                    }

                    // MPOP yanıt yapısı: detaylar matchedHbProductInfo[0] içinde
                    // { productName, brand, images:["https://.../{size}/...jpg"], variantTypeAttributes:[{name,value}] }
                    const matched = detail?.matchedHbProductInfo?.[0] || {};
                    const varAttrs = matched?.variantTypeAttributes || [];
                    // Görsel: matchedHbProductInfo[0].images[0] — URL'de {size} placeholder'ı var, 550 ile değiştir
                    const rawImg = matched?.images?.[0] || detail?.defaultImageUrl || detail?.defaultImageURL || detail?.imageUrl || "";
                    const imageUrl = rawImg ? rawImg.replace("{size}", "550") : "";
                    // Ürün adı: top-level productName veya matched içindeki
                    const productName = detail?.productName || matched?.productName || detail?.name
                        || listing?.merchantSku || "İsimsiz Ürün";
                    // Marka: matched içinde
                    const brandName = matched?.brand || detail?.brand || detail?.brandName || "";
                    // Kategori: MPOP yanıtında categoryId var ama categoryName yok — categoryMap'ten çevir
                    const rawCatId = detail?.categoryId || matched?.categoryId || "";
                    const catName = (rawCatId ? categoryMap.get(String(rawCatId)) : "") || detail?.categoryName || detail?.category?.name || matched?.categoryName || "";
                    // Açıklama
                    const desc = detail?.description || "";
                    // Renk & Beden: variantTypeAttributes array'inden çek
                    const findAttr = (name) => varAttrs.find(a => a.name === name)?.value || "";
                    const color = findAttr("Renk") || "";
                    const size = findAttr("Beden") || findAttr("Ayakkabı Numarası") || findAttr("Numara") || "";
                    // Barkod
                    const barcode = listing?.merchantSku || detail?.barcode || listing?.barcode || "";

                    return normalizeProduct({
                        productId:      listing?.hepsiburadaSku || listing?.productId || listing?.merchantSku,
                        productName:    productName,
                        productImage:   imageUrl,
                        stock:          listing?.availableStock ?? listing?.stock ?? 0,
                        price:          listing?.price ?? listing?.salePrice ?? 0,
                        listPrice:      listing?.listPrice ?? listing?.price ?? 0,
                        barcode:        barcode,
                        stockCode:      listing?.merchantSku || listing?.sku,
                        categoryName:   catName,
                        brand:          brandName,
                        commissionRate: listing?.commissionRate,
                        status:         listing?.isSalable ? "active" : (listing?.status || "inactive"),
                        deliveryTime:   listing?.dispatchTime ? `${listing.dispatchTime} gün` : "",
                        productUrl:     detail?.productUrl || listing?.productUrl || "",
                        description:    desc,
                        color:          color,
                        size:           size,
                        attributes:     detail?.attributes || listing?.attributes || [],
                    }, marketplaceName);
                });

                const matchedCount = apiData.filter(l => mpopDetailMap.has(l.merchantSku) || mpopDetailMap.has(l.hepsiburadaSku)).length;
                logger.info(`[Hepsiburada Products] ${products.length} ürün hazır (${matchedCount} tanesi MPOP detayıyla eşleşti)`);
            } catch (err) {
                logger.error(`Hepsiburada API hatası: ${err.message}`);
                return serverError(res, err, "Hepsiburada ürünleri alınamadı.");
            }
        }

        // ✅ Trendyol
        else if (marketplaceName === "Trendyol") {
            const { apiKey, apiSecret, sellerId } = credentials;
            let page = 0, totalPages = 1;
            const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

            while (page < totalPages) {
                try {
                    const url = `https://apigw.trendyol.com/integration/product/sellers/${sellerId}/products?page=${page}&size=1000&approved=true`;
                    const response = await axios.get(url, {
                        headers: { Authorization: `Basic ${authHeader}` },
                        timeout: 15000
                    });

                    if (!response.data?.content) break;

                    products.push(...response.data.content.map(product => normalizeProduct({
                        productId:      product.productCode || product.stockCode || product.barcode,
                        productName:    product.title || product.name,
                        productImage:   product.images?.[0]?.url,
                        stock:          product.quantity ?? product.stockQuantity ?? 0,
                        price:          product.salePrice ?? product.listPrice ?? 0,
                        listPrice:      product.listPrice ?? product.salePrice ?? 0,
                        barcode:        product.barcode,
                        stockCode:      product.stockCode || product.productCode,
                        categoryName:   product.category?.name || product.categoryName,
                        brand:          product.brand?.name || product.brandName,
                        commissionRate: product.commissionRate,
                        status:         product.approved ? "active" : (product.onSale ? "active" : "passive"),
                        deliveryTime:   product.deliveryDuration ? `${product.deliveryDuration} gün` : "",
                        productUrl:     product.productUrl || product.url,
                        color:          product.attributes?.find(a => a.attributeName === "Renk")?.attributeValue,
                        size:           product.attributes?.find(a => a.attributeName === "Beden")?.attributeValue,
                        attributes:     product.attributes,
                    }, marketplaceName)));

                    totalPages = response.data.totalPages;
                    page++;
                } catch (err) {
                    logger.error(`Trendyol API hatası: ${err.message}`);
                    return serverError(res, err, "Trendyol ürünleri alınamadı.");
                }
            }
        }

        // ✅ N11
        else if (marketplaceName === "n11") {
            const { apiKey, secretKey } = credentials;
            let page = 0, totalPages = 1;

            while (page < totalPages) {
                try {
                    const apiUrl = `https://api.n11.com/ms/product-query?page=${page}&size=250`;
                    const response = await axios.get(apiUrl, {
                        headers: {
                            appkey: apiKey,
                            appsecret: secretKey,
                            "Content-Type": "application/json"
                        },
                        timeout: 15000
                    });

                    const apiData = response?.data?.content || [];
                    if (!apiData.length) break;

                    products.push(...apiData.map(p => normalizeProduct({
                        productId:      p.id || p.productSellerCode,
                        productName:    p.title,
                        productImage:   p.imageUrls?.[0] || p.images?.[0],
                        stock:          p.quantity ?? p.stockQuantity ?? 0,
                        price:          p.salePrice ?? p.displayPrice ?? 0,
                        listPrice:      p.listPrice ?? p.salePrice ?? 0,
                        barcode:        p.barcode || p.stockCode,
                        stockCode:      p.stockCode || p.productSellerCode,
                        categoryName:   p.categoryName || p.categoryId,
                        brand:          p.brandName || p.brand,
                        commissionRate: p.commissionRate,
                        status:         p.status,
                        deliveryTime:   p.preparingDay ? `${p.preparingDay} gün` : "",
                        productUrl:     p.productUrl || p.url,
                        color:          p.attributes?.find(attr => attr.attributeName === "Renk")?.attributeValue,
                        size:           p.attributes?.find(attr => attr.attributeName === "Beden")?.attributeValue,
                        attributes:     p.attributes,
                    }, marketplaceName)));

                    totalPages = response.data.totalPages;
                    page++;
                } catch (err) {
                    logger.error(`N11 API hatası: ${err.message}`);
                    return serverError(res, err, "N11 ürünleri alınamadı.");
                }
            }
        }

        // ✅ ÇiçekSepeti
        else if (marketplaceName === "ÇiçekSepeti") {
            // ✅ FIX: DB'de apiKey/sellerId olarak saklanıyor — doğru alan adlarını kullan
            const apiKey       = credentials.apiKey       || credentials.apiSecret;
            const sellerId     = credentials.sellerId     || credentials.supplierId;
            const integratorName = credentials.integratorName || "";
            const pageSize = 60;
            let page = 1;
            let totalPages = 1;

            // ÇiçekSepeti API header'ları: x-api-key + user-agent (ASCII only)
            const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
            const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
            const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : (cleanSellerId || "CicekSepetiIntegration");

            try {
                while (page <= totalPages) {
                    const url = `https://apis.ciceksepeti.com/api/v1/Products?Page=${page}&PageSize=${pageSize}`;
                    const response = await axios.get(url, {
                        headers: {
                            "x-api-key": apiKey,
                            "user-agent": userAgent,
                            "Content-Type": "application/json",
                            Accept: "application/json"
                        },
                        timeout: 20000
                    });

                    const apiData = response?.data?.products || [];
                    if (!apiData.length) break;

                    products.push(...apiData.map(p => normalizeProduct({
                        productId:      p.productCode,
                        productName:    p.productName,
                        productImage:   p.images?.[0],
                        stock:          p.stockQuantity ?? p.StockQuantity ?? p.stock ?? 0,
                        price:          p.salesPrice ?? p.TotalPrice ?? 0,
                        listPrice:      p.listPrice ?? p.salesPrice ?? p.TotalPrice ?? 0,
                        barcode:        p.barcode,
                        stockCode:      p.stockCode,
                        categoryName:   p.categoryName,
                        brand:          p.brandName || p.brand,
                        commissionRate: p.commissionRate,
                        status:         p.productStatusType,
                        deliveryTime:   p.deliveryMessageType,
                        productUrl:     p.link,
                        description:    p.description,
                        color:          p.attributes?.find(attr => attr.name === "Renk")?.value,
                        size:           p.attributes?.find(attr => attr.name === "Beden")?.value,
                        attributes:     p.attributes,
                        isActive:       p.isActive,
                    }, marketplaceName)));

                    if (response.data.totalCount) {
                        totalPages = Math.ceil(response.data.totalCount / pageSize);
                    }

                    page++;
                    if (page <= totalPages) await new Promise(resolve => setTimeout(resolve, 5000)); // API rate limit
                }
            } catch (err) {
                logger.error(`ÇiçekSepeti API hatası: ${err.message}`);
                return serverError(res, err, "ÇiçekSepeti ürünleri alınamadı.");
            }
        }

        logger.info(`${marketplaceName} — ${products.length} ürün başarıyla çekildi (user: ${userId})`);

        return ok(res, `${marketplaceName} ürünleri başarıyla çekildi.`, {
            marketplace: marketplaceName,
            total: products.length,
            products
        });

    } catch (error) {
        logger.error(`Ürünleri alırken hata: ${error.message}`);
        return serverError(res, error, "Ürünler alınamadı.");
    }
};
