/**
 * TÜRKÇE METİN NORMALİZASYON YARDIMCILARI
 *
 * Tüm kategori eşleştirme servisleri bu modülü kullanır.
 * Tekrar eden normalize() fonksiyonları kaldırıldı — tek kaynak.
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
 * Anlamlı kelimeleri çıkar (stopword + kısa kelime filtresi)
 * @param {string} text
 * @returns {string[]}
 */
const extractMeaningfulWords = (text) =>
    extractWords(text).filter(w => !STOPWORDS_TR.has(w) && w.length > 2);

module.exports = { normalize, extractWords, extractMeaningfulWords, STOPWORDS_TR };
