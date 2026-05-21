/**
 * Kullanıcı kataloğundaki nişleri (takı, 3D baskı/dekor, vb.) ayırır;
 * Fırsat Radar'ın tek kategoriye yığılmasını önler.
 */

const STOP_WORDS = new Set([
    "ve", "ile", "için", "bir", "bu", "da", "de", "den", "dan",
    "adet", "set", "kadın", "erkek", "çocuk", "bebek", "unisex",
    "renk", "beden", "numara", "boy", "ebat", "yeni", "model",
]);

/** Öncelik sırası: daha spesifik kümeler önce */
const PRODUCT_CLUSTERS = [
    {
        id: "decor_3d",
        label: "Dekoratif & 3D Baskı",
        signals: [
            "biblo", "figür", "figur", "heykel", "dekoratif", "dekor", "obje ve biblo",
            "3d", "3 d", "baskı", "baski", "filament", "pla ", "masaüstü", "masaustu",
            "minyatür", "minyatur", "vazo", "süsleme", "geyik", "mandala", "köpek", "kopek",
            "çocuklu aile", "anne baba", "özel tasarım", "hediyelik eşya",
        ],
    },
    {
        id: "jewelry",
        label: "Takı & Aksesuar",
        signals: [
            "takı", "taki", "aksesuar", "kolye", "küpe", "kupe", "bilezik", "bileklik",
            "yüzük", "yuzuk", "halhal", "charm", "gümüş", "gumus", "altın", "altin",
            "zirkon", "piercing", "küpe set",
        ],
    },
    {
        id: "home",
        label: "Ev & Yaşam",
        signals: ["ev ", "mutfak", "banyo", "organizatör", "saklama", "nevresim", "perde"],
    },
    {
        id: "electronics",
        label: "Elektronik",
        signals: ["telefon", "kulaklık", "powerbank", "kablosuz", "şarj", "tablet"],
    },
];

const CLUSTER_SEED_KEYWORDS = {
    decor_3d: [
        "dekoratif biblo",
        "3d baskı figür",
        "masaüstü dekorasyon",
        "minyatür heykel",
        "özel tasarım hediye",
        "dekoratif obje",
    ],
    jewelry: [
        "gümüş kolye",
        "zirkon küpe",
        "charm bileklik",
        "damla küpe seti",
    ],
    home: ["ev dekorasyonu", "mutfak organizer"],
    electronics: ["telefon aksesuar", "bluetooth kulaklık"],
};

function normalizeText(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c");
}

/**
 * @param {string} category
 * @param {string} [productName]
 * @returns {string} cluster id
 */
function classifyNicheCluster(category, productName = "") {
    const text = normalizeText(`${category} ${productName}`);
    for (const cluster of PRODUCT_CLUSTERS) {
        if (cluster.signals.some((sig) => text.includes(normalizeText(sig)))) {
            return cluster.id;
        }
    }
    return "other";
}

function getClusterLabel(clusterId) {
    return PRODUCT_CLUSTERS.find((c) => c.id === clusterId)?.label || "Genel";
}

