/**
 * Pazarlama — sidebar menü (ikas + genişletilmiş)
 */
export const MARKETING_NAV = [
    { id: "mkt-dashboard", labelTr: "Genel bakış", labelEn: "Overview" },
    {
        id: "mkt-campaigns-group",
        labelTr: "Kampanyalar",
        labelEn: "Campaigns",
        children: [
            { id: "mkt-campaigns-email", labelTr: "E-posta gönder", labelEn: "Email" },
            { id: "mkt-campaigns-sms", labelTr: "SMS gönder", labelEn: "SMS" },
        ],
    },
    { id: "mkt-automations", labelTr: "Otomatik mesajlar", labelEn: "Automations" },
    { id: "mkt-segments", labelTr: "Müşteri grupları", labelEn: "Segments" },
    { id: "mkt-popups", labelTr: "Vitrin popup", labelEn: "Popups" },
    { id: "mkt-affiliate", labelTr: "Ortaklık programı", labelEn: "Affiliate" },
    { id: "mkt-reports", labelTr: "Sonuçlar", labelEn: "Reports" },
    { id: "mkt-settings", labelTr: "Kurulum", labelEn: "Settings" },
];

export const MARKETING_DEFAULT_PANEL = "mkt-dashboard";

export function buildMarketingSubmenu(language = "tr") {
    const en = language === "en";
    return MARKETING_NAV.map((item) => {
        if (item.children) {
            return {
                id: item.id,
                label: en ? item.labelEn : item.labelTr,
                children: item.children.map((c) => ({
                    id: c.id,
                    label: en ? c.labelEn : c.labelTr,
                })),
            };
        }
        return { id: item.id, label: en ? item.labelEn : item.labelTr };
    });
}

export function isMarketingPanel(panelId) {
    if (!panelId) return false;
    if (panelId === "marketing") return true;
    if (panelId.startsWith("mkt-")) return true;
    if (panelId.startsWith("mkt-automation-")) return true;
    return false;
}
