/**
 * Hatalı / şüpheli master kategori → platform eşleştirmelerini otomatik onarır.
 * Kaynak: yerel kategori ağaçları (JSON) + isteğe bağlı CategoryCache (HB).
 */
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const MasterCategoryMapping = require("../models/MasterCategoryMapping");
const CategoryCache = require("../models/CategoryCache");
const {
    getMasterPathText,
    findBestMatches,
    buildTargetIndex,
    validateMappingQuality,
    coerceCategoryId,
    DEFAULT_MATCH_OPTIONS,
} = require("./categoryAutoMatchService");

const TREE_DIR = path.join(__dirname, "..", "category-trees");

const PLATFORM_REPAIR_CONFIG = [
    {
        key: "n11",
        idField: "n11Id",
        pathField: "n11Path",
        treeFile: "categories-n11.json",
        isFlat: false,
    },
    {
        key: "ciceksepeti",
        idField: "ciceksepetiId",
        pathField: "ciceksepetiPath",
        treeFile: "categories-ciceksepeti.json",
        isFlat: false,
    },
    {
        key: "hepsiburada",
        idField: "hepsiburadaId",
        pathField: "hepsiburadaPath",
        treeFile: null,
        isFlat: true,
        cacheName: /hepsiburada/i,
    },
    {
        key: "amazon",
        idField: "amazonId",
        pathField: "amazonPath",
        treeFile: null,
        isFlat: false,
        cacheName: /amazon/i,
    },
];

const decodeHtml = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&gt;/gi, ">")
        .replace(/&lt;/gi, "<")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/gi, " ");
};

const flattenNestedLeaves = (categories, parentPath = []) => {
    const out = [];
    if (!Array.isArray(categories)) return out;
    for (const cat of categories) {
        const name = decodeHtml(cat.name || cat.categoryName || cat.title || "").trim();
        const id = cat.id ?? cat.categoryId;
        const catPath = [...parentPath, name];
        const pathStr = catPath.join(" > ");
        const subs = cat.subCategories || cat.children || cat.subCats || [];
        const hasChildren = Array.isArray(subs) && subs.length > 0;
        if (!hasChildren) {
            out.push({ id, name, path: pathStr, leaf: true });
        } else {
            out.push(...flattenNestedLeaves(subs, catPath));
        }
    }
    return out;
};

const flattenHbListable = (categories) => {
    if (!Array.isArray(categories)) return [];
    return categories
        .filter((c) => c && (c.canListProduct === true || (c.leaf === true && c.available !== false)))
        .map((c) => {
            const id = c.categoryId ?? c.id;
            let pathStr = "";
            if (Array.isArray(c.paths) && c.paths.length) {
                pathStr = c.paths.map((p) => (typeof p === "string" ? p : p?.name || "")).filter(Boolean).join(" > ");
            }
            if (!pathStr) pathStr = decodeHtml(c.pathDisplay || c.name || c.categoryName || "");
            return { id, name: decodeHtml(c.name || c.categoryName || ""), path: pathStr, leaf: true };
        })
        .filter((t) => t.id != null && t.path);
};

const loadTargetsFromJson = (treeFile, isFlat) => {
    const fp = path.join(TREE_DIR, treeFile);
    if (!fs.existsSync(fp)) return null;
    const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
    const roots = raw.categories || raw;
    if (isFlat) return flattenHbListable(roots);
    return flattenNestedLeaves(roots);
};

const loadTargetsFromDbCache = async (nameRegex) => {
    const doc = await CategoryCache.findOne({ marketplaceName: nameRegex })
        .sort({ updatedAt: -1 })
        .lean();
    if (!doc?.categories?.length) return null;
    const isHb = /hepsiburada/i.test(doc.marketplaceName || "");
    if (isHb) return flattenHbListable(doc.categories);
    return flattenNestedLeaves(doc.categories);
};

