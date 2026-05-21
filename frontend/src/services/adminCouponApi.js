import API from "./api";

const BASE = "/admin/coupons";

export const getCouponStats = () => API.get(`${BASE}/stats`);
export const listCoupons = (params = {}) => API.get(BASE, { params });
export const getCoupon = (id) => API.get(`${BASE}/${id}`);
export const createCoupon = (data) => API.post(BASE, data);
export const updateCoupon = (id, data) => API.put(`${BASE}/${id}`, data);
export const deleteCoupon = (id) => API.delete(`${BASE}/${id}`);
export const toggleCoupon = (id) => API.post(`${BASE}/${id}/toggle`);
export const listRedemptions = (params = {}) => API.get(`${BASE}/redemptions`, { params });
