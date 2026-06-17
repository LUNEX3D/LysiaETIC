import React from "react";
import { FaChevronDown, FaGlobe, FaStore } from "react-icons/fa";
import { getProductStorefrontChannel } from "../../../utils/productSalesChannel";

const ProductSalesChannelCell = ({ product, store, publicUrl }) => {
    const channel = getProductStorefrontChannel(product, store, publicUrl);
    const label =
        channel.count > 0
            ? `${channel.count} Satış Kanalı`
            : "Satış kanalı yok";

    return (
        <div className="ec-prod-channel-wrap">
            <button
                type="button"
                className={`ec-prod-channel-chip ${channel.live ? "ec-prod-channel-chip--live" : ""}`}
                onClick={(e) => e.stopPropagation()}
                aria-describedby={channel.live ? `channel-tip-${product._id}` : undefined}
            >
                <span
                    className={`ec-prod-channel-dot ${channel.live ? "ec-prod-channel-dot--on" : ""}`}
                    aria-hidden
                />
                <FaStore aria-hidden />
                <span className="ec-prod-channel-label">{label}</span>
                <FaChevronDown aria-hidden />
            </button>

            {channel.live && channel.host ? (
                <div
                    id={`channel-tip-${product._id}`}
                    className="ec-prod-channel-popover"
                    role="tooltip"
                >
                    <FaGlobe aria-hidden />
                    {channel.productUrl ? (
                        <a
                            href={channel.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {channel.host}
                        </a>
                    ) : (
                        <span>{channel.host}</span>
                    )}
                </div>
            ) : (
                <div className="ec-prod-channel-popover ec-prod-channel-popover--muted" role="tooltip">
                    <span>{channel.statusLabel}</span>
                </div>
            )}
        </div>
    );
};

export default ProductSalesChannelCell;