const warmHepsiburadaCategoryCache = async () => {
    const existing = await loadTargetsFromDbCache(/hepsiburada/i);
    if (existing?.length) return existing;

    try {
        const Marketplace = require("../models/Marketplace");
        const { decryptCredentials } = require("../utils/encryption");
        const hb = require("./hepsiburadaService");
        const mp = await Marketplace.findOne({
            marketplaceName: { $regex: /hepsiburada/i },
            isActive: { $ne: false },
        })
            .sort({ updatedAt: -1 })
            .lean();
        if (!mp?.credentials) return null;

        const creds = hb.normalizeCredentials(decryptCredentials(mp.credentials));
        const validation = hb.validateCredentials(creds, "kategori onarım");
        if (!validation.valid) return null;

        const userEp = hb.getEndpoints(creds);
        const useSit = userEp.MPOP === hb.HB_SIT_ENDPOINTS.MPOP;
        const categories = await hb.fetchHepsiburadaCategories(
            creds.merchantId,
            creds.secretKey,
            creds.userAgent,
            { onlyLeaf: true, useSit, forUi: true }
        );
        if (!categories?.length) return null;

        await CategoryCache.findOneAndUpdate(
            { userId: mp.userId, marketplaceName: mp.marketplaceName },
            {
                categories,
                totalCount: categories.length,
                cachedAt: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
            { upsert: true }
        );
        logger.info(`[CATEGORY REPAIR] HB cache ısıtıldı: ${categories.length} kategori`);
        return flattenHbListable(categories);
    } catch (err) {
        logger.warn(`[CATEGORY REPAIR] HB cache ısıtma başarısız: ${err.message}`);
        return null;
    }
};

const loadPlatformTargets = async (platformCfg) => {
    if (platformCfg.treeFile) {
        const t = loadTargetsFromJson(platformCfg.treeFile, platformCfg.isFlat);
        if (t?.length) return t;
    }
    if (platformCfg.cacheName) {
        let t = await loadTargetsFromDbCache(platformCfg.cacheName);
        if (!t?.length && platformCfg.key === "hepsiburada") {
            t = await warmHepsiburadaCategoryCache();
        }
        if (t?.length) return t;
    }
    return null;
};

const hasPlatformMapping = (row, idField) => {
    const v = row[idField];
    return v != null && v !== "" && v !== 0 && v !== "0";
};

/**
 * @param {object} opts
 * @param {boolean} [opts.dryRun=true]
 * @param {string[]} [opts.platforms] - n11, ciceksepeti, ...
 * @param {boolean} [opts.includeManual=true] - hatalı manual satırları da düzelt
 * @param {number} [opts.minScore]
 */
async function repairInvalidCategoryMappings(opts = {}) {
    const dryRun = opts.dryRun !== false;
    const includeManual = opts.includeManual !== false;
    const minScore = Number(opts.minScore) || 55;
    const minGap = DEFAULT_MATCH_OPTIONS.minGap;
    const platformFilter = Array.isArray(opts.platforms) && opts.platforms.length
        ? opts.platforms.map((p) => String(p).toLowerCase())
        : null;

    const activePlatforms = PLATFORM_REPAIR_CONFIG.filter(
        (p) => !platformFilter || platformFilter.includes(p.key)
    );

    const targetByPlatform = {};
    for (const pl of activePlatforms) {
        targetByPlatform[pl.key] = await loadPlatformTargets(pl);
        logger.info(
            `[CATEGORY REPAIR] ${pl.key}: ${targetByPlatform[pl.key]?.length ?? 0} hedef kategori yüklendi`
        );
    }

    const indexByPlatform = {};
    for (const pl of activePlatforms) {
        const targets = targetByPlatform[pl.key];
        if (targets?.length) indexByPlatform[pl.key] = buildTargetIndex(targets);
    }

    const allRows = await MasterCategoryMapping.find({}).lean();
    const repairs = [];
    const skipped = [];
    const unrepaired = [];

    for (const row of allRows) {
        const masterPath = getMasterPathText(row);
        if (!masterPath) continue;

        for (const pl of activePlatforms) {
            if (!hasPlatformMapping(row, pl.idField)) continue;
            const currentPath = String(row[pl.pathField] || "").trim();
            if (!currentPath) continue;
            if (!includeManual && row.manual === true) {
                skipped.push({ masterPath, platform: pl.key, reason: "manual_protected" });
                continue;
            }

            const quality = validateMappingQuality(masterPath, currentPath);
            if (quality.ok) continue;

            // Yalnızca anlamsal çelişki veya çok zayıf eşleşmeleri onar (yanlış pozitif riskini azaltır)
            const repairable = quality.confidence === "conflict" || quality.confidence === "weak";
            if (!repairable) {
                skipped.push({ masterPath, platform: pl.key, reason: `not_auto_repairable:${quality.confidence}` });
                continue;
            }

            const targets = targetByPlatform[pl.key];
            const index = indexByPlatform[pl.key];
            if (!targets?.length || !index) {
                unrepaired.push({
                    masterId: row.masterId,
                    masterPath,
                    platform: pl.key,
                    currentPath,
                    warning: quality.warning,
                    reason: "no_target_tree",
                });
                continue;
            }

            const matchResult = findBestMatches(masterPath, targets, {
                minScore,
                minGap,
                _index: index,
                bestEffort: true,
                aggressive: true,
            });

            const pick = matchResult.best;
            if (!pick?.path) {
                unrepaired.push({
                    masterId: row.masterId,
                    masterPath,
                    platform: pl.key,
                    currentPath,
                    warning: quality.warning,
                    reason: matchResult.reason || "no_match",
                });
                continue;
            }

            const newQuality = validateMappingQuality(masterPath, pick.path);
            const minCandidateScore = quality.confidence === "conflict" ? 65 : 78;
            const candidateOk =
                newQuality.ok &&
                pick.score >= minCandidateScore &&
                ["high", "medium"].includes(newQuality.confidence);

            if (!candidateOk) {
                unrepaired.push({
                    masterId: row.masterId,
                    masterPath,
                    platform: pl.key,
                    currentPath,
                    candidatePath: pick.path,
                    candidateScore: pick.score,
                    warning: quality.warning,
                    reason: "candidate_not_confident_enough",
                });
                continue;
            }

            const newId = coerceCategoryId(pick.id);
            const oldId = coerceCategoryId(row[pl.idField]);
            if (String(newId) === String(oldId) && pick.path === currentPath) {
                skipped.push({ masterPath, platform: pl.key, reason: "same_mapping" });
                continue;
            }

            repairs.push({
                mappingId: row._id,
                masterId: row.masterId,
                masterName: row.masterName,
                masterPath,
                platform: pl.key,
                idField: pl.idField,
                pathField: pl.pathField,
                oldId,
                oldPath: currentPath,
                newId,
                newPath: pick.path,
                oldWarning: quality.warning,
                newScore: pick.score,
                wasManual: !!row.manual,
            });
        }
    }

    let updated = 0;
    if (!dryRun && repairs.length > 0) {
        const bulkOps = repairs.map((r) => ({
            updateOne: {
                filter: { _id: r.mappingId },
                update: {
                    $set: {
                        [r.idField]: r.newId,
                        [r.pathField]: r.newPath,
                        manual: false,
                        source: "auto_repair",
                    },
                },
            },
        }));
        const CHUNK = 200;
        for (let i = 0; i < bulkOps.length; i += CHUNK) {
            const res = await MasterCategoryMapping.bulkWrite(bulkOps.slice(i, i + CHUNK), { ordered: false });
            updated += res.modifiedCount || 0;
        }
    }

    return {
        dryRun,
        scannedRows: allRows.length,
        repairs,
        repairCount: repairs.length,
        updated,
        skippedCount: skipped.length,
        unrepairedCount: unrepaired.length,
        unrepaired: unrepaired.slice(0, 100),
        samples: repairs.slice(0, 25),
    };
}

module.exports = {
    repairInvalidCategoryMappings,
    PLATFORM_REPAIR_CONFIG,
};
