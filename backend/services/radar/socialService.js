/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOCIAL MEDIA SERVICE — LysiaRadar PRO v2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Instagram + TikTok veri toplama servisi.
 *
 * Kaynaklar:
 *   1. Instagram Graph API → hashtag verileri, post metrikleri
 *   2. TikTok for Developers API → video verileri, trend hashtag'ler
 *
 * NOT: Bu API'ler kullanıcı bağlantısı gerektirir (OAuth).
 * Kullanıcı Instagram/TikTok hesabını bağlamazsa, bu servis atlanır.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const logger = require("../../config/logger");
const axios = require("axios");
const User = require("../../models/User");

// ── Instagram Graph API ──
const INSTAGRAM_API_BASE = "https://graph.instagram.com";
const INSTAGRAM_API_VERSION = "v18.0";

// ── TikTok API ──
const TIKTOK_API_BASE = "https://open.tiktokapis.com";
const TIKTOK_API_VERSION = "v2";

/**
 * Kullanıcının Instagram access token'ını al
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getInstagramToken(userId) {
    try {
        const user = await User.findById(userId).select("socialConnections").lean();
        return user?.socialConnections?.instagram?.accessToken || null;
    } catch (err) {
        logger.warn(`[SocialService] Instagram token alınamadı (${userId}): ${err.message}`);
        return null;
    }
}

/**
 * Kullanıcının TikTok access token'ını al
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getTikTokToken(userId) {
    try {
        const user = await User.findById(userId).select("socialConnections").lean();
        return user?.socialConnections?.tiktok?.accessToken || null;
    } catch (err) {
        logger.warn(`[SocialService] TikTok token alınamadı (${userId}): ${err.message}`);
        return null;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Instagram'da bir hashtag için veri topla
 * @param {string} hashtag - Hashtag (# olmadan)
 * @param {string} userId - Kullanıcı ID (token için)
 * @returns {Promise<object>}
 */
async function getInstagramHashtagData(hashtag, userId) {
    try {
        const accessToken = await getInstagramToken(userId);
        if (!accessToken) {
            logger.debug(`[SocialService] Instagram bağlantısı yok — user ${String(userId).slice(-6)}`);
            return defaultInstagramData();
        }

        // 1. Hashtag ID'sini al
        const searchUrl = `${INSTAGRAM_API_BASE}/${INSTAGRAM_API_VERSION}/ig_hashtag_search`;
        const searchParams = {
            user_id: userId,
            q: hashtag,
            access_token: accessToken,
        };

        const searchRes = await axios.get(searchUrl, { params: searchParams, timeout: 10000 });
        const hashtagId = searchRes.data?.data?.[0]?.id;

        if (!hashtagId) {
            logger.debug(`[SocialService] Instagram hashtag bulunamadı: #${hashtag}`);
            return defaultInstagramData();
        }

        // 2. Hashtag detaylarını al
        const detailUrl = `${INSTAGRAM_API_BASE}/${INSTAGRAM_API_VERSION}/${hashtagId}`;
        const detailParams = {
            fields: "id,name,media_count",
            access_token: accessToken,
        };

        const detailRes = await axios.get(detailUrl, { params: detailParams, timeout: 10000 });
        const hashtagData = detailRes.data;

        // 3. Son medya postlarını al (engagement hesaplamak için)
        const mediaUrl = `${INSTAGRAM_API_BASE}/${INSTAGRAM_API_VERSION}/${hashtagId}/recent_media`;
        const mediaParams = {
            user_id: userId,
            fields: "id,media_type,media_url,permalink,timestamp,like_count,comments_count",
            limit: 25,
            access_token: accessToken,
        };

        const mediaRes = await axios.get(mediaUrl, { params: mediaParams, timeout: 10000 });
        const recentMedia = mediaRes.data?.data || [];

        // Engagement hesapla
        const totalLikes = recentMedia.reduce((sum, m) => sum + (m.like_count || 0), 0);
        const totalComments = recentMedia.reduce((sum, m) => sum + (m.comments_count || 0), 0);
        const avgLikes = recentMedia.length > 0 ? Math.round(totalLikes / recentMedia.length) : 0;
        const avgComments = recentMedia.length > 0 ? Math.round(totalComments / recentMedia.length) : 0;

        // Engagement rate (basit hesap: (likes + comments) / post_count)
        const engagementRate = recentMedia.length > 0
            ? ((totalLikes + totalComments) / recentMedia.length / 1000) * 100
            : 0;

        return {
            hashtagPostCount: hashtagData.media_count || 0,
            recentPostCount: recentMedia.length,
            avgLikes,
            avgComments,
            engagementRate: Math.round(engagementRate * 10) / 10,
            topInfluencers: [], // Instagram Graph API bu veriyi sağlamıyor
            dataSource: "instagram_graph_api",
        };
    } catch (err) {
        logger.warn(`[SocialService] Instagram hashtag hatası (#${hashtag}): ${err.message}`);
        return defaultInstagramData();
    }
}

/**
 * Instagram için birden fazla keyword analizi
 * @param {string[]} keywords
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getInstagramTrends(keywords, userId) {
    const results = {};
    for (const kw of keywords.slice(0, 10)) { // Max 10 keyword
        const hashtag = kw.replace(/\s+/g, "").toLowerCase();
        results[kw] = await getInstagramHashtagData(hashtag, userId);
        // Rate limit — Instagram API limiti: 200 req/hour
        await new Promise(r => setTimeout(r, 2000));
    }
    return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// TIKTOK
// ═════════════════════════════════════════════════════════════════════════════

/**
 * TikTok'ta bir hashtag için veri topla
 * @param {string} hashtag - Hashtag (# olmadan)
 * @param {string} userId - Kullanıcı ID (token için)
 * @returns {Promise<object>}
 */
