const axios = require("axios");
const logger = require("../config/logger");

/**
 * N11 REST API SERVİSİ
 *
 * N11 yeni REST API dokümantasyonuna göre hazırlanmıştır.
 * Endpoint: https://api.n11.com
 * Auth: Headers'da appkey ve appsecret
 */

const N11_BASE_URL = "https://api.n11.com";

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

/**
 * N11 API isteği için headers oluştur
 */
const getN11Headers = (apiKey, secretKey) => {
    return {
        appkey: apiKey,
        appsecret: secretKey,
        "Content-Type": "application/json",
        "User-Agent": "LysiaETIC"
    };
};

/**
 * N11 API hatalarını işle — her zaman { success: false, error } döndürür, throw ETMEZ
 */
const handleN11Error = (error, operation) => {
    const statusCode = error.response?.status || 0;
    const errorData  = error.response?.data;

    let message = `N11 ${operation} hatası: `;

    if (statusCode === 401 || statusCode === 403) {
        message += "API bilgileri geçersiz. appkey ve appsecret bilgilerinizi kontrol edin.";
    } else if (statusCode === 404) {
        message += "İstenen kaynak bulunamadı.";
    } else if (statusCode === 429) {
        message += "Çok fazla istek. Lütfen bekleyip tekrar deneyin.";
    } else if (statusCode >= 500) {
        message += "N11 sunucusunda geçici bir sorun var.";
    } else if (errorData?.reasons) {
        message += Array.isArray(errorData.reasons)
            ? errorData.reasons.join(", ")
            : String(errorData.reasons);
    } else if (errorData?.message) {
        message += errorData.message;
    } else if (error.code === "ECONNABORTED") {
        message += "Bağlantı zaman aşımına uğradı.";
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        message += "N11 API'sine bağlanılamadı. İnternet bağlantınızı kontrol edin.";
    } else {
        message += error.message || "Bilinmeyen hata";
    }

    logger.error(`[N11 ${operation}]`, {
        status: statusCode,
        errorData,
        message: error.message,
        code: error.code
    });

    // throw ETME — çağıran fonksiyon { success: false } döndürsün
    return { success: false, error: message, statusCode };
};

// ═══════════════════════════════════════════════════════════════
// 📦 ÜRÜN SERVİSLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün Yükleme (CreateProduct)
 * POST /ms/product/tasks/product-create
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Array} products - Ürün listesi
 * @param {String} integrator - Entegratör firma ismi
 * @returns {Object} { id, type, status, reasons }
 */
