    const Marketplace = require("../models/Marketplace");
    const logger = require("../config/logger");

    // ✅ Kullanıcının tüm pazaryeri entegrasyonlarını getir
    exports.getUserMarketplaces = async (req, res) => {
        try {
            const marketplaces = await Marketplace.find({ userId: req.params.userId });

            // Entegrasyon yoksa boş array döndür (404 yerine)
            if (!marketplaces || marketplaces.length === 0) {
                return res.status(200).json([]);
            }

            res.status(200).json(marketplaces);
        } catch (error) {
            logger.error("Pazaryeri bilgileri alınırken hata", { error: error.message });
            res.status(500).json({ message: "❌ Sunucu hatası!" });
        }
    };

    // ✅ Yeni pazaryeri ekleme veya güncelleme (POST)
    exports.addMarketplace = async (req, res) => {
        try {
            const { userId, marketplaceName, credentials } = req.body;

            // **Zorunlu alan kontrolü**
            if (!userId || !marketplaceName || !credentials || Object.keys(credentials).length === 0) {
                return res.status(400).json({ message: "❌ Lütfen tüm alanları doldurun! API bilgileri eksik olabilir." });
            }

            // Aynı kullanıcı ve pazaryeri için mevcut entegrasyon var mı kontrol et
            const existingMarketplace = await Marketplace.findOne({ userId, marketplaceName });

            if (existingMarketplace) {
                // Mevcut entegrasyonu güncelle
                existingMarketplace.credentials = credentials;
                existingMarketplace.updatedAt = Date.now();
                await existingMarketplace.save();

                console.log("✅ Mevcut entegrasyon güncellendi:", existingMarketplace);
                return res.status(200).json({
                    message: "✅ Entegrasyon güncellendi!",
                    marketplace: existingMarketplace,
                    isUpdate: true
                });
            }

            // Yeni entegrasyon oluştur
            const newMarketplace = new Marketplace({
                userId,
                marketplaceName,
                credentials
            });

            await newMarketplace.save();

            res.status(201).json({
                message: "✅ Entegrasyon başarılı!",
                marketplace: newMarketplace,
                isUpdate: false
            });
        } catch (error) {
            logger.error("Pazaryeri eklenirken hata", { error: error.message });
            res.status(500).json({ message: "❌ Sunucu hatası!" });
        }
    };


    // ✅ Pazaryeri Güncelleme (PUT)
    exports.updateMarketplace = async (req, res) => {
        try {
            const { marketplaceName, credentials } = req.body;

            // Gerekli alanların kontrolü
            if (!credentials || Object.keys(credentials).length === 0) {
                return res.status(400).json({ message: "❌ Lütfen API bilgilerini doldurun!" });
            }

            const updatedMarketplace = await Marketplace.findByIdAndUpdate(
                req.params.id,
                {
                    credentials,
                    updatedAt: Date.now()
                },
                { new: true }
            );

            if (!updatedMarketplace) {
                return res.status(404).json({ message: "❌ Pazaryeri bulunamadı!" });
            }

            res.status(200).json({ message: "✅ Güncelleme başarılı!", marketplace: updatedMarketplace });
        } catch (error) {
            logger.error("Pazaryeri güncelleme hatası", { error: error.message });
            res.status(500).json({ message: "❌ Sunucu hatası!" });
        }
    };

    // ✅ Pazaryeri Silme (DELETE)
    exports.deleteMarketplace = async (req, res) => {
        try {
            const deletedMarketplace = await Marketplace.findByIdAndDelete(req.params.id);

            if (!deletedMarketplace) {
                return res.status(404).json({ message: "❌ Pazaryeri bulunamadı!" });
            }

            res.status(200).json({ message: "✅ Entegrasyon başarıyla silindi!" });
        } catch (error) {
            logger.error("Pazaryeri silme hatası", { error: error.message });
            res.status(500).json({ message: "❌ Sunucu hatası!" });
        }
    };

    // 🧪 Hepsiburada Credential Test (POST)
    exports.testHepsiburadaCredentials = async (req, res) => {
        try {
            const { merchantId, serviceKey } = req.body;

            if (!merchantId || !serviceKey) {
                return res.status(400).json({
                    success: false,
                    message: "❌ MerchantId ve ServiceKey gerekli!"
                });
            }

            const axios = require("axios");
            const credentials = `${merchantId}:${serviceKey}`;
            const authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;

            // Test endpoint: Basit bir API çağrısı yap
            const testUrl = `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}?offset=0&limit=1`;

            try {
                const response = await axios.get(testUrl, {
                    headers: {
                        "Authorization": authHeader,
                        "User-Agent": "LysiaETIC",
                        "Content-Type": "application/json"
                    },
                    timeout: 10000
                });

                return res.status(200).json({
                    success: true,
                    message: "✅ Credential'lar geçerli!",
                    status: response.status,
                    endpoint: "listing-external.hepsiburada.com"
                });

            } catch (error) {
                logger.warn("Hepsiburada credential test failed", { status: error.response?.status });

                return res.status(200).json({
                    success: false,
                    message: "❌ Credential'lar geçersiz!",
                    error: {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        message: error.response?.data || error.message
                    }
                });
            }

        } catch (error) {
            console.error("❌ Test hatası:", error);
            res.status(500).json({
                success: false,
                message: "❌ Sunucu hatası!"
            });
        }
    };