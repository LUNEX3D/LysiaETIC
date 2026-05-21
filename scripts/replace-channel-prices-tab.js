const fs = require("fs");
const p = "d:/LysiaETIC/frontend/src/pages/ProductManagementCenter.js";
let t = fs.readFileSync(p, "utf8");
const start = t.indexOf("    const renderChannelPrices = () => {");
const end = t.indexOf("    const renderProducts = () => (");
if (start < 0 || end < 0 || end <= start) {
    console.error("markers not found", start, end);
    process.exit(1);
}
const repl = `    const renderChannelPrices = () => (
        <ChannelPricesTab
            products={chTabProducts}
            total={chTabTotal}
            page={chTabPage}
            limit={LIMIT}
            loading={chTabLoading}
            search={chTabSearch}
            onSearchChange={setChTabSearch}
            onPageChange={loadChTabProducts}
            platforms={PLATFORMS}
            plShort={PL_SHORT}
            plColor={PL_COLOR}
            fmt={fmt}
            getPlMappingAny={getPlMappingAny}
            getChRowDraft={getChRowDraft}
            setChEditField={setChEditField}
            saveChLocal={saveChLocal}
            pushChPrice={pushChPrice}
            fillChRowFromMaster={fillChRowFromMaster}
            resetChRowDraft={resetChRowDraft}
            chRowAction={chRowAction}
            Loading={Loading}
            Empty={Empty}
            Pagination={Pagination}
        />
    );

`;
t = t.slice(0, start) + repl + t.slice(end);
fs.writeFileSync(p, t);
console.log("OK", end - start, "->", repl.length);
