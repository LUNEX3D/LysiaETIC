const fs = require("fs");
const path = process.argv[2];
if (!path) {
    console.error("Usage: node fix-blog-jsx.js <file>");
    process.exit(1);
}
let t = fs.readFileSync(path, "utf8");
const closeBad = "</" + "motion.div>";
const openBad = "<" + "motion.div";
const closeGood = "</" + "motion.div".replace("motion.", "");
const openGood = "<" + "motion.div".replace("motion.", "");
fs.writeFileSync(path, t.split(closeBad).join(closeGood).split(openBad).join(openGood));
console.log("motion left:", fs.readFileSync(path, "utf8").includes("motion"));
