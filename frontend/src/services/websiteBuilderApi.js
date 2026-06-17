import API from "./api";

const BASE = "/website-builder";

// ─── THEMES ───────────────────────────────────────────────────────────────────
export const getCuratedThemes = () => getThemes({ curated: "true" });
export const getThemes = (params = {}) => API.get(`${BASE}/themes`, { params }).then((r) => r.data);
export const getThemeById = (themeId) => API.get(`${BASE}/themes/${themeId}`).then((r) => r.data);
export const getSectionRegistry = () => API.get(`${BASE}/themes/section-registry`).then((r) => r.data);
export const getThemeStructureGroups = () => API.get(`${BASE}/themes/structure-groups`).then((r) => r.data);

// ─── SITES ────────────────────────────────────────────────────────────────────
export const getSites = () => API.get(`${BASE}/sites`).then((r) => r.data);
export const getSite = (siteId) => API.get(`${BASE}/sites/${siteId}`).then((r) => r.data);
export const createSite = (data) => API.post(`${BASE}/sites`, data).then((r) => r.data);
export const updateSite = (siteId, data) => API.patch(`${BASE}/sites/${siteId}`, data).then((r) => r.data);
export const deleteSite = (siteId) => API.delete(`${BASE}/sites/${siteId}`).then((r) => r.data);
export const getPublishStatus = (siteId) => API.get(`${BASE}/sites/${siteId}/publish-status`).then((r) => r.data);
export const deploySite = (siteId) => API.post(`${BASE}/sites/${siteId}/deploy`).then((r) => r.data);
export const publishSite = (siteId) => API.post(`${BASE}/sites/${siteId}/publish`).then((r) => r.data);
export const unpublishSite = (siteId) => API.post(`${BASE}/sites/${siteId}/unpublish`).then((r) => r.data);
export const createPreviewToken = (siteId) => API.post(`${BASE}/sites/${siteId}/preview-token`).then((r) => r.data);
export const applyTheme = (siteId, data) => API.post(`${BASE}/sites/${siteId}/theme`, data).then((r) => r.data);

// ─── OSS THEMES & GRAPESJS ────────────────────────────────────────────────────
export const listOssThemes = () => API.get(`${BASE}/oss-themes`).then((r) => r.data);
export const getOssTheme = (slug) => API.get(`${BASE}/oss-themes/${slug}`).then((r) => r.data);
export const installOssTheme = (siteId, slug) =>
    API.post(`${BASE}/sites/${siteId}/oss-themes/${slug}/install`).then((r) => r.data);
export const bootstrapGrapesEditor = (siteId, ossSlug) =>
    API.post(`${BASE}/sites/${siteId}/grapes-editor/bootstrap`, ossSlug ? { ossSlug } : {}).then((r) => r.data);
export const getGrapesEditor = (siteId) => API.get(`${BASE}/sites/${siteId}/grapes-editor`).then((r) => r.data);
export const saveGrapesEditor = (siteId, data) =>
    API.put(`${BASE}/sites/${siteId}/grapes-editor`, data).then((r) => r.data);
export const getVisualEditor = (siteId) => API.get(`${BASE}/sites/${siteId}/visual-editor`).then((r) => r.data);
export const setEditorEngine = (siteId, engine) =>
    API.post(`${BASE}/sites/${siteId}/editor-engine`, { engine }).then((r) => r.data);
export const getPuckEditor = (siteId) => API.get(`${BASE}/sites/${siteId}/puck-editor`).then((r) => r.data);
export const savePuckEditor = (siteId, data) =>
    API.put(`${BASE}/sites/${siteId}/puck-editor`, data).then((r) => r.data);
export const bootstrapPuckEditor = (siteId) =>
    API.post(`${BASE}/sites/${siteId}/puck-editor/bootstrap`).then((r) => r.data);