async function getTikTokHashtagData(hashtag, userId) {
    try {
        const accessToken = await getTikTokToken(userId);
        if (!accessToken) {
            logger.debug(`[SocialService] TikTok bağlantısı yok — user ${String(userId).slice(-6)}`);
            return defaultTikTokData();
        }

        // TikTok Research API — hashtag video arama
        const searchUrl = `${TIKTOK_API_BASE}/${TIKTOK_API_VERSION}/research/video/query/`;
        const requestBody = {
            query: {
                and: [
                    { field_name: "hashtag_name", field_values: [hashtag] }
                ]
            },
            max_count: 100,
            start_date: getDateDaysAgo(30), // Son 30 gün
            end_date: getTodayDate(),
        };

        const headers = {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };

        const response = await axios.post(searchUrl, requestBody, { headers, timeout: 15000 });
        const videos = response.data?.data?.videos || [];

        if (videos.length === 0) {
            logger.debug(`[SocialService] TikTok hashtag bulunamadı: #${hashtag}`);
            return defaultTikTokData();
        }

        // Metrikleri hesapla
        const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
        const totalLikes = videos.reduce((sum, v) => sum + (v.like_count || 0), 0);
        const totalShares = videos.reduce((sum, v) => sum + (v.share_count || 0), 0);

        const avgViews = Math.round(totalViews / videos.length);
        const avgLikes = Math.round(totalLikes / videos.length);
        const avgShares = Math.round(totalShares / videos.length);

        // Engagement rate: (likes + shares) / views * 100
        const engagementRate = totalViews > 0
            ? ((totalLikes + totalShares) / totalViews) * 100
            : 0;

        // Viral kontrolü — ortalama görüntülenme > 100K
        const isViral = avgViews > 100000;

        return {
            videoCount: videos.length,
            totalViews,
            avgViews,
            avgLikes,
            avgShares,
            engagementRate: Math.round(engagementRate * 10) / 10,
            isViral,
            dataSource: "tiktok_research_api",
        };
    } catch (err) {
        logger.warn(`[SocialService] TikTok hashtag hatası (#${hashtag}): ${err.message}`);
        return defaultTikTokData();
    }
}

/**
 * TikTok için birden fazla keyword analizi
 * @param {string[]} keywords
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getTikTokTrends(keywords, userId) {
    const results = {};
    for (const kw of keywords.slice(0, 10)) { // Max 10 keyword
        const hashtag = kw.replace(/\s+/g, "").toLowerCase();
        results[kw] = await getTikTokHashtagData(hashtag, userId);
        // Rate limit — TikTok API limiti: 1000 req/day
        await new Promise(r => setTimeout(r, 3000));
    }
    return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// BİRLEŞİK ANALİZ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Bir keyword için tüm sosyal medya verilerini topla
 * @param {string} keyword
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getSocialMediaData(keyword, userId) {
    const [instagram, tiktok] = await Promise.all([
        getInstagramHashtagData(keyword, userId),
        getTikTokHashtagData(keyword, userId),
    ]);

    // Birleşik skor hesapla
    const socialScore = calculateSocialScore(instagram, tiktok);

    return {
        keyword,
        instagram,
        tiktok,
        socialScore,
        hasSocialData: instagram.hashtagPostCount > 0 || tiktok.videoCount > 0,
    };
}

/**
 * Sosyal medya skorunu hesapla (0-100)
 */
function calculateSocialScore(instagram, tiktok) {
    let score = 0;

    // Instagram skoru (max 50)
    if (instagram.hashtagPostCount > 100000) score += 25;
    else if (instagram.hashtagPostCount > 50000) score += 20;
    else if (instagram.hashtagPostCount > 10000) score += 15;
    else if (instagram.hashtagPostCount > 1000) score += 10;
    else if (instagram.hashtagPostCount > 0) score += 5;

    if (instagram.engagementRate > 5) score += 15;
    else if (instagram.engagementRate > 3) score += 10;
    else if (instagram.engagementRate > 1) score += 5;

    if (instagram.recentPostCount > 20) score += 10;
    else if (instagram.recentPostCount > 10) score += 5;

    // TikTok skoru (max 50)
    if (tiktok.videoCount > 10000) score += 25;
    else if (tiktok.videoCount > 5000) score += 20;
    else if (tiktok.videoCount > 1000) score += 15;
    else if (tiktok.videoCount > 100) score += 10;
    else if (tiktok.videoCount > 0) score += 5;

    if (tiktok.isViral) score += 15;
    else if (tiktok.avgViews > 50000) score += 10;
    else if (tiktok.avgViews > 10000) score += 5;

    if (tiktok.engagementRate > 10) score += 10;
    else if (tiktok.engagementRate > 5) score += 5;

    return Math.min(100, Math.round(score));
}

// ── Yardımcılar ──

function defaultInstagramData() {
    return {
        hashtagPostCount: 0,
        recentPostCount: 0,
        avgLikes: 0,
        avgComments: 0,
        engagementRate: 0,
        topInfluencers: [],
        dataSource: "none",
    };
}

function defaultTikTokData() {
    return {
        videoCount: 0,
        totalViews: 0,
        avgViews: 0,
        avgLikes: 0,
        avgShares: 0,
        engagementRate: 0,
        isViral: false,
        dataSource: "none",
    };
}

function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0].replace(/-/g, "");
}

function getTodayDate() {
    return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

module.exports = {
    getInstagramHashtagData,
    getTikTokHashtagData,
    getInstagramTrends,
    getTikTokTrends,
    getSocialMediaData,
    calculateSocialScore,
};
