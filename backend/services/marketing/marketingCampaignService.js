const MarketingCampaign = require("../../models/MarketingCampaign");

const MarketingEvent = require("../../models/MarketingEvent");

const { resolveCampaignRecipients } = require("./marketingRecipientService");

const { sendMarketingEmail, sendMarketingSms, getStoreName, personalize } = require("./marketingDeliveryService");

const { getOrCreateSettings, isQuietHour } = require("./marketingSettingsService");



const TEMPLATES = {

    discount: { subject: "Size özel indirim!", content: "Merhaba {{name}}, mağazamızda %{{discount}} indirim sizi bekliyor." },

    new_product: { subject: "Yeni ürünler geldi", content: "Merhaba {{name}}, yeni koleksiyonumuzu keşfedin." },

    abandoned_cart: { subject: "Sepetiniz sizi bekliyor", content: "Merhaba {{name}}, sepetinizdeki ürünler hâlâ stokta." },

    special_day: { subject: "Özel gününüz kutlu olsun", content: "Merhaba {{name}}, size özel bir sürprizimiz var." },

    announcement: { subject: "Duyuru", content: "Merhaba {{name}}, önemli bir duyurumuz var." },

    coupon: { subject: "Kupon kodunuz", content: "Merhaba {{name}}, kupon kodunuz: {{coupon}}" },

};



async function listCampaigns(storeId, { type, status } = {}) {

    const q = { storeId };

    if (type) q.type = type;

    if (status) q.status = status;

    return MarketingCampaign.find(q).sort({ createdAt: -1 }).lean();

}



async function getCampaign(storeId, id) {

    return MarketingCampaign.findOne({ _id: id, storeId }).lean();

}



async function createCampaign(storeId, userId, body) {

    const tpl = TEMPLATES[body.templateKey];

    const doc = await MarketingCampaign.create({

        storeId,

        userId,

        name: body.name,

        type: body.type,

        subject: body.subject || tpl?.subject || "",

        content: body.content || tpl?.content || "",

        htmlContent: body.htmlContent || "",

        templateKey: body.templateKey || "custom",

        segmentId: body.segmentId || null,

        status: body.status || "draft",

        scheduledAt: body.scheduledAt || null,

    });

    return doc.toObject();

}



async function updateCampaign(storeId, id, body) {

    const allowed = [

        "name",

        "subject",

        "content",

        "htmlContent",

        "templateKey",

        "segmentId",

        "status",

        "scheduledAt",

    ];

    const patch = {};

    for (const k of allowed) {

        if (body[k] !== undefined) patch[k] = body[k];

    }

    const doc = await MarketingCampaign.findOneAndUpdate({ _id: id, storeId }, { $set: patch }, { new: true }).lean();

    return doc;

}



async function deleteCampaign(storeId, id) {

    await MarketingCampaign.deleteOne({ _id: id, storeId });

    return { ok: true };

}



async function sendCampaign(storeId, id, opts = {}) {

    const campaign = await MarketingCampaign.findOne({ _id: id, storeId });

    if (!campaign) return { error: "Kampanya bulunamadı" };

    if (campaign.status === "sent") return { error: "Kampanya zaten gönderildi" };

    if (campaign.status === "sending") return { error: "Kampanya şu an gönderiliyor" };



    if (

        campaign.status === "scheduled" &&

        campaign.scheduledAt &&

        new Date(campaign.scheduledAt) > new Date() &&

        !opts.fromScheduler &&

        !opts.fromQueue

    ) {

        return { error: "Kampanya henüz planlanan zamana gelmedi" };

    }



    const settings = await getOrCreateSettings(storeId);

    if (campaign.type === "SMS" && isQuietHour(settings)) {

        return { error: "Sessiz saatlerde SMS gönderilemez. Ayarlardan kontrol edin." };

    }



    let recipients = await resolveCampaignRecipients(storeId, campaign);

    if (campaign.type === "EMAIL") {

        recipients = recipients.filter((r) => r.email && r.marketingEmailConsent !== false);

    } else {

        recipients = recipients.filter((r) => r.phone);

    }



    if (!recipients.length) {

        return {

            error:

                campaign.type === "EMAIL"

                    ? "Gönderilecek izinli e-posta adresi bulunamadı. Segment seçin veya müşteri pazarlama iznini kontrol edin."

                    : "Gönderilecek telefon numarası bulunamadı. Müşteri kayıtlarında telefon olmalı.",

        };

    }



    campaign.status = "sending";

    await campaign.save();



    const storeName = await getStoreName(storeId);

    let sent = 0;

    let delivered = 0;

    let failed = 0;

    const errors = [];



    for (const r of recipients) {

        const vars = { name: r.name || "Müşterimiz", coupon: "HOSGELDIN", discount: "10" };

        let result;



        if (campaign.type === "EMAIL") {

            result = await sendMarketingEmail(storeId, {

                to: r.email,

                subject: campaign.subject,

                text: campaign.content,

                html: campaign.htmlContent || "",

                name: r.name,

                storeName,

            });

        } else {

            result = await sendMarketingSms(storeId, {

                phone: r.phone,

                text: campaign.content,

                name: r.name,

            });

        }



        const recipientKey = campaign.type === "EMAIL" ? r.email : r.phone;

        const eventBase = {

            storeId,

            channel: campaign.type,

            campaignId: campaign._id,

            segmentId: campaign.segmentId,

            customerEmail: campaign.type === "EMAIL" ? r.email : recipientKey,

            meta: {

                subject: campaign.subject,

                preview: false,

                phone: campaign.type === "SMS" ? r.phone : undefined,

                error: result.ok ? undefined : result.error,

            },

        };



        if (result.ok) {

            delivered++;

            sent++;

            await MarketingEvent.create({

                ...eventBase,

                type: campaign.type === "SMS" ? "sms_sent" : "campaign_sent",

            });

        } else {

            failed++;

            if (errors.length < 5) errors.push(`${recipientKey}: ${result.error}`);

            await MarketingEvent.create({

                ...eventBase,

                type: "campaign_failed",

            });

        }

    }



    campaign.status = "sent";

    campaign.sentAt = new Date();

    campaign.stats.sent = sent;

    campaign.stats.delivered = delivered;

    await campaign.save();



    return {

        sent,

        delivered,

        failed,

        total: recipients.length,

        errors,

        campaign: campaign.toObject(),

    };

}



module.exports = {

    listCampaigns,

    getCampaign,

    createCampaign,

    updateCampaign,

    deleteCampaign,

    sendCampaign,

    TEMPLATES,

};

