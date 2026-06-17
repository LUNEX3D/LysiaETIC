import React, { useMemo, useState } from "react";

import {

    FaArrowLeft,

    FaLink,

    FaCheck,

    FaInstagram,

    FaFacebook,

    FaWhatsapp,

    FaAmazon,

    FaEnvelope,

    FaComments,

    FaFileAlt,

    FaShoppingBag,

} from "react-icons/fa";

import DashtockLogo from "../../../components/brand/DashtockLogo";

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



const InboxChannelSetupPage = ({ settings, onBack, onSkip, onConnect, onDisconnect, saving }) => {

    const [modalChannel, setModalChannel] = useState(null);

    const [connecting, setConnecting] = useState(false);



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

        } finally {

            setConnecting(false);

        }

    };



    return (

        <div className="ec-inbox-onboard">

            <div className="ec-inbox-onboard__logo">

                <DashtockLogo size={34} full />

            </div>

            <div className="ec-inbox-onboard__card ec-inbox-onboard__card--wide">

                <div className="ec-inbox-channels__top">

                    <button type="button" className="ec-inbox-channels__back" onClick={onBack}>

                        <FaArrowLeft /> 2 / 2

                    </button>

                </div>

                <h1>Bağlamak İstediğin Kanalları Bağla</h1>

                <p className="ec-inbox-onboard__sub">

                    Yönetmek istediğin iletişim kanallarını bağlayarak Dashtock Gelen Kutusu&apos;nu kullanmaya başla.

                </p>

                <div className="ec-inbox-channels__grid">

                    {INBOX_CHANNELS.map((ch) => {

                        const state = channelMap.get(ch.id);

                        const connected = !!state?.connected;

                        const Icon = ICONS[ch.id] || FaComments;

                        return (

                            <div

                                key={ch.id}

                                className={`ec-inbox-channel-card${connected ? " ec-inbox-channel-card--connected" : ""}`}

                            >

                                <div className="ec-inbox-channel-card__main">

                                    <span className="ec-inbox-channel-card__icon" style={{ color: ch.color }}>

                                        <Icon />

                                    </span>

                                    <span className="ec-inbox-channel-card__label">{ch.label}</span>

                                </div>

                                {connected ? (

                                    <button

                                        type="button"

                                        className="ec-inbox-channel-card__btn ec-inbox-channel-card__btn--connected"

                                        onClick={() => onDisconnect(ch.id)}

                                        disabled={saving}

                                        title={state?.accountLabel || "Bağlı"}

                                    >

                                        <FaCheck /> Bağlı

                                    </button>

                                ) : (

                                    <button

                                        type="button"

                                        className="ec-inbox-channel-card__btn"

                                        onClick={() => setModalChannel(ch)}

                                        disabled={saving}

                                    >

                                        <FaLink /> Bağla

                                    </button>

                                )}

                            </div>

                        );

                    })}

                </div>

                <button

                    type="button"

                    className="ec-inbox-onboard__primary"

                    disabled={saving}

                    onClick={onSkip}

                >

                    Bağlamadan Devam Et

                </button>

            </div>



            <InboxConnectModal

                open={!!modalChannel}

                channel={modalChannel}

                settings={settings}

                onClose={() => setModalChannel(null)}

                onConnect={handleConnect}

                connecting={connecting}

            />

        </div>

    );

};



export default InboxChannelSetupPage;

