const axios = require("axios");
const Marketplace = require("../models/Marketplace");

exports.getAllProducts = async (req, res) => {
    try {
        const { userId } = req.params;
        const { marketplaceId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "❌ Kullanıcı ID eksik!" });
        }

        const integration = await Marketplace.findOne({ _id: marketplaceId, userId });
        if (!integration) {
            return res.status(404).json({ error: "❌ Mağaza entegrasyonu bulunamadı!" });
        }

        const marketplaceName = integration.marketplaceName;
        let products = [];

        // ✅ Hepsiburada
        if (marketplaceName === "Hepsiburada") {
            const { merchantId, apiKey } = integration.credentials;
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

                products = apiData.map(product => ({
                    marketplace: marketplaceName,
                    productId: product?.productId || product?.merchantSku || "Bilinmiyor",
                    productName: product?.productName || "Bilinmiyor",
                    productImage: product?.imageUrl || "https://via.placeholder.com/300",
                    stock: product?.stock || 0,
                    price: product?.price || 0,
                    barcode: product?.barcode || "Bilinmiyor",
                    categoryName: product?.categoryName || "Bilinmiyor",
                    brand: product?.brand || "Bilinmiyor",
                    commissionRate: product?.commissionRate || "Bilinmiyor",
                    status: product?.status || "UNKNOWN",
                    deliveryTime: product?.deliveryTime || "Bilinmiyor",
                    productUrl: product?.productUrl || "#",
                    color: product?.color || "Bilinmiyor",
                    size: product?.size || "Bilinmiyor",
                    attributes: product?.attributes || []
                }));
            } catch (err) {
                console.error("❌ Hepsiburada API hatası:", err.message);
                return res.status(500).json({ error: "❌ Hepsiburada ürünleri alınamadı!" });
            }
        }

        // ✅ Trendyol
        else if (marketplaceName === "Trendyol") {
            const { apiKey, apiSecret, sellerId } = integration.credentials;
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

                    products.push(...response.data.content.map(product => ({
                        marketplace: "Trendyol",
                        productName: product.title || product.name || "Bilinmiyor",
                        productImage: product.images?.[0]?.url || "https://via.placeholder.com/300",
                        stock: product.quantity || 0,
                        price: product.salePrice || product.listPrice || 0,
                        barcode: product.barcode || "Bilinmiyor",
                        categoryName: product.category?.name || "Bilinmiyor",
                        deliveryTime: product.deliveryDuration || "Bilinmiyor",
                        productUrl: product.url || "#",
                        color: product.attributes?.find(a => a.attributeName === "Renk")?.attributeValue || "Bilinmiyor",
                        size: product.attributes?.find(a => a.attributeName === "Beden")?.attributeValue || "Bilinmiyor"
                    })));

                    totalPages = response.data.totalPages;
                    page++;
                } catch (err) {
                    console.error("❌ Trendyol API hatası:", err.message);
                    return res.status(500).json({ error: "❌ Trendyol ürünleri alınamadı!" });
                }
            }
        }

        // ✅ N11
        else if (marketplaceName === "n11") {
            const { apiKey, secretKey } = integration.credentials;
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

                    products.push(...apiData.map(p => ({
                        marketplace: "n11",
                        productName: p.title || "Bilinmiyor",
                        productImage: p.imageUrls?.[0] || "https://via.placeholder.com/300",
                        stock: p.quantity || 0,
                        price: p.salePrice || 0,
                        barcode: p.barcode || "Bilinmiyor",
                        categoryName: p.categoryId || "Bilinmiyor",
                        commissionRate: p.commissionRate || "Bilinmiyor",
                        status: p.status || "UNKNOWN",
                        deliveryTime: p.preparingDay || "Bilinmiyor",
                        productUrl: "#",
                        color: p.attributes?.find(attr => attr.attributeName === "Renk")?.attributeValue || "Bilinmiyor",
                        size: p.attributes?.find(attr => attr.attributeName === "Beden")?.attributeValue || "Bilinmiyor",
                        attributes: p.attributes || []
                    })));

                    totalPages = response.data.totalPages;
                    page++;
                } catch (err) {
                    console.error("❌ N11 API hatası:", err.message);
                    return res.status(500).json({ error: "❌ N11 ürünleri alınamadı!" });
                }
            }
        }

        // ✅ ÇiçekSepeti
        else if (marketplaceName === "ÇiçekSepeti") {
            const { apiSecret, supplierId } = integration.credentials;
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

                    products.push(...apiData.map(p => ({
                        marketplace: "ÇiçekSepeti",
                        productId: p.productCode || "Bilinmiyor",
                        productName: p.productName || "Bilinmiyor",
                        productImage: p.images?.[0] || "https://via.placeholder.com/300",
                        stock: p.StockQuantity || p.stock || 0,
                        price: p.TotalPrice || p.salesPrice || 0,
                        barcode: p.barcode || "Bilinmiyor",
                        categoryName: p.categoryName || "Bilinmiyor",
                        status: p.productStatusType || "UNKNOWN",
                        deliveryTime: p.deliveryMessageType || "Bilinmiyor",
                        productUrl: p.link || "#",
                        description: p.description || "",
                        color: p.attributes?.find(attr => attr.name === "Renk")?.value || "Bilinmiyor",
                        size: p.attributes?.find(attr => attr.name === "Beden")?.value || "Bilinmiyor",
                        attributes: p.attributes || [],
                        isActive: p.isActive ?? true,
                        stockCode: p.stockCode || "Yok"
                    })));

                    if (response.data.totalCount) {
                        totalPages = Math.ceil(response.data.totalCount / pageSize);
                    }

                    page++;
                    if (page <= totalPages) await new Promise(resolve => setTimeout(resolve, 5000)); // API rate limit
                }
            } catch (err) {
                console.error("❌ ÇiçekSepeti API hatası:", err.message);
                return res.status(500).json({ error: "❌ ÇiçekSepeti ürünleri alınamadı!" });
            }
        }

        return res.status(200).json({
            success: true,
            marketplace: marketplaceName,
            total: products.length,
            products: products
        });

    } catch (error) {
        console.error("❌ Ürünleri alırken hata oluştu:", error.message);
        return res.status(500).json({
            error: "❌ Ürünler alınamadı!",
            details: error.message
        });
    }
};
