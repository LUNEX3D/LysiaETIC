const fs = require("fs");
const path = require("path");

const pmPath = path.join(__dirname, "../frontend/src/pages/ProductManagementCenter.js");
const src = fs.readFileSync(pmPath, "utf8");

const prodStart = src.indexOf("{/* Ürünler — tek sütun, alt alta liste */}");
const prodEnd = src.indexOf("{/* Bulk Distribute Modal */}", prodStart);
if (prodStart < 0 || prodEnd < 0) {
  console.error("template not found");
  process.exit(1);
}

let block = src.slice(prodStart, prodEnd).replace("{/* Ürünler — tek sütun, alt alta liste */}\n            ", "            ");
block = block.replace(
  'className="ud-pm-product-list-wrap ud-pm-card"',
  'className="ud-pm-product-list-wrap ud-pm-card ud-pm-upload-mp-list-panel"'
);

const headHtml = [
  '<div className="ud-pm-product-list-head">',
  '                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ud-pm-text-sub)" }}>',
  "                        Platforma yüklemek için listeden bir ürün seçin",
  "                    </span>",
  "</div>",
  '<div className="ud-pm-product-list ud-pm-upload-mp-product-list">',
].join("\n");

block = block.replace(
  /<div className="ud-pm-product-list-head">[\s\S]*?<\/div>\s*<div className="ud-pm-product-list">/,
  headHtml
);

block = block
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

const lines = src.split(/\r?\n/);
const s = lines.findIndex((l) => l.includes("/* Sol: Ürün Listesi */"));
const e = lines.findIndex((l) => l.includes("/* Sağ: Pazaryeri Dağıtım Paneli */"));
if (s < 0 || e < 0) {
  console.error("markers not found", s, e);
  process.exit(1);
}

let result = [...lines.slice(0, s), ...block.split("\n"), ...lines.slice(e)].join("\n");

const closeFix =
  /(\n            <\/div>\n        <\/div>\n    \);\n\n    const renderPriceStock = \(\) =>)/;
if (closeFix.test(result)) {
  result = result.replace(
    closeFix,
    "\n            </div>\n        </div>\n        </div>\n    );\n\n    const renderPriceStock = () =>"
  );
} else {
  console.warn("close tag pattern not matched");
}

fs.writeFileSync(pmPath, result);
console.log("ok", block.includes("ud-pm-upload-mp-product-list"));
