import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const exclude = ["node_modules", ".git", "PazarYonet-Logo-Pack", "package-lock.json"];
const exts = new Set([
    ".js", ".jsx", ".css", ".html", ".json", ".xml", ".txt", ".conf", ".mjs", ".example", ".ps1",
]);
const reps = [
    ["PazarYonet", "Dashtock"],
    ["PAZARYONET", "DASHTOCK"],
    ["pazaryonet-logo", "dashtock-logo"],
    ["pazaryonet.com", "dashtock.com"],
    ["pazaryonetim.com", "dashtock.com"],
    ["py-brand-logo", "ds-brand-logo"],
];

let updated = 0;

function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        const rel = path.relative(root, p);
        if (exclude.some((e) => rel.includes(e))) continue;
        if (ent.isDirectory()) {
            walk(p);
            continue;
        }
        const ext = path.extname(ent.name);
        if (!exts.has(ext) && !ent.name.endsWith(".example")) continue;
        let c = fs.readFileSync(p, "utf8");
        const o = c;
        for (const [a, b] of reps) c = c.split(a).join(b);
        if (c !== o) {
            fs.writeFileSync(p, c);
            updated += 1;
        }
    }
}

walk(root);
console.log(`Updated ${updated} files`);
