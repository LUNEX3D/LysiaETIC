import React, { useEffect, useRef } from "react";
import { FaStore, FaUser } from "react-icons/fa";
import { formatMessageDateTime, groupMessagesWithDividers } from "./inboxDateUtils";

const InboxMessageThread = ({ messages, conversation, loading }) => {
    const endRef = useRef(null);
    const items = groupMessagesWithDividers(messages);
    const answeredHint = conversation?.context?.answeredDateMessage;

    useEffect(() => {
        if (!loading && endRef.current) {
            endRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading]);

    if (loading) {
        return <div className="ec-inbox-chat-thread__messages ec-inbox-chat-thread__messages--loading">Mesajlar yükleniyor…</div>;
    }

    if (!messages?.length) {
        return (
            <div className="ec-inbox-chat-thread__messages ec-inbox-chat-thread__messages--empty">
                <p>Henüz mesaj yok.</p>
            </div>
        );
    }

    return (
        <div className="ec-inbox-chat-thread__messages">
            {answeredHint && (
                <div className="ec-inbox-thread-note" role="status">
                    {answeredHint}
                </div>
            )}
            {items.map((item) => {
                if (item.type === "divider") {
                    return (
                        <div key={item.key} className="ec-inbox-day-divider">
                            <span>{item.label}</span>
                        </div>
                    );
                }
                const m = item.message;
                const isOut = m.direction === "out";
                const senderLabel = isOut
                    ? m.fromName || "Siz"
                    : m.fromName || conversation?.context?.customerUserName || "Müşteri";

                return (
                    <div
                        key={item.key}
                        className={`ec-inbox-msg-row ec-inbox-msg-row--${m.direction}`}
                    >
                        <span className="ec-inbox-msg-row__avatar" aria-hidden>
                            {isOut ? <FaStore /> : <FaUser />}
                        </span>
                        <div className={`ec-inbox-bubble ec-inbox-bubble--${m.direction}`}>
                            <span className="ec-inbox-bubble__sender">{senderLabel}</span>
                            <p>{m.text}</p>
                            <time dateTime={m.sentAt}>{formatMessageDateTime(m.sentAt)}</time>
                        </div>
                    </div>
                );
            })}
            <div ref={endRef} className="ec-inbox-thread-anchor" />
        </div>
    );
};

export default InboxMessageThread;
