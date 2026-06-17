import {
    FaInstagram,
    FaFacebook,
    FaWhatsapp,
    FaShoppingBag,
    FaAmazon,
    FaEnvelope,
    FaComments,
    FaFileAlt,
} from "react-icons/fa";
import { getInboxChannel } from "../../../constants/inboxChannels";

const CHANNEL_UI = {
    instagram: { label: "Instagram", color: "#E1306C", Icon: FaInstagram },
    facebook: { label: "Facebook", color: "#1877F2", Icon: FaFacebook },
    whatsapp: { label: "WhatsApp", color: "#25D366", Icon: FaWhatsapp },
    trendyol: { label: "Trendyol", color: "#F27A1A", Icon: FaShoppingBag },
    amazon: { label: "Amazon", color: "#FF9900", Icon: FaAmazon },
    email: { label: "E-posta", color: "#F97316", Icon: FaEnvelope },
    livechat: { label: "Canlı Sohbet", color: "#0EA5E9", Icon: FaComments },
    form: { label: "Form", color: "#7C3AED", Icon: FaFileAlt },
};

export function getChannelUi(channelId) {
    const ch = getInboxChannel(channelId);
    const base = CHANNEL_UI[channelId] || { label: channelId, color: "#94a3b8", Icon: FaComments };
    return { ...base, channel: ch };
}

const TRENDYOL_STATUS_TR = {
    WAITING_FOR_ANSWER: "Cevap bekliyor",
    ANSWERED: "Cevaplandı",
    WAITING_FOR_APPROVE: "Onay bekliyor",
    REJECTED: "Reddedildi",
    REPORTED: "Raporlandı",
};

export function trendyolStatusLabel(status) {
    if (!status) return "";
    return TRENDYOL_STATUS_TR[status] || status;
}
