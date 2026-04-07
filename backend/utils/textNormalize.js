/**
 * TÜRKÇE METİN NORMALİZASYON YARDIMCILARI
 *
 * Tüm kategori eşleştirme servisleri bu modülü kullanır.
 * Tekrar eden normalize() / normalizeKey() fonksiyonları kaldırıldı — tek kaynak.
 *
 * v2.1 Değişiklikler:
 *   - normalizeKey() buraya taşındı (unifiedCategoryImportService'den)
 *   - extractMeaningfulWords() çift filtreleme düzeltildi (>2 → >=2)
 */

/**
 * Türkçe karakterleri ASCII'ye çevir + küçük harf + özel karakter temizle
 * @param {string} text
 * @returns {string}
 */
const normalize = (text) => {
    if (!text) return "";
    return text
        .toLowerCase()
        .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
        .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

/**
 * DB normalizedKey alanı için kullanılan normalize fonksiyonu.
 * normalize() ile birebir aynı çıktıyı üretir — duplicate kod yerine alias.
 * Tek kaynak: Hem import (DB yazma) hem resolve (DB okuma) bu fonksiyonu kullanır.
 *
 * @param {string} name
 * @returns {string}
 */
const normalizeKey = normalize;

/**
 * Metni kelimelere ayır (min 2 karakter)
 * @param {string} text
 * @returns {string[]}
 */
const extractWords = (text) => normalize(text).split(/\s+/).filter(w => w.length > 1);

/**
 * Türkçe stopword listesi
 */
const STOPWORDS_TR = new Set([
    "ve", "ile", "icin", "bir", "bu", "da", "de", "mi", "mu",
    "den", "dan", "nin", "nun", "ler", "lar", "dir", "dır",
    "ki", "ya", "veya", "ama", "hem", "ne", "her", "en",
    "cok", "az", "var", "yok", "olan", "gibi", "kadar"
]);

/**
 * Anlamlı kelimeleri çıkar (stopword filtresi)
 * Not: extractWords zaten length > 1 filtresi uygular.
 *      Burada ek olarak sadece stopword filtresi yapılır.
 *      Eski hali w.length > 2 idi — 2 karakterlik anlamlı kelimeler ("uv", "tv") kaybediliyordu.
 * @param {string} text
 * @returns {string[]}
 */
const extractMeaningfulWords = (text) =>
    extractWords(text).filter(w => !STOPWORDS_TR.has(w));

module.exports = { normalize, normalizeKey, extractWords, extractMeaningfulWords, STOPWORDS_TR };
