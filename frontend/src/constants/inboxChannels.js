export const INBOX_CHANNELS = [
    {
        id: "instagram",
        label: "Instagram",
        type: "meta",
        connectTitle: "Instagram Profilinizi Bağlayın",
        connectHint:
            'Instagram DM\'lerinizi yönetmek için Meta üzerinden giriş yapın ve mesaj izinlerini onaylayın.',
        connectButton: "Instagram ile Giriş Yap",
        color: "#E1306C",
        manageDescription: "Instagram DM'lerinizi Dashtock'tan yönetin.",
    },
    {
        id: "whatsapp",
        label: "WhatsApp",
        type: "meta",
        connectTitle: "WhatsApp Business Bağlayın",
        connectHint:
            "Facebook sayfanıza bağlı WhatsApp Business hesabı gerekir. Meta girişi ile numaranızı bağlayın.",
        connectButton: "WhatsApp ile Devam Et",
        color: "#25D366",
        manageDescription: "WhatsApp mesajlarınızı tek ekrandan yönetin.",
    },
    {
        id: "facebook",
        label: "Facebook",
        type: "meta",
        connectTitle: "Facebook Sayfanızı Bağlayın",
        connectHint: "Facebook Messenger mesajlarını gelen kutusunda görüntülemek için Meta ile giriş yapın.",
        connectButton: "Facebook ile Devam Et",
        color: "#1877F2",
        manageDescription: "Facebook sayfa mesajlarını görüntüleyin ve yanıtlayın.",
    },
    {
        id: "form",
        label: "Form",
        type: "internal",
        connectTitle: "Mağaza Formunu Etkinleştirin",
        connectHint: "Mağaza iletişim formundan gelen mesajlar otomatik olarak gelen kutusuna düşer.",
        connectButton: "Formu Etkinleştir",
        color: "#7C3AED",
        manageDescription: "Mağaza formundan gelen mesajları yönetin.",
    },
    {
        id: "email",
        label: "Email",
        type: "internal",
        connectTitle: "E-posta Kanalını Bağlayın",
        connectHint:
            "Gmail ile tek tıkla giriş yapın veya IMAP ile posta kutunuzu bağlayın. Kolay mod yalnızca mağaza formu içindir; gelen kutusu senkronu yapmaz.",
        connectButton: "E-postayı Bağla",
        color: "#F97316",
        manageDescription: "E-posta destek kanalınızı etkinleştirin.",
        needsEmail: true,
    },
    {
        id: "livechat",
        label: "Live Chat",
        type: "internal",
        connectTitle: "Canlı Sohbeti Etkinleştirin",
        connectHint: "Mağaza vitrinindeki canlı sohbet widget'ından gelen mesajlar burada toplanır.",
        connectButton: "Canlı Sohbeti Aç",
        color: "#0EA5E9",
        manageDescription: "Web sitenizde canlı sohbet mesajlarını yönetin.",
    },
    {
        id: "amazon",
        label: "Amazon",
        type: "marketplace",
        connectTitle: "Amazon Hesabınızı Bağlayın",
        connectHint: "Pazaryeri entegrasyonunuzdaki Amazon hesabı kullanılır. Önce Entegrasyonlar'dan Amazon bağlayın.",
        connectButton: "Amazon'u Gelen Kutusuna Bağla",
        color: "#FF9900",
        manageDescription: "Amazon satıcı mesajlarını tek yerden yönetin.",
    },
    {
        id: "trendyol",
        label: "Trendyol",
        type: "marketplace",
        connectTitle: "Trendyol Soru-Cevap Bağlayın",
        connectHint: "Pazaryeri entegrasyonunuzdaki Trendyol API bilgileri ile müşteri soruları senkronize edilir.",
        connectButton: "Trendyol'u Gelen Kutusuna Bağla",
        color: "#F27A1A",
        manageDescription: "Trendyol müşteri sorularını yanıtlayın.",
    },
];

export function getInboxChannel(id) {
    return INBOX_CHANNELS.find((c) => c.id === id);
}

export const META_CHANNEL_IDS = ["instagram", "facebook", "whatsapp"];
