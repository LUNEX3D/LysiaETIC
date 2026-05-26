/**
 * Pazaryeri kargo etiketi — görüntüleme ve yazdırma (PDF / ZPL)
 */

const axios = require("axios");
const Marketplace = require("../models/Marketplace");
const Order = require("../models/Order");
const AutoOrderConfig = require("../models/AutoOrderConfig");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const {
    getTrendyolCargoCompanies,
    resolveTrendyolCargoId,
    resolveTrendyolCargoProviderCode,
    buildTrendyolPickingLines,
} = require("./autoOrderService");
const { buildTrendyolA4LabelResponse, extractLabelMetaFromPackage } = require("./trendyolA4LabelHtml");
const { buildMarketplaceA4LabelResponse } = require("./marketplaceA4LabelService");
const { fetchCiceksepetiLabel } = require("./ciceksepetiLabelService");
const { fetchN11Label } = require("./n11LabelService");
const {
    normalizeCredentials: normHb,
    getAuthHeader: getHbAuth,
    getEndpoints: getHbEndpoints,
    resolveHepsiburadaOrderNumber,
    coerceHepsiburadaUseSit,
    resolveHbUseSitAuto,
    fetchHbOrderByOrderNumber,
    normalizeHbOmsItem,
} = require("./hepsiburadaService");

/** HB Basic Auth her zaman merchantId:secretKey — userAgent yalnızca User-Agent header */
const buildHbApiContext = (credentials, useSitOverride) => {
    const hb = normHb(credentials);
    const { merchantId, secretKey, userAgent } = hb;
    const useSit =
        typeof useSitOverride === "boolean" ? useSitOverride : coerceHepsiburadaUseSit(hb.useSit);
    return {
        merchantId,
        secretKey,
        useSit,
        ep: getHbEndpoints({ useSit }),
        headers: {
            Authorization: getHbAuth(merchantId, secretKey),
            "Content-Type": "application/json",
            "User-Agent": userAgent || "Dashtock",
            Accept: "application/json",
        },
    };
};

const TY_BASE = "https://apigw.trendyol.com/integration";

const normalizeMp = (name = "") => {
    const n = String(name || "").toLowerCase().trim();
    if (n.includes("trendyol")) return "trendyol";
    if (n.includes("hepsi")) return "hepsiburada";
    if (n === "n11") return "n11";
    if (n.includes("cicek") || n.includes("çiçek")) return "ciceksepeti";
    if (n.includes("amazon")) return "amazon";
    if (n.includes("ptt")) return "pttavm";
    if (n.includes("ozon")) return "ozon";
    return n;
};

const normalizeTyCredentials = (credentials = {}) => ({
    sellerId: String(credentials.sellerId || credentials.supplierId || "").trim(),
    apiKey: String(credentials.apiKey || "").trim(),
    apiSecret: String(credentials.apiSecret || "").trim(),
});

const buildTrendyolHeaders = (credentials) => {
    const { sellerId, apiKey, apiSecret } = normalizeTyCredentials(credentials);
    return {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        "User-Agent": `${sellerId} - Dashtock`,
        "Content-Type": "application/json",
    };
};

const INVALID_TRACKING = new Set(["yok", "none", "bilinmiyor", "—", "-", "n/a", "na", "null", "undefined"]);

/** DB/UI placeholder — API'ye gönderilmez */
const sanitizeCargoTracking = (value) => {
    const s = String(value ?? "").trim();
    if (!s) return "";
    if (INVALID_TRACKING.has(s.toLowerCase())) return "";
    if (!/\d/.test(s)) return "";
    return s;
};

const formatApiBody = (data) => {
    if (data == null) return "";
    if (typeof data === "string") return data.trim();
    if (Array.isArray(data)) {
        return data.map((x) => formatApiBody(x)).filter(Boolean).join("; ");
    }
    if (typeof data === "object") {
        if (data.message != null && typeof data.message !== "object") return String(data.message);
        if (data.message != null) return formatApiBody(data.message);
        if (data.error != null) return formatApiBody(data.error);
        if (Array.isArray(data.errors) && data.errors.length) {
            return data.errors
                .map((e) => e.message || e.detail || e.description || JSON.stringify(e))
                .join("; ");
        }
        try {
            const flat = Object.entries(data)
                .filter(([, v]) => v != null && typeof v !== "object")
                .map(([k, v]) => `${k}: ${v}`)
                .join(" | ");
            if (flat) return flat;
            return JSON.stringify(data);
        } catch {
            return String(data);
        }
    }
    return String(data);
};

const parseTrendyolApiError = (data) => {
    if (!data) return "";
    if (typeof data === "string") return data.trim();
    if (data.title) return String(data.title).trim();
    if (Array.isArray(data.errors) && data.errors.length) {
        const e0 = data.errors[0];
        return String(e0.title || e0.message || e0.detail || "").trim();
    }
    return formatApiBody(data);
};

const axiosErrorMessage = (err, fallback = "Pazaryeri API hatası") => {
    const fromBody = parseTrendyolApiError(err?.response?.data) || formatApiBody(err?.response?.data);
    if (fromBody) return fromBody;
    const msg = String(err?.message || "");
    if (msg && !/^Request failed with status code \d+$/i.test(msg)) return msg;
    const st = err?.response?.status;
    return st ? `${fallback} (HTTP ${st})` : fallback;
};

/** TY/HB API: "Cargo company does not provide mutual barcodes." */
const isMutualBarcodeUnavailable = (errOrMsg) => {
    const s = String(
        typeof errOrMsg === "string"
            ? errOrMsg
            : errOrMsg?.message || parseTrendyolApiError(errOrMsg?.response?.data) || ""
    ).toLowerCase();
    return (
        s.includes("mutual barcode") ||
        s.includes("does not provide mutual") ||
        s.includes("ortak barkod") ||
        (s.includes("ortak etiket") && (s.includes("sağlam") || s.includes("yok")))
    );
};

