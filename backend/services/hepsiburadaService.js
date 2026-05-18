const axios = require("axios");
const moment = require("moment");
const logger = require("../config/logger");
const { resolveProductBrandName, isPlaceholderBrand } = require("../utils/resolveProductBrandName");

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
 * @returns {{ merchantId: string, secretKey: string, userAgent: string, useSit: boolean }}
 */
const coerceHepsiburadaUseSit = (v) => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
        if (s === "false" || s === "0" || s === "no" || s === "off" || s === "") return false;
    }
    return false;
};

const normalizeCredentials = (credentials) => {
    if (!credentials) {
        return { merchantId: null, secretKey: null, userAgent: null, useSit: false };
    }

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
        userAgent:  userAgent || developerUsername || user_agent || "PazarYonet",
        // Mongo/string "false" truthy'dır — log "SIT" derken getEndpoints PROD seçiyordu (403)
        useSit:     coerceHepsiburadaUseSit(credentials.useSit)
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
 * GET istekleri — Content-Type yok (MPOP/Listinge bazı uçlar GET + application/json ile hata döndürür).
 */
const getHeadersForGet = (merchantId, secretKey, userAgent) => ({
    Authorization: getAuthHeader(merchantId, secretKey),
    "User-Agent": userAgent || "LysiaETIC",
    Accept: "application/json"
});

/** HB satır/kalem `id` alanı (UUID) — sipariş no olarak kullanılmamalı */
const isHbInternalId = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
};

/** Satıcı panelindeki sipariş no genelde sayısal (UUID / paket iç id değil) */
const isLikelyHbMerchantOrderNumber = (value) => {
    const s = String(value ?? "").trim();
    if (!s || isHbInternalId(s)) return false;
    if (/^\d{6,14}$/.test(s)) return true;
    return /^[A-Z0-9]{6,20}$/i.test(s) && !s.includes("-");
};

/** OMS /orders endpoint uzun aralıkta 400 (GetPackageLinesBadRequestError) döner — HB ~24 saat penceresi */
const HB_OMS_ORDERS_MAX_DAYS = 1;
const HB_OMS_PACKAGES_MAX_DAYS = 7;

/** HB OMS begindate/enddate — dokümantasyon: YYYY-MM-DD HH:mm (saniye opsiyonel) */
const formatHbOmsDateTime = (value) => {
    const moment = require("moment");
    return moment(value).format("YYYY-MM-DD HH:mm");
};

/** Katalog SKU (HBCV…) — merchantSku ile karıştırılmamalı */
const isHbCatalogSku = (value) => /^HBCV/i.test(String(value ?? "").trim());

/**
 * Otomatik sipariş / lineitem kargo — HB CargoCompanyShortName (ör. HEPSIJET, YK).
 */
const resolveHbCargoShortCode = (cargoId, cargoName) => {
    const norm = (s) =>
        String(s ?? "")
            .trim()
            .toUpperCase()
            .replace(/İ/g, "I")
            .replace(/ı/g, "I")
            .replace(/\s+/g, "_");
    const idN = norm(cargoId);
    const nameN = norm(cargoName);
    const aliases = {
        HEPSIJET: "HEPSIJET",
        HEPSI_JET: "HEPSIJET",
        YURTICI_KARGO: "YK",
        YURTICI: "YK",
        ARAS_KARGO: "AR",
        ARAS: "AR",
        MNG_KARGO: "MNG",
        MNG: "MNG",
        PTT_KARGO: "PTT",
        PTT: "PTT",
        SURAT_KARGO: "SURAT",
        SURAT: "SURAT",
        UPS_KARGO: "UPS",
        HOROZ_LOJISTIK: "HOROZ",
        CEVA_LOJISTIK: "CEVA",
        TRENDYOL_EXPRESS: "TEX",
        KARGOIST: "KARGOIST",
        SENDEO: "SENDEO",
        DIGER: "DIGER",
    };
    if (aliases[idN]) return aliases[idN];
    if (aliases[nameN]) return aliases[nameN];
    if (idN) return idN;
    return "YK";
};

/**
 * HB OMS tarih penceresini küçük parçalara böler (ms veya Date kabul eder).
 */
const splitHbDateRange = (startDate, endDate, maxDays = HB_OMS_ORDERS_MAX_DAYS) => {
    const moment = require("moment");
    let cur = moment(startDate);
    const end = moment(endDate);
    const chunks = [];
    if (!cur.isValid() || !end.isValid() || cur.isAfter(end)) return chunks;
    const span = Math.max(1, Number(maxDays) || 1);
    while (cur.isBefore(end)) {
        const chunkEnd = moment.min(cur.clone().add(span, "days").subtract(1, "second"), end);
        chunks.push({ start: cur.clone(), end: chunkEnd.clone() });
        cur = chunkEnd.clone().add(1, "second");
    }
    return chunks;
};

/**
 * Hepsiburada OMS yanıtından satıcı panelinde görünen sipariş numarasını seç.
 * orderNumber / merchantOrderNumber öncelikli; packageNumber yalnızca son çare.
 */
const resolveHepsiburadaOrderNumber = (item, parent = null) => {
    const pick = (...vals) => {
        for (const v of vals) {
            const s = v == null ? "" : String(v).trim();
            if (!s || isHbInternalId(s)) continue;
            if (isLikelyHbMerchantOrderNumber(s)) return s;
        }
        for (const v of vals) {
            const s = v == null ? "" : String(v).trim();
            if (!s || isHbInternalId(s)) continue;
            return s;
        }
        return null;
    };

    const fromItem = pick(
        item?.orderNumber,
        item?.merchantOrderNumber,
        item?.sapNumber,
        item?.packageNumber,
        item?.orderId
    );
    if (fromItem) return fromItem;

    return pick(
        parent?.orderNumber,
        parent?.merchantOrderNumber,
        parent?.sapNumber,
        parent?.packageNumber,
        parent?.orderId
    );
};

/**
 * Listing inventory-uploads: merchantSku büyük harf, boşluksuz; | vb. karakterler kaldırılır (HB kuralları + serileştirme tutarlılığı).
 */
const normalizeHbMerchantSku = (raw) =>
    String(raw ?? "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9_-]/g, "");

/**
 * POST .../inventory-uploads — gövdeyi düz JSON string olarak gönderir (.NET tarafı `listings` alanının dizi olmasını zorunlu kılar).
 * 400 + deserialize hatasında bir kez kök düzey JSON dizi gövdesiyle yeniden dener.
 *
 * @param {object} opts
 * @param {object} opts.ep - getEndpoints() çıktısı
 * @param {string} opts.merchantId
 * @param {string} opts.secretKey
 * @param {string} opts.userAgent
 * @param {Array<object>} opts.rows — her eleman: merchantSku, hepsiburadaSku, availableStock; isteğe bağlı price, listPrice
 */
const postInventoryUploadListing = async (opts) => {
    const { ep, merchantId, secretKey, userAgent, rows } = opts;
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("postInventoryUploadListing: en az bir listing satırı gerekli");
    }
    const url = `${ep.LISTING}/listings/merchantid/${merchantId}/inventory-uploads`;
    const headers = getHeaders(merchantId, secretKey, userAgent);
    const plainRows = rows.map((r) => {
        const o = {
            merchantSku: String(r.merchantSku),
            hepsiburadaSku: String(r.hepsiburadaSku)
        };
        if (Object.prototype.hasOwnProperty.call(r, "availableStock") && r.availableStock != null) {
            o.availableStock = Math.max(0, parseInt(String(r.availableStock), 10) || 0);
        }
        if (r.price != null && r.price !== "") {
            o.price = Number(r.price) || 0;
            if (r.listPrice != null && r.listPrice !== "") o.listPrice = Number(r.listPrice) || 0;
            else o.listPrice = o.price;
        } else if (r.listPrice != null && r.listPrice !== "") {
            o.listPrice = Number(r.listPrice) || 0;
        }
        return o;
    });
    const bodyWrapped = JSON.stringify({ listings: plainRows });
    const passthrough = [(data) => data];
    try {
        return await axios.post(url, bodyWrapped, {
            headers,
            timeout: 15000,
            transformRequest: passthrough
        });
    } catch (err) {
        const st = err.response?.status;
        const raw = JSON.stringify(err.response?.data || {});
        const retryRootArray =
            st === 400 &&
            (raw.includes("Path 'listings'") ||
                raw.includes("deserialize the current JSON object") ||
                raw.includes("requires a JSON array") ||
                (raw.includes('"listings"') && raw.includes("JSON array")));
        if (!retryRootArray) throw err;
        logger.debug("[HEPSIBURADA] inventory-uploads: listings sarmalı reddedildi — kök dizi gövdesi deneniyor");
        const bodyRoot = JSON.stringify(plainRows);
        return await axios.post(url, bodyRoot, {
            headers,
            timeout: 15000,
            transformRequest: passthrough
        });
    }
};

/**
 * Ortam tespiti — SIT (test) mi yoksa Production (canlı) mı?
 * SIT hesapları production endpoint'lerine 401 verir, production hesapları SIT'e 401 verir.
 * Kullanıcı credentials'ında useSit: true varsa veya env değişkeni varsa SIT kullanılır.
 * @param {object} credentials - normalizeCredentials çıktısı veya ham credentials
 * @returns {object} Doğru endpoint seti (HB_ENDPOINTS veya HB_SIT_ENDPOINTS)
 */
const getEndpoints = (credentials) => {
    // Canlı mağaza anahtarı yanlışlıkla SIT'e gidiyorsa: HEPSIBURADA_FORCE_PRODUCTION=true
    if (process.env.HEPSIBURADA_FORCE_PRODUCTION === "true") {
        return HB_ENDPOINTS;
    }
    // credentials.useSit string/boolean karışık gelebilir; env ile SIT zorlanabilir
    const useSit =
        coerceHepsiburadaUseSit(credentials?.useSit) ||
        process.env.HEPSIBURADA_USE_SIT === "true";
    return useSit ? HB_SIT_ENDPOINTS : HB_ENDPOINTS;
};

/** getEndpoints() çıktısı gerçekten SIT mi (FORCE_PRODUCTION / env sonrası) */
const isHbSitEndpoints = (ep) => ep === HB_SIT_ENDPOINTS;

/** credentials.useSit belirsiz/yanlış ise canlı-SIT ortamını otomatik keşfet (kısa önbellekli). */
const HB_ENV_PROBE_TTL_MS = 30 * 60 * 1000;
const hbEnvProbeCache = new Map();

const readHbUseSitPreference = (raw) => {
    if (raw === true || raw === false) return raw;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(s)) return true;
        if (["false", "0", "no", "off"].includes(s)) return false;
    }
    return null;
};

const probeHbEnvironment = async (merchantId, secretKey, userAgent, useSit) => {
    const ep = useSit ? HB_SIT_ENDPOINTS : HB_ENDPOINTS;
    const headers = getHeadersForGet(merchantId, secretKey, userAgent);
    const url = `${ep.LISTING}/product/api/categories/get-all-categories`;
    try {
        await axios.get(url, {
            headers,
            params: { status: "ACTIVE", version: 1, page: 0, size: 1, merchantId },
            timeout: 9000
        });
        return { ok: true, useSit };
    } catch (e) {
        const st = e.response?.status;
        return { ok: false, useSit, status: st, err: e.message };
    }
};

const resolveHbUseSitAuto = async (hbCreds) => {
    const preferred = readHbUseSitPreference(hbCreds.useSitRaw ?? hbCreds.useSit);
    if (preferred !== null) return preferred;

    const cacheKey = `${hbCreds.merchantId}:${String(hbCreds.secretKey).slice(0, 10)}`;
    const cached = hbEnvProbeCache.get(cacheKey);
    if (cached && Date.now() - cached.at < HB_ENV_PROBE_TTL_MS) return cached.useSit;

    const first = await probeHbEnvironment(hbCreds.merchantId, hbCreds.secretKey, hbCreds.userAgent, false);
    if (first.ok) {
        hbEnvProbeCache.set(cacheKey, { useSit: false, at: Date.now() });
        return false;
    }
    const second = await probeHbEnvironment(hbCreds.merchantId, hbCreds.secretKey, hbCreds.userAgent, true);
    if (second.ok) {
        hbEnvProbeCache.set(cacheKey, { useSit: true, at: Date.now() });
        return true;
    }
    logger.warn(
        `[HEPSIBURADA ENV] Otomatik ortam tespiti başarısız (PROD=${first.status || "-"}, SIT=${second.status || "-"}) — ` +
        `varsayılan PROD ile devam edilecek`
    );
    return false;
};

/** MPOP katalog: yalnızca leaf + available=true kabul eder; dosya/arama önbelleği bazen available=false yaprak döndürür. */
const HB_LISTABLE_CATEGORY_TTL_MS = 15 * 60 * 1000;
const hbListableCategoryIdCache = new Map();

/**
 * Ürün açılabilir yaprak kategori ID'leri (HB dokümantasyonu: ACTIVE + leaf + available).
 * @returns {Promise<Set<string>>}
 */
