"use strict";

const challenges = new Map();
const TTL_MS = 10 * 60 * 1000;

function prune() {
    const now = Date.now();
    for (const [id, c] of challenges) {
        if (now - c.created > TTL_MS) challenges.delete(id);
    }
}

function createChallenge() {
    prune();
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 2;
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    challenges.set(id, { answer: a + b, created: Date.now() });
    return { captchaId: id, question: `${a} + ${b} = ?` };
}

function verifyChallenge(captchaId, answer) {
    if (!captchaId) return false;
    const c = challenges.get(captchaId);
    challenges.delete(captchaId);
    if (!c) return false;
    return Number(answer) === c.answer;
}

module.exports = { createChallenge, verifyChallenge };
