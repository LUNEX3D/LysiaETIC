import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaShieldAlt, FaCheckCircle } from "react-icons/fa";
import {
    FaInstagram,
    FaFacebook,
    FaWhatsapp,
    FaAmazon,
    FaEnvelope,
    FaComments,
    FaFileAlt,
    FaShoppingBag,
    FaGoogle,
} from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import { startInstagramInboxOAuth, startGoogleInboxOAuth } from "../../../services/storeApi";

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

const InboxConnectModal = ({
    open,
    channel,
    settings,
    initialEmailMode,
    onClose,
    onConnect,
    connecting,
}) => {
    const { rootClassName, rootStyle } = useDashtockTheme();
    const [localError, setLocalError] = useState("");
    const [email, setEmail] = useState("");
    const googleOAuth = settings?.googleInboxOAuthAvailable;
    const [emailMode, setEmailMode] = useState(googleOAuth ? "google" : "mailbox");
    const [emailProvider, setEmailProvider] = useState("gmail");
    const [imapPassword, setImapPassword] = useState("");
    const [imapHost, setImapHost] = useState("");
    const [showAdvancedImap, setShowAdvancedImap] = useState(false);

    const EMAIL_PROVIDERS = {
        gmail: {
            label: "Gmail / Google Workspace",
            host: "imap.gmail.com",
            hint: "@gmail.com veya @firmaniz.com (Workspace) — Google Hesap → Güvenlik → Uygulama şifreleri (16 hane, boşluksuz yapıştırın)",
        },
        outlook: { label: "Outlook", host: "outlook.office365.com", hint: "Microsoft hesap → Güvenlik → Uygulama şifresi" },
        yandex: { label: "Yandex", host: "imap.yandex.com", hint: "Yandex Mail → Posta programları şifresi" },
        other: { label: "Diğer", host: "", hint: "IMAP sunucu adresinizi girin" },
    };

    useEffect(() => {
        if (!open || channel?.id !== "email") return;
        if (initialEmailMode) {
            setEmailMode(initialEmailMode);
            return;
        }
        setEmailMode(googleOAuth ? "google" : "mailbox");
    }, [open, channel?.id, googleOAuth, initialEmailMode]);

    if (!open || !channel) return null;

    const Icon = ICONS[channel.id] || FaComments;
    const isMeta = channel.type === "meta";
    const isMarketplace = channel.type === "marketplace";
    const isEmail = channel.id === "email";
    const metaOAuth = settings?.metaOAuthAvailable || settings?.instagramOAuthAvailable;
    const demoMode = settings?.metaDemoMode || settings?.instagramDemoMode;

    const handleConnect = async () => {
        setLocalError("");
        if (isMeta) {
            if (metaOAuth) {
                try {
                    const res = await startInstagramInboxOAuth(channel.id);
                    if (res.url) {
                        window.location.href = res.url;
                        return;
                    }
                    setLocalError("Meta yönlendirme adresi alınamadı.");
                } catch (e) {
                    setLocalError(e.response?.data?.error || "OAuth başlatılamadı");
                }
                return;
            }
            if (demoMode) {
                try {
                    await onConnect?.({ accountLabel: "" });
                    onClose?.();
                } catch {
                    /* parent */
                }
                return;
            }
            setLocalError("META_APP_ID ve META_APP_SECRET sunucuda tanımlı olmalı.");
            return;
        }

        if (isMarketplace) {
            try {
                await onConnect?.({});
                onClose?.();
            } catch {
                /* parent error */
            }
            return;
        }

        try {
            if (isEmail) {
                if (emailMode === "google") {
                    if (!googleOAuth) {
                        setLocalError("Gmail OAuth sunucuda yapılandırılmamış (GOOGLE_CLIENT_SECRET).");
                        return;
                    }
                    try {
                        const res = await startGoogleInboxOAuth();
                        if (res.url) {
                            window.location.href = res.url;
                            return;
                        }
                        setLocalError("Google yönlendirme adresi alınamadı.");
                    } catch (e) {
                        setLocalError(e.response?.data?.error || "Gmail bağlantısı başlatılamadı");
                    }
                    return;
                }

                if (!email.trim().includes("@")) {
                    setLocalError("Geçerli bir e-posta adresi girin.");
                    return;
                }
                if (emailMode === "mailbox") {
                    if (!imapPassword.trim()) {
                        setLocalError("Uygulama şifrenizi girin (normal e-posta şifreniz değil).");
                        return;
                    }
                    const preset = EMAIL_PROVIDERS[emailProvider];
                    await onConnect?.({
                        accountLabel: email.trim(),
                        imapUser: email.trim(),
                        imapPassword: imapPassword.trim(),
                        imapHost: imapHost.trim() || preset?.host || "",
                        emailProvider,
                        connectionMode: "imap",
                    });
                } else {
                    await onConnect?.({
                        accountLabel: email.trim(),
                        connectionMode: "light",
                    });
                }
            } else {
                await onConnect?.({ accountLabel: channel.needsEmail ? email.trim() : "" });
            }
            onClose?.();
        } catch {
            /* parent */
        }
    };

    const steps = [];
    if (isMeta && metaOAuth) {
        steps.push("Instagram / Facebook hesabınızla Meta üzerinden giriş yapın");
        steps.push("Mesaj ve sayfa izinlerini onaylayın");
        steps.push("DM'ler Gelen Kutusu → Mesajlar'da görünür");
    } else if (isMeta && !metaOAuth && !demoMode) {
        steps.push("Sunucuda META_APP_ID ve META_APP_SECRET tanımlanmalı");
        steps.push("Meta Developer → Uygulama → Instagram Messaging");
        steps.push("OAuth callback: BACKEND_URL/api/store/inbox/instagram/oauth/callback");
    } else if (isMarketplace) {
        steps.push("Pazaryeri Entegrasyonu'nda API bilgileriniz kayıtlı olmalı");
        steps.push("Müşteri soruları son 7 gün için senkronize edilir");
    } else if (isEmail && emailMode === "google") {
        steps.push("Google hesabınızla güvenli giriş");
        steps.push("Gmail okuma iznini onaylayın");
        steps.push("Son 7 günün mailleri otomatik içe aktarılır");
    } else if (isEmail && emailMode === "easy") {
        steps.push("Yalnızca destek adresinizi kaydeder");
        steps.push("Mağaza iletişim formu mesajları burada görünür");
        steps.push("Gelen kutusu mailleri için Gmail veya IMAP kullanın");
    } else if (isEmail) {
        steps.push(`${EMAIL_PROVIDERS[emailProvider]?.label || "Posta"} kutunuzu seçin`);
        steps.push("Uygulama şifresini yapıştırın");
        steps.push("Son 7 günün mailleri otomatik içe aktarılır");
    } else if (channel.needsEmail) {
        steps.push("Destek e-postanızı girin");
    }

    const emailTabCount = googleOAuth ? 3 : 2;
    const primaryLabel = (() => {
        if (connecting) return "Bağlanıyor…";
        if (isMeta && metaOAuth) return channel.connectButton || "Meta ile Giriş Yap";
        if (isEmail && emailMode === "google") return "Gmail ile Bağlan";
        if (isEmail && emailMode === "easy") return "Sadece Adres Kaydet";
        return channel.connectButton;
    })();

    const backdropStyle = { ...rootStyle, background: undefined };

    return createPortal(
        <div
            className={`ec-inbox-modal-backdrop ${rootClassName}`}
            style={backdropStyle}
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="ec-inbox-connect-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inbox-connect-title"
                style={{ "--channel-accent": channel.color }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="ec-inbox-connect-modal__accent" aria-hidden />

                <header className="ec-inbox-connect-modal__head">
                    <div className="ec-inbox-connect-modal__brand">
                        <span
                            className="ec-inbox-connect-modal__icon"
                            style={{
                                color: channel.color,
                                background: `color-mix(in srgb, ${channel.color} 16%, var(--ec-card))`,
                                borderColor: `color-mix(in srgb, ${channel.color} 35%, var(--ec-border))`,
                            }}
                        >
                            <Icon />
                        </span>
                        <div>
                            <p className="ec-inbox-connect-modal__eyebrow">{channel.label}</p>
                            <h2 id="inbox-connect-title">{channel.connectTitle}</h2>
                        </div>
                    </div>
                    <button type="button" className="ec-inbox-connect-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>

                <div className="ec-inbox-connect-modal__body">
                    <p className="ec-inbox-connect-modal__lead">{channel.connectHint}</p>

                    {isMeta && metaOAuth && (
                        <div className="ec-inbox-connect-modal__info">
                            <FaShieldAlt aria-hidden />
                            <span>Meta giriş ekranına yönlendirileceksiniz. Şifreniz Dashtock&apos;ta saklanmaz.</span>
                        </div>
                    )}

                    {isMeta && !metaOAuth && !demoMode && (
                        <div className="ec-inbox-connect-modal__warn">
                            Instagram DM için Meta uygulama anahtarları gerekli. Yönetici .env dosyasına{" "}
                            <strong>META_APP_ID</strong> ve <strong>META_APP_SECRET</strong> eklemelidir.
                        </div>
                    )}

                    {isMarketplace && (
                        <div className="ec-inbox-connect-modal__info">
                            <FaShieldAlt aria-hidden />
                            <span>
                                Sol menü → <strong>Pazaryeri Entegrasyonu</strong> bölümünde hesabınızın bağlı
                                olduğundan emin olun.
                            </span>
                        </div>
                    )}

                    {steps.length > 0 && (
                        <ul className="ec-inbox-connect-modal__steps">
                            {steps.map((step) => (
                                <li key={step}>
                                    <FaCheckCircle aria-hidden />
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {isEmail && (
                        <>
                            <div
                                className={`ec-inbox-connect-modal__mode-tabs${emailTabCount === 3 ? " ec-inbox-connect-modal__mode-tabs--3" : ""}`}
                                role="tablist"
                            >
                                {googleOAuth && (
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={emailMode === "google"}
                                        className={`ec-inbox-connect-modal__mode-tab${emailMode === "google" ? " active" : ""}`}
                                        onClick={() => setEmailMode("google")}
                                    >
                                        Gmail ile giriş
                                    </button>
                                )}
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={emailMode === "mailbox"}
                                    className={`ec-inbox-connect-modal__mode-tab${emailMode === "mailbox" ? " active" : ""}`}
                                    onClick={() => setEmailMode("mailbox")}
                                >
                                    Posta kutusu (IMAP)
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={emailMode === "easy"}
                                    className={`ec-inbox-connect-modal__mode-tab${emailMode === "easy" ? " active" : ""}`}
                                    onClick={() => setEmailMode("easy")}
                                >
                                    Sadece adres
                                </button>
                            </div>

                            {emailMode === "easy" && (
                                <p className="ec-inbox-connect-modal__warn">
                                    Bu mod gelen kutunuzu okumaz. Gmail veya IMAP ile bağlanırsanız mailleriniz Mesajlar&apos;a
                                    düşer.
                                </p>
                            )}

                            {emailMode !== "google" && (
                                <div className="ec-inbox-connect-modal__field">
                                    <label htmlFor="inbox-connect-email">Destek e-postası</label>
                                    <input
                                        id="inbox-connect-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="destek@magaza.com"
                                        autoComplete="email"
                                    />
                                </div>
                            )}

                            {emailMode === "mailbox" && (
                                <>
                                    <div className="ec-inbox-connect-modal__providers" role="group" aria-label="E-posta sağlayıcı">
                                        {Object.entries(EMAIL_PROVIDERS).map(([id, p]) => (
                                            <button
                                                key={id}
                                                type="button"
                                                className={`ec-inbox-connect-modal__provider${emailProvider === id ? " active" : ""}`}
                                                onClick={() => {
                                                    setEmailProvider(id);
                                                    setImapHost(p.host || "");
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="ec-inbox-connect-modal__provider-hint">
                                        {EMAIL_PROVIDERS[emailProvider]?.hint}
                                    </p>
                                    <div className="ec-inbox-connect-modal__field">
                                        <label htmlFor="inbox-connect-imap-pass">Uygulama şifresi</label>
                                        <input
                                            id="inbox-connect-imap-pass"
                                            type="password"
                                            value={imapPassword}
                                            onChange={(e) => setImapPassword(e.target.value)}
                                            placeholder="16 haneli uygulama şifresi"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="ec-inbox-connect-modal__advanced-toggle"
                                        onClick={() => setShowAdvancedImap((v) => !v)}
                                    >
                                        {showAdvancedImap ? "Gelişmiş ayarları gizle" : "Gelişmiş IMAP ayarları"}
                                    </button>
                                    {showAdvancedImap && (
                                        <div className="ec-inbox-connect-modal__field">
                                            <label htmlFor="inbox-connect-imap-host">IMAP sunucu</label>
                                            <input
                                                id="inbox-connect-imap-host"
                                                type="text"
                                                value={imapHost}
                                                onChange={(e) => setImapHost(e.target.value)}
                                                placeholder={EMAIL_PROVIDERS[emailProvider]?.host || "imap.sunucu.com"}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {channel.needsEmail && !isEmail && (
                        <div className="ec-inbox-connect-modal__field">
                            <label htmlFor="inbox-connect-email">Destek e-postası</label>
                            <input
                                id="inbox-connect-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="destek@magaza.com"
                                autoComplete="email"
                            />
                        </div>
                    )}

                    {localError && <p className="ec-inbox-connect-modal__error">{localError}</p>}
                </div>

                <footer className="ec-inbox-connect-modal__foot">
                    {isMeta && metaOAuth ? (
                        <>
                            <button type="button" className="ec-inbox-connect-modal__cancel" onClick={onClose} disabled={connecting}>
                                İptal
                            </button>
                            <button
                                type="button"
                                className={`ec-inbox-connect-modal__oauth-btn${
                                    channel.id === "instagram" ? " ec-inbox-connect-modal__oauth-btn--ig" : ""
                                }`}
                                disabled={connecting}
                                onClick={handleConnect}
                            >
                                {channel.id === "instagram" ? <FaInstagram aria-hidden /> : <Icon aria-hidden />}
                                {primaryLabel}
                            </button>
                        </>
                    ) : isEmail && emailMode === "google" ? (
                        <>
                            <button type="button" className="ec-inbox-connect-modal__cancel" onClick={onClose} disabled={connecting}>
                                İptal
                            </button>
                            <button
                                type="button"
                                className="ec-inbox-connect-modal__oauth-btn ec-inbox-connect-modal__oauth-btn--google"
                                disabled={connecting}
                                onClick={handleConnect}
                            >
                                <FaGoogle aria-hidden />
                                {primaryLabel}
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="ec-inbox-connect-modal__cancel" onClick={onClose} disabled={connecting}>
                                İptal
                            </button>
                            <button
                                type="button"
                                className="ec-inbox-connect-modal__primary"
                                disabled={connecting}
                                onClick={handleConnect}
                            >
                                {primaryLabel}
                            </button>
                        </>
                    )}
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default InboxConnectModal;