const loadHepsiburadaListableCategoryIdSet = async (merchantId, secretKey, userAgent, useSit) => {
    const envKey = useSit ? "SIT" : "PROD";
    const cacheKey = `${String(merchantId).trim()}:${envKey}`;
    const hit = hbListableCategoryIdCache.get(cacheKey);
    if (hit && Date.now() - hit.at < HB_LISTABLE_CATEGORY_TTL_MS) {
        return hit.ids;
    }

    const headers = getHeadersForGet(merchantId, secretKey, userAgent);
    const ep = getEndpoints({ useSit });
    const baseUrls = [
        `${ep.MPOP}/product/api/categories/get-all-categories`,
        `${ep.CATEGORY}/product/api/categories/get-all-categories`
    ];
    const ids = new Set();
    const TYPES = [...HB_CATEGORY_TYPES_PRODUCT];
    const size = 2000;
    let anyTypedFilter400 = false;
    const mid = merchantId ? String(merchantId).trim() : "";

    const addIdsFromCats = (cats, typeHint = "") => {
        for (const cat of cats) {
            const row = { ...cat, hbTreeType: cat.type || typeHint };
            if (isHepsiburadaCampaignOrNonProductCategory(row)) continue;
            const id = cat.categoryId ?? cat.id;
            if (id != null && String(id).trim() !== "") ids.add(String(id).trim());
        }
    };

    const fetchListablePage = async (baseUrl, page, queryType) => {
        const params = new URLSearchParams({
            status: "ACTIVE",
            version: "1",
            page: String(page),
            size: String(size),
            leaf: "true",
            available: "true"
        });
        if (queryType) params.set("type", queryType);
        if (mid && baseUrl.includes("listing-external")) params.set("merchantId", mid);
        return axios.get(`${baseUrl}?${params.toString()}`, { headers, timeout: 45000 });
    };

    for (const type of TYPES) {
        let page = 0;
        let hasMore = true;
        let workingUrl = null;
        let typeAborted = false;
        while (hasMore && !typeAborted) {
            const urlsToTry = workingUrl ? [workingUrl] : baseUrls;
            let pageSuccess = false;
            for (const baseUrl of urlsToTry) {
                try {
                    const response = await fetchListablePage(baseUrl, page, type);
                    const data = response.data;
                    let cats = [];
                    if (Array.isArray(data)) {
                        cats = data;
                    } else if (data && typeof data === "object") {
                        const inner = data.data || data.content || data.categories;
                        if (Array.isArray(inner)) cats = inner;
                    }
                    if (cats.length > 0) {
                        addIdsFromCats(cats, type);
                        workingUrl = baseUrl;
                        page++;
                        pageSuccess = true;
                        if (cats.length < size) hasMore = false;
                        break;
                    }
                } catch (err) {
                    const st = err.response?.status;
                    if (st === 400 && page === 0) {
                        logger.info(
                            `[HB LISTABLE CAT] type=${type} HTTP 400 — type parametresi bu ortamda reddedilmiş olabilir; type= olmadan tamamlayıcı çekim kullanılacak`
                        );
                        anyTypedFilter400 = true;
                        typeAborted = true;
                        hasMore = false;
                        pageSuccess = true;
                        break;
                    }
                    logger.warn(`[HB LISTABLE CAT] type=${type} page=${page} url=${baseUrl} — ${st || ""} ${err.message}`);
                }
            }
            if (!pageSuccess) hasMore = false;
        }
    }

    /** Bazı mağazalarda type=HC (veya diğer) 400 verir; type olmadan leaf+available tüm listelenebilir yaprakları birleştirir. */
    if (anyTypedFilter400) {
        let page = 0;
        let hasMore = true;
        let workingUrl = null;
        while (hasMore) {
            const urlsToTry = workingUrl ? [workingUrl] : baseUrls;
            let pageSuccess = false;
            for (const baseUrl of urlsToTry) {
                try {
                    const response = await fetchListablePage(baseUrl, page, null);
                    const data = response.data;
                    let cats = [];
                    if (Array.isArray(data)) {
                        cats = data;
                    } else if (data && typeof data === "object") {
                        const inner = data.data || data.content || data.categories;
                        if (Array.isArray(inner)) cats = inner;
                    }
                    if (cats.length > 0) {
                        addIdsFromCats(cats);
                        workingUrl = baseUrl;
                        page++;
                        pageSuccess = true;
                        if (cats.length < size) hasMore = false;
                        break;
                    }
                } catch (err) {
                    logger.warn(
                        `[HB LISTABLE CAT] untyped supplement page=${page} url=${baseUrl} — ${err.response?.status || ""} ${err.message}`
                    );
                }
            }
            if (!pageSuccess) hasMore = false;
        }
        logger.info(`[HB LISTABLE CAT] type= olmadan tamamlayıcı çekim bitti — toplam benzersiz ID: ${ids.size}`);
    }

    hbListableCategoryIdCache.set(cacheKey, { at: Date.now(), ids });
    logger.info(
        `[HB LISTABLE CAT] ${ids.size} adet (leaf+available+ACTIVE; HB+HX katalog, kampanya/HC hariç, ${envKey}) — önbellek ${HB_LISTABLE_CATEGORY_TTL_MS / 60000} dk`
    );
    return ids;
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
 * @param {boolean} [useSit] — canlı hesapta false; test hesabında true (entegrasyon kaydıyla uyumlu)
 */
const fetchHepsiburadaProducts = async (merchantId, secretKey, userAgent, useSit = false) => {
    try {
        const headers = getHeadersForGet(merchantId, secretKey, userAgent);
        const ep = getEndpoints({ useSit });

        // ── Adım 0: categoryId → ad (MPOP ortamı ile aynı listing host: SIT veya PROD)
        let categoryMap = new Map();
        try {
            categoryMap = await buildHepsiburadaCategoryNameMap(merchantId, secretKey, userAgent, {
                onlyLeaf: true,
                useSit: !!useSit
            });
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
 * @param {boolean} [useSit]
 */
const updateHepsiburadaStock = async (merchantId, secretKey, sku, stock, userAgent, useSit = false) => {
    try {
        const ep = getEndpoints({ useSit });
        const ms = normalizeHbMerchantSku(sku) || String(sku || "").toUpperCase().replace(/\s+/g, "");
        const hbs = String(sku || "").trim();
        const response = await postInventoryUploadListing({
            ep,
            merchantId,
            secretKey,
            userAgent,
            rows: [{ hepsiburadaSku: hbs, merchantSku: ms || hbs, availableStock: parseInt(stock, 10) || 0 }]
        });

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
 * @param {boolean} [useSit]
 */
const updateHepsiburadaPrice = async (merchantId, secretKey, sku, price, userAgent, useSit = false) => {
    try {
        const ep = getEndpoints({ useSit });
        const ms = normalizeHbMerchantSku(sku) || String(sku || "").toUpperCase().replace(/\s+/g, "");
        const hbs = String(sku || "").trim();
        const p = parseFloat(price) || 0;
        const response = await postInventoryUploadListing({
            ep,
            merchantId,
            secretKey,
            userAgent,
            rows: [{ hepsiburadaSku: hbs, merchantSku: ms || hbs, price: p, listPrice: p }]
        });

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

/** HB API type: HB = katalog, HX = genişletilmiş katalog, HC = kampanya ağacı (ürün listesi için kullanılmaz) */
const HB_CATEGORY_TYPES_ALL = ["HB", "HX", "HC"];
const HB_CATEGORY_TYPES_PRODUCT = ["HB", "HX"];

/**
 * Kampanya / vitrin / promosyon reyonları — path veya adında geçenler ürün kategorisi sayılmaz.
 * HC ağacı zaten ayrı elenir; HB içinde gömülü kampanya düğümleri için de gerekli.
 */
const HB_NON_PRODUCT_CATEGORY_RE =
    /\b(kampanya|campaign|promosyon|promotion|fırsatlar|firsatlar|özel\s*fırsat|ozel\s*firsat|süper\s*fırsat|super\s*firsat|indirim\s*köşesi|indirim\s*kosesi|vitrin|outlet|sepet\s*indirimi|kupon|flash\s*sale|mega\s*indirim)\b/i;

const categoryPathBlob = (cat) => {
    const parts = [];
    const push = (s) => {
        const t = String(s || "").trim();
        if (t) parts.push(t);
    };
    push(cat.name);
    push(cat.categoryName);
    push(cat.displayName);
    push(cat.pathDisplay);
    if (Array.isArray(cat.paths)) {
        for (const p of cat.paths) {
            if (typeof p === "string") push(p);
            else if (p && typeof p === "object") push(p.name || p.categoryName || p.title);
        }
    } else if (typeof cat.paths === "string") {
        push(cat.paths);
    }
    return parts.join(" ");
};

/**
 * Kampanya (HC) veya kampanya benzeri düğüm mü?
 */
const isHepsiburadaCampaignOrNonProductCategory = (cat) => {
    if (!cat || typeof cat !== "object") return true;
    const treeType = String(cat.hbTreeType || cat.type || cat.categoryType || "").trim().toUpperCase();
    if (treeType === "HC") return true;
    if (cat.isCampaign === true || cat.campaign === true || cat.isPromotion === true) return true;
    const blob = categoryPathBlob(cat);
    if (blob && HB_NON_PRODUCT_CATEGORY_RE.test(blob)) return true;
    return false;
};

/**
 * Ürün açmaya uygun kategori listesi (Kategori Merkezi, arama, isim haritası).
 * @param {object[]} categories
 * @param {{ requireListable?: boolean, includeHx?: boolean }} [opts]
 */
const filterHepsiburadaProductCategories = (categories, opts = {}) => {
    const includeHx = opts.includeHx !== false;
    const allowedTypes = new Set(includeHx ? HB_CATEGORY_TYPES_PRODUCT : ["HB"]);
    const requireListable = opts.requireListable === true;

    return (categories || []).filter((cat) => {
        const treeType = String(cat.hbTreeType || cat.type || cat.categoryType || "HB").trim().toUpperCase();
        if (treeType === "MIXED") {
            if (isHepsiburadaCampaignOrNonProductCategory(cat)) return false;
        } else if (!allowedTypes.has(treeType)) {
            return false;
        }
        if (isHepsiburadaCampaignOrNonProductCategory(cat)) return false;

        if (requireListable) {
            const leaf = cat.leaf === true || cat.isLeaf === true;
            const available = cat.available !== false && cat.isAvailable !== false;
            const status = String(cat.status || "ACTIVE").trim().toUpperCase();
            if (!leaf || !available || status !== "ACTIVE") return false;
        }
        return true;
    });
};

const resolveHbCategoryTypesForFetch = (opts = {}) => {
    if (Array.isArray(opts.types) && opts.types.length > 0) {
        return opts.types
            .map((t) => String(t).trim().toUpperCase())
            .filter((t) => HB_CATEGORY_TYPES_ALL.includes(t));
    }
    const includeHc =
        opts.includeHc === true ||
        process.env.HB_CATEGORY_INCLUDE_HC === "1" ||
        process.env.HB_CATEGORY_INCLUDE_HC === "true";
    if (includeHc) return [...HB_CATEGORY_TYPES_ALL];
    return [...HB_CATEGORY_TYPES_PRODUCT];
};

const HB_CATEGORY_TYPE_ORDER = { HB: 0, HX: 1, HC: 2, MIXED: 3, "": 9 };

/**
 * Kategori satırını panel / arama için tek tip alanlara çevir (orijinal API alanları korunur).
 * @param {object} cat
 */
const normalizeHepsiburadaCategoriesForUi = (categories) => {
    if (!Array.isArray(categories)) return [];
    const rows = categories.map((cat) => {
        const cid = String(cat.categoryId ?? cat.id ?? "").trim();
        const rawPaths = cat.paths ?? cat.path;
        let pathDisplay = "";
        if (Array.isArray(rawPaths)) {
            pathDisplay = rawPaths
                .map((p) => {
                    if (p == null) return "";
                    if (typeof p === "string") return p;
                    if (typeof p === "object") return p.name || p.categoryName || p.title || "";
                    return String(p);
                })
                .filter(Boolean)
                .join(" > ");
        } else if (typeof rawPaths === "string" && rawPaths.trim()) {
            pathDisplay = rawPaths.trim();
        }
        const name = String(cat.name || cat.categoryName || "").trim();
        const hbTreeType = String(cat.hbTreeType || "").trim() || "MIXED";
        const leaf = cat.leaf === true || cat.isLeaf === true;
        const available = cat.available !== false && cat.isAvailable !== false;
        const uiTitle = pathDisplay ? `${name} — ${pathDisplay}` : name;
        return {
            ...cat,
            categoryId: cid,
            id: cid,
            name,
            hbTreeType,
            pathDisplay,
            leaf,
            available,
            /** Kullanıcı listede görsün: ağaç tipi + resmi ID + tam yol */
            hbDisplayTitle: `[${hbTreeType}] ${cid}${name ? ` — ${name}` : ""}${pathDisplay ? ` — ${pathDisplay}` : ""}`,
            hbSearchBlob: `${hbTreeType} ${cid} ${name} ${pathDisplay} ${uiTitle}`.toLowerCase()
        };
    });

    rows.sort((a, b) => {
        const oa = HB_CATEGORY_TYPE_ORDER[a.hbTreeType] ?? 99;
        const ob = HB_CATEGORY_TYPE_ORDER[b.hbTreeType] ?? 99;
        if (oa !== ob) return oa - ob;
        try {
            return a.name.localeCompare(b.name, "tr", { sensitivity: "base" });
        } catch {
            return String(a.name).localeCompare(String(b.name));
        }
    });
    return rows;
};

/**
 * Aynı HB ağaç tipi + categoryId tekrarlarını tek satırda birleştir; daha zengin paths olan kazanır.
 */
const mergeHepsiburadaCategoryRows = (rows) => {
    const byKey = new Map();
    const pathRichness = (cat) => {
        const p = cat.paths ?? cat.path;
        if (Array.isArray(p)) return p.length * 100 + JSON.stringify(p).length;
        if (typeof p === "string") return p.length;
        return 0;
    };
    for (const cat of rows) {
        const id = String(cat.categoryId ?? cat.id ?? "").trim();
        if (!id) continue;
        const t = String(cat.hbTreeType || "MIXED").trim() || "MIXED";
        const key = `${t}|${id}`;
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, cat);
        } else if (pathRichness(cat) > pathRichness(prev)) {
            byKey.set(key, { ...prev, ...cat, hbTreeType: t });
        }
    }
    return Array.from(byKey.values());
};

/**
 * Hepsiburada Kategorileri Çek (v4 — Tek doğruluk kaynağı)
 * Endpoint: GET /product/api/categories/get-all-categories
 * Params: leaf, status, available, type (HB/HX/HC), version, page, size (max 2000)
 * İstek Limiti: 200 istek/1 dakika (IP başına)
 *
 * v4:
 *   - listing-external host'larında merchantId query (Kategori Merkezi ile aynı)
 *   - Her satıra çekim kaynağı hbTreeType (HB/HX) — HC kampanya ağacı varsayılan kapalı
 *   - Birleştirme anahtarı: hbTreeType|categoryId (yalnızca gerçek API tekrarlarını siler)
 *   - Kampanya / vitrin adları path filtresi ile elenir
 *
 * @param {string} merchantId - Mağaza ID
 * @param {string} secretKey - Servis Anahtarı
 * @param {string} userAgent - Developer Username
 * @param {object} [opts] - { onlyLeaf, useSit, forUi, includeHc, types }
 */
const fetchHepsiburadaCategories = async (merchantId, secretKey, userAgent, opts = {}) => {
    try {
        const headers = getHeadersForGet(merchantId, secretKey, userAgent);
        const onlyLeaf = opts.onlyLeaf !== false; // varsayılan true (geriye dönük uyumluluk)
        const forUi = opts.forUi === true;
        const productCategoriesOnly = opts.productCategoriesOnly !== false;
        const requireListableQuery = forUi || productCategoriesOnly;

        // SIT MPOP katalog import, yalnızca SIT listing/MPOP kategori ağacındaki ID’leri kabul eder.
        // opts.useSit === true ise yalnızca -sit host’ları; aksi halde canlı.
        const useSit = opts.useSit === true;
        const ep = useSit ? HB_SIT_ENDPOINTS : HB_ENDPOINTS;
        const baseUrls = [
            `${ep.MPOP}/product/api/categories/get-all-categories`,
            `${ep.CATEGORY}/product/api/categories/get-all-categories`
        ];

        const mid = merchantId ? String(merchantId).trim() : "";

        /**
         * Tek bir parametre seti ile sayfalı çekme
         */
        const fetchPaginated = async (queryOpts = {}, label = "") => {
            const categories = [];
            let typed400FirstPage = false;
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

                    if (mid && baseUrl.includes("listing-external")) {
                        params.set("merchantId", mid);
                    }
                    if (queryOpts.leaf === true) params.set("leaf", "true");
                    if (queryOpts.available === true) params.set("available", "true");
                    if (queryOpts.type) params.set("type", queryOpts.type);
                    if (queryOpts.status) params.set("status", queryOpts.status);

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
                        const st = err.response?.status;
                        if (st === 400 && page === 0 && queryOpts.type) {
                            typed400FirstPage = true;
                        }
                        logger.warn(`[Hepsiburada CAT${label}] ${baseUrl} hata: ${st || err.message}`);
                    }
                }

                if (!pageSuccess) { hasMore = false; }
            }

            if (categories.length > 0) {
                logger.info(`[Hepsiburada CAT${label}] ${categories.length} kategori çekildi`);
            }
            return { categories, typed400FirstPage };
        };

        const pushTagged = (arr, typeLabel, list) => {
            const t = typeLabel || "MIXED";
            for (const c of list) {
                arr.push({ ...c, hbTreeType: t });
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // v5: HB + HX katalog (HC kampanya varsayılan kapalı — opts.includeHc ile açılır)
        // ═══════════════════════════════════════════════════════════════
        let allCategories = [];
        const TYPES = resolveHbCategoryTypesForFetch(opts);
        const listableQuery = { leaf: true, available: true, status: "ACTIVE" };

        const typeHadRows = Object.fromEntries(TYPES.map((t) => [t, false]));

        if (onlyLeaf) {
            for (const type of TYPES) {
                try {
                    const pageOpts = requireListableQuery ? { ...listableQuery, type } : { leaf: true, type };
                    const { categories: cats, typed400FirstPage } = await fetchPaginated(pageOpts, ` ${type}`);
                    if (cats.length > 0) {
                        typeHadRows[type] = true;
                        pushTagged(allCategories, type, cats);
                    } else if (typed400FirstPage) {
                        logger.info(`[Hepsiburada CAT] ${type} type= filtresi 400 — tamamlayıcıda type alanından eşleştirilecek`);
                    }
                } catch (e) { logger.warn(`[Hepsiburada CAT] ${type} hatası: ${e.message}`); }
            }
            const emptyTypes = TYPES.filter((t) => !typeHadRows[t]);
            if (emptyTypes.length > 0 && emptyTypes.length < TYPES.length) {
                const supOpts = requireListableQuery ? { ...listableQuery } : { leaf: true };
                const { categories: supplement } = await fetchPaginated(supOpts, " empty-type-supplement");
                const emptySet = new Set(emptyTypes);
                const hasKey = (treeType, id) =>
                    allCategories.some(
                        (r) =>
                            String(r.hbTreeType || "").trim() === treeType &&
                            String(r.categoryId ?? r.id ?? "").trim() === id
                    );
                for (const c of supplement) {
                    const id = String(c.categoryId ?? c.id ?? "").trim();
                    if (!id) continue;
                    let t = String(c.type || c.categoryType || "").trim().toUpperCase();
                    if (!TYPES.includes(t)) {
                        if (emptyTypes.length === 1) t = emptyTypes[0];
                        else continue;
                    }
                    if (!emptySet.has(t)) continue;
                    if (hasKey(t, id)) continue;
                    if (isHepsiburadaCampaignOrNonProductCategory({ ...c, hbTreeType: t })) continue;
                    pushTagged(allCategories, t, [c]);
                }
                logger.info(
                    `[Hepsiburada CAT] Tamamlayıcı: boş ağaç tipleri [${emptyTypes.join(", ")}] — ek satır sonrası ham: ${allCategories.length}`
                );
            }
            if (allCategories.length === 0) {
                const fbOpts = requireListableQuery ? { ...listableQuery } : { leaf: true };
                const { categories: fb } = await fetchPaginated(fbOpts, " fallback");
                pushTagged(allCategories, "MIXED", fb);
            }
        } else {
            for (const type of TYPES) {
                try {
                    const leafOpts = requireListableQuery ? { ...listableQuery, type } : { leaf: true, type };
                    const { categories: leafCats } = await fetchPaginated(leafOpts, ` ${type}-leaf`);
                    if (leafCats.length > 0) pushTagged(allCategories, type, leafCats);
                    const { categories: parentCats } = await fetchPaginated({ leaf: false, available: true, status: "ACTIVE", type }, ` ${type}-parent`);
                    if (parentCats.length > 0) pushTagged(allCategories, type, parentCats);
                } catch (e) { logger.warn(`[Hepsiburada CAT] ${type} hatası: ${e.message}`); }
            }
            if (allCategories.length === 0) {
                const { categories: fbLeaf } = await fetchPaginated({ leaf: true }, " leaf-fallback");
                pushTagged(allCategories, "MIXED", fbLeaf);
                const { categories: parentFallback } = await fetchPaginated({ leaf: false }, " parent-fallback");
                if (parentFallback.length > 0) pushTagged(allCategories, "MIXED", parentFallback);
            }
        }

        let merged = mergeHepsiburadaCategoryRows(allCategories);
        const beforeFilter = merged.length;
        if (productCategoriesOnly) {
            merged = filterHepsiburadaProductCategories(merged, {
                requireListable: forUi,
                includeHx: opts.includeHx !== false
            });
        }
        const removed = beforeFilter - merged.length;
        if (removed > 0) {
            logger.info(
                `[Hepsiburada] ${removed} kampanya/HC veya listelenemez kategori elendi (kalan: ${merged.length})`
            );
        }

        logger.info(
            `[Hepsiburada] ${merged.length} birleşik kategori (ham: ${allCategories.length}, API types: ${TYPES.join("+")})`
        );
        return forUi ? normalizeHepsiburadaCategoriesForUi(merged) : merged;
    } catch (error) {
        logger.error("Hepsiburada kategori çekme hatası:", {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
};

/**
 * Ürün çekme / kategori adı çözümü: categoryId → görünen ad.
 * Resmi API: type olmadan çağrı çoğu zaman yalnızca HB alt kümesini döndürür; bu yüzden
 * fetchHepsiburadaCategories (HB+HX+HC) kullanılır — Kategori Merkezi ile aynı mantık.
 *
 * @param {string} merchantId
 * @param {string} secretKey
 * @param {string} userAgent
 * @param {object} [opts] - { onlyLeaf: boolean } varsayılan true
 * @returns {Promise<Map<string, string>>}
 */
const buildHepsiburadaCategoryNameMap = async (merchantId, secretKey, userAgent, opts = {}) => {
    const cats = await fetchHepsiburadaCategories(merchantId, secretKey, userAgent, {
        onlyLeaf: opts.onlyLeaf !== false,
        useSit: opts.useSit === true
    });
    const map = new Map();
    for (const cat of cats) {
        const cid = cat.categoryId || cat.id;
        const cname = cat.name || cat.categoryName || "";
        if (cid != null && String(cid).trim() !== "" && cname) map.set(String(cid), cname);
    }
    return map;
};

/**
 * Kategori özellikleri API yanıtından kök obje (baseAttributes / variantAttributes / …)
 */
const unwrapHbCategoryAttributesRoot = (apiBody) => {
    if (!apiBody || typeof apiBody !== "object") return {};
    let d = apiBody.data != null ? apiBody.data : apiBody;
    if (d && typeof d === "object" && d.data != null && typeof d.data === "object" && !Array.isArray(d.data)) {
        d = d.data;
    }
    if (d && typeof d === "object" && !Array.isArray(d)) return d;
    return {};
};

/**
 * Hepsiburada Kategori Özellikleri Çek
 * Resmi: GET .../product/api/categories/{categoryId}/attributes?version=2 (MPOP; SIT/PROD import ile aynı ortam)
 * @param {boolean} [useSit]
 */
const fetchHepsiburadaCategoryAttributes = async (merchantId, secretKey, categoryId, userAgent, useSit = false) => {
    const headers = getHeadersForGet(merchantId, secretKey, userAgent);
    const ep = getEndpoints({ useSit });
    const urls = [
        `${ep.MPOP}/product/api/categories/${categoryId}/attributes?version=2`,
        `${ep.CATEGORY}/product/api/categories/${categoryId}/attributes?version=2`
    ];
    let lastErr = null;
    for (const url of urls) {
        try {
            const response = await axios.get(url, { headers, timeout: 20000 });
            return response.data;
        } catch (error) {
            lastErr = error;
            logger.warn(
                `[HB CAT ATTR] ${url} — ${error.response?.status || "-"} ${error.message}`
            );
        }
    }
    logger.error(`Hepsiburada kategori özellik çekme hatası (categoryId: ${categoryId}):`, {
        error: lastErr?.message,
        status: lastErr?.response?.status
    });
    throw lastErr || new Error("HB kategori özellikleri alınamadı");
};

/**
 * Enum özellik değerleri — sayfalı (version=5)
 */
const fetchHepsiburadaAttributeEnumValuesPage = async (
    merchantId,
    secretKey,
    categoryId,
    attributeId,
    userAgent,
    useSit,
    page
) => {
    const headers = getHeadersForGet(merchantId, secretKey, userAgent);
    const ep = getEndpoints({ useSit });
    const aid = encodeURIComponent(String(attributeId));
    const cid = encodeURIComponent(String(categoryId));
    const urls = [
        `${ep.MPOP}/product/api/categories/${cid}/attribute/${aid}/values?version=5&page=${page}&size=1000`,
        `${ep.CATEGORY}/product/api/categories/${cid}/attribute/${aid}/values?version=5&page=${page}&size=1000`
    ];
    let lastErr = null;
    for (const url of urls) {
        try {
            const response = await axios.get(url, { headers, timeout: 20000 });
            return response.data;
        } catch (error) {
            lastErr = error;
        }
    }
    throw lastErr || new Error("HB özellik değerleri alınamadı");
};

const extractHbAttributeValuesArray = (body) => {
    if (!body || typeof body !== "object") return { items: [], last: true };
    const d = body.data != null ? body.data : body;
    if (Array.isArray(d)) return { items: d, last: true };
    if (d && typeof d === "object") {
        if (Array.isArray(d.content)) {
            const last = d.last === true || (d.number != null && d.totalPages != null && d.number >= d.totalPages - 1);
            return { items: d.content, last: last || d.content.length < 1000 };
        }
        if (Array.isArray(d.data)) return { items: d.data, last: true };
    }
    return { items: [], last: true };
};

const fetchAllHepsiburadaAttributeEnumValues = async (
    merchantId,
    secretKey,
    categoryId,
    attributeId,
    userAgent,
    useSit
) => {
    const all = [];
    for (let page = 0; page < 50; page++) {
        const body = await fetchHepsiburadaAttributeEnumValuesPage(
            merchantId,
            secretKey,
            categoryId,
            attributeId,
            userAgent,
            useSit,
            page
        );
        const { items, last } = extractHbAttributeValuesArray(body);
        for (const it of items) {
            if (it && (it.id != null || it.value != null)) all.push(it);
        }
        if (last || items.length === 0) break;
    }
    return all;
};

const hbNormalizeForMatch = (s) =>
    String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

/** HB katalog attributes içine asla gönderilmemeli (Trendyol iç yapısı — şema/işlem satırı bozabilir) */
const HB_CATALOG_SKIP_MERGE_KEYS = new Set([
    "trendyolAttributeRows",
    "trendyolAttributes",
    "tyAttributeRows"
]);

/**
 * Ürün `attributes` / hbCatalog blob'undan kopyalanırken atlanır — hesaplanan GarantiSuresi'nin üzerine eski 24 vb. yazılmasın.
 * (Final attrs temizliğinde HB_CATALOG_SKIP_MERGE_KEYS kullanılır; GarantiSuresi orada silinmez.)
 */
const HB_CATALOG_MERGE_SOURCE_OMIT_KEYS = new Set([
    ...HB_CATALOG_SKIP_MERGE_KEYS,
    "GarantiSuresi",
    "garantiSuresi"
]);

/** Master `attributes` (Trendyol/N11 iç modeli) — HB katalog dosyasına asla gitmemeli; "ignored" gürültüsü ve çakışmayı keser */
const HB_MASTER_FLAT_OMIT_KEYS = new Set([
    ...HB_CATALOG_MERGE_SOURCE_OMIT_KEYS,
    "material",
    "pieceCount",
    "piececount",
    "origin",
    "mensei",
    "manufacturer",
    "boyutEbat",
    "boyutebat",
    "color",
    "size",
    "webColor",
    "webcolor",
    "gender",
    "themeStyle",
    "model",
    "sku",
    "barcode",
    "desi",
    "weightDesi",
    "brandId",
    "brand",
    "marka",
    "vatRate",
    "taxVatRate",
    "kdv",
    "warrantyMonths",
    "garantiDurumu",
    "costPrice",
    "shippingCost"
]);

/** Katalog JSON'da her zaman izinli kök alanlar (kategori attribute adları ayrıca eklenir) */
const HB_FILE_IMPORT_ROOT_KEYS = new Set([
    "merchantSku",
    "VaryantGroupID",
    "Barcode",
    "UrunAdi",
    "UrunAciklamasi",
    "Marka",
    "GarantiSuresi",
    "kg",
    "tax_vat_rate",
    "price",
    "stock",
    "variantTypeId"
]);

const SYM_HB_COLOR_ENUM_WARNED = Symbol.for("lysiaetic.hbCatalog.colorEnumWarned");
const SYM_HB_SIZE_ENUM_WARNED = Symbol.for("lysiaetic.hbCatalog.sizeEnumWarned");

const shouldLogHbColorEnumMiss = (productData, hintsKey) => {
    if (!productData || typeof productData !== "object") return true;
    let s = productData[SYM_HB_COLOR_ENUM_WARNED];
    if (!s) {
        s = new Set();
        productData[SYM_HB_COLOR_ENUM_WARNED] = s;
    }
    if (s.has(hintsKey)) return false;
    s.add(hintsKey);
    return true;
};

const shouldLogHbSizeEnumMiss = (productData, hintsKey) => {
    if (!productData || typeof productData !== "object") return true;
    let s = productData[SYM_HB_SIZE_ENUM_WARNED];
    if (!s) {
        s = new Set();
        productData[SYM_HB_SIZE_ENUM_WARNED] = s;
    }
    if (s.has(hintsKey)) return false;
    s.add(hintsKey);
    return true;
};

/**
 * Katalog / kategori merkezi / ürün formundan gelen renk metinlerini tek listede topla (HB enum eşlemesi için).
 */
const collectHbColorHintsFromProduct = (productData) => {
    if (!productData || typeof productData !== "object") return [];
    const seen = new Set();
    const out = [];
    const add = (v) => {
        const s = String(v ?? "").trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(s);
    };
    add(productData.color);
    add(productData.renk);
    const a = productData.attributes;
    if (a && typeof a === "object" && !Array.isArray(a)) {
        add(a.color);
        add(a.renk);
        add(a.Color);
        add(a.Renk);
        const tyRows = a.trendyolAttributeRows;
        if (Array.isArray(tyRows)) {
            for (const row of tyRows) {
                const n = String(row?.attributeName || row?.name || "").toLowerCase();
                if (/^renk$|^color$|renk\b|color\b/i.test(n) && !n.includes("web")) {
                    add(row?.attributeValue ?? row?.value ?? row?.customAttributeValue);
                }
            }
        }
    }
    for (const key of ["hepsiburadaCatalogAttributes", "hbCatalogAttributes", "hbAttributes"]) {
        const o = productData[key];
        if (o && typeof o === "object" && !Array.isArray(o)) {
            add(o.color);
            add(o.renk);
        }
    }
    if (Array.isArray(a)) {
        for (const row of a) {
            const n = String(row?.name || row?.attributeName || row?.label || "").toLowerCase();
            if (/renk|color|reng\b/i.test(n)) {
                add(row?.value ?? row?.attributeValue ?? row?.customAttributeValue ?? row?.text);
            }
        }
    }
    return out;
};

const collectHbSecenekHintsFromProduct = (productData) => {
    if (!productData || typeof productData !== "object") return [];
    const seen = new Set();
    const out = [];
    const add = (v) => {
        const s = String(v ?? "").trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(s);
    };
    add(productData.secenek);
    add(productData.seçenek);
    add(productData.option);
    add(productData.variantOption);
    add(productData.size);
    add(productData.beden);
    const a = productData.attributes;
    if (a && typeof a === "object" && !Array.isArray(a)) {
        add(a.secenek);
        add(a.seçenek);
        add(a.Secenek);
        add(a.Seçenek);
        add(a.option);
        const tyRows = a.trendyolAttributeRows;
        if (Array.isArray(tyRows)) {
            for (const row of tyRows) {
                const n = String(row?.attributeName || row?.name || "").toLowerCase();
                if (/secenek|seçenek|varyant|ebat|boyut|tek\s*ebat/i.test(n)) {
                    add(row?.attributeValue ?? row?.value ?? row?.customAttributeValue);
                }
            }
        }
    }
    return out;
};

const collectHbSizeHintsFromProduct = (productData) => {
    if (!productData || typeof productData !== "object") return [];
    const seen = new Set();
    const out = [];
    const add = (v) => {
        const s = String(v ?? "").trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(s);
    };
    add(productData.size);
    add(productData.beden);
    add(productData.ebat);
    const a = productData.attributes;
    if (a && typeof a === "object" && !Array.isArray(a)) {
        add(a.size);
        add(a.beden);
        add(a.ebat);
        add(a.Size);
        add(a.Beden);
        const tyRows = a.trendyolAttributeRows;
        if (Array.isArray(tyRows)) {
            for (const row of tyRows) {
                const n = String(row?.attributeName || row?.name || "").toLowerCase();
                if (/beden|numara|ebat|size|boyut|ölçü|olcu/i.test(n)) {
                    add(row?.attributeValue ?? row?.value ?? row?.customAttributeValue);
                }
            }
        }
    }
    for (const key of ["hepsiburadaCatalogAttributes", "hbCatalogAttributes", "hbAttributes"]) {
        const o = productData[key];
        if (o && typeof o === "object" && !Array.isArray(o)) {
            add(o.size);
            add(o.beden);
            add(o.ebat);
        }
    }
    if (Array.isArray(a)) {
        for (const row of a) {
            const n = String(row?.name || row?.attributeName || row?.label || "").toLowerCase();
            if (/beden|numara|ebat|size|boyut|ölçü|olcu/i.test(n)) {
                add(row?.value ?? row?.attributeValue ?? row?.customAttributeValue ?? row?.text);
            }
        }
    }
    return out;
};

/**
 * Ürün gövdesinde renk/beden dağınık gelir; enum eşleştirmeden önce üst düzey color/size’a yansıt.
 */
const normalizeHbProductVariantHints = (productData) => {
    if (!productData || typeof productData !== "object") return;
    const colors = collectHbColorHintsFromProduct(productData);
    const sizes = collectHbSizeHintsFromProduct(productData);
    if (colors.length > 0) {
        if (!String(productData.color || "").trim()) productData.color = colors[0];
        if (
            productData.attributes &&
            typeof productData.attributes === "object" &&
            !Array.isArray(productData.attributes) &&
            !String(productData.attributes.color || "").trim()
        ) {
            productData.attributes.color = colors[0];
        }
    }
    if (sizes.length > 0) {
        if (!String(productData.size || "").trim()) productData.size = sizes[0];
        if (
            productData.attributes &&
            typeof productData.attributes === "object" &&
            !Array.isArray(productData.attributes) &&
            !String(productData.attributes.size || "").trim()
        ) {
            productData.attributes.size = sizes[0];
        }
    }
};

const pickHbEnumValueFromHints = (values, hintsNormalized) => {
    if (!values || values.length === 0) return null;
    if (!hintsNormalized || hintsNormalized.length === 0) return null;
    for (const hint of hintsNormalized) {
        if (!hint) continue;
        const hit = values.find((v) => hbNormalizeForMatch(v.value || v.name || "") === hint);
        if (hit) return hit;
    }
    for (const hint of hintsNormalized) {
        if (!hint) continue;
        const hit = values.find((v) => {
            const vv = hbNormalizeForMatch(v.value || v.name || "");
            return vv.includes(hint) || hint.includes(vv);
        });
        if (hit) return hit;
    }
    return null;
};

/**
 * Renk enum’u: kullanıcı renk verdiyse yalnızca HB listesinde eşleşen id; yoksa ilk geçerli (kullanıcı vermedi).
 */
const pickHbEnumValueForProduct = (values, productData) => {
    if (!values || values.length === 0) return null;
    const hints = collectHbColorHintsFromProduct(productData).map(hbNormalizeForMatch).filter(Boolean);
    if (hints.length === 0) {
        return values[0];
    }
    const hit = pickHbEnumValueFromHints(values, hints);
    if (hit) return hit;
    const hintsKey = hints.join("\u001f");
    if (shouldLogHbColorEnumMiss(productData, hintsKey)) {
        logger.warn(
            `[HB KATALOG] Ürün rengi bu HB özellik listesinde eşleşmedi (başka zorunlu enum adımında düzeltilebilir): ${hints.join(" | ")}`
        );
    }
    return null;
};

/**
 * HB zorunlu "Marka" enum'u için: asla renk ipucu + values[0] mantığı kullanılmaz (çoğu kategoride
 * values[0] "Belirtilmedi" / yanlış id olur). Ürün markası metnini enum listesiyle eşleştirir.
 */
const pickHbEnumValueForMandatoryMarka = (values, productData) => {
    if (!values || values.length === 0) return null;
    const hintsRaw = [];
    const rb = resolveProductBrandName(productData);
    if (rb) hintsRaw.push(rb);
    const top = String(productData?.brand || productData?.marka || productData?.brandName || "").trim();
    if (top) hintsRaw.push(top);
    const mp = productData?.masterProduct;
    if (mp && typeof mp === "object") {
        const mb = String(mp.brand || mp.marka || mp.brandName || "").trim();
        if (mb) hintsRaw.push(mb);
    }
    const hints = [];
    for (const t of hintsRaw) {
        if (!t || isPlaceholderBrand(t)) continue;
        const n = hbNormalizeForMatch(t);
        if (n && !hints.includes(n)) hints.push(n);
    }
    if (hints.length === 0) return null;
    const hit = pickHbEnumValueFromHints(values, hints);
    if (hit) return hit;
    for (const h of hints) {
        if (h.length < 2) continue;
        const found = values.find((v) => {
            const vv = hbNormalizeForMatch(v.value || v.name || "");
            return vv && (vv.includes(h) || h.includes(vv));
        });
        if (found) return found;
    }
    return null;
};

const pickHbEnumValueForVariantAttr = (values, productData, attr) => {
    if (!values || values.length === 0) return null;
    const fnRaw = `${attr?.name || ""} ${attr?.displayName || ""} ${attr?.title || ""}`;
    const fn = fnRaw.toLowerCase();
    const fnNorm = hbNormalizeForMatch(fnRaw);
    if (/^marka$/i.test(String(attr?.name || "").trim()) || fnNorm === "marka") {
        return pickHbEnumValueForMandatoryMarka(values, productData);
    }
    if (
        fn.includes("renk") ||
        fn.includes("color") ||
        fn.includes("rengi")
    ) {
        return pickHbEnumValueForProduct(values, productData);
    }
    if (fnNorm.includes("secenek") || /\bsecenek\b/i.test(fnNorm)) {
        const hints = collectHbSecenekHintsFromProduct(productData).map(hbNormalizeForMatch).filter(Boolean);
        if (hints.length === 0) {
            return values[0];
        }
        const hit = pickHbEnumValueFromHints(values, hints);
        return hit || values[0];
    }
    if (
        fn.includes("beden") ||
        fn.includes("numara") ||
        fn.includes("ebat") ||
        fn.includes("size") ||
        fn.includes("boyut")
    ) {
        const hints = collectHbSizeHintsFromProduct(productData).map(hbNormalizeForMatch).filter(Boolean);
        if (hints.length === 0) {
            return values[0];
        }
        const hit = pickHbEnumValueFromHints(values, hints);
        if (hit) return hit;
        const sizeKey = hints.join("\u001f");
        if (shouldLogHbSizeEnumMiss(productData, sizeKey)) {
            logger.warn(
                `[HB KATALOG] Ürün beden/ebat bilgisi bu HB özellik listesinde eşleşmedi: ${hints.join(" | ")}`
            );
        }
        return null;
    }
    return values[0];
};

const hbEnumPickedStorageValue = (picked) => {
    if (!picked || typeof picked !== "object") return "";
    const idCandidates = [
        picked.id,
        picked.valueId,
        picked.attributeValueId,
        picked.enumValueId,
        picked.enumId,
        picked?.attributeValue?.id,
        picked?.value?.id
    ];
    for (const c of idCandidates) {
        if (c == null || c === "") continue;
        const s = String(c).trim();
        if (s && s !== "0") return s;
    }
    return String(picked.value ?? picked.name ?? picked.label ?? "").trim();
};

const assignHbEnumPickedToMerged = (merged, fieldName, picked) => {
    if (!picked) return;
    const raw = hbEnumPickedStorageValue(picked);
    if (!raw) return;
    merged[fieldName] = raw;
};

const deepFindFirstVariantTypesArray = (obj, depth = 0) => {
    if (!obj || depth > 8) return null;
    if (Array.isArray(obj)) {
        for (const x of obj) {
            const f = deepFindFirstVariantTypesArray(x, depth + 1);
            if (f) return f;
        }
        return null;
    }
    if (typeof obj === "object") {
        for (const k of Object.keys(obj)) {
            if (/^variantTypes$/i.test(k) && Array.isArray(obj[k]) && obj[k].length > 0) {
                return obj[k];
            }
        }
        for (const k of Object.keys(obj)) {
            const f = deepFindFirstVariantTypesArray(obj[k], depth + 1);
            if (f) return f;
        }
    }
    return null;
};

/** HB variantType satırı için okunabilir etiket (id seçiminde kullanılır) */
const hbVariantTypeLabelText = (vt) =>
    String(
        vt?.name ??
            vt?.title ??
            vt?.displayName ??
            vt?.variantTypeName ??
            vt?.label ??
            vt?.description ??
            ""
    ).trim();

/**
 * Birden fazla variantType döndüğünde `vtypes[0]` yanlış kombinasyon olabiliyor
 * (ör. kategori "Seçenek / Renk" isterken ilk kayıt başka eksen çifti).
 * variantAttributes içindeki alan adlarıyla en iyi örtüşeni seç.
 */
const pickHbVariantTypeEntry = (vtypes, variantAttributes) => {
    if (!Array.isArray(vtypes) || vtypes.length === 0) return null;
    if (vtypes.length === 1) return vtypes[0];

    const attrNormFull = (Array.isArray(variantAttributes) ? variantAttributes : [])
        .map((a) => hbNormalizeForMatch(hbVariantTypeLabelText(a)))
        .filter(Boolean);

    let hasRenkDim = false;
    let hasSecenekDim = false;
    let hasEbatDim = false;
    for (const n of attrNormFull) {
        if (n.includes("renk") || n.includes("color") || n.includes("reng")) hasRenkDim = true;
        if (n.includes("secenek")) hasSecenekDim = true;
        if (
            n.includes("ebat") ||
            n.includes("beden") ||
            n.includes("boyut") ||
            n.includes("olcu") ||
            n.includes("numara") ||
            n.includes("size")
        ) {
            hasEbatDim = true;
        }
    }

    const needsSecenekRenkCombo = hasRenkDim && hasSecenekDim && !hasEbatDim;
    const needsRenkEbatCombo = hasRenkDim && hasEbatDim;
    const needsSecenekEbatCombo = hasSecenekDim && hasEbatDim && !hasRenkDim;
    const needsEbatOnlyCombo = hasEbatDim && !hasRenkDim && !hasSecenekDim;

    const tokens = new Set();
    for (const lab of attrNormFull) {
        tokens.add(lab);
        for (const w of lab.split(/\s+/)) {
            if (w.length >= 3) tokens.add(w);
        }
    }

    const labelOf = (vt) => hbNormalizeForMatch(hbVariantTypeLabelText(vt));

    let pool = vtypes;
    if (needsRenkEbatCombo) {
        const comboOnly = vtypes.filter((vt) => {
            const label = labelOf(vt);
            if (!label) return false;
            const hasR = label.includes("renk") || label.includes("color");
            const hasE =
                label.includes("ebat") ||
                label.includes("beden") ||
                label.includes("boyut") ||
                label.includes("olcu") ||
                label.includes("numara");
            return hasR && hasE;
        });
        if (comboOnly.length > 0) pool = comboOnly;
    } else if (needsSecenekEbatCombo) {
        const comboOnly = vtypes.filter((vt) => {
            const label = labelOf(vt);
            if (!label) return false;
            const hasS = label.includes("secenek");
            const hasE =
                label.includes("ebat") ||
                label.includes("beden") ||
                label.includes("boyut") ||
                label.includes("olcu");
            return hasS && hasE;
        });
        if (comboOnly.length > 0) pool = comboOnly;
    } else if (needsEbatOnlyCombo) {
        const comboOnly = vtypes.filter((vt) => {
            const label = labelOf(vt);
            if (!label) return false;
            const hasE =
                label.includes("ebat") ||
                label.includes("beden") ||
                label.includes("boyut") ||
                label.includes("olcu");
            const hasR = label.includes("renk") || label.includes("color");
            const hasS = label.includes("secenek");
            return hasE && !hasR && !hasS;
        });
        if (comboOnly.length > 0) pool = comboOnly;
    } else if (needsSecenekRenkCombo) {
        const comboOnly = vtypes.filter((vt) => {
            const label = labelOf(vt);
            return label && label.includes("secenek") && label.includes("renk");
        });
        if (comboOnly.length > 0) pool = comboOnly;
    }

    let best = pool[0];
    let bestScore = -1;
    for (const vt of pool) {
        const label = labelOf(vt);
        if (!label) continue;
        let score = 0;
        for (const t of tokens) {
            if (t.length < 3) continue;
            if (label.includes(t)) score += 3;
        }
        if (label.includes("renk") && (label.includes("ebat") || label.includes("beden") || label.includes("boyut"))) {
            score += 12;
        }
        if (label.includes("secenek") && (label.includes("ebat") || label.includes("beden"))) {
            score += 12;
        }
        if (label.includes("secenek") && label.includes("renk")) score += 8;
        if (label.includes("beden") && label.includes("renk")) score += 5;
        if (label.includes("numara") && label.includes("renk")) score += 5;
        score += (label.match(/\//g) || []).length;
        if (score > bestScore) {
            bestScore = score;
            best = vt;
        }
    }
    return best;
};

/**
 * Zorunlu enum / varyant alanları (ör. renk_variant_property, variantTypeId) boşsa kategori API’sinden doldurur.
 * Ürün verisine yan etki: hepsiburadaCatalogAttributes birleştirilir.
 */
const augmentHbProductDataWithCategoryMandatoryFields = async (productData, ctx) => {
    normalizeHbProductVariantHints(productData);
    const { merchantId, secretKey, userAgent, useSit, categoryId } = ctx;
    const raw = await fetchHepsiburadaCategoryAttributes(
        merchantId,
        secretKey,
        categoryId,
        userAgent,
        useSit
    );
    const root = unwrapHbCategoryAttributesRoot(raw);
    const lists = [
        ...(Array.isArray(root.variantAttributes) ? root.variantAttributes : []),
        ...(Array.isArray(root.attributes) ? root.attributes : []),
        ...(Array.isArray(root.baseAttributes) ? root.baseAttributes : [])
    ];

    const existingHb =
        productData.hepsiburadaCatalogAttributes && typeof productData.hepsiburadaCatalogAttributes === "object"
            ? { ...productData.hepsiburadaCatalogAttributes }
            : {};
    const existingFlat = { ...productData };
    const merged = { ...existingHb };
    const hasVal = (key) => {
        const kn = String(key || "").trim();
        let v = merged[kn] ?? existingFlat[kn];
        if (/^marka$/i.test(kn)) {
            if (isPlaceholderBrand(v)) v = null;
            const resolvedBrand = resolveProductBrandName(productData);
            if (resolvedBrand && !isPlaceholderBrand(resolvedBrand)) return true;
        }
        return v != null && String(v).trim() !== "";
    };

    /** Aynı attributeId için tekrarlı HB çağrısı yapma */
    const enumValuesCache = new Map();
    const loadEnumValues = async (attrId) => {
        const sid = String(attrId);
        if (enumValuesCache.has(sid)) return enumValuesCache.get(sid);
        const values = await fetchAllHepsiburadaAttributeEnumValues(
            merchantId,
            secretKey,
            categoryId,
            attrId,
            userAgent,
            useSit
        );
        enumValuesCache.set(sid, values);
        return values;
    };

    const vtypes = root.variantTypes || deepFindFirstVariantTypesArray(root);
    if (Array.isArray(vtypes) && vtypes.length > 0 && !hasVal("variantTypeId")) {
        const variantOnlyForPick = Array.isArray(root.variantAttributes) ? root.variantAttributes : [];
        const vtPick = pickHbVariantTypeEntry(vtypes, variantOnlyForPick);
        const vid =
            vtPick?.id ??
            vtPick?.variantTypeId ??
            vtPick?.variantTypeID ??
            vtPick?.value ??
            vtPick?.variantType?.id ??
            vtPick?.variantType?.variantTypeId;
        if (vid != null && String(vid).trim() !== "") {
            merged.variantTypeId = String(vid);
            const vtLabel = hbVariantTypeLabelText(vtPick).slice(0, 80);
            logger.info(
                `[HB KATALOG AUTO] variantTypeId=${merged.variantTypeId} (kategori ${categoryId}` +
                    `${vtLabel ? ` — "${vtLabel}"` : ""}${vtypes.length > 1 ? "; çoklu kombinasyondan seçildi" : ""})`
            );
        } else if (vtypes.length > 0) {
            logger.warn(
                `[HB KATALOG] categoryId=${categoryId}: ${vtypes.length} variantType satırı var fakat id çıkarılamadı — ` +
                    `HB panel / attributes yanıt yapısı değişmiş olabilir. Örnek=${JSON.stringify(vtypes[0]).slice(0, 220)}`
            );
        }
    }

    if (!hasVal("variantTypeId")) {
        const fromAttr = lists.find(
            (a) => a && (a.variantTypeId != null || a.variantTypeID != null)
        );
        if (fromAttr) {
            const vid = fromAttr.variantTypeId ?? fromAttr.variantTypeID;
            merged.variantTypeId = String(vid);
            logger.info(`[HB KATALOG AUTO] variantTypeId=${merged.variantTypeId} (özellik meta)`);
        }
    }

    for (const attr of lists) {
        if (!attr) continue;
        const isMandatory = attr.mandatory === true || attr.mandatory === "true" || attr.mandatory === 1;
        if (!isMandatory) continue;
        const typeStr = String(attr.type || "").toLowerCase();
        const fieldName = String(attr.name || "").trim();
        if (!fieldName) continue;
        if (hasVal(fieldName)) continue;
        if (!typeStr.includes("enum")) continue;
        const attrId = attr.id ?? attr.attributeId;
        if (attrId == null) continue;
        try {
            const values = await loadEnumValues(attrId);
            const picked = /^marka$/i.test(fieldName)
                ? pickHbEnumValueForMandatoryMarka(values, productData)
                : pickHbEnumValueForProduct(values, productData);
            const prev = merged[fieldName];
            assignHbEnumPickedToMerged(merged, fieldName, picked);
            if (merged[fieldName] && merged[fieldName] !== prev) {
                logger.info(
                    `[HB KATALOG AUTO] ${fieldName}=${merged[fieldName]} ` +
                        `(value="${picked?.value || picked?.name || "-"}" — zorunlu enum)`
                );
            }
        } catch (e) {
            logger.warn(`[HB KATALOG AUTO] "${fieldName}" enum değerleri alınamadı: ${e.message}`);
        }
    }

    // HB panelde renk/beden çoğu kategoride zorunlu bayrağı kapalı gelir; yine de varyant enum’ları doldur.
    const variantOnly = Array.isArray(root.variantAttributes) ? root.variantAttributes : [];
    for (const attr of variantOnly) {
        if (!attr) continue;
        const typeStr = String(attr.type || "").toLowerCase();
        if (!typeStr.includes("enum")) continue;
        const fieldName = String(attr.name || "").trim();
        if (!fieldName || hasVal(fieldName)) continue;
        const attrId = attr.id ?? attr.attributeId;
        if (attrId == null) continue;
        try {
            const values = await loadEnumValues(attrId);
            const picked = pickHbEnumValueForVariantAttr(values, productData, attr);
            const prev = merged[fieldName];
            assignHbEnumPickedToMerged(merged, fieldName, picked);
            if (merged[fieldName] && merged[fieldName] !== prev) {
                logger.info(
                    `[HB KATALOG AUTO] ${fieldName}=${merged[fieldName]} ` +
                        `(varyant enum → panel; ürün rengi/beden eşlemesi veya ilk geçerli değer)`
                );
            }
        } catch (e) {
            logger.warn(`[HB KATALOG AUTO] varyant "${fieldName}" enum değerleri alınamadı: ${e.message}`);
        }
    }

    const importAttrNames = [];
    for (const attr of lists) {
        const fn = String(attr?.name || "").trim();
        if (fn) importAttrNames.push(fn);
    }
    productData._hbCategoryAttributeNamesForImport = importAttrNames;

    productData.hepsiburadaCatalogAttributes = merged;
};

// ═══════════════════════════════════════════════════════════════════════
// 📤 ÜRÜN YÜKLEME (KATALOG)
// ═══════════════════════════════════════════════════════════════════════

/**
 * HB katalog import: fiyat virgüllü string (örn. 14,50)
 * @see https://developers.hepsiburada.com/hepsiburada/reference/katalog-onemli-bilgiler
 */
const formatHbPriceStockString = (price) => {
    const x = Number(price);
    if (!Number.isFinite(x)) return "0,00";
    return x.toFixed(2).replace(".", ",");
};

/**
 * Üst düzey / attributes / masterProduct üzerinden ay cinsinden garanti (0 geçerli — `||` kullanılmaz).
 */
const readHbWarrantyMonthsDirect = (productData) => {
    const tryVal = (v) => {
        if (v == null || v === "") return null;
        if (typeof v === "object" && !Array.isArray(v)) {
            const inner = v.value ?? v.name ?? v.count ?? v.months;
            if (inner == null || inner === "") return null;
            v = inner;
        }
        const n = parseInt(String(v).trim(), 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const tryObj = (obj) => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
        const keys = ["garantiSuresi", "GarantiSuresi", "warrantyMonths", "warrantyDuration", "warranty"];
        for (const k of keys) {
            const u = tryVal(obj[k]);
            if (u !== null) return u;
        }
        return null;
    };
    const fromTop = tryObj(productData);
    if (fromTop !== null) return fromTop;
    const fromMp = tryObj(productData?.masterProduct);
    if (fromMp !== null) return fromMp;
    const attrs = productData?.attributes;
    if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
        const fromAttrs = tryObj(attrs);
        if (fromAttrs !== null) return fromAttrs;
    }
    const mpAttrs = productData?.masterProduct?.attributes;
    if (mpAttrs && typeof mpAttrs === "object" && !Array.isArray(mpAttrs)) {
        return tryObj(mpAttrs);
    }
    return null;
};

/**
 * Trendyol özellik satırları / ürün alanlarından ay cinsinden garanti süresi (HB GarantiSuresi).
 * "Garantisiz" → 0; aksi halde üst düzey alan veya varsayılan kullanılır.
 */
const parseHbWarrantyMonthsFromProduct = (productData) => {
    const parseWarrantyText = (rawVal) => {
        let vRaw = rawVal;
        if (vRaw && typeof vRaw === "object") {
            vRaw = vRaw.name ?? vRaw.value ?? vRaw.text ?? vRaw.attributeValue ?? "";
        }
        const v = String(vRaw ?? "").trim().toLowerCase();
        if (!v) return null;
        if (
            v.includes("garantisiz") ||
            v.includes("garanti yok") ||
            v === "yok" ||
            v === "hayır" ||
            v === "hayir" ||
            v === "none" ||
            v === "no warranty" ||
            v === "0"
        ) {
            return 0;
        }
        const m = v.match(/(\d+)\s*(ay|month|mo\b)/i);
        if (m) return Math.min(120, parseInt(m[1], 10));
        const y = v.match(/(\d+)\s*(yıl|yil|year|yr\b)/i);
        if (y) return Math.min(120, parseInt(y[1], 10) * 12);
        const digits = v.match(/(\d{1,3})/);
        if (digits) {
            const num = parseInt(digits[1], 10);
            if (num >= 0 && num <= 120) return num;
        }
        return null;
    };

    const mp = productData?.masterProduct;
    const directNoWarrantyCandidates = [
        productData?.warrantyStatus,
        productData?.warrantyType,
        productData?.garantiDurumu,
        productData?.garantiTipi,
        productData?.attributes?.warrantyStatus,
        productData?.attributes?.garantiDurumu,
        mp?.warrantyStatus,
        mp?.warrantyType,
        mp?.garantiDurumu,
        mp?.garantiTipi,
        mp?.attributes?.warrantyStatus,
        mp?.attributes?.garantiDurumu
    ];
    for (const c of directNoWarrantyCandidates) {
        const p = parseWarrantyText(c);
        if (p === 0) return 0;
    }

    const rowSources = [];
    const attrs = productData?.attributes;
    if (Array.isArray(attrs)) rowSources.push(attrs);
    if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
        if (Array.isArray(attrs.trendyolAttributeRows)) rowSources.push(attrs.trendyolAttributeRows);
        if (Array.isArray(attrs.trendyolAttributes)) rowSources.push(attrs.trendyolAttributes);
    }
    const mpAttrs = mp?.attributes;
    if (Array.isArray(mpAttrs)) rowSources.push(mpAttrs);
    if (mpAttrs && typeof mpAttrs === "object" && !Array.isArray(mpAttrs)) {
        if (Array.isArray(mpAttrs.trendyolAttributeRows)) rowSources.push(mpAttrs.trendyolAttributeRows);
        if (Array.isArray(mpAttrs.trendyolAttributes)) rowSources.push(mpAttrs.trendyolAttributes);
    }
    for (const key of ["trendyolAttributeRows", "trendyolAttributes"]) {
        if (Array.isArray(productData?.[key])) rowSources.push(productData[key]);
        if (Array.isArray(mp?.[key])) rowSources.push(mp[key]);
    }

    for (const rows of rowSources) {
        for (const row of rows) {
            const n = String(row?.attributeName || row?.name || row?.label || "").toLowerCase();
            if (!n.includes("garanti") && !n.includes("warranty")) continue;
            const parsed = parseWarrantyText(row?.attributeValue ?? row?.value ?? row?.customAttributeValue ?? row?.text);
            if (parsed !== null) return parsed;
        }
    }
    return null;
};

/**
 * Katalog `attributes` birleşimi: `hepsiburadaCatalogAttributes || attributes` tek başına yanlış —
 * boş `{}` truthy olduğu için `attributes` (color/size vb.) tamamen yok sayılırdı.
 * Öncelik: düşük → yüksek — son katman `hepsiburadaCatalogAttributes` (API otomatik renk/varyant id’leri).
 */
const mergeHbCatalogExtraAttributes = (productData) => {
    /** @type {Record<string, unknown>} */
    const out = {};
    const mergeIn = (obj, opts = {}) => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
        const skipFlat = opts.skipMasterFlat === true;
        for (const [k, v] of Object.entries(obj)) {
            if (HB_CATALOG_MERGE_SOURCE_OMIT_KEYS.has(k)) continue;
            if (skipFlat && HB_MASTER_FLAT_OMIT_KEYS.has(k)) continue;
            if (v == null || v === "") continue;
            if (/^marka$/i.test(k) && isPlaceholderBrand(v)) continue;
            out[k] = v;
        }
    };
    const flatAttr =
        productData.attributes && typeof productData.attributes === "object" && !Array.isArray(productData.attributes)
            ? productData.attributes
            : null;
    mergeIn(flatAttr, { skipMasterFlat: true });
    if (productData.hbAttributes && typeof productData.hbAttributes === "object" && !Array.isArray(productData.hbAttributes)) {
        mergeIn(productData.hbAttributes, { skipMasterFlat: false });
    }
    mergeIn(productData.hbCatalogAttributes, { skipMasterFlat: false });
    mergeIn(productData.hepsiburadaCatalogAttributes, { skipMasterFlat: false });
    if (productData.color != null && String(productData.color).trim() !== "" && out.color == null) {
        out.color = productData.color;
    }
    if (productData.size != null && String(productData.size).trim() !== "" && out.size == null) {
        out.size = productData.size;
    }
    return out;
};

/**
 * Resmi "Ürün Bilgisi Gönderme" şeması: kök bir JSON **dizi**si; her eleman
 * { categoryId, merchant, attributes } ve Türkçe alanlar attributes içinde.
 * @see https://developers.hepsiburada.com/hepsiburada/reference/uploadproductviafile
 */
const buildHepsiburadaCatalogImportFileBody = (productData, merchantId, merchantSku, barcodeRaw, categoryId, images, productName) => {
    const brand =
        resolveProductBrandName(productData) ||
        String(productData.brand || productData.marka || "").trim() ||
        "Belirtilmedi";
    const desc = String(
        productData.description || productData.shortDescription || productData.UrunAciklamasi || productName || ""
    ).trim();
    const variantGroupRaw = String(
        productData.variantGroupId || productData.VaryantGroupID || merchantSku
    ).trim();
    const vg = normalizeHbMerchantSku(variantGroupRaw) || merchantSku;
    const warrantyDirect = readHbWarrantyMonthsDirect(productData);
    const warrantyFromRows = parseHbWarrantyMonthsFromProduct(productData);
    /** Kaynak yoksa 24 değil 0 — Trendyol "garantisiz" ile uyum; attributes’taki eski 24 merge ile ezilmez (MERGE_SOURCE_OMIT) */
    const garantiSuresi =
        warrantyFromRows !== null
            ? warrantyFromRows
            : warrantyDirect !== null
              ? warrantyDirect
              : 0;
    const kg = String(productData.kg || productData.desi || productData.weightDesi || "1").trim() || "1";
    const stockNum = parseInt(productData.stock ?? productData.quantity ?? 0, 10) || 0;
    const vatNum = parseInt(productData.vatRate ?? productData.taxVatRate ?? productData.kdv ?? 20, 10);
    const taxVatRate = Number.isFinite(vatNum) && vatNum >= 0 ? String(vatNum) : "20";

    /** @type {Record<string, unknown>} */
    const attrs = {
        merchantSku,
        VaryantGroupID: vg,
        Barcode: String(barcodeRaw || merchantSku).replace(/\s+/g, ""),
        UrunAdi: String(productName).substring(0, 255),
        UrunAciklamasi: desc.substring(0, 30000),
        Marka: brand.substring(0, 100),
        GarantiSuresi: garantiSuresi,
        kg,
        tax_vat_rate: taxVatRate,
        price: formatHbPriceStockString(productData.price ?? productData.salePrice ?? 0),
        stock: String(stockNum)
    };

    const imgList = Array.isArray(images) ? images.slice(0, 5) : [];
    for (let i = 0; i < imgList.length; i++) {
        attrs[`Image${i + 1}`] = String(imgList[i]);
    }

    const extra = mergeHbCatalogExtraAttributes(productData);
    if (extra && typeof extra === "object") {
        for (const [k, v] of Object.entries(extra)) {
            if (HB_CATALOG_MERGE_SOURCE_OMIT_KEYS.has(k)) continue;
            if (v == null || v === "") continue;
            if (/^Image\d+$/i.test(k)) continue;
            if (/^marka$/i.test(k) && isPlaceholderBrand(v)) continue;
            attrs[k] = v;
        }
    }
    if (attrs.Renk != null && attrs.color != null) {
        delete attrs.color;
    }
    const secenekKey = Object.keys(attrs).find((k) => hbNormalizeForMatch(String(k)) === "secenek");
    if (secenekKey && attrs.size != null) {
        delete attrs.size;
    }
    const hasHbEbatLikeKey = Object.keys(attrs).some((k) => {
        const kn = hbNormalizeForMatch(String(k));
        return kn.includes("ebat") || kn.includes("beden") || kn === "boyutlar" || kn === "ebatlar";
    });
    if (hasHbEbatLikeKey && attrs.size != null) {
        delete attrs.size;
    }

    const markaFinal = resolveProductBrandName(productData);
    if (markaFinal) {
        attrs.Marka = markaFinal.substring(0, 100);
    } else if (isPlaceholderBrand(attrs.Marka)) {
        attrs.Marka = "Belirtilmedi";
    }

    attrs.GarantiSuresi = garantiSuresi;

    // Kategori özellik API'sinde tanımlı olmayan anahtarları gönderme — HB "The field X is ignored"
    const catAttrNames = productData._hbCategoryAttributeNamesForImport;
    if (Array.isArray(catAttrNames) && catAttrNames.length > 0) {
        const normAllow = new Set(catAttrNames.map((n) => hbNormalizeForMatch(String(n))));
        for (const k of Object.keys(attrs)) {
            if (HB_FILE_IMPORT_ROOT_KEYS.has(k)) continue;
            if (/^Image\d+$/i.test(k)) continue;
            if (!normAllow.has(hbNormalizeForMatch(k))) {
                delete attrs[k];
            }
        }
    }

    // Boş {} / [] göndermek şema tarafında reddi tetikleyebilir (ör. dimensions: {})
    for (const k of Object.keys(attrs)) {
        if (HB_CATALOG_SKIP_MERGE_KEYS.has(k)) {
            delete attrs[k];
            continue;
        }
        const v = attrs[k];
        if (v != null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) {
            delete attrs[k];
        }
        if (Array.isArray(v) && v.length === 0) {
            delete attrs[k];
        }
        // Trendyol satır dizisi veya benzeri yabancı yapılar HB şemasında yok — sessiz red sebebi olabiliyor
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] != null && ("attributeId" in v[0] || "attributeName" in v[0])) {
            delete attrs[k];
        }
    }

    const row = {
        categoryId: Number(categoryId) || categoryId,
        merchant: String(merchantId),
        attributes: attrs
    };
    return JSON.stringify([row]);
};

/**
 * Katalog gövdesi HB'de “sessiz” kalma ihtimali yüksek alanlar için uyarı (tracking boş + MPOP yok senaryosu).
 */
const logHbCatalogImportHealthWarnings = (attrs, categoryId, merchantSku) => {
    if (!attrs || typeof attrs !== "object") return;
    const marka = String(attrs.Marka || "").trim();
    if (!marka || /^belirtilmedi$/i.test(marka)) {
        logger.warn(
            `[HB KATALOG UYARI] Marka placeholder ("Belirtilmedi") — Hepsiburada çoğu kategoride panelde tanımlı marka ister; ` +
            `ürün kartında marka doldurun veya kategori attribute’larında HB Marka alanını kullanın. merchantSku=${merchantSku} categoryId=${categoryId}`
        );
    }
    const bcRaw = String(attrs.Barcode || "").replace(/\s+/g, "");
    const bcDigits = bcRaw.replace(/\D/g, "");
    if (bcDigits.length > 0 && ![8, 12, 13, 14].includes(bcDigits.length)) {
        logger.warn(
            `[HB KATALOG UYARI] Barkod ${bcDigits.length} hane — tipik GTIN 8/12/13/14 değil. HB reddedebilir. Barcode=${bcRaw} merchantSku=${merchantSku}`
        );
    }
    for (let i = 1; i <= 5; i++) {
        const u = attrs[`Image${i}`];
        if (typeof u !== "string") continue;
        if (/dsmcdn\.com|cdn\.n11|cdn\.ciceksepeti/i.test(u)) {
            logger.warn(
                `[HB KATALOG UYARI] Görsel başka pazaryeri CDN domain’i — HB genelde kendi/üçüncü tarafsız host bekler. Image${i} merchantSku=${merchantSku}`
            );
            break;
        }
    }
    const hasFreeTextVariant = ["color", "size", "renk", "ebat", "beden"].some(
        (k) => attrs[k] != null && String(attrs[k]).trim() !== ""
    );
    if (hasFreeTextVariant) {
        logger.warn(
            `[HB KATALOG UYARI] color/size gibi alanlar serbest metin — bu kategoride HB çoğu zaman Kategori Merkezi’ndeki attributeId/değer kodları ister. ` +
            `Attribute eksik/yanlışsa tracking boş kalabilir. categoryId=${categoryId} merchantSku=${merchantSku}`
        );
    }
};

/** HB import DEBUG: gönderilen products.json önizlemesi (URL’ler kısaltılır) */
const HB_IMPORT_PAYLOAD_LOG_MAX = Math.min(
    32000,
    parseInt(process.env.HEPSIBURADA_IMPORT_PAYLOAD_LOG_MAX || "16000", 10) || 16000
);

const logHbCatalogImportPayloadPreview = (jsonBody, merchantSku, categoryIdTag) => {
    try {
        const arr = JSON.parse(jsonBody);
        const row = Array.isArray(arr) && arr[0] ? arr[0] : null;
        if (!row || typeof row !== "object") {
            logger.info(`[HB KATALOG PAYLOAD] merchantSku=${merchantSku} parse edilemedi — ham(600)=${String(jsonBody).slice(0, 600)}`);
            return;
        }
        const attrs = row.attributes && typeof row.attributes === "object" ? { ...row.attributes } : {};
        for (const k of Object.keys(attrs)) {
            if (/^Image\d+$/i.test(k) && typeof attrs[k] === "string" && attrs[k].length > 120) {
                attrs[k] = `${attrs[k].slice(0, 96)}…(+${attrs[k].length - 96} karakter)`;
            }
        }
        const keys = Object.keys(attrs);
        const bare = {
            categoryId: row.categoryId,
            merchant: row.merchant,
            attributeCount: keys.length,
            attributeKeysSample: keys.slice(0, 40),
            Barcode: attrs.Barcode,
            Marka: attrs.Marka,
            VaryantGroupID: attrs.VaryantGroupID,
            merchantSku: attrs.merchantSku,
            tax_vat_rate: attrs.tax_vat_rate,
            price: attrs.price,
            stock: attrs.stock
        };
        let pretty = JSON.stringify([{ ...row, attributes: attrs }], null, 2);
        if (pretty.length > HB_IMPORT_PAYLOAD_LOG_MAX) {
            pretty = pretty.slice(0, HB_IMPORT_PAYLOAD_LOG_MAX) + `\n…(+${pretty.length - HB_IMPORT_PAYLOAD_LOG_MAX} karakter, tam gövde için HEPSIBURADA_IMPORT_PAYLOAD_LOG_MAX)`;
        }
        logger.info(
            `[HB KATALOG PAYLOAD] merchantSku=${merchantSku} categoryId=${categoryIdTag} özet=${JSON.stringify(bare)}`
        );
        logger.info(`[HB KATALOG PAYLOAD] products.json tam gövde:\n${pretty}`);
    } catch (e) {
        logger.warn(`[HB KATALOG PAYLOAD] önizleme hatası: ${e.message} — ham(800)=${String(jsonBody).slice(0, 800)}`);
    }
};

/**
 * HB tracking/status yanıtında satır dizisini bul (Spring page: content, bazen data/items/results).
 */
const collectHepsiburadaTrackingLines = (root) => {
    if (!root || typeof root !== "object") return [];
    if (Array.isArray(root)) return root;
    const asLineArray = (c) => (Array.isArray(c) ? c : null);
    const candidates = [
        root.data,
        root.content,
        root.items,
        root.results,
        root.list,
        root.products,
        root.result
    ];
    for (const c of candidates) {
        const a = asLineArray(c);
        if (a) return a;
    }
    if (root.result && typeof root.result === "object" && !Array.isArray(root.result)) {
        const r = root.result;
        for (const c of [r.data, r.content, r.items, r.results, r.list, r.products]) {
            const a = asLineArray(c);
            if (a) return a;
        }
    }
    if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
        const inner = root.data;
        let innerArr = inner.data || inner.content || inner.items || inner.results || inner.list || inner.products;
        if (!Array.isArray(innerArr) && innerArr && typeof innerArr === "object") {
            innerArr = innerArr.content || innerArr.data || innerArr.items || innerArr.results;
        }
        if (Array.isArray(innerArr)) return innerArr;
    }
    return [];
};

const pickFirstNonEmpty = (...vals) => {
    for (const v of vals) {
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== "") return s;
    }
    return "";
};

/**
 * Tracking / status yanıtından özet çıkar (importStatus, satır productStatus, validation).
 * @param {object} payload - checkProductStatus axios response.data
 */
const summarizeHepsiburadaTrackingPayload = (payload) => {
    if (!payload || typeof payload !== "object") {
        return {
            importStatus: "",
            productStatus: "",
            messages: [],
            rawSnippet: "",
            lineCount: 0,
            lineHasError: false,
            pageNumberOfElements: 0,
            totalElements: null
        };
    }
    const root = payload;
    const inner = root.data != null && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : null;

    let importStatusRaw = pickFirstNonEmpty(
        inner?.importStatus,
        inner?.ImportStatus,
        root.importStatus,
        root.ImportStatus,
        root.result?.importStatus,
        Array.isArray(root.data) ? null : root.data?.importStatus
    );

    let lines = collectHepsiburadaTrackingLines(root);
    if (lines.length === 0 && Array.isArray(root.data)) {
        lines = root.data;
    }

    // HB OpenAPI (PageResponse): importStatus kökte değil, data[] içindeki ImportStatusDTO satırında
    let lineImportFailed = false;
    let lineImportFirst = "";
    for (const line of lines) {
        if (!line || typeof line !== "object") continue;
        const li = pickFirstNonEmpty(line.importStatus, line.ImportStatus);
        if (li) {
            if (!lineImportFirst) lineImportFirst = li;
            if (String(li).toUpperCase() === "FAILED") lineImportFailed = true;
        }
    }
    if (!importStatusRaw) importStatusRaw = lineImportFirst;
    if (lineImportFailed) importStatusRaw = "FAILED";

    const importStatus = String(importStatusRaw || "").toUpperCase();

    const pageNumberOfElements =
        typeof root.numberOfElements === "number"
            ? root.numberOfElements
            : Array.isArray(root.data)
                ? root.data.length
                : lines.length;
    const totalElements = typeof root.totalElements === "number" ? root.totalElements : null;

    const lineProductStatus = (line) =>
        pickFirstNonEmpty(
            line?.productStatus,
            line?.ProductStatus,
            line?.status,
            line?.Status,
            line?.product?.productStatus
        );

    let productStatus = "";
    for (const line of lines) {
        const ps = lineProductStatus(line);
        if (ps) {
            productStatus = ps;
            break;
        }
    }
    if (!productStatus) {
        productStatus = pickFirstNonEmpty(
            inner?.productStatus,
            root.productStatus,
            lines[0] ? lineProductStatus(lines[0]) : ""
        );
    }

    /** @type {string[]} */
    const messages = [];
    const pushMsgs = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const m of arr) {
            if (!m) continue;
            if (typeof m === "string") messages.push(m);
            else if (m.message) messages.push(String(m.message));
        }
    };

    let lineHasError = false;
    for (const line of lines) {
        if (!line || typeof line !== "object") continue;
        const lps = lineProductStatus(line);
        const up = String(lps || "").toUpperCase();
        if (up && (up.includes("REDDED") || up.includes("FAILED") || up.includes("REJECTED") || up.includes("IPTAL"))) {
            lineHasError = true;
        }
        pushMsgs(line.importMessages);
        if (Array.isArray(line.rejectReasonsMessages)) {
            for (const r of line.rejectReasonsMessages) {
                if (r != null && String(r).trim() !== "") messages.push(String(r));
            }
        }
        if (Array.isArray(line.validationResults)) {
            for (const v of line.validationResults) {
                if (!v) continue;
                const sev = String(v.severity || v.Severity || "").toUpperCase();
                if (sev === "ERROR") lineHasError = true;
                const piece = v.message
                    ? (v.attributeName ? `${v.attributeName}: ${v.message}` : String(v.message))
                    : JSON.stringify(v);
                messages.push(piece);
            }
        }
        if (line.taskDetails) {
            const td = line.taskDetails;
            if (Array.isArray(td)) td.forEach((t) => { if (t?.reason) messages.push(String(t.reason)); });
            else if (td.reason) messages.push(String(td.reason));
        }
    }
    if (lines.length === 0) {
        const first = inner || root;
        pushMsgs(first.importMessages);
        if (Array.isArray(first.validationResults)) {
            for (const v of first.validationResults) {
                if (!v) continue;
                if (String(v.severity || "").toUpperCase() === "ERROR") lineHasError = true;
                messages.push(v.message ? String(v.message) : JSON.stringify(v));
            }
        }
        const rootMsg = pickFirstNonEmpty(root.message, root.Message, root.error, root.errorMessage);
        if (rootMsg) messages.push(String(rootMsg));
    }

    const rawSnippet = JSON.stringify(payload).substring(0, 900);
    return {
        importStatus,
        productStatus,
        messages,
        rawSnippet,
        lineCount: lines.length,
        lineHasError,
        pageNumberOfElements,
        totalElements
    };
};

/**
 * Tracking / status yanıtındaki pazaryeri mesajlarını (reddetme, doğrulama, uyarı) tek tek logla.
 * @param {object} sum — summarizeHepsiburadaTrackingPayload çıktısı
 * @param {{ trackingId?: string, merchantSku?: string, pollIndex?: number, pollMax?: number, phase?: string }} meta
 * @param {"warn"|"error"} level
 */
const logHepsiburadaMarketplaceMessages = (sum, meta = {}, level = "warn") => {
    if (!sum || !Array.isArray(sum.messages)) return;
    const uniq = [...new Set(sum.messages.map((m) => String(m || "").trim()).filter(Boolean))];
    if (!uniq.length) return;
    const phase = meta.phase || "tracking";
    const base =
        `[HB PAZARYERİ] ${phase} trackingId=${meta.trackingId ?? "-"} merchantSku=${meta.merchantSku ?? "-"}` +
        (meta.pollIndex != null ? ` deneme=${meta.pollIndex}/${meta.pollMax ?? "?"}` : "") +
        (sum.importStatus ? ` importStatus=${sum.importStatus}` : "") +
        (sum.productStatus ? ` productStatus=${sum.productStatus}` : "");
    const logFn = level === "error" ? logger.error.bind(logger) : logger.warn.bind(logger);
    for (const msg of uniq) {
        logFn(`${base} — ${msg}`);
    }
};

const stringifyHbMarketplaceBody = (data, maxLen = 2500) => {
    try {
        const s = typeof data === "string" ? data : JSON.stringify(data);
        return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…(+${s.length - maxLen} karakter)`;
    } catch {
        return String(data);
    }
};

/**
 * MPOP satırında reddetme / doğrulama alanlarını logla (ürün bazlı).
 */
const logHepsiburadaMpopItemFeedback = (item, merchantSku) => {
    if (!item || typeof item !== "object") return;
    const parts = [];
    const push = (label, v) => {
        if (v == null || v === "") return;
        if (typeof v === "string") {
            if (v.trim()) parts.push(`${label}=${v.trim()}`);
            return;
        }
        if (Array.isArray(v) && v.length) {
            parts.push(`${label}=${stringifyHbMarketplaceBody(v, 1200)}`);
        } else if (typeof v === "object") {
            parts.push(`${label}=${stringifyHbMarketplaceBody(v, 1200)}`);
        }
    };
    push("rejectReason", item.rejectReason);
    push("rejectReasonsMessages", item.rejectReasonsMessages);
    push("validationResults", item.validationResults);
    push("importMessages", item.importMessages);
    push("taskDetails", item.taskDetails);
    push("message", item.message);
    push("error", item.error);
    push("productStatus", item.productStatus || item.ProductStatus);
    if (!parts.length) {
        logger.warn(
            `[HB PAZARYERİ] MPOP ürün özeti merchantSku=${merchantSku || "-"} — ` +
            stringifyHbMarketplaceBody(item, 1800)
        );
        return;
    }
    logger.warn(`[HB PAZARYERİ] MPOP ürün alanları merchantSku=${merchantSku || "-"} — ${parts.join(" | ")}`);
};

/**
 * Polling: başarı / başarısızlık / devam
 * @param {{ strictListing?: boolean }} [opts] strictListing=true → yalnızca satışa hazır (listing); upload + cron bu modu kullanmalı.
 */
const classifyHepsiburadaTrackingPoll = (payload, opts = {}) => {
    const strictListing = opts.strictListing === true;
    const sum = summarizeHepsiburadaTrackingPayload(payload);
    const innerObj =
        payload?.data != null && typeof payload.data === "object" && !Array.isArray(payload.data)
            ? payload.data
            : null;
    const rootSt = String(
        payload?.status ||
        payload?.state ||
        innerObj?.status ||
        innerObj?.state ||
        ""
    ).toUpperCase();

    if (payload && payload.success === false) {
        const detail =
            sum.messages.filter(Boolean).join(" | ") ||
            payload.message ||
            payload.error ||
            "Hepsiburada API success=false";
        return { kind: "failed", detail, sum };
    }
    if (typeof payload?.code === "number" && payload.code !== 0) {
        const detail = sum.messages.filter(Boolean).join(" | ") || payload.message || `HB code=${payload.code}`;
        return { kind: "failed", detail, sum };
    }

    if (sum.importStatus === "FAILED" || rootSt === "FAILED" || rootSt === "ERROR" || rootSt === "REJECTED" || rootSt === "INVALID") {
        const detail = sum.messages.filter(Boolean).join(" | ") || payload?.message || payload?.error || "HB import başarısız";
        return { kind: "failed", detail, sum };
    }

    if (sum.lineHasError) {
        const detail = sum.messages.filter(Boolean).join(" | ") || "HB satır doğrulama hatası";
        return { kind: "failed", detail, sum };
    }

    const ps = sum.productStatus.toUpperCase();
    if (ps && (ps.includes("REDDED") || ps.includes("GÖREV AÇIL") || ps.includes("GECERSIZ"))) {
        const detail = sum.messages.join(" | ") || sum.productStatus;
        return { kind: "failed", detail, sum };
    }

    // HB: API'de MATCHED çoğu yerde "satışa hazır" (Türkçe tablo ile uyumlu); CREATED tek başına panelde yayındı demek değil.
    const listingReady =
        ps.includes("SATIŞA HAZIR") ||
        ps.includes("SATISA HAZIR") ||
        ps === "MATCHED" ||
        rootSt === "MATCHED";

    const inMpopPipeline =
        ["DONE", "SUCCESS", "COMPLETED", "MATCHED", "CREATED"].includes(rootSt) ||
        sum.importStatus === "SUCCESS" ||
        ["WAITING", "PRE_MATCHED", "MISSING_INFO", "MATCHED_WITH_STAGED"].includes(ps) ||
        ["İNCELENECEK", "INCELENECEK", "EŞLEŞEN", "ESLESEN", "ÖN KATALOG", "ON KATALOG", "KATALOG SÜRECİNDE"].some((s) => ps.includes(s));

    if (strictListing) {
        if (listingReady) {
            return { kind: "success", detail: sum.productStatus || sum.importStatus || rootSt, sum };
        }
        if (inMpopPipeline && !listingReady) {
            return { kind: "processing", detail: sum.productStatus || sum.importStatus || "MPOP_ONAY", sum };
        }
    } else if (listingReady || inMpopPipeline) {
        return { kind: "success", detail: sum.productStatus || sum.importStatus || rootSt, sum };
    }

    if (sum.importStatus === "PROCESSING" || !sum.importStatus || rootSt === "PROCESSING") {
        return { kind: "processing", detail: sum.importStatus || rootSt || "PROCESSING", sum };
    }

    return { kind: "processing", detail: sum.productStatus || rootSt || "bekleniyor", sum };
};

/** GET status/{trackingId} bazen SIT'te sürekli data=[] döner — gerçek boş sayfa mı */
const isHepsiburadaTrackingPayloadEmpty = (payload) => {
    if (!payload || typeof payload !== "object") return true;
    if (payload.success === false) return false;
    const data = payload.data;
    const tot = payload.totalElements;
    const n = payload.numberOfElements;
    if (Array.isArray(data) && data.length > 0) return false;
    if (typeof tot === "number" && tot > 0) return false;
    if (typeof n === "number" && n > 0) return false;
    return true;
};

/**
 * MPOP: statü bazlı liste — tracking cevabı boşken merchantSku ile ürün oluştu mu kontrol (SIT + PROD).
 * @see https://developers.hepsiburada.com/hepsiburada/reference/getproductbymerchantidandstatus
 */
const HB_MPOP_PROBE_STATUSES = [
    "WAITING",
    "CREATED",
    "PRE_MATCHED",
    "MATCHED",
    "MISSING_INFO",
    "MATCHED_WITH_STAGED",
    "REJECTED"
];

const probeMpopProductByMerchantSku = async (merchantId, secretKey, userAgent, merchantSku, hbCredOrUseSit = false) => {
    // NOT: modül-scope arrow'da `arguments` CJS wrapper'a (exports,require,…) aittir; [4] === __dirname olur → yanlışlıkla SIT.
    const epInput =
        hbCredOrUseSit && typeof hbCredOrUseSit === "object" && !Array.isArray(hbCredOrUseSit) &&
        ("merchantId" in hbCredOrUseSit || "secretKey" in hbCredOrUseSit || "useSit" in hbCredOrUseSit)
            ? hbCredOrUseSit
            : { useSit: coerceHepsiburadaUseSit(hbCredOrUseSit) };
    const ep = getEndpoints(epInput);
    const headers = getHeadersForGet(merchantId, secretKey, userAgent);
    const needle =
        normalizeHbMerchantSku(merchantSku) ||
        String(merchantSku || "")
            .toUpperCase()
            .replace(/\s+/g, "");
    if (!needle) {
        return {
            found: false,
            diagnostics: {
                host: String(ep.MPOP || "").replace(/^https:\/\//, ""),
                needle: "",
                totalItemsScanned: 0,
                httpErrors: ["merchantSku boş"]
            }
        };
    }

    const diagnostics = {
        host: String(ep.MPOP || "").replace(/^https:\/\//, ""),
        needle,
        totalItemsScanned: 0,
        httpErrors: []
    };

    for (const productStatus of HB_MPOP_PROBE_STATUSES) {
        try {
            const url =
                `${ep.MPOP}/product/api/products/products-by-merchant-and-status` +
                `?merchantId=${encodeURIComponent(merchantId)}` +
                `&productStatus=${encodeURIComponent(productStatus)}` +
                `&version=1&page=0&size=1000`;
            const resp = await axios.get(url, { headers, timeout: 20000 });
            const body = resp.data;
            const items = Array.isArray(body) ? body : (body?.data || body?.content || body?.products || []);
            if (!Array.isArray(items)) continue;
            diagnostics.totalItemsScanned += items.length;
            for (const item of items) {
                const ms = normalizeHbMerchantSku(item.merchantSku || item.MerchantSku || "");
                if (ms && ms === needle) {
                    const rowPs = String(
                        item.productStatus || item.ProductStatus || productStatus || ""
                    ).toUpperCase();
                    return {
                        found: true,
                        item,
                        listStatusParam: productStatus,
                        productStatus: rowPs || String(productStatus).toUpperCase()
                    };
                }
            }
        } catch (e) {
            const st = e.response?.status;
            diagnostics.httpErrors.push(`${productStatus}:${st ?? e.message}`);
            logger.debug(`[HB MPOP PROBE] ${productStatus}: ${e.message}`);
        }
    }
    return { found: false, diagnostics };
};

/**
 * MPOP prob sonucunu upload yanıtına çevir (tracking boşken).
 */
const buildUploadResultFromMpopProbe = (probe, merchantSku, trackingId, uploadResponseData) => {
    if (!probe || !probe.found) return null;
    const ps = String(probe.productStatus || probe.listStatusParam || "").toUpperCase();
    const hbSku = pickFirstNonEmpty(
        probe.item?.hepsiburadaSku,
        probe.item?.hbSku,
        probe.item?.HepsiburadaSku
    );
    if (ps === "REJECTED" || probe.listStatusParam === "REJECTED") {
        logHepsiburadaMpopItemFeedback(probe.item, merchantSku);
        const reason =
            pickFirstNonEmpty(
                probe.item?.rejectReason,
                probe.item?.taskDetails?.reason,
                probe.item?.productStatus
            ) || "Hepsiburada MPOP: ürün reddedildi (REJECTED)";
        logger.error(`[HB PAZARYERİ] MPOP RED — merchantSku=${merchantSku} trackingId=${trackingId} — ${String(reason).slice(0, 800)}`);
        return {
            success: false,
            productId: merchantSku,
            trackingId,
            error: String(reason).substring(0, 500),
            response: uploadResponseData
        };
    }
    const rawPs = String(probe.item?.productStatus || probe.item?.ProductStatus || "").toUpperCase();
    const listingReady =
        ps === "MATCHED" ||
        rawPs === "MATCHED" ||
        rawPs.includes("SATIŞA HAZIR") ||
        rawPs.includes("SATISA HAZIR");
    const stLabel = probe.item?.productStatus || probe.listStatusParam || ps;
    return {
        success: true,
        pending: false,
        listingReady,
        hbMpopPipelineOk: true,
        hbMpopProductStatus: String(stLabel),
        productId: hbSku || merchantSku,
        hepsiburadaSku: hbSku || undefined,
        trackingId,
        message: listingReady
            ? "Hepsiburada: ürün MPOP'ta MATCHED (satışa hazır) doğrulandı."
            : `Hepsiburada: ürün MPOP'ta göründü (${stLabel}). Gerekirse panelden eşleşen onayı tamamlayın.`,
        response: uploadResponseData,
        trackingSummary: {
            importStatus: "",
            productStatus: String(stLabel),
            messages: [`MPOP products-by-merchant-and-status: ${stLabel}`],
            rawSnippet: "",
            lineCount: 1,
            lineHasError: false,
            pageNumberOfElements: 1,
            totalElements: 1
        }
    };
};

/**
 * MPOP import POST yanıtı — trackingId yoksa dosya genelde reddedilmiştir (OpenAPI: code, success, message).
 */
const validateHbImportPostResponse = (data) => {
    if (!data || typeof data !== "object") {
        return { ok: false, error: "Hepsiburada import yanıtı boş", trackingId: null };
    }
    if (data.success === false) {
        return {
            ok: false,
            error: data.message || data.error || "Hepsiburada import reddedildi (success=false)",
            trackingId: null
        };
    }
    if (typeof data.code === "number" && data.code !== 0) {
        return {
            ok: false,
            error: data.message || `Hepsiburada import hata kodu: ${data.code}`,
            trackingId: null
        };
    }
    const trackingId = pickFirstNonEmpty(
        data.trackingId,
        data.id,
        data.data?.trackingId,
        data.data?.id
    );
    if (!trackingId) {
        return {
            ok: false,
            error:
                data.message ||
                "Import yanıtında trackingId yok — JSON şeması/ kategori zorunlu alanlar / dosya formatı reddedilmiş olabilir (HB 3001-3003).",
            trackingId: null
        };
    }
    return { ok: true, error: null, trackingId: String(trackingId) };
};

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
const uploadProductToHepsiburada = async (credentials, productData) => {
    const hbCreds = normalizeCredentials(credentials);
    const validation = validateCredentials(hbCreds, "katalog ürün yükleme");
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    const { merchantId, secretKey, userAgent } = hbCreds;
    try {
        const productName = productData.name || productData.title || "İsimsiz Ürün";
        let merchantSku = normalizeHbMerchantSku(productData.sku || productData.barcode || "");
        const hbSkuRaw = String(productData.barcode || productData.sku || "").trim();
        if (!merchantSku) merchantSku = normalizeHbMerchantSku(hbSkuRaw);
        if (!merchantSku) {
            return { success: false, error: `Hepsiburada yükleme başarısız: "${productName}" için SKU/barkod eksik` };
        }
        const hepsiburadaSku = hbSkuRaw || merchantSku;
        const hbMapping = Array.isArray(productData.marketplaceMappings)
            ? productData.marketplaceMappings.find((m) => String(m.marketplaceName || "").toLowerCase() === "hepsiburada")
            : null;
        const categoryId =
            productData.categoryId ||
            hbMapping?.categoryId ||
            (typeof productData.category === "number" ? productData.category : null);
        if (!categoryId) {
            return { success: false, error: `Hepsiburada yükleme başarısız: "${productName}" için categoryId zorunlu` };
        }
        const images = Array.isArray(productData.images)
            ? productData.images
                .map((img) => (typeof img === "string" ? img : (img?.url || img?.imageUrl || "")))
                .filter((u) => /^https?:\/\//i.test(String(u || "")))
            : [];
        if (images.length === 0) {
            return { success: false, error: `Hepsiburada yükleme başarısız: "${productName}" için en az 1 görsel gerekli` };
        }

        normalizeHbProductVariantHints(productData);
        const resolvedBrand = resolveProductBrandName(productData);
        if (resolvedBrand) {
            productData.brand = resolvedBrand;
        }

        const resolvedUseSit = await resolveHbUseSitAuto({
            ...hbCreds,
            useSitRaw: credentials?.useSit
        });
        hbCreds.useSit = resolvedUseSit;

        let listableCategoryIds = new Set();
        try {
            listableCategoryIds = await loadHepsiburadaListableCategoryIdSet(
                merchantId,
                secretKey,
                userAgent,
                resolvedUseSit
            );
        } catch (listErr) {
            logger.warn(`[UPLOAD HEPSIBURADA] Listelenebilir kategori seti alınamadı (kontrol atlanıyor): ${listErr.message}`);
        }
        const categoryIdStr = String(categoryId).trim();
        if (listableCategoryIds.size > 0 && !listableCategoryIds.has(categoryIdStr)) {
            return {
                success: false,
                error:
                    `Hepsiburada bu kategori ID’sinde (${categoryIdStr}) katalog yüklemesi kabul etmiyor: ` +
                    `seçilen kategori büyük ihtimalle satıcı için "kullanılabilir" (available) değil veya yaprak değil ` +
                    `(panel/API: "Category is not a available category"). ` +
                    `Kategori Merkezi’nde arama sonuçlarında "Kullanılabilir: Evet" ve yaprak olan bir kategori seçin; ` +
                    `gerekirse bir üst/alt benzer kategori deneyin.`
            };
        }

        try {
            await augmentHbProductDataWithCategoryMandatoryFields(productData, {
                merchantId,
                secretKey,
                userAgent,
                useSit: resolvedUseSit,
                categoryId
            });
        } catch (augErr) {
            logger.warn(`[UPLOAD HEPSIBURADA] Kategori zorunlu alan tamamlama atlandı: ${augErr.message}`);
        }

        const ep = getEndpoints(hbCreds);
        const effSit = isHbSitEndpoints(ep);
        if (Boolean(resolvedUseSit) !== effSit) {
            logger.warn(
                `[UPLOAD HEPSIBURADA] Ortam uyarısı: resolved.useSit=${resolvedUseSit} fakat seçilen MPOP=${ep.MPOP}. ` +
                `Kontrol: HEPSIBURADA_FORCE_PRODUCTION, HEPSIBURADA_USE_SIT (.env / işletim sistemi ortamı).`
            );
        }
        logger.info(
            `[UPLOAD HEPSIBURADA] Ürün yükleniyor — "${productName}" | merchantSku: ${merchantSku} | ` +
            `fiyat: ${productData.price} TL | stok: ${parseInt(productData.stock, 10) || 0} | categoryId: ${categoryId}` +
            (effSit
                ? " | ortam=SIT (yalnızca test MPOP; canlı satıcı panelinde görünmez)"
                : " | ortam=PROD") +
            ` | mpopHost=${String(ep.MPOP || "").replace(/^https:\/\//, "")}`
        );
        const baseHeaders = getHeaders(merchantId, secretKey, userAgent);
        const url = `${ep.MPOP}/product/api/products/import?version=1`;
        const jsonBody = buildHepsiburadaCatalogImportFileBody(
            productData,
            merchantId,
            merchantSku,
            hbSkuRaw,
            categoryId,
            images,
            productName
        );
        try {
            const firstRow = JSON.parse(jsonBody)[0];
            if (firstRow?.attributes) {
                logHbCatalogImportHealthWarnings(firstRow.attributes, categoryId, merchantSku);
            }
        } catch {
            /* ignore */
        }
        logHbCatalogImportPayloadPreview(jsonBody, merchantSku, categoryId);
        let response;
        try {
            const FormDataLib = require("form-data");
            const form = new FormDataLib();
            form.append("file", Buffer.from(jsonBody, "utf8"), {
                filename: "products.json",
                contentType: "application/json"
            });
            response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                    Authorization: baseHeaders.Authorization,
                    "User-Agent": baseHeaders["User-Agent"],
                    Accept: "application/json"
                },
                timeout: 45000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        } catch (formErr) {
            const feBody = formErr.response?.data;
            logger.warn(
                `[UPLOAD HEPSIBURADA] form-data import: ${formErr.response?.status || "-"} ${formErr.message}` +
                (feBody != null ? ` | pazarYanıtı=${stringifyHbMarketplaceBody(feBody, 2500)}` : "")
            );
            const canUseMultipart = typeof FormData !== "undefined" && typeof Blob !== "undefined";
            if (canUseMultipart) {
                try {
                    const form = new FormData();
                    form.append("file", new Blob([jsonBody], { type: "application/json" }), "products.json");
                    response = await axios.post(url, form, {
                        headers: {
                            Authorization: baseHeaders.Authorization,
                            "User-Agent": baseHeaders["User-Agent"],
                            Accept: "application/json"
                        },
                        timeout: 45000
                    });
                } catch (blobErr) {
                    logger.warn(`[UPLOAD HEPSIBURADA] Blob multipart: ${blobErr.message}`);
                }
            }
            if (!response) {
                const rows = JSON.parse(jsonBody);
                response = await axios.post(url, rows, { headers: baseHeaders, timeout: 45000 });
            }
        }

        const respBody = response.data;
        const hbMsg = respBody && typeof respBody === "object"
            ? pickFirstNonEmpty(respBody.message, respBody.Message, respBody.error, "")
            : "";
        logger.info(
            `[UPLOAD HEPSIBURADA] import HTTP ${response.status} — success=${respBody?.success} code=${respBody?.code ?? "-"} ` +
            `msg=${hbMsg ? String(hbMsg).slice(0, 220) + (String(hbMsg).length > 220 ? "…" : "") : "-"}`
        );
        if (hbMsg && String(hbMsg).length > 220) {
            logger.warn(`[HB PAZARYERİ] import tam mesaj — merchantSku=${merchantSku} — ${String(hbMsg)}`);
        }
        const vr = validateHbImportPostResponse(respBody);
        if (!vr.ok) {
            logger.error(
                `[UPLOAD HEPSIBURADA] import reddedildi — ${vr.error} | pazarYanıtı=${stringifyHbMarketplaceBody(respBody, 3000)}`
            );
            return { success: false, error: vr.error, response: respBody };
        }
        const trackingId = vr.trackingId;
        if (trackingId) {
            logger.info(`[UPLOAD HEPSIBURADA] ✅ Katalog kuyruğa alındı — "${productName}" | trackingId: ${trackingId}`);
            // Kısa bekleme: tracking çoğu zaman boş; MPOP prob asıl doğrulama. ~10×4s ≈ 40sn üst sınır.
            const pollAttempts = Math.min(
                14,
                parseInt(process.env.HEPSIBURADA_IMPORT_POLL_MAX || "10", 10) || 10
            );
            const pollDelayMs = Math.min(
                5000,
                Math.max(2500, parseInt(process.env.HEPSIBURADA_IMPORT_POLL_MS || "4000", 10) || 4000)
            );
            let lastPollSum = null;
            let lastHbMarketMsgSig = "";
            /** @type {{ found?: boolean, diagnostics?: object }|null} */
            let lastMpopProbe = null;
            for (let i = 1; i <= pollAttempts; i++) {
                await new Promise((r) => setTimeout(r, pollDelayMs));
                const statusRes = await checkProductStatus(merchantId, secretKey, trackingId, userAgent, hbCreds);
                if (!statusRes.success) continue;
                const poll = classifyHepsiburadaTrackingPoll(statusRes.data, { strictListing: true });
                lastPollSum = poll.sum;
                const el = poll.sum.pageNumberOfElements;
                const tot = poll.sum.totalElements;
                const logDetail =
                    i === 1 ||
                    poll.kind !== "processing" ||
                    i % 4 === 0 ||
                    i === pollAttempts;
                if (poll.sum.messages && poll.sum.messages.length > 0) {
                    const sig = [...new Set(poll.sum.messages.map((m) => String(m || "").trim()))].sort().join("\u0001");
                    const isFail = poll.kind === "failed";
                    if (isFail || sig !== lastHbMarketMsgSig) {
                        if (!isFail) lastHbMarketMsgSig = sig;
                        logHepsiburadaMarketplaceMessages(poll.sum, {
                            trackingId,
                            merchantSku,
                            pollIndex: i,
                            pollMax: pollAttempts,
                            phase: isFail ? "durum-hata" : "durum"
                        }, isFail ? "error" : "warn");
                    }
                }
                if (logDetail) {
                    logger.info(
                        `[UPLOAD HEPSIBURADA] trackingId=${trackingId} poll ${i}/${pollAttempts} kind=${poll.kind} ` +
                        `importStatus=${poll.sum.importStatus || "-"} productStatus=${poll.sum.productStatus || "-"} ` +
                        `lineCount=${poll.sum.lineCount} elements=${typeof el === "number" ? el : "-"}` +
                        `${tot != null ? ` totalElements=${tot}` : ""} ` +
                        `msgSayısı=${poll.sum.messages?.length ?? 0}`
                    );
                }
                if (
                    poll.kind === "processing" &&
                    (el === 0 || poll.sum.lineCount === 0) &&
                    (i === 5 || i === pollAttempts)
                ) {
                    logger.info(
                        `[UPLOAD HEPSIBURADA] trackingId=${trackingId} diagnostic i=${i} raw=${poll.sum.rawSnippet.slice(0, 420)}`
                    );
                }
                if (poll.kind === "success") {
                    return {
                        success: true,
                        pending: false,
                        listingReady: true,
                        productId: merchantSku,
                        trackingId,
                        status: poll.detail,
                        message: "Hepsiburada ürün satışa hazır statüsüne ulaştı (listing doğrulandı).",
                        response: response.data,
                        trackingSummary: poll.sum
                    };
                }
                if (poll.kind === "failed") {
                    logger.error(
                        `[UPLOAD HEPSIBURADA] ❌ Pazaryeri reddi — trackingId=${trackingId} merchantSku=${merchantSku} ` +
                        `özet=${poll.detail} | raw(500)=${poll.sum.rawSnippet.slice(0, 500)}`
                    );
                    return {
                        success: false,
                        productId: merchantSku,
                        trackingId,
                        error: poll.detail,
                        status: poll.sum.importStatus || poll.sum.productStatus,
                        trackingSummary: poll.sum
                    };
                }
                const statusEmpty = isHepsiburadaTrackingPayloadEmpty(statusRes.data);
                const shouldProbeMpop = statusEmpty && i >= 2;
                if (shouldProbeMpop) {
                    const probe = await probeMpopProductByMerchantSku(
                        merchantId,
                        secretKey,
                        userAgent,
                        merchantSku,
                        hbCreds
                    );
                    lastMpopProbe = probe;
                    const mpRes = buildUploadResultFromMpopProbe(probe, merchantSku, trackingId, response.data);
                    if (mpRes) {
                        if (!mpRes.success) {
                            logger.warn(
                                `[UPLOAD HEPSIBURADA] MPOP reddi — merchantSku=${merchantSku} | ${mpRes.error}`
                            );
                            return mpRes;
                        }
                        logger.info(
                            `[UPLOAD HEPSIBURADA] ✅ MPOP doğrulandı (tracking boştu) — merchantSku=${merchantSku} ` +
                            `mpopStatus=${mpRes.hbMpopProductStatus} listingReady=${mpRes.listingReady}`
                        );
                        return mpRes;
                    }
                }
                if (!logDetail) {
                    logger.info(`[UPLOAD HEPSIBURADA] trackingId=${trackingId} işleniyor… (${i}/${pollAttempts})`);
                }
            }
            {
                const probe = await probeMpopProductByMerchantSku(
                    merchantId,
                    secretKey,
                    userAgent,
                    merchantSku,
                    hbCreds
                );
                lastMpopProbe = probe;
                const mpRes = buildUploadResultFromMpopProbe(probe, merchantSku, trackingId, response.data);
                if (mpRes) {
                    if (!mpRes.success) {
                        logger.warn(
                            `[UPLOAD HEPSIBURADA] MPOP reddi (poll sonrası) — merchantSku=${merchantSku} | ${mpRes.error}`
                        );
                        return mpRes;
                    }
                    logger.info(
                        `[UPLOAD HEPSIBURADA] ✅ MPOP doğrulandı (poll sonrası) — merchantSku=${merchantSku} ` +
                        `mpopStatus=${mpRes.hbMpopProductStatus} listingReady=${mpRes.listingReady}`
                    );
                    return mpRes;
                }
            }
            if (lastPollSum) {
                logger.warn(
                    `[UPLOAD HEPSIBURADA] trackingId=${trackingId} poll bitti (pending) — son: importStatus=${lastPollSum.importStatus || "-"} ` +
                    `productStatus=${lastPollSum.productStatus || "-"} lineCount=${lastPollSum.lineCount} ` +
                    `elements=${lastPollSum.pageNumberOfElements}${lastPollSum.totalElements != null ? ` totalElements=${lastPollSum.totalElements}` : ""} ` +
                    `| [HB PENDING CHECK] cron devam edecek | raw(350)=${lastPollSum.rawSnippet.slice(0, 350)}`
                );
            }
            logger.warn(
                "[UPLOAD HEPSIBURADA] Tracking sürekli boş (data:[]) ise HB bazen şema/kategori/zorunlu attribute hatasında işlem satırı oluşturmaz. " +
                "Bu istek için gönderilen gövdeyi logda ara: [HB KATALOG PAYLOAD] — categoryId, Barcode, Marka, kategori özel alanları dokümanla karşılaştırın."
            );
            if (lastMpopProbe && lastMpopProbe.found === false && lastMpopProbe.diagnostics) {
                const d = lastMpopProbe.diagnostics;
                logger.warn(
                    `[UPLOAD HEPSIBURADA] MPOP SKU araması sonuç yok — merchantSku=${merchantSku} needle=${d.needle} host=${d.host} ` +
                    `listelerdeSatır=${d.totalItemsScanned} ` +
                    `${d.httpErrors.length ? `http=${d.httpErrors.join(";")}` : "http=-"}`
                );
            }
            if (effSit) {
                logger.warn(
                    "[UPLOAD HEPSIBURADA] ⚠️ Ortam=SIT (mpop-sit): Bu import canlı Satıcı Paneli’nde " +
                    "(üretim hesabı) görünmez; HB test/SIT paneli veya entegratör test akışı kullanılır. " +
                    "Ürünü canlı mağaza panelinde görmek için Pazaryeri Entegrasyonu’nda «Canlı Ortam» seçip tekrar yükleyin."
                );
            }
            const sitLead = effSit
                ? "SIT test ortamı kullanılıyor: canlı satıcı panelinde bu kayıt görünmez. Canlıda denemek için entegrasyonda Canlı Ortam seçin. "
                : "";
            return {
                success: true,
                pending: true,
                productId: merchantSku,
                trackingId,
                hbSitEnvironment: effSit,
                message:
                    sitLead +
                    "HB katalog/MPOP işlemi belirlenen sürede satışa-hazır statüsüne ulaşmadı (API bazen tracking satırı döndürmez). " +
                    "Sunucu logunda [HB KATALOG PAYLOAD] ile gönderilen products.json kontrol edin — categoryId / zorunlu attribute / barkod formatı uyumsuzsa HB sessizce işlem oluşturmayabilir. " +
                    "Cron ([HB PENDING CHECK]) tracking / durumu güncelleyecek.",
                response: response.data,
                trackingSummary: lastPollSum || undefined
            };
        }
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
 * @param {boolean|object} [hbCredOrUseSit] - normalizeCredentials çıktısı (tercih) veya eski: useSit boolean
 */
const checkProductStatus = async (merchantId, secretKey, trackingId, userAgent, hbCredOrUseSit = false) => {
    // NOT: modül-scope arrow'da `arguments` CJS wrapper'a aittir — [4] string path → !!path === true → hep SIT (403).
    const epInput =
        hbCredOrUseSit && typeof hbCredOrUseSit === "object" && !Array.isArray(hbCredOrUseSit) &&
        ("merchantId" in hbCredOrUseSit || "secretKey" in hbCredOrUseSit || "useSit" in hbCredOrUseSit)
            ? hbCredOrUseSit
            : { useSit: coerceHepsiburadaUseSit(hbCredOrUseSit) };
    const ep = getEndpoints(epInput);
    const effectiveSit = isHbSitEndpoints(ep);
    const hostShort = String(ep.MPOP || "").replace(/^https:\/\//, "");
    const tid = encodeURIComponent(String(trackingId || "").trim());
    const url = `${ep.MPOP}/product/api/products/status/${tid}?version=1&page=0&size=1000`;
    try {
        const headers = getHeadersForGet(merchantId, secretKey, userAgent);
        const response = await axios.get(url, { headers, timeout: 20000 });
        const data = response.data;
        if (data && typeof data === "object" && data.success === false) {
            const msg = pickFirstNonEmpty(data.message, data.error, `HB code=${data.code ?? "?"}`);
            logger.warn(
                `[HB STATUS] success=false trackingId=${trackingId} host=${hostShort} ortam=${effectiveSit ? "SIT" : "PROD"} — ${msg}`
            );
            return { success: false, error: msg, data };
        }
        return { success: true, data };
    } catch (error) {
        const st = error.response?.status;
        const body = error.response?.data;
        let bodyStr = "";
        if (body != null) {
            bodyStr = typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 600);
        }
        logger.error(
            `[HB STATUS] trackingId=${trackingId} host=${hostShort} ortam=${effectiveSit ? "SIT" : "PROD"} ` +
            `http=${st ?? "-"} err=${error.message}${bodyStr ? ` body=${bodyStr}` : ""}`
        );
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
        const headers = getHeadersForGet(merchantId, secretKey, userAgent);
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

/**
 * Ürün merkezi: Hepsiburada rozeti yalnızca gerçekten yayıma yakın / tamamlanmış mapping'lerde.
 * Eski hata: syncStatus=synced iken tracking hâlâ QUEUED → panelde "yüklü" görünüyordu.
 */
/**
 * GET .../listings/merchantid/{merchantId} — mağazada henüz satışa açık listing yokken
 * HB sıkça 404 + code 1005 (ListingNotFoundException) döndürür; MPOP’ta ürün yine de olabilir.
 */
const isHepsiburadaListingUnavailableError = (err) => {
    const st = err?.response?.status;
    const data = err?.response?.data;
    const code = data?.code;
    const msg = String(data?.message || err?.message || "");
    if (st === 404) return true;
    if (code === "1005" || code === 1005) return true;
    if (/ListingNotFound/i.test(msg)) return true;
    return false;
};

/**
 * Ürün senkronu (productSyncService): Listing yokken MPOP detayından satır üretir; fiyat/stok 0 olabilir.
 */
const buildHepsiburadaSyncProductsFromMpopMap = (mpopDetailMap, categoryMap) => {
    const uniqueByMerchantSku = new Map();
    for (const d of mpopDetailMap.values()) {
        const key = String(d?.merchantSku || "").trim();
        if (key && !uniqueByMerchantSku.has(key)) uniqueByMerchantSku.set(key, d);
    }
    return Array.from(uniqueByMerchantSku.values()).map((detail) => {
        const matched = detail?.matchedHbProductInfo?.[0] || {};
        const rawImg = matched?.images?.[0] || detail?.defaultImageUrl || "";
        const imgUrl = rawImg ? rawImg.replace("{size}", "550") : "";
        const rawCatId = detail?.categoryId || matched?.categoryId || "";
        const catName =
            (rawCatId ? categoryMap.get(String(rawCatId)) : "") ||
            detail?.categoryName ||
            matched?.categoryName ||
            "";
        const hbSku = detail?.hepsiburadaSku || detail?.hbSku || "";
        const merchSku = detail?.merchantSku || "";
        return {
            marketplaceProductId: hbSku || merchSku,
            barcode: merchSku,
            sku: merchSku,
            name: detail?.productName || matched?.productName || merchSku || "",
            price: 0,
            listPrice: 0,
            stock: 0,
            category: catName,
            categoryId:
                rawCatId != null && String(rawCatId).trim() !== "" ? String(rawCatId).trim() : "",
            brand: matched?.brand || detail?.brand || "",
            images: imgUrl ? [imgUrl] : [],
            attributes: {}
        };
    });
};

/**
 * Gelişmiş çekim (MarketplaceProduct): normalizeProduct(Hepsiburada) ile uyumlu satır.
 */
const buildHepsiburadaAdvancedPullRowsFromMpopMap = (mpopDetailMap, categoryMap) => {
    const uniqueByMerchantSku = new Map();
    for (const d of mpopDetailMap.values()) {
        const key = String(d?.merchantSku || "").trim();
        if (key && !uniqueByMerchantSku.has(key)) uniqueByMerchantSku.set(key, d);
    }
    return Array.from(uniqueByMerchantSku.values()).map((detail) => {
        const matched = detail?.matchedHbProductInfo?.[0] || {};
        const rawImg =
            matched?.images?.[0] ||
            detail?.defaultImageUrl ||
            detail?.defaultImageURL ||
            detail?.imageUrl ||
            "";
        const imageUrl = rawImg ? rawImg.replace("{size}", "550") : "";
        const rawCatId = detail?.categoryId || matched?.categoryId || "";
        const catName =
            (rawCatId ? categoryMap.get(String(rawCatId)) : "") ||
            detail?.categoryName ||
            matched?.categoryName ||
            "";
        return {
            merchantSku: detail?.merchantSku || "",
            hepsiburadaSku: detail?.hepsiburadaSku || detail?.hbSku || "",
            productName: detail?.productName || matched?.productName || detail?.merchantSku || "",
            name: detail?.productName || matched?.productName || detail?.merchantSku || "",
            categoryId: rawCatId,
            categoryName: catName,
            brand: matched?.brand || detail?.brand || detail?.brandName || "",
            imageUrl,
            description: detail?.description || "",
            matchedHbProductInfo: detail?.matchedHbProductInfo || [],
            price: 0,
            listPrice: 0,
            availableStock: 0
        };
    });
};

/** Eski kayıtlar (hepsiburadaListingReady yok): durum metninden yayında mı tahmin et */
const HB_UI_LIVE_HINT =
    /SATISA\s*HAZIR|SATIŞA\s*HAZIR|\bMATCHED\b|BUYBOX|YAYINDA/i;
const HB_UI_PIPELINE_HINT =
    /QUEUED|PROCESSING|PENDING|IN[_\s]?QUEUE|SUBMITTED|INCELENECEK|İNCELENECEK|ON\s*KATALOG|ÖN\s*KATALOG|KATALOG\s*SÜREC|WAITING|PRE[_\s]?MATCHED|MISSING[_\s]?INFO|MATCHED[_\s]?WITH[_\s]?STAGED|\bCREATED\b|MPOP_PIPELINE|STAGED|EŞLEŞEN|ESLESEN/i;

const legacyHbMappingShowsAsLive = (m) => {
    const st = String(m.hepsiburadaTrackingStatus || "");
    if (HB_UI_LIVE_HINT.test(st)) return true;
    if (HB_UI_PIPELINE_HINT.test(st)) return false;
    const tid = m.hepsiburadaTrackingId;
    if (!tid || !String(tid).trim()) return true;
    return false;
};

const isHepsiburadaMappingListedForUi = (m) => {
    if (!m || typeof m !== "object") return false;
    if (!/^hepsiburada$/i.test(String(m.marketplaceName || ""))) return true;
    const synced = m.syncStatus === "synced" || m.isSynced === true;
    if (!synced) return false;
    if (m.hepsiburadaListingReady === true) return true;
    if (m.hepsiburadaListingReady === false) return false;
    return legacyHbMappingShowsAsLive(m);
};

/**
 * Ürün listesi / detay API: HB için MPOP'ta "İncelenecek" gibi aşamalar yayında (listingReady) değildir
 * ama kullanıcı panelde ürünü görür — mapping'i tamamen gizlememek için.
 */
const isHepsiburadaMappingVisibleForProductUi = (m) => {
    if (!m || typeof m !== "object") return false;
    const synced = m.syncStatus === "synced" || m.isSynced === true;
    if (!/^hepsiburada$/i.test(String(m.marketplaceName || ""))) {
        return synced && isHepsiburadaMappingListedForUi(m);
    }
    if (isHepsiburadaMappingListedForUi(m)) return true;
    const submitted =
        (m.hepsiburadaTrackingId && String(m.hepsiburadaTrackingId).trim() !== "") ||
        (m.marketplaceProductId && String(m.marketplaceProductId).trim() !== "");
    if (
        submitted &&
        (m.syncStatus === "pending" ||
            m.syncStatus === "error" ||
            (synced && m.hepsiburadaListingReady !== true))
    ) {
        return true;
    }
    return false;
};

module.exports = {
    // Sabitler
    HB_ENDPOINTS,
    HB_SIT_ENDPOINTS,
    // Yardımcılar
    normalizeCredentials,
    normalizeHbMerchantSku,
    postInventoryUploadListing,
    getAuthHeader,
    getHeaders,
    getHeadersForGet,
    getEndpoints,
    isHbInternalId,
    isLikelyHbMerchantOrderNumber,
    splitHbDateRange,
    formatHbOmsDateTime,
    isHbCatalogSku,
    resolveHbCargoShortCode,
    HB_OMS_ORDERS_MAX_DAYS,
    HB_OMS_PACKAGES_MAX_DAYS,
    resolveHepsiburadaOrderNumber,
    validateCredentials,
    classifyHepsiburadaTrackingPoll,
    summarizeHepsiburadaTrackingPayload,
    isHepsiburadaMappingListedForUi,
    isHepsiburadaMappingVisibleForProductUi,
    isHepsiburadaListingUnavailableError,
    buildHepsiburadaSyncProductsFromMpopMap,
    buildHepsiburadaAdvancedPullRowsFromMpopMap,
    // Ürün
    fetchHepsiburadaProducts,
    uploadProductToHepsiburada,
    checkProductStatus,
    probeMpopProductByMerchantSku,
    buildUploadResultFromMpopProbe,
    isHepsiburadaTrackingPayloadEmpty,
    // Sipariş
    fetchHepsiburadaOrders,
    // Stok & Fiyat
    updateHepsiburadaStock,
    updateHepsiburadaPrice,
    // Kategori
    fetchHepsiburadaCategories,
    filterHepsiburadaProductCategories,
    isHepsiburadaCampaignOrNonProductCategory,
    normalizeHepsiburadaCategoriesForUi,
    buildHepsiburadaCategoryNameMap,
    fetchHepsiburadaCategoryAttributes,
    unwrapHbCategoryAttributesRoot,
    normalizeHbProductVariantHints,
    // Paket / Kargo
    fetchHepsiburadaPackages
};