/**
 * Ortak etiket (createCommonLabel) yalnızca Trendyol öder TEX.
 * Aras / Express / Yurtiçi anlaşmalı çıkış → panel A4 şablonu (mutual barcode hatası verir).
 */
const isTrendyolCommonLabelEligible = (cargoProviderName = "") => {
    const n = String(cargoProviderName || "").toLowerCase();
    if (!n) return false;
    if (n.includes("express")) return false;
    if (n.includes("ptt")) return false;
    if (n.includes("yurti")) return false;
    if (n.includes("mng")) return false;
    if (n.includes("sürat") || n.includes("surat")) return false;
    if (n.includes("kolay")) return false;
    if (n.includes("horoz")) return false;
    if (n.includes("sendeo")) return false;
    if (n.includes("borusan")) return false;
    if (n.includes("aras")) return false;
    if (n.includes("tex") && !n.includes("latex")) return true;
    return false;
};

const trendyolBoxQuantity = (pkg) => {
    if (!pkg || !Array.isArray(pkg.lines)) return 1;
    const q = pkg.lines.reduce((s, l) => s + Math.max(1, Number(l.quantity) || 1), 0);
    return Math.min(Math.max(q, 1), 99);
};

const extractHbLabelBase64 = (body) => {
    if (!body) return null;
    if (typeof body === "string" && body.length > 100) return body.trim();
    const data = body.data ?? body.Data ?? body.barcodeData ?? body;
    if (typeof data === "string" && data.length > 50) return data.trim();
    if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (typeof first === "string") return first.trim();
        return first?.data || first?.barcode || first?.label || first?.content || null;
    }
    if (data && typeof data === "object" && !Array.isArray(data)) {
        if (typeof data.data === "string") return data.data.trim();
        if (Array.isArray(data.data) && data.data[0]) {
            const x = data.data[0];
            return typeof x === "string" ? x.trim() : x?.data || x?.barcode || null;
        }
    }
    return null;
};

const hbOrderMatchesTarget = (pkg, target) => {
    const t = String(target || "").trim();
    if (!t) return false;
    const tLow = t.toLowerCase();
    const candidates = [
        pkg.orderNumber,
        pkg.OrderNumber,
        pkg.merchantOrderNumber,
        pkg.sapNumber,
        resolveHepsiburadaOrderNumber(pkg),
        pkg.packageNumber,
        pkg.PackageNumber,
    ]
        .map((v) => String(v || "").trim())
        .filter(Boolean);
    return candidates.some((c) => c === t || c.toLowerCase() === tLow);
};

const packageMatchesTarget = (pkg, orderNumber, shipmentPackageId) => {
    const target = String(orderNumber || "").trim();
    const pkgId = String(shipmentPackageId || "").trim();
    if (pkgId) {
        const ids = [pkg.shipmentPackageId, pkg.id].map((x) => String(x || ""));
        if (ids.some((id) => id === pkgId)) return true;
    }
    if (target && String(pkg.orderNumber || "") === target) return true;
    return false;
};

async function fetchTrendyolOrdersPage(credentials, { startMs, endMs, page, size, extraParams = "" }) {
    const { sellerId } = normalizeTyCredentials(credentials);
    const headers = buildTrendyolHeaders(credentials);
    const url =
        `${TY_BASE}/order/sellers/${sellerId}/orders` +
        `?page=${page}&size=${size}&orderByField=PackageLastModifiedDate&orderByDirection=DESC` +
        `&startDate=${startMs}&endDate=${endMs}${extraParams}`;
    const res = await axios.get(url, { headers, timeout: 25000 });
    return {
        content: res.data?.content || [],
        totalPages: Math.max(1, parseInt(res.data?.totalPages, 10) || 1),
    };
}

/** Etiket öncesi canlı paket — DB gecikse bile Trendyol'dan güncel link/no */
async function fetchTrendyolPackageLive(credentials, orderNumber, shipmentPackageId) {
    const { sellerId, apiKey, apiSecret } = normalizeTyCredentials(credentials);
    if (!sellerId || !apiKey || !apiSecret) return null;

    const target = String(orderNumber || "").trim();
    const pkgId = String(shipmentPackageId || "").trim();
    const now = Date.now();
    const dayRanges = [7, 14, 30];

    const pickFromList = (list) => {
        if (!Array.isArray(list) || !list.length) return null;
        if (pkgId || target) {
            const hit = list.find((p) => packageMatchesTarget(p, target, pkgId));
            if (hit) return hit;
        }
        return list[0] || null;
    };

    try {
        for (const days of dayRanges) {
            const startMs = now - days * 24 * 60 * 60 * 1000;

            if (pkgId) {
                const { content } = await fetchTrendyolOrdersPage(credentials, {
                    startMs,
                    endMs: now,
                    page: 0,
                    size: 50,
                    extraParams: `&shipmentPackageIds=${encodeURIComponent(pkgId)}`,
                });
                const hit = pickFromList(content);
                if (hit) return hit;
            }

            if (target) {
                const { content } = await fetchTrendyolOrdersPage(credentials, {
                    startMs,
                    endMs: now,
                    page: 0,
                    size: 50,
                    extraParams: `&orderNumber=${encodeURIComponent(target)}`,
                });
                const hit = pickFromList(content);
                if (hit) return hit;
            }

            for (const status of ["Picking", "Created", "Invoiced"]) {
                let page = 0;
                let totalPages = 1;
                while (page < totalPages && page < 8) {
                    const result = await fetchTrendyolOrdersPage(credentials, {
                        startMs,
                        endMs: now,
                        page,
                        size: 200,
                        extraParams: `&status=${status}`,
                    });
                    totalPages = result.totalPages;
                    const hit = pickFromList(result.content);
                    if (hit) return hit;
                    page++;
                }
            }
        }
    } catch (err) {
        logger.warn(`[ShippingLabel] Trendyol canlı paket: ${axiosErrorMessage(err)}`);
    }
    if (pkgId) {
        try {
            const { sellerId } = normalizeTyCredentials(credentials);
            const headers = buildTrendyolHeaders(credentials);
            const directUrl = `${TY_BASE}/order/sellers/${sellerId}/shipment-packages/${encodeURIComponent(pkgId)}`;
            const directRes = await axios.get(directUrl, { headers, timeout: 20000, validateStatus: () => true });
            if (directRes.status === 200 && directRes.data) {
                const d = directRes.data;
                if (packageMatchesTarget(d, target, pkgId) || String(d.id) === pkgId) return d;
            }
        } catch {
            /* Tekil paket endpoint yoksa liste aramasına devam */
        }
    }

    return null;
}

