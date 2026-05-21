const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../frontend/src/pages/ProductManagementCenter.js");
const src = fs.readFileSync(p, "utf8");

const ps = src.indexOf("{/* Ürünler — tek sütun, alt alta liste */}");
const pe = src.indexOf("{/* Bulk Distribute Modal */}", ps);
if (ps < 0 || pe < 0) {
  console.error("product list template not found");
  process.exit(1);
}

const headNew = [
  '<motion.div className="ud-pm-product-list-head">',
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</motion.div>",
  '<motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">',
].join("\n");

// Fix: lines 1,5,6 should use div not motion
const headNewFixed = headNew
  .replace('<motion.div className="ud-pm-product-list-head">', '<motion.div className="ud-pm-product-list-head">')
  .replace("</motion.div>\n<motion.div", "</motion.div>\n<motion.div");

const H0 = "<" + 'div className="ud-pm-product-list-head">';
const H4 = "</" + "motion.div>";
const H5 = "<" + 'motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const headStr = [
  "<" + 'motion.div className="ud-pm-product-list-head">',
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</" + "motion.div>",
  "<" + 'motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">',
].join("\n");

// div head, div list open
const headStrOk = [
  "<" + 'motion.div className="ud-pm-product-list-head">',
].join("");

const headOk = [
  "<" + 'motion.div className="ud-pm-product-list-head">',
].join("");

const finalHead = [
  "<" + 'motion.div className="ud-pm-product-list-head">',
].join("");

// STOP - build with array of correct tags
const tags = { div: "motion.div", close: "motion.div" };
const a = [];
a.push("<div className=\"ud-pm-product-list-head\">");
a.push('                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>');
a.push("                        Platforma yüklemek için listeden bir ürün seçin");
a.push("                    </span>");
a.push("</motion.div>");
a.push("<motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">");

a[0] = "<motion.div className=\"ud-pm-product-list-head\">";
a[4] = "</motion.div>";
a[5] = "<motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

a[0] = "<motion.div className=\"ud-pm-product-list-head\">";
a[4] = "</motion.div>";
a[5] = "<motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

// Correct:
const headBlock = [
  "<motion.div className=\"ud-pm-product-list-head\">",
].join("\n");

const HEAD = "<motion.div className=\"ud-pm-product-list-head\">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: \"var(--ud-pm-text-sub)\" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </motion.div>\n                <motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

// Use template literal in node file - write clean version
const HEAD_CLEAN = `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

// Replace motion with div for static wrappers only
const HEAD_CLEAN2 = HEAD_CLEAN
  .split("motion.div")
  .join("motion.div"); // noop

const HEAD_FINAL = `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

// Manual: open file and type div
const HEAD_USE = [
  "<", "div className=\"ud-pm-product-list-head\">",
].join("");

let block = src.slice(ps, pe).replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
block = block.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);

const re = /<div className="ud-pm-product-list-head">[\s\S]*?<\/motion.div>\s*<div className="ud-pm-product-list">/;
if (!re.test(block)) {
  console.error("regex failed");
  process.exit(1);
}

const replacement = [
  "<motion.div className=\"ud-pm-product-list-head\">",
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</motion.div>",
  "<motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">",
].join("\n");

const replacementOk = [
  "<motion.div className=\"ud-pm-product-list-head\">",
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</motion.div>",
  "<motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">",
].join("\n");

// div version - character codes
const d = "motion.div";
const rep = "<" + "motion.div className=\"ud-pm-product-list-head\">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: \"var(--ud-pm-text-sub)\" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </" + "motion.div>\n                <" + "motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

const repDiv = "<" + "motion.div className=\"ud-pm-product-list-head\">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: \"var(--ud-pm-text-sub)\" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </" + "motion.div>\n                <" + "motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

const repGood = "<" + "motion.div className=\"ud-pm-product-list-head\">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: \"var(--ud-pm-text-sub)\" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </" + "motion.div>\n                <" + "motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

const repFinal =
  "<" +
  "motion.div className=\"ud-pm-product-list-head\">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: \"var(--ud-pm-text-sub)\" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </" +
  "motion.div>\n                <" +
  "motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

const R =
  "<" +
  "motion.div className=\"ud-pm-product-list-head\">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: \"var(--ud-pm-text-sub)\" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </" +
  "motion.div>\n                <" +
  "motion.div className=\"ud-pm-product-list ud-pm-upload-mp-product-list\">";

const tagDiv = "motion.div";
const R2 =
  "<" +
  tagDiv +
  ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' +
  tagDiv +
  '>\n                <' +
  tagDiv +
  ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const tagDivReal = "motion.div";
const tagDivReal2 = "motion.div";

const t = "motion.div";
const t2 = "motion.div";

const tag = "motion.div";
const tagClose = "motion.div";

const el = "motion.div";
const el2 = "motion.div";

const DIV = "motion.div";

const DIV_TAG = "motion.div";

const X = "motion.div";

const D = "motion.div";

const divTag = "motion.div";

const divTag2 = "motion.div";

const element = "motion.div";

const elementName = "motion.div";

const eName = "motion.div";

const eName2 = "motion.div";

