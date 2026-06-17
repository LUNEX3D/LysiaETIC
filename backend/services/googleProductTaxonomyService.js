const fs = require("fs");
const path = require("path");
const https = require("https");

const TAXONOMY_URL = "https://www.google.com/basepages/producttype/taxonomy-with-ids.tr-TR.txt";
const LOCAL_FILE = path.join(__dirname, "../data/google-product-taxonomy-tr.txt");

let cache = null;
let loadPromise = null;

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    fetchText(res.headers.location).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            })
            .on("error", reject);
    });
}

async function loadRawText() {
    if (fs.existsSync(LOCAL_FILE)) {
        return fs.readFileSync(LOCAL_FILE, "utf8");
    }
    try {
        const text = await fetchText(TAXONOMY_URL);
        fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
        fs.writeFileSync(LOCAL_FILE, text, "utf8");
        return text;
    } catch (e) {
        throw new Error(
            `Google ürün kategorisi listesi yüklenemedi: ${e.message}. ${LOCAL_FILE} dosyasını kontrol edin.`
        );
    }
}

function parseTaxonomy(text) {
    const roots = [];
    const nodeByPath = new Map();
    const flat = [];

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const m = trimmed.match(/^(\d+)\s*-\s*(.+)$/);
        if (!m) continue;
        const id = Number(m[1]);
        const fullPath = m[2].trim();
        const parts = fullPath.split(" > ").map((p) => p.trim());
        if (!parts.length) continue;

        flat.push({ id, path: fullPath, name: parts[parts.length - 1] });

        let parent = null;
        let pathKey = "";
        for (let i = 0; i < parts.length; i += 1) {
            pathKey = i === 0 ? parts[0] : `${pathKey} > ${parts[i]}`;
            let node = nodeByPath.get(pathKey);
            if (!node) {
                node = {
                    id: null,
                    name: parts[i],
                    path: pathKey,
                    children: [],
                };
                nodeByPath.set(pathKey, node);
                if (parent) parent.children.push(node);
                else roots.push(node);
            }
            if (i === parts.length - 1) node.id = id;
            parent = node;
        }
    }

    const sortNodes = (nodes) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name, "tr"));
        nodes.forEach((n) => {
            if (n.children?.length) sortNodes(n.children);
        });
    };
    sortNodes(roots);

    return { roots, flat, version: lines.find((l) => l.includes("Google_Product_Taxonomy_Version")) || "" };
}

async function ensureLoaded() {
    if (cache) return cache;
    if (!loadPromise) {
        loadPromise = loadRawText()
            .then(parseTaxonomy)
            .then((data) => {
                cache = data;
                return cache;
            })
            .catch((err) => {
                loadPromise = null;
                throw err;
            });
    }
    return loadPromise;
}

function nodePayload(node, includeChildren = false) {
    const out = {
        id: node.id,
        name: node.name,
        path: node.path,
        hasChildren: node.children.length > 0,
    };
    if (includeChildren) {
        out.children = node.children.map((c) => nodePayload(c, false));
    }
    return out;
}

async function getRoots() {
    const { roots } = await ensureLoaded();
    return roots.map((n) => nodePayload(n, false));
}

async function getChildren(parentPath) {
    const { roots } = await ensureLoaded();
    const key = String(parentPath || "").trim();
    if (!key) return getRoots();

    const find = (nodes) => {
        for (const n of nodes) {
            if (n.path === key) return n.children;
            const found = find(n.children);
            if (found) return found;
        }
        return null;
    };
    const children = find(roots) || [];
    return children.map((n) => nodePayload(n, false));
}

async function searchCategories(query, limit = 60) {
    const q = String(query || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (q.length < 2) return [];
    const { flat } = await ensureLoaded();
    const hits = flat.filter((item) => {
        const hay = item.path
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        return hay.includes(q);
    });
    hits.sort((a, b) => {
        const aExact = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bExact = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.path.length - b.path.length;
    });
    return hits.slice(0, limit).map((h) => ({ id: h.id, name: h.name, path: h.path }));
}

module.exports = {
    ensureLoaded,
    getRoots,
    getChildren,
    searchCategories,
};
