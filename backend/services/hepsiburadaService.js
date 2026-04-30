const axios = require("axios");
const moment = require("moment");
const logger = require("../config/logger");

// ═══════════════════════════════════════════════════════════════════════
// 🏪 HEPSİBURADA API SERVİSİ
// ═══════════════════════════════════════════════════════════════════════
// Hepsiburada API Dokümantasyonu:
//   https://developers.hepsiburada.com/hepsiburada/reference/katalog-onemli-bilgiler
//
// ÖNEMLİ KURALLAR:
//   1. Auth: HTTP Basic Auth → base64(merchantId:secretKey)
//   2. Header: User-Agent → Hepsiburada'nın satıcıya verdiği developer username
//   3. TEST ortamı: URL'lerde "-sit" eki var (ör: mpop-sit, listing-external-sit)
//   4. CANLI ortam: URL'lerde "-sit" eki YOK
//   5. Canlı ortam url'leri endpoint içinde "-sit" ifadesi kaldırılarak oluşturulur
// ═══════════════════════════════════════════════════════════════════════

// ── Endpoint Sabitleri ─────────────────────────────────────────────────
// Canlı (Production) endpoint'leri — "-sit" olmadan
const HB_ENDPOINTS = {
    // Katalog & Listeleme
    LISTING:     "https://listing-external.hepsiburada.com",
    // Sipariş Yönetimi (OMS)
    OMS:         "https://oms-external.hepsiburada.com",
    // Katalog Ürün Girişi (MPOP)
    MPOP:        "https://mpop.hepsiburada.com",
    // Sipariş Yönetimi — Sipariş listeleme de OMS üzerinden yapılır
    // (marketplace.hepsiburada.com diye bir endpoint YOKTUR — ENOTFOUND verir)
    MARKETPLACE: "https://oms-external.hepsiburada.com",
    // Kategori API
    CATEGORY:    "https://listing-external.hepsiburada.com"
};

// Test (SIT) endpoint'leri — sadece test hesapları için
const HB_SIT_ENDPOINTS = {
    LISTING:     "https://listing-external-sit.hepsiburada.com",
    OMS:         "https://oms-external-sit.hepsiburada.com",
    MPOP:        "https://mpop-sit.hepsiburada.com",
    MARKETPLACE: "https://oms-external-sit.hepsiburada.com",
    CATEGORY:    "https://listing-external-sit.hepsiburada.com"
};

/**
 * Hepsiburada credential'larını normalize et
 * Farklı kaynaklardan gelen credential alanlarını standart formata çevir
 *
 * Hepsiburada Auth Formatı:
 *   - merchantId: Mağaza ID (UUID) → Basic Auth username & URL parametresi
 *   - secretKey: Servis Anahtarı → Basic Auth password
 *   - userAgent: Developer Username → User-Agent header
 *
 * @param {object} credentials - Ham credential objesi (DB'den gelen)
 * @returns {{ merchantId: string, secretKey: string, userAgent: string }}
 */
const normalizeCredentials = (credentials) => {
    if (!credentials) return { merchantId: null, secretKey: null, userAgent: null };

    const {
        merchantId,
        // secretKey farklı isimlerle kaydedilmiş olabilir (geriye dönük uyumluluk)
        secretKey, apiKey, serviceKey, password, apiSecret,
        // userAgent farklı isimlerle kaydedilmiş olabilir
        userAgent, developerUsername, user_agent
    } = credentials;

    return {
        merchantId: merchantId || null,
        secretKey:  secretKey || serviceKey || apiKey || password || apiSecret || null,
        userAgent:  userAgent || developerUsername || user_agent || "LysiaETIC",
        useSit:     credentials.useSit || false
    };
};

/**
 * Auth Header Oluştur
 * Hepsiburada Format: Basic base64(merchantId:secretKey)
 * @param {string} merchantId - Mağaza ID (UUID)
 * @param {string} secretKey - Servis Anahtarı
 * @returns {string} Authorization header değeri
 */
const getAuthHeader = (merchantId, secretKey) => {
    const credentials = `${merchantId}:${secretKey}`;
    return `Basic ${Buffer.from(credentials, "utf-8").toString("base64").trim()}`;
};

