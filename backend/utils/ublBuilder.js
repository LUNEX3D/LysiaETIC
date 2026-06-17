/**
 * UBL-TR 2.1 XML Builder — LysiaETIC
 *
 * Türkiye e-Fatura / e-Arşiv / e-İrsaliye için UBL-TR 2.1 formatında XML oluşturur.
 * QNB eSolutions SOAP API ile uyumlu.
 *
 * Desteklenen profiller:
 *   - EARSIVFATURA       (e-Arşiv)
 *   - TICARIFATURA       (e-Fatura — Ticari)
 *   - IHRACAT            (İhracat Fatura)
 *   - YOLCUBERABERFATURA (Yolcu Beraber Fatura)
 *   - TEMELFATURA   (e-Fatura — Temel)
 *   - IRSALIYE      (e-İrsaliye)
 *
 * ⚠️ ÖNEMLİ: QNB API'ye RAW XML gönderilir (base64 DEĞİL!)
 *   - e-Arşiv: faturaOlustur → fatura.belgeIcerigi = raw XML
 *   - e-Fatura: belgeGonder → veri = raw XML
 *   - base64 sadece geriye uyumluluk için döndürülür
 */

const crypto = require("crypto");

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────

/** Tutarı 2 ondalık basamağa formatla */
const fmt = (v) => Number(v || 0).toFixed(2);

/** Bugünün tarihini YYYY-MM-DD formatında döndür */
const todayDate = () => new Date().toISOString().split("T")[0];

/** Şu anki saati HH:MM:SS formatında döndür */
const nowTime = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, "0")).join(":");
};

/** XML özel karakterlerini escape et */
const esc = (s) => String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// ─── Birim Kodları (UN/ECE Rec 20) ──────────────────────────────────────────
const UNIT_CODES = {
    "adet": "C62",
    "kg": "KGM",
    "lt": "LTR",
    "m": "MTR",
    "m2": "MTK",
    "m3": "MTQ",
    "paket": "PA",
    "kutu": "BX",
    "ton": "TNE",
    "saat": "HUR",
    "gun": "DAY",
    "ay": "MON",
    "yil": "ANN",
    "set": "SET",
    "duzine": "DZN",
};

const appendKdvTaxScheme = (parts) => {
    parts.push("<cac:TaxScheme>");
    parts.push("<cbc:Name>KDV</cbc:Name>");
    parts.push("<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>");
    parts.push("</cac:TaxScheme>");
};

/** UBL-TR AddressType — Sovos şeması sıra zorunlu: StreetName → BuildingNumber → CitySubdivisionName → CityName */
const appendPostalAddress = (parts, addr = {}) => {
    parts.push("<cac:PostalAddress>");
    if (addr.id) parts.push("<cbc:ID>" + esc(addr.id) + "</cbc:ID>");
    if (addr.room) parts.push("<cbc:Room>" + esc(addr.room) + "</cbc:Room>");
    parts.push("<cbc:StreetName>" + esc(addr.street || "Merkez") + "</cbc:StreetName>");
    parts.push("<cbc:BuildingNumber>" + esc(addr.buildingNumber || "1") + "</cbc:BuildingNumber>");
    parts.push("<cbc:CitySubdivisionName>" + esc(addr.district || "Merkez") + "</cbc:CitySubdivisionName>");
    parts.push("<cbc:CityName>" + esc(addr.city || "Istanbul") + "</cbc:CityName>");
    if (addr.postalZone) parts.push("<cbc:PostalZone>" + esc(addr.postalZone) + "</cbc:PostalZone>");
    parts.push("<cac:Country><cbc:Name>" + esc(addr.country || "Turkiye") + "</cbc:Name></cac:Country>");
    parts.push("</cac:PostalAddress>");
};

const getUnitCode = (unit) => {
    if (!unit) return "C62";
    const u = unit.toLowerCase().trim();
    return UNIT_CODES[u] || unit.toUpperCase();
};

/** GİB/Sovos: ABC2009123456789 — 3 harf + 4 yıl + 9 sıra */
const formatGibInvoiceId = (seriesCode, seq, year) => {
    const y = Number(year) || new Date().getFullYear();
    let prefix = String(seriesCode || "FAA").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (prefix.length < 3) prefix = prefix.padEnd(3, "A");
    prefix = prefix.slice(0, 3);
    const tail = String(Math.abs(Number(seq) || 0) % 1000000000).padStart(9, "0");
    return `${prefix}${y}${tail}`;
};

const isValidGibInvoiceId = (value) => /^[A-Z0-9]{3}\d{13}$/.test(String(value || "").trim());

// ─── Vergi Kodları ──────────────────────────────────────────────────────────
const TAX_CODES = {
    "KDV": "0015",
    "OTV": "0071",
    "STOPAJ": "0003",
};

