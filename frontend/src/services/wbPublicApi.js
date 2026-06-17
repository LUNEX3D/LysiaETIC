import API from "./api";

const BASE = "/public/wb";

export const fetchWbSite = (siteSlug, params = {}) =>
    API.get(`${BASE}/site/${siteSlug}`, { params }).then((r) => r.data);

export const fetchWbSiteByDomain = (params = {}) =>
    API.get(`${BASE}/domain/config`, { params }).then((r) => r.data);

export const fetchWbPage = (siteSlug, pageSlug = "", params = {}) =>
    API.get(`${BASE}/page/${siteSlug}/${pageSlug || "home"}`, { params }).then((r) => r.data);

export const fetchWbPageByDomain = (pageSlug = "home", params = {}) =>
    API.get(`${BASE}/domain/page/${pageSlug}`, { params }).then((r) => r.data);

export const fetchWbTheme = (siteSlug) =>
    API.get(`${BASE}/theme/${siteSlug}`).then((r) => r.data);

export const fetchWbNavigation = (siteSlug) =>
    API.get(`${BASE}/navigation/${siteSlug}`).then((r) => r.data);

export const fetchWbProduct = (siteSlug, productSlug) =>
    API.get(`${BASE}/product/${siteSlug}/${productSlug}`).then((r) => r.data);

export const fetchWbProductByDomain = (productSlug) =>
    API.get(`${BASE}/domain/product/${productSlug}`).then((r) => r.data);

export const fetchWbBlogPosts = (siteSlug, params = {}) =>
    API.get(`${BASE}/blog/${siteSlug}`, { params }).then((r) => r.data);

export const fetchWbBlogPost = (siteSlug, postSlug) =>
    API.get(`${BASE}/blog/${siteSlug}/${postSlug}`).then((r) => r.data);

export const fetchWbFormCaptcha = (siteSlug) =>
    API.get(`${BASE}/site/${siteSlug}/form-captcha`).then((r) => r.data);

export const fetchWbFormCaptchaByDomain = () =>
    API.get(`${BASE}/domain/form-captcha`).then((r) => r.data);

export const submitWbForm = (siteSlug, body) =>
    API.post(`${BASE}/site/${siteSlug}/form`, body).then((r) => r.data);

export const submitWbFormByDomain = (body) =>
    API.post(`${BASE}/domain/form`, body).then((r) => r.data);
