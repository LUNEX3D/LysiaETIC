/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRENDYOL SCRAPER SERVICE — LysiaETIC (V5 — HTML Scraping)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Trendyol'un www.trendyol.com sayfalarından gerçek pazar verisi çeker.
 * Roketfy'ın yaptığı gibi — Trendyol'daki TÜM ürünleri analiz eder.
 *
 * NOT: public.trendyol.com ve public-mdc.trendyol.com artık çalışmıyor.
 * Trendyol tüm verileri HTML içine gömülü JSON olarak sunuyor:
 *   - Arama: window["__single-search-result__PROPS"]
 *   - Ürün Detay: window["__envoy_product-detail__PROPS"]
 *   - Yorumlar: window["__review-detail__PROPS"]
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { execFile } = require("child_process");
const os = require("os");
const logger = require("../config/logger");

// ─── Base URL ────────────────────────────────────────────────────────────────
const TRENDYOL_BASE = "https://www.trendyol.com";
const IS_WINDOWS = os.platform() === "win32";

// ─── Trendyol Kategorileri (Ana kategoriler) ────────────────────────────────
const TRENDYOL_CATEGORIES = {
    "kadin": { id: "x-g1-c1", slug: "kadin", name: "Kadın", subCategories: ["elbise", "tişört", "pantolon", "etek", "ceket", "mont", "kazak", "gömlek"] },
    "erkek": { id: "x-g2-c1", slug: "erkek", name: "Erkek", subCategories: ["tişört", "pantolon", "gömlek", "mont", "ceket", "kazak", "eşofman"] },
    "aksesuar": { id: "x-g1-c103", slug: "aksesuar", name: "Aksesuar", subCategories: ["çanta", "cüzdan", "saat", "güneş gözlüğü", "bileklik", "kolye"] },
    "ayakkabi": { id: "x-g1-c110", slug: "ayakkabi", name: "Ayakkabı", subCategories: ["sneaker", "topuklu", "bot", "sandalet", "terlik", "spor ayakkabı"] },
    "ev-mobilya": { id: "x-g1-c1009", slug: "ev-mobilya", name: "Ev & Mobilya", subCategories: ["nevresim", "yastık", "halı", "perde", "aydınlatma", "mutfak"] },
    "kozmetik": { id: "x-g1-c1049", slug: "kozmetik", name: "Kozmetik", subCategories: ["ruj", "fondöten", "maskara", "parfüm", "cilt bakım", "saç bakım"] },
    "elektronik": { id: "x-g1-c1081", slug: "elektronik", name: "Elektronik", subCategories: ["telefon", "kulaklık", "tablet", "laptop", "powerbank", "akıllı saat"] },
    "supermarket": { id: "x-g1-c1163", slug: "supermarket", name: "Süpermarket", subCategories: ["atıştırmalık", "içecek", "temizlik", "kişisel bakım"] },
    "anne-bebek": { id: "x-g1-c1091", slug: "anne-bebek", name: "Anne & Bebek", subCategories: ["bebek giyim", "bebek bezi", "mama", "oyuncak", "bebek arabası"] },
    "spor-outdoor": { id: "x-g1-c1117", slug: "spor-outdoor", name: "Spor & Outdoor", subCategories: ["eşofman", "spor ayakkabı", "yoga", "kamp", "bisiklet"] },
};

// ─── HTTP İstek Yardımcısı ──────────────────────────────────────────────────
// Cloudflare, axios/node.js/curl TLS parmak izini engelliyor (403).
// Çözüm — platforma göre farklı araç:
//   Windows: PowerShell Invoke-WebRequest (.NET Schannel TLS — Cloudflare geçer)
//   Linux:   curl-impersonate (curl_ff117 — Firefox TLS parmak izi — Cloudflare geçer)

/**
 * Windows: PowerShell Invoke-WebRequest ile sayfa çek
 * @param {string} url
 * @param {number} timeoutSec
 * @returns {Promise<string|null>}
 */
