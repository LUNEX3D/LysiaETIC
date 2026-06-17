import React, { useEffect, useMemo, useState } from "react";

import { FaCommentDots, FaEllipsisV, FaUnlink } from "react-icons/fa";

import { INBOX_CHANNELS } from "../../../constants/inboxChannels";

import { getChannelUi } from "./inboxChannelUi";

import InboxDisconnectConfirmModal from "./InboxDisconnectConfirmModal";

function formatDate(d) {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    } catch {
        return "—";
    }
}

function emailConnectionLabel(ch) {
    const mode = ch.externalRef || "";
    if (mode === "google") return { tone: "ok", text: "Gmail bağlı — gelen kutusu senkronu açık" };
    if (mode === "imap") return { tone: "ok", text: "Posta kutusu bağlı — IMAP senkronu açık" };
    if (mode === "light") return { tone: "warn", text: "Sadece adres — gelen kutusu bağlı değil" };
    return null;
}

const InboxSettingsPage = ({ settings, onManageChannels, onUpgradeEmail, onEditCanned, onDisconnect, saving }) => {
    const connected = useMemo(
        () => (settings?.channels || []).filter((c) => c.connected),
        [settings]
    );

    const canned = settings?.cannedResponses || [];

    const [openMenuId, setOpenMenuId] = useState(null);
    const [confirmChannel, setConfirmChannel] = useState(null);

    useEffect(() => {
        if (!openMenuId) return undefined;
        const close = () => setOpenMenuId(null);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [openMenuId]);

    const openConfirm = (ch, meta) => {
        setOpenMenuId(null);
        setConfirmChannel({
            channelId: ch.channelId,
            channelLabel: meta?.label || ch.channelId,
            accountLabel: ch.accountLabel || "",
        });
    };

    const handleConfirmDisconnect = async () => {
        if (!confirmChannel || saving) return;
        await onDisconnect(confirmChannel.channelId);
        setConfirmChannel(null);
    };

    return (
        <div className="ec-inbox-settings ec-inbox-settings--hub">
            <header className="ec-inbox-conversations__head">
                <h1>Ayarlar</h1>
            </header>

            <section className="ec-inbox-settings__section">
                <div className="ec-inbox-settings__section-head">
                    <div>
                        <h2>Kanallarınızı Yönetin</h2>
                        <p>
                            Tüm iletişim kanallarınızı Dashtock&apos;a bağlayarak satış ve destek süreçlerinizi tek
                            yerden yönetin.
                        </p>
                    </div>
                    <button type="button" className="ec-inbox-settings__action" onClick={onManageChannels}>
                        Kanalları Yönet
                    </button>
                </div>

                {connected.length === 0 ? (
                    <div className="ec-inbox-settings__empty-card">
                        <p>Henüz bağlı kanal yok.</p>
                        <button type="button" className="ec-inbox-settings__action" onClick={onManageChannels}>
                            Kanal Bağla
                        </button>
                    </div>
                ) : (
                    <ul className="ec-inbox-settings__connected">
                        {connected.map((ch) => {
                            const meta = INBOX_CHANNELS.find((c) => c.id === ch.channelId);
                            const ui = getChannelUi(ch.channelId);
                            const ChannelIcon = ui.Icon;
                            const menuOpen = openMenuId === ch.channelId;
                            const emailStatus = ch.channelId === "email" ? emailConnectionLabel(ch) : null;
                            const needsMailbox = emailStatus?.tone === "warn";

                            return (
                                <li key={ch.channelId} className="ec-inbox-settings__connected-row">
                                    <span className="ec-inbox-settings__avatar">
                                        <ChannelIcon style={{ color: ui.color }} />
                                    </span>

                                    <div className="ec-inbox-settings__connected-info">
                                        <strong>Kullanıcı adı: {ch.accountLabel || meta?.label}</strong>
                                        <span>Bağlantı Tarihi: {formatDate(ch.connectedAt)}</span>
                                        {emailStatus && (
                                            <span
                                                className={`ec-inbox-settings__conn-badge ec-inbox-settings__conn-badge--${emailStatus.tone}`}
                                            >
                                                {emailStatus.text}
                                            </span>
                                        )}
                                    </div>

                                    <div className="ec-inbox-settings__menu-wrap">
                                        <button
                                            type="button"
                                            className="ec-inbox-settings__menu"
                                            aria-expanded={menuOpen}
                                            aria-haspopup="menu"
                                            title="Kanal menüsü"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(menuOpen ? null : ch.channelId);
                                            }}
                                            disabled={saving}
                                        >
                                            <FaEllipsisV />
                                        </button>

                                        {menuOpen && (
                                            <div
                                                className="ec-inbox-settings__dropdown"
                                                role="menu"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {needsMailbox && onUpgradeEmail && (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="ec-inbox-settings__dropdown-item"
                                                        onClick={() => {
                                                            setOpenMenuId(null);
                                                            onUpgradeEmail();
                                                        }}
                                                    >
                                                        Posta kutusunu bağla
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="ec-inbox-settings__dropdown-item ec-inbox-settings__dropdown-item--danger"
                                                    onClick={() => openConfirm(ch, meta)}
                                                >
                                                    <FaUnlink aria-hidden />
                                                    Bağlantıyı Kaldır
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="ec-inbox-settings__section">
                <div className="ec-inbox-settings__section-head">
                    <div>
                        <h2>Hazır Mesajlar</h2>
                        <p>Sık kullanılan cevaplarınızı kaydedin ve müşterilerinize hızlı dönüş yapın.</p>
                    </div>
                    <button type="button" className="ec-inbox-settings__action" onClick={onEditCanned}>
                        Mesajları Düzenle
                    </button>
                </div>

                <ul className="ec-inbox-settings__canned-preview">
                    {canned.slice(0, 5).map((m) => (
                        <li key={m.id}>
                            <FaCommentDots className="ec-inbox-settings__canned-icon" />
                            <span>{m.text}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <InboxDisconnectConfirmModal
                open={Boolean(confirmChannel)}
                channelLabel={confirmChannel?.channelLabel}
                accountLabel={confirmChannel?.accountLabel}
                loading={saving}
                onCancel={() => !saving && setConfirmChannel(null)}
                onConfirm={handleConfirmDisconnect}
            />
        </div>
    );
};

export default InboxSettingsPage;