// ═══════════════════════════════════════════════════════════════════════════
//  ANA BUILDER FONKSİYONU
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UBL-TR 2.1 Invoice XML oluştur
 *
 * @param {Object} data - Fatura verileri
 * @param {string} data.profileId - EARSIVFATURA | TICARIFATURA | TEMELFATURA
 * @param {string} data.invoiceTypeCode - SATIS | IADE | TEVKIFAT | ISTISNA | OZELMATRAH | IHRACKAYITLI
 * @param {string} [data.invoiceNumber] - Fatura numarası (boş ise QNB üretir)
 * @param {string} [data.uuid] - UUID (boş ise otomatik üretilir)
 * @param {string} [data.issueDate] - Fatura tarihi (YYYY-MM-DD)
 * @param {string} [data.issueTime] - Fatura saati (HH:MM:SS)
 * @param {string} [data.currency] - Para birimi (TRY, USD, EUR)
 * @param {string} [data.note] - Fatura notu
 * @param {string} [data.sendingType] - Gönderim şekli: ELEKTRONIK | KAGIT (e-Arşiv için zorunlu)
 *
 * @param {Object} data.supplier - Satıcı bilgileri
 * @param {Object} data.customer - Alıcı bilgileri
 * @param {Array} data.lines - Fatura kalemleri
 *
 * @returns {Object} { xml: string, uuid: string, base64: string, totals: Object }
 */
