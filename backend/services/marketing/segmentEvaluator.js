const StoreOrder = require("../../models/StoreOrder");
const StoreCustomer = require("../../models/StoreCustomer");
const { normalizePhone } = require("./marketingRecipientService");

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];

async function buildCustomerStats(storeId) {
    const orders = await StoreOrder.find({
        storeId,
        isDraft: { $ne: true },
        status: { $in: PAID_STATUSES },
    })
        .select("customer.email customer.name total createdAt")
        .lean();

    const byEmail = new Map();
    for (const o of orders) {
        const email = String(o.customer?.email || "").trim().toLowerCase();
        if (!email) continue;
        let row = byEmail.get(email);
        if (!row) {
            row = { email, name: o.customer?.name || "", totalOrders: 0, totalSpent: 0, lastOrderAt: null };
            byEmail.set(email, row);
        }
        row.totalOrders += 1;
        row.totalSpent += Number(o.total) || 0;
        const d = o.createdAt ? new Date(o.createdAt) : null;
        if (d && (!row.lastOrderAt || d > row.lastOrderAt)) row.lastOrderAt = d;
    }

    const customers = await StoreCustomer.find({ storeId })
        .select("email marketingEmailConsent tags groups firstName lastName phone phoneCountryCode")
        .lean();

    for (const c of customers) {
        const email = String(c.email || "").trim().toLowerCase();
        if (!email) continue;
        let row = byEmail.get(email);
        if (!row) {
            row = { email, name: [c.firstName, c.lastName].filter(Boolean).join(" "), totalOrders: 0, totalSpent: 0, lastOrderAt: null };
            byEmail.set(email, row);
        }
        row.marketingEmailConsent = !!c.marketingEmailConsent;
        row.tags = c.tags || [];
        row.groups = c.groups || [];
        row.phone = normalizePhone(c.phone, c.phoneCountryCode);
    }

    const now = Date.now();
    for (const row of byEmail.values()) {
        row.lastOrderDaysAgo = row.lastOrderAt
            ? Math.floor((now - row.lastOrderAt.getTime()) / (24 * 60 * 60 * 1000))
            : 9999;
    }

    return byEmail;
}

function evalRule(row, rule) {
    const field = rule.field;
    const op = rule.operator;
    const val = rule.value;
    let actual;

    switch (field) {
        case "totalOrders":
            actual = row.totalOrders;
            break;
        case "totalSpent":
            actual = row.totalSpent;
            break;
        case "lastOrderDaysAgo":
            actual = row.lastOrderDaysAgo;
            break;
        case "marketingEmailConsent":
            actual = !!row.marketingEmailConsent;
            break;
        case "tag":
            actual = row.tags || [];
            break;
        case "group":
            actual = row.groups || [];
            break;
        default:
            return false;
    }

    const numVal = Number(val);
    switch (op) {
        case ">":
            return Number(actual) > numVal;
        case ">=":
            return Number(actual) >= numVal;
        case "<":
            return Number(actual) < numVal;
        case "<=":
            return Number(actual) <= numVal;
        case "==":
        case "equals":
            return actual == val;
        case "!=":
            return actual != val;
        case "contains":
            if (Array.isArray(actual)) return actual.map(String).includes(String(val));
            return String(actual).toLowerCase().includes(String(val).toLowerCase());
        default:
            return false;
    }
}

function matchSegmentRules(row, segmentRules) {
    const rules = segmentRules?.rules || [];
    if (!rules.length) return true;
    const logic = segmentRules.logic === "or" ? "or" : "and";
    const results = rules.map((r) => evalRule(row, r));
    return logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

async function countSegmentMembers(storeId, segmentRules) {
    const stats = await buildCustomerStats(storeId);
    let n = 0;
    for (const row of stats.values()) {
        if (matchSegmentRules(row, segmentRules)) n++;
    }
    return n;
}

async function listSegmentMembers(storeId, segmentRules, limit = 500) {
    const stats = await buildCustomerStats(storeId);
    const out = [];
    for (const row of stats.values()) {
        if (matchSegmentRules(row, segmentRules)) {
            out.push(row);
            if (out.length >= limit) break;
        }
    }
    return out;
}

module.exports = {
    buildCustomerStats,
    matchSegmentRules,
    countSegmentMembers,
    listSegmentMembers,
};
