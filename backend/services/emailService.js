/**
 * emailService.js — Resend ile E-posta Gönderimi
 *
 * Spama düşmemek için:
 * - Sade, temiz HTML (aşırı resim/link yok)
 * - Text versiyonu da gönderiliyor
 * - Tek CTA butonu
 * - Unsubscribe bilgisi mevcut
 * - From adresi doğrulanmış domain'den
 */

const { Resend } = require("resend");
const logger = require("../config/logger");

// ✅ FIX: Resend'i lazy init ile oluştur — modül yüklenirken env henüz hazır olmayabilir
let _resend = null;
const getResend = () => {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            logger.error("RESEND_API_KEY tanımlı değil! E-posta gönderilemeyecek.");
            return null;
        }
        _resend = new Resend(apiKey);
    }
    return _resend;
};

const { FROM_EMAIL, REPLY_TO_EMAIL, BRAND_NAME } = require("../config/brand");
const { APP_URL } = require("../config/domain");

const mailHeaders = () => ({
    from: FROM_EMAIL,
    reply_to: REPLY_TO_EMAIL,
});

/** Resend hata mesajını kullanıcı/operatör için okunur hale getir */
function formatResendError(error) {
    if (!error) return "E-posta servisi yanıt vermedi.";
    const msg = error.message || error.error || String(error);
    if (/domain is not verified/i.test(msg)) {
        return `Gönderen domain Resend'de doğrulanmamış (${FROM_EMAIL}). resend.com/domains üzerinden DNS kayıtlarını ekleyin.`;
    }
    if (/only send testing emails to your own/i.test(msg)) {
        return "Resend test modu: yalnızca hesap sahibi e-postasına gönderim yapılabilir. Domain doğrulaması gerekli.";
    }
    return msg;
}

exports.formatResendError = formatResendError;

/**
 * Doğrulama e-postası gönder
 */
exports.sendVerificationEmail = async (user, token, verificationCode) => {
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
    const codeBlock = verificationCode
        ? `
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
                                <tr>
                                    <td style="padding:20px 24px;text-align:center;">
                                        <p style="color:#166534;font-size:13px;font-weight:600;margin:0 0 10px;letter-spacing:0.04em;text-transform:uppercase;">
                                            Doğrulama kodunuz
                                        </p>
                                        <p style="color:#14532d;font-size:32px;font-weight:800;margin:0;letter-spacing:0.35em;font-family:ui-monospace,monospace;">
                                            ${verificationCode}
                                        </p>
                                        <p style="color:#4ade80;font-size:12px;margin:12px 0 0;">
                                            Bu kodu giriş ekranında veya doğrulama sayfasında girebilirsiniz.
                                        </p>
                                    </td>
                                </tr>
                            </table>`
        : "";

    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-posta Doğrulama</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 40px 32px;text-align:center;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="background:rgba(255,255,255,0.2);border-radius:12px;padding:10px 14px;display:inline-block;">
                                        <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.08em;">${BRAND_NAME}</span>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:16px 0 0;font-weight:500;">
                                E-ticaret Yönetim Platformu
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 44px;">
                            <h1 style="color:#1a1a2e;font-size:24px;font-weight:700;margin:0 0 8px;text-align:center;">
                                E-posta Adresinizi Doğrulayın
                            </h1>
                            <p style="color:#64748b;font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">
                                Merhaba <strong style="color:#1a1a2e;">${user.name}</strong>, ${BRAND_NAME}'e hoş geldiniz!<br>
                                Hesabınızı aktifleştirmek için doğrulama kodunu girin veya aşağıdaki butona tıklayın.
                            </p>

                            ${codeBlock}

                            <!-- CTA Button -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                                        <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:16px 48px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">
                                            Hesabımı Doğrula ✓
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;margin:28px 0 0;">
                                Bu bağlantı güvenliğiniz için <strong>24 saat</strong> geçerlidir.<br>
                                Eğer bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.
                            </p>

                            <!-- Fallback link -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="color:#64748b;font-size:12px;margin:0 0 6px;font-weight:600;">
                                            Buton çalışmıyorsa bu bağlantıyı tarayıcınıza yapıştırın:
                                        </p>
                                        <p style="color:#6366f1;font-size:12px;margin:0;word-break:break-all;">
                                            ${verifyUrl}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8fafc;padding:24px 44px;border-top:1px solid #e2e8f0;">
                            <p style="color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;margin:0;">
                                Bu e-posta ${BRAND_NAME} hesap doğrulama işlemi için gönderilmiştir.<br>
                                © ${new Date().getFullYear()} ${BRAND_NAME}. Tüm hakları saklıdır.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    // Plain text versiyonu (spam filtrelerini geçmek için önemli)
    const textContent = `Merhaba ${user.name},

${BRAND_NAME}'e hoş geldiniz!
${verificationCode ? `\nDoğrulama kodunuz: ${verificationCode}\n` : ""}
Hesabınızı aktifleştirmek için bağlantı:
${verifyUrl}

Bu kod ve bağlantı 24 saat geçerlidir.
Eğer bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.

© ${new Date().getFullYear()} ${BRAND_NAME}`;

    try {
        const resend = getResend();
        if (!resend) return { success: false, error: "RESEND_API_KEY tanımlı değil" };

        const { data, error } = await resend.emails.send({
            ...mailHeaders(),
            to: [user.email],
            subject: `${BRAND_NAME} — E-posta Adresinizi Doğrulayın`,
            html: htmlContent,
            text: textContent,
        });

        if (error) {
            const detail = formatResendError(error);
            logger.error(`Resend doğrulama e-postası hatası → ${user.email}: ${detail}`);
            return { success: false, error, message: detail };
        }

        logger.info(`Doğrulama e-postası gönderildi: ${user.email} (ID: ${data?.id}) from=${FROM_EMAIL}`);
        return { success: true, id: data?.id };
    } catch (err) {
        logger.error(`E-posta gönderim hatası: ${err.message}`);
        return { success: false, error: err.message, message: err.message };
    }
};