const buildInvoiceXml = (data) => {
    const uuid = data.uuid || crypto.randomUUID();
    const issueDate = data.issueDate || todayDate();
    const issueTime = data.issueTime || nowTime();
    const currency = data.currency || "TRY";
    const profileId = data.profileId || "EARSIVFATURA";
    const isExportProfile = profileId === "IHRACAT" || profileId === "YOLCUBERABERFATURA";
    const invoiceTypeCode = data.invoiceTypeCode || (isExportProfile ? "ISTISNA" : "SATIS");
    const sendingType = data.sendingType || "ELEKTRONIK";
    const seriesCode = data.faturaKodu || data.invoiceSeriesCode || "FAA";
    const seqSeed = data.custInvId || data.orderNumber || Date.now();
    const issueYear = parseInt(String(issueDate).slice(0, 4), 10) || new Date().getFullYear();
    let invoiceNumber = String(data.invoiceNumber || "").trim();
    if (!isValidGibInvoiceId(invoiceNumber)) {
        const seq = typeof seqSeed === "string"
            ? Math.abs(seqSeed.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0))
            : Number(seqSeed) || Date.now();
        invoiceNumber = formatGibInvoiceId(seriesCode, seq, issueYear);
    }

    const supplier = data.supplier || {};
    let customer = { ...(data.customer || {}) };
    const lines = data.lines || [];
    const eArchiveVisuals = data.eArchiveVisuals || {};
    const logoUrl = String(eArchiveVisuals.logoUrl || "").trim();
    const signatureUrl = String(eArchiveVisuals.signatureUrl || "").trim();
    const signatureName = String(eArchiveVisuals.signatureName || "").trim();
    const invoiceDescription = String(eArchiveVisuals.invoiceDescription || "").trim();

    // e-Arşiv: Sovos/Foriba örneği nihai tüketici için receiverID=2222222222 (10 hane VKN)
    const EARSIV_PLACEHOLDER_VKNS = new Set(["11111111111", "22222222222", "12345678901"]);
    if (profileId === "EARSIVFATURA") {
        const cv = String(customer.vkn || "").replace(/\D/g, "");
        if (!cv || EARSIV_PLACEHOLDER_VKNS.has(cv)) {
            customer.vkn = "2222222222";
        }
    }
    if (profileId === "IHRACAT" || profileId === "YOLCUBERABERFATURA") {
        if (!customer.vkn) {
            customer.vkn = "1460415308";
            customer.name = customer.name || "Gumruk ve Ticaret Bakanligi Gumrukler Genel Mudurlugu";
            customer.taxOffice = customer.taxOffice || "Ulus";
            customer.city = customer.city || "Ankara";
            customer.country = customer.country || "Turkiye";
        }
    }

    // ── Satıcı VKN/TCKN tipi ──
    const supplierIdType = (supplier.vkn || "").length === 11 ? "TCKN" : "VKN";
    const customerIdType = (customer.vkn || "").length === 11 ? "TCKN" : "VKN";

    // ── Kalem hesaplamaları ──
    const calculatedLines = lines.map((line, idx) => {
        const qty = Number(line.quantity || 1);
        const price = Number(line.unitPrice || 0);
        const vatRate = Number(line.vatRate != null ? line.vatRate : 20);
        const discount = Number(line.discountAmount || 0);
        const lineTotal = (qty * price) - discount;
        const vatAmount = lineTotal * (vatRate / 100);

        return {
            ...line,
            id: idx + 1,
            quantity: qty,
            unitPrice: price,
            unitCode: getUnitCode(line.unit),
            vatRate,
            discount,
            lineTotal,
            vatAmount,
        };
    });

    // ── Toplam hesaplamaları ──
    const lineExtensionAmount = calculatedLines.reduce((s, l) => s + l.lineTotal, 0);
    const totalDiscount = calculatedLines.reduce((s, l) => s + l.discount, 0);

    // KDV oranlarına göre grupla
    const vatGroups = {};
    calculatedLines.forEach(l => {
        const key = l.vatRate;
        if (!vatGroups[key]) vatGroups[key] = { rate: l.vatRate, taxable: 0, tax: 0 };
        vatGroups[key].taxable += l.lineTotal;
        vatGroups[key].tax += l.vatAmount;
    });

    const totalTax = Object.values(vatGroups).reduce((s, g) => s + g.tax, 0);
    const taxInclusiveAmount = lineExtensionAmount + totalTax;
    const payableAmount = taxInclusiveAmount;

    // ═══ XML OLUŞTUR ═══
    const parts = [];

    // ── XML Declaration & Root Element ──
    // QNB eSolutions UBL-TR 2.1 uyumlu namespace'ler
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<Invoice');
    parts.push(' xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 ../xsdrt/maindoc/UBL-Invoice-2.1.xsd"');
    parts.push(' xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    parts.push(' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    parts.push(' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"');
    parts.push(' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"');
    parts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');

    // ── UBL Extensions (QNB imza için kullanır) ──
    parts.push('<ext:UBLExtensions>');
    parts.push('<ext:UBLExtension>');
    parts.push('<ext:ExtensionContent/>');
    parts.push('</ext:UBLExtension>');
    parts.push('</ext:UBLExtensions>');

    // ── Header ──
    parts.push('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    parts.push('<cbc:CustomizationID>TR1.2</cbc:CustomizationID>');
    parts.push('<cbc:ProfileID>' + esc(profileId) + '</cbc:ProfileID>');
    parts.push('<cbc:ID>' + esc(invoiceNumber) + '</cbc:ID>');
    parts.push('<cbc:CopyIndicator>false</cbc:CopyIndicator>');
    parts.push('<cbc:UUID>' + uuid + '</cbc:UUID>');
    parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
    parts.push('<cbc:IssueTime>' + issueTime + '</cbc:IssueTime>');
    parts.push('<cbc:InvoiceTypeCode>' + esc(invoiceTypeCode) + '</cbc:InvoiceTypeCode>');

    // ── Notes ──
    // e-Arşiv için "Gönderim Şekli: ELEKTRONIK" notu ZORUNLU
    if (profileId === "EARSIVFATURA") {
        parts.push('<cbc:Note>Gonderim Sekli: ' + esc(sendingType) + '</cbc:Note>');
    }
    if (data.note) {
        parts.push('<cbc:Note>' + esc(data.note) + '</cbc:Note>');
    }
    if (invoiceDescription && invoiceDescription !== String(data.note || "").trim()) {
        parts.push('<cbc:Note>' + esc(invoiceDescription) + '</cbc:Note>');
    }
    if (signatureName) {
        parts.push('<cbc:Note>Imza Yetkilisi: ' + esc(signatureName) + '</cbc:Note>');
    }

    parts.push('<cbc:DocumentCurrencyCode>' + esc(currency) + '</cbc:DocumentCurrencyCode>');
    parts.push('<cbc:LineCountNumeric>' + calculatedLines.length + '</cbc:LineCountNumeric>');

    // e-Arşiv zorunlu AdditionalDocumentReference alanları (Foriba ArchiveUBL)
    if (profileId === "EARSIVFATURA") {
        const sendType = String(sendingType || "ELEKTRONIK").toUpperCase();
        const erepSendt = sendType === "KAGIT" ? "KAGIT" : "ELEKTRONIK";
        const custInvRef = String(data.custInvId || data.orderNumber || "").trim();

        if (custInvRef) {
            parts.push('<cac:AdditionalDocumentReference>');
            parts.push('<cbc:ID>' + esc(custInvRef) + '</cbc:ID>');
            parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
            parts.push('<cbc:DocumentTypeCode>CUST_INV_ID</cbc:DocumentTypeCode>');
            parts.push('</cac:AdditionalDocumentReference>');
        }

        parts.push('<cac:AdditionalDocumentReference>');
        parts.push('<cbc:ID>0100</cbc:ID>');
        parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
        parts.push('<cbc:DocumentTypeCode>OUTPUT_TYPE</cbc:DocumentTypeCode>');
        parts.push('</cac:AdditionalDocumentReference>');

        parts.push('<cac:AdditionalDocumentReference>');
        parts.push('<cbc:ID>' + erepSendt + '</cbc:ID>');
        parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
        parts.push('<cbc:DocumentTypeCode>EREPSENDT</cbc:DocumentTypeCode>');
        parts.push('</cac:AdditionalDocumentReference>');

        parts.push('<cac:AdditionalDocumentReference>');
        parts.push('<cbc:ID>99</cbc:ID>');
        parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
        parts.push('<cbc:DocumentTypeCode>TRANSPORT_TYPE</cbc:DocumentTypeCode>');
        parts.push('</cac:AdditionalDocumentReference>');

        // Opsiyonel görsel referansları (resmi örnekte zorunlu değil, şablon için eklenir)
        if (logoUrl) {
            parts.push('<cac:AdditionalDocumentReference>');
            parts.push('<cbc:ID>LOGO</cbc:ID>');
            parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
            parts.push('<cbc:DocumentTypeCode>LOGO</cbc:DocumentTypeCode>');
            parts.push('<cac:Attachment><cac:ExternalReference><cbc:URI>' + esc(logoUrl) + '</cbc:URI></cac:ExternalReference></cac:Attachment>');
            parts.push('</cac:AdditionalDocumentReference>');
        }
        if (signatureUrl) {
            parts.push('<cac:AdditionalDocumentReference>');
            parts.push('<cbc:ID>SIGNATURE</cbc:ID>');
            parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
            parts.push('<cbc:DocumentTypeCode>SIGNATURE</cbc:DocumentTypeCode>');
            parts.push('<cac:Attachment><cac:ExternalReference><cbc:URI>' + esc(signatureUrl) + '</cbc:URI></cac:ExternalReference></cac:Attachment>');
            parts.push('</cac:AdditionalDocumentReference>');
        }
    }

    // ── Signature (QNB zorunlu kılıyor) ──
    parts.push('<cac:Signature>');
    parts.push('<cbc:ID schemeID="VKN_TCKN">' + esc(supplier.vkn) + '</cbc:ID>');
    parts.push('<cac:SignatoryParty>');
    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + supplierIdType + '">' + esc(supplier.vkn) + '</cbc:ID></cac:PartyIdentification>');
    appendPostalAddress(parts, {
        street: supplier.street,
        buildingNumber: supplier.buildingNumber,
        district: supplier.district,
        city: supplier.city,
        postalZone: supplier.postalZone,
        country: supplier.country,
    });
    parts.push('</cac:SignatoryParty>');
    parts.push('<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#Signature</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>');
    parts.push('</cac:Signature>');

    // ── Satıcı (Supplier) ──
    parts.push('<cac:AccountingSupplierParty><cac:Party>');

    // WebsiteURI (opsiyonel)
    if (supplier.website) {
        parts.push('<cbc:WebsiteURI>' + esc(supplier.website) + '</cbc:WebsiteURI>');
    }

    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + supplierIdType + '">' + esc(supplier.vkn) + '</cbc:ID></cac:PartyIdentification>');

    // PartyName — firma adı
    if (supplierIdType === "VKN") {
        parts.push('<cac:PartyName><cbc:Name>' + esc(supplier.name) + '</cbc:Name></cac:PartyName>');
    }

    appendPostalAddress(parts, {
        street: supplier.street,
        buildingNumber: supplier.buildingNumber,
        district: supplier.district,
        city: supplier.city,
        postalZone: supplier.postalZone,
        country: supplier.country,
    });

    // PartyTaxScheme — Vergi Dairesi
    if (supplier.taxOffice) {
        parts.push('<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>' + esc(supplier.taxOffice) + '</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>');
    }

    // Contact
    if (supplier.phone || supplier.email || supplier.fax) {
        parts.push('<cac:Contact>');
        if (supplier.phone) parts.push('<cbc:Telephone>' + esc(supplier.phone) + '</cbc:Telephone>');
        if (supplier.fax) parts.push('<cbc:Telefax>' + esc(supplier.fax) + '</cbc:Telefax>');
        if (supplier.email) parts.push('<cbc:ElectronicMail>' + esc(supplier.email) + '</cbc:ElectronicMail>');
        parts.push('</cac:Contact>');
    }

    // Person — TCKN için zorunlu
    if (supplierIdType === "TCKN") {
        parts.push('<cac:Person>');
        parts.push('<cbc:FirstName>' + esc(supplier.firstName || supplier.name || "") + '</cbc:FirstName>');
        parts.push('<cbc:FamilyName>' + esc(supplier.lastName || "") + '</cbc:FamilyName>');
        parts.push('</cac:Person>');
    }

    parts.push('</cac:Party></cac:AccountingSupplierParty>');

    // ── Alıcı (Customer) ──
    parts.push('<cac:AccountingCustomerParty><cac:Party>');

    if (customer.website) {
        parts.push('<cbc:WebsiteURI>' + esc(customer.website) + '</cbc:WebsiteURI>');
    }

    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + customerIdType + '">' + esc(customer.vkn) + '</cbc:ID></cac:PartyIdentification>');

    // PartyName — VKN için zorunlu (Sovos şeması; nihai tüketici 2222222222 dahil)
    if (customerIdType === "VKN") {
        parts.push('<cac:PartyName><cbc:Name>' + esc(customer.name || "Nihai Tuketici") + '</cbc:Name></cac:PartyName>');
    }

    appendPostalAddress(parts, {
        street: customer.street,
        buildingNumber: customer.buildingNumber,
        district: customer.district,
        city: customer.city,
        postalZone: customer.postalZone,
        country: customer.country,
    });

    // PartyTaxScheme — Vergi Dairesi (VKN için)
    if (customer.taxOffice && customerIdType === "VKN") {
        parts.push('<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>' + esc(customer.taxOffice) + '</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>');
    }

    // Contact
    if (customer.phone || customer.email || customer.fax) {
        parts.push('<cac:Contact>');
        if (customer.phone) parts.push('<cbc:Telephone>' + esc(customer.phone) + '</cbc:Telephone>');
        if (customer.fax) parts.push('<cbc:Telefax>' + esc(customer.fax) + '</cbc:Telefax>');
        if (customer.email) parts.push('<cbc:ElectronicMail>' + esc(customer.email) + '</cbc:ElectronicMail>');
        parts.push('</cac:Contact>');
    }

    // Person — TCKN için ZORUNLU; e-Arşiv nihai tüketici (2222222222) için de ad/soyad
    if (customerIdType === "TCKN" || (profileId === "EARSIVFATURA" && customer.vkn === "2222222222")) {
        parts.push('<cac:Person>');
        parts.push('<cbc:FirstName>' + esc(customer.firstName || customer.name || "Nihai") + '</cbc:FirstName>');
        parts.push('<cbc:FamilyName>' + esc(customer.lastName || "Tuketici") + '</cbc:FamilyName>');
        parts.push('</cac:Person>');
    }

    parts.push('</cac:Party></cac:AccountingCustomerParty>');

    // ── İhracat / Yolcu Beraber özel alanları ──
    if (profileId === "IHRACAT") {
        const exportInfo = data.exportInfo || {};
        const buyer = exportInfo.buyer || {};
        parts.push('<cac:BuyerCustomerParty><cac:Party>');
        parts.push('<cac:PartyIdentification><cbc:ID schemeID="PARTYTYPE">' + esc(buyer.partyType || "EXPORT") + '</cbc:ID></cac:PartyIdentification>');
        if (buyer.name) parts.push('<cac:PartyName><cbc:Name>' + esc(buyer.name) + '</cbc:Name></cac:PartyName>');
        parts.push('</cac:Party></cac:BuyerCustomerParty>');
        if (exportInfo.deliveryTerms || exportInfo.incoterms) {
            parts.push('<cac:Delivery>');
            parts.push('<cac:DeliveryTerms>');
            parts.push('<cbc:ID schemeID="INCOTERMS">' + esc(exportInfo.incoterms || exportInfo.deliveryTerms) + '</cbc:ID>');
            if (exportInfo.deliveryLocation) {
                parts.push('<cbc:SpecialTerms>' + esc(exportInfo.deliveryLocation) + '</cbc:SpecialTerms>');
            }
            parts.push('</cac:DeliveryTerms>');
            parts.push('</cac:Delivery>');
        }
        if (exportInfo.gtbRefDate) {
            parts.push('<cac:AdditionalDocumentReference>');
            parts.push('<cbc:ID schemeID="GTB_REFNO">' + esc(exportInfo.gtbRefNo || "") + '</cbc:ID>');
            parts.push('<cbc:IssueDate>' + esc(exportInfo.gtbRefDate) + '</cbc:IssueDate>');
            parts.push('</cac:AdditionalDocumentReference>');
        }
    }

    if (profileId === "YOLCUBERABERFATURA") {
        const tourist = data.touristInfo || {};
        parts.push('<cac:BuyerCustomerParty><cac:Party>');
        parts.push('<cac:PartyIdentification><cbc:ID schemeID="PARTYTYPE">' + esc(tourist.partyType || "TAXFREE") + '</cbc:ID></cac:PartyIdentification>');
        parts.push('<cac:PostalAddress>');
        if (tourist.citySubdivision) parts.push('<cbc:CitySubdivisionName>' + esc(tourist.citySubdivision) + '</cbc:CitySubdivisionName>');
        if (tourist.city) parts.push('<cbc:CityName>' + esc(tourist.city) + '</cbc:CityName>');
        if (tourist.country) {
            parts.push('<cac:Country><cbc:Name>' + esc(tourist.country) + '</cbc:Name></cac:Country>');
        }
        parts.push('</cac:PostalAddress>');
        parts.push('<cac:Person>');
        parts.push('<cbc:FirstName>' + esc(tourist.firstName || "Turist") + '</cbc:FirstName>');
        parts.push('<cbc:FamilyName>' + esc(tourist.lastName || "Adi") + '</cbc:FamilyName>');
        if (tourist.nationalityId) parts.push('<cbc:NationalityID>' + esc(tourist.nationalityId) + '</cbc:NationalityID>');
        if (tourist.passportNo) {
            parts.push('<cac:IdentityDocumentReference>');
            parts.push('<cbc:ID>' + esc(tourist.passportNo) + '</cbc:ID>');
            if (tourist.passportIssueDate) parts.push('<cbc:IssueDate>' + esc(tourist.passportIssueDate) + '</cbc:IssueDate>');
            parts.push('</cac:IdentityDocumentReference>');
        }
        parts.push('</cac:Person>');
        parts.push('</cac:Party></cac:BuyerCustomerParty>');
        const taxRep = data.taxRepresentative || {};
        if (taxRep.vkn || taxRep.identifier) {
            parts.push('<cac:TaxRepresentativeParty><cac:Party>');
            if (taxRep.vkn) {
                parts.push('<cac:PartyIdentification><cbc:ID schemeID="ARACIKURUMVKN">' + esc(taxRep.vkn) + '</cbc:ID></cac:PartyIdentification>');
            }
            if (taxRep.identifier) {
                parts.push('<cac:PartyIdentification><cbc:ID schemeID="ARACIKURUMETIKET">' + esc(taxRep.identifier) + '</cbc:ID></cac:PartyIdentification>');
            }
            parts.push('<cac:PostalAddress>');
            if (taxRep.citySubdivision) parts.push('<cbc:CitySubdivisionName>' + esc(taxRep.citySubdivision) + '</cbc:CitySubdivisionName>');
            if (taxRep.city) parts.push('<cbc:CityName>' + esc(taxRep.city) + '</cbc:CityName>');
            if (taxRep.country) parts.push('<cac:Country><cbc:Name>' + esc(taxRep.country) + '</cbc:Name></cac:Country>');
            parts.push('</cac:PostalAddress>');
            parts.push('</cac:Party></cac:TaxRepresentativeParty>');
        }
    }

    // ── Ödeme Koşulları (opsiyonel) ──
    if (data.paymentNote || data.paymentDueDate) {
        parts.push('<cac:PaymentTerms>');
        if (data.paymentNote) parts.push('<cbc:Note>' + esc(data.paymentNote) + '</cbc:Note>');
        if (data.paymentDueDate) parts.push('<cbc:PaymentDueDate>' + esc(data.paymentDueDate) + '</cbc:PaymentDueDate>');
        parts.push('</cac:PaymentTerms>');
    }

    // ── Vergi Toplamları ──
    parts.push('<cac:TaxTotal>');
    parts.push('<cbc:TaxAmount currencyID="' + currency + '">' + fmt(totalTax) + '</cbc:TaxAmount>');
    Object.values(vatGroups).forEach(g => {
        parts.push('<cac:TaxSubtotal>');
        parts.push('<cbc:TaxableAmount currencyID="' + currency + '">' + fmt(g.taxable) + '</cbc:TaxableAmount>');
        parts.push('<cbc:TaxAmount currencyID="' + currency + '">' + fmt(g.tax) + '</cbc:TaxAmount>');
        parts.push('<cbc:Percent>' + g.rate + '</cbc:Percent>');
        parts.push('<cac:TaxCategory>');
        if (g.rate === 0) {
            if (profileId === "IHRACAT") {
                parts.push('<cbc:TaxExemptionReasonCode>301</cbc:TaxExemptionReasonCode>');
                parts.push('<cbc:TaxExemptionReason>11/1-a Mal ihracati</cbc:TaxExemptionReason>');
            } else if (profileId === "YOLCUBERABERFATURA") {
                parts.push('<cbc:TaxExemptionReasonCode>501</cbc:TaxExemptionReasonCode>');
                parts.push('<cbc:TaxExemptionReason>Turkiye\'de Ikamet Etmeyenlere KDV Hesaplanarak Yapilan Satislar(Yolcu Beraberi Esya)</cbc:TaxExemptionReason>');
            } else {
                parts.push('<cbc:TaxExemptionReasonCode>350</cbc:TaxExemptionReasonCode>');
                parts.push('<cbc:TaxExemptionReason>Digerlerinde yazili islemler (KDVK 17/4)</cbc:TaxExemptionReason>');
            }
        }
        appendKdvTaxScheme(parts);
        parts.push('</cac:TaxCategory>');
        parts.push('</cac:TaxSubtotal>');
    });
    parts.push('</cac:TaxTotal>');

    // ── Toplam Tutarlar ──
    parts.push('<cac:LegalMonetaryTotal>');
    parts.push('<cbc:LineExtensionAmount currencyID="' + currency + '">' + fmt(lineExtensionAmount) + '</cbc:LineExtensionAmount>');
    parts.push('<cbc:TaxExclusiveAmount currencyID="' + currency + '">' + fmt(lineExtensionAmount) + '</cbc:TaxExclusiveAmount>');
    parts.push('<cbc:TaxInclusiveAmount currencyID="' + currency + '">' + fmt(taxInclusiveAmount) + '</cbc:TaxInclusiveAmount>');
    if (totalDiscount > 0) {
        parts.push('<cbc:AllowanceTotalAmount currencyID="' + currency + '">' + fmt(totalDiscount) + '</cbc:AllowanceTotalAmount>');
    }
    parts.push('<cbc:PayableAmount currencyID="' + currency + '">' + fmt(payableAmount) + '</cbc:PayableAmount>');
    parts.push('</cac:LegalMonetaryTotal>');

    // ── Fatura Kalemleri ──
    calculatedLines.forEach(line => {
        parts.push('<cac:InvoiceLine>');
        parts.push('<cbc:ID>' + line.id + '</cbc:ID>');
        parts.push('<cbc:InvoicedQuantity unitCode="' + line.unitCode + '">' + line.quantity + '</cbc:InvoicedQuantity>');
        parts.push('<cbc:LineExtensionAmount currencyID="' + currency + '">' + fmt(line.lineTotal) + '</cbc:LineExtensionAmount>');

        if (profileId === "IHRACAT" && line.exportDelivery) {
            const ed = line.exportDelivery;
            parts.push('<cac:Delivery>');
            if (ed.deliveryAddress) {
                parts.push('<cac:DeliveryAddress>');
                if (ed.deliveryAddress.street) parts.push('<cbc:StreetName>' + esc(ed.deliveryAddress.street) + '</cbc:StreetName>');
                if (ed.deliveryAddress.city) parts.push('<cbc:CityName>' + esc(ed.deliveryAddress.city) + '</cbc:CityName>');
                if (ed.deliveryAddress.country) parts.push('<cac:Country><cbc:Name>' + esc(ed.deliveryAddress.country) + '</cbc:Name></cac:Country>');
                parts.push('</cac:DeliveryAddress>');
            }
            if (ed.incoterms) {
                parts.push('<cac:DeliveryTerms><cbc:ID schemeID="INCOTERMS">' + esc(ed.incoterms) + '</cbc:ID></cac:DeliveryTerms>');
            }
            if (ed.gtip || ed.transportMode || ed.packageId) {
                parts.push('<cac:Shipment>');
                if (ed.gtip) parts.push('<cac:GoodsItem><cbc:RequiredCustomsID>' + esc(ed.gtip) + '</cbc:RequiredCustomsID></cac:GoodsItem>');
                if (ed.transportMode) parts.push('<cac:ShipmentStage><cbc:TransportModeCode>' + esc(ed.transportMode) + '</cbc:TransportModeCode></cac:ShipmentStage>');
                if (ed.packageId) {
                    parts.push('<cac:TransportHandlingUnit><cac:ActualPackage>');
                    parts.push('<cbc:ID>' + esc(ed.packageId) + '</cbc:ID>');
                    if (ed.packageQty) parts.push('<cbc:Quantity>' + esc(ed.packageQty) + '</cbc:Quantity>');
                    if (ed.packageType) parts.push('<cbc:PackagingTypeCode>' + esc(ed.packageType) + '</cbc:PackagingTypeCode>');
                    parts.push('</cac:ActualPackage></cac:TransportHandlingUnit>');
                }
                parts.push('</cac:Shipment>');
            }
            parts.push('</cac:Delivery>');
        }

        // Kalem indirimi
        if (line.discount > 0) {
            parts.push('<cac:AllowanceCharge>');
            parts.push('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>');
            parts.push('<cbc:Amount currencyID="' + currency + '">' + fmt(line.discount) + '</cbc:Amount>');
            if (line.discountReason) parts.push('<cbc:AllowanceChargeReason>' + esc(line.discountReason) + '</cbc:AllowanceChargeReason>');
            parts.push('</cac:AllowanceCharge>');
        }

        // Kalem vergisi
        parts.push('<cac:TaxTotal>');
        parts.push('<cbc:TaxAmount currencyID="' + currency + '">' + fmt(line.vatAmount) + '</cbc:TaxAmount>');
        parts.push('<cac:TaxSubtotal>');
        parts.push('<cbc:TaxableAmount currencyID="' + currency + '">' + fmt(line.lineTotal) + '</cbc:TaxableAmount>');
        parts.push('<cbc:TaxAmount currencyID="' + currency + '">' + fmt(line.vatAmount) + '</cbc:TaxAmount>');
        parts.push('<cbc:Percent>' + line.vatRate + '</cbc:Percent>');
        parts.push('<cac:TaxCategory>');
        if (line.vatRate === 0) {
            if (profileId === "IHRACAT") {
                parts.push('<cbc:TaxExemptionReasonCode>301</cbc:TaxExemptionReasonCode>');
                parts.push('<cbc:TaxExemptionReason>11/1-a Mal ihracati</cbc:TaxExemptionReason>');
            } else if (profileId === "YOLCUBERABERFATURA") {
                parts.push('<cbc:TaxExemptionReasonCode>501</cbc:TaxExemptionReasonCode>');
                parts.push('<cbc:TaxExemptionReason>Yolcu Beraberi Esya</cbc:TaxExemptionReason>');
            } else {
                parts.push('<cbc:TaxExemptionReasonCode>350</cbc:TaxExemptionReasonCode>');
                parts.push('<cbc:TaxExemptionReason>Digerlerinde yazili islemler (KDVK 17/4)</cbc:TaxExemptionReason>');
            }
        }
        appendKdvTaxScheme(parts);
        parts.push('</cac:TaxCategory>');
        parts.push('</cac:TaxSubtotal>');
        parts.push('</cac:TaxTotal>');

        // Ürün bilgisi
        parts.push('<cac:Item><cbc:Name>' + esc(line.name) + '</cbc:Name></cac:Item>');
        parts.push('<cac:Price><cbc:PriceAmount currencyID="' + currency + '">' + fmt(line.unitPrice) + '</cbc:PriceAmount></cac:Price>');
        parts.push('</cac:InvoiceLine>');
    });

    parts.push('</Invoice>');

    const xml = parts.join("\n");
    const base64 = Buffer.from(xml, "utf-8").toString("base64");

    return {
        xml,
        uuid,
        base64,
        totals: {
            lineExtensionAmount,
            totalTax,
            taxInclusiveAmount,
            payableAmount,
            totalDiscount,
            vatGroups: Object.values(vatGroups),
        }
    };
};