async function loadTrendyolAutoCargo(userId, marketplaceId) {
    if (!userId) return null;
    try {
        if (marketplaceId) {
            const cfg = await AutoOrderConfig.findOne({ user: userId, marketplace: marketplaceId }).lean();
            if (cfg?.primaryCargo?.id) return cfg.primaryCargo;
        }
        const cfgByName = await AutoOrderConfig.findOne({
            user: userId,
            marketplaceName: /^trendyol$/i,
        }).lean();
        if (cfgByName?.primaryCargo?.id) return cfgByName.primaryCargo;
    } catch (e) {
        logger.warn(`[ShippingLabel] AutoOrderConfig: ${e.message}`);
    }
    return null;
}

/** İşlemde sipariş: Picking + seçili kargo (Otomatik Sipariş ayarı) — link/barkod oluşsun */
async function trendyolPreparePackageForLabel(credentials, pkg, autoCargo = null) {
    const shipmentPackageId = pkg?.shipmentPackageId ?? pkg?.id;
    if (!shipmentPackageId) return false;

    const status = String(pkg?.status || pkg?.shipmentPackageStatus || "").trim();
    const { sellerId, apiKey, apiSecret } = normalizeTyCredentials(credentials);
    const headers = buildTrendyolHeaders(credentials);
    let changed = false;

    if (status === "Created") {
        const lines = buildTrendyolPickingLines(pkg);
        if (lines.length) {
            const pickUrl = `${TY_BASE}/order/sellers/${sellerId}/shipment-packages/${shipmentPackageId}`;
            const pickRes = await axios.put(
                pickUrl,
                { status: "Picking", lines, params: {} },
                { headers, timeout: 20000, validateStatus: () => true }
            );
            if (pickRes.status >= 200 && pickRes.status < 300) {
                changed = true;
                logger.info(`[ShippingLabel] ${pkg.orderNumber || shipmentPackageId} → Picking`);
            } else {
                logger.warn(`[ShippingLabel] Picking HTTP ${pickRes.status}: ${parseTrendyolApiError(pickRes.data)}`);
            }
        }
    }

    if (autoCargo?.id) {
        const resolvedId = resolveTrendyolCargoId(autoCargo.id);
        const cargoList = await getTrendyolCargoCompanies(sellerId, apiKey, apiSecret);
        const providerCode = resolveTrendyolCargoProviderCode(resolvedId, cargoList);
        if (providerCode) {
            const cargoUrl =
                `${TY_BASE}/order/sellers/${sellerId}/shipment-packages/${shipmentPackageId}/cargo-providers`;
            const cargoRes = await axios.put(
                cargoUrl,
                { cargoProvider: providerCode },
                { headers, timeout: 20000, validateStatus: () => true }
            );
            if (cargoRes.status >= 200 && cargoRes.status < 300) {
                changed = true;
                logger.info(
                    `[ShippingLabel] ${pkg.orderNumber || shipmentPackageId} → kargo ${providerCode} (${autoCargo.name || resolvedId})`
                );
            } else {
                logger.warn(`[ShippingLabel] Kargo atama HTTP ${cargoRes.status}: ${parseTrendyolApiError(cargoRes.data)}`);
            }
        }
    }

    if (changed) {
        await new Promise((r) => setTimeout(r, 2200));
    }
    return changed;
}

async function persistOrderCargoFields(userId, orderNumber, orderId, fields = {}, marketplacePattern = /trendyol/i) {
    try {
        const q = orderId
            ? { _id: orderId, user: userId }
            : {
                  user: userId,
                  trackingNumber: String(orderNumber || "").trim(),
                  marketplaceName: marketplacePattern,
              };
        const row = await Order.findOne(q);
        if (!row) return;
        let dirty = false;
        const set = (key, val) => {
            const v = String(val ?? "").trim();
            if (!v) return;
            if (row[key] !== v) {
                row[key] = v;
                dirty = true;
            }
        };
        set("cargoTrackingNumber", fields.cargoTrackingNumber);
        set("cargoTrackingLink", fields.cargoTrackingLink);
        set("cargoCompany", fields.cargoCompany);
        set("shipmentPackageId", fields.shipmentPackageId);
        set("orderItemId", fields.orderItemId);
        if (dirty) await row.save();
    } catch (e) {
        logger.warn(`[ShippingLabel] DB kargo alanı güncellenemedi: ${e.message}`);
    }
}

