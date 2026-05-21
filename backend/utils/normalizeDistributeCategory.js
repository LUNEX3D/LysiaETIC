/**
 * Dağıtım / sync isteklerinde kategori alanlarını güvenli normalize eder.
 * path string | array | categoryPath — hepsi desteklenir (.split hatası önlenir).
 */
const normalizeDistributeCategory = (category) => {
    if (!category || typeof category !== "object") return null;

    const idRaw =
        category.id ??
        category.categoryId ??
        category.externalCategoryId;
    if (idRaw == null || String(idRaw).trim() === "") return null;

    const name = String(
        category.name || category.categoryName || category.externalCategoryName || ""
    ).trim();

    let pathArr;
    if (Array.isArray(category.path)) {
        pathArr = category.path.map((s) => String(s).trim()).filter(Boolean);
    } else if (Array.isArray(category.categoryPath)) {
        pathArr = category.categoryPath.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof category.path === "string" && category.path.trim()) {
        pathArr = category.path.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean);
    } else if (typeof category.categoryPath === "string" && category.categoryPath.trim()) {
        pathArr = category.categoryPath.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean);
    } else if (typeof category.externalCategoryPath === "string" && category.externalCategoryPath.trim()) {
        pathArr = category.externalCategoryPath.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean);
    } else if (name) {
        pathArr = [name];
    } else {
        pathArr = [];
    }

    return {
        id: String(idRaw).trim(),
        name: name || pathArr[pathArr.length - 1] || "Kategori",
        path: pathArr,
        pathDisplay: pathArr.join(" > ")
    };
};

module.exports = { normalizeDistributeCategory };
