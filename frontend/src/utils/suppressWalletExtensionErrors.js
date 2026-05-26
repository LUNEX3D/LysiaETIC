/**
 * MetaMask vb. cüzdan eklentileri her sayfaya enjekte olur; bağlantı reddedilince
 * yakalanmamış promise rejection oluşur. Dashtock Web3 kullanmaz — bu gürültüyü yutarız.
 */
const walletNoisePattern =
    /metamask|failed to connect to metamask|nkbihfbeogaeaoehlefnkodbefgpgknn|walletconnect/i;

const isWalletExtensionNoise = (value) => {
    if (!value) return false;
    const parts = [
        typeof value === "string" ? value : "",
        value?.message,
        value?.reason?.message,
        value?.toString?.(),
        value?.stack,
        value?.filename,
    ]
        .filter(Boolean)
        .join(" ");
    return walletNoisePattern.test(parts);
};

export function suppressWalletExtensionErrors() {
    if (typeof window === "undefined") return;

    window.addEventListener(
        "unhandledrejection",
        (event) => {
            if (isWalletExtensionNoise(event.reason)) {
                event.preventDefault();
            }
        },
        true
    );

    window.addEventListener(
        "error",
        (event) => {
            if (
                isWalletExtensionNoise(event.error) ||
                isWalletExtensionNoise(event.message) ||
                isWalletExtensionNoise(event.filename)
            ) {
                event.preventDefault();
            }
        },
        true
    );
}
