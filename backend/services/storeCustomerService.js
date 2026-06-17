const StoreCustomer = require("../models/StoreCustomer");
const StoreOrder = require("../models/StoreOrder");

function normalizeAddress(addr) {
    if (!addr) return null;
    return {
        title: String(addr.title || "").trim(),
        firstName: String(addr.firstName || "").trim(),
        lastName: String(addr.lastName || "").trim(),
        identityNumber: String(addr.identityNumber || "").trim(),
        line1: String(addr.line1 || addr.line || "").trim(),
        line2: String(addr.line2 || "").trim(),
        zip: String(addr.zip || "").trim(),
        country: String(addr.country || "Türkiye").trim(),
        city: String(addr.city || "").trim(),
        district: String(addr.district || "").trim(),
        phone: String(addr.phone || "").trim(),
        phoneCountryCode: String(addr.phoneCountryCode || "+90").trim(),
        isDefault: !!addr.isDefault,
        invoiceType: addr.invoiceType === "corporate" ? "corporate" : "individual",
        companyName: String(addr.companyName || "").trim(),
        taxOffice: String(addr.taxOffice || "").trim(),
        taxNumber: String(addr.taxNumber || "").trim(),
    };
}

function normalizePayload(body) {
    return {
        firstName: String(body.firstName || "").trim(),
        lastName: String(body.lastName || "").trim(),
        email: String(body.email || "").trim().toLowerCase(),
        phone: String(body.phone || "").trim(),
        phoneCountryCode: String(body.phoneCountryCode || "+90").trim(),
        preferredLanguage: String(body.preferredLanguage || "tr").trim(),
        marketingEmailConsent: !!body.marketingEmailConsent,
        groups: Array.isArray(body.groups) ? body.groups.map((g) => String(g).trim()).filter(Boolean) : [],
        tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        addresses: Array.isArray(body.addresses)
            ? body.addresses.map(normalizeAddress).filter((a) => a && a.line1)
            : [],
        notes: String(body.notes || "").trim(),
        customFields: Array.isArray(body.customFields) ? body.customFields : [],
        hasAccount: !!body.hasAccount,
        registrationMethod: String(body.registrationMethod || "manual").trim(),
    };
}

async function enrichWithOrderStats(storeId, customers) {
    if (!customers.length) return customers;
    const emails = customers.map((c) => c.email).filter(Boolean);
    if (!emails.length) {
        return customers.map((c) => ({
            ...c,
            orderCount: 0,
            totalSpent: 0,
        }));
    }
    const orders = await StoreOrder.find({
        storeId,
        isDraft: { $ne: true },
        "customer.email": { $in: emails },
    }).lean();
    const byEmail = new Map();
    for (const o of orders) {
        const em = (o.customer?.email || "").toLowerCase();
        if (!em) continue;
        if (!byEmail.has(em)) byEmail.set(em, { count: 0, total: 0 });
        const row = byEmail.get(em);
        row.count += 1;
        row.total += Number(o.total) || 0;
    }
    return customers.map((c) => {
        const stats = c.email ? byEmail.get(c.email.toLowerCase()) : null;
        return {
            ...c,
            orderCount: stats?.count || 0,
            totalSpent: stats?.total || 0,
        };
    });
}

function applyFilters(rows, { q, marketingConsent, hasAccount, group, tag } = {}) {
    let out = rows;
    if (marketingConsent === "yes") out = out.filter((c) => c.marketingEmailConsent);
    if (marketingConsent === "no") out = out.filter((c) => !c.marketingEmailConsent);
    if (hasAccount === "yes") out = out.filter((c) => c.hasAccount);
    if (hasAccount === "no") out = out.filter((c) => !c.hasAccount);
    if (group) {
        const g = String(group).trim().toLowerCase();
        out = out.filter((c) => (c.groups || []).some((x) => x.toLowerCase().includes(g)));
    }
    if (tag) {
        const t = String(tag).trim().toLowerCase();
        out = out.filter((c) => (c.tags || []).some((x) => x.toLowerCase().includes(t)));
    }
    if (q) {
        const needle = String(q).trim().toLowerCase();
        out = out.filter((c) => {
            const name = `${c.firstName} ${c.lastName}`.toLowerCase();
            if (name.includes(needle)) return true;
            if (c.email?.includes(needle)) return true;
            if (c.phone?.includes(needle)) return true;
            return false;
        });
    }
    return out;
}