/**
 * 2FA doğrulama kodu e-postası gönder
 * ✅ P2-3: İki faktörlü kimlik doğrulama
 */
exports.send2FACodeEmail = async (user, code) => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2FA Doğrulama Kodu</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#059669,#10b981);padding:40px 40px 32px;text-align:center;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="background:rgba(255,255,255,0.2);border-radius:12px;padding:10px 14px;display:inline-block;">
                                        <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.08em;">${BRAND_NAME}</span>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:16px 0 0;font-weight:500;">
                                🔐 İki Faktörlü Doğrulama
                            </p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 44px;">
                            <h1 style="color:#1a1a2e;font-size:24px;font-weight:700;margin:0 0 8px;text-align:center;">
                                Giriş Doğrulama Kodu
                            </h1>
                            <p style="color:#64748b;font-size:15px;line-height:1.6;text-align:center;margin:0 0 32px;">
                                Merhaba <strong style="color:#1a1a2e;">${user.name}</strong>,<br>
                                Hesabınıza giriş yapmak için aşağıdaki kodu kullanın.
                            </p>
                            <!-- Code Box -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="background:#f0fdf4;border:2px dashed #059669;border-radius:16px;padding:24px 48px;text-align:center;">
                                        <span style="font-size:36px;font-weight:900;letter-spacing:0.3em;color:#059669;font-family:monospace;">
                                            ${code}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;margin:28px 0 0;">
                                Bu kod güvenliğiniz için <strong>5 dakika</strong> geçerlidir.<br>
                                Eğer bu giriş denemesini siz yapmadıysanız, şifrenizi hemen değiştirin.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8fafc;padding:24px 44px;border-top:1px solid #e2e8f0;">
                            <p style="color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;margin:0;">
                                Bu e-posta ${BRAND_NAME} iki faktörlü doğrulama için gönderilmiştir.<br>
                                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. Tüm hakları saklıdır.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const textContent = `Merhaba ${user.name},

Hesabınıza giriş yapmak için aşağıdaki doğrulama kodunu kullanın:

${code}

Bu kod 5 dakika geçerlidir.
Eğer bu giriş denemesini siz yapmadıysanız, şifrenizi hemen değiştirin.

© ${new Date().getFullYear()} ${BRAND_NAME}`;

    try {
        const resend = getResend();
        if (!resend) return { success: false, error: "RESEND_API_KEY tanımlı değil" };

        const { data, error } = await resend.emails.send({
            ...mailHeaders(),
            to: [user.email],
            subject: `${BRAND_NAME} — Giriş Doğrulama Kodu (2FA)`,
            html: htmlContent,
            text: textContent,
        });

        if (error) {
            logger.error(`Resend 2FA e-posta hatası: ${JSON.stringify(error)}`);
            return { success: false, error };
        }

        logger.info(`2FA kodu gönderildi: ${user.email} (ID: ${data?.id})`);
        return { success: true, id: data?.id };
    } catch (err) {
        logger.error(`2FA e-posta gönderim hatası: ${err.message}`);
        return { success: false, error: err.message };
    }
};

/**
 * Şifre sıfırlama kodu e-postası gönder
 */