function tokenizeName(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/[^\wçğıöşüÇĞİÖŞÜ\s-]/g, " ")
        .split(/[\s-]+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function phraseFromProductName(name) {
    const words = tokenizeName(name);
    if (words.length >= 3) return words.slice(0, 3).join(" ");
    if (words.length >= 2) return words.slice(0, 2).join(" ");
    return words[0] || "";
}

function keywordsFromClusterProducts(products) {
    const keywords = new Set();
    for (const pm of products) {
        const name = pm.masterProduct?.name || "";
        const phrase = phraseFromProductName(name);
        if (phrase.length >= 4) keywords.add(phrase);
        const words = tokenizeName(name);
        for (let i = 0; i < words.length - 1; i++) {
            const gram = `${words[i]} ${words[i + 1]}`;
            if (gram.length > 5) keywords.add(gram);
        }
    }
    return [...keywords];
}

function generateCategoryKeywords(categories) {
    const keywords = [];
    for (const cat of categories) {
        const parts = cat
            .split(/[>/]+/)
            .map((p) => p.trim().toLowerCase())
            .filter((p) => p.length > 2);
        if (parts.length > 0) keywords.push(parts[parts.length - 1]);
        if (parts.length >= 2) {
            keywords.push(`${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
        }
    }
    return [...new Set(keywords)];
}

/**
 * Her nişten en az birkaç keyword — takı tek başına domine etmesin
 */
function buildBalancedCoreKeywords(products, seed, deterministicShuffle) {
    const buckets = {};
    for (const pm of products) {
        const cluster = classifyNicheCluster(
            pm.masterProduct?.category,
            pm.masterProduct?.name
        );
        if (!buckets[cluster]) buckets[cluster] = [];
        buckets[cluster].push(pm);
    }

    const activeClusters = Object.entries(buckets).filter(
        ([id, list]) => id !== "other" && list.length > 0
    );
    const total = Math.max(products.length, 1);
    const coreKeywords = [];

    for (const [clusterId, list] of activeClusters) {
        const share = list.length / total;
        let quota = Math.max(4, Math.round(share * 24));
        if (activeClusters.length >= 2) {
            quota = Math.max(quota, 5);
        }

        const fromProducts = keywordsFromClusterProducts(list);
        const cats = [...new Set(list.map((pm) => pm.masterProduct?.category).filter(Boolean))];
        const fromCats = generateCategoryKeywords(cats);
        const seeds = CLUSTER_SEED_KEYWORDS[clusterId] || [];
        const merged = [...new Set([...fromProducts, ...fromCats, ...seeds])];
        const picked = deterministicShuffle(merged, `${seed}|cluster|${clusterId}`).slice(0, quota);
        coreKeywords.push(...picked);
    }

    const nicheBuckets = activeClusters.map(([id, list]) => ({
        id,
        label: getClusterLabel(id),
        productCount: list.length,
    }));

    return {
        coreKeywords: [...new Set(coreKeywords)],
        nicheBuckets,
        productCountByCluster: Object.fromEntries(
            activeClusters.map(([id, list]) => [id, list.length])
        ),
    };
}

/**
 * Skor sıralı listeden niş başına kota ile çeşitli seçim
 */
function pickDiverseOpportunities(sortedList, limit, classifyFn = classifyNicheCluster) {
    if (!sortedList?.length) return [];
    const byCluster = new Map();
    for (const item of sortedList) {
        const cluster =
            item.nicheCluster ||
            classifyFn(item.category, item.keyword);
        if (!byCluster.has(cluster)) byCluster.set(cluster, []);
        byCluster.get(cluster).push(item);
    }

    const clusterIds = [...byCluster.keys()].sort((a, b) => {
        if (a === "other") return 1;
        if (b === "other") return -1;
        return (byCluster.get(b)?.length || 0) - (byCluster.get(a)?.length || 0);
    });

    if (clusterIds.length <= 1) {
        return sortedList.slice(0, limit);
    }

    const minPerCluster = Math.max(2, Math.floor(limit / clusterIds.length));
    const result = [];
    const used = new Set();

    for (const cid of clusterIds) {
        const bucket = byCluster.get(cid) || [];
        for (let i = 0; i < minPerCluster && i < bucket.length && result.length < limit; i++) {
            result.push(bucket[i]);
            used.add(bucket[i]);
        }
    }

    for (const item of sortedList) {
        if (result.length >= limit) break;
        if (!used.has(item)) {
            result.push(item);
            used.add(item);
        }
    }

    return result.slice(0, limit);
}

module.exports = {
    PRODUCT_CLUSTERS,
    classifyNicheCluster,
    getClusterLabel,
    buildBalancedCoreKeywords,
    pickDiverseOpportunities,
};
