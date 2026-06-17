/**
 * Google TR ürün taksonomisini indirir.
 * Kullanım: node scripts/downloadGoogleTaxonomy.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const URL = "https://www.google.com/basepages/producttype/taxonomy-with-ids.tr-TR.txt";
const OUT = path.join(__dirname, "../data/google-product-taxonomy-tr.txt");

https
    .get(URL, (res) => {
        if (res.statusCode !== 200) {
            console.error("HTTP", res.statusCode);
            process.exit(1);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
            fs.mkdirSync(path.dirname(OUT), { recursive: true });
            fs.writeFileSync(OUT, Buffer.concat(chunks));
            console.log("Saved", OUT, Buffer.concat(chunks).length, "bytes");
        });
    })
    .on("error", (e) => {
        console.error(e.message);
        process.exit(1);
    });
