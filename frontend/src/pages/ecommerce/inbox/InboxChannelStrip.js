import React, { useMemo } from "react";
import { FaInbox } from "react-icons/fa";
import { getChannelUi } from "./inboxChannelUi";
import { INBOX_CHANNEL_FILTER_ALL } from "./inboxConversationFilters";

const InboxChannelStrip = ({ connectedChannelIds, conversations, activeChannelId, onSelect }) => {
    const { counts, unreadByChannel } = useMemo(() => {
        const counts = { [INBOX_CHANNEL_FILTER_ALL]: conversations.length };
        const unreadByChannel = { [INBOX_CHANNEL_FILTER_ALL]: 0 };
        for (const id of connectedChannelIds) {
            counts[id] = 0;
            unreadByChannel[id] = 0;
        }
        for (const c of conversations) {
            const ch = c.channelId;
            if (counts[ch] != null) counts[ch] += 1;
            const u = Number(c.unreadCount) || 0;
            unreadByChannel[INBOX_CHANNEL_FILTER_ALL] += u;
            if (unreadByChannel[ch] != null) unreadByChannel[ch] += u;
        }
        return { counts, unreadByChannel };
    }, [conversations, connectedChannelIds]);

    const tabs = [
        {
            id: INBOX_CHANNEL_FILTER_ALL,
            label: "Tümü",
            color: "var(--ec-accent)",
            Icon: FaInbox,
        },
        ...connectedChannelIds.map((id) => {
            const ui = getChannelUi(id);
            return { id, label: ui.label, color: ui.color, Icon: ui.Icon };
        }),
    ];

    return (
        <div className="ec-inbox-channel-strip" role="tablist" aria-label="Kanal filtresi">
            {tabs.map(({ id, label, color, Icon }) => {
                const active = activeChannelId === id;
                const unread = unreadByChannel[id] || 0;
                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        title={label}
                        className={`ec-inbox-channel-tab${active ? " ec-inbox-channel-tab--active" : ""}`}
                        style={active ? { "--tab-accent": color } : undefined}
                        onClick={() => onSelect(id)}
                    >
                        <span className="ec-inbox-channel-tab__icon" style={{ color: active ? color : undefined }}>
                            <Icon />
                        </span>
                        <span className="ec-inbox-channel-tab__label">{label}</span>
                        <span className="ec-inbox-channel-tab__count">{counts[id] ?? 0}</span>
                        {unread > 0 && <span className="ec-inbox-channel-tab__unread">{unread}</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default InboxChannelStrip;
