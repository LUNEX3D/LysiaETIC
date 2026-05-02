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
// slug: Trendyol'un gerçek en çok satanlar URL'si (ör: /kadin?sst=BEST_SELLER)
const TRENDYOL_CATEGORIES = {
    "kadin":         { slug: "kadin",         name: "Kadın",          subCategories: ["elbise", "tişört", "pantolon", "etek", "ceket", "mont", "kazak", "gömlek", "trençkot", "bluz", "tayt", "şort", "hırka", "yelek"] },
    "erkek":         { slug: "erkek",         name: "Erkek",          subCategories: ["tişört", "pantolon", "gömlek", "mont", "ceket", "kazak", "eşofman", "şort", "polo yaka", "sweatshirt", "yelek", "kaban"] },
    "aksesuar":      { slug: "aksesuar",      name: "Aksesuar",       subCategories: ["çanta", "cüzdan", "saat", "güneş gözlüğü", "bileklik", "kolye", "şapka", "kemer", "yüzük", "küpe"] },
    "ayakkabi":      { slug: "ayakkabi",      name: "Ayakkabı",       subCategories: ["sneaker", "topuklu", "bot", "sandalet", "terlik", "spor ayakkabı", "babet", "loafer", "çizme", "günlük ayakkabı"] },
    "ev-mobilya":    { slug: "ev-dekorasyon", name: "Ev & Mobilya",   subCategories: ["nevresim", "yastık", "halı", "perde", "aydınlatma", "mutfak", "banyo", "dekorasyon", "mobilya", "yatak"] },
    "kozmetik":      { slug: "kozmetik",      name: "Kozmetik",       subCategories: ["ruj", "fondöten", "maskara", "parfüm", "cilt bakım", "saç bakım", "makyaj", "göz farı", "allık", "serum", "krem", "güneş kremi"] },
    "elektronik":    { slug: "elektronik",    name: "Elektronik",     subCategories: ["telefon", "kulaklık", "tablet", "laptop", "powerbank", "akıllı saat", "televizyon", "kamera", "hoparlör", "oyun konsolu", "bilgisayar"] },
    "supermarket":   { slug: "supermarket",   name: "Süpermarket",    subCategories: ["atıştırmalık", "içecek", "temizlik", "kişisel bakım", "kahve", "çay", "deterjan", "bebek maması", "organik", "vitamin"] },
    "anne-bebek":    { slug: "giyim",         name: "Anne & Bebek",   subCategories: ["bebek giyim", "bebek bezi", "mama", "oyuncak", "bebek arabası", "emzirme", "bebek bakım", "hamile giyim", "çocuk ayakkabı"] },
    "spor-outdoor":  { slug: "outdoor",       name: "Spor & Outdoor", subCategories: ["eşofman", "spor ayakkabı", "yoga", "kamp", "bisiklet", "koşu", "fitness", "outdoor mont", "spor çanta", "trekking"] },
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

/** Trendyol CDN / ara katman önbelleğinde aynı HTML'in dönmesini azaltır */
function withCacheBuster(url) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}_=${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function bestsellerHeuristicScore(p) {
    return (p.favoriteCount || 0) + (p.orderCount || 0) * 10;
}

/** Aynı id birden fazla kategoride geçiyorsa en yüksek skorlu kaydı tut */
function dedupeProductsKeepBestScore(products) {
    const byId = new Map();
    for (const p of products) {
        const id = p.id;
        if (id == null || id === "") continue;
        const prev = byId.get(id);
        if (!prev || bestsellerHeuristicScore(p) > bestsellerHeuristicScore(prev)) {
            byId.set(id, p);
        }
    }
    return [...byId.values()];
}

/**
 * Tüm ürünleri tek global sıraya göre kesmek yerine kategori round-robin —
 * aksi halde her seferinde aynı "mega" ürünler ilk 100'e dolar.
 */
function diversifyBestSellersByCategory(products, limit) {
    const scoreFn = bestsellerHeuristicScore;
    const byCat = new Map();
    for (const p of products) {
        const k = p.sourceCategory || "Diğer";
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k).push(p);
    }
    for (const arr of byCat.values()) {
        arr.sort((a, b) => scoreFn(b) - scoreFn(a));
    }
    const keys = [...byCat.keys()].sort((a, b) => a.localeCompare(b, "tr"));
    const out = [];
    const seen = new Set();
    let round = 0;
    while (out.length < limit) {
        let progressed = false;
        for (const k of keys) {
            const bucket = byCat.get(k);
            const item = bucket[round];
            if (item && !seen.has(item.id)) {
                seen.add(item.id);
                out.push(item);
                progressed = true;
                if (out.length >= limit) break;
            }
        }
        if (!progressed) break;
        round++;
    }
    if (out.length < limit) {
        const rest = products
            .filter(p => p.id != null && !seen.has(p.id))
            .sort((a, b) => scoreFn(b) - scoreFn(a));
        for (const p of rest) {
            out.push(p);
            if (out.length >= limit) break;
        }
    }
    return out;
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
            const html = await fetchPage(withCacheBuster(url));

            if (!html) {
                if (attempt === retries) {
                    logger.warn(`[TrendyolScraper] Sayfa çekilemedi (${retries + 1} deneme): ${url.split("?")[0]}`);
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
        // Kaç sayfa çekmemiz gerekiyor? (Her sayfa 24 ürün)
        const PRODUCTS_PER_PAGE = 24;
        const pagesToFetch = Math.min(Math.ceil(limit / PRODUCTS_PER_PAGE), 8); // Max 8 sayfa (192 ürün)

        let allProducts = [];
        let totalCount = 0;
        let sortValue = sort;

        // İlk sayfayı çek
        const firstPageData = await fetchSearchPage(query, sort, page);
        if (!firstPageData) {
            return { products: [], totalCount: 0, query, page, sort };
        }

        allProducts = firstPageData.products.map(p => parseSearchProduct(p));
        totalCount = firstPageData.totalCount;
        sortValue = firstPageData.sortValue || sort;

        // Ek sayfaları paralel çek (limit > 24 ise)
        if (pagesToFetch > 1 && allProducts.length >= PRODUCTS_PER_PAGE) {
            const extraPages = [];
            for (let pi = page + 1; pi < page + pagesToFetch; pi++) {
                extraPages.push(pi);
            }

            const extraResults = await Promise.allSettled(
                extraPages.map(pi => fetchSearchPage(query, sort, pi))
            );

            extraResults.forEach(r => {
                if (r.status === "fulfilled" && r.value?.products?.length > 0) {
                    allProducts = allProducts.concat(r.value.products.map(p => parseSearchProduct(p)));
                }
            });
        }

        // Duplicate kaldır
        const seen = new Set();
        allProducts = allProducts.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });

        return {
            products: allProducts.slice(0, limit),
            totalCount: typeof totalCount === "string" ? parseInt(String(totalCount).replace(/[^\d]/g, ""), 10) || 0 : totalCount,
            query,
            page,
            sort: sortValue,
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Arama hatası: ${err.message}`);
        return { products: [], totalCount: 0, query, page, sort };
    }
}

/**
 * Tek bir arama sayfası çek (dahili yardımcı)
 * @returns {{ products: Array, totalCount: number, sortValue: string } | null}
 */
async function fetchSearchPage(query, sort, page) {
    const params = new URLSearchParams();
    params.set("q", query);
    if (sort && sort !== "SCORE") params.set("sst", sort);
    if (page > 1) params.set("pi", String(page));

    const url = `${TRENDYOL_BASE}/sr?${params.toString()}`;
    const data = await fetchTrendyolPage(url, "__single-search-result__PROPS");

    if (!data || !data.data || !data.data.products) {
        return null;
    }

    return {
        products: data.data.products,
        totalCount: data.data.total || data.data.roughTotal || data.data.products.length,
        sortValue: data.data.sortValue || sort,
    };
}


// ═════════════════════════════════════════════════════════════════════════════
// 2. KATEGORİ BAZLI ÜRÜNLER — En çok satanlar, trend ürünler
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Kategori bazlı ürünleri getir — Trendyol'un gerçek kategori sayfalarından
 * URL formatı: https://www.trendyol.com/kadin?sst=BEST_SELLER
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
        // Kaç sayfa çekmemiz gerekiyor? (Her sayfa 24 ürün)
        const PRODUCTS_PER_PAGE = 24;
        const pagesToFetch = Math.min(Math.ceil(limit / PRODUCTS_PER_PAGE), 8); // Max 8 sayfa

        // İlk sayfayı çek
        const firstPageData = await fetchCategoryPage(category.slug, sort, page);

        if (!firstPageData) {
            logger.warn(`[TrendyolScraper] Kategori sayfası boş, arama fallback: ${category.slug}`);
            return searchProducts(category.name, options);
        }

        let allProducts = firstPageData.products.map(p => parseSearchProduct(p));
        const totalCount = firstPageData.totalCount;

        // Ek sayfaları paralel çek (limit > 24 ise)
        if (pagesToFetch > 1 && allProducts.length >= PRODUCTS_PER_PAGE) {
            const extraPages = [];
            for (let pi = page + 1; pi < page + pagesToFetch; pi++) {
                extraPages.push(pi);
            }

            const extraResults = await Promise.allSettled(
                extraPages.map(pi => fetchCategoryPage(category.slug, sort, pi))
            );

            extraResults.forEach(r => {
                if (r.status === "fulfilled" && r.value?.products?.length > 0) {
                    allProducts = allProducts.concat(r.value.products.map(p => parseSearchProduct(p)));
                }
            });
        }

        // Duplicate kaldır
        const seen = new Set();
        allProducts = allProducts.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });

        return {
            products: allProducts.slice(0, limit),
            totalCount: totalCount || allProducts.length,
            categoryName: category.name,
            page,
            sort,
            source: "trendyol_category_live",
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Kategori hatası: ${err.message}`);
        return searchProducts(category.name, options);
    }
}

