import React from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from "react-icons/fa";

const ICONS = {
    success: FaCheckCircle,
    error: FaExclamationCircle,
    info: FaInfoCircle,
};

const EcToast = ({ toasts, onDismiss }) => (
    <div className="ec-purchase-toast-stack" aria-live="polite">
        {toasts.map((t) => {
            const Icon = ICONS[t.type] || FaInfoCircle;
            return (
                <div key={t.id} className={`ec-purchase-toast ec-purchase-toast--${t.type}`}>
                    <Icon className="ec-purchase-toast__icon" aria-hidden />
                    <span className="ec-purchase-toast__text">{t.message}</span>
                    <button
                        type="button"
                        className="ec-purchase-toast__close"
                        aria-label="Kapat"
                        onClick={() => onDismiss(t.id)}
                    >
                        <FaTimes />
                    </button>
                </div>
            );
        })}
    </div>
);

export function useEcToast() {
    const [toasts, setToasts] = React.useState([]);

    const dismiss = React.useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = React.useCallback(
        (type, message) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
            setTimeout(() => dismiss(id), type === "error" ? 6000 : 4500);
            return id;
        },
        [dismiss]
    );

    return { toasts, push, dismiss };
}

export default EcToast;
