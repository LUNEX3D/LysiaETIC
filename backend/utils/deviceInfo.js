/**
 * deviceInfo.js — LysiaETIC
 *
 * Express req nesnesinden istemci bilgilerini güvenli şekilde çıkarır:
 *   • IP adresi (proxy/CDN arkasından doğru header'ı seçer)
 *   • User-Agent string'i
 *   • Cihaz/tarayıcı/OS bilgileri (basit regex parser — harici kütüphane yok)
 *   • Bot tespiti
 *
 * Bu helper hem authMiddleware'da hem AccessIncident kaydı oluştururken kullanılır.
 */

/** IP normalize — IPv6'da gömülü IPv4'ü temizle, X-Forwarded-For listesinden ilkini al */
function getClientIp(req) {
    if (!req) return "";
    const fwd = req.headers?.["x-forwarded-for"];
    let ip = "";
    if (typeof fwd === "string" && fwd.length > 0) {
        ip = fwd.split(",")[0].trim();
    } else if (Array.isArray(fwd) && fwd.length > 0) {
        ip = String(fwd[0]).split(",")[0].trim();
    }
    if (!ip) ip = req.headers?.["x-real-ip"] || req.ip || req.connection?.remoteAddress || "";
    // "::ffff:192.168.1.1" → "192.168.1.1"
    if (typeof ip === "string" && ip.startsWith("::ffff:")) {
        ip = ip.slice(7);
    }
    return String(ip || "").trim();
}

/** Basit UA parser — Bağımlılık yok, %95 doğruluk yeterli (admin gözetimi için) */
function parseUserAgent(ua) {
    const out = {
        browser: "",
        browserVersion: "",
        os: "",
        deviceType: "desktop",
        isBot: false,
    };
    if (!ua || typeof ua !== "string") return out;

    const s = ua;
    const lower = s.toLowerCase();

    // Bot tespiti — yaygın bot/crawler imzaları
    const botPatterns = ["bot", "crawler", "spider", "axios", "curl", "wget", "python-requests", "go-http-client", "node-fetch", "okhttp", "headless", "phantomjs", "puppeteer", "playwright"];
    if (botPatterns.some(p => lower.includes(p))) {
        out.isBot = true;
        out.deviceType = "bot";
    }

    // Cihaz tipi
    if (/iphone|ipod/i.test(s)) out.deviceType = "mobile";
    else if (/ipad|tablet/i.test(s)) out.deviceType = "tablet";
    else if (/android/i.test(s)) out.deviceType = /mobile/i.test(s) ? "mobile" : "tablet";
    else if (/mobile/i.test(s)) out.deviceType = "mobile";

    // Tarayıcı (sıralama önemli — Edge Chrome'dan önce, Opera Chrome'dan önce)
    const browserMatchers = [
        { name: "Edge",    re: /Edg(?:e|A|iOS)?\/([\d.]+)/i },
        { name: "Opera",   re: /OPR\/([\d.]+)/i },
        { name: "Brave",   re: /Brave\/([\d.]+)/i },
        { name: "Vivaldi", re: /Vivaldi\/([\d.]+)/i },
        { name: "Chrome",  re: /Chrome\/([\d.]+)/i },
        { name: "Firefox", re: /Firefox\/([\d.]+)/i },
        { name: "Safari",  re: /Version\/([\d.]+).*Safari/i },
        { name: "Safari",  re: /Safari\/([\d.]+)/i },
        { name: "IE",      re: /(?:MSIE |Trident.*rv:)([\d.]+)/i },
    ];
    for (const b of browserMatchers) {
        const m = s.match(b.re);
        if (m) {
            out.browser = b.name;
            out.browserVersion = m[1] || "";
            break;
        }
    }

    // OS
    if (/windows nt 10/i.test(s)) out.os = "Windows 10/11";
    else if (/windows nt 6\.3/i.test(s)) out.os = "Windows 8.1";
    else if (/windows nt 6\.2/i.test(s)) out.os = "Windows 8";
    else if (/windows nt 6\.1/i.test(s)) out.os = "Windows 7";
    else if (/windows/i.test(s)) out.os = "Windows";
    else if (/mac os x ([\d_.]+)/i.test(s)) {
        const m = s.match(/mac os x ([\d_.]+)/i);
        out.os = m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS";
    }
    else if (/iphone os ([\d_]+)/i.test(s)) {
        const m = s.match(/iphone os ([\d_]+)/i);
        out.os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS";
    }
    else if (/android ([\d.]+)/i.test(s)) {
        const m = s.match(/android ([\d.]+)/i);
        out.os = m ? `Android ${m[1]}` : "Android";
    }
    else if (/linux/i.test(s)) out.os = "Linux";
    else if (/cros/i.test(s)) out.os = "ChromeOS";

    return out;
}

/** Tüm istemci bilgilerini tek seferde topla */
function extractClientInfo(req) {
    const ip = getClientIp(req);
    const ua = (req?.headers?.["user-agent"] || "").toString();
    const device = parseUserAgent(ua);
    return {
        ip,
        userAgent: ua,
        device,
    };
}

/** İnsan okunabilir kısa cihaz özeti — "Chrome 120 / Windows 10" */
function summarizeDevice(device) {
    if (!device) return "Bilinmiyor";
    const parts = [];
    if (device.browser) parts.push(`${device.browser}${device.browserVersion ? " " + device.browserVersion.split(".")[0] : ""}`);
    if (device.os) parts.push(device.os);
    if (device.isBot) parts.push("(Bot)");
    return parts.join(" / ") || "Bilinmiyor";
}

module.exports = {
    getClientIp,
    parseUserAgent,
    extractClientInfo,
    summarizeDevice,
};
