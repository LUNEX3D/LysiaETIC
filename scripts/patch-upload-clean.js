const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../frontend/src/pages/ProductManagementCenter.js");
const src = fs.readFileSync(p, "utf8");

const ps = src.indexOf("{/* Ürünler — tek sütun, alt alta liste */}");
const pe = src.indexOf("{/* Bulk Distribute Modal */}", ps);
let block = src.slice(ps, pe).replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
block = block.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);

const headRep = `<div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

block = block.replace(
  /<div className="ud-pm-product-list-head">[\s\S]*?<\/motion.div>\s*<div className="ud-pm-product-list">/,
  headRep
);

// fix typo in headRep - list open should be div
block = block.replace(
  /<div className="ud-pm-product-list-head">[\s\S]*?<\/motion.div>\s*<div className="ud-pm-product-list">/,
  `<div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

// Start over
block = src.slice(ps, pe).replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
block = block.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);

const headOk = `<div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

// Fix headOk - use div for closing head and opening list
const headOk2 = headOk
  .replace("                </motion.div>\n                <motion.div className=\"ud-pm-product-list", "                </motion.div>\n                <motion.div className=\"ud-pm-product-list");

const HEAD = [
  '<div className="ud-pm-product-list-head">',
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</div>",
  '<motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">',
].join("\n");

block = block.replace(
  /<div className="ud-pm-product-list-head">[\s\S]*?<\/motion.div>\s*<div className="ud-pm-product-list">/,
  HEAD
);

block = block
  .replace(/\{loading \?/g, "{uploadMpLoading ?")
  .replace(/const isSel = selected\.has\(p\._id\);/g, "const isActive = uploadMpProduct?._id === p._id;")
  .replace(/isSel \? "selected"/g, 'isActive ? "selected"')
  .replace(/onClick=\{\(\) => openDetail\(p\._id\)\}/g, "onClick={() => selectUploadMpProduct(p)}")
  .replace(/openDetail\(p\._id\)/g, "selectUploadMpProduct(p)")
  .replace(
    /\s*<div className="ud-pm-product-list-item-check" onClick=\{\(e\) => e\.stopPropagation\(\)\}>[\s\S]*?<\/motion.div>\s*/,
    "\n"
  )
  .replace(
    /<button type="button" className="ud-pm-btn sm accent outline" onClick=\{\(\) => openDetail\(p\._id\)\}><FaEye \/><\/button>\s*<button type="button" className="ud-pm-btn sm red outline" onClick=\{\(\) => askDelete\(p\._id\)\}><FaTrash \/><\/button>/,
    '<button type="button" className={`ud-pm-btn sm ${isActive ? "accent" : "accent outline"}`} onClick={() => selectUploadMpProduct(p)}>{isActive ? <><FaCheck /> Seçili</> : <><FaCloudUploadAlt /> Seç</>}</button>'
  )
  .replace(
    '<Empty icon={FaBox} title="Ürün bulunamadı" desc="Pazaryerlerinden çekin veya yeni ekleyin" />',
    '<Empty icon={FaBox} title="Ürün bulunamadı" desc="Filtreleri değiştirin veya kataloga ürün ekleyin" />'
  )
  .replace(
    "<Pagination currentPage={page} totalPages={totalPages} total={total} onPageChange={p => loadProducts(p)} />",
    "<Pagination currentPage={uploadMpPage} totalPages={Math.ceil(total / LIMIT)} total={total} onPageChange={loadUploadMpProducts} />"
  );

const lines = src.split(/\r?\n/);
const s = lines.findIndex((l) => l.includes("/* Sol: Ürün Listesi */"));
const e = lines.findIndex((l) => l.includes("/* Sağ: Pazaryeri Dağıtım Paneli */"));
let result = [...lines.slice(0, s), ...block.split("\n"), ...lines.slice(e)].join("\n");

// Close ud-pm-upload-mp-page wrapper
result = result.replace(
  /(\n        <\/motion.div>\n    \);\n\n    const renderPriceStock)/,
  "\n        </motion.div>\n        </motion.div>\n    );\n\n    const renderPriceStock"
);

result = result.replace(
  /(\n        <\/motion.div>\n    \);\n\n    const renderPriceStock)/,
  "\n        </motion.div>\n        </motion.div>\n    );\n\n    const renderPriceStock"
);

// Fix double close - only add if missing
const seg = result.match(/const renderUploadMarketplace[\s\S]*?const renderPriceStock/)[0];
const pageOpens = (seg.match(/ud-pm-upload-mp-page/g) || []).length;
if (!seg.includes('</motion.div>\n        </motion.div>\n    );')) {
  result = result.replace(
    /(\n            <\/motion.div>\n        <\/motion.div>\n    \);\n\n    const renderPriceStock)/,
    "\n            </motion.div>\n        </motion.div>\n        </motion.div>\n    );\n\n    const renderPriceStock"
  );
}

// Simpler close: before renderPriceStock, ensure page div closed
result = result.replace(
  /(\s+<\/motion.div>\n)(\s+<\/motion.div>\n    \);\n\n    const renderPriceStock =)/,
  "$1        </motion.div>\n$2"
);

fs.writeFileSync(p, result);
console.log("done", block.includes("ud-pm-upload-mp-product-list"), HEAD.includes("ud-pm-product-list"));
