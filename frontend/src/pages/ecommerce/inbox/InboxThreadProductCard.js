import React, { useEffect, useState } from "react";
import { FaExternalLinkAlt, FaTag, FaUser } from "react-icons/fa";
import { trendyolStatusLabel } from "./inboxChannelUi";

const InboxThreadProductCard = ({ conversation }) => {
    const raw = conversation?.context || {};
    const productName = raw.productName || conversation?.participantUsername || "";
    const imageUrl = raw.imageUrl || conversation?.participantAvatar || "";
    const webUrl = raw.webUrl || "";
    const productMainId = raw.productMainId || "";
    const barcode = raw.barcode || "";
    const customerUserName = raw.customerUserName || "";
    const customerId = raw.customerId || "";
    const showUserName = raw.showUserName !== false;
    const questionStatus = raw.questionStatus || "";
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [imageUrl, conversation?._id]);

    if (!productName && !imageUrl) return null;

    const status = trendyolStatusLabel(questionStatus);
    const showImage = imageUrl && !imgFailed;

    return (
        <div className="ec-inbox-product-card">
            {showImage ? (
                <a
                    href={webUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ec-inbox-product-card__img-wrap"
                    onClick={(e) => !webUrl && e.preventDefault()}
                >
                    <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                    />
                </a>
            ) : (
                <div className="ec-inbox-product-card__img-wrap ec-inbox-product-card__img-wrap--empty">
                    <FaTag />
                </div>
            )}
            <div className="ec-inbox-product-card__body">
                {status && (
                    <span
                        className={`ec-inbox-product-card__status ec-inbox-product-card__status--${questionStatus.toLowerCase()}`}
                    >
                        {status}
                    </span>
                )}
                <p className="ec-inbox-product-card__name" title={productName}>
                    {productName}
                </p>
                <div className="ec-inbox-product-card__meta">
                    {productMainId && <span>Model: {productMainId}</span>}
                    {barcode && <span>Barkod: {barcode}</span>}
                    {customerUserName && (
                        <span>
                            <FaUser aria-hidden /> {customerUserName}
                        </span>
                    )}
                    {!customerUserName && customerId && <span>Müşteri no: {customerId}</span>}
                    {!customerUserName && !customerId && !showUserName && (
                        <span>Müşteri adı Trendyol&apos;da gizli</span>
                    )}
                </div>
                {webUrl && (
                    <a
                        href={webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ec-inbox-product-card__link"
                    >
                        Ürünü Trendyol&apos;da aç <FaExternalLinkAlt />
                    </a>
                )}
            </div>
        </div>
    );
};

export default InboxThreadProductCard;
