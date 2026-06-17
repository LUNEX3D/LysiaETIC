"use strict";

const { loadDocument, saveDocument } = require("./themeDocumentService");

/** In-memory undo stacks per site session — production'da Redis'e taşınabilir */
const stacks = new Map();

function stackKey(siteId, userId) {
    return `${siteId}:${userId}`;
}

function getStack(siteId, userId) {
    const key = stackKey(siteId, userId);
    if (!stacks.has(key)) {
        stacks.set(key, { past: [], future: [], max: 50 });
    }
    return stacks.get(key);
}

function pushState(siteId, userId, document) {
    const s = getStack(siteId, userId);
    s.past.push(JSON.parse(JSON.stringify(document)));
    if (s.past.length > s.max) s.past.shift();
    s.future = [];
}

function undo(siteId, userId) {
    const s = getStack(siteId, userId);
    if (s.past.length < 2) return { error: "Geri alınacak işlem yok" };
    const current = s.past.pop();
    s.future.push(current);
    const prev = s.past[s.past.length - 1];
    return { document: JSON.parse(JSON.stringify(prev)) };
}

function redo(siteId, userId) {
    const s = getStack(siteId, userId);
    if (!s.future.length) return { error: "İleri alınacak işlem yok" };
    const next = s.future.pop();
    s.past.push(next);
    return { document: JSON.parse(JSON.stringify(next)) };
}

async function syncStackFromDb(siteId, userId) {
    const result = await loadDocument(siteId, userId);
    if (result.error) return result;
    pushState(siteId, userId, result.document);
    return result;
}

module.exports = {
    pushState,
    undo,
    redo,
    syncStackFromDb,
};