const parseTrendyolLabelDataArray = async (labels, tn) => {
    if (!Array.isArray(labels) || !labels.length) return null;

    const cargoEntries = labels.filter(
        (e) => !e.labelType || String(e.labelType).toUpperCase() === "CARGO"
    );
    const work = cargoEntries.length ? cargoEntries : labels;

    const parsed = [];
    for (const entry of work) {
        const p = await parseTrendyolLabelEntry(entry);
        if (p) parsed.push(p);
    }
    if (!parsed.length) return null;

    if (parsed.length === 1) {
        return { ...parsed[0], labelCount: 1, source: "trendyol_common_label" };
    }

    if (parsed[0].format === "zpl") {
        const zpl = work.map((x) => x.label).filter(Boolean).join("\n");
        return {
            format: "zpl",
            mimeType: "application/zpl",
            filename: `trendyol-label-${tn}.zpl`,
            contentBase64: Buffer.from(zpl, "utf8").toString("base64"),
            labelCount: work.length,
            source: "trendyol_common_label",
            hint: "Trendyol ortak etiket (ZPL). Termal yazıcıda yazdırın.",
        };
    }
    return { ...parsed[0], labelCount: work.length, source: "trendyol_common_label" };
};

async function parseTrendyolLabelEntry(entry) {
    const format = String(entry?.format || "ZPL").toUpperCase();
    const label = String(entry?.label || "").trim();
    if (!label) return null;
    if (isMutualBarcodeUnavailable(label) || /^API:\s*\{/i.test(label)) return null;

    if (
        (format === "PDF" || label.startsWith("http://") || label.startsWith("https://")) &&
        (label.startsWith("http://") || label.startsWith("https://"))
    ) {
        const pdfRes = await axios.get(label, { responseType: "arraybuffer", timeout: 30000 });
        return {
            format: "pdf",
            mimeType: "application/pdf",
            filename: "trendyol-label.pdf",
            contentBase64: Buffer.from(pdfRes.data).toString("base64"),
        };
    }

    return {
        format: "zpl",
        mimeType: "application/zpl",
        filename: "trendyol-label.zpl",
        contentBase64: Buffer.from(label, "utf8").toString("base64"),
        hint: "Termal yazıcı için ZPL; önizleme panelde otomatik oluşturulur.",
    };
}

async function trendyolTryGetCommonLabel(credentials, tn, pkgMeta = null) {
    const { sellerId } = normalizeTyCredentials(credentials);
    const headers = buildTrendyolHeaders(credentials);
    const encodedTn = encodeURIComponent(tn);

    const getUrls = [
        `${TY_BASE}/sellers/${sellerId}/common-label/${encodedTn}`,
    ];
    if (pkgMeta?.micro || pkgMeta?.commercial) {
        getUrls.unshift(
            `${TY_BASE}/sellers/${sellerId}/common-labels/${encodedTn}/with-product-labels?productLabelType=ZPL`
        );
    }
    getUrls.push(`${TY_BASE}/sellers/${sellerId}/common-label/query?id=${encodedTn}`);

    for (const getUrl of getUrls) {
        try {
            const res = await axios.get(getUrl, { headers, timeout: 25000, validateStatus: () => true });
            if (res.status !== 200) continue;
            const hit = await parseTrendyolLabelDataArray(res.data?.data, tn);
            if (hit) return hit;
        } catch {
            /* sonraki URL */
        }
    }
    return null;
}

async function fetchTrendyolLabelFromApi(credentials, cargoTrackingNumber, pkgMeta = null) {
    const { sellerId } = normalizeTyCredentials(credentials);
    const tn = String(cargoTrackingNumber || "").trim();
    if (!tn) throw new Error("Trendyol kargo takip numarası gerekli.");

    const headers = buildTrendyolHeaders(credentials);
    const encodedTn = encodeURIComponent(tn);
    const boxQuantity = trendyolBoxQuantity(pkgMeta);

    let existing = await trendyolTryGetCommonLabel(credentials, tn, pkgMeta);
    if (existing) return existing;

    const postRes = await axios.post(
        `${TY_BASE}/sellers/${sellerId}/common-label/${encodedTn}`,
        { format: "ZPL", boxQuantity, volumetricHeight: 1 },
        { headers, timeout: 25000, validateStatus: () => true }
    );

    if (postRes.status !== 200) {
        const apiMsg = parseTrendyolApiError(postRes.data);
        if (isMutualBarcodeUnavailable(apiMsg)) {
            logger.info(
                `[ShippingLabel] Ortak etiket yok (${pkgMeta?.cargoProviderName || "kargo"}), A4 şablona geçilecek`
            );
            return null;
        }
        throw new Error(apiMsg || "Ortak etiket barkod talebi reddedildi.");
    }

    let lastErr = null;
    for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500 + attempt * 400));
        try {
            const hit = await trendyolTryGetCommonLabel(credentials, tn, pkgMeta);
            if (hit) return hit;
        } catch (err) {
            lastErr = err;
        }
    }

    const pollMsg = axiosErrorMessage(lastErr, "");
    if (isMutualBarcodeUnavailable(pollMsg)) return null;

    throw new Error(
        axiosErrorMessage(lastErr, "Trendyol ortak etiket henüz hazır değil; birkaç saniye sonra tekrar deneyin.")
    );
}

function buildTrendyolTrackingPortalResponse(meta) {
    const cargo = String(meta.cargoCompany || "Kargo").trim();
    const link = String(meta.cargoTrackingLink || "").trim();
    const tn = sanitizeCargoTracking(meta.cargoTrackingNumber);

    if (tn) {
        return buildTrendyolA4LabelResponse(meta);
    }

    if (link) {
        return {
            viewMode: "tracking_portal",
            format: "portal",
            cargoTrackingLink: link,
            cargoCompany: cargo,
            orderNumber: meta.orderNumber,
            source: "trendyol_tracking_portal",
            message: `${cargo} — Kargo takip sayfasından etiketinizi yazdırabilirsiniz.`,
        };
    }

    throw new Error(
        `${cargo}: Kargo takip numarası henüz oluşmadı. Birkaç saniye sonra tekrar deneyin veya sipariş listesini yenileyin.`
    );
}

