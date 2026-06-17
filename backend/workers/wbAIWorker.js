"use strict";

/**
 * wbAIWorker.js — Website Builder AI BullMQ Worker
 * Kuyruklar: wb-ai-fast | wb-ai-standard | wb-ai-heavy | wb-ai-analysis
 */

const { Worker, Queue } = require("bullmq");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../.env.local"), override: true });

const WBAIJob = require("../models/WBAIJob");
const WBAIContent = require("../models/WBAIContent");
const logger = require("../config/logger");
const connectDB = require("../config/db");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const isRedisConfigured = () => !!(process.env.REDIS_URL && String(process.env.REDIS_URL).trim());

// ─── OpenAI çağrı yardımcısı ──────────────────────────────────────────────────

async function callOpenAI(systemPrompt, userPrompt, model = "gpt-4o-mini", maxTokens = 1500) {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY tanımlı değil");

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const start = Date.now();
    const response = await openai.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
    });

    return {
        content: response.choices[0].message.content,
        tokensUsed: response.usage?.total_tokens || 0,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        modelUsed: model,
        generationTimeMs: Date.now() - start,
    };
}

// ─── Prompt şablonları ────────────────────────────────────────────────────────

function buildPrompt(jobType, input) {
    const lang = input.parameters?.language || "tr";
    const tone = input.parameters?.tone || "professional";
    const wordCount = input.parameters?.wordCount || 200;
    const keywords = (input.parameters?.keywords || []).join(", ");
    const toneDesc = { professional: "profesyonel ve güvenilir", casual: "samimi ve rahat", friendly: "sıcak ve arkadaşça", formal: "resmi ve kurumsal", enthusiastic: "heyecanlı ve enerjik" }[tone] || tone;

    const sysBase = `Sen LysiaETIC e-ticaret platformunun AI yazarısın. ${lang === "tr" ? "Türkçe" : "İngilizce"} içerik üretiyorsun. Ton: ${toneDesc}.`;

    const prompts = {
        blog_writer: {
            system: `${sysBase} Blog yazıları üretiyorsun. SEO uyumlu, okunabilir, değerli içerikler yaz. HTML formatında yanıt ver.`,
            user: `Başlık: "${input.prompt}"\nHedef kitle: ${input.parameters?.targetAudience || "genel"}\nKelime sayısı: yaklaşık ${wordCount}\nAnahtar kelimeler: ${keywords}\n\nSEO uyumlu, okunabilir bir blog yazısı yaz. Giriş paragrafı, en az 3 alt başlık (H2), içerik ve sonuç bölümü içersin. HTML döndür.`,
            model: "gpt-4o",
            maxTokens: 2500,
        },
        product_description: {
            system: `${sysBase} Ürün açıklamaları yazıyorsun. Dönüşüm odaklı, özellikleri öne çıkaran, SEO uyumlu metinler üret.`,
            user: `Ürün: "${input.prompt}"\nKelime sayısı: ~${wordCount}\nAnahtar kelimeler: ${keywords}\n\nHTML formatında ürün açıklaması yaz. Özellikler, faydalar ve CTA içersin.`,
            model: "gpt-4o-mini",
            maxTokens: 800,
        },
        seo_meta_generator: {
            system: `${sysBase} SEO meta verileri üretiyorsun. JSON formatında yanıt ver.`,
            user: `Sayfa içeriği/konu: "${input.prompt}"\nAnahtar kelimeler: ${keywords}\n\nJSON formatında döndür: {"title": "50-60 karakter başlık", "description": "150-160 karakter açıklama", "keywords": ["kw1","kw2","kw3"]}`,
            model: "gpt-4o-mini",
            maxTokens: 300,
        },
        color_palette_generator: {
            system: `${sysBase} Renk paletleri üretiyorsun. JSON formatında hex kodları döndür.`,
            user: `Marka/konsept: "${input.prompt}"\n\nJSON formatında döndür: {"primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex", "backgroundColor": "#hex", "textPrimary": "#hex", "textSecondary": "#hex", "reasoning": "açıklama"}`,
            model: "gpt-4o-mini",
            maxTokens: 300,
        },
        category_description: {
            system: `${sysBase} Kategori açıklamaları yazıyorsun.`,
            user: `Kategori: "${input.prompt}"\nKelime sayısı: ~${wordCount}\nAnahtar kelimeler: ${keywords}\n\nSEO uyumlu, kısa ve net bir kategori açıklaması yaz. HTML döndür.`,
            model: "gpt-4o-mini",
            maxTokens: 600,
        },
        banner_generator: {
            system: `${sysBase} Kampanya banner içerikleri üretiyorsun. JSON formatında döndür.`,
            user: `Kampanya: "${input.prompt}"\n\nJSON: {"heading": "başlık", "subtext": "alt metin", "ctaText": "buton metni", "discount": "indirim metni (varsa)", "badgeText": "rozet metni"}`,
            model: "gpt-4o-mini",
            maxTokens: 300,
        },
        product_faq_generator: {
            system: `${sysBase} Ürün SSS içerikleri üretiyorsun. JSON formatında döndür.`,
            user: `Ürün: "${input.prompt}"\n\nJSON: {"faqs": [{"question": "soru", "answer": "cevap"}]} şeklinde 5-8 SSS üret.`,
            model: "gpt-4o-mini",
            maxTokens: 1000,
        },
        alt_text_generator: {
            system: `${sysBase} Görsel alt metinleri üretiyorsun. SEO ve erişilebilirlik odaklı, kısa.`,
            user: `Görsel açıklaması: "${input.prompt}"\nJSON: {"altText": "kısa alt metin", "title": "uzun başlık"}`,
            model: "gpt-4o-mini",
            maxTokens: 100,
        },
        landing_page_generator: {
            system: `${sysBase} E-ticaret landing page'leri için section dizisi üretiyorsun. JSON array döndür.`,
            user: `Marka/ürün: "${input.prompt}"\nHedef kitle: ${input.parameters?.targetAudience || "genel"}\n\nJSON array döndür. Her item: {"type": "hero|product-grid|testimonials|newsletter|banner|text", "content": {...}}. En az 5 section içeren bir landing page oluştur.`,
            model: "gpt-4o",
            maxTokens: 3000,
        },
        seo_helper: {
            system: `${sysBase} Sen profesyonel bir e-ticaret SEO uzmanısın. Shopify ve IKAS standartlarında, tıklama oranı (CTR) yüksek meta veriler ve URL yapıları önerirsin. JSON formatında yanıt ver.`,
            user: `Konu/Ürün/Kategori: "${input.prompt}"\nAnahtar kelimeler: ${keywords}\n\nLütfen şunları içeren bir JSON döndür:\n{\n  "title": "50-60 karakter, anahtar kelime başta, ilgi çekici başlık",\n  "description": "150-160 karakter, değer önerisi ve CTA içeren açıklama",\n  "slug": "url-dostu-kisa-slug",\n  "keywords": ["en önemli 5 anahtar kelime"],\n  "ogTitle": "Sosyal medya için merak uyandıran başlık",\n  "structuredDataTip": "Hangi schema.org tipinin kullanılması gerektiğine dair kısa not"\n}`,
            model: "gpt-4o",
            maxTokens: 500,
        },
    };

    return prompts[jobType] || {
        system: sysBase,
        user: input.prompt,
        model: "gpt-4o-mini",
        maxTokens: 500,
    };
}

