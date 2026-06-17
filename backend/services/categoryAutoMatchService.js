/**
 * Akıllı kategori eşleştirme — master yol anlamını tüm platformlarda korur.
 * Örn. master yaprak "Çelik Küpe" → hedef yaprakta çelik + küpe kelimeleri zorunlu.
 */

const STOP_WORDS = new Set(["ve", "ile", "icin", "the", "and", "or"]);

/**
 * Anlamca eşdeğer kelime grupları — yazımı/dili farklı ama aynı kategoriyi ifade edenler.
 * Master yaprak kelimesi hedefte birebir yoksa, eşdeğerlerinden biri varsa "mevcut" sayılır.
 * (Platformlar arası farklı isimlendirme + Amazon İngilizce ürün tipleri için.)
 * Not: Çoğul/yazım farkları zaten substring ile yakalanır; burada GENUINE eşanlamlılar tutulur.
 */
const SYNONYM_GROUPS = [
    ["telefon", "smartphone", "phone"],
    ["bilgisayar", "laptop", "notebook", "computer"],
    ["tablet"],
    ["kupe", "earring"],
    ["kolye", "necklace"],
    ["yuzuk", "ring"],
    ["bileklik", "bracelet"],
    ["taki", "jewelry", "jewellery"],
    ["ayakkabi", "shoes", "sneaker"],
    ["bot", "boot"],
    ["terlik", "slipper"],
    ["tisort", "tshirt"],
    ["pantolon", "pants", "trousers", "jean", "jeans"],
    ["sort", "shorts"],
    ["elbise", "dress"],
    ["etek", "skirt"],
    ["gomlek", "shirt"],
    ["kazak", "sweater", "kazagi"],
    ["hirka", "cardigan"],
    ["mont", "coat", "jacket", "ceket"],
    ["sapka", "hat", "cap"],
    ["gozluk", "glasses", "sunglasses", "eyewear"],
    ["saat", "watch"],
    ["canta", "bag", "handbag"],
    ["cuzdan", "wallet"],
    ["parfum", "perfume", "fragrance"],
    ["oyuncak", "toy"],
    ["kitap", "book"],
    ["mutfak", "kitchen"],
    ["mobilya", "furniture"],
    ["aydinlatma", "lighting", "lamba", "lamp"],
    ["bebek", "baby"],
    ["kozmetik", "cosmetic", "cosmetics", "makyaj", "makeup"],
    ["organizer", "duzenleyici", "organizerlar", "düzenleyici", "düzenleyiciler"],
    ["kalemlik", "kalemlikler", "atase", "ataslik", "kalemlik"],
    ["evrak", "dosya", "klasor"],
];

const SYNONYM_LOOKUP = (() => {
    const map = new Map();
    for (const group of SYNONYM_GROUPS) {
        const norm = group
            .map((g) =>
                String(g)
                    .toLowerCase()
                    .replace(/ç/g, "c")
                    .replace(/ğ/g, "g")
                    .replace(/ı/g, "i")
                    .replace(/ö/g, "o")
                    .replace(/ş/g, "s")
                    .replace(/ü/g, "u")
            )
            .filter(Boolean);
        for (const w of norm) {
            const set = map.get(w) || new Set();
            for (const other of norm) if (other !== w) set.add(other);
            map.set(w, set);
        }
    }
    return map;
})();

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
    const tokenPresent = (mt) => {
        if (targetTokens.some((tt) => tt === mt)) return true;
        if (mt.length >= 4 && targetTokens.some((tt) => tt.includes(mt) || mt.includes(tt))) return true;
        return normBlob.includes(mt);
    };
    return masterTokens.every((mt) => {
        if (tokenPresent(mt)) return true;
        // Anlamca eşdeğer (synonym) kelimelerden biri hedefte varsa "mevcut" say
        const syns = SYNONYM_LOOKUP.get(mt);
        if (syns) {
            for (const s of syns) {
                if (tokenPresent(s)) return true;
            }
        }
        return false;
    });
};

const tokenPresentInLeaf = (token, leafText) => allTokensPresentInText([token], leafText);

const getDistinctiveLeafTokens = (leafSegment) =>
    tokenize(leafSegment).filter((t) => !GENERIC_LEAF_TOKENS.has(t));

/** Master yapraktaki belirgin ürün tipi hedefte karşılık yok + çelişen tip var → red */
const hasLeafSemanticConflict = (masterLeaf, targetLeaf) => {
    const distinctive = getDistinctiveLeafTokens(masterLeaf);
    if (!distinctive.length) return false;

    const allCovered = distinctive.every((t) => tokenPresentInLeaf(t, targetLeaf));
    if (allCovered) return false;

    for (const mt of distinctive) {
        const conflicts = CONFLICT_IF_MASTER_HAS[mt] || [];
        for (const cf of conflicts) {
            if (tokenPresentInLeaf(cf, targetLeaf)) return true;
        }
    }
    return false;
};

