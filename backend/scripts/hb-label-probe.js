require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const axios = require("axios");

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const mp = await require("../models/Marketplace").findById("69fb72e41eff1b56754c6536");
    const { decryptCredentials } = require("../utils/encryption");
    const { normalizeCredentials, getHeadersForGet } = require("../services/hepsiburadaService");
    const hb = normalizeCredentials(decryptCredentials(mp.credentials));
    const h = getHeadersForGet(hb.merchantId, hb.secretKey, hb.userAgent);
    const pkg = "5477503376";
    const lines = [];
    const url = `https://oms-external.hepsiburada.com/packages/merchantid/${hb.merchantId}/packagenumber/${pkg}/labels?format=PDF`;
    const r = await axios.get(url, { headers: h, validateStatus: () => true });
    lines.push(`labels GET ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    const postUrl = "https://oms-external.hepsiburada.com/delivery/barcodes-label?format=PDF";
    const r2 = await axios.post(
        postUrl,
        { barcodes: ["62754775033760"] },
        { headers: { ...h, "Content-Type": "application/json" }, validateStatus: () => true }
    );
    lines.push(`barcodes POST ${r2.status} ${JSON.stringify(r2.data).slice(0, 300)}`);
    const { fetchHepsiburadaLabel } = require("../services/shippingLabelService");
    try {
        const label = await require("../services/shippingLabelService").getShippingLabelForOrder(mp.userId, {
            marketplaceId: "69fb72e41eff1b56754c6536",
            orderNumber: "4381688459",
            packageNumber: pkg,
        });
        lines.push(`label result: ${JSON.stringify({ format: label.format, viewMode: label.viewMode, mode: label.mode, source: label.source })}`);
    } catch (e) {
        lines.push(`label error: ${e.message}`);
    }
    fs.writeFileSync(path.join(__dirname, "hb-label-probe-out.txt"), lines.join("\n"));
    await mongoose.disconnect();
})();
