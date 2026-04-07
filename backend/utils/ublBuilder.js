/**
 * UBL-TR 2.1 XML Builder — LysiaETIC
 *
 * Türkiye e-Fatura / e-Arşiv / e-İrsaliye için UBL-TR 2.1 formatında XML oluşturur.
 * QNB eSolutions SOAP API ile uyumlu.
 *
 * Desteklenen profiller:
 *   - EARSIVFATURA  (e-Arşiv)
 *   - TICARIFATURA  (e-Fatura — Ticari)
 *   - TEMELFATURA   (e-Fatura — Temel)
 *   - IRSALIYE      (e-İrsaliye)
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

// ─── Birim Kodları ──────────────────────────────────────────────────────────
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
};

const getUnitCode = (unit) => {
    if (!unit) return "C62";
    const u = unit.toLowerCase().trim();
    return UNIT_CODES[u] || unit.toUpperCase();
};

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
 * @param {string} data.supplier.vkn - VKN (10 hane) veya TCKN (11 hane)
 * @param {string} data.supplier.name - Firma/Kişi adı
 * @param {string} [data.supplier.taxOffice] - Vergi dairesi
 * @param {string} [data.supplier.street] - Adres
 * @param {string} [data.supplier.district] - İlçe
 * @param {string} [data.supplier.city] - İl
 * @param {string} [data.supplier.country] - Ülke
 * @param {string} [data.supplier.phone] - Telefon
 * @param {string} [data.supplier.email] - E-posta
 *
 * @param {Object} data.customer - Alıcı bilgileri (supplier ile aynı yapı)
 * @param {string} [data.customer.firstName] - Ad (TCKN için zorunlu)
 * @param {string} [data.customer.lastName] - Soyad (TCKN için zorunlu)
 *
 * @param {Array} data.lines - Fatura kalemleri
 * @param {string} data.lines[].name - Ürün/Hizmet adı
 * @param {number} data.lines[].quantity - Miktar
 * @param {string} [data.lines[].unit] - Birim (adet, kg, lt, m, m2, paket...)
 * @param {number} data.lines[].unitPrice - Birim fiyat (KDV hariç)
 * @param {number} [data.lines[].vatRate] - KDV oranı (varsayılan: 20)
 * @param {number} [data.lines[].discountAmount] - İndirim tutarı
 * @param {string} [data.lines[].discountReason] - İndirim nedeni
 *
 * @returns {Object} { xml: string, uuid: string, base64: string }
 */
