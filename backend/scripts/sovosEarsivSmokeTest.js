/**
 * Sovos e-Arşiv WS smoke test — resmi .NET örnek istemci ile aynı akış:
 *   Authorization: Basic base64(utf8(user:pass))
 *   POST earsivwstest.../ClientEArsivServicesPort.svc
 *   SOAPAction: "generateInvID"
 *   Boş SOAP Header
 *
 * Kullanım (backend klasöründen):
 *   set SOVOS_WS_USER=p4uJXTR6
 *   set SOVOS_WS_PASS=your_password
 *   set SOVOS_VKN=33794141888
 *   set SOVOS_ENV=test
 *   node scripts/sovosEarsivSmokeTest.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { verifyEArchiveCredentials } = require("../utils/sovosHttpSoap");
const { ENDPOINT } = require("../services/sovosEArchiveService");

const user = process.env.SOVOS_WS_USER || process.env.SOVOS_TEST_USER || "";
const pass = process.env.SOVOS_WS_PASS || process.env.SOVOS_TEST_PASS || "";
const vkn = String(process.env.SOVOS_VKN || process.env.SOVOS_TEST_VKN || "").replace(/\D/g, "");
const env = (process.env.SOVOS_ENV || "test").toLowerCase() === "production" ? "production" : "test";
const branch = process.env.SOVOS_BRANCH || "default";

if (!user || !pass || !vkn) {
    console.error("SOVOS_WS_USER, SOVOS_WS_PASS, SOVOS_VKN gerekli");
    process.exit(1);
}

const endpoint = ENDPOINT[env];

console.log("Sovos e-Arşiv smoke test");
console.log("  env      :", env);
console.log("  endpoint :", endpoint);
console.log("  user     :", user);
console.log("  passLen  :", pass.length);
console.log("  vkn      :", vkn);
console.log("  branch   :", branch);
if (env === "production") {
    console.warn("\n⚠  CANLI endpoint. cloudtest.fitbulut.com WS kullanıcısı yalnızca test ortamında çalışır.\n");
}

verifyEArchiveCredentials({
    endpoint,
    username: user,
    password: pass,
    vknTckn: vkn,
    branch,
    identifier: vkn,
})
    .then((r) => {
        console.log("\n✓ Başarılı — authMode:", r.authMode);
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n✗ Hata:", err.message);
        if (String(err.body || "").includes("5000")) {
            console.error("\n5000 Unauthorized = HTTP Basic reddedildi.");
            if (env === "production") {
                console.error("Test portal (cloudtest) hesabı için SOVOS_ENV=test kullanın:");
                console.error("  ", ENDPOINT.test);
            }
        }
        process.exit(1);
    });
