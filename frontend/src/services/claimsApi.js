import API from "./api";

/**
 * İade/Talep Yönetimi API — /api/claims
 */

export const fetchClaims = async ({ marketplace, status, orderNumber, startDate, endDate, page = 0, size = 50 } = {}) => {
    const response = await API.get("/claims", {
        params: {
            marketplace,
            ...(status ? { status } : {}),
            ...(orderNumber ? { orderNumber } : {}),
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {}),
            page,
            size,
        },
        timeout: 60000,
    });
    return response.data;
};

export const fetchClaimReasons = async ({ marketplace, type = "reject" } = {}) => {
    const response = await API.get("/claims/reasons", {
        params: { marketplace, type },
        timeout: 30000,
    });
    return response.data;
};

export const approveClaim = async ({ marketplace, claimId, lineItemIds, orderNumber } = {}) => {
    const response = await API.post(
        "/claims/approve",
        { marketplace, claimId, lineItemIds, orderNumber },
        { timeout: 90000 }
    );
    return response.data;
};

export const rejectClaim = async ({ marketplace, claimId, reasonId, description, lineItemIds, file, ...rest } = {}) => {
    if (file) {
        const form = new FormData();
        form.append("marketplace", marketplace);
        form.append("claimId", claimId);
        if (reasonId != null) form.append("reasonId", reasonId);
        if (description) form.append("description", description);
        if (Array.isArray(lineItemIds)) form.append("lineItemIds", lineItemIds.join(","));
        Object.entries(rest).forEach(([k, v]) => {
            if (v != null && v !== "") form.append(k, v);
        });
        form.append("file", file);
        const response = await API.post("/claims/reject", form, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 90000,
        });
        return response.data;
    }
    const response = await API.post(
        "/claims/reject",
        { marketplace, claimId, reasonId, description, lineItemIds, ...rest },
        { timeout: 45000 }
    );
    return response.data;
};

export const pendClaim = async ({ claimId, reasonId, dayCount, note } = {}) => {
    const response = await API.post(
        "/claims/pend",
        { claimId, reasonId, dayCount, note },
        { timeout: 45000 }
    );
    return response.data;
};

export const confirmAmazonShipment = async (orderId, { trackingNumber, carrierCode, carrierName, shipDate, orderItems } = {}) => {
    const response = await API.post(
        `/amazon/orders/${encodeURIComponent(orderId)}/shipment-confirmation`,
        { trackingNumber, carrierCode, carrierName, shipDate, orderItems },
        { timeout: 60000 }
    );
    return response.data;
};

export const shipOzonPosting = async (postingNumber) => {
    const response = await API.post(
        `/orders/ozon/${encodeURIComponent(postingNumber)}/ship`,
        {},
        { timeout: 60000 }
    );
    return response.data;
};

export const listTrendyolWebhooks = async () => {
    const response = await API.get("/integrations/trendyol/webhooks", { timeout: 30000 });
    return response.data;
};

export const createTrendyolWebhook = async (payload = {}) => {
    const response = await API.post("/integrations/trendyol/webhooks", payload, { timeout: 30000 });
    return response.data;
};

export const deleteTrendyolWebhook = async (id) => {
    const response = await API.delete(`/integrations/trendyol/webhooks/${encodeURIComponent(id)}`, { timeout: 30000 });
    return response.data;
};
