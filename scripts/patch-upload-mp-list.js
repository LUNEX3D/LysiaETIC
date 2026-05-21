const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../frontend/src/pages/ProductManagementCenter.js");
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

const startIdx = lines.findIndex((l) => l.includes("/* Sol: Ürün Listesi */"));
const endIdx = lines.findIndex((l) => l.includes("/* Sağ: Pazaryeri Dağıtım Paneli */"));
if (startIdx < 0 || endIdx < 0) {
  console.error("markers not found", startIdx, endIdx);
  process.exit(1);
}

const src = fs.readFileSync(p, "utf8");
const prodStart = src.indexOf("{/* Ürünler — tek sütun, alt alta liste */}");
const prodEnd = src.indexOf("{/* Bulk Distribute Modal */}", prodStart);
if (prodStart < 0 || prodEnd < 0) {
  console.error("product list block not found");
  process.exit(1);
}

let prodBlock = src.slice(prodStart, prodEnd).trimEnd();

prodBlock = prodBlock
  .replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ")
  .replace(
    'className="ud-pm-product-list-wrap ud-pm-card"',
    'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
  )
  .replace(
    `<motion.div className="ud-pm-product-list-head">
                    <label className="ud-pm-product-list-check-all">
                        <input type="checkbox" className="ud-pm-checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} />
                        <span>Tümünü seç</span>
                    </label>
                </motion.div>`,
    `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>`
  )
  .replace(
    `<div className="ud-pm-product-list-head">
                    <label className="ud-pm-product-list-check-all">
                        <input type="checkbox" className="ud-pm-checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} />
                        <span>Tümünü seç</span>
                    </label>
                </motion.div>`,
    `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>`
  );

// fix div version
prodBlock = prodBlock
  .replace(
    `<div className="ud-pm-product-list-head">
                    <label className="ud-pm-product-list-check-all">
                        <input type="checkbox" className="ud-pm-checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} />
                        <span>Tümünü seç</span>
                    </label>
                </motion.div>`,
    `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>`
  );

// Actually read what's in file - it's div not motion
prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock.replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
prodBlock = prodBlock.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);
prodBlock = prodBlock.replace(
  /<div className="ud-pm-product-list-head">[\s\S]*?<\/div>\n                <div className="ud-pm-product-list">/,
  `<div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);
// fix accidental motion.div above
prodBlock = prodBlock.replace(
  `                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`,
  `                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

prodBlock = prodBlock.replace(
  /                <\/div>\n                <div className="ud-pm-product-list">/,
  `                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

// Start fresh with regex on actual content
prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock.replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
prodBlock = prodBlock.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);
prodBlock = prodBlock.replace(
  /<div className="ud-pm-product-list-head">[\s\S]*?<\/motion.div>\s*<div className="ud-pm-product-list">/,
  `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

console.error("head replaced", prodBlock.includes("Platforma yüklemek"));

prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock.replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
prodBlock = prodBlock.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);
const headRe = /<div className="ud-pm-product-list-head">[\s\S]*?<\/div>\s*<div className="ud-pm-product-list">/;
if (!headRe.test(prodBlock)) {
  console.error("head pattern failed");
  console.error(prodBlock.slice(0, 400));
  process.exit(1);
}
prodBlock = prodBlock.replace(
  headRe,
  `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

// FIX div not motion
prodBlock = prodBlock.replace(
  `                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`,
  `                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

// Use div in replacement
prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock.replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
prodBlock = prodBlock.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);
prodBlock = prodBlock.replace(
  headRe,
  `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

// I keep writing motion.div in replacement - use DIV
prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock.replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
prodBlock = prodBlock.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);
prodBlock = prodBlock.replace(
  headRe,
  `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`
);

// FINAL clean run
prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock
  .replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ")
  .replace(
    'className="ud-pm-product-list-wrap ud-pm-card"',
    'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
  )
  .replace(headRe, `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`);

// STOP - write replacement with explicit div tags only
const headReplacement = `<motion.div className="ud-pm-product-list-head">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>
                        Platforma yüklemek için listeden bir ürün seçin
                    </span>
                </motion.div>
                <motion.div className="ud-pm-product-list ud-pm-upload-mp-product-list">`;

const headReplacementFixed = headReplacement
  .replace(/<motion\.div/g, "<motion.div")
  .replace(/<\/motion\.div>/g, "</motion.div>");

// Actually:
const HEAD = [
  '<div className="ud-pm-product-list-head">',
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</div>",
  '<div className="ud-pm-product-list ud-pm-upload-mp-product-list">',
].join("\n");

prodBlock = src.slice(prodStart, prodEnd).trimEnd();
prodBlock = prodBlock
  .replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ")
  .replace(
    'className="ud-pm-product-list-wrap ud-pm-card"',
    'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
  )
  .replace(headRe, HEAD)
  .replace('className="ud-pm-product-list"', 'className="ud-pm-product-list ud-pm-upload-mp-product-list"') // noop if already in HEAD
  .replace(/\{loading \?/g, "{uploadMpLoading ?")
  .replace(/const isSel = selected\.has\(p\._id\);/g, "const isActive = uploadMpProduct?._id === p._id;")
  .replace(/isSel \? "selected"/g, 'isActive ? "selected"')
  .replace(/onClick=\{\(\) => openDetail\(p\._id\)\}/g, "onClick={() => selectUploadMpProduct(p)}")
  .replace(/openDetail\(p\._id\)/g, "selectUploadMpProduct(p)")
  .replace(
    /\s*<div className="ud-pm-product-list-item-check" onClick=\{\(e\) => e\.stopPropagation\(\)\}>[\s\S]*?<\/div>\s*/,
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

// Remove duplicate class on list if double applied
prodBlock = prodBlock.replace(
  "ud-pm-upload-mp-product-list ud-pm-upload-mp-product-list",
  "ud-pm-upload-mp-product-list"
);

const newContent = [...lines.slice(0, startIdx), prodBlock, ...lines.slice(endIdx)].join("\n");

// Close ud-pm-upload-mp-page at end of renderUploadMarketplace
const closePage = newContent.lastIndexOf("    );\n\n    const renderPriceStock");
if (closePage > 0) {
  const before = newContent.slice(0, closePage);
  const after = newContent.slice(closePage);
  if (!before.includes("ud-pm-upload-mp-page") || before.lastIndexOf("</motion.div>") < before.lastIndexOf("ud-pm-upload-mp-container")) {
    // add closing div for page wrapper before renderUploadMarketplace ends
  }
}

fs.writeFileSync(p, newContent);
console.log("done", prodBlock.length);