/**
 * Tek bir kategori sayfası çek (dahili yardımcı)
 * @returns {{ products: Array, totalCount: number } | null}
 */
async function fetchCategoryPage(slug, sort, page) {
    const params = new URLSearchParams();
    if (sort && sort !== "SCORE") params.set("sst", sort);
    if (page > 1) params.set("pi", String(page));

    const paramStr = params.toString();
    const url = `${TRENDYOL_BASE}/${slug}${paramStr ? "?" + paramStr : ""}`;

    const data = await fetchTrendyolPage(url, "__single-search-result__PROPS");

    if (!data?.data?.products || data.data.products.length === 0) {
        return null;
    }

    return {
        products: data.data.products,
        totalCount: data.data.total || data.data.products.length,
    };
}

/**
 * En çok satanları getir — Trendyol'un gerçek kategori sayfalarından
 * Kategori verilmişse o kategorinin sayfasından, verilmemişse birden fazla
 * ana kategoriden paralel çekerek birleştirir.
 *
 * Doğru URL: https://www.trendyol.com/kadin?sst=BEST_SELLER (gerçek en çok satanlar)
 * ESKİ YANLIŞ: /butik/liste/en-cok-satanlar (kişiselleştirilmiş öneriler — GERÇEK DEĞİL)
 */
