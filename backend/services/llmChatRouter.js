/**
 * LLM sohbet yönlendiricisi — ücretsiz yerel (Ollama) veya isteğe bağlı OpenAI.
 *
 * .env örnekleri:
 *   Ücretsiz yerel:  USE_OLLAMA=true  ve  OLLAMA_MODEL=llama3.2
 *   Sadece kural:    LYSIA_LLM_PROVIDER=none
 *   Sadece OpenAI:   LYSIA_LLM_PROVIDER=openai  ve  OPENAI_API_KEY=...
 */
const axios = require("axios");
const logger = require("../config/logger");

/**
 * @returns {{ type: 'none' } | { type: 'ollama', baseUrl: string, model: string } | { type: 'openai', model: string }}
 */
function getLlmConfig() {
    const explicit = (process.env.LYSIA_LLM_PROVIDER || "auto").trim().toLowerCase();
    const ollamaBase = (process.env.OLLAMA_BASE_URL || "").trim().replace(/\/$/, "");
    const ollamaModel = (process.env.OLLAMA_MODEL || "llama3.2").trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim() || "";

    if (explicit === "none") {
        return { type: "none" };
    }

    if (explicit === "openai") {
        if (openaiKey.length > 10) {
            return { type: "openai", model: (process.env.OPENAI_MODEL || "gpt-4o-mini").trim() };
        }
        return { type: "none" };
    }

    if (explicit === "ollama") {
        return {
            type: "ollama",
            baseUrl: ollamaBase || "http://127.0.0.1:11434",
            model: ollamaModel,
        };
    }

    // auto: önce ücretsiz yerel (Ollama), sonra OpenAI
    const useOllama =
        process.env.USE_OLLAMA === "true" ||
        process.env.USE_OLLAMA === "1" ||
        ollamaBase.length > 0;
    if (useOllama) {
        return {
            type: "ollama",
            baseUrl: ollamaBase || "http://127.0.0.1:11434",
            model: ollamaModel,
        };
    }
    if (openaiKey.length > 10) {
        return { type: "openai", model: (process.env.OPENAI_MODEL || "gpt-4o-mini").trim() };
    }
    return { type: "none" };
}

function isLlmEnabled() {
    return getLlmConfig().type !== "none";
}

/** Ajan notu / yardım metni için kısa etiket */
function getLlmKindLabel() {
    const c = getLlmConfig();
    if (c.type === "ollama") return `Yerel Ollama (${c.model})`;
    if (c.type === "openai") return `OpenAI (${c.model})`;
    return "LLM kapalı";
}

// ── Circuit breaker — peş peşe başarısızlıkta kısa süre LLM'i atla ──
const breaker = {
    failureCount: 0,
    cooldownUntil: 0,
    threshold: 3,
    cooldownMs: 60 * 1000, // 60s ceza süresi
};

function isBreakerOpen() {
    return breaker.cooldownUntil > Date.now();
}

function recordSuccess() {
    breaker.failureCount = 0;
    breaker.cooldownUntil = 0;
}

function recordFailure() {
    breaker.failureCount++;
    if (breaker.failureCount >= breaker.threshold) {
        breaker.cooldownUntil = Date.now() + breaker.cooldownMs;
        logger.warn(`[LLM] Circuit breaker AÇILDI — ${breaker.cooldownMs / 1000}s LLM atlanacak`);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function chatCompletionOllama(messages, cfg, options = {}) {
    const url = `${cfg.baseUrl}/api/chat`;
    const body = {
        model: cfg.model,
        messages,
        stream: false,
        options: {
            temperature: typeof options.temperature === "number" ? options.temperature : 0.65,
            num_predict: options.max_tokens || 1400,
        },
    };

    const res = await axios.post(url, body, {
        timeout: options.timeoutMs || 45000, // 120s → 45s (kullanıcı bekletmemeli)
        validateStatus: () => true,
        headers: { "Content-Type": "application/json" },
    });

    if (res.status >= 400) {
        const errMsg = res.data?.error || res.statusText || "Ollama API hatası";
        logger.warn(`[Ollama Chat] HTTP ${res.status}: ${errMsg}`);
        throw new Error(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
    }

    const text = res.data?.message?.content?.trim();
    if (!text) {
        logger.warn("[Ollama Chat] Boş yanıt");
        throw new Error("Ollama boş yanıt döndü");
    }

    return { text, model: `ollama:${cfg.model}` };
}

async function chatCompletionOpenAI(messages, cfg, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY tanımlı değil");
    }

    const body = {
        model: cfg.model,
        messages,
        temperature: typeof options.temperature === "number" ? options.temperature : 0.65,
        max_tokens: options.max_tokens || 1400,
    };

    const res = await axios.post("https://api.openai.com/v1/chat/completions", body, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        timeout: options.timeoutMs || 30000, // 90s → 30s (chat tek mesaj için)
        validateStatus: () => true,
    });

    if (res.status >= 400) {
        const errMsg = res.data?.error?.message || res.statusText || "OpenAI API hatası";
        logger.warn(`[OpenAI Chat] HTTP ${res.status}: ${errMsg}`);
        throw new Error(errMsg);
    }

    const text = res.data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
        logger.warn("[OpenAI Chat] Boş completion");
        throw new Error("Boş yanıt");
    }

    return { text, model: cfg.model };
}

/**
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @returns {Promise<{ text: string, model: string }>}
 */
async function chatCompletion(messages, options = {}) {
    const cfg = getLlmConfig();
    if (cfg.type === "none") {
        throw new Error("LLM yapılandırılmadı (LYSIA_LLM_PROVIDER=none veya anahtar/ollama yok)");
    }
    if (isBreakerOpen()) {
        const waitMs = breaker.cooldownUntil - Date.now();
        throw new Error(`LLM circuit breaker açık — ${Math.ceil(waitMs / 1000)}s sonra tekrar deneyin`);
    }

    const maxAttempts = Number(options.maxAttempts) || 2;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = cfg.type === "ollama"
                ? await chatCompletionOllama(messages, cfg, options)
                : await chatCompletionOpenAI(messages, cfg, options);
            recordSuccess();
            return result;
        } catch (err) {
            lastErr = err;
            const isTimeout = String(err.code || "").includes("ECONNABORTED") || /timeout/i.test(err.message || "");
            const isRateLimit = /rate limit|429/i.test(err.message || "");
            // Sadece timeout veya 5xx benzeri network hatalarında retry
            if (attempt < maxAttempts && (isTimeout || isRateLimit || /ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED/.test(err.code || err.message))) {
                const backoff = 400 * attempt;
                logger.warn(`[LLM] Deneme ${attempt}/${maxAttempts} başarısız (${err.message}). ${backoff}ms sonra retry...`);
                await sleep(backoff);
                continue;
            }
            break;
        }
    }
    recordFailure();
    throw lastErr;
}

/** Geriye dönük uyumluluk */
function isOpenAiConfigured() {
    return getLlmConfig().type === "openai";
}

module.exports = {
    getLlmConfig,
    isLlmEnabled,
    getLlmKindLabel,
    chatCompletion,
    isOpenAiConfigured,
};