const createProduct = async (credentials, products, integrator = "LysiaETIC") => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) {
            return { success: false, error: "N11 credentials eksik: apiKey ve secretKey gerekli" };
        }
        if (!products || products.length === 0) {
            return { success: false, error: "Ürün listesi boş" };
        }

        // Ürünleri N11 formatına dönüştür
        const skus = products.map(product => {
            // productMainId zorunlu — boş olamaz
            const productMainId = (
                product.productMainId ||
                product.sku          ||
                product.stockCode    ||
                product.barcode      ||
                ""
            ).toString().trim();

            if (!productMainId) {
                logger.warn(`[N11 CREATE PRODUCT] productMainId boş — ürün atlandı: ${product.title || product.name}`);
            }

            // stockCode zorunlu — boş olamaz
            const stockCode = (
                product.sku       ||
                product.stockCode ||
                product.barcode   ||
                productMainId     ||
                ""
            ).toString().trim();

            // categoryId: N11 geçerli bir kategori ID'si gerektirir
            // Fallback olarak 1000476 (Diğer) yerine 0 bırakıp zorunlu alan uyarısı ver
            const categoryId = parseInt(product.categoryId);
            if (!categoryId || isNaN(categoryId)) {
                logger.warn(`[N11 CREATE PRODUCT] categoryId eksik veya geçersiz — ürün: ${product.title || product.name}. N11 kategori eşleştirmesi yapılmadan ürün yüklenemez.`);
            }

            // shipmentTemplate: N11 Hesabım > Teslimat Bilgileri'nden oluşturulan şablon ADI (string)
            // Dokümantasyon örneklerinde "1" gibi sayısal string ID olarak geliyor.
            // productSyncService'te boşsa zaten hata döndürülür — buraya boş gelmemeli.
            // Yine de boş gelirse loglayıp olduğu gibi bırak (N11 zaten reddeder, neden belli olur).
            const shipmentTemplate = (product.shipmentTemplate || "STANDART").toString().trim();
            if (!shipmentTemplate) {
                logger.error(`[N11 CREATE PRODUCT] ❌ shipmentTemplate boş — ürün: "${product.title || product.name}". N11 Paneli → Hesabım → Teslimat Bilgileri'nden şablon adını öğrenip credentials.shipmentTemplate olarak kaydedin.`);
            }

            // Marka — N11 SkuDTO'da "brand" alanı YOK
            // Marka attributes içinde { id: 1, valueId: null, customValue: "Marka Adı" } olarak gönderilmeli
            // Marka attribute ID'si TÜM kategorilerde SABİT = 1
            // NOT: product.attributes bir array olabilir — array?.brand her zaman undefined döner!
            // Bu yüzden brand bilgisi ayrı bir alan olarak (product.brand) gelmeli
            const brandName = (
                product.brand ||
                (typeof product.attributes === "object" && !Array.isArray(product.attributes)
                    ? product.attributes?.brand
                    : null) ||
                ""
            ).toString().trim();

            // Görseller — N11 zorunlu: en az 1 görsel, https:// ile başlamalı
            // productSyncService zaten validasyon yapar ama burada da savunmacı kontrol
            const validImages = (product.images || [])
                .map(img => {
                    if (typeof img === "string") return img.trim();
                    if (img && typeof img === "object" && img.url) return img.url.toString().trim();
                    return null;
                })
                .filter(url => url && url.startsWith("https://"))
                .map((url, index) => ({ url, order: index }));

            if (validImages.length === 0) {
                logger.error(`[N11 CREATE PRODUCT] ❌ Geçerli görsel yok — "${product.title || product.name}". N11 en az 1 https:// görsel zorunlu kılar.`);
            }

            // Fiyat normalize — virgül → nokta (Türkçe format desteği)
            // N11 nokta ayracı kullanır: 199.99 ✅  199,99 ❌
            const parsePrice = (val) => {
                if (!val && val !== 0) return 0;
                const str = val.toString().trim();
                // "1.999,99" → Türkçe format: binlik nokta, ondalık virgül
                if (str.includes(".") && str.includes(",")) {
                    return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
                }
                // "199,99" → ondalık virgül
                if (str.includes(",")) {
                    return parseFloat(str.replace(",", ".")) || 0;
                }
                return parseFloat(str) || 0;
            };

            const salePrice = parsePrice(product.price || product.salePrice);
            const listPrice = parsePrice(product.listPrice || product.price || product.salePrice);

            // categoryId — masterProductAdapter.toN11() tarafından zaten doğrulanmış gelir
            // 1000476 fallback KULLANILMAZ — kategori mapping zorunlu
            if (!categoryId || isNaN(categoryId)) {
                logger.error(
                    `[N11 CREATE PRODUCT] ❌ categoryId geçersiz — ürün: "${product.title || product.name}". ` +
                    `Kategori mapping yapılmadan ürün gönderilemez.`
                );
                // Bu ürünü atla — throw etme, diğer ürünler devam etsin
                return null;
            }

            const sku = {
                title:            (product.title || product.name || "").toString().trim(),
                description:      (product.description || product.title || product.name || "").toString().trim(),
                categoryId,
                currencyType:     product.currencyType || "TL",
                productMainId,
                preparingDay:     parseInt(product.preparingDay) || 3,
                shipmentTemplate,
                stockCode,
                // n11Payload'dan quantity gelir (masterProductAdapter.toN11 quantity olarak set eder)
                quantity:         parseInt(product.quantity ?? product.stock) || 0,
                salePrice,
                listPrice,
                vatRate:          parseInt(product.vatRate) || 10,
                images:           validImages
            };
            // Opsiyonel alanlar — sadece değer varsa ekle
            if (product.maxPurchaseQuantity) sku.maxPurchaseQuantity = parseInt(product.maxPurchaseQuantity);
            if (product.catalogId)           sku.catalogId = product.catalogId;
            if (product.barcode)             sku.barcode = product.barcode.toString().trim();

            // Attributes — n11MappingService.transformProductForN11() tarafından hazırlanmış
            // array formatında gelir: [{ id, valueId, customValue }]
            //
            // Kurallar (n11MappingService zaten uygular, burada sadece son doğrulama):
            //   id:1  (Marka) → customValue ile gönderilir, valueId: null
            //   Diğer, isCustomValue:false → valueId ile gönderilir, customValue: null
            //   Diğer, isCustomValue:true  → customValue ile gönderilir, valueId: null
            const BRAND_ATTRIBUTE_ID = 1;

            let attrs = [];
            if (Array.isArray(product.attributes)) {
                attrs = product.attributes
                    .filter(a => {
                        if (!a || typeof a !== "object") return false;
                        const attrId = Number(a.id);
                        if (isNaN(attrId) || attrId <= 0) return false;

                        // Marka (id:1) — customValue zorunlu
                        if (attrId === BRAND_ATTRIBUTE_ID) {
                            return !!(a.customValue && a.customValue.toString().trim());
                        }

                        // Diğerleri: ya geçerli valueId YA DA geçerli customValue olmalı
                        const hasValueId    = Number(a.valueId) > 0;
                        const hasCustomVal  = !!(a.customValue &&
                            a.customValue.toString().trim() !== "" &&
                            a.customValue.toString().trim() !== "null");
                        return hasValueId || hasCustomVal;
                    })
                    .map(a => {
                        const attrId     = Number(a.id);
                        const isBrand    = attrId === BRAND_ATTRIBUTE_ID;
                        const hasValueId = Number(a.valueId) > 0;

                        return {
                            id:          attrId,
                            // Marka veya customValue-only attribute → valueId null
                            valueId:     (!isBrand && hasValueId) ? Number(a.valueId) : null,
                            // Marka → customValue zorunlu; diğerleri → valueId varsa "null" string, yoksa customValue
                            customValue: isBrand
                                ? (a.customValue || brandName || "Genel").toString().trim()
                                : (!hasValueId && a.customValue && a.customValue !== "null")
                                    ? a.customValue.toString().trim()
                                    : "null"
                        };
                    });
            }

            // Marka (id:1) — zaten yoksa başa ekle
            if (brandName) {
                const hasBrand = attrs.some(a => Number(a.id) === BRAND_ATTRIBUTE_ID);
                if (!hasBrand) {
                    attrs.unshift({
                        id:          BRAND_ATTRIBUTE_ID,
                        valueId:     null,
                        customValue: brandName
                    });
                }
            }

            // Her zaman attributes gönder (en az marka)
            sku.attributes = attrs;

            return sku;
        }).filter(Boolean); // null dönen sku'ları (categoryId geçersiz) filtrele

        // Tüm sku'lar geçersizse hata döndür
        if (skus.length === 0) {
            return { success: false, error: "Gönderilecek geçerli ürün bulunamadı (categoryId eksik veya geçersiz)" };
        }

        const payload = {
            payload: {
                integrator,
                skus
            }
        };

        // N11'e gönderilen tam payload'ı logla — hata ayıklama için kritik
        logger.info(`[N11 CREATE PRODUCT] ${skus.length} ürün yükleniyor...`);
        logger.info(`[N11 CREATE PRODUCT] Payload:`, JSON.stringify(payload, null, 2));

        const response = await axios.post(
            `${N11_BASE_URL}/ms/product/tasks/product-create`,
            payload,
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 30000
            }
        );

        logger.info(`[N11 CREATE PRODUCT] Task oluşturuldu — id: ${response.data?.id}, status: ${response.data?.status}`);

        return {
            success: true,
            taskId:  response.data?.id,
            type:    response.data?.type,
            status:  response.data?.status,
            reasons: response.data?.reasons || [],
            data:    response.data
        };

    } catch (error) {
        return handleN11Error(error, "Ürün Yükleme");
    }
};