async function getBestSellers(categoryKey = "", limit = 20, sort = "BEST_SELLER") {
    // Belirli kategori seçildiyse direkt o kategoriden çek
    if (categoryKey && TRENDYOL_CATEGORIES[categoryKey]) {
        const result = await getCategoryProducts(categoryKey, { sort, limit });
        return {
            products: (result.products || []).slice(0, limit),
            totalCount: result.totalCount || result.products?.length || 0,
            source: result.source || "trendyol_category_live",
        };
    }

    // Genel en çok satanlar — TÜM ana kategorilerden paralel çek ve birleştir
    const allCategoryKeys = Object.keys(TRENDYOL_CATEGORIES);
    // En az ~2 sayfa (48+) ürün / kategori — tek sayfa hep aynı SKU'ları veriyordu
    const perCategory = Math.max(56, Math.ceil(limit / allCategoryKeys.length) + 12);

    try {
        const results = await Promise.allSettled(
            allCategoryKeys.map(catKey => getCategoryProducts(catKey, { sort, limit: perCategory }))
        );

        let allProducts = [];
        results.forEach((r, idx) => {
            if (r.status === "fulfilled" && r.value?.products?.length > 0) {
                // Her ürüne hangi kategoriden geldiğini ekle
                r.value.products.forEach(p => {
                    p.sourceCategory = TRENDYOL_CATEGORIES[allCategoryKeys[idx]]?.name || allCategoryKeys[idx];
                });
                allProducts = allProducts.concat(r.value.products);
            }
        });

        if (allProducts.length > 0) {
            allProducts = dedupeProductsKeepBestScore(allProducts);

            let finalProducts;
            if (sort === "PRICE_BY_ASC") {
                allProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
                finalProducts = allProducts.slice(0, limit);
            } else if (sort === "PRICE_BY_DESC") {
                allProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
                finalProducts = allProducts.slice(0, limit);
            } else if (sort === "MOST_RATED") {
                allProducts.sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0));
                finalProducts = allProducts.slice(0, limit);
            } else if (sort === "MOST_RECENT") {
                finalProducts = allProducts.slice(0, limit);
            } else {
                // BEST_SELLER — kategori round-robin + kalanı skorla doldur
                finalProducts = diversifyBestSellersByCategory(allProducts, limit);
            }

            logger.info(`[TrendyolScraper] En çok satanlar: ${finalProducts.length} ürün (${allCategoryKeys.length} kategoriden, çeşitlendirilmiş)`);
            return {
                products: finalProducts,
                totalCount: allProducts.length,
                source: "trendyol_multi_category_live",
            };
        }
    } catch (err) {
        logger.warn(`[TrendyolScraper] Paralel kategori çekme hatası: ${err.message}`);
    }

    // Fallback: arama ile en çok satanları getir
    logger.warn("[TrendyolScraper] Kategori sayfaları başarısız, arama fallback kullanılıyor");
    const result = await searchProducts("en çok satan", { sort, limit });
    return {
        products: result.products.slice(0, limit),
        totalCount: result.totalCount,
        source: "search_fallback",
    };
}

