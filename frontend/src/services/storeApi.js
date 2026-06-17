import API from "./api";
import { getActiveEcSite } from "../utils/ecStoreContext";

const BASE = "/store";

function withEcSite(params = {}) {
    const site = getActiveEcSite();
    if (site?.id) return { ...params, siteId: site.id };
    return params;
}

export const fetchStore = async () => {
    const res = await API.get(BASE, { params: withEcSite() });
    return res.data;
};

export const createStore = async (body) => {
    const res = await API.post(BASE, body);
    return res.data;
};

export const updateStore = async (body) => {
    const res = await API.patch(BASE, body);
    return res.data;
};

export const verifyStoreDomain = async () => {
    const res = await API.post(`${BASE}/domain/verify`);
    return res.data;
};

export const disconnectStoreDomain = async () => {
    const res = await API.delete(`${BASE}/domain`);
    return res.data;
};

export const publishStore = async () => {
    const res = await API.post(`${BASE}/publish`);
    return res.data;
};

export const unpublishStore = async () => {
    const res = await API.post(`${BASE}/unpublish`);
    return res.data;
};

export const fetchStoreStats = async () => {
    const res = await API.get(`${BASE}/stats`);
    return res.data;
};

export const fetchStoreDashboard = async (params = {}) => {
    const res = await API.get(`${BASE}/dashboard`, { params: withEcSite(params) });
    return res.data;
};

export const fetchSellerVerification = async () => {
    const res = await API.get(`${BASE}/seller-verification`);
    return res.data;
};

export const saveSellerVerification = async (body) => {
    const res = await API.put(`${BASE}/seller-verification`, body);
    return res.data;
};