/** Üst kategori bağlamı — ofis organizer ≠ oto CD organizer */
const hasPathSemanticConflict = (masterPath, targetPath) => {
    const mp = normalizePath(masterPath);
    const tp = normalizePath(targetPath);
    const officeDeskCtx = /(kirtasiye|ofis|masaustu)/.test(mp) && /(organizer|duzenleyici)/.test(mp);
    if (officeDeskCtx && /(oto|arac|tuning|cd organizer|cd,)/.test(tp)) return true;
    if (officeDeskCtx && /(evcil|balik|akvaryum|hayvan|pet)/.test(tp)) return true;
    if (/(mutfak|banyo)/.test(mp) && /(oto|arac|kirtasiye|ofis kirtasiye)/.test(tp)) return true;
    return false;
};

const DEFAULT_MATCH_OPTIONS = {
    minScore: 42,
    minGap: 5,
    topN: 5,
    strictLeafTokens: true,
    bestEffort: true
};

/** Yaprakta tek başına anlam taşımayan kelimeler — sadece bunlarla eşleşme yeterli değil */
const GENERIC_LEAF_TOKENS = new Set([
    "masa", "ustu", "masaustu", "ofis", "ev", "set", "urun", "aksesuar", "diger",
    "genel", "cok", "amacli", "amaci", "yeni", "model", "tip", "tur", "ve",
    "icin", "ile", "buyuk", "kucuk", "mini", "maxi", "pro", "plus", "seti",
]);

/**
 * Master yaprakta belirgin ürün tipi varken hedefte çelişen tip → red (ör. organizer ≠ kalemlik)
 */
const CONFLICT_IF_MASTER_HAS = {
    organizer: ["kalemlik", "kalemlikler", "kalemi", "kalemligi", "atase", "atas", "daksil", "bant"],
    duzenleyici: ["kalemlik", "kalemlikler", "kalemi", "atase", "daksil"],
    kalemlik: ["organizer", "organizerlar", "duzenleyici", "düzenleyici"],
    kupe: ["kolye", "yuzuk", "bileklik"],
    kolye: ["kupe", "yuzuk"],
    elbise: ["etek", "pantolon", "sort"],
    pantolon: ["elbise", "etek"],
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
    const distinctiveTokens = getDistinctiveLeafTokens(mLast);
    const tokensForStrict = distinctiveTokens.length > 0 ? distinctiveTokens : mLeafTokens;

    if (hasLeafSemanticConflict(mLast, tLast)) return 0;
    if (hasPathSemanticConflict(masterPath, targetPath)) return 0;

    if (strictLeafTokens && tokensForStrict.length > 0 && !allTokensPresentInText(tokensForStrict, tLast)) {
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
        } else if (tokensForStrict.length > 0) {
            const matched = tokensForStrict.filter((t) => allTokensPresentInText([t], tLast)).length;
            const ratio = matched / tokensForStrict.length;
            if (ratio >= 1) score += 70;
            else if (ratio >= 0.5) score += 35;
            else return 0;
        } else {
            return 0;
        }
    }

    const mSet = new Set(tokensForStrict.length > 0 ? tokensForStrict : mLeafTokens);
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

    // Bağlam bonusu: ofis organizer → organizerlar dalı; oto/karavan cezası
    if (/(kirtasiye|ofis|masaustu)/.test(mp) && /(organizer|duzenleyici)/.test(mp)) {
        if (/organizerlar|duzenleyici/.test(tp)) score += 8;
        if (/(kirtasiye|ofis)/.test(tp)) score += 4;
        if (/(oto|arac|tuning|karavan|evcil|balik|akvaryum)/.test(tp)) score -= 12;
    }

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
/**
 * Yaklaşık (best-effort) aday üretimi: yaprak kelimelerinden HERHANGİ biri (veya
 * eşanlamlısı) hedefte geçen yapraklar. Katı eşleşme bulunamadığında kullanılır.
 */
const getLooseCandidates = (masterPath, index) => {
    const parts = pathSegments(masterPath);
    const leaf = parts[parts.length - 1] || masterPath;
    const tokens = tokenize(leaf);
    const seen = new Set();
    const out = [];
    const add = (list) => {
        for (const t of list || []) {
            const key = String(t.id);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(t);
        }
    };
    for (const tok of tokens) {
        add(index.byToken.get(tok));
        const syns = SYNONYM_LOOKUP.get(tok);
        if (syns) for (const s of syns) add(index.byToken.get(s));
        if (out.length >= 400) break;
    }
    return out;
};

