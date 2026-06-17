/**
 * Sovos getRAWUserList yanıtı (ZIP içi XML) — mükellef bilgisi çıkarımı
 * Resmi API: getRAWUserList + Parameters VKN_TCKN=...
 */

const { decompressZipEntry } = require("./sovosUblZip");

const pickXmlTag = (xml, ...tags) => {
    for (const tag of tags) {
        const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
        const m = xml.match(re);
        if (m && m[1].trim()) return m[1].trim();
    }
    return "";
};

const parseSovosUserListXml = (xml) => {
    if (!xml || typeof xml !== "string") return {};

    const title = pickXmlTag(xml, "Title", "Unvan", "RegisteredName", "PartyName");
    const firstName = pickXmlTag(xml, "FirstName", "Name", "Ad");
    const lastName = pickXmlTag(xml, "FamilyName", "Surname", "Soyad");
    const taxOffice = pickXmlTag(xml, "TaxOffice", "TaxOfficeName", "VergiDairesi");
    const city = pickXmlTag(xml, "City", "CityName", "Il");
    const district = pickXmlTag(xml, "District", "CitySubdivision", "Ilce");
    const street = pickXmlTag(xml, "Street", "Address", "Adres");
    const urnMatch = xml.match(/urn:mail:[^@\s<"']+@[^@\s<"']+/i);

    const name = title || [firstName, lastName].filter(Boolean).join(" ").trim();

    return {
        title,
        name,
        firstName,
        lastName,
        taxOffice,
        city,
        district,
        street,
        identifier: urnMatch ? urnMatch[0] : "",
    };
};

const parseUserListFromRawResponse = (raw) => {
    const body = raw?.getRAWUserListResponse ?? raw ?? {};
    const docData = body.DocData ?? body.docData;
    if (!docData) return {};

    try {
        const buf = Buffer.isBuffer(docData) ? docData : Buffer.from(docData);
        if (buf.length < 20) return {};
        const xml = decompressZipEntry(buf).toString("utf8");
        return parseSovosUserListXml(xml);
    } catch {
        return {};
    }
};

module.exports = {
    pickXmlTag,
    parseSovosUserListXml,
    parseUserListFromRawResponse,
};
