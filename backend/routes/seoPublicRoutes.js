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

router.get("/robots.txt", (req, res) => {
    try {
        res.set("Content-Type", "text/plain; charset=utf-8");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(readSeoFile("robots.txt"));
    } catch (err) {
        res.status(500).type("text/plain").send("User-agent: *\nDisallow:\n");
    }
});

router.get("/sitemap.xml", (req, res) => {
    try {
        res.set("Content-Type", "application/xml; charset=utf-8");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(readSeoFile("sitemap.xml"));
    } catch (err) {
        res.status(500).type("application/xml").send('<?xml version="1.0"?><urlset/>');
    }
});

module.exports = router;