/**
 * e-Fatura Ticari — Uygulama Yanıtı (KABUL / RED) UBL-TR 2.1
 * Resmi örnek: KabulUygulamaYanitiOrnegi.xml + Foriba ApplicationResponseUBL
 */
const buildApplicationResponseXml = (data) => {
    const uuid = data.uuid || crypto.randomUUID();
    const issueDate = data.issueDate || todayDate();
    const issueTime = data.issueTime || nowTime();
    const responseCode = String(data.responseCode || "KABUL").toUpperCase();
    const refId = String(data.referenceId || crypto.randomUUID().replace(/-/g, "").slice(0, 11));
    const lineRefId = String(data.lineReferenceId || refId + "1");

    const our = data.ourParty || {};
    const counterparty = data.counterparty || {};
    const ourVkn = String(our.vkn || "").trim();
    const cpVkn = String(counterparty.vkn || "").trim();
    const ourScheme = ourVkn.length === 11 ? "TCKN" : "VKN";
    const cpScheme = cpVkn.length === 11 ? "TCKN" : "VKN";

    const invoiceNumber = String(data.invoiceNumber || "").trim();
    const invoiceIssueDate = data.invoiceIssueDate || issueDate;
    const description = responseCode === "RED" ? "FATURARED" : "FATURAKABUL";
    const note = data.note || (responseCode === "RED" ? "Fatura reddedilmistir." : "Fatura kabul edilmistir.");

    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"');
    parts.push(' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    parts.push(' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">');

    parts.push("<cbc:UBLVersionID>2.1</cbc:UBLVersionID>");
    parts.push("<cbc:CustomizationID>TR1.2</cbc:CustomizationID>");
    parts.push("<cbc:ProfileID>TICARIFATURA</cbc:ProfileID>");
    parts.push("<cbc:ID>" + esc(refId) + "</cbc:ID>");
    parts.push("<cbc:UUID>" + esc(uuid) + "</cbc:UUID>");
    parts.push("<cbc:IssueDate>" + esc(issueDate) + "</cbc:IssueDate>");
    parts.push("<cbc:IssueTime>" + esc(issueTime) + "</cbc:IssueTime>");
    parts.push("<cbc:Note>" + esc(note) + "</cbc:Note>");

    // Gönderici: yanıt veren (alıcı firma — biz)
    parts.push("<cac:SenderParty>");
    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + ourScheme + '">' + esc(ourVkn) + "</cbc:ID></cac:PartyIdentification>");
    if (our.name) parts.push("<cac:PartyName><cbc:Name>" + esc(our.name) + "</cbc:Name></cac:PartyName>");
    appendPostalAddress(parts, {
        street: our.street,
        district: our.district,
        city: our.city,
        country: our.country,
    });
    if (our.taxOffice && ourScheme === "VKN") {
        parts.push("<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>" + esc(our.taxOffice) + "</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>");
    }
    parts.push("</cac:SenderParty>");

    // Alıcı: faturayı gönderen tedarikçi
    parts.push("<cac:ReceiverParty>");
    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + cpScheme + '">' + esc(cpVkn) + "</cbc:ID></cac:PartyIdentification>");
    if (counterparty.name) parts.push("<cac:PartyName><cbc:Name>" + esc(counterparty.name) + "</cbc:Name></cac:PartyName>");
    appendPostalAddress(parts, {
        street: counterparty.street,
        district: counterparty.district,
        city: counterparty.city,
        country: counterparty.country,
    });
    parts.push("</cac:ReceiverParty>");

    parts.push("<cac:DocumentResponse>");
    parts.push("<cac:Response>");
    parts.push("<cbc:ReferenceID>" + esc(refId) + "</cbc:ReferenceID>");
    parts.push("<cbc:ResponseCode>" + esc(responseCode) + "</cbc:ResponseCode>");
    parts.push("<cbc:Description>" + esc(description) + "</cbc:Description>");
    parts.push("</cac:Response>");
    parts.push("<cac:DocumentReference>");
    parts.push("<cbc:ID>" + esc(invoiceNumber) + "</cbc:ID>");
    parts.push("<cbc:IssueDate>" + esc(invoiceIssueDate) + "</cbc:IssueDate>");
    parts.push("<cbc:DocumentTypeCode>FATURA</cbc:DocumentTypeCode>");
    parts.push("<cbc:DocumentType>FATURA</cbc:DocumentType>");
    parts.push("</cac:DocumentReference>");
    parts.push("<cac:LineResponse>");
    parts.push("<cac:LineReference><cbc:LineID/></cac:LineReference>");
    parts.push("<cac:Response>");
    parts.push("<cbc:ReferenceID>" + esc(lineRefId) + "</cbc:ReferenceID>");
    parts.push("<cbc:ResponseCode>" + esc(responseCode) + "</cbc:ResponseCode>");
    parts.push("<cbc:Description>" + esc(description) + "</cbc:Description>");
    parts.push("</cac:Response>");
    parts.push("</cac:LineResponse>");
    parts.push("</cac:DocumentResponse>");
    parts.push("</ApplicationResponse>");

    const xml = parts.join("\n");
    return { xml, uuid, base64: Buffer.from(xml, "utf-8").toString("base64") };
};

module.exports = {
    buildInvoiceXml,
    buildApplicationResponseXml,
    formatGibInvoiceId,
    isValidGibInvoiceId,
    getUnitCode,
    UNIT_CODES,
    TAX_CODES,
};
