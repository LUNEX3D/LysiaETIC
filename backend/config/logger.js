/**
 * Logger Configuration — LysiaETIC
 *
 * Log Seviyeleri:
 * - error : Kritik hatalar   (0) → Kırmızı
 * - warn  : Uyarılar         (1) → Sarı
 * - info  : Önemli bilgiler  (2) → Cyan
 * - http  : HTTP istekleri   (3) → Magenta
 * - debug : Geliştirme       (4) → Gri  (production'da kapalı)
 */

const winston = require('winston');

// ✅ FIX #14: Production'da 'info' seviyesi — stok sync ve önemli operasyon logları görünsün
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'http');

// ─── Renk tanımları ───────────────────────────────────────────────────────────
winston.addColors({
    error : 'bold red',
    warn  : 'bold yellow',
    info  : 'bold cyan',
    http  : 'magenta',
    debug : 'gray',
});

// ─── Konsol için renkli & okunabilir format ───────────────────────────────────
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        // Ek meta varsa JSON olarak ekle
        const metaStr = Object.keys(meta).length
            ? '  ' + JSON.stringify(meta, null, 0)
            : '';
        if (stack) {
            return `[${timestamp}] ${level}: ${message}\n${stack}${metaStr}`;
        }
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

// ─── Dosya için sade format ───────────────────────────────────────────────────
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length
            ? '  ' + JSON.stringify(meta)
            : '';
        if (stack) {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}${metaStr}`;
        }
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
);

// ─── Logger oluştur ───────────────────────────────────────────────────────────
const logger = winston.createLogger({
    level: LOG_LEVEL,
    levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
    transports: [
        // Konsol — renkli
        new winston.transports.Console({ format: consoleFormat }),

        // Sadece hatalar
        new winston.transports.File({
            filename : 'logs/error.log',
            level    : 'error',
            format   : fileFormat,
            maxsize  : 5242880, // 5 MB
            maxFiles : 5,
        }),

        // Tüm loglar
        new winston.transports.File({
            filename : 'logs/combined.log',
            format   : fileFormat,
            maxsize  : 5242880, // 5 MB
            maxFiles : 5,
        }),
    ],
});

// ─── Production'da console.log'ları sustur ────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    console.log   = () => {};
    console.info  = () => {};
    console.debug = () => {};
}

module.exports = logger;