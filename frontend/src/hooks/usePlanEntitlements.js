import { useCallback, useEffect, useState } from "react";
import axios from "../services/api";

/**
 * Abonelik + paket özellik hakları (/paytr/subscription)
 */
export default function usePlanEntitlements() {
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState("trial");
    const [planDisplayName, setPlanDisplayName] = useState("");
    const [entitlements, setEntitlements] = useState({});
    const [limits, setLimits] = useState({});
    const [upgradeHint, setUpgradeHint] = useState("pro");
    const [isActive, setIsActive] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get("/paytr/subscription");
            if (res.data?.success) {
                const sub = res.data.subscription || {};
                setPlan(sub.plan || "trial");
                setPlanDisplayName(res.data.planDisplayName || sub.plan || "trial");
                setEntitlements(res.data.entitlements || {});
                setLimits(res.data.limits || {});
                setUpgradeHint(res.data.upgradeHint || "pro");
                setIsActive(!!sub.isActive);
            }
        } catch {
            setEntitlements({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const canAccess = useCallback(
        (featureId) => {
            const role = (localStorage.getItem("userRole") || "").toLowerCase();
            if (role === "admin" || role === "dev") return true;
            if (entitlements && Object.keys(entitlements).length > 0) {
                return !!entitlements[featureId];
            }
            return true;
        },
        [entitlements]
    );

    return {
        loading,
        plan,
        planDisplayName,
        entitlements,
        limits,
        upgradeHint,
        isActive,
        canAccess,
        reload: load
    };
}
