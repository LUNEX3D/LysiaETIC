import React, { useCallback, useEffect, useMemo, useState } from "react";

import { FaInbox, FaPaperPlane, FaSearch, FaInstagram } from "react-icons/fa";

import DashtockLogoMark from "../../../components/brand/DashtockLogoMark";
import { getChannelUi } from "./inboxChannelUi";
import InboxThreadProductCard from "./InboxThreadProductCard";
import InboxMessageThread from "./InboxMessageThread";
import {
    filterInboxConversations,
    INBOX_CHANNEL_FILTER_ALL,
    INBOX_SEARCH_SCOPES,
    INBOX_STATUS_FILTERS,
    searchPlaceholderForScope,
    sortConversationsNewestFirst,
} from "./inboxConversationFilters";
import InboxChannelStrip from "./InboxChannelStrip";

import {

    fetchInboxConversations,

    fetchInboxMessages,

    sendInboxMessage,

    syncInbox,

} from "../../../services/storeApi";



function formatListTime(d) {
    if (!d) return "";
    try {
        const dt = new Date(d);
        const now = new Date();
        const time = dt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        if (dt.toDateString() === now.toDateString()) return time;
        return dt.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    } catch {
        return "";
    }
}

function convThumbUrl(c) {
    return c?.context?.imageUrl || c?.participantAvatar || "";
}

function convProductLine(c) {
    const name = c?.context?.productName || c?.participantUsername || "";
    if (!name) return null;
    return name.length > 48 ? `${name.slice(0, 48)}…` : name;
}