// ─── PAGES ────────────────────────────────────────────────────────────────────
export const getPages = (siteId) => API.get(`${BASE}/sites/${siteId}/pages`).then((r) => r.data);
export const getPage = (siteId, pageId) => API.get(`${BASE}/sites/${siteId}/pages/${pageId}`).then((r) => r.data);
export const createPage = (siteId, data) => API.post(`${BASE}/sites/${siteId}/pages`, data).then((r) => r.data);
export const updatePage = (siteId, pageId, data) => API.patch(`${BASE}/sites/${siteId}/pages/${pageId}`, data).then((r) => r.data);
export const getPageRevisions = (siteId, pageId) => API.get(`${BASE}/sites/${siteId}/pages/${pageId}/revisions`).then((r) => r.data);
export const restorePageRevision = (siteId, pageId, revisionId) =>
    API.post(`${BASE}/sites/${siteId}/pages/${pageId}/revisions/${revisionId}/restore`).then((r) => r.data);
export const publishPage = (siteId, pageId) => API.post(`${BASE}/sites/${siteId}/pages/${pageId}/publish`).then((r) => r.data);
export const deletePage = (siteId, pageId) => API.delete(`${BASE}/sites/${siteId}/pages/${pageId}`).then((r) => r.data);

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
export const addSection = (siteId, pageId, data) => API.post(`${BASE}/sites/${siteId}/pages/${pageId}/sections`, data).then((r) => r.data);
export const updateSection = (siteId, pageId, sectionId, data) => API.patch(`${BASE}/sites/${siteId}/pages/${pageId}/sections/${sectionId}`, data).then((r) => r.data);
export const reorderSections = (siteId, pageId, orderedIds) => API.put(`${BASE}/sites/${siteId}/pages/${pageId}/sections`, { orderedIds }).then((r) => r.data);
export const deleteSection = (siteId, pageId, sectionId) => API.delete(`${BASE}/sites/${siteId}/pages/${pageId}/sections/${sectionId}`).then((r) => r.data);

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
export const getNavigation = (siteId) => API.get(`${BASE}/sites/${siteId}/navigation`).then((r) => r.data);
export const updateNavigation = (siteId, position, data) => API.put(`${BASE}/sites/${siteId}/navigation/${position}`, data).then((r) => r.data);

// ─── POPUPS ───────────────────────────────────────────────────────────────────
export const listPopups = (siteId) => API.get(`${BASE}/sites/${siteId}/popups`).then((r) => r.data);
export const createPopup = (siteId, data) => API.post(`${BASE}/sites/${siteId}/popups`, data).then((r) => r.data);
export const updatePopup = (siteId, popupId, data) => API.patch(`${BASE}/sites/${siteId}/popups/${popupId}`, data).then((r) => r.data);
export const deletePopup = (siteId, popupId) => API.delete(`${BASE}/sites/${siteId}/popups/${popupId}`).then((r) => r.data);

// ─── FORMS ──────────────────────────────────────────────────────────────────────
export const listForms = (siteId) => API.get(`${BASE}/sites/${siteId}/forms`).then((r) => r.data);
export const createForm = (siteId, data) => API.post(`${BASE}/sites/${siteId}/forms`, data).then((r) => r.data);
export const updateForm = (siteId, formId, data) => API.patch(`${BASE}/sites/${siteId}/forms/${formId}`, data).then((r) => r.data);
export const deleteForm = (siteId, formId) => API.delete(`${BASE}/sites/${siteId}/forms/${formId}`).then((r) => r.data);
export const listFormSubmissions = (siteId, params) => API.get(`${BASE}/sites/${siteId}/form-submissions`, { params }).then((r) => r.data);
export const updateFormSubmission = (siteId, submissionId, data) =>
    API.patch(`${BASE}/sites/${siteId}/form-submissions/${submissionId}`, data).then((r) => r.data);

