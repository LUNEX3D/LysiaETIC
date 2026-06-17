export function formatMessageDateTime(d) {
    if (!d) return "";
    try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return "";
        const now = new Date();
        const sameDay = dt.toDateString() === now.toDateString();
        const time = dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        if (sameDay) return `Bugün ${time}`;
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (dt.toDateString() === yesterday.toDateString()) return `Dün ${time}`;
        const date = dt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
        return `${date} · ${time}`;
    } catch {
        return "";
    }
}

export function formatDayDivider(d) {
    if (!d) return "";
    try {
        const dt = new Date(d);
        const now = new Date();
        if (dt.toDateString() === now.toDateString()) return "Bugün";
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (dt.toDateString() === yesterday.toDateString()) return "Dün";
        return dt.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch {
        return "";
    }
}

export function dayKey(d) {
    if (!d) return "";
    try {
        return new Date(d).toDateString();
    } catch {
        return "";
    }
}

export function groupMessagesWithDividers(messages) {
    const sorted = [...(messages || [])].sort(
        (a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()
    );
    const items = [];
    let lastDay = "";
    for (const m of sorted) {
        const dk = dayKey(m.sentAt);
        if (dk && dk !== lastDay) {
            items.push({ type: "divider", key: `d-${dk}`, label: formatDayDivider(m.sentAt) });
            lastDay = dk;
        }
        items.push({ type: "message", key: m._id || `${m.direction}-${m.sentAt}`, message: m });
    }
    return items;
}
