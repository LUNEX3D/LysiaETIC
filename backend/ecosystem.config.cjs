/**
 * PM2 — AWS EC2 production
 * Kullanım: cd backend && pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
    apps: [
        {
            name: "backend",
            script: "server.js",
            cwd: __dirname,
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            max_restarts: 15,
            min_uptime: "10s",
            max_memory_restart: "800M",
            env: {
                NODE_ENV: "production",
            },
            error_file: "~/.pm2/logs/backend-error.log",
            out_file: "~/.pm2/logs/backend-out.log",
            merge_logs: true,
            time: true,
        },
    ],
};
