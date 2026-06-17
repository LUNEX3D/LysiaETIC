import React from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";

const InboxDisconnectConfirmModal = ({ open, channelLabel, accountLabel, onConfirm, onCancel, loading }) => {
    const { rootClassName, rootStyle } = useDashtockTheme();

    if (!open) return null;

    const displayName = accountLabel || channelLabel || "bu kanal";

    const backdropStyle = { ...rootStyle, background: undefined };

    return createPortal(
        <div
            className={`ec-inbox-modal-backdrop ${rootClassName}`}
            style={backdropStyle}
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div
                className="ec-inbox-modal ec-inbox-modal--confirm"
                role="dialog"
                aria-labelledby="inbox-disconnect-title"
                aria-modal="true"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button type="button" className="ec-inbox-modal__close" onClick={onCancel} aria-label="Kapat">
                    <FaTimes />
                </button>
                <h3 id="inbox-disconnect-title">Bağlantıyı kaldır</h3>
                <p>
                    <strong>{displayName}</strong>
                    {channelLabel && accountLabel ? ` (${channelLabel})` : ""} bağlantısını kaldırmak istediğinize
                    emin misiniz? Bu kanaldaki gelen kutusu eşlemesi silinir; mesaj geçmişi panelde kalabilir.
                </p>
                <div className="ec-inbox-modal__confirm-actions">
                    <button type="button" className="ec-inbox-modal__secondary" onClick={onCancel} disabled={loading}>
                        Hayır
                    </button>
                    <button
                        type="button"
                        className="ec-inbox-modal__danger"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? "Kaldırılıyor…" : "Evet, kaldır"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default InboxDisconnectConfirmModal;
