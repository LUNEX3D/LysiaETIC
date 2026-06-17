import React from "react";
import { FaGlobe } from "react-icons/fa";
import EcMultiPicker from "../../../components/ecommerce/EcMultiPicker";

/**
 * Satış kanalı seçici — ikas tarzı; vitrin/alan adı yoksa boş durum.
 */
const EcSalesChannelPicker = ({
    channels = [],
    hasStorefront = false,
    value = [],
    onChange,
    onNavigate,
}) => {
    const options = channels.map((ch) => ({
        id: String(ch.id),
        label: ch.label || ch.id,
        icon: <FaGlobe aria-hidden />,
    }));

    if (!hasStorefront || channels.length === 0) {
        return (
            <div className="ec-sales-channel-field">
                <span className="ec-multi-picker__label">Satış Kanalları</span>
                <div className="ec-sales-channel-empty">
                    <span className="ec-sales-channel-empty__icon" aria-hidden>
                        <FaGlobe />
                    </span>
                    <div>
                        <strong>Satış kanalı yok</strong>
                        <p>
                            Henüz alan adı veya yayınlanmış vitrin siteniz bulunmuyor. Mağazanız için subdomain
                            veya özel alan adı tanımlayın.
                        </p>
                        {onNavigate && (
                            <button
                                type="button"
                                className="ec-prod-section-link"
                                onClick={() => onNavigate("store-seo-domain")}
                            >
                                SEO ve Alan Adı ayarlarına git
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <EcMultiPicker
            className="ec-sales-channel-picker"
            label="Satış Kanalları"
            placeholder="Satış Kanalı Seç"
            emptyTitle="Satış kanalı bulunamadı"
            emptyHint="Arama metnini değiştirin veya listeden seçin"
            options={options}
            value={value}
            onChange={onChange}
            renderOptionIcon={(opt) => opt.icon}
            renderChipIcon={() => <FaGlobe aria-hidden />}
        />
    );
};

export default EcSalesChannelPicker;
