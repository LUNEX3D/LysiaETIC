/**
 * Windows: belirtilen portu dinleyen node sürecini sonlandırır.
 * Kullanım: node scripts/kill-port.js 3000
 */
const { execSync } = require("child_process");

const port = String(process.argv[2] || 3000);

function killOnWindows() {
    try {
        const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
        const pids = new Set();
        out.split("\n").forEach((line) => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
        });
        if (!pids.size) {
            console.log(`[Lysia] Port ${port} zaten boş.`);
            return;
        }
        pids.forEach((pid) => {
            try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
                console.log(`[Lysia] Port ${port} — PID ${pid} kapatıldı.`);
            } catch {
                /* already gone */
            }
        });
    } catch {
        console.log(`[Lysia] Port ${port} zaten boş.`);
    }
}

if (process.platform === "win32") {
    killOnWindows();
} else {
    try {
        execSync(`npx --yes kill-port ${port}`, { stdio: "inherit" });
    } catch {
        console.log(`[Lysia] Port ${port} kapatılamadı veya zaten boş.`);
    }
}