/**
 * Standart Hepsiburada request header'ları oluştur
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} userAgent - Developer Username (User-Agent)
 * @returns {object} Headers objesi
 */
const getHeaders = (merchantId, secretKey, userAgent) => ({
    "Authorization": getAuthHeader(merchantId, secretKey),
    "User-Agent": userAgent || "LysiaETIC",
    "Content-Type": "application/json",
    "Accept": "application/json"
});

/**
 * Ortam tespiti — SIT (test) mi yoksa Production (canlı) mı?
 * SIT hesapları production endpoint'lerine 401 verir, production hesapları SIT'e 401 verir.
 * Kullanıcı credentials'ında useSit: true varsa veya env değişkeni varsa SIT kullanılır.
 * @param {object} credentials - normalizeCredentials çıktısı veya ham credentials
 * @returns {object} Doğru endpoint seti (HB_ENDPOINTS veya HB_SIT_ENDPOINTS)
 */
const getEndpoints = (credentials) => {
    // credentials içinde useSit flag'i varsa veya env değişkeni varsa SIT kullan
    const useSit = credentials?.useSit === true ||
                   credentials?.useSit === "true" ||
                   process.env.HEPSIBURADA_USE_SIT === "true";
    return useSit ? HB_SIT_ENDPOINTS : HB_ENDPOINTS;
};

/**
 * Credential doğrulama — eksik alan kontrolü
 * @param {object} creds - normalizeCredentials çıktısı
 * @param {string} operation - İşlem adı (log için)
 * @returns {{ valid: boolean, error?: string }}
 */
const validateCredentials = (creds, operation = "") => {
    const { merchantId, secretKey } = creds;
    if (!merchantId || !secretKey) {
        const missing = [];
        if (!merchantId) missing.push("merchantId");
        if (!secretKey) missing.push("secretKey");
        return {
            valid: false,
            error: `Hepsiburada ${operation} — credentials eksik: ${missing.join(", ")}. ` +
                   `Gerekli alanlar: merchantId (Mağaza ID), secretKey (Servis Anahtarı), userAgent (Developer Username). ` +
                   `Satıcı Paneli → Entegrasyon → Entegratör Bilgileri'nden alabilirsiniz.`
        };
    }
    return { valid: true };
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 ÜRÜN LİSTELEME
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hepsiburada Ürün Listesi Çek (Listing API)
 * Endpoint: GET /listings/merchantid/{merchantId}
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} userAgent - Developer Username
 */
