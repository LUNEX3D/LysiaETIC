import React, { useCallback, useEffect, useState } from "react";

import { useDashtockTheme } from "../../../hooks/useDashtockTheme";

import {

    fetchInboxSettings,

    patchInboxSettings,

    connectInboxChannel,

    disconnectInboxChannel,

} from "../../../services/storeApi";

import InboxOnboardingWelcome from "./InboxOnboardingWelcome";

import InboxChannelSetupPage from "./InboxChannelSetupPage";

import InboxConversationsPage from "./InboxConversationsPage";

import InboxSettingsPage from "./InboxSettingsPage";

import InboxManageChannelsPage from "./InboxManageChannelsPage";

import InboxCannedMessagesPage from "./InboxCannedMessagesPage";

import "../../../styles/ecommerceInbox.css";



const EcommerceInboxHub = ({ panelId, onNavigate }) => {

    const { rootClassName, rootStyle, isDark } = useDashtockTheme();

    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");

    const [toast, setToast] = useState("");

    const [settings, setSettings] = useState(null);

    const [settingsView, setSettingsView] = useState("main");
    const [managePreselect, setManagePreselect] = useState(null);



    const load = useCallback(async () => {

        setLoading(true);

        setError("");

        try {

            const res = await fetchInboxSettings();

            setSettings(res.settings);

        } catch (e) {

            setError(e.response?.data?.error || e.message || "Yüklenemedi");

        } finally {

            setLoading(false);

        }

    }, []);



    useEffect(() => {

        load();

    }, [load]);



    useEffect(() => {

        const oauth = sessionStorage.getItem("inbox_oauth_result");

        if (!oauth) return;

        sessionStorage.removeItem("inbox_oauth_result");

        const errMsg = sessionStorage.getItem("inbox_oauth_error");
        const kind = sessionStorage.getItem("inbox_oauth_kind");

        sessionStorage.removeItem("inbox_oauth_error");
        sessionStorage.removeItem("inbox_oauth_kind");

        if (oauth === "success") {
            if (kind === "google") {
                setToast("Gmail hesabınız bağlandı. Mesajlar sekmesinde e-postalarınızı görebilirsiniz.");
            } else if (kind === "meta") {
                setToast("Meta hesabınız bağlandı. Instagram / Facebook mesajları senkronize ediliyor.");
            } else {
                setToast("Hesap başarıyla bağlandı.");
            }
            setSettingsView("main");
            load();
        } else if (oauth === "error") {
            if (kind === "google") {
                setError(errMsg || "Gmail bağlantısı tamamlanamadı.");
            } else {
                setError(errMsg || "Sosyal hesap bağlantısı tamamlanamadı.");
            }
        }

    }, [load]);



    const setStep = async (onboardingStep) => {

        setSaving(true);

        setError("");

        try {

            const res = await patchInboxSettings({ onboardingStep });

            setSettings(res.settings);

            if (onboardingStep === "done") setSettingsView("main");

        } catch (e) {

            setError(e.response?.data?.error || "Kaydedilemedi");

        } finally {

            setSaving(false);

        }

    };



    const saveCanned = async (cannedResponses) => {

        setSaving(true);

        setError("");

        try {

            const res = await patchInboxSettings({ cannedResponses });

            setSettings(res.settings);

            setSettingsView("main");

            setToast("Hazır mesajlar kaydedildi.");

        } catch (e) {

            setError(e.response?.data?.error || "Kaydedilemedi");

        } finally {

            setSaving(false);

        }

    };



    const handleConnect = async (channelId, body) => {

        setSaving(true);

        setError("");

        try {

            const res = await connectInboxChannel(channelId, body);

            if (res.oauthUrl) {

                window.location.href = res.oauthUrl;

                return res;

            }

            setSettings(res.settings);

            if (res.syncError) {
                setError(res.syncError);
            } else if (channelId === "trendyol") {
                const n = res.synced ?? 0;
                if (n > 0) {
                    setToast(
                        `Trendyol bağlandı. ${n} müşteri sorusu içe aktarıldı. Gelen Kutusu → Mesajlar'dan yanıtlayabilirsiniz.`
                    );
                } else {
                    setToast(
                        "Trendyol bağlandı. Son 7 günde müşteri sorusu yok; yeni sorular geldiğinde Mesajlar'da görünecek."
                    );
                }
            } else if (channelId === "amazon") {
                setToast("Amazon kanalı bağlandı. Mesaj senkronu kademeli açılıyor — Mesajlar sekmesini kontrol edin.");
            } else if (channelId === "email") {
                const n = res.synced ?? 0;
                if (res.syncError) {
                    setError(res.syncError);
                } else if (res.syncHint) {
                    setToast(res.syncHint);
                } else if (n > 0) {
                    setToast(`${n} e-posta Mesajlar'a aktarıldı.`);
                } else {
                    setToast("E-posta kanalı bağlandı.");
                }
            } else if (["instagram", "facebook", "whatsapp"].includes(channelId)) {
                setToast(`${channelId.charAt(0).toUpperCase() + channelId.slice(1)} bağlandı.`);
            } else {
                setToast("Kanal bağlandı. Mesajlar sekmesinden takip edebilirsiniz.");
            }

            return res;

        } catch (e) {

            const msg = e.response?.data?.error || "Bağlanamadı";

            setError(msg);

            throw e;

        } finally {

            setSaving(false);

        }

    };



    const handleDisconnect = async (channelId) => {

        setSaving(true);

        setError("");

        try {

            const res = await disconnectInboxChannel(channelId);

            setSettings(res.settings);

        } catch (e) {

            setError(e.response?.data?.error || "Bağlantı kaldırılamadı");

            throw e;

        } finally {

            setSaving(false);

        }

    };



    const hasConnected = (settings?.channels || []).some((c) => c.connected);

    const step = settings?.onboardingStep || "welcome";

    const isSettings = panelId === "ec-inbox-settings";



    const wrap = (content) => (

        <div

            className={`dashboard-home-layout ec-theme-root ec-prod-layout-full ec-inbox-hub ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}

            style={rootStyle}

        >

            <div className="ec-page-body ec-page-body--flush">

                {toast && (

                    <div className="ec-inbox-toast" role="status">

                        {toast}

                        <button type="button" onClick={() => setToast("")} aria-label="Kapat">

                            ×

                        </button>

                    </div>

                )}

                {error && <div className="ec-purchase-form-error">{error}</div>}

                {content}

            </div>

        </div>

    );



    if (loading) {

        return wrap(<div className="ec-prod-empty">Yükleniyor…</div>);

    }



    if (isSettings) {

        if (step === "welcome") {

            return wrap(<InboxOnboardingWelcome onContinue={() => setStep("channels")} />);

        }

        if (step === "channels") {

            return wrap(

                <InboxChannelSetupPage

                    settings={settings}

                    onBack={() => setStep("welcome")}

                    onSkip={() => setStep("done")}

                    onConnect={handleConnect}

                    onDisconnect={handleDisconnect}

                    saving={saving}

                />

            );

        }

        if (settingsView === "manage-channels") {

            return wrap(

                <InboxManageChannelsPage
                    settings={settings}
                    onBack={() => {
                        setManagePreselect(null);
                        setSettingsView("main");
                    }}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    saving={saving}
                    initialConnect={managePreselect}
                />

            );

        }

        if (settingsView === "canned") {

            return wrap(

                <InboxCannedMessagesPage

                    cannedResponses={settings?.cannedResponses || []}

                    onBack={() => setSettingsView("main")}

                    onSave={saveCanned}

                    saving={saving}

                />

            );

        }

        return wrap(

            <InboxSettingsPage
                settings={settings}
                onManageChannels={() => setSettingsView("manage-channels")}
                onUpgradeEmail={() => {
                    const google = settings?.googleInboxOAuthAvailable;
                    setManagePreselect({
                        channelId: "email",
                        emailMode: google ? "google" : "mailbox",
                    });
                    setSettingsView("manage-channels");
                }}
                onEditCanned={() => setSettingsView("canned")}
                onDisconnect={handleDisconnect}
                saving={saving}
            />

        );

    }



    if (step !== "done" && !hasConnected) {

        return wrap(

            <InboxOnboardingWelcome

                onContinue={() => onNavigate?.("ec-inbox-settings")}

                ctaLabel="Kuruluma Başla"

            />

        );

    }



    return wrap(

        <InboxConversationsPage

            settings={settings}

            onOpenSettings={() => onNavigate?.("ec-inbox-settings")}

            onAddChannels={() => onNavigate?.("ec-inbox-settings")}

        />

    );

};



export default EcommerceInboxHub;