const InboxConversationsPage = ({ settings, onOpenSettings, onAddChannels }) => {

    const [loading, setLoading] = useState(true);

    const [conversations, setConversations] = useState([]);

    const [activeId, setActiveId] = useState(null);

    const [messages, setMessages] = useState([]);

    const [activeConv, setActiveConv] = useState(null);

    const [draft, setDraft] = useState("");

    const [sending, setSending] = useState(false);

    const [search, setSearch] = useState("");
    const [searchScope, setSearchScope] = useState("all");
    const [channelFilter, setChannelFilter] = useState(INBOX_CHANNEL_FILTER_ALL);
    const [statusFilter, setStatusFilter] = useState("all");

    const [threadLoading, setThreadLoading] = useState(false);



    const connectedCount = useMemo(

        () => (settings?.channels || []).filter((c) => c.connected).length,

        [settings]

    );



    const connectedChannels = useMemo(
        () => (settings?.channels || []).filter((c) => c.connected),
        [settings]
    );

    const trendyolConnected = useMemo(
        () => connectedChannels.some((c) => c.channelId === "trendyol"),
        [connectedChannels]
    );



    const loadList = useCallback(async () => {

        setLoading(true);

        try {

            if (connectedCount > 0) {

                await syncInbox().catch(() => {});

            }

            const res = await fetchInboxConversations();

            setConversations(sortConversationsNewestFirst(res.conversations || []));

        } catch {

            setConversations([]);

        } finally {

            setLoading(false);

        }

    }, [connectedCount]);



    useEffect(() => {

        loadList();

    }, [loadList]);



    const loadThread = useCallback(async (conversationId) => {

        setThreadLoading(true);

        try {

            const res = await fetchInboxMessages(conversationId);

            setActiveConv(res.conversation);

            setMessages(res.messages || []);

        } catch {

            setMessages([]);

        } finally {

            setThreadLoading(false);

        }

    }, []);



    useEffect(() => {

        if (activeId) loadThread(activeId);

        else {

            setActiveConv(null);

            setMessages([]);

        }

    }, [activeId, loadThread]);

    useEffect(() => {
        if (!activeId || !activeConv) return;
        if (channelFilter !== INBOX_CHANNEL_FILTER_ALL && activeConv.channelId !== channelFilter) {
            setActiveId(null);
        }
    }, [channelFilter, activeId, activeConv]);

    const handleChannelSelect = (id) => {
        setChannelFilter(id);
        if (id !== "trendyol") setStatusFilter("all");
        setActiveId(null);
    };



    const connectedChannelIds = useMemo(
        () => connectedChannels.map((c) => c.channelId),
        [connectedChannels]
    );

    const channelFilterOptions = useMemo(
        () => [
            { id: INBOX_CHANNEL_FILTER_ALL, label: "Tümü" },
            ...connectedChannelIds.map((id) => ({
                id,
                label: getChannelUi(id).label,
            })),
        ],
        [connectedChannelIds]
    );

    const showStatusFilter = useMemo(() => {
        if (channelFilter === "trendyol") return true;
        if (channelFilter !== INBOX_CHANNEL_FILTER_ALL) return false;
        return connectedChannels.some((c) => c.channelId === "trendyol");
    }, [channelFilter, connectedChannels]);

    const filtered = useMemo(
        () =>
            filterInboxConversations(conversations, {
                search,
                searchScope,
                channelId: channelFilter,
                status: showStatusFilter ? statusFilter : "all",
            }),
        [conversations, search, searchScope, channelFilter, statusFilter, showStatusFilter]
    );

    const hasActiveFilters =
        search.trim() ||
        channelFilter !== INBOX_CHANNEL_FILTER_ALL ||
        (showStatusFilter && statusFilter !== "all");



    const canned = settings?.cannedResponses || [];

    const activeChannelUi = useMemo(
        () => (activeConv?.channelId ? getChannelUi(activeConv.channelId) : null),
        [activeConv?.channelId]
    );



    const handleSend = async () => {

        const text = draft.trim();

        if (!text || !activeId) return;

        setSending(true);

        try {

            await sendInboxMessage(activeId, text);

            setDraft("");

            await loadThread(activeId);

            const res = await fetchInboxConversations();

            setConversations(sortConversationsNewestFirst(res.conversations || []));

        } catch {

            /* hub may show error if wired */

        } finally {

            setSending(false);

        }

    };



    if (connectedCount === 0) {

        return (

            <div className="ec-inbox-conversations">

                <header className="ec-inbox-conversations__head">

                    <h1>

                        Sohbet <FaInbox className="ec-inbox-conversations__head-icon" />

                    </h1>

                </header>

                <div className="ec-inbox-conversations__empty ec-inbox-conversations__empty--brand">

                    <DashtockLogoMark size={48} />

                    <h2>Dashtock Gelen Kutusu</h2>

                    <p>İletişim kanallarından gelen mesajlar burada gözükecek.</p>

                    <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={onAddChannels}>

                        Kanalları Bağla

                    </button>

                </div>

            </div>

        );

    }



    return (

        <div className="ec-inbox-chat-layout">

            <aside className="ec-inbox-chat-list">

                <header className="ec-inbox-chat-list__head">

                    <h1>Sohbet</h1>

                    <button type="button" className="ec-inbox-chat-list__settings" onClick={onOpenSettings}>

                        Ayarlar

                    </button>

                </header>

                {channelFilterOptions.length > 0 && (
                    <InboxChannelStrip
                        connectedChannelIds={connectedChannelIds}
                        conversations={conversations}
                        activeChannelId={channelFilter}
                        onSelect={handleChannelSelect}
                    />
                )}

                <div className="ec-inbox-chat-list__toolbar">
                    <label className="ec-orders-search ec-inbox-chat-list__search">
                        <FaSearch />
                        <input
                            placeholder={searchPlaceholderForScope(searchScope)}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <div className="ec-inbox-scope-pills" role="group" aria-label="Arama alanı">
                        {INBOX_SEARCH_SCOPES.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                className={`ec-inbox-scope-pill${searchScope === o.id ? " active" : ""}`}
                                onClick={() => setSearchScope(o.id)}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                    {showStatusFilter && (
                        <div className="ec-inbox-status-pills" role="group" aria-label="Trendyol soru durumu">
                            {INBOX_STATUS_FILTERS.map((o) => (
                                <button
                                    key={o.id}
                                    type="button"
                                    className={`ec-inbox-status-pill${statusFilter === o.id ? " active" : ""}`}
                                    onClick={() => setStatusFilter(o.id)}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            className="ec-inbox-chat-filters__clear"
                            onClick={() => {
                                setSearch("");
                                setSearchScope("all");
                                setChannelFilter(INBOX_CHANNEL_FILTER_ALL);
                                setStatusFilter("all");
                            }}
                        >
                            Filtreleri temizle
                        </button>
                    )}
                </div>

                {loading ? (

                    <p className="ec-inbox-chat-list__hint">Yükleniyor…</p>

                ) : conversations.length === 0 ? (
                    <div className="ec-inbox-chat-list__hint">
                        <p>Henüz konuşma yok.</p>
                        {trendyolConnected ? (
                            <p>
                                Trendyol bağlı — son 7 günün müşteri soruları listelenir. Bu aralıkta soru yoksa
                                liste boş kalır; Trendyol panelinde yeni soru gelince &quot;Yenile&quot; için sayfayı
                                tekrar açın.
                            </p>
                        ) : (
                            <p>Bağlı kanallardan gelen mesajlar burada görünecek.</p>
                        )}
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--ghost"
                            style={{ marginTop: "0.5rem" }}
                            onClick={() => loadList()}
                        >
                            Yeniden senkronize et
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="ec-inbox-chat-list__hint">
                        <p>Arama veya filtreye uygun konuşma bulunamadı.</p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--ghost"
                            style={{ marginTop: "0.5rem" }}
                            onClick={() => {
                                setSearch("");
                                setSearchScope("all");
                                setChannelFilter(INBOX_CHANNEL_FILTER_ALL);
                                setStatusFilter("all");
                            }}
                        >
                            Filtreleri temizle
                        </button>
                    </div>
                ) : (

                    <ul className="ec-inbox-chat-list__items">

                        {filtered.map((c) => (

                            <li key={c._id}>

                                <button

                                    type="button"

                                    className={`ec-inbox-chat-item${String(activeId) === String(c._id) ? " active" : ""}`}

                                    onClick={() => setActiveId(c._id)}

                                >

                                    <span
                                        className={`ec-inbox-chat-item__avatar${convThumbUrl(c) ? " ec-inbox-chat-item__avatar--img" : ""}`}
                                    >
                                        {convThumbUrl(c) ? (
                                            <img src={convThumbUrl(c)} alt="" loading="lazy" />
                                        ) : (
                                            (() => {
                                                const ui = getChannelUi(c.channelId);
                                                const Icon = ui.Icon;
                                                return <Icon style={{ color: ui.color }} />;
                                            })()
                                        )}
                                    </span>

                                    <span className="ec-inbox-chat-item__body">

                                        <span className="ec-inbox-chat-item__name">
                                            {c.context?.customerUserName ||
                                                c.participantName ||
                                                c.participantUsername ||
                                                "Müşteri"}
                                        </span>

                                        {convProductLine(c) && (
                                            <span className="ec-inbox-chat-item__product">{convProductLine(c)}</span>
                                        )}

                                        <span className="ec-inbox-chat-item__preview">{c.lastMessageText}</span>

                                    </span>

                                    <span className="ec-inbox-chat-item__time">{formatListTime(c.lastMessageAt)}</span>

                                    {c.unreadCount > 0 && (

                                        <span className="ec-inbox-chat-item__badge">{c.unreadCount}</span>

                                    )}

                                </button>

                            </li>

                        ))}

                    </ul>

                )}

            </aside>



            <main className="ec-inbox-chat-thread">

                {!activeId ? (

                    <div className="ec-inbox-conversations__empty ec-inbox-conversations__empty--brand">

                        <DashtockLogoMark size={48} />

                        <h2>Dashtock Gelen Kutusu</h2>

                        <p>İletişim kanallarından gelen mesajlar burada gözükecek.</p>

                        {connectedChannels.some((c) => c.channelId === "instagram") && (
                            <p className="ec-inbox-chat-thread__ig-hint">
                                <FaInstagram /> Instagram bağlı — soldan bir konuşma seçin.
                            </p>
                        )}
                        {trendyolConnected && (
                            <p className="ec-inbox-chat-thread__ig-hint" style={{ color: "#F27A1A" }}>
                                Trendyol bağlı — müşteri soruları soldaki listede.
                            </p>
                        )}

                    </div>

                ) : (

                    <>

                        <header className="ec-inbox-chat-thread__head">
                            <div className="ec-inbox-chat-thread__head-main">
                                <div>
                                    <strong>
                                        {activeConv?.context?.customerUserName ||
                                            activeConv?.participantName ||
                                            "Konuşma"}
                                    </strong>
                                    {activeConv?.channelId === "trendyol" && (
                                        <span className="ec-inbox-chat-thread__customer-meta">
                                            {activeConv?.context?.customerId
                                                ? `Müşteri no: ${activeConv.context.customerId}`
                                                : activeConv?.context?.showUserName === false
                                                  ? "Müşteri adı Trendyol'da gizli"
                                                  : "Trendyol müşteri sorusu"}
                                        </span>
                                    )}
                                    {activeConv?.participantUsername && activeConv?.channelId !== "trendyol" && (
                                        <span>@{activeConv.participantUsername}</span>
                                    )}
                                </div>
                                {activeChannelUi && (
                                    <span
                                        className="ec-inbox-chat-thread__channel"
                                        style={{ color: activeChannelUi.color }}
                                    >
                                        {React.createElement(activeChannelUi.Icon)} {activeChannelUi.label}
                                    </span>
                                )}
                            </div>
                            <InboxThreadProductCard conversation={activeConv} />
                        </header>

                        <InboxMessageThread
                            messages={messages}
                            conversation={activeConv}
                            loading={threadLoading}
                        />

                        {canned.length > 0 && (

                            <div className="ec-inbox-chat-canned">

                                {canned.slice(0, 3).map((c) => (

                                    <button

                                        key={c.id}

                                        type="button"

                                        className="ec-inbox-chat-canned__chip"

                                        onClick={() => setDraft(c.text)}

                                    >

                                        {c.text.length > 42 ? `${c.text.slice(0, 42)}…` : c.text}

                                    </button>

                                ))}

                            </div>

                        )}

                        <footer className="ec-inbox-chat-compose">

                            <textarea

                                rows={2}

                                placeholder="Mesajınızı yazın…"

                                value={draft}

                                onChange={(e) => setDraft(e.target.value)}

                                onKeyDown={(e) => {

                                    if (e.key === "Enter" && !e.shiftKey) {

                                        e.preventDefault();

                                        handleSend();

                                    }

                                }}

                            />

                            <button

                                type="button"

                                className="ec-inbox-chat-compose__send"

                                disabled={sending || !draft.trim()}

                                onClick={handleSend}

                            >

                                <FaPaperPlane />

                            </button>

                        </footer>

                    </>

                )}

            </main>

        </div>

    );

};



export default InboxConversationsPage;