export const uploadSellerDocument = async (docType, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await API.post(`${BASE}/seller-verification/documents/${docType}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
};

export const deleteSellerDocument = async (docType) => {
    const res = await API.delete(`${BASE}/seller-verification/documents/${docType}`);
    return res.data;
};

export const fetchStorePayments = async () => {
    const res = await API.get(`${BASE}/payments`);
    return res.data;
};

export const saveStorePayments = async (body) => {
    const res = await API.put(`${BASE}/payments`, body);
    return res.data;
};

export const syncStoreProducts = async () => {
    const res = await API.post(`${BASE}/products/sync`);
    return res.data;
};

export const fetchStoreProducts = async () => {
    const res = await API.get(`${BASE}/products`);
    return res.data;
};

export const fetchStorePurchases = async () => {
    const res = await API.get(`${BASE}/purchases`);
    return res.data;
};

export const fetchStorePurchase = async (id) => {
    const res = await API.get(`${BASE}/purchases/${id}`);
    return res.data;
};

export const createStorePurchase = async (body) => {
    const res = await API.post(`${BASE}/purchases`, body);
    return res.data;
};

export const patchStorePurchase = async (id, body) => {
    const res = await API.patch(`${BASE}/purchases/${id}`, body);
    return res.data;
};

export const fetchStoreTransfers = async () => {
    const res = await API.get(`${BASE}/transfers`);
    return res.data;
};

export const fetchStoreTransfer = async (id) => {
    const res = await API.get(`${BASE}/transfers/${id}`);
    return res.data;
};

export const createStoreTransfer = async (body) => {
    const res = await API.post(`${BASE}/transfers`, body);
    return res.data;
};

export const patchStoreTransfer = async (id, body) => {
    const res = await API.patch(`${BASE}/transfers/${id}`, body);
    return res.data;
};

export const fetchStoreStockCounts = async () => {
    const res = await API.get(`${BASE}/stock-counts`);
    return res.data;
};

export const fetchStoreStockCount = async (id) => {
    const res = await API.get(`${BASE}/stock-counts/${id}`);
    return res.data;
};

export const createStoreStockCount = async (body) => {
    const res = await API.post(`${BASE}/stock-counts`, body);
    return res.data;
};

export const patchStoreStockCount = async (id, body) => {
    const res = await API.patch(`${BASE}/stock-counts/${id}`, body);
    return res.data;
};

export const deleteStoreStockCount = async (id) => {
    const res = await API.delete(`${BASE}/stock-counts/${id}`);
    return res.data;
};

export const bulkDeleteStoreStockCounts = async (ids) => {
    const res = await API.post(`${BASE}/stock-counts/bulk-delete`, { ids });
    return res.data;
};

/** @returns {{ blob: Blob, filename: string }} */
export const exportStoreProducts = async ({ format = "csv", scope = "products" } = {}) => {
    const res = await API.get(`${BASE}/products/export`, {
        params: { format, scope },
        responseType: "blob",
    });
    const disposition = res.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `export.${format === "xls" ? "xlsx" : "csv"}`;
    return { blob: res.data, filename };
};

export const importStoreProducts = async (file, scope = "products") => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await API.post(`${BASE}/products/import`, fd, {
        params: { scope },
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
};

export const fetchStoreProduct = async (id) => {
    const res = await API.get(`${BASE}/products/${id}`);
    return res.data;
};

export const createStoreProduct = async (body) => {
    const res = await API.post(`${BASE}/products`, body);
    return res.data;
};

export const patchStoreProduct = async (id, body) => {
    const res = await API.patch(`${BASE}/products/${id}`, body);
    return res.data;
};

export const deleteStoreProduct = async (id) => {
    const res = await API.delete(`${BASE}/products/${id}`);
    return res.data;
};

export const bulkUpdateStoreProducts = async (body) => {
    const res = await API.patch(`${BASE}/products/bulk`, body);
    return res.data;
};

export const bulkDeleteStoreProducts = async (body) => {
    const res = await API.post(`${BASE}/products/bulk-delete`, body);
    return res.data;
};

export const fetchStoreCustomFields = async () => {
    const res = await API.get(`${BASE}/custom-fields`);
    return res.data;
};

export const createStoreCustomField = async (body) => {
    const res = await API.post(`${BASE}/custom-fields`, body);
    return res.data;
};

export const updateStoreCustomField = async (id, body) => {
    const res = await API.patch(`${BASE}/custom-fields/${id}`, body);
    return res.data;
};

export const deleteStoreCustomField = async (id) => {
    const res = await API.delete(`${BASE}/custom-fields/${id}`);
    return res.data;
};

export const fetchGoogleProductCategories = async (params = {}) => {
    const res = await API.get(`${BASE}/google-product-categories`, { params });
    return res.data;
};

export const fetchStoreCategories = async () => {
    const res = await API.get(`${BASE}/categories`);
    return res.data;
};

export const fetchStoreCategory = async (id) => {
    const res = await API.get(`${BASE}/categories/${id}`);
    return res.data;
};

export const createStoreCategory = async (body) => {
    const res = await API.post(`${BASE}/categories`, body);
    return res.data;
};

export const updateStoreCategory = async (id, body) => {
    const res = await API.patch(`${BASE}/categories/${id}`, body);
    return res.data;
};

export const deleteStoreCategory = async (id) => {
    const res = await API.delete(`${BASE}/categories/${id}`);
    return res.data;
};

export const bulkDeleteStoreCategories = async (ids) => {
    const res = await API.post(`${BASE}/categories/bulk-delete`, { ids });
    return res.data;
};

/** @returns {{ blob: Blob, filename: string }} */
export const exportStoreCategories = async () => {
    const res = await API.get(`${BASE}/categories/export`, { responseType: "blob" });
    const disposition = res.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return { blob: res.data, filename: match?.[1] || "kategoriler.csv" };
};

export const fetchStoreBrands = async () => {
    const res = await API.get(`${BASE}/brands`);
    return res.data;
};

export const fetchStoreBrand = async (id) => {
    const res = await API.get(`${BASE}/brands/${id}`);
    return res.data;
};

export const createStoreBrand = async (body) => {
    const res = await API.post(`${BASE}/brands`, body);
    return res.data;
};

export const updateStoreBrand = async (id, body) => {
    const res = await API.patch(`${BASE}/brands/${id}`, body);
    return res.data;
};

export const deleteStoreBrand = async (id) => {
    const res = await API.delete(`${BASE}/brands/${id}`);
    return res.data;
};

export const bulkDeleteStoreBrands = async (ids) => {
    const res = await API.post(`${BASE}/brands/bulk-delete`, { ids });
    return res.data;
};

/** @returns {{ blob: Blob, filename: string }} */
export const exportStoreBrands = async () => {
    const res = await API.get(`${BASE}/brands/export`, { responseType: "blob" });
    const disposition = res.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return { blob: res.data, filename: match?.[1] || "markalar.csv" };
};

export const fetchStoreVariantTypes = async () => {
    const res = await API.get(`${BASE}/variant-types`);
    return res.data;
};

export const fetchStoreVariantType = async (id) => {
    const res = await API.get(`${BASE}/variant-types/${id}`);
    return res.data;
};

export const createStoreVariantType = async (body) => {
    const res = await API.post(`${BASE}/variant-types`, body);
    return res.data;
};

export const updateStoreVariantType = async (id, body) => {
    const res = await API.patch(`${BASE}/variant-types/${id}`, body);
    return res.data;
};

export const deleteStoreVariantType = async (id) => {
    const res = await API.delete(`${BASE}/variant-types/${id}`);
    return res.data;
};

/** @returns {{ blob: Blob, filename: string }} */
export const exportStoreVariantTypes = async () => {
    const res = await API.get(`${BASE}/variant-types/export`, { responseType: "blob" });
    const disposition = res.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return { blob: res.data, filename: match?.[1] || "varyant-turleri.csv" };
};

export const fetchStoreProductGroups = async () => {
    const res = await API.get(`${BASE}/product-groups`);
    return res.data;
};

export const fetchStoreProductGroup = async (id) => {
    const res = await API.get(`${BASE}/product-groups/${id}`);
    return res.data;
};

export const createStoreProductGroup = async (body) => {
    const res = await API.post(`${BASE}/product-groups`, body);
    return res.data;
};

export const updateStoreProductGroup = async (id, body) => {
    const res = await API.patch(`${BASE}/product-groups/${id}`, body);
    return res.data;
};

export const deleteStoreProductGroup = async (id) => {
    const res = await API.delete(`${BASE}/product-groups/${id}`);
    return res.data;
};

export const fetchStoreSuppliers = async () => {
    const res = await API.get(`${BASE}/suppliers`);
    return res.data;
};

export const fetchStoreSupplier = async (id) => {
    const res = await API.get(`${BASE}/suppliers/${id}`);
    return res.data;
};

export const createStoreSupplier = async (body) => {
    const res = await API.post(`${BASE}/suppliers`, body);
    return res.data;
};

export const updateStoreSupplier = async (id, body) => {
    const res = await API.patch(`${BASE}/suppliers/${id}`, body);
    return res.data;
};

export const deleteStoreSupplier = async (id) => {
    const res = await API.delete(`${BASE}/suppliers/${id}`);
    return res.data;
};

export const fetchStoreTags = async () => {
    const res = await API.get(`${BASE}/tags`);
    return res.data;
};

export const fetchStoreTag = async (id) => {
    const res = await API.get(`${BASE}/tags/${id}`);
    return res.data;
};

export const createStoreTag = async (body) => {
    const res = await API.post(`${BASE}/tags`, body);
    return res.data;
};

export const updateStoreTag = async (id, body) => {
    const res = await API.patch(`${BASE}/tags/${id}`, body);
    return res.data;
};

export const deleteStoreTag = async (id) => {
    const res = await API.delete(`${BASE}/tags/${id}`);
    return res.data;
};

export const fetchStoreUnits = async () => {
    const res = await API.get(`${BASE}/units`);
    return res.data;
};

export const fetchStoreUnit = async (id) => {
    const res = await API.get(`${BASE}/units/${id}`);
    return res.data;
};

export const createStoreUnit = async (body) => {
    const res = await API.post(`${BASE}/units`, body);
    return res.data;
};

export const updateStoreUnit = async (id, body) => {
    const res = await API.patch(`${BASE}/units/${id}`, body);
    return res.data;
};

export const deleteStoreUnit = async (id) => {
    const res = await API.delete(`${BASE}/units/${id}`);
    return res.data;
};

export const fetchStoreCartLinks = async () => {
    const res = await API.get(`${BASE}/cart-links`);
    return res.data;
};

export const fetchStoreCartLinkSalesChannels = async () => {
    const res = await API.get(`${BASE}/cart-links/sales-channels`);
    return res.data;
};

export const fetchStoreCartLink = async (id) => {
    const res = await API.get(`${BASE}/cart-links/${id}`);
    return res.data;
};

export const createStoreCartLink = async (body) => {
    const res = await API.post(`${BASE}/cart-links`, body);
    return res.data;
};

export const updateStoreCartLink = async (id, body) => {
    const res = await API.patch(`${BASE}/cart-links/${id}`, body);
    return res.data;
};

export const deleteStoreCartLink = async (id) => {
    const res = await API.delete(`${BASE}/cart-links/${id}`);
    return res.data;
};

export const fetchStorePersonalizations = async () => {
    const res = await API.get(`${BASE}/personalizations`);
    return res.data;
};

export const fetchStorePersonalization = async (id) => {
    const res = await API.get(`${BASE}/personalizations/${id}`);
    return res.data;
};

export const createStorePersonalization = async (body) => {
    const res = await API.post(`${BASE}/personalizations`, body);
    return res.data;
};

export const updateStorePersonalization = async (id, body) => {
    const res = await API.patch(`${BASE}/personalizations/${id}`, body);
    return res.data;
};

export const deleteStorePersonalization = async (id) => {
    const res = await API.delete(`${BASE}/personalizations/${id}`);
    return res.data;
};

export const fetchStoreOrders = async (params = {}) => {
    const res = await API.get(`${BASE}/orders`, { params });
    return res.data;
};

export const fetchStoreOrder = async (id) => {
    const res = await API.get(`${BASE}/orders/${id}`);
    return res.data;
};

export const createStoreOrder = async (body) => {
    const res = await API.post(`${BASE}/orders`, body);
    return res.data;
};

export const patchStoreOrder = async (id, body) => {
    const res = await API.patch(`${BASE}/orders/${id}`, body);
    return res.data;
};

export const bulkUpdateStoreOrderLabels = async (body) => {
    const res = await API.post(`${BASE}/orders/bulk-labels`, body);
    return res.data;
};

export const fetchStoreOrderLabels = async () => {
    const res = await API.get(`${BASE}/order-labels`);
    return res.data;
};

export const createStoreOrderLabel = async (name) => {
    const res = await API.post(`${BASE}/order-labels`, { name });
    return res.data;
};

export const deleteStoreOrderLabel = async (id) => {
    const res = await API.delete(`${BASE}/order-labels/${id}`);
    return res.data;
};

export const fetchStoreGiftCards = async (params = {}) => {
    const res = await API.get(`${BASE}/gift-cards`, { params });
    return res.data;
};

export const fetchStoreGiftCard = async (id) => {
    const res = await API.get(`${BASE}/gift-cards/${id}`);
    return res.data;
};

export const suggestStoreGiftCardCode = async () => {
    const res = await API.get(`${BASE}/gift-cards/suggest-code`);
    return res.data;
};

export const createStoreGiftCard = async (body) => {
    const res = await API.post(`${BASE}/gift-cards`, body);
    return res.data;
};

export const updateStoreGiftCard = async (id, body) => {
    const res = await API.patch(`${BASE}/gift-cards/${id}`, body);
    return res.data;
};

export const deleteStoreGiftCard = async (id) => {
    const res = await API.delete(`${BASE}/gift-cards/${id}`);
    return res.data;
};

export const fetchStoreCustomers = async (params = {}) => {
    const res = await API.get(`${BASE}/customers`, { params });
    return res.data;
};

export const fetchStoreCustomer = async (id) => {
    const res = await API.get(`${BASE}/customers/${id}`);
    return res.data;
};

export const createStoreCustomer = async (body) => {
    const res = await API.post(`${BASE}/customers`, body);
    return res.data;
};

export const updateStoreCustomer = async (id, body) => {
    const res = await API.patch(`${BASE}/customers/${id}`, body);
    return res.data;
};

export const deleteStoreCustomer = async (id) => {
    const res = await API.delete(`${BASE}/customers/${id}`);
    return res.data;
};

export const fetchStoreCustomerGroups = async () => {
    const res = await API.get(`${BASE}/customer-groups`);
    return res.data;
};

export const fetchStoreCustomerGroup = async (id) => {
    const res = await API.get(`${BASE}/customer-groups/${id}`);
    return res.data;
};

export const createStoreCustomerGroup = async (body) => {
    const res = await API.post(`${BASE}/customer-groups`, body);
    return res.data;
};

export const updateStoreCustomerGroup = async (id, body) => {
    const res = await API.patch(`${BASE}/customer-groups/${id}`, body);
    return res.data;
};

export const deleteStoreCustomerGroup = async (id) => {
    const res = await API.delete(`${BASE}/customer-groups/${id}`);
    return res.data;
};

export const fetchStoreCampaigns = async (params = {}) => {
    const res = await API.get(`${BASE}/campaigns`, { params });
    return res.data;
};

export const fetchStoreCampaign = async (id) => {
    const res = await API.get(`${BASE}/campaigns/${id}`);
    return res.data;
};

export const createStoreCampaign = async (body) => {
    const res = await API.post(`${BASE}/campaigns`, body);
    return res.data;
};

export const updateStoreCampaign = async (id, body) => {
    const res = await API.patch(`${BASE}/campaigns/${id}`, body);
    return res.data;
};

export const deleteStoreCampaign = async (id) => {
    const res = await API.delete(`${BASE}/campaigns/${id}`);
    return res.data;
};

export const fetchInboxSettings = async () => {
    const res = await API.get(`${BASE}/inbox/settings`);
    return res.data;
};

export const patchInboxSettings = async (body) => {
    const res = await API.patch(`${BASE}/inbox/settings`, body);
    return res.data;
};

export const connectInboxChannel = async (channelId, body = {}) => {
    const res = await API.post(`${BASE}/inbox/channels/${channelId}/connect`, body);
    return res.data;
};

export const disconnectInboxChannel = async (channelId) => {
    const res = await API.post(`${BASE}/inbox/channels/${channelId}/disconnect`);
    return res.data;
};

export const startInstagramInboxOAuth = async (channel = "instagram") => {
    const res = await API.get(`${BASE}/inbox/instagram/oauth/start`, { params: { channel } });
    return res.data;
};

export const startGoogleInboxOAuth = async () => {
    const res = await API.get(`${BASE}/inbox/google/oauth/start`);
    return res.data;
};

export const fetchInboxConversations = async () => {
    const res = await API.get(`${BASE}/inbox/conversations`);
    return res.data;
};

export const fetchInboxMessages = async (conversationId) => {
    const res = await API.get(`${BASE}/inbox/conversations/${conversationId}/messages`);
    return res.data;
};

export const sendInboxMessage = async (conversationId, text) => {
    const res = await API.post(`${BASE}/inbox/conversations/${conversationId}/messages`, { text });
    return res.data;
};

export const syncInbox = async () => {
    const res = await API.post(`${BASE}/inbox/sync`);
    return res.data;
};

// ——— Public (mağaza vitrin) ———
const PUB = "/public/store";

export const resolvePublicStore = async (slug) => {
    const res = await API.get(`${PUB}/resolve`, { params: { slug } });
    return res.data;
};

export const fetchPublicProducts = async (slug) => {
    const res = await API.get(`${PUB}/${slug}/products`);
    return res.data;
};

export const fetchPublicProduct = async (slug, productSlug) => {
    const res = await API.get(`${PUB}/${slug}/products/${productSlug}`);
    return res.data;
};

export const fetchPublicCart = async (slug) => {
    const res = await API.get(`${PUB}/${slug}/cart`, { withCredentials: true });
    return res.data;
};

export const addToPublicCart = async (slug, storeProductId, quantity = 1) => {
    const res = await API.post(
        `${PUB}/${slug}/cart/items`,
        { storeProductId, quantity },
        { withCredentials: true }
    );
    return res.data;
};

export const updatePublicCartItem = async (slug, productId, quantity) => {
    const res = await API.patch(`${PUB}/${slug}/cart/items/${productId}`, { quantity }, { withCredentials: true });
    return res.data;
};

export const checkoutPublic = async (slug, payload) => {
    const res = await API.post(`${PUB}/${slug}/checkout`, payload, { withCredentials: true });
    return res.data;
};

export const fetchPublicMarketingPopups = async (slug, path = "") => {
    const res = await API.get(`${PUB}/${slug}/marketing/popups`, { params: { path } });
    return res.data;
};

export const trackPublicAffiliateClick = async (slug, code) => {
    const res = await API.post(`${PUB}/${slug}/marketing/affiliate/click`, { ref: code });
    return res.data;
};

export const trackPublicPopupEvent = async (slug, popupId, event, email = "") => {
    const res = await API.post(`${PUB}/${slug}/marketing/popup/event`, { popupId, event, email });
    return res.data;
};

export const fetchPublicOrderStatus = async (slug, token) => {
    const res = await API.get(`${PUB}/${slug}/order/status`, { params: { token } });
    return res.data;
};
