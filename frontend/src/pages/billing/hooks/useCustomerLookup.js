/**
 * VKN/TCKN mükellef sorgusu — Sovos getRAWUserList / QNB efaturaKullaniciBilgisi
 */
import { useState, useCallback, useRef } from "react";
import API from "../../../services/api";

const useCustomerLookup = (activeProvider) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const lastVknRef = useRef("");

    const lookup = useCallback(async (vknRaw) => {
        const vkn = String(vknRaw || "").replace(/\D/g, "");
        if (vkn.length !== 10 && vkn.length !== 11) {
            setError("VKN 10 veya TCKN 11 hane olmalıdır");
            setResult(null);
            return null;
        }
        if (!activeProvider?.sessionId && !activeProvider?.apiToken) {
            setError("Sağlayıcı oturumu bulunamadı. Lütfen yeniden bağlanın.");
            return null;
        }
        if (lastVknRef.current === vkn && result?.customer?.vkn === vkn) {
            return result;
        }

        setLoading(true);
        setError("");
        try {
            const authType = activeProvider.authType || "qnb";
            const endpoint =
                authType === "sovos"
                    ? "/e-invoice/sovos/customer/lookup"
                    : "/e-invoice/qnb/customer/lookup";

            const res = await API.post(endpoint, {
                provider: authType,
                sessionId: activeProvider.sessionId || activeProvider.apiToken,
                token: activeProvider.sessionId || activeProvider.apiToken,
                vkn,
                env: activeProvider.env,
            });

            const data = res.data;
            if (!data.success) {
                setError(data.message || data.error || "Sorgu başarısız");
                setResult(null);
                return null;
            }

            lastVknRef.current = vkn;
            setResult(data);
            return data;
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Bağlantı hatası");
            setResult(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, [activeProvider]);

    const reset = useCallback(() => {
        setError("");
        setResult(null);
        lastVknRef.current = "";
    }, []);

    return { lookup, loading, error, result, reset };
};

export default useCustomerLookup;