const findBestMatches = (masterPath, eligibleTargets, options = {}) => {
    const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
    const { minScore, minGap, topN, strictLeafTokens, bestEffort, aggressive } = opts;
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

    // ── Yaklaşık (best-effort) geçiş ──
    // Katı eşleşme yoksa: yaprak kelimelerinin EN AZ YARISI örtüşen en yakın yaprağı seç.
    // (Kullanıcı talebi: "yazımı farklı olsa da en uygun/yakın kategori seçilsin")
    if (!scored.length && aggressive) {
        const looseMinScore = Math.max(minScore, 50);
        const mParts = pathSegments(masterPath);
        const mUpperTokens = new Set();
        for (let i = 0; i < mParts.length - 1; i++) {
            for (const tk of tokenize(mParts[i])) mUpperTokens.add(tk);
        }
        const upperAffinity = (targetPath) => {
            if (!mUpperTokens.size) return 0;
            const tParts = pathSegments(targetPath);
            const tUpper = new Set();
            for (let i = 0; i < tParts.length - 1; i++) {
                for (const tk of tokenize(tParts[i])) tUpper.add(tk);
            }
            let hit = 0;
            for (const tk of mUpperTokens) if (tUpper.has(tk)) hit++;
            return hit;
        };
        const loose = getLooseCandidates(masterPath, index)
            .map((target) => {
                const tp = target.path || target.name || "";
                const tParts = pathSegments(tp);
                const tLast = tParts[tParts.length - 1] || "";
                const mParts = pathSegments(masterPath);
                const mLast = mParts[mParts.length - 1] || "";
                if (hasLeafSemanticConflict(mLast, tLast)) return null;
                return {
                    ...target,
                    score: categorySimilarityScore(masterPath, tp, { strictLeafTokens: false }),
                    _affinity: upperAffinity(tp),
                    _depth: pathSegments(tp).length
                };
            })
            .filter(Boolean)
            .filter((s) => s.score >= looseMinScore)
            // Üst kategori (ebeveyn) örtüşmesi yüksek olan + daha genel (sığ) hedef tercih edilir
            .sort((a, b) =>
                (b.score - a.score) ||
                (b._affinity - a._affinity) ||
                (a._depth - b._depth)
            );

        if (loose.length) {
            return {
                best: loose[0],
                scored: loose.slice(0, topN),
                ambiguous: false,
                confidence: "approx",
                aggressive: true,
                bestScore: loose[0].score
            };
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

/**
 * Mevcut eşleştirme kalitesi — düşük skor / çelişki uyarısı (Kategori Merkezi denetimi)
 */
const validateMappingQuality = (masterPath, targetPath, options = {}) => {
    const minOkScore = options.minOkScore ?? 55;
    if (!masterPath || !targetPath) {
        return { ok: false, score: 0, confidence: "invalid", warning: "Eksik kategori yolu" };
    }

    const parts = pathSegments(masterPath);
    const tParts = pathSegments(targetPath);
    const mLeaf = parts[parts.length - 1] || "";
    const tLeaf = tParts[tParts.length - 1] || "";

    if (hasLeafSemanticConflict(mLeaf, tLeaf)) {
        return {
            ok: false,
            score: 0,
            confidence: "conflict",
            warning:
                `Ürün tipi uyuşmuyor: «${mLeaf}» → «${tLeaf}» (ör. organizer ile kalemlik aynı kategori olamaz).`,
        };
    }
    if (hasPathSemanticConflict(masterPath, targetPath)) {
        return {
            ok: false,
            score: 0,
            confidence: "conflict",
            warning: `Üst kategori bağlamı uyuşmuyor: ofis/masaüstü ürünü ile oto veya alakasız dal eşleşemez.`,
        };
    }

    const score = categorySimilarityScore(masterPath, targetPath, { strictLeafTokens: true });
    if (score === 0) {
        const loose = categorySimilarityScore(masterPath, targetPath, { strictLeafTokens: false });
        if (loose >= minOkScore) {
            return {
                ok: false,
                score: loose,
                confidence: "weak",
                warning: `Zayıf eşleşme (skor ${loose}): yaprak anlamları tam örtüşmüyor.`,
            };
        }
        return { ok: false, score: 0, confidence: "none", warning: "Kategori yolları anlamsal olarak eşleşmiyor." };
    }

    if (score < minOkScore) {
        return {
            ok: false,
            score,
            confidence: "low",
            warning: `Düşük güven skoru (${score}). Manuel doğrulama önerilir.`,
        };
    }

    return {
        ok: true,
        score,
        confidence: score >= 95 ? "high" : score >= 70 ? "medium" : "low",
        warning: null,
    };
};

module.exports = {
    normalizeTurkish,
    getMasterPathText,
    isPlatformMappingEmpty,
    coerceCategoryId,
    categorySimilarityScore,
    segmentSimilarityScore,
    buildTargetIndex,
    findBestMatches,
    DEFAULT_MATCH_OPTIONS,
    validateMappingQuality,
    hasLeafSemanticConflict,
};