exports.sendPasswordResetEmail = async (user, code) => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Şifre Sıfırlama</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 40px 32px;text-align:center;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="background:rgba(255,255,255,0.2);border-radius:12px;padding:10px 14px;display:inline-block;">
                                        <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.08em;">${BRAND_NAME}</span>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:16px 0 0;font-weight:500;">
                                E-ticaret Yönetim Platformu
                            </p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:40px 44px;">
                            <h1 style="color:#1a1a2e;font-size:24px;font-weight:700;margin:0 0 8px;text-align:center;">
                                Şifre Sıfırlama Kodu
                            </h1>
                            <p style="color:#64748b;font-size:15px;line-height:1.6;text-align:center;margin:0 0 32px;">
                                Merhaba <strong style="color:#1a1a2e;">${user.name}</strong>,<br>
                                Şifrenizi sıfırlamak için aşağıdaki kodu kullanın.
                            </p>
                            <!-- Code Box -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                                <tr>
                                    <td style="background:#f8fafc;border:2px dashed #6366f1;border-radius:16px;padding:24px 48px;text-align:center;">
                                        <span style="font-size:36px;font-weight:900;letter-spacing:0.3em;color:#6366f1;font-family:monospace;">
                                            ${code}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;margin:28px 0 0;">
                                Bu kod güvenliğiniz için <strong>15 dakika</strong> geçerlidir.<br>
                                Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8fafc;padding:24px 44px;border-top:1px solid #e2e8f0;">
                            <p style="color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;margin:0;">
                                Bu e-posta ${BRAND_NAME} şifre sıfırlama işlemi için gönderilmiştir.<br>
                                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. Tüm hakları saklıdır.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const textContent = `Merhaba ${user.name},

Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:

${code}

Bu kod 15 dakika geçerlidir.
Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.

© ${new Date().getFullYear()} ${BRAND_NAME}`;

    try {
        const resend = getResend();
        if (!resend) return { success: false, error: "RESEND_API_KEY tanımlı değil" };

        const { data, error } = await resend.emails.send({
            ...mailHeaders(),
            to: [user.email],
            subject: `${BRAND_NAME} — Şifre Sıfırlama Kodu`,
            html: htmlContent,
            text: textContent,
        });

        if (error) {
            logger.error(`Resend şifre sıfırlama e-posta hatası: ${JSON.stringify(error)}`);
            return { success: false, error };
        }

        logger.info(`Şifre sıfırlama kodu gönderildi: ${user.email} (ID: ${data?.id})`);
        return { success: true, id: data?.id };
    } catch (err) {
        logger.error(`Şifre sıfırlama e-posta hatası: ${err.message}`);
        return { success: false, error: err.message };
    }
};

