/**
 * Logger Configuration
 *
 * Log Seviyeleri:
 * - error: Kritik hatalar (0)
 * - warn: Uyarılar (1)
 * - info: Önemli bilgiler (2)
 * - debug: Geliştirme logları (3) - Production'da kapalı
 */

const winston = require('winston');

// Ortam değişkeninden log seviyesini al (varsayılan: 'warn')
const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';

// Custom format: sadece önemli bilgileri göster
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
        }
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
);

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: customFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        }),
        // Hataları ayrı bir dosyaya kaydet
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Tüm logları kaydet
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Production'da console.log'ları devre dışı bırak
if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
}

module.exports = logger;