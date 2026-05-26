#!/usr/bin/env node
/**
 * PayTR token doğrulama (sunucuda: node scripts/verify-paytr-token.js)
 * .env yüklü olmalı — secret değerleri yazdırmaz.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const paytr = require("../backend/services/paytrService");

const creds = paytr.getCredentials();
if (!paytr.hasValidCredentials()) {
    console.error("PAYTR_MERCHANT_* eksik — backend/.env kontrol edin.");
    process.exit(1);
}

const sample = {
    merchantId: creds.merchantId,
    userIp: "85.34.78.112",
    merchantOid: "TEST" + Date.now(),
    email: "test@example.com",
    paymentAmountKurus: "29900",
    paymentAmountTl: "299.00",
    userBasketJson: JSON.stringify([["Test Paket", "299.00", 1]]),
    userBasketB64: Buffer.from(JSON.stringify([["Test Paket", "299.00", 1]])).toString("base64"),
    noInstallment: "1",
    maxInstallment: "0",
    currency: "TL",
    testMode: creds.testMode,
};

const modes = ["direct_sync", "iframe_plain", "iframe_b64", "direct_decimal"];
console.log("PayTR token önizleme (merchant_id:", creds.merchantId, "test_mode:", creds.testMode, ")");
for (const mode of modes) {
    const { token, mode: resolved } = paytr.buildPaytrToken(creds, { mode, ...sample });
    console.log(`  ${resolved}: token uzunluk=${token.length}, başlangıç=${token.slice(0, 12)}...`);
}
console.log("\nVarsayılan mod: direct_sync (hash ve POST aynı kuruş tutar)");
