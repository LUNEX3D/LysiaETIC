/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KATEGORİ EMBEDDING SERVİSİ — Semantic Category Matching
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * String similarity yerine SEMANTIC similarity kullanır.
 *
 * Örnek:
 *   "Vazo" vs "Takı" → string similarity: 0.2 ❌
 *   "Vazo" vs "Takı" → semantic similarity: 0.1 ✅ (farklı kavramlar)
 *   "Vazo" vs "Dekoratif Vazo" → semantic: 0.95 ✅
 *
 * Teknoloji:
 *   - OpenAI Embeddings API (text-embedding-3-small)
 *   - Cosine similarity
 *   - In-memory cache (embedding'ler pahalı)
 *
 * Fallback:
 *   - API yoksa → fuzzy matching'e geri döner
 */

const logger = require("../config/logger");
const { normalize } = require("../utils/textNormalize");

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING CACHE — Aynı kategori için tekrar API çağrısı yapma
// ─────────────────────────────────────────────────────────────────────────────
const _embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

/**
 * OpenAI API ile text embedding üret.
 * Cache'den varsa direkt döner.
 *
 * @param {string} text
 * @returns {Promise<Array<number>|null>} - 1536 boyutlu vector veya null
 */
const getEmbedding = async (text) => {
    if (!text || !text.trim()) return null;

    const normalized = normalize(text);
    const cacheKey = normalized;

    // Cache kontrolü
    const cached = _embeddingCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.vector;
    }

    // OpenAI API key kontrolü
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        logger.warn("[EMBEDDING] OpenAI API key bulunamadı, embedding devre dışı");
        return null;
    }

    try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: normalized,
                encoding_format: "float"
            })
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error(`[EMBEDDING] API hatası: ${response.status} - ${error}`);
            return null;
        }

        const data = await response.json();
        const vector = data.data?.[0]?.embedding;

        if (!vector || !Array.isArray(vector)) {
            logger.error("[EMBEDDING] Geçersiz API yanıtı");
            return null;
        }

        // Cache'e kaydet
        if (_embeddingCache.size >= CACHE_MAX_SIZE) {
            // LRU: en eski kaydı sil
            const firstKey = _embeddingCache.keys().next().value;
            _embeddingCache.delete(firstKey);
        }
        _embeddingCache.set(cacheKey, { vector, timestamp: Date.now() });

        logger.debug(`[EMBEDDING] Üretildi: "${text.substring(0, 40)}..." (cache: ${_embeddingCache.size})`);
        return vector;

    } catch (err) {
        logger.error(`[EMBEDDING] Hata: ${err.message}`);
        return null;
    }
};

/**
 * İki vector arasında cosine similarity hesapla.
 *
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number} - 0.0 - 1.0 arası similarity
 */
const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
};

/**
 * Kaynak kategoriyi hedef kategorilerle semantic eşleştir.
 *
 * @param {string} sourceName - "Vazo"
 * @param {Array<{id, name, path}>} targetCategories
 * @param {Object} options
 * @param {number} [options.limit=5]
 * @param {number} [options.minScore=0.5]
 * @returns {Promise<Array<{categoryId, categoryName, categoryPath, score, matchMethod}>>}
 */
const semanticMatch = async (sourceName, targetCategories, options = {}) => {
    const { limit = 5, minScore = 0.5 } = options;

    if (!sourceName || !targetCategories || targetCategories.length === 0) {
        return [];
    }

    // Kaynak embedding
    const sourceEmbedding = await getEmbedding(sourceName);
    if (!sourceEmbedding) {
        logger.warn("[EMBEDDING] Kaynak embedding üretilemedi, fuzzy fallback");
        return [];
    }

    const scored = [];

    for (const cat of targetCategories) {
        const catName = cat.name || "";
        const catPath = cat.path || catName;

        // Hedef embedding (path kullan, daha zengin context)
        const targetEmbedding = await getEmbedding(catPath);
        if (!targetEmbedding) continue;

        // Cosine similarity
        const similarity = cosineSimilarity(sourceEmbedding, targetEmbedding);

        if (similarity >= minScore) {
            scored.push({
                categoryId: String(cat.id),
                categoryName: catName,
                categoryPath: catPath,
                score: Math.round(similarity * 100) / 100,
                matchMethod: "semantic_embedding"
            });
        }
    }

    // Skora göre sırala
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
};

/**
 * Cache temizle (test/debug için).
 */
const clearCache = () => {
    _embeddingCache.clear();
    logger.info("[EMBEDDING] Cache temizlendi");
};

/**
 * Cache istatistikleri.
 */
const getCacheStats = () => ({
    size: _embeddingCache.size,
    maxSize: CACHE_MAX_SIZE,
    ttl: CACHE_TTL
});

module.exports = {
    getEmbedding,
    cosineSimilarity,
    semanticMatch,
    clearCache,
    getCacheStats
};