/**
 * Flaş ürünleri getir — Trendyol'un gerçek indirimli ürünleri
 * Butik sayfasındaki FLASH_SALES widget'ı + kategori sayfalarından indirimli ürünler
 */
async function getFlashProducts(categoryKey = "", limit = 24) {
    if (categoryKey && TRENDYOL_CATEGORIES[categoryKey]) {
        // Kategori bazlı: o kategoriden daha fazla çek, indirimli olanları filtrele
        const fetchLimit = Math.max(96, limit * 3); // İndirimli olanları filtreleyeceğiz, fazla çek
        const result = await getCategoryProducts(categoryKey, { sort: "BEST_SELLER", limit: fetchLimit });
        const flashProds = (result.products || [])
            .filter(p => p.discountPercentage > 5)
            .sort((a, b) => b.discountPercentage - a.discountPercentage)
            .slice(0, limit);
        return {
            products: flashProds,
            totalCount: flashProds.length,
            source: "trendyol_category_flash",
        };
    }

    // Genel flaş ürünler — butik sayfasındaki FLASH_SALES widget'ı hâlâ gerçek flaş ürünler
    let butikFlash = [];
    try {
        const realData = await fetchBestSellersPage();
        if (realData && realData.flash.length > 0) {
            butikFlash = realData.flash;
        }
    } catch (err) {
        logger.warn(`[TrendyolScraper] Butik flaş ürünler hatası: ${err.message}`);
    }

    // TÜM kategorilerden indirimli ürünleri topla
    const allCategoryKeys = Object.keys(TRENDYOL_CATEGORIES);
    try {
        const results = await Promise.allSettled(
            allCategoryKeys.map(catKey => getCategoryProducts(catKey, { sort: "BEST_SELLER", limit: 56 }))
        );

        let allFlash = [...butikFlash]; // Butik flaş ürünleri de ekle
        results.forEach(r => {
            if (r.status === "fulfilled" && r.value?.products?.length > 0) {
                const discounted = r.value.products.filter(p => p.discountPercentage > 5);
                allFlash = allFlash.concat(discounted);
            }
        });

        if (allFlash.length > 0) {
            allFlash.sort((a, b) => b.discountPercentage - a.discountPercentage);
            // Duplicate kaldır
            const seen = new Set();
            allFlash = allFlash.filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });

            logger.info(`[TrendyolScraper] Flaş ürünler: ${allFlash.length} ürün (${allCategoryKeys.length} kategoriden + butik)`);
            return {
                products: allFlash.slice(0, limit),
                totalCount: allFlash.length,
                source: "trendyol_multi_category_flash",
            };
        }
    } catch (err) {
        logger.warn(`[TrendyolScraper] Paralel flaş çekme hatası: ${err.message}`);
    }

    // Butik flaş varsa onu döndür
    if (butikFlash.length > 0) {
        return {
            products: butikFlash.slice(0, limit),
            totalCount: butikFlash.length,
            source: "trendyol_flash_live",
        };
    }

    // Son fallback: arama
    const result = await searchProducts("indirim fırsat", { sort: "BEST_SELLER", limit: 96 });
    const flashProds = (result.products || [])
        .filter(p => p.discountPercentage > 5)
        .sort((a, b) => b.discountPercentage - a.discountPercentage)
        .slice(0, limit);
    return {
        products: flashProds,
        totalCount: flashProds.length,
        source: "search_flash_fallback",
    };
}