function determineContentType(jobType) {
    const map = {
        landing_page_generator: "page_layout",
        blog_writer: "blog_post",
        product_description: "product_description",
        seo_meta_generator: "seo_meta",
        category_description: "category_description",
        banner_generator: "banner_content",
        color_palette_generator: "color_palette",
        product_faq_generator: "product_faq",
        alt_text_generator: "alt_text",
        translation_auto: "translation",
    };
    return map[jobType] || "text";
}

// ─── Worker işleme fonksiyonu ──────────────────────────────────────────────────

async function processJob(job) {
    const { jobId } = job.data;
    const dbJob = await WBAIJob.findById(jobId);
    if (!dbJob) { logger.warn(`[WBAIWorker] Job not found: ${jobId}`); return; }

    await WBAIJob.updateOne({ _id: jobId }, { $set: { status: "processing", startedAt: new Date(), bullMQJobId: String(job.id) } });

    try {
        const promptConfig = buildPrompt(dbJob.jobType, dbJob.input);
        const result = await callOpenAI(promptConfig.system, promptConfig.user, promptConfig.model, promptConfig.maxTokens);

        let parsedContent = result.content;
        if (dbJob.jobType.endsWith("_generator") || ["seo_meta_generator", "color_palette_generator", "banner_generator", "product_faq_generator", "alt_text_generator"].includes(dbJob.jobType)) {
            try {
                const jsonMatch = result.content.match(/```json\n?([\s\S]+?)\n?```/) || [null, result.content];
                parsedContent = JSON.parse(jsonMatch[1]);
            } catch {
                parsedContent = result.content;
            }
        }

        const contentType = determineContentType(dbJob.jobType);
        const outputType = typeof parsedContent === "string" ? "html" : typeof parsedContent === "object" && Array.isArray(parsedContent) ? "sections_array" : typeof parsedContent === "object" ? "json" : "text";

        const aiContent = await WBAIContent.create({
            siteId: dbJob.siteId,
            userId: dbJob.userId,
            jobId: dbJob._id,
            contentType,
            title: dbJob.input.prompt?.slice(0, 100) || dbJob.jobType,
            content: parsedContent,
            prompt: dbJob.input.prompt,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
        });

        await WBAIJob.updateOne({ _id: jobId }, {
            $set: {
                status: "completed",
                completedAt: new Date(),
                "output.generatedContent": parsedContent,
                "output.contentType": outputType,
                "output.tokensUsed": result.tokensUsed,
                "output.promptTokens": result.promptTokens,
                "output.completionTokens": result.completionTokens,
                "output.modelUsed": result.modelUsed,
                "output.generationTimeMs": result.generationTimeMs,
            },
        });

        logger.info(`[WBAIWorker] ✓ Job ${jobId} completed (${result.generationTimeMs}ms, ${result.tokensUsed} tokens)`);
        return { contentId: aiContent._id };
    } catch (err) {
        logger.error(`[WBAIWorker] ✗ Job ${jobId} failed: ${err.message}`);

        const retryCount = (dbJob.retryCount || 0) + 1;
        const finalStatus = retryCount >= (dbJob.maxRetries || 2) ? "failed" : "queued";

        await WBAIJob.updateOne({ _id: jobId }, {
            $set: { status: finalStatus, errorMessage: err.message, retryCount },
        });

        if (finalStatus === "failed") throw err;
    }
}