/**
 * Ürün Fiyat-Stok Güncelleme (UpdateProductPriceAndStock)
 * POST /ms/product/tasks/sku-update
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Array} updates - Güncellenecek ürünler [{ stockCode, quantity, salePrice, listPrice }]
 * @param {String} integrator - Entegratör firma ismi
 */
const updateProductPriceAndStock = async (credentials, updates, integrator = "LysiaETIC") => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) {
            return { success: false, error: "N11 credentials eksik: apiKey ve secretKey gerekli" };
        }
        if (!updates || updates.length === 0) {
            return { success: false, error: "Güncelleme listesi boş" };
        }

        const skus = updates.map(item => {
            const sku = {
                stockCode: item.stockCode || item.sku || "",
                quantity:  parseInt(item.quantity !== undefined ? item.quantity : item.stock) || 0
            };
            // Fiyat güncelleme opsiyonel
            if (item.salePrice !== undefined)  sku.salePrice  = parseFloat(item.salePrice  || item.price) || 0;
            if (item.listPrice !== undefined)  sku.listPrice  = parseFloat(item.listPrice  || item.salePrice || item.price) || 0;
            return sku;
        });

        const payload = { payload: { integrator, skus } };

        logger.info(`[N11 UPDATE STOCK] ${skus.length} SKU güncelleniyor...`);

        const response = await axios.post(
            `${N11_BASE_URL}/ms/product/tasks/price-stock-update`,  // ✅ Doğru endpoint (dokümantasyon)
            payload,
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 20000
            }
        );

        logger.info(`[N11 UPDATE STOCK] Task oluşturuldu — id: ${response.data?.id}, status: ${response.data?.status}`);

        return {
            success: true,
            taskId:  response.data?.id,
            type:    response.data?.type,
            status:  response.data?.status,
            reasons: response.data?.reasons || [],
            data:    response.data
        };

    } catch (error) {
        return handleN11Error(error, "Fiyat-Stok Güncelleme");
    }
};

