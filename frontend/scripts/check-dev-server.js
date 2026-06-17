/**
 * Port 3000 doluysa eski dev sunucusu uyarısı (npm start öncesi).
 */
const net = require("net");

const port = Number(process.env.PORT) || 3000;

function isPortBusy(p) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(true));
        server.once("listening", () => {
            server.close();
            resolve(false);
        });
        server.listen(p, "127.0.0.1");
    });
}

isPortBusy(port).then((busy) => {
    if (!busy) return;
    console.warn("");
    console.warn(`[Lysia] Port ${port} kullanımda — eski "react-scripts start" süreci hâlâ açık olabilir.`);
    console.warn("[Lysia] Eski terminalde Ctrl+C yapın veya Görev Yöneticisi'nden node.exe'yi kapatın.");
    console.warn("[Lysia] CRACO ile temiz başlangıç için: npm start  (script: craco start)");
    console.warn("");
});