async function listCustomers(storeId, filters = {}) {
    const rows = await StoreCustomer.find({ storeId }).sort({ createdAt: -1 }).limit(500).lean();
    const withStats = await enrichWithOrderStats(storeId, rows);
    return applyFilters(withStats, filters);
}

async function getCustomer(storeId, id) {
    const doc = await StoreCustomer.findOne({ _id: id, storeId }).lean();
    if (!doc) return null;
    const [enriched] = await enrichWithOrderStats(storeId, [doc]);
    const orders = doc.email
        ? await StoreOrder.find({
              storeId,
              isDraft: { $ne: true },
              "customer.email": doc.email,
          })
              .sort({ createdAt: -1 })
              .limit(50)
              .lean()
        : [];
    return { customer: enriched, orders };
}

async function createCustomer(storeId, userId, body, actorName) {
    const data = normalizePayload(body);
    if (!data.firstName || !data.lastName) return { error: "Ad ve soyad gerekli" };
    if (!data.email) return { error: "E-posta gerekli" };
    if (data.addresses.length) {
        const hasDefault = data.addresses.some((a) => a.isDefault);
        if (!hasDefault) data.addresses[0].isDefault = true;
    }
    const doc = await StoreCustomer.create({
        storeId,
        userId,
        ...data,
        timeline: [
            {
                type: "created",
                actor: actorName || "Personel",
                message: "Müşteri oluşturuldu",
                createdAt: new Date(),
            },
            ...(data.marketingEmailConsent
                ? [
                      {
                          type: "marketing",
                          actor: "Sistem",
                          message: "Müşteri pazarlama e-posta ayarı: kabul edildi",
                          createdAt: new Date(),
                      },
                  ]
                : []),
        ],
    });

    setImmediate(() => {
        require("./marketing/marketingAutomationService")
            .runAutomationForEvent(storeId, "customer_registered", {
                customerEmail: doc.email,
                customerPhone: doc.phone,
                customerName: [doc.firstName, doc.lastName].filter(Boolean).join(" "),
            })
            .catch(() => {});
    });

    return { customer: doc.toObject() };
}

async function updateCustomer(storeId, id, body, actorName) {
    const doc = await StoreCustomer.findOne({ _id: id, storeId });
    if (!doc) return { error: "Müşteri bulunamadı" };
    const data = normalizePayload({ ...doc.toObject(), ...body });
    if (!data.firstName || !data.lastName) return { error: "Ad ve soyad gerekli" };
    if (!data.email) return { error: "E-posta gerekli" };
    const wasMarketing = doc.marketingEmailConsent;
    Object.assign(doc, data);
    if (body.comment?.trim()) {
        doc.timeline = doc.timeline || [];
        doc.timeline.push({
            type: "comment",
            actor: actorName || "Personel",
            message: body.comment.trim(),
            createdAt: new Date(),
        });
    }
    if (!wasMarketing && data.marketingEmailConsent) {
        doc.timeline.push({
            type: "marketing",
            actor: "Sistem",
            message: "Müşteri pazarlama e-posta ayarı: kabul edildi",
            createdAt: new Date(),
        });
    }
    await doc.save();
    const plain = doc.toObject();
    const [enriched] = await enrichWithOrderStats(storeId, [plain]);
    return { customer: enriched };
}

async function deleteCustomer(storeId, id) {
    const doc = await StoreCustomer.findOneAndDelete({ _id: id, storeId });
    if (!doc) return { error: "Müşteri bulunamadı" };
    return { ok: true };
}

module.exports = {
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
};