// ═════════════════════════════════════════════════════════════════════════════
// 2B. BUTIK SAYFASI — Gerçek En Çok Satanlar & Flaş Ürünler
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Butik kategori URL eşlemeleri (Trendyol'un gerçek butik sayfaları)
 */
const BUTIK_CATEGORIES = {
    "kadin":         "/butik/liste/1/kadin",
    "erkek":         "/butik/liste/2/erkek",
    "anne-bebek":    "/butik/liste/3/anne-cocuk",
    "ev-mobilya":    "/butik/liste/12/ev-yasam",
    "supermarket":   "/butik/liste/16/supermarket",
    "kozmetik":      "/butik/liste/11/kozmetik",
    "ayakkabi":      "/butik/liste/9/ayakkabi-canta",
    "elektronik":    "/butik/liste/5/elektronik",
    "aksesuar":      "/butik/liste/10/saat-aksesuar",
    "spor-outdoor":  "/butik/liste/22/spor-outdoor",
};

/**
 * Trendyol butik "En Çok Satanlar" sayfasından gerçek anlık veri çeker
 * Bu sayfa iki önemli widget içerir:
 *   - JUST_FOR_YOU_SLIDER → Popüler / En Çok Satan ürünler (20 ürün)
 *   - FLASH_SALES → Flaş Ürünler (24 ürün)
 *
 * @param {string} categoryKey - Opsiyonel kategori (ör: "kadin", "elektronik")
 * @returns {{ popular: Array, flash: Array } | null}
 */
async function fetchBestSellersPage(categoryKey = "") {
    try {
        const butikPath = (categoryKey && BUTIK_CATEGORIES[categoryKey])
            ? BUTIK_CATEGORIES[categoryKey]
            : "/butik/liste/en-cok-satanlar";

        const url = `${TRENDYOL_BASE}${butikPath}`;
        const data = await fetchTrendyolPage(url, "__widget-list-v2__PROPS");

        if (!data || !data.widgetList || !data.widgetList.widgets) {
            logger.warn(`[TrendyolScraper] Butik widget verisi bulunamadı: ${url}`);
            return null;
        }

        const widgets = data.widgetList.widgets;

        // Popüler ürünler (JUST_FOR_YOU_SLIDER)
        const popularWidget = widgets.find(w => w.widgetType === "JUST_FOR_YOU_SLIDER");
        const popularItems = popularWidget?.items || [];

        // Flaş ürünler (FLASH_SALES)
        const flashWidget = widgets.find(w => w.widgetType === "FLASH_SALES");
        const flashItems = flashWidget?.items || [];

        logger.info(`[TrendyolScraper] Butik sayfası başarılı: ${popularItems.length} popüler, ${flashItems.length} flaş ürün`);

        return {
            popular: popularItems.map(p => parseWidgetProduct(p, "popular")),
            flash: flashItems.map(p => parseWidgetProduct(p, "flash")),
        };
    } catch (err) {
        logger.warn(`[TrendyolScraper] Butik sayfası hatası: ${err.message}`);
        return null;
    }
}

/**
 * Widget ürün verisini standart formata dönüştür
 * Widget ürünleri arama sonuçlarından farklı bir formata sahip:
 *   - Popüler: socialProofs dizisi (type/value), price.sellingPrice, merchantListings
 *   - Flaş: socialProof dizisi (key/value), price.sellingPrice/discountedPrice, winnerVariant
 */
function parseWidgetProduct(p, widgetType = "popular") {
    // ── Fiyat bilgileri ──
    let priceCurrent = 0;
    let priceOriginal = 0;
    let discountPercentage = 0;
    let freeCargo = false;
    let merchantName = "";

    if (widgetType === "flash") {
        // Flaş ürün fiyat yapısı — sanitizedPrice en güvenilir kaynak
        if (p.sanitizedPrice?.finalPrice?.value) {
            priceCurrent = p.sanitizedPrice.finalPrice.value;
            priceOriginal = p.sanitizedPrice.strikeThroughPrice?.value || p.price?.oldPrice || priceCurrent;
        } else {
            priceCurrent = p.price?.discountedPrice || p.price?.sellingPrice || 0;
            priceOriginal = p.price?.oldPrice || p.price?.sellingPrice || priceCurrent;
        }
        // İndirim yüzdesi — birden fazla kaynaktan kontrol
        discountPercentage = p.discountPercentage || 0;
        if (!discountPercentage && p.sanitizedPrice?.strikeThroughPrice?.discountPercentage?.value) {
            discountPercentage = p.sanitizedPrice.strikeThroughPrice.discountPercentage.value;
        }
        if (!discountPercentage && p.recommendedRetailPrice?.lowestRecentPercentage) {
            const lrp = p.recommendedRetailPrice.lowestRecentPercentage;
            discountPercentage = typeof lrp === "string" ? parseInt(lrp.replace(/[^\d]/g, ""), 10) || 0 : lrp;
        }
        if (!discountPercentage && p.price?.lowestPriceBadge?.discountPercentage) {
            discountPercentage = p.price.lowestPriceBadge.discountPercentage;
        }
        if (!discountPercentage && priceOriginal > priceCurrent && priceCurrent > 0) {
            discountPercentage = Math.round(((priceOriginal - priceCurrent) / priceOriginal) * 100);
        }
        if (typeof discountPercentage === "string") {
            discountPercentage = parseInt(discountPercentage.replace(/[^\d]/g, ""), 10) || 0;
        }
        freeCargo = p.winnerVariant?.freeCargo || p.badges?.freeCargo || false;
        merchantName = p.winnerVariant?.merchantName || "";
    } else {
        // Popüler ürün fiyat yapısı — sanitizedPrice en güvenilir
        if (p.sanitizedPrice?.finalPrice?.value) {
            priceCurrent = p.sanitizedPrice.finalPrice.value;
            priceOriginal = p.sanitizedPrice.strikeThroughPrice?.value || p.price?.oldPrice || p.price?.originalPrice || priceCurrent;
        } else {
            priceCurrent = p.price?.sellingPrice || p.price?.discountedPrice || 0;
            priceOriginal = p.price?.originalPrice || p.price?.oldPrice || priceCurrent;
        }
        if (priceOriginal > priceCurrent && priceCurrent > 0) {
            discountPercentage = Math.round(((priceOriginal - priceCurrent) / priceOriginal) * 100);
        }
        // merchantListings'den bilgi al
        const firstMerchant = p.merchantListings?.[0];
        freeCargo = p.winnerVariant?.freeCargo || firstMerchant?.freeCargo || false;
        merchantName = firstMerchant?.merchant?.name || p.winnerVariant?.merchantName || "";
        // Promosyonlardan kargo bilgisi
        const promos = firstMerchant?.promotions || p.promotions || [];
        if (!freeCargo && promos.some(pr => pr.promotionDiscountType === "Cargo" || pr.shortName?.includes("Kargo"))) {
            freeCargo = true;
        }
    }

    // ── socialProof verileri ──
    // Popüler: socialProofs dizisi [{type, value}]
    // Flaş: socialProof dizisi [{key, value}]
    const socialMap = {};
    const socialArr = p.socialProofs || p.socialProofV2 || p.socialProof || [];
    if (Array.isArray(socialArr)) {
        socialArr.forEach(sp => {
            const key = sp.type || sp.key;
            if (key && sp.value) socialMap[key] = sp.value;
        });
    }

    const favoriteCount = parseSocialProofValue(socialMap.favoriteCount || "0");
    const basketCount = parseSocialProofValue(socialMap.basketCount || "0");
    const orderCount = parseSocialProofValue(socialMap.orderCount || "0");
    const pageViewCount = parseSocialProofValue(socialMap.pageViewCount || "0");

    // ── Görsel URL ──
    let imageUrl = "";
    if (p.image) {
        imageUrl = p.image.startsWith("http") ? p.image : `https://cdn.dsmcdn.com/${p.image}`;
    } else if (p.imageUrl) {
        imageUrl = p.imageUrl.startsWith("http") ? p.imageUrl : `https://cdn.dsmcdn.com/${p.imageUrl}`;
    } else if (p.images && p.images.length > 0) {
        const firstImg = p.images[0];
        imageUrl = firstImg.startsWith("http") ? firstImg : `https://cdn.dsmcdn.com/${firstImg}`;
    }

    // ── Ürün URL ──
    const productUrl = p.url ? (p.url.startsWith("http") ? p.url : `${TRENDYOL_BASE}${p.url}`) : "";

    // ── Rating ──
    const ratingScore = p.ratingScore?.averageRating || 0;
    const ratingCount = p.ratingScore?.totalCount || 0;

    // ── Stok bilgisi ──
    const quantity = p.winnerVariant?.quantity || 0;

    // ── Tag bilgileri ──
    const tags = (p.tagDetails || []).map(t => t.displayName).filter(Boolean);
    const isBestSeller = (p.tagDetails || []).some(t => t.tag === "kategori_encoksatanlar") ||
                          (p.badges?.categoryRanking || []).some(r => r.name === "bestSeller");

    return {
        id: p.id || 0,
        contentId: p.id || 0,
        name: p.name || "",
        brand: p.brand || p.brandInfo?.name || p.webBrand?.name || "",
        brandId: p.brandId || p.brandInfo?.id || 0,
        category: p.category?.name || "",
        categoryId: p.category?.id || 0,
        price: typeof priceCurrent === "number" ? Math.round(priceCurrent * 100) / 100 : 0,
        originalPrice: typeof priceOriginal === "number" ? Math.round(priceOriginal * 100) / 100 : 0,
        discountedPrice: typeof priceCurrent === "number" ? Math.round(priceCurrent * 100) / 100 : 0,
        discountPercentage,
        currency: p.price?.currency || "TL",
        imageUrl,
        favoriteCount,
        basketCount,
        orderCount,
        pageViewCount,
        hasRating: ratingCount > 0,
        ratingScore: Math.round(ratingScore * 10) / 10,
        ratingCount,
        reviewCount: ratingCount,
        merchantName,
        merchantId: p.merchantId || 0,
        url: productUrl,
        estimatedDailySales: estimateDailySalesFromSocialProof(favoriteCount, orderCount, basketCount),
        estimatedMonthlyRevenue: estimateMonthlyRevenueFromSocialProof(favoriteCount, orderCount, basketCount, priceCurrent),
        freeCargo,
        isInStock: p.inStock !== false,
        quantity,
        promotions: (p.promotions || []).map(pr => pr.shortName || pr.name || "").filter(Boolean),
        tags,
        isBestSeller,
        socialProofRaw: socialMap,
        dataSource: widgetType === "flash" ? "trendyol_flash_live" : "trendyol_popular_live",
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

    // İndirim yüzdesi — birden fazla kaynaktan kontrol et
    let discountPercentage = 0;
    if (p.recommendedRetailPrice?.promotionDiscountPercentage) {
        discountPercentage = p.recommendedRetailPrice.promotionDiscountPercentage;
    } else if (p.price?.lowestPriceBadge?.discountPercentage) {
        discountPercentage = p.price.lowestPriceBadge.discountPercentage;
    } else if (priceOld > 0 && priceCurrent < priceOld) {
        discountPercentage = Math.round(((priceOld - priceCurrent) / priceOld) * 100);
    } else if (originalPrice > priceCurrent && priceCurrent > 0) {
        discountPercentage = Math.round(((originalPrice - priceCurrent) / originalPrice) * 100);
    }

    // socialProof'tan verileri çıkar
    // Format: [{ key: "favoriteCount", value: "632K" }, { key: "orderCount", value: "3000+" }]
    const socialProofMap = {};
    if (Array.isArray(p.socialProof)) {
        p.socialProof.forEach(sp => {
            const key = sp.key || sp.type;
            if (key && sp.value) socialProofMap[key] = sp.value;
        });
    } else if (p.socialProof && typeof p.socialProof === "object") {
        // Tek obje formatı
        if (p.socialProof.key && p.socialProof.value) {
            socialProofMap[p.socialProof.key] = p.socialProof.value;
        }
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
        // Rating — kategori sayfalarında ratingScore objesi geliyor
        hasRating: p.emptyRating === false || (p.ratingScore?.totalCount > 0),
        ratingScore: Math.round((p.ratingScore?.averageRating || 0) * 10) / 10,
        ratingCount: p.ratingScore?.totalCount || 0,
        reviewCount: p.ratingScore?.totalCount || 0,
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
        isBestSeller: p.badges?.topRankingBadge?.type === "BEST_SELLER" || false,
        rushDelivery: p.rushDelivery || false,
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
        name: cat.name,
        slug: cat.slug,
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
    getFlashProducts,
    fetchBestSellersPage,
    getProductDetail,
    getProductDetailById,
    findCompetitors,
    getMerchantProducts,
    getProductReviews,
    getSearchSuggestions,
    analyzeKeyword,
    getCategories,
    parseSearchProduct,
    parseWidgetProduct,
    parseSocialProofValue,
    estimateDailySales,
    estimateMonthlyRevenue,
    estimateDailySalesFromSocialProof,
    estimateMonthlyRevenueFromSocialProof,
    extractSearchKeywords,
    TRENDYOL_CATEGORIES,
    BUTIK_CATEGORIES,
};
