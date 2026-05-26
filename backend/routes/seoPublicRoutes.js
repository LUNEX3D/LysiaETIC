/**
 * robots.txt & sitemap.xml — SPA fallback yerine düz metin/XML
 */
const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const SEO_DIR = path.join(__dirname, "..", "seo");

function readSeoFile(name) {
    const filePath = path.join(SEO_DIR, name);
    return fs.readFileSync(filePath, "utf8");
}

const FALLBACK_ROBOTS = `User-agent: *
Allow: /
Sitemap: https://dashtock.com/sitemap.xml
`;

router.get("/robots.txt", (req, res) => {
    try {
        res.set("Content-Type", "text/plain; charset=utf-8");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(readSeoFile("robots.txt"));
    } catch (err) {
        res.status(200).type("text/plain").send(FALLBACK_ROBOTS);
    }
});

router.get("/sitemap.xml", (req, res) => {
    try {
        res.set("Content-Type", "application/xml; charset=utf-8");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(readSeoFile("sitemap.xml"));
    } catch (err) {
        res.redirect(302, "https://dashtock.com/sitemap.xml");
    }
});

module.exports = router;
