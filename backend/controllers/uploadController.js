const axios = require("axios");
const logger = require("../config/logger");
const Marketplace = require("../models/Marketplace");

exports.uploadProduct = async (req, res) => {
    try {
        const { marketplace } = req.params;
        const { userId, productData } = req.body;

        if (!userId || !productData) {
            return res.status(400).json({ error: "Kullanıcı ID ve ürün bilgileri gereklidir!" });
        }

        const integration = await Marketplace.findOne({ userId, marketplaceName: marketplace });

        if (!integration) {
            return res.status(404).json({ error: `${marketplace} entegrasyonu bulunamadı!` });
        }

        const { apiKey, apiSecret, sellerId } = integration.credentials;
        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

        let apiUrl;
        let requestData;

        switch (marketplace) {
            case "Trendyol":
                apiUrl = `https://api.trendyol.com/sapigw/suppliers/${sellerId}/products`;
                requestData = {
                    items: [productData]
                };
                break;

            case "N11":
                apiUrl = "https://api.n11.com/rest/productService";
                requestData = {
                    name: productData.title,
                    price: productData.salePrice,
                    stock: productData.quantity,
                    description: productData.description,
                    barcode: productData.barcode,
                    images: productData.images.map(url => ({ url }))
                };
                break;

            case "Hepsiburada":
                apiUrl = `https://listing-external.hepsiburada.com/api/products`;
                requestData = {
                    supplierId: sellerId,
                    productName: productData.title,
                    salePrice: productData.salePrice,
                    stock: productData.quantity,
                    barcode: productData.barcode,
                    images: productData.images
                };
                break;

            default:
                return res.status(400).json({ error: "Geçersiz pazaryeri!" });
        }

        const response = await axios.post(apiUrl, requestData, {
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/json",
            }
        });

        return res.status(200).json({ success: true, data: response.data });

    } catch (error) {
        logger.error("Ürün yükleme hatası:", error);
        return res.status(500).json({ error: "Ürün yükleme başarısız!" });
    }
};