// ─── SEO CENTER ───────────────────────────────────────────────────────────────
export const getSeoCenter = (siteId) => API.get(`${BASE}/sites/${siteId}/seo-center`).then((r) => r.data);
export const listRedirects = (siteId) => API.get(`${BASE}/sites/${siteId}/redirects`).then((r) => r.data);
export const createRedirect = (siteId, data) => API.post(`${BASE}/sites/${siteId}/redirects`, data).then((r) => r.data);
export const updateRedirect = (siteId, redirectId, data) => API.patch(`${BASE}/sites/${siteId}/redirects/${redirectId}`, data).then((r) => r.data);
export const deleteRedirect = (siteId, redirectId) => API.delete(`${BASE}/sites/${siteId}/redirects/${redirectId}`).then((r) => r.data);
export const getFormAnalytics = (siteId) => API.get(`${BASE}/sites/${siteId}/form-analytics`).then((r) => r.data);
export const exportFormSubmissionsCsv = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/form-submissions/export.csv`, { responseType: "blob" }).then((r) => r.data);
export const getPopupAnalytics = (siteId, params) => API.get(`${BASE}/sites/${siteId}/popup-analytics`, { params }).then((r) => r.data);

// ─── BLOG ─────────────────────────────────────────────────────────────────────
export const getBlogPosts = (siteId, params = {}) => API.get(`${BASE}/sites/${siteId}/blog/posts`, { params }).then((r) => r.data);
export const getBlogPost = (siteId, postId) => API.get(`${BASE}/sites/${siteId}/blog/posts/${postId}`).then((r) => r.data);
export const createBlogPost = (siteId, data) => API.post(`${BASE}/sites/${siteId}/blog/posts`, data).then((r) => r.data);
export const updateBlogPost = (siteId, postId, data) => API.patch(`${BASE}/sites/${siteId}/blog/posts/${postId}`, data).then((r) => r.data);
export const deleteBlogPost = (siteId, postId) => API.delete(`${BASE}/sites/${siteId}/blog/posts/${postId}`).then((r) => r.data);
export const getBlogCategories = (siteId) => API.get(`${BASE}/sites/${siteId}/blog/categories`).then((r) => r.data);
export const createBlogCategory = (siteId, data) => API.post(`${BASE}/sites/${siteId}/blog/categories`, data).then((r) => r.data);
export const deleteBlogCategory = (siteId, catId) => API.delete(`${BASE}/sites/${siteId}/blog/categories/${catId}`).then((r) => r.data);

// ─── MEDIA ────────────────────────────────────────────────────────────────────
export const getMedia = (siteId, params = {}) => API.get(`${BASE}/sites/${siteId}/media`, { params }).then((r) => r.data);
export const uploadMedia = (siteId, formData, onProgress) =>
    API.post(`${BASE}/sites/${siteId}/media`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: onProgress ? (e) => onProgress(Math.round((e.loaded * 100) / e.total)) : undefined,
    }).then((r) => r.data);
export const deleteMedia = (siteId, mediaId) => API.delete(`${BASE}/sites/${siteId}/media/${mediaId}`).then((r) => r.data);

// ─── DOMAIN ───────────────────────────────────────────────────────────────────
export const getDomain = (siteId) => API.get(`${BASE}/sites/${siteId}/domain`).then((r) => r.data);
export const listDomains = (siteId) => API.get(`${BASE}/sites/${siteId}/domains`).then((r) => r.data);
export const addDomain = (siteId, domain, domainType) =>
    API.post(`${BASE}/sites/${siteId}/domain`, { domain, domainType }).then((r) => r.data);
export const verifyDomain = (siteId, domainId) =>
    API.post(`${BASE}/sites/${siteId}/domain/verify`, domainId ? { domainId } : {}).then((r) => r.data);
export const setPrimaryDomain = (siteId, domainId) =>
    API.post(`${BASE}/sites/${siteId}/domain/${domainId}/primary`).then((r) => r.data);
export const removeDomain = (siteId) => API.delete(`${BASE}/sites/${siteId}/domain`).then((r) => r.data);
export const removeDomainById = (siteId, domainId) =>
    API.delete(`${BASE}/sites/${siteId}/domain/${domainId}`).then((r) => r.data);

export const listSeoEntities = (siteId, entityType, params = {}) =>
    API.get(`${BASE}/sites/${siteId}/seo-entities/${entityType}`, { params }).then((r) => r.data);
export const updateSeoEntity = (siteId, entityType, entityId, seo) =>
    API.patch(`${BASE}/sites/${siteId}/seo-entities/${entityType}/${entityId}`, { seo }).then((r) => r.data);
export const generateSeoAi = (siteId, entityType, context) =>
    API.post(`${BASE}/sites/${siteId}/seo-generate`, { entityType, context }).then((r) => r.data);
export const bulkGenerateSeo = (siteId, entityType, limit = 20) =>
    API.post(`${BASE}/sites/${siteId}/seo-bulk-generate`, { entityType, limit }).then((r) => r.data);

export const getPerformance = (siteId, refresh = false) =>
    API.get(`${BASE}/sites/${siteId}/performance`, { params: { refresh: refresh ? "true" : "false" } }).then((r) => r.data);
export const getEmailDomainStatus = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/email-domain`).then((r) => r.data);
export const verifyEmailDomain = (siteId) =>
    API.post(`${BASE}/sites/${siteId}/email-domain/verify`).then((r) => r.data);

