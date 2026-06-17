export const INBOX_SEARCH_SCOPES = [
    { id: "all", label: "Tüm alanlar" },
    { id: "product", label: "Ürün adı" },
    { id: "customer", label: "Müşteri" },
    { id: "message", label: "Mesaj metni" },
];

export const INBOX_CHANNEL_FILTER_ALL = "all";

export const INBOX_STATUS_FILTERS = [
    { id: "all", label: "Tüm durumlar" },
    { id: "WAITING_FOR_ANSWER", label: "Cevap bekliyor" },
    { id: "ANSWERED", label: "Cevaplandı" },
    { id: "WAITING_FOR_APPROVE", label: "Onay bekliyor" },
    { id: "REJECTED", label: "Reddedildi" },
];

export function conversationTimestamp(c) {
    const raw = c?.lastMessageAt || c?.updatedAt || c?.createdAt;
    const t = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
}

/** En yeni konuşma her zaman üstte */
export function sortConversationsNewestFirst(list) {
    return [...(list || [])].sort((a, b) => conversationTimestamp(b) - conversationTimestamp(a));
}

function matchText(haystack, needle) {
    return String(haystack || "").toLowerCase().includes(needle);
}

export function matchesInboxSearch(conversation, query, scope) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;

    const productName = conversation?.context?.productName || conversation?.participantUsername || "";
    const customer =
        conversation?.context?.customerUserName ||
        conversation?.participantName ||
        conversation?.context?.customerId ||
        "";
    const message = conversation?.lastMessageText || "";

    switch (scope) {
        case "product":
            return matchText(productName, q);
        case "customer":
            return matchText(customer, q);
        case "message":
            return matchText(message, q);
        default:
            return (
                matchText(productName, q) ||
                matchText(customer, q) ||
                matchText(message, q) ||
                matchText(conversation?.participantUsername, q)
            );
    }
}

export function filterInboxConversations(conversations, { search, searchScope, channelId, status }) {
    let list = sortConversationsNewestFirst(conversations);

    if (channelId && channelId !== INBOX_CHANNEL_FILTER_ALL) {
        list = list.filter((c) => c.channelId === channelId);
    }

    if (status && status !== "all") {
        list = list.filter((c) => (c.context?.questionStatus || "") === status);
    }

    const q = String(search || "").trim();
    if (q) {
        list = list.filter((c) => matchesInboxSearch(c, q, searchScope));
    }

    return list;
}

export function searchPlaceholderForScope(scope) {
    switch (scope) {
        case "product":
            return "Ürün adıyla ara…";
        case "customer":
            return "Müşteri adı veya no ile ara…";
        case "message":
            return "Mesaj metninde ara…";
        default:
            return "Konuşmalarda ara…";
    }
}
