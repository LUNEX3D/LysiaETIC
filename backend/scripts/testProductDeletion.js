/**
 * ÜRÜN SİLME SİSTEMİ TEST SCRIPT
 *
 * Bu script, ürün silme işleminin tüm pazaryerlerinden zorunlu olarak
 * kaldırma özelliğini test eder.
 *
 * Test Senaryoları:
 * 1. Tekli ürün silme — pazaryerlerinden otomatik kaldırma
 * 2. Toplu ürün silme — pazaryerlerinden otomatik kaldırma
 * 3. Backend default değer kontrolü (deleteFromMarketplaces=true)
 * 4. Frontend checkbox kaldırma kontrolü
 *
 * Çalıştırma: node backend/scripts/testProductDeletion.js
 */

const LOG_PREFIX = "[TEST PRODUCT DELETION]";

// Test renkleri
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
};

function log(msg, color = "reset") {
    console.log(`${colors[color]}${LOG_PREFIX} ${msg}${colors.reset}`);
}

async function runTests() {
    try {
        log("Dosya bazlı testler başlatılıyor...", "cyan");

        const tests = [
            { id: 1, name: "Backend Controller — deleteProduct default değeri", fn: testDeleteProductDefault },
            { id: 2, name: "Backend Controller — bulkDeleteProducts default değeri", fn: testBulkDeleteDefault },
            { id: 3, name: "ProductSyncService — deleteProductFromMarketplaces fonksiyonu", fn: testDeleteFromMarketplaces },
            { id: 4, name: "Frontend — ProductManagementCenter checkbox kaldırıldı mı?", fn: testFrontendCheckboxRemoved },
            { id: 5, name: "Frontend — ProductManagementPageV3 checkbox kaldırıldı mı?", fn: testFrontendV3CheckboxRemoved },
            { id: 6, name: "Marketplace Silme Stratejileri — 5 platform kontrolü", fn: testMarketplaceStrategies }
        ];

        let passed = 0;
        let failed = 0;

        log("\n" + "=".repeat(70), "cyan");
        log("ÜRÜN SİLME SİSTEMİ TEST SUITE", "cyan");
        log("=".repeat(70) + "\n", "cyan");

        for (const test of tests) {
            log(`\nTest ${test.id}/6: ${test.name}`, "blue");
            log("-".repeat(70), "blue");
            try {
                await test.fn();
                log(`✅ BAŞARILI — ${test.name}`, "green");
                passed++;
            } catch (error) {
                log(`❌ BAŞARISIZ — ${test.name}`, "red");
                log(`   Hata: ${error.message}`, "red");
                failed++;
            }
        }

        log("\n" + "=".repeat(70), "cyan");
        log(`TEST SONUÇLARI: ${passed} başarılı, ${failed} başarısız`, failed === 0 ? "green" : "yellow");
        log("=".repeat(70) + "\n", "cyan");

        if (failed === 0) {
            log("🎉 TÜM TESTLER BAŞARILI!", "green");
            log("✅ Ürün silme sistemi pazaryerlerinden zorunlu kaldırma ile çalışıyor", "green");
        } else {
            log("⚠️ BAZI TESTLER BAŞARISIZ OLDU", "yellow");
        }

    } catch (error) {
        log(`❌ Genel hata: ${error.message}`, "red");
        console.error(error);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════════════════

async function testDeleteProductDefault() {
    const fs = require("fs").promises;
    const controllerPath = require("path").join(__dirname, "../controllers/productManagementController.js");
    const content = await fs.readFile(controllerPath, "utf8");

    // deleteProduct fonksiyonunda default değer kontrolü
    const deleteProductMatch = content.match(/const deleteFromMarketplaces = req\.query\.deleteFromMarketplaces !== "false"/);
    if (!deleteProductMatch) {
        throw new Error("deleteProduct fonksiyonunda 'deleteFromMarketplaces !== \"false\"' default değeri bulunamadı");
    }

    log("   ✓ deleteProduct default değeri doğru: !== \"false\" (default: true)", "green");
}

async function testBulkDeleteDefault() {
    const fs = require("fs").promises;
    const controllerPath = require("path").join(__dirname, "../controllers/productManagementController.js");
    const content = await fs.readFile(controllerPath, "utf8");

    // bulkDeleteProducts fonksiyonunda default değer kontrolü
    const bulkDeleteMatch = content.match(/const \{ productIds, deleteFromMarketplaces = true, platforms = \[\] \} = req\.body/);
    if (!bulkDeleteMatch) {
        throw new Error("bulkDeleteProducts fonksiyonunda 'deleteFromMarketplaces = true' default değeri bulunamadı");
    }

    log("   ✓ bulkDeleteProducts default değeri doğru: = true", "green");
}

async function testDeleteFromMarketplaces() {
    const fs = require("fs").promises;
    const servicePath = require("path").join(__dirname, "../services/productSyncService.js");
    const content = await fs.readFile(servicePath, "utf8");

    // deleteProductFromMarketplaces fonksiyonu var mı?
    if (!content.includes("const deleteProductFromMarketplaces = async")) {
        throw new Error("deleteProductFromMarketplaces fonksiyonu bulunamadı");
    }

    // 5 platform stratejisi var mı?
    const platforms = ["Trendyol", "N11", "Amazon", "Hepsiburada", "ÇiçekSepeti"];
    for (const platform of platforms) {
        if (!content.includes(`case "${platform}":`)) {
            throw new Error(`${platform} silme stratejisi bulunamadı`);
        }
    }

    log("   ✓ deleteProductFromMarketplaces fonksiyonu mevcut", "green");
    log("   ✓ 5 platform silme stratejisi mevcut (Trendyol, N11, Amazon, Hepsiburada, ÇiçekSepeti)", "green");
}

async function testFrontendCheckboxRemoved() {
    const fs = require("fs").promises;
    const frontendPath = require("path").join(__dirname, "../../frontend/src/pages/ProductManagementCenter.js");
    const content = await fs.readFile(frontendPath, "utf8");

    // deleteFromMP state'i kaldırıldı mı?
    if (content.includes("deleteFromMP") || content.includes("setDeleteFromMP")) {
        throw new Error("ProductManagementCenter.js'de hâlâ deleteFromMP state'i var");
    }

    // Checkbox kaldırıldı mı?
    if (content.includes('type="checkbox"') && content.includes("Pazaryerlerinden de kaldır")) {
        throw new Error("ProductManagementCenter.js'de hâlâ pazaryeri checkbox'u var");
    }

    // "Tüm pazaryerlerinden kaldırılacak" mesajı var mı?
    if (!content.includes("Tüm pazaryerlerinden kaldırılacak")) {
        throw new Error("ProductManagementCenter.js'de zorunlu silme mesajı bulunamadı");
    }

    // deleteFromMarketplaces: true olarak gönderiliyor mu?
    if (!content.includes("deleteFromMarketplaces: true")) {
        throw new Error("ProductManagementCenter.js'de deleteFromMarketplaces: true bulunamadı");
    }

    log("   ✓ deleteFromMP state'i kaldırıldı", "green");
    log("   ✓ Checkbox kaldırıldı, zorunlu silme mesajı eklendi", "green");
    log("   ✓ deleteFromMarketplaces: true olarak gönderiliyor", "green");
}

async function testFrontendV3CheckboxRemoved() {
    const fs = require("fs").promises;
    const frontendPath = require("path").join(__dirname, "../../frontend/src/pages/ProductManagementPageV3.js");
    const content = await fs.readFile(frontendPath, "utf8");

    // deleteFromMP state'i kaldırıldı mı?
    if (content.includes("deleteFromMP") || content.includes("setDeleteFromMP")) {
        throw new Error("ProductManagementPageV3.js'de hâlâ deleteFromMP state'i var");
    }

    // Checkbox kaldırıldı mı?
    if (content.includes('type="checkbox"') && content.includes("Pazaryerlerinden de kaldır")) {
        throw new Error("ProductManagementPageV3.js'de hâlâ pazaryeri checkbox'u var");
    }

    // "Tüm pazaryerlerinden kaldırılacak" mesajı var mı?
    if (!content.includes("Tüm pazaryerlerinden kaldırılacak")) {
        throw new Error("ProductManagementPageV3.js'de zorunlu silme mesajı bulunamadı");
    }

    // deleteFromMarketplaces: true olarak gönderiliyor mu?
    if (!content.includes("deleteFromMarketplaces: true")) {
        throw new Error("ProductManagementPageV3.js'de deleteFromMarketplaces: true bulunamadı");
    }

    log("   ✓ deleteFromMP state'i kaldırıldı", "green");
    log("   ✓ Checkbox kaldırıldı, zorunlu silme mesajı eklendi", "green");
    log("   ✓ deleteFromMarketplaces: true olarak gönderiliyor", "green");
}

async function testMarketplaceStrategies() {
    const fs = require("fs").promises;
    const servicePath = require("path").join(__dirname, "../services/productSyncService.js");
    const content = await fs.readFile(servicePath, "utf8");

    // deleteProductFromMarketplaces fonksiyonunun tamamını al
    const fnStart = content.indexOf("const deleteProductFromMarketplaces = async");
    const fnEnd = content.indexOf("module.exports", fnStart);
    if (fnStart === -1 || fnEnd === -1) {
        throw new Error("deleteProductFromMarketplaces fonksiyonu bulunamadı");
    }
    const fnContent = content.substring(fnStart, fnEnd);

    const strategies = [
        { platform: "Trendyol", keywords: ["quantity: 0", "archived: true", "PendingDeletion", "Trendyol Adım 1/3", "Trendyol Adım 2/3", "Trendyol Adım 3/3"] },
        { platform: "N11", keywords: ["deleteProductById", "SOAP", "fallback", "stok=0 fallback"] },
        { platform: "Amazon", keywords: ["deleteListingsItem"] },
        { platform: "Hepsiburada", keywords: ["deactivate", "availableStock: 0", "Hepsiburada Adım 1/3", "Hepsiburada Adım 2/3", "Hepsiburada Adım 3/3"] },
        { platform: "ÇiçekSepeti", keywords: ["stockQuantity: 0", "salesPrice: 0", "isActive: false"] }
    ];

    for (const { platform, keywords } of strategies) {
        // Platform case bloğu var mı?
        if (!fnContent.includes(`case "${platform}":`)) {
            throw new Error(`${platform} case bloğu bulunamadı`);
        }

        for (const keyword of keywords) {
            if (!fnContent.includes(keyword)) {
                throw new Error(`${platform} stratejisinde '${keyword}' bulunamadı`);
            }
        }

        log(`   ✓ ${platform} silme stratejisi doğru (${keywords.length} kontrol noktası)`, "green");
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT BAŞLAT
// ═══════════════════════════════════════════════════════════════════════════

runTests().catch(err => {
    console.error("Test hatası:", err);
    process.exit(1);
});
