/**
 * ozonClaimsService.js â€” Ozon iade listeleme (FBS)
 * POST /v1/returns/list â€” fallback /v3/returns/company/fbs
 */

const { fetchOzonReturns } = require("./ozon/ozonService");

const normalizeOzonReturn = (r) => ({
    marketplace: "Ozon",
    claimId: r.id || r.return_id || r.posting_number,
    claimNumber: String(r.id || r.return_id || ""),
    orderNumber: String(r.posting_number || r.order_number || ""),
    customerName: r.customer?.name || "",
    status: r.status?.name || r.status || r.state || "",
    reason: r.return_reason_name || r.reason?.name || r.comment || "",
    claimDate: r.logistic_return_date || r.created_at || null,
    items: (r.products || r.items || []).map((p) => ({
        productName: p.name || p.offer_id || "",
        sku: p.offer_id || p.sku || "",
        quantity: Number(p.quantity) || 1,
    })),
    raw: r,
});

const fetchClaims = async (credentials, opts = {}) => {
    const now = Date.now();
    const startDate = opts.startDate || now - 30 * 24 * 60 * 60 * 1000;
    const endDate = opts.endDate || now;

    try {
        const returns = await fetchOzonReturns(credentials, startDate, endDate);
        let claims = returns.map(normalizeOzonReturn);

        if (opts.orderNumber) {
            const q = String(opts.orderNumber).trim().toLowerCase();
            claims = claims.filter(
                (c) =>
                    String(c.orderNumber).toLowerCase().includes(q) ||
                    String(c.claimNumber).toLowerCase().includes(q)
            );
        }

        const page = Math.max(0, parseInt(opts.page, 10) || 0);
        const size = Math.min(100, parseInt(opts.size, 10) || 50);
        const start = page * size;
        const slice = claims.slice(start, start + size);

        return {
            success: true,
            claims: slice,
            totalElements: claims.length,
            page,
            size,
        };
    } catch (err) {
        return { success: false, error: err.message, claims: [], totalElements: 0 };
    }
};

module.exports = {
    fetchClaims,
    normalizeOzonReturn,
};

