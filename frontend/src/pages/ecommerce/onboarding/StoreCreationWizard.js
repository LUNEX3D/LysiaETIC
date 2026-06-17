import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircleRounded, RadioButtonUncheckedRounded } from "@mui/icons-material";
import { BUSINESS_TYPES, BRAND_STYLES, GENERATION_STEPS } from "../../../constants/starterKits";
import { generateFacadeStore } from "../../../services/storeFacadeApi";
import { setActiveEcSite } from "../../../utils/ecStoreContext";
import "./storeCreationWizard.css";

const TOTAL_STEPS = 5;

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

export default function StoreCreationWizard({ language = "tr", onComplete, onCancel }) {
    const en = language === "en";
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [businessType, setBusinessType] = useState("general");
    const [brandStyle, setBrandStyle] = useState("modern");
    const [progressSteps, setProgressSteps] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (name && !slug) setSlug(slugify(name));
    }, [name, slug]);

    const stepDots = useMemo(
        () =>
            Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const n = i + 1;
                if (n < step) return "done";
                if (n === step) return "active";
                return "";
            }),
        [step]
    );

    const runGeneration = useCallback(async () => {
        setGenerating(true);
        setError("");
        setProgressSteps(GENERATION_STEPS.map((s) => ({ ...s, status: "pending" })));

        for (let i = 0; i < GENERATION_STEPS.length; i++) {
            const id = GENERATION_STEPS[i].id;
            setProgressSteps((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: "running" } : p))
            );
            await new Promise((r) => setTimeout(r, GENERATION_STEPS[i].durationMs || 800));
            setProgressSteps((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: "done" } : p))
            );
        }

        try {
            const out = await generateFacadeStore({
                name: name.trim(),
                slug: slug.trim() || slugify(name),
                businessType,
                brandStyle,
                useAi: true,
            });
            setResult(out);
            setStep(5);
        } catch (e) {
            setError(e.response?.data?.error || e.message || (en ? "Could not create store." : "Mağaza oluşturulamadı."));
            setStep(3);
        } finally {
            setGenerating(false);
        }
    }, [name, slug, businessType, brandStyle, en]);

    useEffect(() => {
        if (step === 4 && !generating && !result) {
            runGeneration();
        }
    }, [step, generating, result, runGeneration]);

    const finish = () => {
        if (!result?.site) return;
        const site = {
            _id: result.site.id,
            slug: result.site.slug,
            name: result.site.name,
            storeId: result.store?.id,
        };
        const ctx = setActiveEcSite(site);
        onComplete?.({ site, store: result.store, ctx });
    };

    const t = {
        title1: en ? "Name your store" : "Mağazanıza isim verin",
        sub1: en ? "Choose a name and web address." : "Mağaza adı ve web adresi belirleyin.",
        title2: en ? "What do you sell?" : "Ne satıyorsunuz?",
        sub2: en ? "We pick the best starter kit for your business." : "İş türünüze uygun başlangıç görünümünü seçeriz.",
        title3: en ? "Brand style" : "Marka stiliniz",
        sub3: en ? "Colors and typography for your storefront." : "Vitrininiz için renk ve tipografi.",
        title4: en ? "Building your store…" : "Mağazanız hazırlanıyor…",
        sub4: en ? "AI is setting up pages and appearance." : "Sayfalar ve görünüm otomatik kuruluyor.",
        title5: en ? "Your store is ready!" : "Mağazanız hazır!",
        sub5: en ? "Add products, connect payments, and publish." : "Ürün ekleyin, ödemeyi bağlayın ve yayınlayın.",
        next: en ? "Continue" : "Devam",
        back: en ? "Back" : "Geri",
        create: en ? "Create store" : "Mağazayı oluştur",
        enter: en ? "Go to dashboard" : "Panele git",
        cancel: en ? "Cancel" : "İptal",
        storeName: en ? "Store name" : "Mağaza adı",
        storeUrl: en ? "Web address" : "Web adresi",
    };

    return (
        <div className="ec-wizard">
            <div className="ec-wizard__card">
                <div className="ec-wizard__steps">
                    {stepDots.map((cls, i) => (
                        <div key={i} className={`ec-wizard__step-dot ${cls}`} />
                    ))}
                </div>

                {error && <div className="ec-wizard__error">{error}</div>}

                {step === 1 && (
                    <>
                        <header className="ec-wizard__head">
                            <h1>{t.title1}</h1>
                            <p>{t.sub1}</p>
                        </header>
                        <div className="ec-wizard__field">
                            <label htmlFor="store-name">{t.storeName}</label>
                            <input
                                id="store-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={en ? "My Store" : "Mağazam"}
                                autoFocus
                            />
                        </div>
                        <div className="ec-wizard__field">
                            <label htmlFor="store-slug">{t.storeUrl}</label>
                            <input
                                id="store-slug"
                                value={slug}
                                onChange={(e) => setSlug(slugify(e.target.value))}
                                placeholder="magazam"
                            />
                            <small style={{ color: "#64748b" }}>
                                {slug || "magazam"}.sites.dashtock.com
                            </small>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <header className="ec-wizard__head">
                            <h1>{t.title2}</h1>
                            <p>{t.sub2}</p>
                        </header>
                        <div className="ec-wizard__grid">
                            {BUSINESS_TYPES.map((bt) => (
                                <button
                                    key={bt.id}
                                    type="button"
                                    className={`ec-wizard__choice ${businessType === bt.id ? "selected" : ""}`}
                                    onClick={() => setBusinessType(bt.id)}
                                >
                                    <strong>{en ? bt.nameEn : bt.nameTr}</strong>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <header className="ec-wizard__head">
                            <h1>{t.title3}</h1>
                            <p>{t.sub3}</p>
                        </header>
                        <div className="ec-wizard__grid">
                            {BRAND_STYLES.map((bs) => (
                                <button
                                    key={bs.id}
                                    type="button"
                                    className={`ec-wizard__choice ${brandStyle === bs.id ? "selected" : ""}`}
                                    onClick={() => setBrandStyle(bs.id)}
                                >
                                    <strong>{en ? bs.nameEn : bs.nameTr}</strong>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {step === 4 && (
                    <>
                        <header className="ec-wizard__head">
                            <h1>{t.title4}</h1>
                            <p>{t.sub4}</p>
                        </header>
                        <ul className="ec-wizard__progress-list">
                            {progressSteps.map((ps) => (
                                <li
                                    key={ps.id}
                                    className={ps.status === "done" ? "done" : ps.status === "running" ? "running" : ""}
                                >
                                    {ps.status === "done" ? (
                                        <CheckCircleRounded sx={{ fontSize: 20 }} />
                                    ) : (
                                        <RadioButtonUncheckedRounded sx={{ fontSize: 20 }} />
                                    )}
                                    {en ? ps.labelEn : ps.labelTr}
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {step === 5 && result && (
                    <>
                        <div className="ec-wizard__ready">
                            <div className="ec-wizard__ready-icon">🎉</div>
                            <header className="ec-wizard__head">
                                <h1>{t.title5}</h1>
                                <p>{t.sub5}</p>
                            </header>
                            <p>
                                <strong>{result.site?.name}</strong>
                                <br />
                                {result.site?.host || `${result.site?.slug}.sites.dashtock.com`}
                            </p>
                        </div>
                    </>
                )}

                <div className="ec-wizard__actions">
                    {step > 1 && step < 4 && (
                        <button type="button" className="ec-wizard__btn" onClick={() => setStep((s) => s - 1)}>
                            {t.back}
                        </button>
                    )}
                    {step === 1 && onCancel && (
                        <button type="button" className="ec-wizard__btn" onClick={onCancel}>
                            {t.cancel}
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {step < 3 && (
                        <button
                            type="button"
                            className="ec-wizard__btn ec-wizard__btn--primary"
                            disabled={!name.trim()}
                            onClick={() => setStep((s) => s + 1)}
                        >
                            {t.next}
                        </button>
                    )}
                    {step === 3 && (
                        <button
                            type="button"
                            className="ec-wizard__btn ec-wizard__btn--primary"
                            onClick={() => setStep(4)}
                        >
                            {t.create}
                        </button>
                    )}
                    {step === 5 && (
                        <button type="button" className="ec-wizard__btn ec-wizard__btn--primary" onClick={finish}>
                            {t.enter}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