async function fetchTrendyolLabel(
    credentials,
    cargoTrackingNumber,
    orderNumber,
    shipmentPackageId,
    cargoTrackingLinkHint = "",
    labelOpts = {}
) {
    const ty = normalizeTyCredentials(credentials);
    if (!ty.sellerId || !ty.apiKey || !ty.apiSecret) {
        throw new Error("Trendyol API bilgileri eksik (sellerId, apiKey, apiSecret).");
    }

    let tn = sanitizeCargoTracking(cargoTrackingNumber);
    let cargoTrackingLink = String(cargoTrackingLinkHint || "").trim();
    let pkgMeta = await fetchTrendyolPackageLive(credentials, orderNumber, shipmentPackageId);

    const autoCargo = await loadTrendyolAutoCargo(labelOpts.userId, labelOpts.marketplaceId);

    if (pkgMeta) {
        try {
            const prepared = await trendyolPreparePackageForLabel(credentials, pkgMeta, autoCargo);
            if (prepared) {
                pkgMeta =
                    (await fetchTrendyolPackageLive(credentials, orderNumber, shipmentPackageId)) ||
                    pkgMeta;
            }
        } catch (prepErr) {
            logger.warn(`[ShippingLabel] Paket hazırlık: ${axiosErrorMessage(prepErr)}`);
        }
        if (!tn && pkgMeta.cargoTrackingNumber != null) {
            tn = sanitizeCargoTracking(pkgMeta.cargoTrackingNumber);
        }
        if (!cargoTrackingLink) cargoTrackingLink = String(pkgMeta.cargoTrackingLink || "").trim();
    } else if (autoCargo?.id && shipmentPackageId) {
        throw new Error(
            `Sipariş paketi Trendyol'da bulunamadı (paket no: ${shipmentPackageId}). ` +
                `Siparişleri senkronize edin veya birkaç dakika sonra tekrar deneyin.`
        );
    }

    const cargoCompany =
        pkgMeta?.cargoProviderName ||
        pkgMeta?.cargoCompany ||
        autoCargo?.name ||
        "";
    const meta = extractLabelMetaFromPackage(pkgMeta, {
        orderNumber: orderNumber || pkgMeta?.orderNumber,
        cargoTrackingNumber: tn,
        cargoCompany,
        cargoTrackingLink,
        shipmentPackageId: shipmentPackageId || String(pkgMeta?.shipmentPackageId || pkgMeta?.id || ""),
    });

    if (tn) {
        const useCommonLabelApi = isTrendyolCommonLabelEligible(cargoCompany);
        if (useCommonLabelApi) {
            try {
                const label = await fetchTrendyolLabelFromApi(credentials, tn, pkgMeta);
                if (label) {
                    return {
                        ...label,
                        cargoTrackingNumber: tn,
                        cargoTrackingLink: cargoTrackingLink || undefined,
                        cargoCompany,
                    };
                }
            } catch (apiErr) {
                const apiMsg = axiosErrorMessage(apiErr);
                if (isMutualBarcodeUnavailable(apiErr) || isMutualBarcodeUnavailable(apiMsg)) {
                    logger.info(
                        `[ShippingLabel] ${cargoCompany}: ortak etiket yok, panel A4 kullanılıyor.`
                    );
                } else {
                    logger.warn(`[ShippingLabel] Ortak etiket (${cargoCompany}): ${apiMsg}`);
                }
            }
        }
        return buildTrendyolA4LabelResponse(meta);
    }

    return buildTrendyolTrackingPortalResponse(meta);
}

async function verifyHbPackageNumber(credentials, packageNumber, useSitOverride) {
    const pkgNo = String(packageNumber || "").trim();
    if (!pkgNo) return false;
    try {
        const { merchantId, ep, headers } = buildHbApiContext(credentials, useSitOverride);
        const url = `${ep.OMS}/packages/merchantid/${merchantId}/packagenumber/${encodeURIComponent(pkgNo)}`;
        const res = await axios.get(url, { headers, timeout: 15000, validateStatus: () => true });
        return res.status === 200 && res.data;
    } catch {
        return false;
    }
}

async function resolveHepsiburadaPackageNumber(credentials, orderNumber, packageNumberHint, useSitOverride) {
    const hint = String(packageNumberHint || "").trim();
    const target = String(orderNumber || "").trim();

    if (hint && hint !== target && (await verifyHbPackageNumber(credentials, hint, useSitOverride))) {
        return hint;
    }

    const { merchantId, ep, headers } = buildHbApiContext(credentials, useSitOverride);

    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const beginDate = momentHb(start);
    const endDate = momentHb(end);

    const paths = ["packages", "shipped", "delivered", "orders"];
    for (const path of paths) {
        for (let offset = 0; offset < 200; offset += 50) {
            try {
                const url =
                    `${ep.OMS}/${path}/merchantid/${merchantId}` +
                    `?startDate=${encodeURIComponent(beginDate)}&endDate=${encodeURIComponent(endDate)}` +
                    `&limit=50&offset=${offset}`;
                const res = await axios.get(url, { headers, timeout: 25000 });
                const list = Array.isArray(res.data)
                    ? res.data
                    : res.data?.packages || res.data?.items || res.data?.content || [];
                if (!list.length) break;

                for (const pkg of list) {
                    if (hbOrderMatchesTarget(pkg, target) && (pkg.packageNumber || pkg.PackageNumber)) {
                        return String(pkg.packageNumber || pkg.PackageNumber);
                    }
                }
                if (list.length < 50) break;
            } catch (err) {
                logger.warn(`[ShippingLabel] HB paket arama (${path}): ${axiosErrorMessage(err)}`);
                break;
            }
        }
    }
    return hint || null;
}