const buildInvoiceXml = (data) => {
    const uuid = data.uuid || crypto.randomUUID();
    const issueDate = data.issueDate || todayDate();
    const issueTime = data.issueTime || nowTime();
    const currency = data.currency || "TRY";
    const profileId = data.profileId || "EARSIVFATURA";
    const invoiceTypeCode = data.invoiceTypeCode || "SATIS";
    const invoiceNumber = data.invoiceNumber || "";
    const sendingType = data.sendingType || "ELEKTRONIK";

    const supplier = data.supplier || {};
    const customer = data.customer || {};
    const lines = data.lines || [];

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

    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    parts.push(' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    parts.push(' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"');
    parts.push(' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">');

    // Header
    parts.push('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    parts.push('<cbc:CustomizationID>TR1.2</cbc:CustomizationID>');
    parts.push('<cbc:ProfileID>' + esc(profileId) + '</cbc:ProfileID>');
    parts.push('<cbc:ID>' + esc(invoiceNumber) + '</cbc:ID>');
    parts.push('<cbc:CopyIndicator>false</cbc:CopyIndicator>');
    parts.push('<cbc:UUID>' + uuid + '</cbc:UUID>');
    parts.push('<cbc:IssueDate>' + issueDate + '</cbc:IssueDate>');
    parts.push('<cbc:IssueTime>' + issueTime + '</cbc:IssueTime>');
    parts.push('<cbc:InvoiceTypeCode>' + esc(invoiceTypeCode) + '</cbc:InvoiceTypeCode>');

    // Notes — e-Arşiv için Gönderim Şekli zorunlu
    if (data.note) {
        parts.push('<cbc:Note>' + esc(data.note) + '</cbc:Note>');
    }
    if (profileId === "EARSIVFATURA") {
        parts.push('<cbc:Note>Gonderim Sekli: ' + esc(sendingType) + '</cbc:Note>');
    }

    parts.push('<cbc:DocumentCurrencyCode>' + esc(currency) + '</cbc:DocumentCurrencyCode>');
    parts.push('<cbc:LineCountNumeric>' + calculatedLines.length + '</cbc:LineCountNumeric>');

    // ── Satıcı (Supplier) ──
    parts.push('<cac:AccountingSupplierParty><cac:Party>');
    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + supplierIdType + '">' + esc(supplier.vkn) + '</cbc:ID></cac:PartyIdentification>');
    parts.push('<cac:PartyName><cbc:Name>' + esc(supplier.name) + '</cbc:Name></cac:PartyName>');
    parts.push('<cac:PostalAddress>');
    if (supplier.street) parts.push('<cbc:StreetName>' + esc(supplier.street) + '</cbc:StreetName>');
    parts.push('<cbc:CitySubdivisionName>' + esc(supplier.district || "Merkez") + '</cbc:CitySubdivisionName>');
    parts.push('<cbc:CityName>' + esc(supplier.city || "Istanbul") + '</cbc:CityName>');
    parts.push('<cac:Country><cbc:Name>' + esc(supplier.country || "Turkiye") + '</cbc:Name></cac:Country>');
    parts.push('</cac:PostalAddress>');
    if (supplier.taxOffice) {
        parts.push('<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>' + esc(supplier.taxOffice) + '</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>');
    }
    if (supplier.phone || supplier.email) {
        parts.push('<cac:Contact>');
        if (supplier.phone) parts.push('<cbc:Telephone>' + esc(supplier.phone) + '</cbc:Telephone>');
        if (supplier.email) parts.push('<cbc:ElectronicMail>' + esc(supplier.email) + '</cbc:ElectronicMail>');
        parts.push('</cac:Contact>');
    }
    if (supplierIdType === "TCKN" && (supplier.firstName || supplier.lastName)) {
        parts.push('<cac:Person>');
        parts.push('<cbc:FirstName>' + esc(supplier.firstName || "") + '</cbc:FirstName>');
        parts.push('<cbc:FamilyName>' + esc(supplier.lastName || "") + '</cbc:FamilyName>');
        parts.push('</cac:Person>');
    }
    parts.push('</cac:Party></cac:AccountingSupplierParty>');

    // ── Alıcı (Customer) ──
    parts.push('<cac:AccountingCustomerParty><cac:Party>');
    parts.push('<cac:PartyIdentification><cbc:ID schemeID="' + customerIdType + '">' + esc(customer.vkn) + '</cbc:ID></cac:PartyIdentification>');
    parts.push('<cac:PartyName><cbc:Name>' + esc(customer.name) + '</cbc:Name></cac:PartyName>');
    parts.push('<cac:PostalAddress>');
    if (customer.street) parts.push('<cbc:StreetName>' + esc(customer.street) + '</cbc:StreetName>');
    parts.push('<cbc:CitySubdivisionName>' + esc(customer.district || "Merkez") + '</cbc:CitySubdivisionName>');
    parts.push('<cbc:CityName>' + esc(customer.city || "Istanbul") + '</cbc:CityName>');
    parts.push('<cac:Country><cbc:Name>' + esc(customer.country || "Turkiye") + '</cbc:Name></cac:Country>');
    parts.push('</cac:PostalAddress>');
    if (customer.taxOffice && customerIdType === "VKN") {
        parts.push('<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>' + esc(customer.taxOffice) + '</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>');
    }
    if (customer.phone || customer.email) {
        parts.push('<cac:Contact>');
        if (customer.phone) parts.push('<cbc:Telephone>' + esc(customer.phone) + '</cbc:Telephone>');
        if (customer.email) parts.push('<cbc:ElectronicMail>' + esc(customer.email) + '</cbc:ElectronicMail>');
        parts.push('</cac:Contact>');
    }
    // TCKN için Person zorunlu
    if (customerIdType === "TCKN") {
        parts.push('<cac:Person>');
        parts.push('<cbc:FirstName>' + esc(customer.firstName || customer.name || "") + '</cbc:FirstName>');
        parts.push('<cbc:FamilyName>' + esc(customer.lastName || "") + '</cbc:FamilyName>');
        parts.push('</cac:Person>');
    }
    parts.push('</cac:Party></cac:AccountingCustomerParty>');

    // ── Vergi Toplamları ──
    parts.push('<cac:TaxTotal>');
    parts.push('<cbc:TaxAmount currencyID="' + currency + '">' + fmt(totalTax) + '</cbc:TaxAmount>');
    Object.values(vatGroups).forEach(g => {
        parts.push('<cac:TaxSubtotal>');
        parts.push('<cbc:TaxableAmount currencyID="' + currency + '">' + fmt(g.taxable) + '</cbc:TaxableAmount>');
        parts.push('<cbc:TaxAmount currencyID="' + currency + '">' + fmt(g.tax) + '</cbc:TaxAmount>');
        parts.push('<cbc:Percent>' + g.rate + '</cbc:Percent>');
        parts.push('<cac:TaxCategory>');
        // ✅ FIX: KDV oranı 0 ise TaxExemptionReason zorunlu (QNB validasyonu)
        if (g.rate === 0) {
            parts.push('<cbc:TaxExemptionReasonCode>350</cbc:TaxExemptionReasonCode>');
            parts.push('<cbc:TaxExemptionReason>Diğerlerinde yazılı işlemler (KDVK 17/4)</cbc:TaxExemptionReason>');
        }
        parts.push('<cac:TaxScheme>');
        parts.push('<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>');
        parts.push('<cbc:Name>KDV</cbc:Name>');
        parts.push('</cac:TaxScheme></cac:TaxCategory>');
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
        // ✅ FIX: Kalem KDV oranı 0 ise TaxExemptionReason zorunlu
        if (line.vatRate === 0) {
            parts.push('<cbc:TaxExemptionReasonCode>350</cbc:TaxExemptionReasonCode>');
            parts.push('<cbc:TaxExemptionReason>Diğerlerinde yazılı işlemler (KDVK 17/4)</cbc:TaxExemptionReason>');
        }
        parts.push('<cac:TaxScheme>');
        parts.push('<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>');
        parts.push('<cbc:Name>KDV</cbc:Name>');
        parts.push('</cac:TaxScheme></cac:TaxCategory>');
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

module.exports = {
    buildInvoiceXml,
    getUnitCode,
    UNIT_CODES,
    TAX_CODES,
};
