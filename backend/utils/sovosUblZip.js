const zlib = require("zlib");
const crypto = require("crypto");

/**
 * UBL XML → tek dosyalı ZIP (Sovos sendUBL / getUBL formatı).
 * Harici bağımlılık kullanmadan minimal ZIP oluşturur.
 */
const compressXmlToZip = (xmlContent, fileName) => {
    const name = String(fileName || crypto.randomUUID()).replace(/\.xml$/i, "") + ".xml";
    const data = Buffer.isBuffer(xmlContent) ? xmlContent : Buffer.from(String(xmlContent), "utf8");
    const compressed = zlib.deflateRawSync(data);

    const localHeader = Buffer.alloc(30 + name.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32(data), 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localHeader.write(name, 30, "utf8");

    const centralHeader = Buffer.alloc(46 + name.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc32(data), 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(0, 42);
    centralHeader.write(name, 46, "utf8");

    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(1, 8);
    endRecord.writeUInt16LE(1, 10);
    endRecord.writeUInt32LE(centralHeader.length, 12);
    endRecord.writeUInt32LE(localHeader.length + compressed.length, 16);
    endRecord.writeUInt16LE(0, 20);

    return Buffer.concat([localHeader, compressed, centralHeader, endRecord]);
};

const crc32 = (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
};

/** ZIP içindeki ilk dosyayı çıkarır (store/deflate). */
const decompressZipEntry = (zipBuffer) => {
    const buf = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
    let offset = 0;
    while (offset + 30 <= buf.length) {
        const sig = buf.readUInt32LE(offset);
        if (sig !== 0x04034b50) break;
        const compMethod = buf.readUInt16LE(offset + 8);
        const compSize = buf.readUInt32LE(offset + 18);
        const nameLen = buf.readUInt16LE(offset + 26);
        const extraLen = buf.readUInt16LE(offset + 28);
        const dataStart = offset + 30 + nameLen + extraLen;
        const compressed = buf.subarray(dataStart, dataStart + compSize);
        if (compMethod === 0) return compressed;
        if (compMethod === 8) return zlib.inflateRawSync(compressed);
        throw new Error("Desteklenmeyen ZIP sıkıştırma yöntemi: " + compMethod);
    }
    throw new Error("ZIP içeriği okunamadı");
};

module.exports = { compressXmlToZip, decompressZipEntry };
