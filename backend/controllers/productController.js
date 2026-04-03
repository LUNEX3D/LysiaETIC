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
            return res.status(404).json({ error: "❌ Mağaza entegrasyonu bulunamadı!" });
        }

        const marketplaceName = integration.marketplaceName;
        // ✅ FIX H5: Credential'ları decrypt et
        const credentials = decryptCredentials(integration.credentials);
        let products = [];

        // ✅ Hepsiburada
        if (marketplaceName === "Hepsiburada") {
            const { merchantId, apiKey } = credentials;
            try {
                const apiUrl = `https://mpop-sit.hepsiburada.com/product/api/products/all-products-of-merchant/${merchantId}`;
                const response = await axios.get(apiUrl, {
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`,
                        "Content-Type": "application/json",
                        "User-Agent": "lysiaaccessory_dev"
                    },
                    timeout: 15000
                });

                const apiData = response?.data?.data || [];
                if (!apiData.length) {
                    return res.status(200).json({
                        success: true,
                        marketplace: marketplaceName,
                        total: 0,
                        products: [],
                        message: "Hepsiburada'da ürün bulunamadı"
                    });
                }

                products = apiData.map(product => normalizeProduct({
                    productId:      product?.productId || product?.merchantSku,
                    productName:    product?.productName,
                    productImage:   product?.imageUrl,
                    stock:          product?.stock ?? product?.availableStock ?? 0,
                    price:          product?.price ?? product?.salePrice ?? 0,
                    listPrice:      product?.listPrice ?? product?.price ?? 0,
                    barcode:        product?.barcode,
                    stockCode:      product?.merchantSku || product?.sku,
                    categoryName:   product?.categoryName,
                    brand:          product?.brand,
                    commissionRate: product?.commissionRate,
                    status:         product?.status,
                    deliveryTime:   product?.deliveryTime,
                    productUrl:     product?.productUrl,
                    color:          product?.color,
                    size:           product?.size,
                    attributes:     product?.attributes,
                }, marketplaceName));
            } catch (err) {
                logger.error(`Hepsiburada API hatası: ${err.message}`);
                return res.status(500).json({ error: "❌ Hepsiburada ürünleri alınamadı!" });
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
                    return res.status(500).json({ error: "❌ Trendyol ürünleri alınamadı!" });
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
                    return res.status(500).json({ error: "❌ N11 ürünleri alınamadı!" });
                }
            }
        }

        // ✅ ÇiçekSepeti
        else if (marketplaceName === "ÇiçekSepeti") {
            const { apiSecret, supplierId } = credentials;
            const pageSize = 60;
            let page = 1;
            let totalPages = 1;

            try {
                while (page <= totalPages) {
                    const url = `https://apis.ciceksepeti.com/api/v1/Products?Page=${page}&PageSize=${pageSize}`;
                    const response = await axios.get(url, {
                        headers: {
                            "x-api-key": apiSecret,
                            "supplierId": supplierId,
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
                return res.status(500).json({ error: "❌ ÇiçekSepeti ürünleri alınamadı!" });
            }
        }

        logger.info(`${marketplaceName} — ${products.length} ürün başarıyla çekildi (user: ${userId})`);

        return res.status(200).json({
            success: true,
            marketplace: marketplaceName,
            total: products.length,
            products: products
        });

    } catch (error) {
        logger.error(`Ürünleri alırken hata: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: "Ürünler alınamadı!",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};