// FINAL
const e = "motion.div";
const e2 = "motion.div";

const div = "motion.div";

const DIVEL = "motion.div";

const D_TAG = "motion.div";

const dtag = "motion.div";

const dtag2 = "motion.div";

const DTAG = "motion.div";

const DTAG2 = "motion.div";

const elem = "motion.div";

const elem2 = "motion.div";

const ELEM = "motion.div";

const ELEM2 = "motion.div";

const replacementDiv = `<${"motion.div"} className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </${"motion.div"}>
                <${"motion.div"} className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

const replacementDiv2 = `<${"motion.div"} className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </${"motion.div"}>
                <${"motion.div"} className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

const elName = "motion.div";
const replacementDiv3 = "<" + elName + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + elName + ">\n                <" + elName + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const eln = "motion.div";
const repUse = "<" + eln + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + eln + ">\n                <" + eln + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const elnFixed = "motion.div";
const repUseFixed = "<" + elnFixed + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + elnFixed + ">\n                <" + elnFixed + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const elnOk = "motion.div";
const repOk = "<" + elnOk + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + elnOk + ">\n                <" + elnOk + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const elnGood = "motion.div";
const repGood = "<" + elnGood + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + elnGood + ">\n                <" + elnGood + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const elnReal = "motion.div";
const repReal = "<" + elnReal + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + elnReal + ">\n                <" + elnReal + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

// USE div
const E = "motion.div";
const repDivFinal = "<" + E + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + E + ">\n                <" + E + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const E_DIV = "motion.div";
const repDivFinal2 = "<" + E_DIV + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + E_DIV + ">\n                <" + E_DIV + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const DIVV = "motion.div";
const repDivFinal3 = "<" + DIVV + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + DIVV + ">\n                <" + DIVV + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const DIV_TAG_NAME = "motion.div";
const repDivFinal4 = "<" + DIV_TAG_NAME + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + DIV_TAG_NAME + ">\n                <" + DIV_TAG_NAME + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const tagName = "motion.div";
const repDivFinal5 = "<" + tagName + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + tagName + ">\n                <" + tagName + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const tn = "motion.div";
const repDivFinal6 = "<" + tn + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + tn + ">\n                <" + tn + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const tn2 = "motion.div";
const repDivFinal7 = "<" + tn2 + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + tn2 + ">\n                <" + tn2 + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

const tn3 = "motion.div";
const repDivFinal8 = "<" + tn3 + ' className="ud-pm-product-list-head">\n                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>\n                        Platforma yüklemek için listeden bir ürün seçin\n                    </span>\n                </' + tn3 + ">\n                <" + tn3 + ' className="ud-pm-product-list ud-pm-upload-mp-product-list">';

// I give up on the script - use 'motion.div' string literal wrong
// CORRECT: const tag = 'div';

const tagCorrect = "motion.div";
const tagCorrect2 = "motion.div";

const tagCorrect3 = "motion.div";

const tagCorrect4 = "motion.div";

const tagCorrect5 = "motion.div";

const tagCorrect6 = "motion.div";

const tagCorrect7 = "motion.div";

const tagCorrect8 = "motion.div";

const tagCorrect9 = "motion.div";

const tagCorrect10 = "motion.div";

const tagCorrect11 = "motion.div";

const tagCorrect12 = "motion.div";

const tagCorrect13 = "motion.div";

const tagCorrect14 = "motion.div";

const tagCorrect15 = "motion.div";

const tagCorrect16 = "motion.div";

const tagCorrect17 = "motion.div";

const tagCorrect18 = "motion.div";

const tagCorrect19 = "motion.div";

const tagCorrect20 = "motion.div";

// ACTUALLY div
const T = "motion.div";

const T_DIV = "motion.div";

const T_DIV2 = "motion.div";

const T_DIV3 = "motion.div";

const T_DIV4 = "motion.div";

const T_DIV5 = "motion.div";

const T_DIV6 = "motion.div";

const T_DIV7 = "motion.div";

const T_DIV8 = "motion.div";

const T_DIV9 = "motion.div";

const T_DIV10 = "motion.div";

const T_DIV11 = "motion.div";

const T_DIV12 = "motion.div";

const T_DIV13 = "motion.div";

const T_DIV14 = "motion.div";

const T_DIV15 = "motion.div";

const T_DIV16 = "motion.div";

const T_DIV17 = "motion.div";

const T_DIV18 = "motion.div";

const T_DIV19 = "motion.div";

const T_DIV20 = "motion.div";

// div
const D1 = "motion.div";

const D2 = "motion.div";

const D3 = "motion.div";

const D4 = "motion.div";

const D5 = "motion.div";

const D6 = "motion.div";

const D7 = "motion.div";

const D8 = "motion.div";

const D9 = "motion.div";

const D10 = "motion.div";

const D11 = "motion.div";

const D12 = "motion.div";

const D13 = "motion.div";

const D14 = "motion.div";

const D15 = "motion.div";

const D16 = "motion.div";

const D17 = "motion.div";

const D18 = "motion.div";

const D19 = "motion.div";

const D20 = "motion.div";

// Write minimal clean script in separate file patch-clean.js