/**
 * Task Detail Sorgulama (TaskDetails)
 * POST /ms/product/task-details/page-query
 *
 * N11 dokümantasyonuna göre doğru endpoint:
 * https://magazadestek.n11.com/satis-surecleri/restapi-urun-bilgileri-ve-fiyat-stok-guncelleme-servisi-10173
 *
 * Response status değerleri:
 *   PROCESSED  = İşlem tamamlandı
 *   IN_QUEUE   = İşleniyor
 *   REJECT     = Task işlenmemiştir
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {String|Number} taskId - Task ID (createProduct veya updateProduct'tan dönen id)
 */
const getTaskDetails = async (credentials, taskId) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik" };
        if (!taskId)               return { success: false, error: "taskId gerekli" };

        const response = await axios.post(
            `${N11_BASE_URL}/ms/product/task-details/page-query`,
            {
                taskId:   Number(taskId),   // ✅ integer olarak gönder
                pageable: { page: 0, size: 1000 }  // ✅ dokümantasyon zorunlu kılar
            },
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 15000
            }
        );

        // Yanıt yapısı: { taskId, status, skus: { content: [...] }, createdDate, modifiedDate }
        // status: "PROCESSED" | "IN_QUEUE" | "REJECT"
        // skus.content[].status: "SUCCESS" | "Fail"
        const data   = response.data;
        const status = data?.status;

        // SKU bazlı başarı/hata kontrolü
        const skuContent = data?.skus?.content || [];
        const failedSkus = skuContent.filter(s => s.status === "Fail" || s.status === "FAIL");
        const reasons    = skuContent.flatMap(s => s.reasons || []);

        logger.info(`[N11 TASK DETAIL] taskId: ${taskId}, status: ${status}, skuCount: ${skuContent.length}, failed: ${failedSkus.length}`);

        return {
            success: true,
            data: {
                ...data,
                // Normalize: polling kodunun beklediği status değerlerine çevir
                status:  status === "PROCESSED" ? "COMPLETED"
                       : status === "REJECT"    ? "REJECT"
                       : status === "IN_QUEUE"  ? "IN_QUEUE"
                       : status,
                reasons,
                failedSkus
            }
        };

    } catch (error) {
        return handleN11Error(error, "Task Detay Sorgulama");
    }
};

/**
 * Satıcı Ürünlerini Listeleme (GetProductQuery)
 * GET /ms/product-query
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Object} params - { page, size }
 */