function momentHb(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
}

async function fetchHbPackageDetail(credentials, packageNumber, useSitOverride) {
    const { merchantId, ep, headers } = buildHbApiContext(credentials, useSitOverride);
    const url = `${ep.OMS}/packages/merchantid/${merchantId}/packagenumber/${encodeURIComponent(packageNumber)}`;
    const res = await axios.get(url, { headers, timeout: 20000, validateStatus: () => true });
    if (res.status !== 200) return null;
    const raw = res.data;
    if (Array.isArray(raw) && raw.length) return normalizeHbOmsItem(raw[0]);
    if (raw && typeof raw === "object") return normalizeHbOmsItem(raw);
    return null;
}

async function fetchHepsiburadaLabelViaBarcode(credentials, barcode, useSitOverride) {
    const { ep, headers } = buildHbApiContext(credentials, useSitOverride);
    const url = `${ep.OMS}/delivery/barcodes-label?format=PDF`;
    const res = await axios.post(
        url,
        { barcodes: [String(barcode)] },
        { headers, timeout: 30000, validateStatus: () => true }
    );
    if (res.status !== 200) {
        const msg = formatApiBody(res.data) || `HTTP ${res.status}`;
        if (isMutualBarcodeUnavailable(msg)) return null;
        throw new Error(msg);
    }
    const b64 = extractHbLabelBase64(res.data);
    if (!b64) return null;
    return b64.replace(/^data:application\/pdf;base64,/i, "");
}

function buildHepsiburadaA4Fallback(pkgNo, detail, dbBase = {}) {
    const barcode = sanitizeCargoTracking(
        detail?.barcode ||
            detail?.Barcode ||
            detail?.trackingInfoCode ||
            dbBase.cargoTrackingNumber ||
            dbBase.trackingNumber
    );
    const cargoCompany =
        dbBase.cargoCompany ||
        detail?.cargoCompany ||
        detail?.cargoCompanyModel?.name ||
        "Hepsiburada Kargo";

    const ship = detail?.shippingAddress || detail?.recipient || {};
    const meta = {
        orderNumber: dbBase.orderNumber || resolveHepsiburadaOrderNumber(detail) || "",
        customerName:
            dbBase.customerName ||
            detail?.recipientName ||
            detail?.customerName ||
            ship?.name ||
            ship?.fullName ||
            "—",
        fullAddress:
            dbBase.fullAddress ||
            ship?.address ||
            ship?.fullAddress ||
            ship?.addressDetail ||
            detail?.shippingAddressDetail ||
            "",
        city: dbBase.city || ship?.city || "",
        district: dbBase.district || ship?.district || "",
        cargoTrackingNumber: barcode,
        cargoCompany,
        marketplaceDisplay: "Hepsiburada",
        shipmentNumber: pkgNo,
    };

    if (!barcode) {
        throw new Error(
            "Hepsiburada paket barkodu henüz oluşmadı. Siparişi «Gönderime hazır» yaptıktan sonra tekrar deneyin."
        );
    }

    return buildMarketplaceA4LabelResponse(meta, "hepsiburada");
}

