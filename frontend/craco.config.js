/**
 * CRA webpack özelleştirmeleri:
 * - html5-qrcode source-map-loader uyarıları (node_modules)
 * - ESLint webpack eklentisi kapalı (npm run lint ayrı)
 */
module.exports = {
    eslint: {
        enable: false,
    },
    webpack: {
        configure: (webpackConfig) => {
            // source-map-loader node_modules'ta kırık .ts referansları üretiyor
            webpackConfig.module.rules = webpackConfig.module.rules.filter((rule) => {
                if (rule.enforce !== "pre" || !rule.use) return true;
                const uses = Array.isArray(rule.use) ? rule.use : [rule.use];
                return !uses.some((u) => {
                    const loader = u?.loader || u;
                    return typeof loader === "string" && loader.includes("source-map-loader");
                });
            });

            webpackConfig.ignoreWarnings = [
                ...(webpackConfig.ignoreWarnings || []),
                /Failed to parse source map/,
                (warning) => {
                    const msg = warning?.message || warning;
                    return typeof msg === "string" && msg.includes("Failed to parse source map");
                },
            ];
            return webpackConfig;
        },
    },
};
