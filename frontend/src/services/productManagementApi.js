import API from "./api";

const BASE = "/product-management";

// ═══════════════════════════════════════════════════════════════
// 📦 ÜRÜN CRUD
// ═══════════════════════════════════════════════════════════════

export const createProduct = async (productData) => {
    const res = await API.post(`${BASE}/products`, productData);
    return res.data;
};

export const getProducts = async (params = {}) => {
    const res = await API.get(`${BASE}/products`, { params });
    return res.data;
};

export const getProductDetail = async (productId) => {
    const res = await API.get(`${BASE}/products/${productId}`);
    return res.data;
};

export const updateProduct = async (productId, updates) => {
    const res = await API.put(`${BASE}/products/${productId}`, updates);
    return res.data;
};

/**
 * Ürün sil (opsiyonel: pazaryerlerinden de kaldır)
 * @param {String} productId
 * @param {Object} options - { deleteFromMarketplaces: Boolean, platforms: [String] }
 */
export const deleteProduct = async (productId, options = {}) => {
    const params = {};
    if (options.deleteFromMarketplaces) params.deleteFromMarketplaces = "true";
    if (options.platforms?.length > 0) params.platforms = options.platforms.join(",");
    const res = await API.delete(`${BASE}/products/${productId}`, { params });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🔄 SENKRONİZASYON & DAĞITIM
// ═══════════════════════════════════════════════════════════════

export const syncFromMarketplace = async (marketplaceId, marketplaceName) => {
    const res = await API.post(`${BASE}/sync/from-marketplace`, { marketplaceId, marketplaceName });
    return res.data;
};

export const distributeProduct = async (productMappingId, targetMarketplaces) => {
    const res = await API.post(`${BASE}/sync/distribute`, { productMappingId, targetMarketplaces });
    return res.data;
};

export const bulkDistribute = async (sourceMarketplace, targetMarketplaces) => {
    const res = await API.post(`${BASE}/sync/bulk-distribute`, { sourceMarketplace, targetMarketplaces });
    return res.data;
};

/**
 * Stok senkronizasyonu — opsiyonel fiyat güncelleme ile
 * @param {String} productMappingId
 * @param {Number} newStock
 * @param {Object} priceUpdate - opsiyonel { salePrice, listPrice }
 */
export const syncStock = async (productMappingId, newStock, priceUpdate = null) => {
    const payload = { productMappingId, newStock };
    if (priceUpdate?.salePrice !== undefined) payload.salePrice = priceUpdate.salePrice;
    if (priceUpdate?.listPrice !== undefined) payload.listPrice = priceUpdate.listPrice;
    const res = await API.post(`${BASE}/sync/stock`, payload);
    return res.data;
};

/**
 * Fiyat senkronizasyonu — tüm veya belirli pazaryerine fiyat güncelle
 * @param {String} productMappingId
 * @param {Number} salePrice
 * @param {Number} listPrice - opsiyonel
 * @param {String} targetMarketplace - opsiyonel (belirtilirse sadece o platforma push)
 */
export const syncPrice = async (productMappingId, salePrice, listPrice = null, targetMarketplace = null) => {
    const payload = { productMappingId, salePrice };
    if (listPrice !== null) payload.listPrice = listPrice;
    if (targetMarketplace) payload.targetMarketplace = targetMarketplace;
    const res = await API.post(`${BASE}/sync/price`, payload);
    return res.data;
};

export const triggerAutoSync = async () => {
    const res = await API.post(`${BASE}/sync/auto`);
    return res.data;
};

/**
 * Baz platform fiyat senkronizasyonu — server-side tüm ürünleri işler
 * @param {String} baseMarketplace - Fiyat kaynağı platform
 * @param {Array} targetMarketplaces - Hedef platformlar
 * @param {Number} margin - Kar marjı (%)
 * @param {String} roundTo - Yuvarlama kuralı (örn: "0.90")
 */
export const basePriceSync = async (baseMarketplace, targetMarketplaces, margin = 0, roundTo = "") => {
    const res = await API.post(`${BASE}/sync/base-price-sync`, { baseMarketplace, targetMarketplaces, margin, roundTo });
    return res.data;
};

/**
 * N11 pending task kontrolü — henüz kesinleşmemiş ürünlerin durumunu kontrol et
 */
export const checkPendingTasks = async () => {
    const res = await API.post(`${BASE}/sync/check-pending`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📋 KATEGORİ YÖNETİMİ
// ═══════════════════════════════════════════════════════════════

export const getCategoryMappings = async () => {
    const res = await API.get(`${BASE}/categories`);
    return res.data;
};

export const upsertCategoryMapping = async (data) => {
    const res = await API.post(`${BASE}/categories`, data);
    return res.data;
};

export const updateProductCategoryMapping = async (productId, data) => {
    const res = await API.put(`${BASE}/products/${productId}/category`, data);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📢 BİLDİRİM & LOG
// ═══════════════════════════════════════════════════════════════

export const getSyncLogs = async (params = {}) => {
    const res = await API.get(`${BASE}/logs`, { params });
    return res.data;
};

export const getUnreadNotifications = async () => {
    const res = await API.get(`${BASE}/notifications`);
    return res.data;
};

export const markNotificationRead = async (notificationId) => {
    const res = await API.put(`${BASE}/notifications/${notificationId}/read`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD
// ═══════════════════════════════════════════════════════════════

export const getProductManagementDashboard = async () => {
    const res = await API.get(`${BASE}/dashboard`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🔄 TOPLU SYNC & KARŞILAŞTIRMA
// ═══════════════════════════════════════════════════════════════

/**
 * Tüm pazaryerlerinden ürünleri arka planda çek
 */
export const syncAllMarketplaces = async () => {
    const res = await API.post(`${BASE}/sync/all`);
    return res.data;
};

/**
 * Ürün karşılaştırma matrisi — hangi ürün hangi pazaryerinde var/yok
 * @param {Object} params - { page, limit, search, missingOnly }
 */
export const getComparisonMatrix = async (params = {}) => {
    const res = await API.get(`${BASE}/comparison`, { params });
    return res.data;
};

/**
 * Seçili ürünleri seçili pazaryerlerine toplu dağıt
 * @param {Array} productIds - Ürün ID'leri
 * @param {Array} targetMarketplaces - Hedef pazaryeri isimleri
 */
export const bulkDistributeSelected = async (productIds, targetMarketplaces) => {
    const res = await API.post(`${BASE}/sync/bulk-distribute-selected`, { productIds, targetMarketplaces });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🟠 N11 ÖZEL SERVİSLER
// ═══════════════════════════════════════════════════════════════

// ── Ürün Servisleri ──────────────────────────────────────────

/**
 * N11 Ürün Yükleme (CreateProduct)
 * @param {Array} products - N11 formatında ürün listesi (max 1000)
 * @param {String} integrator - Entegratör firma ismi
 */
export const n11CreateProduct = async (products, integrator = "LysiaETIC") => {
    const res = await API.post(`${BASE}/n11/products`, { products, integrator });
    return res.data;
};

/**
 * N11 Satıcı Ürünlerini Listele (GetProductQuery)
 * @param {Object} params - { page, size }
 */
export const n11GetProducts = async (params = {}) => {
    const res = await API.get(`${BASE}/n11/products`, { params });
    return res.data;
};

/**
 * N11 Fiyat & Stok Güncelleme (UpdateProductPriceAndStock)
 * @param {Array} updates - [{ stockCode, quantity, salePrice, listPrice }] (max 1000)
 * @param {String} integrator - Entegratör firma ismi
 */
export const n11UpdateStock = async (updates, integrator = "LysiaETIC") => {
    const res = await API.post(`${BASE}/n11/stock-update`, { updates, integrator });
    return res.data;
};

/**
 * N11 Task Detay Sorgulama (TaskDetails)
 * @param {String} taskId - Ürün yükleme/güncelleme task ID'si
 */
export const n11GetTaskDetails = async (taskId) => {
    const res = await API.get(`${BASE}/n11/tasks/${taskId}`);
    return res.data;
};

// ── Kategori Servisleri ──────────────────────────────────────

/**
 * N11 Kategori Ağacı (GetCategories)
 */
export const n11GetCategories = async () => {
    const res = await API.get(`${BASE}/n11/categories`);
    return res.data;
};

/**
 * N11 Kategori Özellikleri (GetCategoryAttributesList)
 * @param {Number} categoryId - En alt kırılım kategori ID'si
 */
export const n11GetCategoryAttributes = async (categoryId) => {
    const res = await API.get(`${BASE}/n11/categories/${categoryId}/attributes`);
    return res.data;
};

// ── Sipariş Servisleri ───────────────────────────────────────

/**
 * N11 Sipariş Listesi (GetShipmentPackages)
 * @param {Object} params - { status, startDate, endDate, page, size }
 */
export const n11GetOrders = async (params = {}) => {
    const res = await API.get(`${BASE}/n11/orders`, { params });
    return res.data;
};

/**
 * N11 Sipariş Kalemlerini Güncelleme (UpdateOrder)
 * Şu an yalnızca "Picking" statüsüne güncelleme desteklenmektedir.
 * @param {Array} lineIds - Onaylanacak sipariş kalemi ID'leri
 * @param {String} status - Hedef durum (varsayılan: "Picking")
 */
export const n11UpdateOrder = async (lineIds, status = "Picking") => {
    const res = await API.put(`${BASE}/n11/orders/update`, { lineIds, status });
    return res.data;
};

/**
 * N11 Paket Bölme (SplitPackages)
 * Siparişler yalnızca Picking statüsünde bölünebilir.
 * @param {Array} splitGroups - [{ orderLineIds: [...] }]
 *   - Aynı pakette: tek grup içinde birden fazla orderLineId
 *   - Farklı pakette: her biri ayrı grup
 */
export const n11SplitPackage = async (splitGroups) => {
    const res = await API.post(`${BASE}/n11/orders/split`, { splitGroups });
    return res.data;
};

/**
 * N11 Miktar Bazlı Paket Bölme & Sipariş Ürün İptali
 * @param {Array} splitPackages - [{ packageDetails: [{ orderLineId, quantities }] }]
 * @param {Array} cancelledItems - [{ cancelReasonId, orderLineId, quantity }] (opsiyonel)
 *   cancelReasonId: 61=Stok Tükendi, 62=Kusurlu, 63=Hatalı Fiyat, 64=Mücbir Sebep, 65=Diğer
 */
export const n11SplitPackageByQuantity = async (splitPackages, cancelledItems = []) => {
    const res = await API.post(`${BASE}/n11/orders/split-by-quantity`, {
        splitPackages,
        cancelledItems
    });
    return res.data;
};

/**
 * N11 Sipariş Kalemi İşçilik Bedeli Ekleme
 * @param {Array} laborCostDetails - [{ orderLineId, totalLaborCostExcludingVAT, laborVatRate }]
 *   laborVatRate: 0, 1, 10, 20 (varsayılan: 20)
 */
export const n11AddLaborCost = async (laborCostDetails) => {
    const res = await API.put(`${BASE}/n11/orders/labor-costs`, { laborCostDetails });
    return res.data;
};

// ── N11 Debug ────────────────────────────────────────────────

/**
 * N11 Ham API Yanıtını Göster (Debug)
 */
export const n11DebugRawProducts = async () => {
    const res = await API.get(`${BASE}/n11/debug/raw-products`);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🗂️ OTOMATİK KATEGORİ EŞLEŞTİRME MERKEZİ
// ═══════════════════════════════════════════════════════════════

/**
 * Tüm platformlardan kategori ağaçlarını çek
 * @param {Object} params - { search }
 */
export const getAllPlatformCategories = async (params = {}) => {
    const res = await API.get(`${BASE}/categories/all-platforms`, { params });
    return res.data;
};

/**
 * Otomatik kategori eşleştirme — kaynak kategori adına göre tüm platformlarda eşleşme bul
 * @param {string} sourceCategoryName - Kaynak kategori adı
 * @param {string} sourcePlatform - Kaynak platform (opsiyonel, atlanacak)
 */
export const autoCategoryMatch = async (sourceCategoryName, sourcePlatform = null) => {
    const res = await API.post(`${BASE}/categories/auto-match`, { sourceCategoryName, sourcePlatform });
    return res.data;
};

/**
 * Toplu otomatik kategori eşleştirme — tüm eşleştirilmemiş kategorileri otomatik eşleştir
 */
export const autoCategoryMatchAll = async () => {
    const res = await API.post(`${BASE}/categories/auto-match-all`);
    return res.data;
};

/**
 * Kategori eşleştirmesini manuel kaydet
 */
export const saveCategoryMappingManual = async (data) => {
    const res = await API.post(`${BASE}/categories/save-mapping`, data);
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 🚀 ÜRÜN YÜKLE & DAĞIT
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün oluştur ve platformlara dağıt (tek adımda)
 */
export const createAndDistribute = async (productData) => {
    const res = await API.post(`${BASE}/products/create-and-distribute`, productData);
    return res.data;
};

/**
 * Barkod ve SKU önerisi al
 * @param {string} productName - Ürün adı
 * @param {string} brand - Marka (opsiyonel)
 * @param {string} category - Kategori (opsiyonel)
 */
export const suggestCodes = async (productName, brand = "", category = "") => {
    const res = await API.post(`${BASE}/products/suggest-codes`, { productName, brand, category });
    return res.data;
};

/**
 * AI ile ürün açıklaması üret
 * @param {Object} data - { productName, category?, brand?, price?, attributes?, tone? }
 */
export const generateDescription = async (data) => {
    const res = await API.post(`${BASE}/products/generate-description`, data);
    return res.data;
};

/**
 * Hiyerarşik kategori ağacı getir
 * @param {string} platform - Platform adı (Trendyol, N11)
 * @param {string} parentId - Üst kategori ID (0 = kök)
 * @param {string} search - Arama (opsiyonel)
 */
export const getCategoryTree = async (platform, parentId = "0", search = "") => {
    const params = { platform, parentId };
    if (search) params.search = search;
    const res = await API.get(`${BASE}/categories/tree`, { params });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📋 TOPLU ÜRÜN YÖNETİMİ (BULK OPERATIONS)
// ═══════════════════════════════════════════════════════════════

/**
 * Toplu fiyat güncelleme
 * @param {Array} productIds - Ürün ID'leri
 * @param {String} mode - "fixed"|"percent"|"round"
 * @param {Number} value - Sabit fiyat veya yüzde
 * @param {Object} options - { roundTo, applyToListPrice, syncToMarketplaces }
 */
export const bulkUpdatePrices = async (productIds, mode, value, options = {}) => {
    const res = await API.post(`${BASE}/bulk/update-prices`, {
        productIds, mode, value,
        roundTo: options.roundTo || "",
        applyToListPrice: options.applyToListPrice !== false,
        syncToMarketplaces: options.syncToMarketplaces || false
    });
    return res.data;
};

/**
 * Toplu stok güncelleme
 * @param {Array} productIds - Ürün ID'leri
 * @param {String} mode - "fixed"|"increase"|"decrease"
 * @param {Number} value - Stok değeri
 * @param {Boolean} syncToMarketplaces - Platformlara push
 */
export const bulkUpdateStocks = async (productIds, mode, value, syncToMarketplaces = false) => {
    const res = await API.post(`${BASE}/bulk/update-stocks`, {
        productIds, mode, value, syncToMarketplaces
    });
    return res.data;
};

/**
 * Toplu ürün silme (opsiyonel: pazaryerlerinden de kaldır)
 * @param {Array} productIds - Silinecek ürün ID'leri
 * @param {Object} options - { deleteFromMarketplaces: Boolean, platforms: [String] }
 */
export const bulkDeleteProducts = async (productIds, options = {}) => {
    const body = { productIds };
    if (options.deleteFromMarketplaces) body.deleteFromMarketplaces = true;
    if (options.platforms?.length > 0) body.platforms = options.platforms;
    const res = await API.post(`${BASE}/bulk/delete`, body);
    return res.data;
};

/**
 * Toplu alan güncelleme (kategori, marka, güvenlik stoğu vb.)
 * @param {Array} productIds - Ürün ID'leri
 * @param {Object} fields - { category?, brand?, safetyStock?, lowStockThreshold? }
 */
export const bulkUpdateFields = async (productIds, fields) => {
    const res = await API.post(`${BASE}/bulk/update-fields`, { productIds, fields });
    return res.data;
};

// ═══════════════════════════════════════════════════════════════
// 📥 EXCEL / CSV IMPORT & EXPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Excel şablonunu indir (blob olarak döner)
 */
export const downloadTemplate = async () => {
    const res = await API.get(`${BASE}/import/template`, { responseType: "blob" });
    return res;
};

/**
 * Excel/CSV dosyasını önizle (kaydetmez)
 * @param {File} file - Yüklenecek dosya
 */
export const previewImport = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await API.post(`${BASE}/import/preview`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
};

/**
 * Excel/CSV dosyasını içe aktar ve kaydet
 * @param {File} file - Yüklenecek dosya
 * @param {Object} options - { skipErrors, updateExisting }
 */
export const executeImport = async (file, options = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("skipErrors",     options.skipErrors     !== undefined ? String(options.skipErrors)     : "true");
    formData.append("updateExisting", options.updateExisting !== undefined ? String(options.updateExisting) : "true");
    const res = await API.post(`${BASE}/import/execute`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
};

/**
 * Ürünleri Excel olarak dışa aktar (blob olarak döner)
 * @param {Object} params - { search, category, marketplace, stockStatus }
 */
export const exportProducts = async (params = {}) => {
    const res = await API.get(`${BASE}/export`, { params, responseType: "blob" });
    return res;
};
