/**
 * BİRLEŞİK KATEGORİ İMPORT SERVİSİ
 *
 * 3 platformun (Trendyol, N11, ÇiçekSepeti) Excel'lerinden kategori verilerini
 * okur, normalize eder, eşleştirir ve UnifiedCategoryMap tablosuna kaydeder.
 */

const XLSX = require("xlsx");
const UnifiedCategoryMap = require("../models/UnifiedCategoryMap");
const logger = require("../config/logger");

const LOG_PREFIX = "[UNIFIED CAT]";

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE
// ─────────────────────────────────────────────────────────────────────────────

const normalizeKey = (name) => {
    if (!name) return "";
    return name
        .toLowerCase()
        .trim()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const extractRoot = (path) => {
    if (!path) return "";
    return path.split(" > ")[0].trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Buffer'dan Excel parse et
 * Headers: Kategori ID, Kategori Adı, Kategori Yolu, Derinlik, Üst Kategori ID, Üst Kategori Adı, Alt Kategori Sayısı, Tür, Pazar Yeri
 */
const parseExcelBuffer = (buffer) => {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

    return rows.map(r => ({
        categoryId:   String(r[0] || ""),
        categoryName: String(r[1] || "").trim(),
        categoryPath: String(r[2] || "").trim(),
        depth:        Number(r[3]) || 0,
        parentId:     r[4] === "—" ? null : String(r[4] || ""),
        parentName:   r[5] === "— (Kök)" ? null : String(r[5] || "").trim(),
        childCount:   Number(r[6]) || 0,
        type:         String(r[7] || ""),
        marketplace:  String(r[8] || "").trim(),
        isLeaf:       String(r[7] || "").includes("Yaprak")
    })).filter(r => r.categoryName);
};

// ─────────────────────────────────────────────────────────────────────────────
// EŞLEŞTİRME MOTORU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 3 platformun verilerini normalize isim bazlı eşleştir.
 */
const buildUnifiedMap = (trendyolRows, n11Rows, ciceksepetiRows) => {
    logger.info(`${LOG_PREFIX} Eşleştirme — T:${trendyolRows.length} N:${n11Rows.length} C:${ciceksepetiRows.length}`);

    // Her platformu normalizedKey ile indexle
    const tMap = new Map();
    const nMap = new Map();
    const cMap = new Map();

    for (const row of trendyolRows) {
        const key = normalizeKey(row.categoryName);
        if (key && !tMap.has(key)) tMap.set(key, row);
    }
    for (const row of n11Rows) {
        const key = normalizeKey(row.categoryName);
        if (key && !nMap.has(key)) nMap.set(key, row);
    }
    for (const row of ciceksepetiRows) {
        const key = normalizeKey(row.categoryName);
        if (key && !cMap.has(key)) cMap.set(key, row);
    }

    // Tüm benzersiz anahtarları topla
    const allKeys = new Set([...tMap.keys(), ...nMap.keys(), ...cMap.keys()]);
    logger.info(`${LOG_PREFIX} Unique: T:${tMap.size} N:${nMap.size} C:${cMap.size} → Toplam: ${allKeys.size}`);

    const records = [];
    let exact3 = 0, match2 = 0, single = 0;

    for (const key of allKeys) {
        const tRow = tMap.get(key) || null;
        const nRow = nMap.get(key) || null;
        const cRow = cMap.get(key) || null;

        let platformCount = 0;
        if (tRow) platformCount++;
        if (nRow) platformCount++;
        if (cRow) platformCount++;

        let matchType = "single";
        if (platformCount === 3) { matchType = "exact"; exact3++; }
        else if (platformCount === 2) { matchType = "2of3"; match2++; }
        else { single++; }

        const canonicalName = (tRow?.categoryName || nRow?.categoryName || cRow?.categoryName || "").trim();
        const paths = [tRow?.categoryPath, nRow?.categoryPath, cRow?.categoryPath].filter(Boolean);
        const canonicalPath = paths.sort((a, b) => (b || "").split(" > ").length - (a || "").split(" > ").length)[0] || "";
        const isLeaf = (tRow?.isLeaf || nRow?.isLeaf || cRow?.isLeaf) || false;

        const buildPlatform = (row) => row ? {
            categoryId:   row.categoryId,
            categoryName: row.categoryName,
            categoryPath: row.categoryPath,
            depth:        row.depth,
            parentId:     row.parentId,
            parentName:   row.parentName,
            isLeaf:       row.isLeaf
        } : null;

        records.push({
            canonicalName,
            normalizedKey: key,
            canonicalPath,
            rootCategory: extractRoot(canonicalPath),
            trendyol:     buildPlatform(tRow),
            n11:          buildPlatform(nRow),
            ciceksepeti:  buildPlatform(cRow),
            platformCount,
            matchType,
            isLeaf,
            notes: ""
        });
    }

    const stats = { totalUnique: allKeys.size, exact3, match2, single,
        trendyolTotal: tMap.size, n11Total: nMap.size, ciceksepetiTotal: cMap.size };

    logger.info(`${LOG_PREFIX} Sonuç — 3'ü ortak: ${exact3}, 2'si ortak: ${match2}, tekil: ${single}`);
    return { records, stats };
};

// ─────────────────────────────────────────────────────────────────────────────
// DB KAYIT
// ─────────────────────────────────────────────────────────────────────────────

const saveToDatabase = async (records, options = {}) => {
    const { clearExisting = false } = options;

    if (clearExisting) {
        const deleted = await UnifiedCategoryMap.deleteMany({});
        logger.info(`${LOG_PREFIX} ${deleted.deletedCount} kayıt silindi (clearExisting)`);
    }

    let inserted = 0, updated = 0, errors = 0;
    const batchSize = 500;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const bulkOps = batch.map(record => ({
            updateOne: {
                filter: { normalizedKey: record.normalizedKey },
                update: {
                    $set: {
                        canonicalName:  record.canonicalName,
                        canonicalPath:  record.canonicalPath,
                        rootCategory:   record.rootCategory,
                        trendyol:       record.trendyol,
                        n11:            record.n11,
                        ciceksepeti:    record.ciceksepeti,
                        platformCount:  record.platformCount,
                        matchType:      record.matchType,
                        isLeaf:         record.isLeaf
                    },
                    $setOnInsert: {
                        normalizedKey: record.normalizedKey,
                        notes: ""
                    }
                },
                upsert: true
            }
        }));

        try {
            const result = await UnifiedCategoryMap.bulkWrite(bulkOps, { ordered: false });
            inserted += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
        } catch (err) {
            if (err.writeErrors) {
                errors += err.writeErrors.length;
                inserted += (err.result?.nUpserted || 0);
                updated += (err.result?.nModified || 0);
            } else {
                logger.error(`${LOG_PREFIX} Batch hatası: ${err.message}`);
                errors += batch.length;
            }
        }
    }

    logger.info(`${LOG_PREFIX} DB — inserted:${inserted} updated:${updated} errors:${errors}`);
    return { inserted, updated, errors, total: records.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// ANA IMPORT
// ─────────────────────────────────────────────────────────────────────────────

const importFromBuffers = async (trendyolBuffer, n11Buffer, ciceksepetiBuffer, options = {}) => {
    logger.info(`${LOG_PREFIX} Import başlıyor...`);

    const tRows = trendyolBuffer ? parseExcelBuffer(trendyolBuffer) : [];
    const nRows = n11Buffer ? parseExcelBuffer(n11Buffer) : [];
    const cRows = ciceksepetiBuffer ? parseExcelBuffer(ciceksepetiBuffer) : [];

    const { records, stats } = buildUnifiedMap(tRows, nRows, cRows);
    const dbResult = await saveToDatabase(records, options);

    return {
        parseStats: { trendyol: tRows.length, n11: nRows.length, ciceksepeti: cRows.length },
        matchStats: stats,
        dbResult
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// MANUEL BİRLEŞTİRME
// ─────────────────────────────────────────────────────────────────────────────

const manualMerge = async (targetId, sourceId) => {
    const target = await UnifiedCategoryMap.findById(targetId);
    const source = await UnifiedCategoryMap.findById(sourceId);
    if (!target || !source) throw new Error("Kayıt bulunamadı");

    // Source'un platform verilerini target'a aktar (boş olanlara)
    if (source.trendyol?.categoryId && !target.trendyol?.categoryId) target.trendyol = source.trendyol;
    if (source.n11?.categoryId && !target.n11?.categoryId) target.n11 = source.n11;
    if (source.ciceksepeti?.categoryId && !target.ciceksepeti?.categoryId) target.ciceksepeti = source.ciceksepeti;

    // platformCount yeniden hesapla
    let count = 0;
    if (target.trendyol?.categoryId) count++;
    if (target.n11?.categoryId) count++;
    if (target.ciceksepeti?.categoryId) count++;
    target.platformCount = count;
    target.matchType = count === 3 ? "exact" : count === 2 ? "2of3" : "single";

    // En derin path'i al
    const paths = [target.trendyol?.categoryPath, target.n11?.categoryPath, target.ciceksepeti?.categoryPath].filter(Boolean);
    target.canonicalPath = paths.sort((a, b) => b.split(" > ").length - a.split(" > ").length)[0] || "";
    target.rootCategory = extractRoot(target.canonicalPath);

    await target.save();
    await UnifiedCategoryMap.findByIdAndDelete(sourceId);

    logger.info(`${LOG_PREFIX} Birleştirme: "${source.canonicalName}" → "${target.canonicalName}" (${count} platform)`);
    return target;
};

// ─────────────────────────────────────────────────────────────────────────────
// İSTATİSTİK
// ─────────────────────────────────────────────────────────────────────────────

const getStats = async () => {
    const [total, exact3, match2, singleCount, manual, leafCount, trendyolCount, n11Count, ciceksepetiCount] = await Promise.all([
        UnifiedCategoryMap.countDocuments({}),
        UnifiedCategoryMap.countDocuments({ matchType: "exact" }),
        UnifiedCategoryMap.countDocuments({ matchType: "2of3" }),
        UnifiedCategoryMap.countDocuments({ matchType: "single" }),
        UnifiedCategoryMap.countDocuments({ matchType: "manual" }),
        UnifiedCategoryMap.countDocuments({ isLeaf: true }),
        UnifiedCategoryMap.countDocuments({ "trendyol.categoryId": { $ne: null } }),
        UnifiedCategoryMap.countDocuments({ "n11.categoryId": { $ne: null } }),
        UnifiedCategoryMap.countDocuments({ "ciceksepeti.categoryId": { $ne: null } })
    ]);

    const rootDistribution = await UnifiedCategoryMap.aggregate([
        { $group: { _id: "$rootCategory", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 }
    ]);

    return {
        total, exact3, match2, single: singleCount, manual, leafCount,
        platforms: { trendyol: trendyolCount, n11: n11Count, ciceksepeti: ciceksepetiCount },
        rootDistribution: rootDistribution.map(r => ({ name: r._id || "Bilinmeyen", count: r.count }))
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    parseExcelBuffer,
    buildUnifiedMap,
    saveToDatabase,
    importFromBuffers,
    manualMerge,
    getStats,
    normalizeKey,
    extractRoot
};