async function fetchHepsiburadaLabel(credentials, orderNumber, packageNumber, dbBase = {}) {
    const hb = normHb(credentials);
    if (!hb.merchantId || !hb.secretKey) throw new Error("Hepsiburada API bilgileri eksik.");

    const merchantOrder = String(orderNumber || dbBase.orderNumber || "").trim();
    const pkgHint = String(packageNumber || "").trim();

    let useSit = coerceHepsiburadaUseSit(hb.useSit);
    try {
        useSit = await resolveHbUseSitAuto(hb);
    } catch (e) {
        logger.warn(`[ShippingLabel] HB ortam tespiti: ${e.message}`);
    }

    const cargoCompanyFromDetail = (detail) =>
        String(detail?.cargoCompany || detail?.cargoCompanyModel?.name || "").trim();

    const tryFetch = async (sitFlag) => {
        const pkgNo = await resolveHepsiburadaPackageNumber(
            credentials,
            merchantOrder,
            pkgHint,
            sitFlag
        );
        if (!pkgNo) {
            return {
                error: new Error(
                    "Hepsiburada paket numarası bulunamadı. Siparişi paketledikten (Paketlenecek → Gönderime hazır) sonra tekrar deneyin."
                ),
            };
        }

        let detail = await fetchHbPackageDetail(credentials, pkgNo, sitFlag);
        const barcode =
            detail?.barcode ||
            detail?.Barcode ||
            sanitizeCargoTracking(dbBase.cargoTrackingNumber);

        const hb = normHb(credentials);
        if (
            merchantOrder &&
            (!detail?.shippingAddress && !dbBase.fullAddress && !dbBase.customerName)
        ) {
            try {
                const orderDetail = await fetchHbOrderByOrderNumber(
                    hb.merchantId,
                    hb.secretKey,
                    hb.userAgent,
                    merchantOrder,
                    sitFlag
                );
                if (orderDetail) {
                    const del = orderDetail.deliveryAddress || {};
                    dbBase = {
                        ...dbBase,
                        customerName: orderDetail.customer?.name || del.name || dbBase.customerName,
                        fullAddress: dbBase.fullAddress || del.address || "",
                        city: dbBase.city || del.city || "",
                        district: dbBase.district || del.district || del.town || "",
                        cargoCompany:
                            dbBase.cargoCompany ||
                            orderDetail.items?.[0]?.cargoCompany ||
                            orderDetail.items?.[0]?.cargoCompanyModel?.name,
                    };
                    if (!detail && orderDetail.items?.[0]) {
                        detail = normalizeHbOmsItem(orderDetail.items[0]);
                    }
                }
            } catch (e) {
                logger.warn(`[ShippingLabel] HB order detail: ${e.message}`);
            }
        }

        if (barcode) {
            try {
                const b64Barcode = await fetchHepsiburadaLabelViaBarcode(credentials, barcode, sitFlag);
                if (b64Barcode) {
                    return {
                        ok: {
                            format: "pdf",
                            mimeType: "application/pdf",
                            filename: `hepsiburada-label-${pkgNo}.pdf`,
                            contentBase64: b64Barcode,
                            packageNumber: pkgNo,
                            source: "hepsiburada_barcodes_label",
                        },
                    };
                }
            } catch (barErr) {
                if (!isMutualBarcodeUnavailable(barErr)) {
                    logger.warn(
                        `[ShippingLabel] HB barcodes-label (${sitFlag ? "SIT" : "PROD"}): ${axiosErrorMessage(barErr)}`
                    );
                }
            }
        }

        const { merchantId: mid, ep, headers } = buildHbApiContext(credentials, sitFlag);
        const labelUrl =
            `${ep.OMS}/packages/merchantid/${mid}/packagenumber/${encodeURIComponent(pkgNo)}/labels?format=PDF`;

        try {
            const res = await axios.get(labelUrl, { headers, timeout: 30000, validateStatus: () => true });
            if (res.status === 200) {
                const b64 = extractHbLabelBase64(res.data);
                if (b64) {
                    return {
                        ok: {
                            format: "pdf",
                            mimeType: "application/pdf",
                            filename: `hepsiburada-label-${pkgNo}.pdf`,
                            contentBase64: b64.replace(/^data:application\/pdf;base64,/i, ""),
                            packageNumber: pkgNo,
                            source: "hepsiburada_package_labels",
                        },
                    };
                }
            } else {
                const apiMsg = formatApiBody(res.data) || `HTTP ${res.status}`;
                if (isMutualBarcodeUnavailable(apiMsg)) {
                    logger.info(
                        `[ShippingLabel] HB ortak barkod yok (${cargoCompanyFromDetail(detail)}), A4 şablon.`
                    );
                    return { ok: buildHepsiburadaA4Fallback(pkgNo, detail, dbBase) };
                }
                logger.warn(`[ShippingLabel] HB labels GET: ${apiMsg}`);
            }
        } catch (labelsErr) {
            const apiMsg = axiosErrorMessage(labelsErr);
            if (isMutualBarcodeUnavailable(labelsErr) || isMutualBarcodeUnavailable(apiMsg)) {
                logger.info(`[ShippingLabel] HB ortak barkod API atlandı, A4 şablon.`);
                return { ok: buildHepsiburadaA4Fallback(pkgNo, detail, dbBase) };
            }
            logger.warn(`[ShippingLabel] HB labels GET (${sitFlag ? "SIT" : "PROD"}): ${apiMsg}`);
        }

        try {
            return { ok: buildHepsiburadaA4Fallback(pkgNo, detail, dbBase) };
        } catch (a4Err) {
            return { error: a4Err };
        }
    };

    let result = await tryFetch(useSit);
    if (result.ok) return result.ok;

    const st = result.error?.response?.status;
    if (st === 401 || st === 403) {
        result = await tryFetch(!useSit);
        if (result.ok) return result.ok;
    }

    if (isMutualBarcodeUnavailable(result.error)) {
        try {
            return buildHepsiburadaA4Fallback(pkgHint, null, dbBase);
        } catch {
            /* aşağıdaki genel hata */
        }
    }

    const msg = axiosErrorMessage(
        result.error,
        "Hepsiburada etiket alınamadı. Mağaza ID / Servis Anahtarı ve SIT-Canlı ortam seçimini kontrol edin."
    );
    const err = new Error(msg);
    if (st) err.status = st;
    throw err;
}

async function loadMarketplaceCredentials(userId, marketplaceName, marketplaceId) {
    let mp;
    if (marketplaceId) {
        mp = await Marketplace.findOne({ _id: marketplaceId, userId });
    } else {
        const key = normalizeMp(marketplaceName);
        const all = await Marketplace.find({ userId, isActive: { $ne: false } });
        mp = all.find((m) => normalizeMp(m.marketplaceName) === key);
    }
    if (!mp) throw new Error("Pazaryeri entegrasyonu bulunamadı.");
    return { marketplace: mp, credentials: decryptCredentials(mp.credentials || {}) };
};

