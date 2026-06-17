import React, { useEffect, useMemo, useState } from "react";
import { startInstagramInboxOAuth } from "../../../services/storeApi";

import {

    FaArrowLeft,

    FaInstagram,

    FaFacebook,

    FaWhatsapp,

    FaAmazon,

    FaEnvelope,

    FaComments,

    FaFileAlt,

    FaShoppingBag,

} from "react-icons/fa";

import { INBOX_CHANNELS } from "../../../constants/inboxChannels";

import InboxConnectModal from "./InboxConnectModal";



const ICONS = {

    instagram: FaInstagram,

    whatsapp: FaWhatsapp,

    facebook: FaFacebook,

    form: FaFileAlt,

    email: FaEnvelope,

    livechat: FaComments,

    amazon: FaAmazon,

    trendyol: FaShoppingBag,

};



const InboxManageChannelsPage = ({ settings, onBack, onConnect, onDisconnect, saving, initialConnect }) => {

    const [modalChannel, setModalChannel] = useState(null);
    const [initialEmailMode, setInitialEmailMode] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [oauthStarting, setOauthStarting] = useState(false);

    const metaOAuth = settings?.metaOAuthAvailable || settings?.instagramOAuthAvailable;

    useEffect(() => {
        if (!initialConnect?.channelId) return;
        const ch = INBOX_CHANNELS.find((c) => c.id === initialConnect.channelId);
        if (ch) {
            setModalChannel(ch);
            setInitialEmailMode(initialConnect.emailMode || null);
        }
    }, [initialConnect]);



    const channelMap = useMemo(() => {

        const m = new Map();

        (settings?.channels || []).forEach((c) => m.set(c.channelId, c));

        return m;

    }, [settings]);



    const handleConnect = async (body) => {
        if (!modalChannel) return;
        setConnecting(true);
        try {
            await onConnect(modalChannel.id, body);
            setModalChannel(null);
            setInitialEmailMode(null);
        } finally {
            setConnecting(false);
        }
    };

    const handleMetaOAuth = async (channelId, e) => {
        e?.stopPropagation?.();
        if (!metaOAuth) {
            const ch = INBOX_CHANNELS.find((c) => c.id === channelId);
            if (ch) setModalChannel(ch);
            return;
        }
        setOauthStarting(true);
        try {
            const res = await startInstagramInboxOAuth(channelId);
            if (res.url) window.location.href = res.url;
        } finally {
            setOauthStarting(false);
        }
    };



    return (

        <div className="ec-inbox-settings ec-inbox-manage">

            <header className="ec-inbox-manage__head">

                <button type="button" className="ec-inbox-channels__back" onClick={onBack}>

                    <FaArrowLeft />

                </button>

                <h1>Kanalları Yönet</h1>

            </header>

            <p className="ec-inbox-manage__intro">

                Tüm iletişim kanallarınızı Dashtock&apos;a bağlayarak satış ve destek süreçlerinizi tek yerden yönetin.

            </p>

            <div className="ec-inbox-manage__grid">

                {INBOX_CHANNELS.map((ch) => {

                    const state = channelMap.get(ch.id);

                    const connected = !!state?.connected;

                    const Icon = ICONS[ch.id] || FaComments;

                    return (

                        <article

                            key={ch.id}

                            className={`ec-inbox-manage-card${connected ? " ec-inbox-manage-card--on" : ""}`}

                            onClick={() => {

                                if (!connected) setModalChannel(ch);

                            }}

                            onKeyDown={(e) => {

                                if (e.key === "Enter" && !connected) setModalChannel(ch);

                            }}

                            role="button"

                            tabIndex={0}

                        >

                            <span className="ec-inbox-manage-card__icon" style={{ color: ch.color }}>

                                <Icon />

                            </span>

                            <h3>{ch.label}</h3>

                            <p>{ch.manageDescription}</p>

                            {connected && (
                                <span className="ec-inbox-manage-card__status">Bağlı · {state.accountLabel}</span>
                            )}

                            {!connected && ch.type === "meta" && metaOAuth && (
                                <button
                                    type="button"
                                    className="ec-inbox-manage-card__oauth"
                                    disabled={oauthStarting || saving}
                                    onClick={(e) => handleMetaOAuth(ch.id, e)}
                                >
                                    {ch.id === "instagram" ? "Instagram ile Giriş Yap" : `${ch.label} ile Giriş`}
                                </button>
                            )}
                        </article>

                    );

                })}

            </div>

            <InboxConnectModal
                open={!!modalChannel}
                channel={modalChannel}
                settings={settings}
                initialEmailMode={initialEmailMode}
                onClose={() => {
                    setModalChannel(null);
                    setInitialEmailMode(null);
                }}
                onConnect={handleConnect}
                connecting={connecting}
            />

        </div>

    );

};



export default InboxManageChannelsPage;