function fetchWithPowerShell(url, timeoutSec = 20) {
    return new Promise((resolve) => {
        const psCommand = [
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;",
            "$ProgressPreference = 'SilentlyContinue';",
            "try {",
            `  $headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };`,
            `  $r = Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -Headers $headers -TimeoutSec ${timeoutSec} -UseBasicParsing;`,
            "  $r.Content",
            "} catch {",
            "  Write-Error $_.Exception.Message",
            "}",
        ].join(" ");

        execFile("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy", "Bypass",
            "-Command", psCommand,
        ], {
            maxBuffer: 50 * 1024 * 1024,
            timeout: (timeoutSec + 10) * 1000,
            encoding: "utf8",
            windowsHide: true,
        }, (error, stdout, stderr) => {
            if (error || !stdout || stdout.length < 100) {
                const errMsg = stderr || error?.message || "Bilinmeyen hata";
                logger.warn(`[TrendyolScraper] PowerShell fetch başarısız: ${url} — ${errMsg.substring(0, 200)}`);
                resolve(null);
                return;
            }
            resolve(stdout);
        });
    });
}

/**
 * Linux: curl-impersonate (curl_ff117) ile sayfa çek
 * Firefox 117 TLS parmak izi kullanarak Cloudflare'ı bypass eder
 * @param {string} url
 * @param {number} timeoutSec
 * @returns {Promise<string|null>}
 */
function fetchWithCurlImpersonate(url, timeoutSec = 20) {
    return new Promise((resolve) => {
        execFile("curl_ff117", [
            "-s",
            "--max-time", String(timeoutSec),
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "-H", "Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "--compressed",
            url,
        ], {
            maxBuffer: 50 * 1024 * 1024,
            timeout: (timeoutSec + 10) * 1000,
            encoding: "utf8",
        }, (error, stdout, stderr) => {
            if (error || !stdout || stdout.length < 100) {
                const errMsg = stderr || error?.message || "Bilinmeyen hata";
                logger.warn(`[TrendyolScraper] curl_ff117 fetch başarısız: ${url} — ${errMsg.substring(0, 200)}`);
                resolve(null);
                return;
            }
            resolve(stdout);
        });
    });
}

/**
 * Cross-platform HTTP fetch — platforma göre doğru aracı seçer
 * @param {string} url
 * @param {number} timeoutSec
 * @returns {Promise<string|null>}
 */
function fetchPage(url, timeoutSec = 20) {
    if (IS_WINDOWS) {
        return fetchWithPowerShell(url, timeoutSec);
    }
    return fetchWithCurlImpersonate(url, timeoutSec);
}

/**
 * HTML içinden gömülü JSON'u çıkar
 * @param {string} html - HTML içeriği
 * @param {string} propsKey - window["__KEY__PROPS"] anahtarı
 * @returns {object|null}
 */
function extractPropsFromHtml(html, propsKey) {
    if (!html || typeof html !== "string") return null;

    const pattern = `window["${propsKey}"]=`;
    const startIdx = html.indexOf(pattern);
    if (startIdx === -1) return null;

    const jsonStart = startIdx + pattern.length;
    const scriptEnd = html.indexOf("</script>", jsonStart);
    if (scriptEnd === -1) return null;

    let jsonStr = html.substring(jsonStart, scriptEnd).trim();
    if (jsonStr.endsWith(";")) jsonStr = jsonStr.slice(0, -1);

    // Unicode escape'leri decode et
    jsonStr = jsonStr.replace(/\\u002F/g, "/");

    try {
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
}

/**
 * Trendyol HTML sayfası çek ve gömülü JSON'u parse et
 * @param {string} url - Tam URL
 * @param {string} propsKey - window["__KEY__PROPS"] anahtarı
 * @param {number} retries - Deneme sayısı
 * @returns {object|null}
 */
async function fetchTrendyolPage(url, propsKey, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const html = await fetchPage(url);

            if (!html) {
                if (attempt === retries) {
                    logger.warn(`[TrendyolScraper] Sayfa çekilemedi (${retries + 1} deneme): ${url}`);
                    return null;
                }
                await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
                continue;
            }

            const parsed = extractPropsFromHtml(html, propsKey);
            if (!parsed) {
                logger.warn(`[TrendyolScraper] "${propsKey}" bulunamadı: ${url}`);
                return null;
            }

            return parsed;
        } catch (err) {
            if (attempt === retries) {
                logger.warn(`[TrendyolScraper] Sayfa çekme başarısız (${retries + 1} deneme): ${url} — ${err.message}`);
                return null;
            }
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
    }
    return null;
}


