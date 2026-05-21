/** Dashtock — canlı site / iletişim domain sabitleri */
export const APP_DOMAIN = "dashtock.com";
export const APP_SITE_URL =
    process.env.REACT_APP_SITE_URL?.replace(/\/$/, "") || `https://${APP_DOMAIN}`;

export const APP_API_URL = process.env.REACT_APP_API_URL?.replace(/\/$/, "") || "";
