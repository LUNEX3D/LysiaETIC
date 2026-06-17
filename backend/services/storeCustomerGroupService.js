const StoreCustomerGroup = require("../models/StoreCustomerGroup");
const StoreCustomer = require("../models/StoreCustomer");

const GROUP_NAME_MAX = 100;

function normalizeName(name) {
    return String(name || "").trim().slice(0, GROUP_NAME_MAX);
}

async function countMembers(storeId, groupName) {
    return StoreCustomer.countDocuments({
        storeId,
        groups: groupName,
    });
}

async function listGroups(storeId) {
    const groups = await StoreCustomerGroup.find({ storeId }).sort({ createdAt: -1 }).lean();
    const withCounts = await Promise.all(
        groups.map(async (g) => ({
            ...g,
            memberCount: await countMembers(storeId, g.name),
        }))
    );
    return withCounts;
}

async function getGroup(storeId, id) {
    const group = await StoreCustomerGroup.findOne({ _id: id, storeId }).lean();
    if (!group) return null;
    const members = await StoreCustomer.find({ storeId, groups: group.name })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    const memberCount = await countMembers(storeId, group.name);
    return { group: { ...group, memberCount }, members };
}

async function createGroup(storeId, userId, body) {
    const name = normalizeName(body.name);
    if (!name) return { error: "Müşteri grubu adı gerekli" };
    try {
        const doc = await StoreCustomerGroup.create({
            storeId,
            userId,
            name,
            type: body.type === "dynamic" ? "dynamic" : "static",
        });
        return { group: doc.toObject() };
    } catch (e) {
        if (e.code === 11000) return { error: "Bu isimde bir müşteri grubu zaten var" };
        throw e;
    }
}

async function updateGroup(storeId, id, body) {
    const doc = await StoreCustomerGroup.findOne({ _id: id, storeId });
    if (!doc) return { error: "Müşteri grubu bulunamadı" };
    const prevName = doc.name;
    const name = body.name !== undefined ? normalizeName(body.name) : doc.name;
    if (!name) return { error: "Müşteri grubu adı gerekli" };
    if (name !== prevName) {
        const customers = await StoreCustomer.find({ storeId, groups: prevName }).lean();
        for (const c of customers) {
            const groups = (c.groups || []).map((g) => (g === prevName ? name : g));
            await StoreCustomer.updateOne({ _id: c._id }, { $set: { groups } });
        }
        doc.name = name;
    }
    if (body.type === "dynamic" || body.type === "static") {
        doc.type = body.type;
    }
    try {
        await doc.save();
    } catch (e) {
        if (e.code === 11000) return { error: "Bu isimde bir müşteri grubu zaten var" };
        throw e;
    }
    const memberCount = await countMembers(storeId, doc.name);
    return { group: { ...doc.toObject(), memberCount } };
}

async function deleteGroup(storeId, id) {
    const doc = await StoreCustomerGroup.findOne({ _id: id, storeId });
    if (!doc) return { error: "Müşteri grubu bulunamadı" };
    const name = doc.name;
    const customers = await StoreCustomer.find({ storeId, groups: name }).lean();
    for (const c of customers) {
        const groups = (c.groups || []).filter((g) => g !== name);
        await StoreCustomer.updateOne({ _id: c._id }, { $set: { groups } });
    }
    await doc.deleteOne();
    return { ok: true };
}

module.exports = {
    listGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    GROUP_NAME_MAX,
};