const getProducts = async (credentials, params = {}) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik", products: [] };

        const response = await axios.get(
            `${N11_BASE_URL}/ms/product-query`,
            {
                headers: getN11Headers(apiKey, secretKey),
                params: {
                    page: params.page || 0,
                    size: params.size || 100
                },
                timeout: 20000
            }
        );

        // N11 API yanıt yapısını logla (debug için)
        logger.info(`[N11 GET PRODUCTS] API Yanıt Yapısı:`, {
            statusCode: response.status,
            dataKeys: Object.keys(response.data || {}),
            sampleData: JSON.stringify(response.data).substring(0, 500)
        });

        // ═══════════════════════════════════════════════════════════════
        // N11 API Yanıt Yapısı (resmi dokümantasyon):
        // {
        //   "content": [ { n11ProductId, stockCode, title, salePrice, listPrice, quantity, barcode, imageUrls, categoryId, attributes, ... } ],
        //   "totalElements": 100,
        //   "totalPages": 5,
        //   "number": 0,
        //   "size": 20,
        //   "numberOfElements": 20,
        //   ...
        // }
        // ═══════════════════════════════════════════════════════════════

        let raw = [];
        if (response.data) {
            // Öncelik sırası: content (resmi N11 yanıtı) > diğer olası yapılar
            if (response.data.content && Array.isArray(response.data.content)) {
                raw = response.data.content;
            } else if (Array.isArray(response.data)) {
                raw = response.data;
            } else if (response.data.products && Array.isArray(response.data.products)) {
                raw = response.data.products;
            } else if (response.data.productList && Array.isArray(response.data.productList)) {
                raw = response.data.productList;
            } else if (response.data.data?.products && Array.isArray(response.data.data.products)) {
                raw = response.data.data.products;
            } else if (response.data.result?.productList && Array.isArray(response.data.result.productList)) {
                raw = response.data.result.productList;
            }
        }

        logger.info(`[N11 GET PRODUCTS] ${raw.length} ürün çekildi (page: ${params.page || 0})`);

        // Eğer hiç ürün yoksa detaylı log
        if (raw.length === 0) {
            logger.warn(`[N11 GET PRODUCTS] Ürün bulunamadı. API Yanıtı:`, {
                dataKeys: Object.keys(response.data || {}),
                fullResponse: JSON.stringify(response.data, null, 2).substring(0, 2000)
            });
        } else {
            // İlk ürünün alanlarını logla (debug için)
            logger.info(`[N11 GET PRODUCTS] İlk ürün alanları:`, {
                keys: Object.keys(raw[0] || {}),
                sample: JSON.stringify(raw[0], null, 2).substring(0, 800)
            });
        }

        return {
            success: true,
            products: raw.map(p => {
                // N11 resmi API alanları: n11ProductId, stockCode, title, salePrice, listPrice, quantity, barcode, imageUrls, categoryId, attributes
                // imageUrls: string array (N11 resmi format)
                // images: bazı eski API'lerde object array olabilir
                let images = [];
                if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) {
                    images = p.imageUrls.map(url => (typeof url === "string" ? url : (url?.url || url)));
                } else if (Array.isArray(p.images) && p.images.length > 0) {
                    images = p.images.map(img => (typeof img === "string" ? img : (img?.url || img)));
                } else if (p.imageUrl) {
                    images = [p.imageUrl];
                }

                // N11 attributes: [{ attributeId, attributeName, attributeValue }]
                let attrs = {};
                if (Array.isArray(p.attributes)) {
                    p.attributes.forEach(a => {
                        if (a.attributeName && a.attributeValue) {
                            attrs[a.attributeName] = a.attributeValue;
                        }
                    });
                } else if (p.attributes && typeof p.attributes === "object") {
                    attrs = p.attributes;
                }

                return {
                    marketplaceProductId: String(p.n11ProductId || p.id || p.productId || p.productSellerCode || ""),
                    barcode:    p.barcode || p.stockCode || p.productSellerCode || "",
                    sku:        p.stockCode || p.productSellerCode || p.barcode || "",
                    name:       p.title || p.productName || p.name || "İsimsiz Ürün",
                    description: p.description || "",
                    price:      parseFloat(p.salePrice || p.sellingPrice || p.price || 0),
                    listPrice:  parseFloat(p.listPrice || p.salePrice || p.sellingPrice || p.price || 0),
                    stock:      parseInt(p.quantity || p.stock || 0),
                    category:   p.categoryName || p.category || "",
                    categoryId: p.categoryId || null,
                    brand:      attrs["Marka"] || p.brandName || "",
                    images,
                    attributes: attrs
                };
            }),
            total: response.data?.totalElements || response.data?.total || raw.length,
            totalPages: response.data?.totalPages || null,
            page: response.data?.number ?? (params.page || 0),
            size: response.data?.size || (params.size || 100)
        };

    } catch (error) {
        return handleN11Error(error, "Ürün Listeleme");
    }
};