// ─── Worker başlatma ──────────────────────────────────────────────────────────

async function startWorkers() {
    if (!isRedisConfigured()) {
        logger.debug("[WBAIWorker] REDIS_URL yok — AI kuyruğu atlandı (Website Builder AI için Redis gerekir).");
        return;
    }

    await connectDB();
    logger.info("[WBAIWorker] Starting AI workers...");

    const redisConnection = {
        url: process.env.REDIS_URL,
        maxRetriesPerRequest: null,
    };

    const queues = [
        { name: "wb-ai-fast", concurrency: 5 },
        { name: "wb-ai-standard", concurrency: 3 },
        { name: "wb-ai-heavy", concurrency: 1 },
        { name: "wb-ai-analysis", concurrency: 2 },
    ];

    for (const { name, concurrency } of queues) {
        const worker = new Worker(name, processJob, { connection: redisConnection, concurrency });
        worker.on("error", (err) => {
            logger.warn(`[WBAIWorker] ${name}: ${err.message}`);
        });
        logger.info(`[WBAIWorker] Queue "${name}" started (concurrency: ${concurrency})`);
    }
}

if (require.main === module) {
    startWorkers().catch((err) => {
        logger.error("[WBAIWorker] Fatal:", err.message);
        process.exit(1);
    });
}

module.exports = { startWorkers };
