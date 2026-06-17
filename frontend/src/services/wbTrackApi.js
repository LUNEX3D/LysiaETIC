const API_BASE = process.env.REACT_APP_API_URL !== undefined
    ? process.env.REACT_APP_API_URL
    : (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000");

function getVisitorId() {
    const key = "wb_visitor_id";
    let id = localStorage.getItem(key);
    if (!id) {
        id = `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        localStorage.setItem(key, id);
    }
    return id;
}

function getSessionId() {
    const key = "wb_session_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
        id = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        sessionStorage.setItem(key, id);
    }
    return id;
}

export function trackWbPageView(siteSlug, { pageSlug = "", pageId = null } = {}) {
    if (!siteSlug) return;
    const url = `${API_BASE}/api/wb/track/${siteSlug}/pageview`;
    const body = JSON.stringify({
        pageSlug,
        pageId,
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
        referrer: document.referrer || "",
    });
    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        } else {
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
        }
    } catch {
        /* ignore */
    }
}

export function trackWbEvent(siteSlug, payload = {}) {
    if (!siteSlug || !payload.eventType) return;
    const url = `${API_BASE}/api/wb/track/${siteSlug}/event`;
    const body = JSON.stringify({
        ...payload,
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    });
    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        } else {
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
        }
    } catch {
        /* ignore */
    }
}

export function trackWbProductView(siteSlug, { productSlug, productId }) {
    if (!siteSlug || !productSlug) return;
    const url = `${API_BASE}/api/wb/track/${siteSlug}/event`;
    const body = JSON.stringify({
        eventType: "product_view",
        productSlug,
        productId,
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
    });
    try {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    } catch {
        /* ignore */
    }
}