// ═══════════════════════════════════════════════════════════════
// 📂 KATEGORİ SERVİSLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * Kategori Ağacı Listeleme (GetCategories)
 * GET /cdn/categories
 *
 * N11 dokümantasyonuna göre doğru endpoint (CDN tabanlı):
 * https://magazadestek.n11.com/satis-surecleri/restapi-kategori-agaci-ve-kategori-ozellikleri-listeleme-10473
 *
 * Tüm N11 kategori ağacını tek istekle döndürür.
 * subCategories === null olan kategoriler en alt kırılımdır (ürün yüklenebilir).
 *
 * @param {Object} credentials - { apiKey, secretKey }
 */
const getCategories = async (credentials) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik", categories: [] };

        const response = await axios.get(
            `${N11_BASE_URL}/cdn/categories`,  // ✅ Doğru endpoint
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 30000  // Tüm kategori ağacı büyük olabilir
            }
        );

        return {
            success:    true,
            categories: response.data?.categories || response.data || []
        };

    } catch (error) {
        return handleN11Error(error, "Kategori Listeleme");
    }
};

/**
 * Kategori Özellikleri Listeleme (GetCategoryAttributesList)
 * GET /cdn/category/{categoryId}/attribute
 *
 * N11 dokümantasyonuna göre doğru endpoint (CDN tabanlı):
 * https://magazadestek.n11.com/satis-surecleri/restapi-kategori-agaci-ve-kategori-ozellikleri-listeleme-10473
 *
 * Response yapısı:
 *   { id, name, categoryAttributes: [{ attributeId, attributeName, isMandatory, isVariant,
 *     isCustomValue, attributeValues: [{ id, value }] }] }
 *
 * ÖNEMLİ: Marka attribute ID'si TÜM kategorilerde SABİT = 1
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Number} categoryId - Kategori ID
 */
const getCategoryAttributes = async (credentials, categoryId) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik", attributes: [] };
        if (!categoryId)           return { success: false, error: "categoryId gerekli", attributes: [] };

        const response = await axios.get(
            `${N11_BASE_URL}/cdn/category/${categoryId}/attribute`,  // ✅ Doğru endpoint
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 15000
            }
        );

        // Response: { id, name, categoryAttributes: [...] }
        const categoryAttributes = response.data?.categoryAttributes || response.data?.attributes || response.data || [];

        logger.info(`[N11 CATEGORY ATTRS] categoryId: ${categoryId}, ${Array.isArray(categoryAttributes) ? categoryAttributes.length : "?"} attribute`);

        return {
            success:    true,
            categoryId: response.data?.id || categoryId,
            name:       response.data?.name || "",
            attributes: categoryAttributes
        };

    } catch (error) {
        return handleN11Error(error, "Kategori Özellikleri");
    }
};

// ═══════════════════════════════════════════════════════════════
// 📦 SİPARİŞ SERVİSLERİ
// ═══════════════════════════════════════════════════════════════

/**
 * Sipariş Listeleme (GetShipmentPackages)
 * GET /rest/delivery/v1/shipmentPackages
 *
 * ⚠️ N11 REST API Kuralları:
 *   - Endpoint: /rest/delivery/v1/shipmentPackages (güncel)
 *   - Status parametresi her istekte TEK bir değer alır (virgülle ayrılmaz)
 *   - Birden fazla statü için ayrı ayrı istek atılmalıdır
 *   - 2024 Kasım öncesi sipariş datası bu servisten verilmez
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Object} params - { status, startDate, endDate, page, size }
 */
