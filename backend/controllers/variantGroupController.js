/**
 * Varyant grubu API — ProductMapping üyeleri + Trendyol productMainId hedefi
 */
const mongoose = require("mongoose");
const VariantGroup = require("../models/VariantGroup");
const ProductMapping = require("../models/ProductMapping");
const logger = require("../config/logger");

const MAX_MEMBERS = 80;

const toObjectId = (id) => {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
};

const validateMemberIds = async (userId, ids) => {
    const oids = [];
    for (const id of ids) {
        const o = toObjectId(id);
        if (!o) return { ok: false, error: "Geçersiz ürün kimliği" };
        oids.push(o);
    }
    const unique = [...new Map(oids.map(o => [String(o), o])).values()];
    const found = await ProductMapping.find({ _id: { $in: unique }, userId }).select("_id variantGroupId").lean();
    if (found.length !== unique.length) {
        return { ok: false, error: "Bazı ürünler bulunamadı veya size ait değil" };
    }
    return { ok: true, oids: unique, found };
};

exports.listVariantGroups = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const groups = await VariantGroup.find({ userId }).sort({ updatedAt: -1 }).lean();
        return res.json({ success: true, groups });
    } catch (e) {
        logger.error("[VariantGroup] list:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};

exports.getVariantGroup = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const gid = toObjectId(req.params.groupId);
        if (!gid) return res.status(400).json({ success: false, error: "Geçersiz grup" });

        const group = await VariantGroup.findOne({ _id: gid, userId }).lean();
        if (!group) return res.status(404).json({ success: false, error: "Grup bulunamadı" });

        const members = await ProductMapping.find({ _id: { $in: group.memberIds || [] }, userId })
            .select("masterProduct.name masterProduct.sku masterProduct.barcode masterProduct.attributes stockTracking.totalStock marketplaceMappings.marketplaceName")
            .lean();

        return res.json({ success: true, group, members });
    } catch (e) {
        logger.error("[VariantGroup] get:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};

exports.createVariantGroup = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const { name, notes = "", trendyolProductMainId = "", memberIds = [], dimensionHint } = req.body;
        const trimmedName = String(name || "").trim();
        if (trimmedName.length < 2) {
            return res.status(400).json({ success: false, error: "Grup adı en az 2 karakter olmalı" });
        }

        let oids = [];
        if (memberIds.length > 0) {
            if (memberIds.length > MAX_MEMBERS) {
                return res.status(400).json({ success: false, error: `En fazla ${MAX_MEMBERS} ürün eklenebilir` });
            }
            const v = await validateMemberIds(userId, memberIds);
            if (!v.ok) return res.status(400).json({ success: false, error: v.error });
            const conflict = v.found.find(m => m.variantGroupId != null);
            if (conflict) {
                return res.status(400).json({
                    success: false,
                    error: "Bazı ürünler zaten bir varyant grubunda. Önce eski gruptan çıkarın.",
                    conflictId: conflict._id
                });
            }
            oids = v.oids;
        }

        const group = await VariantGroup.create({
            userId,
            name: trimmedName,
            notes: String(notes).slice(0, 2000),
            trendyolProductMainId: String(trendyolProductMainId || "").trim().slice(0, 120),
            memberIds: oids,
            dimensionHint: dimensionHint ? {
                colorLabel: String(dimensionHint.colorLabel || "Renk").slice(0, 40),
                sizeLabel: String(dimensionHint.sizeLabel || "Beden").slice(0, 40)
            } : undefined
        });

        if (oids.length > 0) {
            await ProductMapping.updateMany(
                { _id: { $in: oids }, userId },
                { $set: { variantGroupId: group._id } }
            );
        }

        return res.status(201).json({ success: true, group: group.toObject() });
    } catch (e) {
        logger.error("[VariantGroup] create:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};

exports.updateVariantGroup = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const gid = toObjectId(req.params.groupId);
        if (!gid) return res.status(400).json({ success: false, error: "Geçersiz grup" });

        const group = await VariantGroup.findOne({ _id: gid, userId });
        if (!group) return res.status(404).json({ success: false, error: "Grup bulunamadı" });

        const { name, notes, trendyolProductMainId, dimensionHint } = req.body;
        if (name !== undefined) {
            const t = String(name).trim();
            if (t.length < 2) return res.status(400).json({ success: false, error: "Grup adı en az 2 karakter" });
            group.name = t;
        }
        if (notes !== undefined) group.notes = String(notes).slice(0, 2000);
        if (trendyolProductMainId !== undefined) {
            group.trendyolProductMainId = String(trendyolProductMainId).trim().slice(0, 120);
        }
        if (dimensionHint && typeof dimensionHint === "object") {
            group.dimensionHint = {
                colorLabel: String(dimensionHint.colorLabel ?? group.dimensionHint?.colorLabel ?? "Renk").slice(0, 40),
                sizeLabel: String(dimensionHint.sizeLabel ?? group.dimensionHint?.sizeLabel ?? "Beden").slice(0, 40)
            };
        }
        await group.save();
        return res.json({ success: true, group: group.toObject() });
    } catch (e) {
        logger.error("[VariantGroup] update:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};

exports.addVariantGroupMembers = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const gid = toObjectId(req.params.groupId);
        if (!gid) return res.status(400).json({ success: false, error: "Geçersiz grup" });

        const { memberIds = [] } = req.body;
        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ success: false, error: "memberIds gerekli" });
        }

        const group = await VariantGroup.findOne({ _id: gid, userId });
        if (!group) return res.status(404).json({ success: false, error: "Grup bulunamadı" });

        const v = await validateMemberIds(userId, memberIds);
        if (!v.ok) return res.status(400).json({ success: false, error: v.error });

        const existing = new Set((group.memberIds || []).map(id => String(id)));
        const toAdd = v.oids.filter(id => !existing.has(String(id)));
        if (group.memberIds.length + toAdd.length > MAX_MEMBERS) {
            return res.status(400).json({ success: false, error: `Grupta en fazla ${MAX_MEMBERS} ürün olabilir` });
        }

        const conflict = toAdd.map(id => v.found.find(m => String(m._id) === String(id)))
            .find(m => m && m.variantGroupId != null && String(m.variantGroupId) !== String(group._id));
        if (conflict) {
            return res.status(400).json({
                success: false,
                error: "Eklenmek istenen ürünlerden biri başka grupta",
                conflictId: conflict._id
            });
        }

        group.memberIds.push(...toAdd);
        await group.save();

        await ProductMapping.updateMany(
            { _id: { $in: toAdd }, userId },
            { $set: { variantGroupId: group._id } }
        );

        return res.json({ success: true, added: toAdd.length, group: group.toObject() });
    } catch (e) {
        logger.error("[VariantGroup] add members:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};

exports.removeVariantGroupMembers = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const gid = toObjectId(req.params.groupId);
        if (!gid) return res.status(400).json({ success: false, error: "Geçersiz grup" });

        const { memberIds = [] } = req.body;
        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ success: false, error: "memberIds gerekli" });
        }

        const group = await VariantGroup.findOne({ _id: gid, userId });
        if (!group) return res.status(404).json({ success: false, error: "Grup bulunamadı" });

        const removeOids = [...new Set(memberIds.map(toObjectId).filter(Boolean))];
        if (removeOids.length === 0) {
            return res.status(400).json({ success: false, error: "Geçerli ürün kimliği yok" });
        }
        const removeSet = new Set(removeOids.map(String));
        const before = (group.memberIds || []).length;
        group.memberIds = (group.memberIds || []).filter(id => !removeSet.has(String(id)));
        await group.save();

        const removedCount = before - group.memberIds.length;
        await ProductMapping.updateMany(
            { _id: { $in: removeOids }, userId, variantGroupId: gid },
            { $set: { variantGroupId: null } }
        );

        return res.json({ success: true, removed: removedCount, group: group.toObject() });
    } catch (e) {
        logger.error("[VariantGroup] remove members:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};

exports.deleteVariantGroup = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ success: false, error: "Yetkilendirme hatası" });

        const gid = toObjectId(req.params.groupId);
        if (!gid) return res.status(400).json({ success: false, error: "Geçersiz grup" });

        const group = await VariantGroup.findOne({ _id: gid, userId });
        if (!group) return res.status(404).json({ success: false, error: "Grup bulunamadı" });

        await ProductMapping.updateMany(
            { userId, variantGroupId: gid },
            { $set: { variantGroupId: null } }
        );
        await VariantGroup.deleteOne({ _id: gid, userId });

        return res.json({ success: true, message: "Grup silindi" });
    } catch (e) {
        logger.error("[VariantGroup] delete:", e.message);
        return res.status(500).json({ success: false, error: e.message });
    }
};
