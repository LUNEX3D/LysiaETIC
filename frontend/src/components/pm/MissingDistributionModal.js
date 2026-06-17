/**
 * Eksikleri Dağıt — önizleme, canlı job takibi, kategori merkezi + manuel kategori
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaTimes,
    FaRocket,
    FaSpinner,
    FaSearch,
    FaCheckCircle,
    FaExclamationTriangle,
    FaForward,
    FaSitemap,
    FaBoxOpen,
    FaWarehouse,
    FaCheck,
    FaQuestionCircle,
    FaPause,
    FaPlay,
    FaStop,
} from "react-icons/fa";
import {
    getMissingDistributionPreview,
    startMissingDistributionJob,
    getSyncJobStatus,
    distributeMissingItem,
    pauseSyncJob,
    resumeSyncJob,
    cancelSyncJob,
} from "../../services/productManagementApi";
import {
    getStoredMissingDistJob,
    setStoredMissingDistJob,
    clearStoredMissingDistJob,
    isActiveJobStatus,
} from "../../stores/missingDistributionJobStore";
import { searchCategories } from "../../services/categoryCenterApi";
import "../../styles/MissingDistributionModal.css";

const PLATFORM_META = {
    trendyol: { label: "Trendyol", color: "#F27A1A" },
    hepsiburada: { label: "Hepsiburada", color: "#FF6000" },
    n11: { label: "N11", color: "#7B2D8E" },
    ciceksepeti: { label: "ÇiçekSepeti", color: "#E91E63" },
    amazon: { label: "Amazon", color: "#FF9900" },
    ozon: { label: "Ozon", color: "#005BFF" },
};

const normMP = (n) => {
    if (!n) return "";
    const l = String(n).trim().toLowerCase();
    if (l === "trendyol") return "trendyol";
    if (l === "hepsiburada") return "hepsiburada";
    if (l === "n11") return "n11";
    if (l === "amazon" || l === "amazon türkiye") return "amazon";
    if (l === "çiçeksepeti" || l === "ciceksepeti") return "ciceksepeti";
    if (l === "ozon") return "ozon";
    return l;
};

const platformMeta = (name) => {
    const k = normMP(name);
    return PLATFORM_META[k] || { label: name, color: "#0d9488" };
};

const formatEta = (sec) => {
    if (sec == null || Number.isNaN(Number(sec))) return "—";
    const s = Math.max(0, Math.round(Number(sec)));
    if (s < 60) return `~${s} sn`;
    if (s < 3600) return `~${Math.ceil(s / 60)} dk`;
    return `~${Math.ceil(s / 3600)} sa`;
};

const isMongoQuotaMessage = (text) =>
    /space quota|writes are blocked|over your space quota/i.test(String(text || ""));

const parseDistributionAlert = (message, reason) => {
    const raw = String(message || "").trim();
    if (!raw) {
        if (reason === "no_category") {
            return {
                kind: "info",
                title: "Kategori Merkezi eşleşmesi yok — aşağıdan platform kategorisi seçin.",
                detail: null,
                suppress: false,
            };
        }
        return { kind: "info", title: "Kategori seçin veya atlayın.", detail: null, suppress: false };
    }

    if (isMongoQuotaMessage(raw)) {
        return {
            kind: "critical",
            title: "Veritabanı kotası dolu — sonuç kaydedilemedi",
            detail: null,
            suppress: true,
        };
    }

    if (/seller stock code|stok kodu.*kullanılmaktadır|stock code.*already/i.test(raw)) {
        const sku = raw.match(/LA-[\w-]+/)?.[0] || "";
        return {
            kind: "warn",
            title: sku
                ? `N11: «${sku}» stok kodu mağazanızda zaten kayıtlı`
                : "N11: Bu stok kodu mağazanızda zaten kullanılıyor",
            detail:
                "Aynı seller stock code başka bir N11 ürününde var. Ürün SKU'sunu değiştirin veya N11 panelinden mevcut kaydı bulup ürünü eşleştirin.",
            suppress: false,
        };
    }

    if (reason === "no_category" && raw.length < 100 && !/error|failed|hata/i.test(raw)) {
        return { kind: "info", title: raw, detail: null, suppress: false };
    }

    if (raw.length > 140) {
        return {
            kind: "error",
            title: raw.length > 90 ? `${raw.slice(0, 90)}…` : raw,
            detail: raw,
            suppress: false,
        };
    }

    return { kind: "error", title: raw, detail: null, suppress: false };
};

const DistributionAlert = ({ alert }) => {
    if (!alert || alert.suppress) return null;
    const Icon = alert.kind === "info" ? FaSitemap : FaExclamationTriangle;
    return (
        <div className={`mdm-alert mdm-alert--${alert.kind}`}>
            <div className="mdm-alert__title">
                <Icon />
                <span>{alert.title}</span>
            </div>
            {alert.detail && <div className="mdm-alert__detail">{alert.detail}</div>}
        </div>
    );
};

const MissingDistributionModal = ({ open, onClose, onComplete }) => {
    // phase: "ask" → kapsam seçimi + onay; sonra "loading"/"preview"/...
    const [phase, setPhase] = useState("ask");
    const [scope, setScope] = useState(null); // "all" | "inStock"
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState("");
    const [job, setJob] = useState(null);
    const [pendingItems, setPendingItems] = useState([]);
    const [expandedPlatform, setExpandedPlatform] = useState(null);
    const pollRef = useRef(null);
    const catTimersRef = useRef({});
    const [itemUi, setItemUi] = useState({});
    const [jobId, setJobId] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null); // "pause" | "cancel"
    const [controlBusy, setControlBusy] = useState(false);

    const applyJobState = useCallback((j) => {
        setJob(j);
        if (j?.platformStats?.length) {
            setPreview((prev) => ({
                ...(prev || {}),
                platforms: j.platformStats,
                stats: prev?.stats || { totalMissingSlots: j.total },
            }));
        }
    }, []);

    const finishJob = useCallback(
        (j, pending) => {
            clearStoredMissingDistJob();
            setPendingItems(pending);
            if (j.status === "cancelled") {
                setPhase("cancelled");
                setError("");
            } else {
                setPhase(pending.length ? "pending" : "done");
            }
            onComplete?.(j.result);
        },
        [onComplete]
    );

    const pollJob = useCallback(
        (id) => {
            const tick = async () => {
                try {
                    const data = await getSyncJobStatus(id);
                    const j = data.job;
                    applyJobState(j);

                    if (isActiveJobStatus(j.status)) {
                        pollRef.current = setTimeout(tick, 1000);
                        setPhase(j.status === "paused" ? "paused" : "running");
                        return;
                    }
                    if (j.status === "completed") {
                        const pending = j.result?.pendingItems || [];
                        finishJob(j, pending);
                        return;
                    }
                    if (j.status === "cancelled") {
                        const pending = j.result?.pendingItems || [];
                        finishJob(j, pending);
                        return;
                    }
                    setError(j.error || "İşlem başarısız");
                    clearStoredMissingDistJob();
                    setPhase("error");
                } catch (e) {
                    setError(e.response?.data?.error || "Durum alınamadı");
                    setPhase("error");
                }
            };
            tick();
        },
        [applyJobState, finishJob]
    );

    const restoreActiveJob = useCallback(async () => {
        const stored = getStoredMissingDistJob();
        if (!stored?.jobId) return false;
        try {
            const data = await getSyncJobStatus(stored.jobId);
            const j = data.job;
            if (!j || !isActiveJobStatus(j.status)) {
                if (j?.status === "completed" || j?.status === "cancelled") {
                    const pending = j.result?.pendingItems || [];
                    setJobId(stored.jobId);
                    setScope(stored.scope || null);
                    applyJobState(j);
                    finishJob(j, pending);
                    return true;
                }
                clearStoredMissingDistJob();
                return false;
            }
            setJobId(stored.jobId);
            setScope(stored.scope || null);
            applyJobState(j);
            setPhase(j.status === "paused" ? "paused" : "running");
            pollJob(stored.jobId);
            return true;
        } catch {
            return false;
        }
    }, [applyJobState, finishJob, pollJob]);

    useEffect(() => {
        if (!open) {
            if (pollRef.current) clearTimeout(pollRef.current);
            return;
        }

        let cancelled = false;
        (async () => {
            const restored = await restoreActiveJob();
            if (cancelled) return;
            if (!restored) {
                setPhase("ask");
                setScope(null);
                setPreview(null);
                setError("");
                setPendingItems([]);
                setJob(null);
                setJobId(null);
                setItemUi({});
                setConfirmAction(null);
            }
        })();

        return () => {
            cancelled = true;
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, [open, restoreActiveJob]);

    const loadPreview = useCallback(async (onlyInStock = false) => {
        setPhase("loading");
        setError("");
        try {
            const data = await getMissingDistributionPreview({ onlyInStock: onlyInStock ? "true" : undefined });
            setPreview(data);
            if (!data.stats?.totalMissingSlots) {
                setPhase("empty");
            } else {
                setPhase("preview");
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Önizleme yüklenemedi");
            setPhase("error");
        }
    }, []);

    const handleConfirmScope = () => {
        if (!scope) return;
        loadPreview(scope === "inStock");
    };

    const handleStart = async () => {
        setPhase("starting");
        setError("");
        try {
            const data = await startMissingDistributionJob({ onlyInStock: scope === "inStock" });
            if (!data.jobId) {
                setPhase("empty");
                return;
            }
            const id = data.jobId;
            setJobId(id);
            setStoredMissingDistJob({ jobId: id, scope, startedAt: Date.now() });
            setPreview((prev) => prev || { platforms: data.platforms, stats: data.stats, categoryCheckDeferred: true });
            setJob({ status: "running", progressPercent: 0, message: "Başlatılıyor…", platformStats: data.platforms });
            setPhase("running");
            pollJob(id);
        } catch (e) {
            setError(e.response?.data?.error || "İş başlatılamadı");
            setPhase("error");
        }
    };

    const handleClose = () => {
        if (pollRef.current) clearTimeout(pollRef.current);
        onClose?.();
    };

    const runConfirmedControl = async () => {
        if (!jobId || !confirmAction) return;
        setControlBusy(true);
        try {
            if (confirmAction === "pause") {
                await pauseSyncJob(jobId);
                setPhase("paused");
            } else if (confirmAction === "cancel") {
                await cancelSyncJob(jobId);
            } else if (confirmAction === "resume") {
                await resumeSyncJob(jobId);
                setPhase("running");
                pollJob(jobId);
            }
            setConfirmAction(null);
        } catch (e) {
            setError(e.response?.data?.error || "İşlem başarısız");
        } finally {
            setControlBusy(false);
        }
    };

    const setItemField = (key, patch) => {
        setItemUi((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
    };

    const handleCatSearch = (key, platform, query) => {
        setItemField(key, { catQuery: query, catResults: [], catLoading: false });
        if (catTimersRef.current[key]) clearTimeout(catTimersRef.current[key]);
        if (!query || query.trim().length < 2) return;
        catTimersRef.current[key] = setTimeout(async () => {
            setItemField(key, { catLoading: true });
            try {
                const apiName =
                    normMP(platform) === "ciceksepeti" ? "ÇiçekSepeti" : platformMeta(platform).label;
                const res = await searchCategories(apiName, query.trim(), { listingOnly: true });
                setItemField(key, { catResults: res?.data?.results || [], catLoading: false });
            } catch {
                setItemField(key, { catResults: [], catLoading: false });
            }
        }, 400);
    };

    const handleDistributeItem = async (item, category) => {
        const key = `${item.productId}-${item.platform}`;
        setItemField(key, { sending: true });
        try {
            await distributeMissingItem(item.productId, item.platform, category);
            setPendingItems((prev) => prev.filter((p) => !(p.productId === item.productId && p.platform === item.platform)));
            setItemField(key, { sending: false, done: true });
        } catch (e) {
            const msg =
                e.response?.data?.message ||
                e.response?.data?.error ||
                e.response?.data?.details ||
                "Gönderilemedi";
            setItemField(key, { sending: false, err: msg });
        }
    };

    const handleSkip = (item) => {
        setPendingItems((prev) => prev.filter((p) => !(p.productId === item.productId && p.platform === item.platform)));
    };

    if (!open) return null;

    const liveStats = job?.platformStats || preview?.platforms || [];
    const summary = preview?.stats;
    const categoryDeferred = preview?.categoryCheckDeferred || preview?.stats?.categoryCheckDeferred;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                className="mdm-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
            >
                <motion.div
                    className="mdm-panel"
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className="mdm-header">
                        <div>
                            <h2>
                                <FaRocket style={{ marginRight: 8, color: "var(--ud-pm-purple)" }} />
                                Eksikleri Dağıt
                            </h2>
                            <p>
                                Kategori Merkezi eşleşmesi olan ürünler otomatik gönderilir. Kategori eksik olanlar
                                aşağıda listelenir — arayıp seçebilir veya atlayabilirsiniz.
                            </p>
                        </div>
                        <button type="button" className="mdm-close" onClick={handleClose} aria-label="Kapat">
                            <FaTimes />
                        </button>
                    </header>

                    <div className="mdm-body">
                        {phase === "ask" && (
                            <div className="mdm-ask">
                                <div className="mdm-ask-icon">
                                    <FaQuestionCircle />
                                </div>
                                <h3 className="mdm-ask-title">Hangi ürünler dağıtılsın?</h3>
                                <p className="mdm-ask-sub">
                                    Platformlarda eksik olan ürünler, Kategori Merkezi eşleşmesine göre canlı dağıtılır.
                                    Önce kapsamı seçin.
                                </p>

                                <div className="mdm-scope-grid">
                                    <button
                                        type="button"
                                        className={`mdm-scope-card ${scope === "all" ? "selected" : ""}`}
                                        onClick={() => setScope("all")}
                                    >
                                        <span className="mdm-scope-card__icon"><FaBoxOpen /></span>
                                        <span className="mdm-scope-card__title">Tüm ürünler</span>
                                        <span className="mdm-scope-card__desc">
                                            Stoğu olsun olmasın, eksik olan tüm ürünler dağıtılır.
                                        </span>
                                        {scope === "all" && <span className="mdm-scope-card__check"><FaCheck /></span>}
                                    </button>

                                    <button
                                        type="button"
                                        className={`mdm-scope-card ${scope === "inStock" ? "selected" : ""}`}
                                        onClick={() => setScope("inStock")}
                                    >
                                        <span className="mdm-scope-card__icon"><FaWarehouse /></span>
                                        <span className="mdm-scope-card__title">Sadece stoklu ürünler</span>
                                        <span className="mdm-scope-card__desc">
                                            Yalnızca stok adedi 0'dan büyük olan ürünler dağıtılır (önerilen).
                                        </span>
                                        {scope === "inStock" && <span className="mdm-scope-card__check"><FaCheck /></span>}
                                    </button>
                                </div>

                                <div className={`mdm-ask-confirm ${scope ? "active" : ""}`}>
                                    <FaExclamationTriangle />
                                    <span>
                                        Eksik ürünleri{" "}
                                        <strong>{scope === "inStock" ? "(sadece stoklu)" : scope === "all" ? "(tümü)" : ""}</strong>{" "}
                                        dağıtmak istediğinizden emin misiniz?
                                    </span>
                                </div>
                            </div>
                        )}

                        {phase === "loading" && (
                            <div className="mdm-loading">
                                <FaSpinner className="ud-pm-spin" style={{ fontSize: 28 }} />
                                <span>Eksik ürünler taranıyor…</span>
                            </div>
                        )}

                        {phase === "error" && (
                            <div className="mdm-empty">
                                <FaExclamationTriangle style={{ color: "#f87171", fontSize: 28, marginBottom: 12 }} />
                                <p>{error}</p>
                                <button type="button" className="ud-pm-btn accent outline" style={{ marginTop: 12 }} onClick={loadPreview}>
                                    Tekrar dene
                                </button>
                            </div>
                        )}

                        {phase === "empty" && (
                            <div className="mdm-empty">
                                <FaCheckCircle style={{ color: "#4ade80", fontSize: 32, marginBottom: 12 }} />
                                <p>Tüm ürünler bağlı platformlarda mevcut görünüyor.</p>
                            </div>
                        )}

                        {(phase === "preview" || phase === "running" || phase === "paused" || phase === "starting" || phase === "done" || phase === "pending" || phase === "cancelled") && (
                            <>
                                {summary && (
                                    <div className="mdm-progress-block">
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px", fontSize: 12 }}>
                                            <span>
                                                Toplam eksik: <strong>{summary.totalMissingSlots}</strong>
                                            </span>
                                            {!categoryDeferred && summary.readyCount != null && (
                                                <span>
                                                    Hazır (kategori OK):{" "}
                                                    <strong style={{ color: "#4ade80" }}>{summary.readyCount}</strong>
                                                </span>
                                            )}
                                            {!categoryDeferred && summary.noCategoryCount != null && (
                                                <span>
                                                    Kategori gerekli:{" "}
                                                    <strong style={{ color: "#facc15" }}>{summary.noCategoryCount}</strong>
                                                </span>
                                            )}
                                            {categoryDeferred && (
                                                <span style={{ color: "var(--ud-pm-text-dim)" }}>
                                                    Kategori eşleşmesi dağıtım sırasında kontrol edilir
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="mdm-platform-grid">
                                    {liveStats.map((p) => {
                                        const meta = platformMeta(p.platform);
                                        const missing = p.missingCount ?? p.items?.length ?? 0;
                                        const live = phase === "running" || phase === "paused" || phase === "done" || phase === "cancelled";
                                        return (
                                            <div
                                                key={p.platform}
                                                className="mdm-platform-card"
                                                style={{ "--mdm-accent": meta.color }}
                                            >
                                                <h4>{meta.label}</h4>
                                                <div className="mdm-platform-stats">
                                                    <span>
                                                        Eksik: <strong>{missing}</strong>
                                                    </span>
                                                    {live && (
                                                        <>
                                                            <span>
                                                                OK: <strong>{p.success ?? 0}</strong>
                                                            </span>
                                                            <span>
                                                                Hata: <strong>{p.error ?? 0}</strong>
                                                            </span>
                                                            {(p.noCategoryCount > 0 || p.skipped > 0) && (
                                                                <span>
                                                                    Kategori: <strong>{p.noCategoryCount ?? p.skipped ?? 0}</strong>
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {!live && !categoryDeferred && (
                                                        <>
                                                            <span>
                                                                Hazır: <strong>{p.readyCount ?? 0}</strong>
                                                            </span>
                                                            <span>
                                                                Kategori yok: <strong>{p.noCategoryCount ?? 0}</strong>
                                                            </span>
                                                        </>
                                                    )}
                                                    {p.processing && (
                                                        <span>
                                                            <FaSpinner className="ud-pm-spin" /> işleniyor
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {(phase === "running" || phase === "paused" || phase === "starting") && job && (
                                    <div className="mdm-progress-block">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                {phase === "paused" ? "Duraklatıldı" : "Canlı dağıtım"}
                                            </div>
                                            {phase === "paused" && (
                                                <span className="mdm-badge no-cat">Arka planda bekliyor</span>
                                            )}
                                        </div>
                                        <div className="mdm-progress-bar">
                                            <div
                                                className="mdm-progress-fill"
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, Number(job.progressPercent) || 0))}%`,
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                fontSize: 11,
                                                color: "var(--ud-pm-text-sub)",
                                                flexWrap: "wrap",
                                                gap: 8,
                                            }}
                                        >
                                            <span>%{Math.round(Number(job.progressPercent) || 0)}</span>
                                            <span>Kalan: {formatEta(job.etaSeconds)}</span>
                                        </div>
                                        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ud-pm-text-dim)" }}>
                                            {job.message || "…"}
                                        </p>
                                    </div>
                                )}

                                {phase === "preview" && preview?.platforms?.length > 0 && (
                                    <>
                                        <div className="mdm-section-title">Platform detayı</div>
                                        {preview.platforms.map((pl) => {
                                            const meta = platformMeta(pl.platform);
                                            const isOpen = expandedPlatform === pl.platform;
                                            return (
                                                <details
                                                    key={pl.platform}
                                                    className="mdm-item-row"
                                                    open={isOpen}
                                                    onToggle={(e) =>
                                                        setExpandedPlatform(e.target.open ? pl.platform : null)
                                                    }
                                                    style={{ borderTopColor: meta.color, borderTopWidth: 2 }}
                                                >
                                                    <summary>
                                                        <strong>{meta.label}</strong>
                                                        {!categoryDeferred && (
                                                            <>
                                                                <span className="mdm-badge ready">{pl.readyCount} hazır</span>
                                                                {pl.noCategoryCount > 0 && (
                                                                    <span className="mdm-badge no-cat">
                                                                        {pl.noCategoryCount} kategori gerekli
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        <span style={{ marginLeft: "auto", color: "var(--ud-pm-text-dim)" }}>
                                                            {pl.missingCount} ürün
                                                        </span>
                                                    </summary>
                                                    <div className="mdm-item-list" style={{ marginTop: 10 }}>
                                                        {(pl.items || []).slice(0, 50).map((it) => (
                                                            <div key={`${it.productId}-${it.platform}`} style={{ fontSize: 11, padding: "6px 0", borderBottom: "1px solid var(--ud-pm-border)" }}>
                                                                <div style={{ fontWeight: 600 }}>{it.name}</div>
                                                                <div style={{ color: "var(--ud-pm-text-dim)" }}>
                                                                    {it.sku || it.barcode || "—"}
                                                                    {it.reason === "no_category" && (
                                                                        <span className="mdm-badge no-cat" style={{ marginLeft: 6 }}>
                                                                            kategori
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(pl.items || []).length > 50 && (
                                                            <p style={{ fontSize: 10, color: "var(--ud-pm-text-dim)" }}>
                                                                +{(pl.items || []).length - 50} ürün daha…
                                                            </p>
                                                        )}
                                                    </div>
                                                </details>
                                            );
                                        })}
                                    </>
                                )}

                                {(phase === "pending" || (phase === "done" && pendingItems.length > 0)) &&
                                    pendingItems.length > 0 && (
                                        <>
                                            <div className="mdm-section-title">
                                                <FaSitemap style={{ marginRight: 6 }} />
                                                Dağıtılamayan / kategori gerekli ({pendingItems.length})
                                            </div>
                                            {pendingItems.some((p) => isMongoQuotaMessage(p.message)) && (
                                                <div className="mdm-global-banner" role="alert">
                                                    <FaExclamationTriangle />
                                                    <div>
                                                        <strong>MongoDB depolama kotası doldu (528 MB / 512 MB)</strong>
                                                        Dağıtım sonuçları veritabanına yazılamıyor; bu yüzden ürünler hata
                                                        olarak listeleniyor. Atlas panelinden depolamayı artırın veya eski
                                                        logları temizleyin, ardından dağıtımı yeniden deneyin.{" "}
                                                        <a
                                                            href="https://cloud.mongodb.com"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            MongoDB Atlas
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mdm-item-list">
                                                {pendingItems.map((item) => {
                                                    const key = `${item.productId}-${item.platform}`;
                                                    const ui = itemUi[key] || {};
                                                    const meta = platformMeta(item.platform);
                                                    const itemAlert = parseDistributionAlert(item.message, item.reason);
                                                    const sendAlert = ui.err
                                                        ? parseDistributionAlert(ui.err, "error")
                                                        : null;
                                                    if (ui.done) return null;
                                                    return (
                                                        <div key={key} className="mdm-item-row">
                                                            <div className="mdm-item-head">
                                                                <span
                                                                    className={`mdm-badge ${item.reason === "error" ? "err" : "no-cat"}`}
                                                                    style={{ marginRight: 6 }}
                                                                >
                                                                    {meta.label}
                                                                </span>
                                                                {item.reason === "error" && (
                                                                    <span className="mdm-badge err" style={{ marginRight: 6 }}>
                                                                        hata
                                                                    </span>
                                                                )}
                                                                {item.reason === "no_category" && (
                                                                    <span className="mdm-badge no-cat" style={{ marginRight: 6 }}>
                                                                        kategori
                                                                    </span>
                                                                )}
                                                                <span className="mdm-item-name">{item.name}</span>
                                                                {(item.sku || item.barcode) && (
                                                                    <div className="mdm-item-sku">
                                                                        {item.sku || item.barcode}
                                                                    </div>
                                                                )}
                                                                {item.masterCategoryHint && (
                                                                    <div className="mdm-item-hint">
                                                                        Ürün kategorisi: <strong>{item.masterCategoryHint}</strong>
                                                                    </div>
                                                                )}
                                                                <DistributionAlert alert={itemAlert} />
                                                            </div>
                                                            <div className="mdm-pending-actions">
                                                                <div className="mdm-cat-search">
                                                                    <input
                                                                        type="search"
                                                                        placeholder={`${meta.label} kategorisi ara (min 2 harf)`}
                                                                        value={ui.catQuery || ""}
                                                                        onChange={(e) =>
                                                                            handleCatSearch(key, item.platform, e.target.value)
                                                                        }
                                                                    />
                                                                    {ui.catLoading && <FaSpinner className="ud-pm-spin" />}
                                                                </div>
                                                                {ui.catResults?.length > 0 && (
                                                                    <div className="mdm-cat-results">
                                                                        {ui.catResults.map((cat) => (
                                                                            <div
                                                                                key={String(cat.id)}
                                                                                className={`mdm-cat-result ${ui.selectedCat?.id === cat.id ? "selected" : ""}`}
                                                                                onClick={() =>
                                                                                    setItemField(key, {
                                                                                        selectedCat: {
                                                                                            id: cat.id,
                                                                                            name: cat.name,
                                                                                            path: cat.path || cat.name,
                                                                                        },
                                                                                    })
                                                                                }
                                                                            >
                                                                                <div style={{ fontWeight: 600 }}>{cat.name}</div>
                                                                                <div style={{ opacity: 0.75 }}>{cat.path}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {ui.selectedCat && (
                                                                    <p className="mdm-selected-cat">
                                                                        <strong>Seçili kategori:</strong> {ui.selectedCat.path}
                                                                    </p>
                                                                )}
                                                                <DistributionAlert alert={sendAlert} />
                                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                                                                    <button
                                                                        type="button"
                                                                        className="ud-pm-btn sm purple"
                                                                        disabled={ui.sending || !ui.selectedCat}
                                                                        onClick={() =>
                                                                            handleDistributeItem(item, ui.selectedCat)
                                                                        }
                                                                    >
                                                                        {ui.sending ? (
                                                                            <FaSpinner className="ud-pm-spin" />
                                                                        ) : (
                                                                            <FaRocket />
                                                                        )}{" "}
                                                                        Gönder
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="ud-pm-btn sm muted"
                                                                        disabled={ui.sending}
                                                                        onClick={() => handleSkip(item)}
                                                                    >
                                                                        <FaForward /> Atla
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}

                                {phase === "cancelled" && (
                                    <div className="mdm-empty" style={{ paddingTop: 8 }}>
                                        <FaExclamationTriangle style={{ color: "#facc15", fontSize: 32, marginBottom: 10 }} />
                                        <p>Dağıtım kullanıcı tarafından iptal edildi.</p>
                                    </div>
                                )}

                                {phase === "done" && pendingItems.length === 0 && (
                                    <div className="mdm-empty" style={{ paddingTop: 8 }}>
                                        <FaCheckCircle style={{ color: "#4ade80", fontSize: 36, marginBottom: 10 }} />
                                        <p>Dağıtım tamamlandı.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <footer className="mdm-footer">
                        {confirmAction && (
                            <div className="mdm-confirm-bar">
                                <FaExclamationTriangle />
                                <span>
                                    {confirmAction === "pause" && "Dağıtımı duraklatmak istediğinize emin misiniz?"}
                                    {confirmAction === "cancel" && "Devam eden dağıtımı iptal etmek istediğinize emin misiniz?"}
                                    {confirmAction === "resume" && "Dağıtıma devam edilsin mi?"}
                                </span>
                                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                                    <button type="button" className="ud-pm-btn sm muted" disabled={controlBusy} onClick={() => setConfirmAction(null)}>
                                        Vazgeç
                                    </button>
                                    <button type="button" className="ud-pm-btn sm purple" disabled={controlBusy} onClick={runConfirmedControl}>
                                        {controlBusy ? <FaSpinner className="ud-pm-spin" /> : <FaCheck />} Onayla
                                    </button>
                                </div>
                            </div>
                        )}
                        {!confirmAction && phase === "ask" && (
                            <>
                                <button type="button" className="ud-pm-btn muted" onClick={handleClose}>
                                    <FaTimes /> Hayır, vazgeç
                                </button>
                                <button
                                    type="button"
                                    className="ud-pm-btn purple"
                                    onClick={handleConfirmScope}
                                    disabled={!scope}
                                >
                                    <FaCheck /> Evet, devam et
                                </button>
                            </>
                        )}
                        {!confirmAction && phase === "preview" && (
                            <>
                                <button type="button" className="ud-pm-btn muted" onClick={handleClose}>
                                    İptal
                                </button>
                                <button type="button" className="ud-pm-btn purple" onClick={handleStart}>
                                    <FaRocket /> Dağıtımı başlat ({summary?.readyCount ?? 0} hazır)
                                </button>
                            </>
                        )}
                        {!confirmAction && (phase === "done" || phase === "pending" || phase === "empty" || phase === "cancelled") && (
                            <button type="button" className="ud-pm-btn accent" onClick={handleClose}>
                                Kapat
                            </button>
                        )}
                        {!confirmAction && (phase === "running" || phase === "paused") && (
                            <>
                                <button type="button" className="ud-pm-btn muted" onClick={handleClose} title="Pencereyi kapat — işlem arka planda devam eder">
                                    Pencereyi kapat
                                </button>
                                {phase === "paused" ? (
                                    <button type="button" className="ud-pm-btn purple" onClick={() => setConfirmAction("resume")}>
                                        <FaPlay /> Devam et
                                    </button>
                                ) : (
                                    <button type="button" className="ud-pm-btn muted" onClick={() => setConfirmAction("pause")}>
                                        <FaPause /> Duraklat
                                    </button>
                                )}
                                <button type="button" className="ud-pm-btn sm" style={{ borderColor: "#f87171", color: "#f87171" }} onClick={() => setConfirmAction("cancel")}>
                                    <FaStop /> İptal et
                                </button>
                            </>
                        )}
                        {!confirmAction && phase === "starting" && (
                            <button type="button" className="ud-pm-btn muted" disabled>
                                <FaSpinner className="ud-pm-spin" /> Başlatılıyor…
                            </button>
                        )}
                    </footer>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default MissingDistributionModal;