function fmtMoneyTl(amount, currency = "TRY") {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";
    if (currency === "TRY") {
        return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${n.toLocaleString("tr-TR")} ${currency}`;
}

function fmtDateTr(d) {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function billingCycleLabel(cycle) {
    return cycle === "yearly" ? "Yıllık" : "Aylık";
}

/**
 * Ödeme başarılı — şık onay + PayTR dekont özeti (e-posta içi)
 */
exports.sendPaymentSuccessEmail = async (user, { payment, subscription, receipt = {} }) => {
    const planName = subscription?.planName || subscription?.plan || "Paket";
    const cycleLabel = billingCycleLabel(subscription?.billingCycle);
    const dashboardUrl = `${APP_URL}/dashboard`;
    const subscriptionUrl = `${APP_URL}/subscription`;

    const paidAt = payment?.paidAt || new Date();
    const amountDisplay = receipt?.amount
        ? `${receipt.amount} ${receipt.currency || payment?.currency || "TL"}`
        : fmtMoneyTl(payment?.amount, payment?.currency);

    const installmentNum = parseInt(receipt?.installment, 10);
    const installmentLabel =
        installmentNum > 1 ? `${installmentNum} taksit` : "Tek çekim";

    const receiptRows = [
        ["Sipariş no", payment?.transactionId || "—"],
        ["İşlem tarihi", receipt?.paymentDate || fmtDateTr(paidAt)],
        ["Tutar", amountDisplay],
        ["Paket", `${planName} (${cycleLabel})`],
        ["Geçerlilik", fmtDateTr(subscription?.endDate)],
        ["Ödeme yöntemi", "PayTR · Kredi/Banka Kartı"],
    ];
    if (receipt?.cardBrand) {
        receiptRows.push(["Kart programı", String(receipt.cardBrand).toUpperCase()]);
    }
    if (receipt?.installment != null && receipt?.installment !== "") {
        receiptRows.push(["Taksit", installmentLabel]);
    }
    if (payment?.invoiceNumber) {
        receiptRows.push(["Fatura / referans", payment.invoiceNumber]);
    }

    const receiptTableRows = receiptRows
        .map(
            ([label, value]) => `
        <tr>
            <td style="padding:10px 0;color:#64748b;font-size:13px;width:42%;vertical-align:top;border-bottom:1px solid #e2e8f0;">${label}</td>
            <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">${value}</td>
        </tr>`
        )
        .join("");

    const testBanner = receipt?.isTest
        ? `<p style="margin:0 0 12px;padding:10px 12px;background:#fef3c7;border-radius:8px;color:#92400e;font-size:12px;font-weight:600;text-align:center;">Test modu ödemesi — canlı tahsilat değildir</p>`
        : "";

    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ödeme Onayı</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2ff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2ff;padding:36px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                    <tr>
                        <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#06b6d4 100%);border-radius:20px 20px 0 0;padding:36px 32px 28px;text-align:center;">
                            <p style="margin:0 0 8px;color:rgba(255,255,255,0.85);font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Ödeme alındı</p>
                            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.02em;">Teşekkürler, ${user.name || "Değerli müşterimiz"}!</h1>
                            <p style="margin:14px 0 0;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.55;">
                                <strong>${planName}</strong> paketiniz aktifleştirildi.<br>
                                Artık tüm özelliklere erişebilirsiniz.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:#ffffff;padding:32px 28px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                                <tr>
                                    <td width="50%" style="padding:14px 16px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;vertical-align:top;">
                                        <p style="margin:0 0 4px;color:#166534;font-size:11px;font-weight:700;text-transform:uppercase;">Ödenen tutar</p>
                                        <p style="margin:0;color:#14532d;font-size:22px;font-weight:800;">${fmtMoneyTl(payment?.amount, payment?.currency)}</p>
                                    </td>
                                    <td width="8"></td>
                                    <td width="50%" style="padding:14px 16px;background:#eef2ff;border-radius:12px;border:1px solid #c7d2fe;vertical-align:top;">
                                        <p style="margin:0 0 4px;color:#4338ca;font-size:11px;font-weight:700;text-transform:uppercase;">Paket bitiş</p>
                                        <p style="margin:0;color:#312e81;font-size:15px;font-weight:700;line-height:1.35;">${fmtDateTr(subscription?.endDate)}</p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 10px;color:#1e293b;font-size:16px;font-weight:700;">Ödeme dekontu</p>
                            <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;">
                                PayTR üzerinden alınan ödemenize ait özet bilgiler aşağıdadır.
                                Resmi makbuz için PayTR işlem kayıtlarınızı da saklayabilirsiniz.
                            </p>
                            ${testBanner}
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:4px 18px 8px;margin-bottom:24px;">
                                <tr><td>${receiptTableRows}</td></tr>
                            </table>

                            ${payment?.description ? `<p style="margin:0 0 20px;color:#64748b;font-size:12px;"><strong>Açıklama:</strong> ${payment.description}</p>` : ""}

                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                                <tr>
                                    <td style="border-radius:12px;background:linear-gradient(135deg,#6366f1,#7c3aed);">
                                        <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:15px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Panele git →</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="text-align:center;margin:0;">
                                <a href="${subscriptionUrl}" style="color:#6366f1;font-size:13px;font-weight:600;text-decoration:none;">Abonelik detayları</a>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:#f8fafc;padding:22px 28px;border-radius:0 0 20px 20px;border:1px solid #e2e8f0;border-top:none;">
                            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
                                Bu e-posta ${BRAND_NAME} ödeme onayı için gönderilmiştir.<br>
                                Sorularınız için bu mesaja yanıt verebilirsiniz.<br>
                                © ${new Date().getFullYear()} ${BRAND_NAME}
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    const textLines = [
        `Merhaba ${user.name || ""},`,
        "",
        `${BRAND_NAME} — Ödemeniz alındı`,
        `${planName} paketiniz (${cycleLabel}) aktifleştirildi.`,
        "",
        "Ödeme dekontu:",
        ...receiptRows.map(([l, v]) => `  ${l}: ${v}`),
        "",
        `Panele git: ${dashboardUrl}`,
        "",
        `© ${new Date().getFullYear()} ${BRAND_NAME}`,
    ];

    try {
        const resend = getResend();
        if (!resend) return { success: false, error: "RESEND_API_KEY tanımlı değil" };

        const { data, error } = await resend.emails.send({
            ...mailHeaders(),
            to: [user.email],
            subject: `${BRAND_NAME} — Ödemeniz alındı · ${planName} aktif`,
            html: htmlContent,
            text: textLines.join("\n"),
        });

        if (error) {
            logger.error(`Resend ödeme onay e-postası: ${JSON.stringify(error)}`);
            return { success: false, error: formatResendError(error) };
        }

        return { success: true, id: data?.id };
    } catch (err) {
        logger.error(`Ödeme onay e-postası: ${err.message}`);
        return { success: false, error: err.message };
    }
};