// ═════════════════════════════════════════════════════════════════════════════
// 1. ÜRÜN ARAMA — Anahtar kelime ile Trendyol'da arama
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Trendyol'da ürün ara
 * @param {string} query - Arama kelimesi (ör: "tişört", "iphone kılıf")
 * @param {object} options - Filtreler
 * @returns {object} { products, totalCount, query, page, sort }
 */
async function searchProducts(query, options = {}) {
    const {
        page = 1,
        sort = "BEST_SELLER",  // BEST_SELLER, PRICE_BY_ASC, PRICE_BY_DESC, MOST_RATED, MOST_RECENT, SCORE
        limit = 24,
    } = options;

    try {
        // URL oluştur: www.trendyol.com/sr?q=elbise&sst=BEST_SELLER&pi=1
        const params = new URLSearchParams();
        params.set("q", query);
        if (sort && sort !== "SCORE") params.set("sst", sort);
        if (page > 1) params.set("pi", String(page));

        const url = `${TRENDYOL_BASE}/sr?${params.toString()}`;

        const data = await fetchTrendyolPage(url, "__single-search-result__PROPS");

        if (!data || !data.data || !data.data.products) {
            logger.warn(`[TrendyolScraper] Arama sonucu boş: "${query}"`);
            return { products: [], totalCount: 0, query, page, sort };
        }

        const products = data.data.products.map(p => parseSearchProduct(p)).slice(0, limit);
        const totalCount = data.data.total || data.data.roughTotal || products.length;

        return {
            products,
            totalCount: typeof totalCount === "string" ? parseInt(totalCount.replace(/[^\d]/g, ""), 10) || 0 : totalCount,
            query,
            page,
            sort: data.data.sortValue || sort,
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Arama hatası: ${err.message}`);
        return { products: [], totalCount: 0, query, page, sort };
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// 2. KATEGORİ BAZLI ÜRÜNLER — En çok satanlar, trend ürünler
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Kategori bazlı ürünleri getir
 * @param {string} categoryKey - Kategori anahtarı (ör: "kadin", "elektronik")
 * @param {object} options
 */
async function getCategoryProducts(categoryKey, options = {}) {
    const { page = 1, sort = "BEST_SELLER", limit = 24 } = options;

    const category = TRENDYOL_CATEGORIES[categoryKey];
    if (!category) {
        // Anahtar kelime olarak ara
        return searchProducts(categoryKey, options);
    }

    try {
        // URL: www.trendyol.com/kadin-x-g1-c1?sst=BEST_SELLER&pi=1
        const params = new URLSearchParams();
        if (sort && sort !== "SCORE") params.set("sst", sort);
        if (page > 1) params.set("pi", String(page));

        const paramStr = params.toString();
        const url = `${TRENDYOL_BASE}/${category.slug}-${category.id}${paramStr ? "?" + paramStr : ""}`;

        const data = await fetchTrendyolPage(url, "__single-search-result__PROPS");

        if (data?.data?.products) {
            return {
                products: data.data.products.map(p => parseSearchProduct(p)).slice(0, limit),
                totalCount: data.data.total || 0,
                categoryName: category.name,
                categoryId: category.id,
                page,
                sort,
            };
        }

        // Fallback: kategori adıyla arama yap
        return searchProducts(category.name, options);
    } catch (err) {
        logger.warn(`[TrendyolScraper] Kategori hatası: ${err.message}`);
        return searchProducts(category.name, options);
    }
}

/**
 * Tüm kategorilerde en çok satanları getir
 */
async function getBestSellers(categoryKey = "", limit = 20) {
    if (categoryKey && TRENDYOL_CATEGORIES[categoryKey]) {
        return getCategoryProducts(categoryKey, { sort: "BEST_SELLER", limit });
    }

    // Tüm kategorilerden en çok satanları topla
    const allProducts = [];
    const categoryKeys = Object.keys(TRENDYOL_CATEGORIES).slice(0, 5); // İlk 5 kategori

    for (const key of categoryKeys) {
        const result = await getCategoryProducts(key, { sort: "BEST_SELLER", limit: 5 });
        if (result.products?.length > 0) {
            allProducts.push(...result.products.map(p => ({ ...p, categoryKey: key, categoryName: TRENDYOL_CATEGORIES[key].name })));
        }
    }

    return {
        products: allProducts.slice(0, limit),
        totalCount: allProducts.length,
        source: "all_categories",
    };
}


// ═════════════════════════════════════════════════════════════════════════════
// 3. ÜRÜN DETAY — Tek bir ürünün detaylı bilgileri
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Ürün detayı getir (URL ile)
 * @param {string} productUrl - Trendyol ürün URL'si (tam veya kısmi)
 */
async function getProductDetail(productUrl) {
    try {
        // URL'yi normalize et
        let fullUrl = productUrl;
        if (!fullUrl.startsWith("http")) {
            fullUrl = fullUrl.startsWith("/") ? `${TRENDYOL_BASE}${fullUrl}` : `${TRENDYOL_BASE}/${fullUrl}`;
        }

        // Yorum sayfası URL'sini temizle
        fullUrl = fullUrl.split("/yorumlar")[0].split("?")[0];

        const data = await fetchTrendyolPage(fullUrl, "__envoy_product-detail__PROPS");

        if (!data || !data.product) {
            logger.warn(`[TrendyolScraper] Ürün detayı bulunamadı: ${fullUrl}`);
            return null;
        }

        const p = data.product;
        const merchant = p.merchantListing?.merchant || {};
        const promotions = p.merchantListing?.promotions || [];

        return {
            id: p.id,
            contentId: p.id,
            name: p.name || "",
            productCode: p.productCode || "",
            brand: p.brand?.name || "",
            brandId: p.brand?.id || 0,
            category: p.category?.name || "",
            categoryHierarchy: p.category?.hierarchy || "",
            categoryId: p.category?.id || 0,
            ratingScore: p.ratingScore?.averageRating || 0,
            ratingCount: p.ratingScore?.totalCount || 0,
            reviewCount: p.ratingScore?.commentCount || 0,
            favoriteCount: p.favoriteCount || 0,
            inStock: p.inStock !== false,
            images: (p.images || []).map(img => img.startsWith("http") ? img : `https://cdn.dsmcdn.com/${img}`),
            merchantName: merchant.name || "",
            merchantId: merchant.id || 0,
            sellerScore: merchant.sellerScore?.value || 0,
            url: fullUrl,
            attributes: (p.attributes || []).map(a => ({
                name: a.key?.name || "",
                value: a.value?.name || "",
            })),
            variants: (p.variants || []).map(v => ({
                barcode: v.barcode || "",
                attributeValue: v.attributeValue || "",
                stock: v.stock || 0,
            })),
            promotions: promotions.map(pr => pr.name || "").filter(Boolean),
            gender: p.gender?.name || "",
            // Tahmini satış verileri
            estimatedDailySales: estimateDailySales({ favoriteCount: p.favoriteCount, ratingScore: p.ratingScore }),
            estimatedMonthlyRevenue: 0, // Fiyat bilgisi detay sayfasında farklı formatta
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Ürün detay hatası: ${err.message}`);
        return null;
    }
}

/**
 * Content ID ile ürün detayı getir — önce arama yapıp URL bulur
 * @param {string|number} contentId - Trendyol content ID
 */
async function getProductDetailById(contentId) {
    try {
        // Content ID ile arama yap, URL'yi bul
        const searchResult = await searchProducts(String(contentId), { limit: 5 });
        const found = searchResult.products.find(p => String(p.contentId) === String(contentId));

        if (found && found.url) {
            return await getProductDetail(found.url);
        }

        logger.warn(`[TrendyolScraper] Content ID ile ürün bulunamadı: ${contentId}`);
        return null;
    } catch (err) {
        logger.warn(`[TrendyolScraper] Content ID detay hatası: ${err.message}`);
        return null;
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// 4. RAKİP ANALİZİ — Bir ürünün rakiplerini bul
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Bir ürünün rakiplerini bul (aynı anahtar kelimelerle arama)
 * @param {string} productName - Ürün adı
 */
async function findCompetitors(productName) {
    const keywords = extractSearchKeywords(productName);
    const searchQuery = keywords.slice(0, 3).join(" ");

    const result = await searchProducts(searchQuery, {
        sort: "BEST_SELLER",
        limit: 50,
    });

    return {
        competitors: result.products,
        totalCompetitors: result.totalCount,
        searchQuery,
        keywords,
    };
}

/**
 * Mağaza analizi — bir mağazanın ürünlerini getir (mağaza adıyla arama)
 * @param {string} merchantName - Mağaza adı
 * @param {object} options
 */
async function getMerchantProducts(merchantName, options = {}) {
    const { page = 1, limit = 24 } = options;

    try {
        // Mağaza adıyla arama yap ve aynı mağazanın ürünlerini filtrele
        const result = await searchProducts(merchantName, { page, sort: "BEST_SELLER", limit: 48 });

        const merchantProducts = result.products.filter(p =>
            p.merchantName && p.merchantName.toLowerCase().includes(merchantName.toLowerCase())
        );

        return {
            products: merchantProducts.slice(0, limit),
            totalCount: merchantProducts.length,
            merchantName,
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Mağaza ürünleri hatası: ${err.message}`);
        return { products: [], totalCount: 0, merchantName };
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// 5. YORUM ANALİZİ — Ürün yorumlarını çek
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Ürün yorumlarını getir (ürün URL'si ile)
 * @param {string} productUrl - Trendyol ürün URL'si
 * @param {object} options
 */
async function getProductReviews(productUrl, options = {}) {
    const { page = 1 } = options;

    try {
        // URL'yi normalize et
        let fullUrl = productUrl;
        if (!fullUrl.startsWith("http")) {
            fullUrl = fullUrl.startsWith("/") ? `${TRENDYOL_BASE}${fullUrl}` : `${TRENDYOL_BASE}/${fullUrl}`;
        }

        // Yorum sayfası URL'si
        const baseUrl = fullUrl.split("/yorumlar")[0].split("?")[0];
        const reviewUrl = `${baseUrl}/yorumlar${page > 1 ? "?pi=" + page : ""}`;

        const data = await fetchTrendyolPage(reviewUrl, "__review-detail__PROPS");

        if (!data) {
            return { reviews: [], totalCount: 0, ratingScore: null, socialProofs: [] };
        }

        // Ürün bilgileri
        const product = data.product || {};
        const ratingScore = product.ratingScore || { averageRating: 0, commentCount: 0, totalCount: 0 };

        // Fotoğraflı yorumlar (reviewImages.content)
        const reviewImages = data.reviewImages?.content || [];
        const reviews = reviewImages.map(r => ({
            id: r.reviewId || r.id,
            comment: r.comment || "",
            rate: r.rate || 0,
            userName: r.userFullName || "Anonim",
            createdDate: r.lastModifiedDate ? new Date(r.lastModifiedDate).toISOString() : "",
            sellerName: r.sellerName || "",
            trusted: r.trusted || false,
            hasImage: true,
            imageUrl: r.mediaFile?.url || "",
        }));

        // Social proof verileri
        const socialProofs = (data.socialProofs || []).map(sp => ({
            key: sp.id || "",
            value: sp.count || "",
        }));

        return {
            reviews,
            totalCount: ratingScore.commentCount || reviews.length,
            totalRatingCount: ratingScore.totalCount || 0,
            averageRating: ratingScore.averageRating || 0,
            ratingScore,
            socialProofs,
            productName: product.name || "",
            productId: product.id || 0,
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Yorum çekme hatası: ${err.message}`);
        return { reviews: [], totalCount: 0, ratingScore: null, socialProofs: [] };
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// 6. ANAHTAR KELİME ANALİZİ — Trendyol arama verileri
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Anahtar kelime analizi — bir kelime için pazar verisi
 * @param {string} keyword - Anahtar kelime
 */
async function analyzeKeyword(keyword) {
    // 1) Arama yap
    const searchResult = await searchProducts(keyword, { sort: "BEST_SELLER", limit: 24 });

    // 2) Fiyat istatistikleri
    const prices = searchResult.products.map(p => p.price).filter(p => p > 0).sort((a, b) => a - b);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices[0] || 0;
    const maxPrice = prices[prices.length - 1] || 0;
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

    // 3) Marka dağılımı
    const brandMap = {};
    searchResult.products.forEach(p => {
        const brand = p.brand || "Bilinmiyor";
        brandMap[brand] = (brandMap[brand] || 0) + 1;
    });
    const topBrands = Object.entries(brandMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / searchResult.products.length) * 100) }));

    // 4) Favori ortalaması
    const favorites = searchResult.products.map(p => p.favoriteCount).filter(f => f > 0);
    const avgFavorites = favorites.length > 0 ? Math.round(favorites.reduce((a, b) => a + b, 0) / favorites.length) : 0;

    // 5) Rekabet seviyesi
    let competitionLevel = "low";
    const total = searchResult.totalCount;
    if (total > 50000) competitionLevel = "very_high";
    else if (total > 10000) competitionLevel = "high";
    else if (total > 1000) competitionLevel = "medium";
    else if (total > 100) competitionLevel = "low";
    else competitionLevel = "very_low";

    // 6) Tahmini günlük satış
    const estimatedDailySales = searchResult.products.map(p => p.estimatedDailySales);

    return {
        keyword,
        totalProducts: searchResult.totalCount,
        competitionLevel,
        priceStats: { avg: avgPrice, min: minPrice, max: maxPrice, median: medianPrice },
        avgFavorites,
        topBrands,
        topProducts: searchResult.products.slice(0, 10),
        estimatedDailySales: estimatedDailySales.slice(0, 10),
    };
}

/**
 * Trendyol arama önerilerini getir — arama sonuçlarından ilgili kelimeler çıkar
 * @param {string} query - Arama kelimesi
 */
async function getSearchSuggestions(query) {
    try {
        // Arama yap ve ürün isimlerinden anahtar kelimeler çıkar
        const result = await searchProducts(query, { limit: 24 });

        const keywordMap = {};
        result.products.forEach(p => {
            const words = extractSearchKeywords(p.name);
            words.forEach(w => {
                if (w.toLowerCase() !== query.toLowerCase()) {
                    keywordMap[w] = (keywordMap[w] || 0) + 1;
                }
            });
        });

        const suggestions = Object.entries(keywordMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([keyword, count]) => ({ keyword, count, type: "keyword" }));

        return { suggestions, query };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Öneri hatası: ${err.message}`);
        return { suggestions: [], query };
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Arama sonucu ürün verisini standart formata dönüştür
 * Trendyol'un HTML'e gömülü JSON formatı:
 *   - price: { current, old, originalPrice, discountedPrice, currency, currencySymbol }
 *   - socialProof: [{ key: "favoriteCount"|"basketCount"|"orderCount"|"pageViewCount", value: "25K" }]
 *   - category: { name, id }
 *   - recommendedRetailPrice: { sellingPrice, discountedPromotionPrice, promotionDiscountPercentage }
 */
function parseSearchProduct(p) {
    // Fiyat bilgileri
    const priceCurrent = p.price?.current || 0;
    const priceOld = p.price?.old || 0;
    const originalPrice = p.price?.originalPrice || priceCurrent;
    const discountedPrice = p.price?.discountedPrice || priceCurrent;

    // İndirim yüzdesi
    let discountPercentage = 0;
    if (p.recommendedRetailPrice?.promotionDiscountPercentage) {
        discountPercentage = p.recommendedRetailPrice.promotionDiscountPercentage;
    } else if (priceOld > 0 && priceCurrent < priceOld) {
        discountPercentage = Math.round(((priceOld - priceCurrent) / priceOld) * 100);
    }

    // socialProof'tan verileri çıkar
    const socialProofMap = {};
    if (Array.isArray(p.socialProof)) {
        p.socialProof.forEach(sp => {
            socialProofMap[sp.key] = sp.value;
        });
    } else if (p.socialProof && typeof p.socialProof === "object" && p.socialProof.key) {
        socialProofMap[p.socialProof.key] = p.socialProof.value;
    }

    // "25K" → 25000, "152K" → 152000, "1,2B" → 1200, "200+" → 200 gibi dönüşümler
    const favoriteCount = parseSocialProofValue(socialProofMap.favoriteCount || "0");
    const basketCount = parseSocialProofValue(socialProofMap.basketCount || "0");
    const orderCount = parseSocialProofValue(socialProofMap.orderCount || "0");
    const pageViewCount = parseSocialProofValue(socialProofMap.pageViewCount || "0");

    // Görsel URL
    let imageUrl = "";
    if (p.image) {
        imageUrl = p.image.startsWith("http") ? p.image : `https://cdn.dsmcdn.com/${p.image}`;
    } else if (p.images) {
        const firstImg = Array.isArray(p.images) ? p.images[0] : p.images;
        imageUrl = firstImg && firstImg.startsWith("http") ? firstImg : (firstImg ? `https://cdn.dsmcdn.com/${firstImg}` : "");
    }

    // Ürün URL'si
    const productUrl = p.url ? (p.url.startsWith("http") ? p.url : `${TRENDYOL_BASE}${p.url}`) : "";

    return {
        id: p.id || 0,
        contentId: p.contentId || p.id || 0,
        name: p.name || "",
        brand: p.brand || p.webBrands?.[0]?.name || "",
        brandId: p.brandId || 0,
        category: p.category?.name || "",
        categoryId: p.category?.id || 0,
        price: typeof priceCurrent === "number" ? Math.round(priceCurrent * 100) / 100 : 0,
        originalPrice: typeof originalPrice === "number" ? Math.round(originalPrice * 100) / 100 : 0,
        discountedPrice: typeof discountedPrice === "number" ? Math.round(discountedPrice * 100) / 100 : 0,
        discountPercentage,
        currency: p.price?.currency || "TL",
        imageUrl,
        // Gerçek engagement verileri (socialProof'tan)
        favoriteCount,
        basketCount,
        orderCount,
        pageViewCount,
        // Rating
        hasRating: p.emptyRating === false,
        ratingScore: 0, // Arama sonuçlarında rating detayı yok
        ratingCount: 0,
        reviewCount: 0,
        // Satıcı
        merchantName: p.merchantName || "",
        merchantId: p.merchantId || 0,
        url: productUrl,
        // Tahmini satış verileri (Roketfy tarzı)
        estimatedDailySales: estimateDailySalesFromSocialProof(favoriteCount, orderCount, basketCount),
        estimatedMonthlyRevenue: estimateMonthlyRevenueFromSocialProof(favoriteCount, orderCount, basketCount, priceCurrent),
        // Ek bilgiler
        freeCargo: p.freeCargo || false,
        isInStock: p.stock !== false,
        promotions: extractPromotions(p),
        socialProofRaw: socialProofMap,
    };
}

/**
 * socialProof değerini sayıya çevir
 * "25K" → 25000, "152K" → 152000, "1,2B" → 1200, "200+" → 200, "959" → 959
 */
function parseSocialProofValue(value) {
    if (!value || value === "0") return 0;
    const str = String(value).trim().replace("+", "");

    // "24,8B" veya "1.2B" (bin)
    const binMatch = str.match(/^([\d.,]+)\s*B$/i);
    if (binMatch) {
        const num = parseFloat(binMatch[1].replace(",", "."));
        return Math.round(num * 1000);
    }

    // "25K" (bin)
    const kMatch = str.match(/^([\d.,]+)\s*K$/i);
    if (kMatch) {
        const num = parseFloat(kMatch[1].replace(",", "."));
        return Math.round(num * 1000);
    }

    // "1.5M" (milyon)
    const mMatch = str.match(/^([\d.,]+)\s*M$/i);
    if (mMatch) {
        const num = parseFloat(mMatch[1].replace(",", "."));
        return Math.round(num * 1000000);
    }

    // Düz sayı: "959", "200"
    const num = parseInt(str.replace(/[^\d]/g, ""), 10);
    return isNaN(num) ? 0 : num;
}

/**
 * Promosyon bilgilerini çıkar
 */
function extractPromotions(p) {
    const promos = [];
    if (p.priceLabels && Array.isArray(p.priceLabels)) {
        p.priceLabels.forEach(pl => {
            if (pl.name) promos.push(pl.name);
        });
    }
    if (p.badges) {
        Object.values(p.badges).forEach(b => {
            if (b.title) promos.push(b.title);
        });
    }
    return promos;
}

/**
 * Tahmini günlük satış hesapla (socialProof verilerine göre — Roketfy tarzı)
 * orderCount varsa direkt kullan, yoksa favoriteCount ve basketCount'tan tahmin et
 */
function estimateDailySalesFromSocialProof(favoriteCount, orderCount, basketCount) {
    // orderCount varsa (ör: "200+" → 200) — bu en güvenilir veri
    if (orderCount > 0) {
        // "200+" gibi değerler aylık tahmini satış, günlüğe böl
        return Math.max(1, Math.round(orderCount / 30));
    }

    let estimate = 0;

    // Favori sayısından tahmin (her 500 favori ≈ 1 günlük satış)
    if (favoriteCount > 0) {
        estimate += Math.round(favoriteCount / 500);
    }

    // Sepet sayısından tahmin (sepetteki ürünlerin %10-20'si satışa dönüşür)
    if (basketCount > 0) {
        estimate += Math.round(basketCount * 0.15);
    }

    return Math.max(0, Math.min(estimate, 9999));
}

/**
 * Tahmini aylık ciro hesapla
 */
function estimateMonthlyRevenueFromSocialProof(favoriteCount, orderCount, basketCount, price) {
    const dailySales = estimateDailySalesFromSocialProof(favoriteCount, orderCount, basketCount);
    const priceNum = typeof price === "number" ? price : 0;
    return Math.round(dailySales * 30 * priceNum);
}

/**
 * Eski API uyumluluğu için — ürün objesinden tahmini satış
 */
function estimateDailySales(product) {
    const favorites = product.favoriteCount || 0;
    const reviews = product.ratingScore?.commentCount || product.ratingScore?.totalCommentCount || product.reviewCount || 0;
    const rating = product.ratingScore?.averageRating || 0;

    let estimate = 0;
    if (favorites > 0) estimate += Math.round(favorites / 500);
    if (reviews > 0) estimate += Math.round(reviews / 30);
    if (rating >= 4.5) estimate = Math.round(estimate * 1.3);
    else if (rating >= 4.0) estimate = Math.round(estimate * 1.1);
    else if (rating < 3.0 && rating > 0) estimate = Math.round(estimate * 0.7);

    return Math.max(0, Math.min(estimate, 9999));
}

/**
 * Tahmini aylık ciro (eski API uyumluluğu)
 */
function estimateMonthlyRevenue(product) {
    const dailySales = estimateDailySales(product);
    const price = product.price?.sellingPrice?.value || product.price?.current || product.price || 0;
    const priceNum = typeof price === "object" ? 0 : price;
    return Math.round(dailySales * 30 * priceNum);
}

/**
 * Ürün adından arama anahtar kelimeleri çıkar
 */
function extractSearchKeywords(productName) {
    if (!productName) return [];

    const stopWords = new Set([
        "bir", "ve", "ile", "için", "bu", "da", "de", "den", "dan",
        "adet", "set", "takım", "kadın", "erkek", "çocuk", "unisex",
        "the", "a", "an", "is", "are", "for", "with", "and", "or",
        "uyumlu", "model", "renk", "beden", "indirim",
    ]);

    return productName
        .toLowerCase()
        .replace(/[^\wçğıöşüÇĞİÖŞÜ\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
        .slice(0, 8);
}

/**
 * Kategori listesini döndür
 */
function getCategories() {
    return Object.entries(TRENDYOL_CATEGORIES).map(([key, cat]) => ({
        key,
        id: cat.id,
        name: cat.name,
        subCategories: cat.subCategories,
    }));
}


// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    searchProducts,
    getCategoryProducts,
    getBestSellers,
    getProductDetail,
    getProductDetailById,
    findCompetitors,
    getMerchantProducts,
    getProductReviews,
    getSearchSuggestions,
    analyzeKeyword,
    getCategories,
    parseSearchProduct,
    parseSocialProofValue,
    estimateDailySales,
    estimateMonthlyRevenue,
    estimateDailySalesFromSocialProof,
    estimateMonthlyRevenueFromSocialProof,
    extractSearchKeywords,
    TRENDYOL_CATEGORIES,
};