const fetchHepsiburadaProducts = async (merchantId, secretKey, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const ep = getEndpoints({ useSit: false });

        // ── Adım 0: Kategori API'den categoryId → categoryName map'i oluştur ──
        // v3: HER ZAMAN production endpoint kullan (SIT'te kategori yok)
        const categoryMap = new Map();
        try {
            const prodEp = HB_ENDPOINTS; // Kategori için her zaman production
            const catBaseUrls = [
                `${prodEp.MPOP}/product/api/categories/get-all-categories`,
                `${prodEp.CATEGORY}/product/api/categories/get-all-categories`
            ];
            // Tüm type'ları dene (HB ana, HX express, HC global)
            for (const type of ["HB", "HX", "HC"]) {
                let catPage = 0;
                let catHasMore = true;
                let catWorkingUrl = null;
                while (catHasMore) {
                    const urlsToTry = catWorkingUrl ? [catWorkingUrl] : catBaseUrls;
                    let catPageSuccess = false;
                    for (const baseUrl of urlsToTry) {
                        const catUrl = `${baseUrl}?leaf=true&status=ACTIVE&available=true&type=${type}&version=1&page=${catPage}&size=2000`;
                        try {
                            const catResp = await axios.get(catUrl, { headers, timeout: 30000 });
                            const catData = catResp.data;
                            const cats = Array.isArray(catData) ? catData : (catData?.data || catData?.content || []);
                            if (cats.length > 0) {
                                for (const cat of cats) {
                                    const cid = cat.categoryId || cat.id;
                                    const cname = cat.name || cat.categoryName || "";
                                    if (cid && cname) categoryMap.set(String(cid), cname);
                                }
                                catWorkingUrl = baseUrl;
                                catPage++;
                                catPageSuccess = true;
                                if (cats.length < 2000) catHasMore = false;
                                break;
                            } else {
                                if (catWorkingUrl === baseUrl) { catHasMore = false; catPageSuccess = true; break; }
                            }
                        } catch (e) { /* sonraki URL'yi dene */ }
                    }
                    if (!catPageSuccess) catHasMore = false;
                }
            }
            // Type'lı çağrılar boş döndüyse type'sız dene (geriye dönük uyumluluk)
            if (categoryMap.size === 0) {
                let catPage = 0;
                let catHasMore = true;
                while (catHasMore) {
                    const catUrl = `${catBaseUrls[0]}?leaf=true&status=ACTIVE&available=true&version=1&page=${catPage}&size=2000`;
                    try {
                        const catResp = await axios.get(catUrl, { headers, timeout: 30000 });
                        const catData = catResp.data;
                        const cats = Array.isArray(catData) ? catData : (catData?.data || catData?.content || []);
                        for (const cat of cats) {
                            const cid = cat.categoryId || cat.id;
                            const cname = cat.name || cat.categoryName || "";
                            if (cid && cname) categoryMap.set(String(cid), cname);
                        }
                        catHasMore = cats.length >= 2000;
                        catPage++;
                    } catch (e) { catHasMore = false; }
                }
            }
            logger.info(`[Hepsiburada CAT] ${categoryMap.size} kategori çekildi (ürün eşleştirme için)`);
        } catch (catErr) {
            logger.warn(`[Hepsiburada CAT] Kategori çekme hatası: ${catErr.message}`);
        }

        // ── Adım 1: MPOP API'den toplu ürün detaylarını çek ──
        const mpopDetailMap = new Map();
        for (const status of ["CREATED", "MATCHED"]) {
            try {
                const mpopUrl = `${ep.MPOP}/product/api/products/products-by-merchant-and-status` +
                    `?merchantId=${merchantId}&productStatus=${status}&version=1&page=0&size=1000`;
                const mpopResp = await axios.get(mpopUrl, { headers, timeout: 20000 });
                const mpopData = mpopResp.data;
                const items = Array.isArray(mpopData) ? mpopData : (mpopData?.data || mpopData?.products || mpopData?.content || []);
                for (const item of items) {
                    if (item.merchantSku) mpopDetailMap.set(item.merchantSku, item);
                    if (item.hepsiburadaSku) mpopDetailMap.set(item.hepsiburadaSku, item);
                }
            } catch (mpopErr) {
                logger.warn(`[Hepsiburada] MPOP status=${status} hatası: ${mpopErr.message}`);
            }
        }

        // ── Adım 2: Listing API'den fiyat/stok çek ──
        const products = [];
        let offset = 0;
        const limit = 200;
        let hasMore = true;

        while (hasMore) {
            const url = `${ep.LISTING}/listings/merchantid/${merchantId}?offset=${offset}&limit=${limit}`;

            const response = await axios.get(url, { headers, timeout: 15000 });

            if (response.status === 200) {
                const items = response.data?.listings || [];
                if (items.length === 0) {
                    hasMore = false;
                } else {
                    products.push(...items.map(product => {
                        const detail = mpopDetailMap.get(product.merchantSku) || mpopDetailMap.get(product.hepsiburadaSku) || null;
                        const matched = detail?.matchedHbProductInfo?.[0] || {};
                        const rawImg = matched?.images?.[0] || detail?.defaultImageUrl || "";
                        const rawCatId = detail?.categoryId || matched?.categoryId || "";
                        const catName = (rawCatId ? categoryMap.get(String(rawCatId)) : "") || detail?.categoryName || matched?.categoryName || "";
                        return {
                            sku: product.merchantSku,
                            hepsiburadaSku: product.hepsiburadaSku,
                            productName: detail?.productName || matched?.productName || product.merchantSku || "",
                            price: product.price || 0,
                            listPrice: product.listPrice || product.price || 0,
                            stock: product.availableStock || 0,
                            status: product.isSalable ? "active" : "inactive",
                            categoryName: catName,
                            imageUrl: rawImg ? rawImg.replace("{size}", "550") : "",
                            brand: matched?.brand || detail?.brand || ""
                        };
                    }));
                    offset += limit;
                    if (items.length < limit) hasMore = false;
                }
            } else {
                logger.warn("Hepsiburada API unexpected status", { status: response.status });
                hasMore = false;
            }
        }

        logger.info(`[Hepsiburada] ${products.length} ürün çekildi (${mpopDetailMap.size} MPOP detayı) — merchantId: ${merchantId.substring(0, 8)}...`);
        return products;
    } catch (error) {
        logger.error("Hepsiburada products error", {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return [];
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 🛒 SİPARİŞ YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hepsiburada Sipariş Listesi Çek (Marketplace Orders API)
 * ⚠️ ÖNEMLİ: ordersService.js'deki fetchHepsiburadaOrders ile aynı
 * Bu fonksiyon sadece geriye dönük uyumluluk için tutulmuştur
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {Date} startDate - Başlangıç tarihi
 * @param {Date} endDate - Bitiş tarihi
 */
const fetchHepsiburadaOrders = async (merchantId, secretKey, startDate, endDate) => {
    // ordersService.js'deki aynı fonksiyonu kullan
    const { fetchHepsiburadaOrders: fetchOrders } = require("./ordersService");
    return await fetchOrders(merchantId, secretKey, startDate, endDate);
};

// ═══════════════════════════════════════════════════════════════════════
// 💰 FİYAT & STOK GÜNCELLEME
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hepsiburada Stok Güncelle (Inventory Upload API)
 * Endpoint: POST /listings/merchantid/{merchantId}/inventory-uploads
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} sku - Ürün SKU (merchantSku)
 * @param {number} stock - Stok miktarı
 * @param {string} userAgent - Developer Username
 */
const updateHepsiburadaStock = async (merchantId, secretKey, sku, stock, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const ep = getEndpoints({ useSit: false });
        const url = `${ep.LISTING}/listings/merchantid/${merchantId}/inventory-uploads`;

        const payload = {
            listings: [{
                hepsiburadaSku: sku,
                merchantSku: sku,
                availableStock: parseInt(stock) || 0
            }]
        };

        const response = await axios.post(url, payload, { headers, timeout: 10000 });

        if (response.status === 200 || response.status === 201) {
            logger.info(`[Hepsiburada] Stok güncellendi — SKU: ${sku}, stok: ${stock}`);
            return true;
        } else {
            logger.warn("Hepsiburada stock update unexpected status", { status: response.status });
            return false;
        }
    } catch (error) {
        logger.error("Hepsiburada stock update error", {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return false;
    }
};

/**
 * Hepsiburada Fiyat Güncelle (Inventory Upload API)
 * Endpoint: POST /listings/merchantid/{merchantId}/inventory-uploads
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} sku - Ürün SKU (merchantSku)
 * @param {number} price - Fiyat
 * @param {string} userAgent - Developer Username
 */
const updateHepsiburadaPrice = async (merchantId, secretKey, sku, price, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const ep = getEndpoints({ useSit: false });
        const url = `${ep.LISTING}/listings/merchantid/${merchantId}/inventory-uploads`;

        const payload = {
            listings: [{
                hepsiburadaSku: sku,
                merchantSku: sku,
                price: parseFloat(price) || 0
            }]
        };

        const response = await axios.post(url, payload, { headers, timeout: 10000 });

        if (response.status === 200 || response.status === 201) {
            logger.info(`[Hepsiburada] Fiyat güncellendi — SKU: ${sku}, fiyat: ${price}`);
            return true;
        } else {
            logger.warn("Hepsiburada price update unexpected status", { status: response.status });
            return false;
        }
    } catch (error) {
        logger.error("Hepsiburada price update error", {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return false;
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📂 KATEGORİ
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hepsiburada Kategorileri Çek (v3 — Tam Kapsamlı)
 * Endpoint: GET /product/api/categories/get-all-categories
 * Params: leaf, status, available, type (HB/HX/HC), version, page, size (max 2000)
 * İstek Limiti: 200 istek/1 dakika (IP başına)
 *
 * v3 Düzeltmeler:
 *   - HER ZAMAN 3 type (HB, HX, HC) ayrı ayrı çekilip birleştiriliyor
 *   - Type'sız çağrı sadece HB (~6.500) döndürür, HC (~48.000) eksik kalır
 *   - includeAllTypes parametresi kaldırıldı — artık her zaman tüm type'lar çekilir
 *   - size 2000 (HB API max)
 *   - Birden fazla endpoint URL pattern'i deneniyor (MPOP + CATEGORY)
 *
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} userAgent - Developer Username
 * @param {object} [opts] - { onlyLeaf: bool }
 */
const fetchHepsiburadaCategories = async (merchantId, secretKey, userAgent, opts = {}) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const onlyLeaf = opts.onlyLeaf !== false; // varsayılan true (geriye dönük uyumluluk)

        // ═══════════════════════════════════════════════════════════════
        // ÖNEMLİ: Kategori API'si için HER ZAMAN Production endpoint'leri kullan!
        // SIT (test) ortamında kategori verisi YOKTUR — boş döner.
        // Kategoriler tüm satıcılar için aynıdır.
        // ═══════════════════════════════════════════════════════════════
        const prodEp = HB_ENDPOINTS;

        // Denenecek URL pattern'leri (production)
        const baseUrls = [
            `${prodEp.MPOP}/product/api/categories/get-all-categories`,
            `${prodEp.CATEGORY}/product/api/categories/get-all-categories`
        ];

        /**
         * Tek bir parametre seti ile sayfalı çekme
         */
        const fetchPaginated = async (queryOpts = {}, label = "") => {
            const categories = [];
            let page = 0;
            let hasMore = true;
            const size = 2000;
            let workingUrl = null;

            while (hasMore) {
                const urlsToTry = workingUrl ? [workingUrl] : baseUrls;
                let pageSuccess = false;

                for (const baseUrl of urlsToTry) {
                    const params = new URLSearchParams({
                        status: "ACTIVE",
                        version: "1",
                        page: String(page),
                        size: String(size)
                    });

                    if (queryOpts.leaf === true) params.set("leaf", "true");
                    if (queryOpts.available === true) params.set("available", "true");
                    if (queryOpts.type) params.set("type", queryOpts.type);

                    const url = `${baseUrl}?${params.toString()}`;

                    try {
                        const response = await axios.get(url, { headers, timeout: 45000 });
                        const data = response.data;

                        // data alanını çıkar — null/undefined/boş obje kontrolü
                        let cats = [];
                        if (Array.isArray(data)) {
                            cats = data;
                        } else if (data && typeof data === "object") {
                            const inner = data.data || data.content || data.categories;
                            if (Array.isArray(inner)) cats = inner;
                        }

                        if (cats.length > 0) {
                            categories.push(...cats);
                            workingUrl = baseUrl;
                            page++;
                            pageSuccess = true;
                            if (cats.length < size) hasMore = false;
                            break;
                        } else {
                            if (workingUrl === baseUrl) { hasMore = false; pageSuccess = true; break; }
                        }
                    } catch (err) {
                        logger.warn(`[Hepsiburada CAT${label}] ${baseUrl} hata: ${err.response?.status || err.message}`);
                    }
                }

                if (!pageSuccess) { hasMore = false; }
            }

            if (categories.length > 0) {
                logger.info(`[Hepsiburada CAT${label}] ${categories.length} kategori çekildi`);
            }
            return categories;
        };

        // ═══════════════════════════════════════════════════════════════
        // v3: HER ZAMAN 3 type'ı ayrı ayrı çek
        //
        // HB API Dokümantasyonu (developers.hepsiburada.com):
        //   - Type'sız çağrı sadece HB (~6.500) döndürür
        //   - HC (HepsiGlobal) ~48.000 kategori — ayrı çekilmeli
        //   - HX (HepsiExpress) ~400 kategori — ayrı çekilmeli
        //   - ⚠️ leaf varsayılanı TRUE — göndermezsen sadece yaprak gelir
        //   - ⚠️ available varsayılanı TRUE — göndermezsen sadece aktif gelir
        //   - Parent kategorileri almak için leaf=false AÇIKÇA gönderilmeli
        // ═══════════════════════════════════════════════════════════════
        let allCategories = [];
        const TYPES = ["HB", "HX", "HC"];

        if (onlyLeaf) {
            // Sadece yaprak — leaf=true (available filtresi KALDIRILDI — tüm leaf'ler gelsin)
            for (const type of TYPES) {
                try {
                    const cats = await fetchPaginated({ leaf: true, type }, ` ${type}`);
                    if (cats.length > 0) allCategories.push(...cats);
                } catch (e) { logger.warn(`[Hepsiburada CAT] ${type} hatası: ${e.message}`); }
            }
            // Fallback
            if (allCategories.length === 0) {
                allCategories = await fetchPaginated({ leaf: true }, " fallback");
            }
        } else {
            // Tüm kategoriler — leaf=true + leaf=false ayrı ayrı
            // ✅ FIX: available filtresi KALDIRILDI — "kolye ucu" gibi kategoriler
            //    available=false olsa bile listeye dahil edilmeli
            for (const type of TYPES) {
                try {
                    const leafCats = await fetchPaginated({ leaf: true, type }, ` ${type}-leaf`);
                    if (leafCats.length > 0) allCategories.push(...leafCats);
                    const parentCats = await fetchPaginated({ leaf: false, type }, ` ${type}-parent`);
                    if (parentCats.length > 0) allCategories.push(...parentCats);
                } catch (e) { logger.warn(`[Hepsiburada CAT] ${type} hatası: ${e.message}`); }
            }
            // Fallback
            if (allCategories.length === 0) {
                allCategories = await fetchPaginated({ leaf: true }, " leaf-fallback");
                const parentFallback = await fetchPaginated({ leaf: false }, " parent-fallback");
                if (parentFallback.length > 0) allCategories.push(...parentFallback);
            }
        }

        // Duplikasyon temizliği
        const seenIds = new Set();
        const unique = [];
        for (const cat of allCategories) {
            const id = String(cat.categoryId || cat.id || "");
            if (id && !seenIds.has(id)) { seenIds.add(id); unique.push(cat); }
        }

        logger.info(`[Hepsiburada] ${unique.length} benzersiz kategori çekildi (ham: ${allCategories.length}, types: ${TYPES.join("+")})`);
        return unique;
    } catch (error) {
        logger.error("Hepsiburada kategori çekme hatası:", {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
};

/**
 * Hepsiburada Kategori Özellikleri Çek
 * Endpoint: GET /categories/{categoryId}/attributes
 * Sadece leaf=true ve available=true kategorilerde özellik vardır
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {number} categoryId - Kategori ID
 * @param {string} userAgent - Developer Username
 */
const fetchHepsiburadaCategoryAttributes = async (merchantId, secretKey, categoryId, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        // Kategori özellikleri için her zaman production endpoint kullan
        const ep = HB_ENDPOINTS;
        const url = `${ep.CATEGORY}/categories/${categoryId}/attributes`;
        const response = await axios.get(url, { headers, timeout: 15000 });
        return response.data?.data || response.data || [];
    } catch (error) {
        logger.error(`Hepsiburada kategori özellik çekme hatası (categoryId: ${categoryId}):`, {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📤 ÜRÜN YÜKLEME (KATALOG)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hepsiburada'ya Ürün Bilgisi Gönder (Katalog Entegrasyonu)
 * Endpoint: POST /product/api/products/import
 * ⚠️ Ürün bilgileri JSON dosyası olarak form-data ile gönderilmeli
 * ⚠️ merchantSku BÜYÜK HARF olmalı, boşluk olmamalı
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {object} productData - Ürün bilgileri
 * @param {string} userAgent - Developer Username
 */
const uploadProductToHepsiburada = async (merchantId, secretKey, productData, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const productName = productData.name || productData.title || "İsimsiz Ürün";
        const merchantSku = (productData.sku || productData.barcode || "").toUpperCase().replace(/\s/g, "");

        if (!merchantSku) {
            return { success: false, error: `Hepsiburada yükleme başarısız: "${productName}" için SKU/barkod eksik` };
        }

        // Listeleme API ile stok/fiyat yükleme (ürün zaten katalogda varsa)
        const payload = {
            listings: [{
                merchantSku: merchantSku,
                hepsiburadaSku: productData.barcode || merchantSku,
                availableStock: parseInt(productData.stock) || 0,
                price: parseFloat(productData.price) || 0,
                listPrice: parseFloat(productData.listPrice || productData.price) || 0
            }]
        };

        logger.info(
            `[UPLOAD HEPSIBURADA] Ürün yükleniyor — "${productName}" | merchantSku: ${merchantSku} | ` +
            `fiyat: ${productData.price} TL | stok: ${parseInt(productData.stock) || 0}`
        );

        const ep = getEndpoints({ useSit: false });
        const url = `${ep.LISTING}/listings/merchantid/${merchantId}/inventory-uploads`;
        const response = await axios.post(url, payload, { headers, timeout: 15000 });

        const trackingId = response.data?.id || response.data?.trackingId;
        if (trackingId) {
            logger.info(`[UPLOAD HEPSIBURADA] ✅ Listing kuyruğa alındı — "${productName}" | trackingId: ${trackingId}`);
        }

        return { success: true, productId: merchantSku, trackingId, response: response.data };
    } catch (error) {
        const errData = error.response?.data;
        const errCode = error.response?.status;
        let errMsg = error.message;
        if (errData) {
            if (errData.errors && Array.isArray(errData.errors)) {
                errMsg = errData.errors.map(e => e.message || e.code || JSON.stringify(e)).join(" | ");
            } else if (errData.message) errMsg = errData.message;
            else if (typeof errData === "string") errMsg = errData;
            else errMsg = JSON.stringify(errData);
        }
        logger.error(
            `[UPLOAD HEPSIBURADA] ❌ Hata — status: ${errCode} | error: ${errMsg}`
        );
        return { success: false, error: errMsg };
    }
};

/**
 * Hepsiburada Ürün Durumu Sorgula (TrackingId ile)
 * Endpoint: GET /product/api/products/status/{trackingId}
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} trackingId - Takip kodu
 * @param {string} userAgent - Developer Username
 */
const checkProductStatus = async (merchantId, secretKey, trackingId, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const ep = getEndpoints({ useSit: false });
        const url = `${ep.MPOP}/product/api/products/status/${trackingId}`;
        const response = await axios.get(url, { headers, timeout: 15000 });
        return { success: true, data: response.data };
    } catch (error) {
        logger.error(`Hepsiburada ürün durumu sorgulama hatası (trackingId: ${trackingId}):`, error.message);
        return { success: false, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════════════
// 📦 PAKET / KARGO
// ═══════════════════════════════════════════════════════════════════════

/**
 * Hepsiburada Paketleri Çek (OMS API)
 * Endpoint: GET /packages/merchantid/{merchantId}
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} startDate - Başlangıç tarihi (ISO)
 * @param {string} endDate - Bitiş tarihi (ISO)
 * @param {string} userAgent - Developer Username
 */
const fetchHepsiburadaPackages = async (merchantId, secretKey, startDate, endDate, userAgent) => {
    try {
        const headers = getHeaders(merchantId, secretKey, userAgent);
        const allPackages = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
            const ep = getEndpoints({ useSit: false });
            const url = `${ep.OMS}/packages/merchantid/${merchantId}` +
                `?limit=${limit}&offset=${offset}` +
                `&startDate=${encodeURIComponent(startDate)}` +
                `&endDate=${encodeURIComponent(endDate)}`;

            const response = await axios.get(url, { headers, timeout: 15000 });
            const packages = response.data?.packages || response.data || [];

            if (Array.isArray(packages) && packages.length > 0) {
                allPackages.push(...packages);
                offset += limit;
                if (packages.length < limit) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        return allPackages;
    } catch (error) {
        logger.error("Hepsiburada paket çekme hatası:", {
            error: error.message,
            status: error.response?.status
        });
        return [];
    }
};

module.exports = {
    // Sabitler
    HB_ENDPOINTS,
    HB_SIT_ENDPOINTS,
    // Yardımcılar
    normalizeCredentials,
    getAuthHeader,
    getHeaders,
    getEndpoints,
    validateCredentials,
    // Ürün
    fetchHepsiburadaProducts,
    uploadProductToHepsiburada,
    checkProductStatus,
    // Sipariş
    fetchHepsiburadaOrders,
    // Stok & Fiyat
    updateHepsiburadaStock,
    updateHepsiburadaPrice,
    // Kategori
    fetchHepsiburadaCategories,
    fetchHepsiburadaCategoryAttributes,
    // Paket / Kargo
    fetchHepsiburadaPackages
};
