const path = require("path");
const fs = require("fs");
const Store = require("../models/Store");
const StoreSellerVerification = require("../models/StoreSellerVerification");

const BUSINESS_LABELS = {
    none: "Şirketim Yok",
    sole: "Şahıs Şirketim Var",
    corporate: "Kurumsal Şirketim Var",
};

function requiredDocKeys(businessType) {
    if (businessType === "sole" || businessType === "corporate") {
        return ["idFront", "idBack", "taxPlate", "residence"];
    }
    return ["idFront", "idBack", "residence"];
}

function validateStepFn(verification, step) {
    const v = verification;
    if (step === 1) {
        if (!v.businessType) return "İşletme türü seçin";
        return null;
    }
    if (step === 2) {
        const g = v.general || {};
        if (!g.firstName?.trim()) return "Ad gerekli";
        if (!g.lastName?.trim()) return "Soyad gerekli";
        if (!/^\d{11}$/.test(String(g.identityNumber || "").replace(/\D/g, ""))) return "Geçerli TC kimlik no girin";
        if (!g.birthDate) return "Doğum tarihi gerekli";
        if (!g.address?.trim()) return "Adres gerekli";
        if (!g.postalCode?.trim()) return "Posta kodu gerekli";
        if (!g.city) return "Şehir seçin";
        if (!g.district) return "İlçe seçin";
        return null;
    }
    if (step === 3) {
        const keys = requiredDocKeys(v.businessType);
        for (const key of keys) {
            if (!v.documents?.[key]?.url) {
                const names = {
                    idFront: "Kimlik ön yüz",
                    idBack: "Kimlik arka yüz",
                    residence: "İkametgah",
                    taxPlate: "Vergi levhası",
                };
                return `${names[key] || key} yükleyin`;
            }
        }
        if (v.documents?.hasTaxExemption && !v.documents?.taxExemption?.url) {
            return "Vergi muafiyet belgesi yükleyin veya seçeneği kapatın";
        }
        return null;
    }
    if (step === 4) {
        const iban = String(v.iban?.iban || "").replace(/\s/g, "").toUpperCase();
        if (!/^TR\d{24}$/.test(iban)) return "Geçerli TR IBAN girin (26 karakter)";
        if (!v.iban?.holderName?.trim()) return "IBAN sahibi adı gerekli";
        return null;
    }
    return null;
}

async function getOrCreate(userId) {
    const store = await Store.findOne({ userId }).lean();
    if (!store) return { error: "Mağaza bulunamadı", code: 404 };

    let verification = await StoreSellerVerification.findOne({ storeId: store._id });
    if (!verification) {
        verification = await StoreSellerVerification.create({
            storeId: store._id,
            userId,
            currentStep: 1,
        });
    } else if (verification.businessType == null) {
        verification.businessType = undefined;
        await verification.save().catch(() => {});
    }
    return { store, verification };
}

async function getVerification(userId) {
    const out = await getOrCreate(userId);
    if (out.error) return out;
    return {
        store: out.store,
        verification: formatVerification(out.verification),
        businessTypeLabels: BUSINESS_LABELS,
    };
}

function formatVerification(doc) {
    const v = doc.toObject ? doc.toObject() : doc;
    return {
        ...v,
        businessTypeLabel: BUSINESS_LABELS[v.businessType] || null,
        requiredDocuments: requiredDocKeys(v.businessType),
    };
}

async function saveVerification(userId, payload) {
    const out = await getOrCreate(userId);
    if (out.error) return out;

    const { verification } = out;
    const { businessType, currentStep, general, documents, iban, submit, validateStep } = payload || {};

    if (["none", "sole", "corporate"].includes(businessType)) {
        verification.businessType = businessType;
    }
    if (currentStep !== undefined) verification.currentStep = Math.min(5, Math.max(1, Number(currentStep) || 1));
    if (general) {
        verification.general = { ...(verification.general?.toObject?.() || verification.general || {}), ...general };
        verification.markModified("general");
    }
    if (documents) {
        verification.documents = {
            ...(verification.documents?.toObject?.() || verification.documents || {}),
            ...documents,
        };
        verification.markModified("documents");
    }
    if (iban) {
        verification.iban = { ...(verification.iban?.toObject?.() || verification.iban || {}), ...iban };
        verification.markModified("iban");
    }

    if (validateStep) {
        const err = validateStepFn(verification, Number(validateStep));
        if (err) return { error: err, code: 400 };
    }

    if (submit) {
        for (let s = 1; s <= 4; s++) {
            const err = validateStepFn(verification, s);
            if (err) return { error: err, code: 400 };
        }
        verification.status = "pending_review";
        verification.submittedAt = new Date();
        verification.currentStep = 5;
    }

    await verification.save();
    return { verification: formatVerification(verification) };
}

async function attachDocument(userId, docType, file) {
    const allowed = ["idFront", "idBack", "residence", "taxPlate", "taxExemption"];
    if (!allowed.includes(docType)) return { error: "Geçersiz belge türü", code: 400 };

    const out = await getOrCreate(userId);
    if (out.error) return out;

    const baseDir = path.join(__dirname, "..", "uploads", "seller-verification", String(out.store._id));
    fs.mkdirSync(baseDir, { recursive: true });

    const safeName = `${docType}-${Date.now()}${path.extname(file.originalname) || ".bin"}`;
    const dest = path.join(baseDir, safeName);
    fs.writeFileSync(dest, file.buffer);

    const url = `/uploads/seller-verification/${out.store._id}/${safeName}`;
    if (!out.verification.documents) out.verification.documents = {};
    out.verification.documents[docType] = {
        fileName: file.originalname,
        url,
        uploadedAt: new Date(),
    };
    out.verification.markModified("documents");
    await out.verification.save();

    return {
        verification: formatVerification(out.verification),
        document: { docType, fileName: file.originalname, url },
    };
}

async function removeDocument(userId, docType) {
    const out = await getOrCreate(userId);
    if (out.error) return out;
    if (!out.verification.documents) out.verification.documents = {};
    out.verification.documents[docType] = { fileName: "", url: "", uploadedAt: null };
    out.verification.markModified("documents");
    await out.verification.save();
    return { verification: formatVerification(out.verification) };
}

module.exports = {
    getVerification,
    saveVerification,
    attachDocument,
    removeDocument,
    validateStep: validateStepFn,
    BUSINESS_LABELS,
    requiredDocKeys,
};
