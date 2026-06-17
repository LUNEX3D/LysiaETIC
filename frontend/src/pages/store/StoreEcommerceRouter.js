/**
 * E-Ticaret tüm bölümler — mağaza yükleme + iç menü + içerik yönlendirme
 */
import React, { useState, useEffect, useCallback } from "react";
import { FaRocket } from "react-icons/fa";
import { useApp } from "../../context/AppContext";
import {
    getStoreRouterSection,
    STORE_HUB_TAB,
    STORE_SECTION_META,
    STORE_DEFAULT_PANEL,
} from "../../constants/ecommerceMenu";
import { fetchStore, createStore } from "../../services/storeApi";
import StoreEcommerceLayout from "./StoreEcommerceLayout";
import StoreHub from "./StoreHub";
import StorePlaceholder from "./StorePlaceholder";
import "../../styles/storeHub.css";
import "../../styles/storeIkasPanels.css";
import "../../styles/storeEcommerceLayout.css";

const StoreEcommerceRouter = ({ section: rawSection, onNavigate, onBack, onStoreLabelChange }) => {
    const { language } = useApp();
    const section = getStoreRouterSection(rawSection || STORE_DEFAULT_PANEL);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [store, setStore] = useState(null);
    const [themes, setThemes] = useState([]);
    const [wizard, setWizard] = useState({ name: "", slug: "", themeId: "minimal" });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await fetchStore();
            setStore(data.store);
            setThemes(data.themes || []);
            if (data.store && onStoreLabelChange) {
                const s = data.store;
                const dom =
                    s.customDomain && s.domainStatus === "verified"
                        ? s.customDomain
                        : s.subdomain || `${s.slug}.sites.dashtock.com`;
                onStoreLabelChange(dom);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [onStoreLabelChange]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async () => {
        try {
            await createStore(wizard);
            await load();
        } catch (e) {
            setError(e.response?.data?.error || "Oluşturulamadı");
        }
    };

    if (loading) {
        return (
            <div className="store-ec-loading">
                <p>Mağaza yükleniyor…</p>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="store-hub" style={{ maxWidth: 560, margin: "0 auto" }}>
                <div className="store-hub-card">
                    <h3>
                        <FaRocket /> Web mağazanızı oluşturun
                    </h3>
                    <p className="store-hub-hint">
                        E-Ticaret ayarlarına geçmeden önce mağazanızı oluşturun.
                    </p>
                    {error && <p style={{ color: "#f87171" }}>{error}</p>}
                    <div className="store-hub-field">
                        <label>Mağaza adı</label>
                        <input
                            value={wizard.name}
                            onChange={(e) => setWizard({ ...wizard, name: e.target.value })}
                            placeholder="Markam Mağaza"
                        />
                    </div>
                    <div className="store-hub-field">
                        <label>Adres (slug)</label>
                        <input
                            value={wizard.slug}
                            onChange={(e) => setWizard({ ...wizard, slug: e.target.value })}
                            placeholder="markam-magaza"
                        />
                    </div>
                    <button type="button" className="store-hub-btn primary" onClick={handleCreate}>
                        Mağazayı oluştur
                    </button>
                </div>
            </div>
        );
    }

    const hubTab = STORE_HUB_TAB[section];
    const placeholder = STORE_SECTION_META[section];

    let content;
    if (hubTab) {
        content = <StoreHub initialTab={hubTab} embeddedNav onAfterLoad={(s) => setStore(s)} />;
    } else if (placeholder) {
        content = <StorePlaceholder title={placeholder.title} description={placeholder.text} />;
    } else {
        content = <StorePlaceholder title="Web Sitem" description="Bu bölüm yapılandırılacak." />;
    }

    return (
        <StoreEcommerceLayout
            activeSection={section}
            store={store}
            language={language}
            onNavigate={onNavigate}
            onBack={onBack}
        >
            {content}
        </StoreEcommerceLayout>
    );
};

export default StoreEcommerceRouter;
