const fs = require("fs");
const p = "d:/LysiaETIC/frontend/src/pages/ProductManagementCenter.js";
let t = fs.readFileSync(p, "utf8");
const start = t.indexOf("    const renderUploadMarketplace = () => (");
const end = t.indexOf("    const renderPriceStock = () => (");
if (start < 0 || end < 0 || end <= start) {
    console.error("markers not found", start, end);
    process.exit(1);
}
const repl = `    const renderUploadMarketplace = () => (
        <UploadMarketplaceTab
            products={products}
            total={total}
            page={uploadMpPage}
            limit={LIMIT}
            loading={uploadMpLoading}
            search={uploadMpSearch}
            onSearchChange={setUploadMpSearch}
            filterPl={uploadMpFilterPl}
            onFilterPlChange={setUploadMpFilterPl}
            filterType={uploadMpFilterType}
            onFilterTypeChange={setUploadMpFilterType}
            onClearFilters={() => {
                setUploadMpSearch("");
                setUploadMpFilterPl("");
                setUploadMpFilterType("");
            }}
            onPageChange={loadUploadMpProducts}
            marketplaces={marketplaces}
            platforms={PLATFORMS}
            plShort={PL_SHORT}
            plColor={PL_COLOR}
            fmt={fmt}
            getPlStatus={getPlStatus}
            onUploadPlatform={openDistFlow}
            onOpenDetail={openDetail}
            Loading={Loading}
            Empty={Empty}
            Pagination={Pagination}
        />
    );

`;
t = t.slice(0, start) + repl + t.slice(end);
fs.writeFileSync(p, t);
console.log("OK replaced", end - start, "->", repl.length);
