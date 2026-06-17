import API from "../../services/api";

const BASE = "/website-builder";

export const getThemeDocument = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/theme-studio/document`).then((r) => r.data);

export const patchThemeDocument = (siteId, document) =>
    API.patch(`${BASE}/sites/${siteId}/theme-studio/document`, { document }).then((r) => r.data);

export const publishThemeStudio = (siteId) =>
    API.post(`${BASE}/sites/${siteId}/theme-studio/publish`).then((r) => r.data);

export const undoThemeStudio = (siteId) =>
    API.post(`${BASE}/sites/${siteId}/theme-studio/undo`).then((r) => r.data);

export const redoThemeStudio = (siteId) =>
    API.post(`${BASE}/sites/${siteId}/theme-studio/redo`).then((r) => r.data);

export const getDawnManifest = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/theme-studio/dawn/manifest`).then((r) => r.data);

export const getSectionRegistry = (params = {}) =>
    API.get(`${BASE}/theme-studio/sections/registry`, { params }).then((r) => r.data);

export const getThemeMarketplace = (params = {}) =>
    API.get(`${BASE}/theme-studio/marketplace`, { params }).then((r) => r.data);

export const getMyThemes = () =>
    API.get(`${BASE}/theme-studio/my-themes`).then((r) => r.data);

export const installThemeStudio = (siteId, themeSlug) =>
    API.post(`${BASE}/sites/${siteId}/theme-studio/install`, { themeSlug }).then((r) => r.data);

export const duplicateThemeStudio = (siteId) =>
    API.post(`${BASE}/sites/${siteId}/theme-studio/duplicate`).then((r) => r.data);

export const exportThemeStudio = (siteId) =>
    API.get(`${BASE}/sites/${siteId}/theme-studio/export`).then((r) => r.data);

export const importThemeStudio = (siteId, document) =>
    API.post(`${BASE}/sites/${siteId}/theme-studio/import`, { document }).then((r) => r.data);
