import React from "react";
import { Chip } from "@mui/material";

const STATUS_MAP = {
    draft: { label: "Taslak", color: "default" },
    published: { label: "Yayında", color: "success" },
    suspended: { label: "Askıda", color: "error" },
    archived: { label: "Arşiv", color: "default" },
    pending_dns: { label: "DNS bekliyor", color: "warning" },
    dns_verified: { label: "DNS doğrulandı", color: "info" },
    ssl_provisioning: { label: "SSL hazırlanıyor", color: "info" },
    active: { label: "Aktif", color: "success" },
    failed: { label: "Hata", color: "error" },
    expired: { label: "SSL süresi doldu", color: "error" },
};

export default function WBStatusChip({ status, size = "small", ...rest }) {
    const cfg = STATUS_MAP[status] || { label: status || "—", color: "default" };
    return <Chip label={cfg.label} color={cfg.color} size={size} {...rest} />;
}