async function getShippingLabelForOrder(userId, params = {}) {
    let marketplaceName = params.marketplaceName || params.marketplace;
    let orderNumber = params.orderNumber;
    let cargoTrackingNumber = sanitizeCargoTracking(params.cargoTrackingNumber);
    const trackingFallback = sanitizeCargoTracking(params.trackingNumber);
    if (!cargoTrackingNumber && trackingFallback) {
        cargoTrackingNumber = trackingFallback;
    }
    let packageNumber = params.packageNumber;
    let shipmentPackageId = params.shipmentPackageId;
    let cargoTrackingLink = params.cargoTrackingLink || "";

    if (!marketplaceName && !params.marketplaceId) {
        throw new Error("Pazaryeri bilgisi eksik.");
    }
    if (!orderNumber && !params.orderId && !packageNumber && !cargoTrackingNumber) {
        throw new Error("Sipariş numarası veya kargo takip numarası gerekli.");
    }

    let orderRow = null;
    if (params.orderId) {
        orderRow = await Order.findOne({ _id: params.orderId, user: userId }).lean();
        if (!orderRow) throw new Error("Sipariş bulunamadı.");
        marketplaceName = orderRow.marketplaceName;
        orderNumber = orderNumber || orderRow.trackingNumber;
        cargoTrackingNumber =
            cargoTrackingNumber || sanitizeCargoTracking(orderRow.cargoTrackingNumber);
        packageNumber = packageNumber || orderRow.packageNumber;
        shipmentPackageId = shipmentPackageId || orderRow.shipmentPackageId;
        cargoTrackingLink = cargoTrackingLink || orderRow.cargoTrackingLink || "";
    }

    const dbLabelBase = orderRow
        ? {
              orderNumber: orderNumber || orderRow.trackingNumber,
              orderItemId: orderRow.orderItemId,
              customerName: orderRow.customerName,
              cargoTrackingNumber: cargoTrackingNumber || orderRow.cargoTrackingNumber,
              cargoCompany: orderRow.cargoCompany,
              cargoTrackingLink: cargoTrackingLink || orderRow.cargoTrackingLink,
              fullAddress: [
                  orderRow.customerAddress?.street,
                  orderRow.customerAddress?.district,
                  orderRow.customerAddress?.city,
              ]
                  .filter(Boolean)
                  .join(" "),
              city: orderRow.customerAddress?.city,
              district: orderRow.customerAddress?.district,
              status: orderRow.status,
          }
        : {};

    orderNumber = String(orderNumber || packageNumber || "").trim();

    const { marketplace, credentials } = await loadMarketplaceCredentials(
        userId,
        marketplaceName,
        params.marketplaceId
    );
    if (!marketplaceName && marketplace?.marketplaceName) {
        marketplaceName = marketplace.marketplaceName;
    }
    const mpKey = normalizeMp(marketplaceName);

    if (mpKey === "trendyol") {
        const label = await fetchTrendyolLabel(
            credentials,
            cargoTrackingNumber,
            orderNumber,
            shipmentPackageId,
            cargoTrackingLink,
            {
                userId,
                marketplaceId: marketplace?._id || params.marketplaceId,
            }
        );
        await persistOrderCargoFields(userId, orderNumber, params.orderId, {
            cargoTrackingNumber: label.cargoTrackingNumber,
            cargoTrackingLink: label.cargoTrackingLink,
            cargoCompany: label.cargoCompany,
            shipmentPackageId,
        }, /trendyol/i);
        return { marketplace: "Trendyol", orderNumber, ...label };
    }

    if (mpKey === "hepsiburada") {
        const hbOrderNo = String(
            params.orderNumber || orderRow?.trackingNumber || orderNumber || ""
        ).trim();
        const hbPkg = String(packageNumber || orderRow?.packageNumber || "").trim();
        const label = await fetchHepsiburadaLabel(credentials, hbOrderNo, hbPkg, {
            ...dbLabelBase,
            orderNumber: hbOrderNo,
            trackingNumber: orderRow?.trackingNumber,
        });
        return { marketplace: "Hepsiburada", orderNumber: hbOrderNo, ...label };
    }

    if (mpKey === "n11") {
        const label = await fetchN11Label(credentials, {
            ...dbLabelBase,
            orderNumber,
            cargoTrackingNumber,
            cargoTrackingLink,
            shipmentPackageId,
        });
        return { marketplace: "N11", orderNumber, ...label };
    }

    if (mpKey === "ciceksepeti") {
        const label = await fetchCiceksepetiLabel(credentials, {
            ...dbLabelBase,
            orderNumber,
            orderItemId: params.orderItemId || dbLabelBase.orderItemId,
            cargoTrackingNumber,
            cargoTrackingLink,
        });
        if (label.labelData?.cargoTrackingNumber) {
            await persistOrderCargoFields(
                userId,
                orderNumber,
                params.orderId,
                {
                    cargoTrackingNumber: label.labelData.cargoTrackingNumber,
                    cargoCompany: label.cargoCompany || label.labelData.cargoCompany,
                    orderItemId: label.labelData.orderItemId || dbLabelBase.orderItemId || params.orderItemId,
                },
                /cicek|çiçek/i
            );
        }
        return { marketplace: "ÇiçekSepeti", orderNumber, ...label };
    }

    if (mpKey === "amazon" || mpKey === "pttavm") {
        const tn = sanitizeCargoTracking(cargoTrackingNumber || dbLabelBase.cargoTrackingNumber);
        if (!tn) {
            throw new Error(
                `${mpKey === "amazon" ? "Amazon" : "PttAVM"}: Kargo takip / barkod numarası yok. ` +
                    `Siparişi senkronize edin veya pazaryeri panelinden takip no girin.`
            );
        }
        const label = buildMarketplaceA4LabelResponse(
            {
                ...dbLabelBase,
                orderNumber,
                cargoTrackingNumber: tn,
                marketplaceDisplay: mpKey === "amazon" ? "Amazon" : "PttAVM",
            },
            mpKey
        );
        return {
            marketplace: mpKey === "amazon" ? "Amazon" : "PttAVM",
            orderNumber,
            ...label,
        };
    }

    if (mpKey === "ozon") {
        const { fetchOzonPackageLabel } = require("./ozon/ozonService");
        const pn = String(packageNumber || orderNumber || "").trim();
        if (!pn) throw new Error("Ozon posting_number (sipariş no) gerekli.");
        try {
            const label = await fetchOzonPackageLabel(credentials, pn);
            return { marketplace: "Ozon", orderNumber, ...label };
        } catch (err) {
            const e = new Error(axiosErrorMessage(err, "Ozon etiket alınamadı"));
            e.status = err.status;
            throw e;
        }
    }

    throw new Error(`Bu pazaryeri için kargo etiketi desteklenmiyor: ${marketplaceName}`);
}

module.exports = {
    getShippingLabelForOrder,
    normalizeMp,
};
