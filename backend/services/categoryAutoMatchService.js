/**
 * Akıllı kategori eşleştirme — master yol anlamını tüm platformlarda korur.
 * Örn. master yaprak "Çelik Küpe" → hedef yaprakta çelik + küpe kelimeleri zorunlu.
 */

const STOP_WORDS = new Set(["ve", "ile", "icin", "the", "and", "or"]);

const normalizeTurkish = (str) => {
    if (!str) return "";
    return String(str)
        .toLowerCase()
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u")
        .replace(/İ/g, "i");
};

const decodeHtmlEntities = (str) => {
    if (!str) return "";
    return String(str)
        .replace(/&gt;/gi, ">")
        .replace(/&lt;/gi, "<")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/gi, " ");
};

const normalizePath = (path) =>
    normalizeTurkish(
        decodeHtmlEntities(path)
            .replace(/\s*>\s*/g, ">")
            .replace(/\s+/g, " ")
            .trim()
    );

const pathSegments = (path) =>
    normalizePath(path)
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);

const tokenize = (segment) => {
    if (!segment) return [];
    return normalizeTurkish(segment)
        .split(/[\s\-_/&,+()]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
};

const allTokensPresentInText = (masterTokens, text) => {
    if (!masterTokens.length) return true;
    const targetTokens = tokenize(text);
    const normBlob = normalizeTurkish(text);
    return masterTokens.every((mt) => {
        if (targetTokens.some((tt) => tt === mt)) return true;
        if (mt.length >= 4 && targetTokens.some((tt) => tt.includes(mt) || mt.includes(tt))) return true;
        return normBlob.includes(mt);
    });
};

const DEFAULT_MATCH_OPTIONS = {
    minScore: 42,
    minGap: 5,
    topN: 5,
    strictLeafTokens: true,
    bestEffort: true
};

/** Tablo hücresi boş mu? (0 / "0" Excel artefaktı dahil) */
const isPlatformMappingEmpty = (mapping, idField) => {
    const v = mapping[idField];
    if (v == null || v === "") return true;
    if (v === 0 || v === "0") return true;
    return false;
};

const coerceCategoryId = (rawId) => {
    if (rawId == null || rawId === "") return null;
    const n = Number(rawId);
    if (Number.isFinite(n) && n > 0) return n;
    const s = String(rawId).trim();
    return s || null;
};

/**
 * Master satırından eşleştirme metni (yol öncelikli).
 */
const getMasterPathText = (mapping) => {
    const path = (mapping.masterPath || mapping.trendyolPath || "").trim();
    if (path) return path;
    const name = (mapping.masterName || "").trim();
    return name;
};

/**
 * Benzerlik skoru — yaprak anlamı korunur, üst segmentler destekler.
 */
const categorySimilarityScore = (masterPath, targetPath, options = {}) => {
    const { strictLeafTokens = true } = options;
    if (!masterPath || !targetPath) return 0;

    const mp = normalizePath(masterPath);
    const tp = normalizePath(targetPath);
    if (mp === tp) return 1000;

    const mParts = pathSegments(masterPath);
    const tParts = pathSegments(targetPath);
    if (!mParts.length || !tParts.length) return 0;

    const mLast = mParts[mParts.length - 1];
    const tLast = tParts[tParts.length - 1];
    const mLeafTokens = tokenize(mLast);

    if (strictLeafTokens && mLeafTokens.length > 0 && !allTokensPresentInText(mLeafTokens, tLast)) {
        return 0;
    }

    let score = 0;

    if (mLast === tLast) {
        score += 85;
    } else {
        const mNorm = normalizeTurkish(mLast);
        const tNorm = normalizeTurkish(tLast);
        if (mNorm === tNorm) {
            score += 80;
        } else if (mLeafTokens.length > 0) {
            const matched = mLeafTokens.filter((t) => allTokensPresentInText([t], tLast)).length;
            const ratio = matched / mLeafTokens.length;
            if (ratio >= 1) score += 70;
            else if (ratio >= 0.5) score += 35;
            else return 0;
        } else {
            return 0;
        }
    }

    const mSet = new Set(mLeafTokens);
    const tSet = new Set(tokenize(tLast));
    const inter = [...mSet].filter((t) => tSet.has(t)).length;
    const union = new Set([...mSet, ...tSet]).size || 1;
    score += Math.round((inter / union) * 25);

    const minLen = Math.min(mParts.length, tParts.length);
    for (let i = 2; i <= minLen; i++) {
        const mSeg = mParts[mParts.length - i];
        const tSeg = tParts[tParts.length - i];
        if (mSeg === tSeg) score += 18;
        else if (mSeg && tSeg) {
            const mTok = tokenize(mSeg);
            const tTok = tokenize(tSeg);
            const overlap = mTok.filter((t) => tTok.includes(t)).length;
            if (overlap > 0 && overlap >= Math.min(mTok.length, tTok.length) * 0.5) score += 6;
        }
    }

    const depthDiff = Math.abs(mParts.length - tParts.length);
    if (depthDiff === 0) score += 5;
    else if (depthDiff === 1) score += 2;

    return score;
};

const buildTargetIndex = (eligibleTargets) => {
    const byExactLeaf = new Map();
    const byToken = new Map();
    const byId = new Map();
    const byNormalizedLeaf = new Map();

    for (const target of eligibleTargets) {
        const idKey = String(target.id);
        byId.set(idKey, target);

        const parts = pathSegments(target.path);
        const leaf = parts[parts.length - 1] || target.name || "";
        const normLeaf = normalizeTurkish(leaf);
        const normPath = normalizeTurkish(target.path || leaf);

        if (!byExactLeaf.has(normLeaf)) byExactLeaf.set(normLeaf, []);
        byExactLeaf.get(normLeaf).push(target);

        if (normPath.length >= 3) {
            if (!byNormalizedLeaf.has(normPath)) byNormalizedLeaf.set(normPath, []);
            byNormalizedLeaf.get(normPath).push(target);
        }

        for (const tok of tokenize(leaf)) {
            if (!byToken.has(tok)) byToken.set(tok, []);
            byToken.get(tok).push(target);
        }
    }

    return { byExactLeaf, byToken, byId, byNormalizedLeaf };
};

const intersectTokenCandidates = (tokens, index) => {
    const lists = tokens.map((tok) => index.byToken.get(tok) || []);
    if (!lists.length || lists.some((l) => l.length === 0)) return [];

    lists.sort((a, b) => a.length - b.length);
    let idSet = new Set(lists[0].map((t) => String(t.id)));

    for (let i = 1; i < lists.length; i++) {
        const next = new Set(lists[i].map((t) => String(t.id)));
        idSet = new Set([...idSet].filter((id) => next.has(id)));
        if (idSet.size === 0) break;
    }

    const out = [];
    for (const id of idSet) {
        const t = index.byId.get(id);
        if (t) out.push(t);
    }
    return out;
};

const getCandidates = (masterPath, index) => {
    const parts = pathSegments(masterPath);
    const leaf = parts[parts.length - 1] || masterPath;
    const normLeaf = normalizeTurkish(leaf);
    const tokens = tokenize(leaf);
    const seen = new Set();
    const candidates = [];

    const add = (list) => {
        for (const t of list || []) {
            const key = String(t.id);
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push(t);
        }
    };

    add(index.byExactLeaf.get(normLeaf));

    if (tokens.length === 1) {
        add(index.byToken.get(tokens[0]));
    } else if (tokens.length > 1) {
        const intersected = intersectTokenCandidates(tokens, index);
        for (const t of intersected) {
            const tParts = pathSegments(t.path);
            const tLeaf = tParts[tParts.length - 1] || "";
            if (allTokensPresentInText(tokens, tLeaf)) add([t]);
        }
    }

    if (candidates.length === 0 && normLeaf.length >= 3 && index.byNormalizedLeaf) {
        for (const [key, list] of index.byNormalizedLeaf) {
            if (key.includes(normLeaf) || normLeaf.includes(key)) add(list);
            if (candidates.length >= 80) break;
        }
    }

    return candidates;
};

/**
 * Tek master yol için en iyi hedef(ler).
 */
const findBestMatches = (masterPath, eligibleTargets, options = {}) => {
    const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
    const { minScore, minGap, topN, strictLeafTokens, bestEffort } = opts;
    const index = opts._index || buildTargetIndex(eligibleTargets);

    const tryMatch = (pathText) => {
        const candidates = getCandidates(pathText, index);
        if (!candidates.length) return [];

        return candidates
            .map((target) => ({
                ...target,
                score: categorySimilarityScore(pathText, target.path || target.name || "", { strictLeafTokens })
            }))
            .filter((s) => s.score >= minScore)
            .sort((a, b) => b.score - a.score);
    };

    let scored = tryMatch(masterPath);
    if (!scored.length) {
        const parts = pathSegments(masterPath);
        const leafOnly = parts[parts.length - 1] || "";
        if (leafOnly && leafOnly !== masterPath) {
            scored = tryMatch(leafOnly);
        }
    }

    if (!scored.length) {
        return { best: null, scored: [], ambiguous: false, reason: "below_min_score" };
    }

    const bestScore = scored[0].score;
    const ties = scored.filter((s) => s.score === bestScore);

    if (ties.length > 1 && !(bestEffort && bestScore >= 88)) {
        return {
            best: null,
            scored: scored.slice(0, topN),
            ambiguous: true,
            reason: "tie",
            bestScore
        };
    }

    if (bestScore < 1000 && scored.length > 1) {
        const secondScore = scored[1].score;
        if (bestScore - secondScore < minGap) {
            if (bestEffort && bestScore >= 75) {
                return {
                    best: scored[0],
                    scored: scored.slice(0, topN),
                    ambiguous: true,
                    confidence: "review",
                    bestScore,
                    secondScore
                };
            }
            return {
                best: null,
                scored: scored.slice(0, topN),
                ambiguous: true,
                reason: "low_gap",
                bestScore,
                secondScore
            };
        }
    }

    return {
        best: scored[0],
        scored: scored.slice(0, topN),
        ambiguous: false,
        confidence: bestScore >= 95 ? "high" : bestScore >= 70 ? "medium" : "low",
        bestScore
    };
};

/** Eski skor fonksiyonu ile uyumluluk */
const segmentSimilarityScore = (masterPath, targetPath) =>
    categorySimilarityScore(masterPath, targetPath, { strictLeafTokens: true });

module.exports = {
    normalizeTurkish,
    getMasterPathText,
    isPlatformMappingEmpty,
    coerceCategoryId,
    categorySimilarityScore,
    segmentSimilarityScore,
    buildTargetIndex,
    findBestMatches,
    DEFAULT_MATCH_OPTIONS
};