// ─── TEMA v2 (install / update / rollback) ────────────────────────────────────
export const getThemeInstall = (siteId) => API.get(`${BASE}/sites/${siteId}/theme/install`).then((r) => r.data);
export const installTheme = (siteId, data) => API.post(`${BASE}/sites/${siteId}/theme/install`, data).then((r) => r.data);
export const updateThemeVersion = (siteId, data) => API.post(`${BASE}/sites/${siteId}/theme/update`, data).then((r) => r.data);
export const rollbackTheme = (siteId, data) => API.post(`${BASE}/sites/${siteId}/theme/rollback`, data).then((r) => r.data);
export const checkThemeUpdates = (siteId) => API.get(`${BASE}/sites/${siteId}/theme/check-updates`).then((r) => r.data);
export const saveThemeCustomizations = (siteId, data) =>
    API.patch(`${BASE}/sites/${siteId}/theme/customizations`, data).then((r) => r.data);
export const cloneThemeInstall = (siteId, data) =>
    API.post(`${BASE}/sites/${siteId}/theme/clone`, data).then((r) => r.data);
export const importTheme = (siteId, data) =>
    API.post(`${BASE}/sites/${siteId}/theme/import`, data).then((r) => r.data);
export const exportTheme = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/theme/export`).then((r) => r.data);
export const getThemeSections = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/theme/sections`).then((r) => r.data);

// ─── ÜRÜN SAYFASI ─────────────────────────────────────────────────────────────
export const getProductPage = (siteId) => API.get(`${BASE}/sites/${siteId}/product-page`).then((r) => r.data);
export const updateProductPage = (siteId, data) => API.put(`${BASE}/sites/${siteId}/product-page`, data).then((r) => r.data);
export const publishProductPage = (siteId) => API.post(`${BASE}/sites/${siteId}/product-page/publish`).then((r) => r.data);
export const resetProductPage = (siteId) => API.post(`${BASE}/sites/${siteId}/product-page/reset`).then((r) => r.data);

// ─── AI ───────────────────────────────────────────────────────────────────────
export const createAIJob = (siteId, data) => API.post(`${BASE}/sites/${siteId}/ai/generate`, data).then((r) => r.data);
export const getAIJobs = (siteId, params) => API.get(`${BASE}/sites/${siteId}/ai/jobs`, { params }).then((r) => r.data);
export const getAIJob = (siteId, jobId) => API.get(`${BASE}/sites/${siteId}/ai/jobs/${jobId}`).then((r) => r.data);
export const getAIContents = (siteId, params) => API.get(`${BASE}/sites/${siteId}/ai/contents`, { params }).then((r) => r.data);

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
export const getAnalyticsSummary = (siteId, params) =>
    API.get(`${BASE}/sites/${siteId}/analytics/summary`, { params }).then((r) => r.data);
export const getAnalyticsPages = (siteId, params) =>
    API.get(`${BASE}/sites/${siteId}/analytics/pages`, { params }).then((r) => r.data);
export const getAnalyticsFunnel = (siteId, params) =>
    API.get(`${BASE}/sites/${siteId}/analytics/funnel`, { params }).then((r) => r.data);