const getOrders = async (credentials, params = {}) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik", orders: [] };

        // Status virgülle ayrılmışsa her biri için ayrı istek at
        const statuses = params.status ? params.status.split(",").map(s => s.trim()).filter(Boolean) : [null];
        let allOrders = [];

        for (const status of statuses) {
            const queryParams = {
                page: params.page || 0,
                size: params.size || 100
            };
            if (status)           queryParams.status    = status;
            if (params.startDate) queryParams.startDate = params.startDate;
            if (params.endDate)   queryParams.endDate   = params.endDate;

            try {
                const response = await axios.get(
                    `${N11_BASE_URL}/rest/delivery/v1/shipmentPackages`,
                    {
                        headers: getN11Headers(apiKey, secretKey),
                        params:  queryParams,
                        timeout: 20000
                    }
                );

                const orders = response.data?.content || [];
                allOrders = allOrders.concat(orders);
            } catch (innerError) {
                // Tek bir status hata verirse diğerlerine devam et
                logger.warn(`[N11 Sipariş] Status "${status}" sorgusu başarısız: ${innerError.response?.status || innerError.message}`);
            }
        }

        return {
            success: true,
            orders: allOrders
        };

    } catch (error) {
        return handleN11Error(error, "Sipariş Listeleme");
    }
};

/**
 * Sipariş Kalemlerini Güncelleme (UpdateOrder)
 * PUT /rest/order/v1/update
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Array} lineIds - Sipariş kalemi ID'leri
 * @param {String} status - Yeni durum (örn: "Picking")
 */
const updateOrderStatus = async (credentials, lineIds, status = "Picking") => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik", results: [] };
        if (!lineIds || lineIds.length === 0) return { success: false, error: "lineIds boş", results: [] };

        const payload = {
            lines: lineIds.map(lineId => ({ lineId })),
            status
        };

        const response = await axios.put(
            `${N11_BASE_URL}/rest/order/v1/update`,
            payload,
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 15000
            }
        );

        return {
            success: true,
            results: response.data?.content || []
        };

    } catch (error) {
        return handleN11Error(error, "Sipariş Güncelleme");
    }
};

/**
 * Paket Bölme (SplitPackages)
 * POST /rest/delivery/v1/splitCombinePackage
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Array} splitGroups - [{ orderLineIds: [...] }]
 */
const splitPackage = async (credentials, splitGroups) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik" };

        const response = await axios.post(
            `${N11_BASE_URL}/rest/delivery/v1/splitCombinePackage`,
            { splitGroups },
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 15000
            }
        );

        return {
            success: true,
            code:    response.data?.code,
            message: response.data?.message
        };

    } catch (error) {
        return handleN11Error(error, "Paket Bölme");
    }
};

/**
 * Miktar Bazlı Paket Bölme & Sipariş Ürün İptali
 * POST /rest/delivery/v1/splitPackageByQuantity
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Object} data - { splitPackages, cancelledItems }
 */
const splitPackageByQuantity = async (credentials, data) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik" };

        const response = await axios.post(
            `${N11_BASE_URL}/rest/delivery/v1/splitPackageByQuantity`,
            data,
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 15000
            }
        );

        return {
            success: true,
            code:    response.data?.code,
            message: response.data?.message
        };

    } catch (error) {
        return handleN11Error(error, "Miktar Bazlı Paket Bölme");
    }
};

/**
 * Sipariş Kalemi İşçilik Bedeli Ekleme
 * PUT /rest/order/v1/labor-costs
 *
 * @param {Object} credentials - { apiKey, secretKey }
 * @param {Array} laborCostDetails - [{ orderLineId, totalLaborCostExcludingVAT, laborVatRate }]
 */
const addLaborCost = async (credentials, laborCostDetails) => {
    try {
        const { apiKey, secretKey } = credentials;

        if (!apiKey || !secretKey) return { success: false, error: "N11 credentials eksik", results: [] };

        const response = await axios.put(
            `${N11_BASE_URL}/rest/order/v1/labor-costs`,
            { laborCostDetails },
            {
                headers: getN11Headers(apiKey, secretKey),
                timeout: 15000
            }
        );

        return {
            success: true,
            results: response.data?.content || []
        };

    } catch (error) {
        return handleN11Error(error, "İşçilik Bedeli Ekleme");
    }
};

module.exports = {
    // Ürün Servisleri
    createProduct,
    updateProductPriceAndStock,
    getTaskDetails,
    getProducts,

    // Kategori Servisleri
    getCategories,
    getCategoryAttributes,

    // Sipariş Servisleri
    getOrders,
    updateOrderStatus,
    splitPackage,
    splitPackageByQuantity,
    addLaborCost
};
