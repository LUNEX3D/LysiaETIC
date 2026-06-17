const MarketingAutomation = require("../../models/MarketingAutomation");

const MarketingEvent = require("../../models/MarketingEvent");

const logger = require("../../config/logger");

const { sendMarketingEmail, sendMarketingSms, getStoreName } = require("./marketingDeliveryService");

const { TEMPLATES } = require("./marketingCampaignService");

const { enqueueAutomationResume } = require("./marketingQueueService");

const StoreCustomer = require("../../models/StoreCustomer");



const DEFAULT_WELCOME_FLOW = {

    name: "Hoş geldin serisi",

    trigger: { type: "customer_registered", config: {} },

    nodes: [

        { id: "t1", type: "trigger", position: { x: 80, y: 80 }, config: { label: "Müşteri kayıt oldu" } },

        { id: "d1", type: "delay", position: { x: 80, y: 200 }, config: { minutes: 15, label: "15 dakika bekle" } },

        {

            id: "a1",

            type: "action",

            position: { x: 80, y: 320 },

            config: { actionType: "send_email", subject: "Hoş geldiniz!", templateKey: "announcement" },

        },

    ],

    edges: [

        { from: "t1", to: "d1" },

        { from: "d1", to: "a1" },

    ],

};



async function listAutomations(storeId) {

    return MarketingAutomation.find({ storeId }).sort({ updatedAt: -1 }).lean();

}



async function getAutomation(storeId, id) {

    return MarketingAutomation.findOne({ _id: id, storeId }).lean();

}



async function createAutomation(storeId, userId, body) {

    const base = body.useWelcomeTemplate ? DEFAULT_WELCOME_FLOW : {};

    const doc = await MarketingAutomation.create({

        storeId,

        userId,

        name: body.name || base.name || "Yeni otomasyon",

        description: body.description || "",

        status: body.status || "draft",

        trigger: body.trigger || base.trigger || { type: "customer_registered", config: {} },

        nodes: body.nodes?.length ? body.nodes : base.nodes || [],

        edges: body.edges?.length ? body.edges : base.edges || [],

    });

    return doc.toObject();

}



async function updateAutomation(storeId, id, body) {

    const patch = {};

    for (const k of ["name", "description", "status", "trigger", "nodes", "edges"]) {

        if (body[k] !== undefined) patch[k] = body[k];

    }

    return MarketingAutomation.findOneAndUpdate({ _id: id, storeId }, { $set: patch }, { new: true }).lean();

}



async function deleteAutomation(storeId, id) {

    await MarketingAutomation.deleteOne({ _id: id, storeId });

    return { ok: true };

}



async function enrichContext(storeId, context) {

    const email = String(context.customerEmail || "").trim().toLowerCase();

    if (!email) return context;

    const c = await StoreCustomer.findOne({ storeId, email }).select("firstName lastName phone phoneCountryCode").lean();

    if (!c) return context;

    const { normalizePhone } = require("./marketingRecipientService");

    return {

        ...context,

        customerName: [c.firstName, c.lastName].filter(Boolean).join(" "),

        customerPhone: normalizePhone(c.phone, c.phoneCountryCode),

    };

}



async function runAutomationForEvent(storeId, eventType, context = {}) {

    const automations = await MarketingAutomation.find({ storeId, status: "active", "trigger.type": eventType }).lean();

    const enriched = await enrichContext(storeId, context);

    for (const auto of automations) {

        try {

            await executeWorkflow(storeId, auto, enriched);

        } catch (e) {

            logger.warn("[Marketing automation]", auto._id, e.message);

        }

    }

}



async function resumeWorkflowFromNode(storeId, automationId, startNodeId, context) {

    const automation = await MarketingAutomation.findOne({ _id: automationId, storeId }).lean();

    if (!automation || automation.status !== "active") return;

    const enriched = await enrichContext(storeId, context);

    await executeWorkflow(storeId, automation, enriched, startNodeId);

}



async function executeWorkflow(storeId, automation, context, startNodeId = null) {

    const nodeMap = new Map((automation.nodes || []).map((n) => [n.id, n]));

    const edges = automation.edges || [];

    const start = startNodeId ? nodeMap.get(startNodeId) : (automation.nodes || []).find((n) => n.type === "trigger");

    if (!start) return;



    let currentId = start.id;

    const visited = new Set();



    while (currentId && !visited.has(currentId)) {

        visited.add(currentId);

        const node = nodeMap.get(currentId);

        if (!node) break;



        if (node.type === "delay") {

            const minutes = Number(node.config?.minutes) || 0;

            const nextEdge = edges.find((e) => e.from === currentId);

            const nextId = nextEdge?.to;

            if (minutes > 0 && nextId) {

                const runAt = new Date(Date.now() + minutes * 60 * 1000);

                if (minutes <= 2) {

                    await new Promise((r) => setTimeout(r, minutes * 60 * 1000));

                } else {

                    await enqueueAutomationResume(storeId, automation._id, nextId, context, runAt);

                    await MarketingAutomation.updateOne({ _id: automation._id }, { $inc: { "stats.enrolled": 1 } });

                    return;

                }

            }

        } else if (node.type === "action") {

            await runAction(storeId, automation, node, context);

        }



        const nextEdge = edges.find((e) => e.from === currentId);

        currentId = nextEdge?.to || null;

    }



    await MarketingAutomation.updateOne(

        { _id: automation._id },

        { $inc: { "stats.enrolled": 1, "stats.completed": 1 } }

    );

}



async function runAction(storeId, automation, node, context) {

    const actionType = node.config?.actionType || "send_email";

    const email = String(context.customerEmail || "").trim().toLowerCase();

    const name = context.customerName || "";

    const storeName = await getStoreName(storeId);

    let delivery = { ok: false };



    if (actionType === "send_email" && email) {

        const tpl = TEMPLATES[node.config?.templateKey] || {};

        delivery = await sendMarketingEmail(storeId, {

            to: email,

            subject: node.config?.subject || tpl.subject || "Mesajınız",

            text: node.config?.text || tpl.content || "Merhaba {{name}}",

            name,

            storeName,

        });

    } else if (actionType === "send_sms" && context.customerPhone) {

        delivery = await sendMarketingSms(storeId, {

            phone: context.customerPhone,

            text: node.config?.text || "Merhaba {{name}}",

            name,

        });

    }



    await MarketingEvent.create({

        storeId,

        type: "automation_step",

        channel: "AUTOMATION",

        automationId: automation._id,

        customerEmail: email || context.customerPhone || "",

        meta: {

            action: actionType,

            nodeId: node.id,

            subject: node.config?.subject,

            delivered: delivery.ok,

            error: delivery.ok ? undefined : delivery.error,

        },

    });



    if (!delivery.ok && delivery.error) {

        logger.warn("[Marketing automation action]", automation._id, delivery.error);

    }

}



module.exports = {

    listAutomations,

    getAutomation,

    createAutomation,

    updateAutomation,

    deleteAutomation,

    runAutomationForEvent,

    resumeWorkflowFromNode,

    executeWorkflow,

    DEFAULT_WELCOME_FLOW,

};

