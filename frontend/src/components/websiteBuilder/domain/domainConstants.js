export const STATUS_STEPS = ["DNS kaydı", "DNS doğrulandı", "SSL hazırlanıyor", "Yayında"];

export const STATUS_STEP_MAP = {
    pending_dns: 0,
    dns_verified: 1,
    ssl_provisioning: 2,
    active: 3,
    failed: 0,
    expired: 2,
};

export const STATUS_CONFIG = {
    pending_dns: { label: "DNS bekleniyor", color: "warning", description: "TXT doğrulama kaydı eklenmeli" },
    dns_verified: { label: "DNS doğrulandı", color: "info", description: "CNAME kaydı bekleniyor" },
    ssl_provisioning: { label: "SSL hazırlanıyor", color: "info", description: "Sertifika otomatik üretiliyor" },
    active: { label: "Yayında", color: "success", description: "Özel domain ile erişilebilir" },
    failed: { label: "Başarısız", color: "error", description: "DNS veya SSL doğrulaması başarısız" },
    expired: { label: "SSL süresi doldu", color: "error", description: "Yenileme gerekli" },
};

export const SSL_STATUS_LABELS = {
    none: "Yok",
    pending: "Bekliyor",
    active: "Aktif",
    renewing: "Yenileniyor",
    expired: "Süresi doldu",
    failed: "Hata",
};
