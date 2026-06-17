import React from "react";
import { FaCheck } from "react-icons/fa";

const CampaignOptionGrid = ({ options, value, onChange, columns = 4 }) => (
    <div className={`ec-discount-option-grid ec-discount-option-grid--${columns}`}>
        {options.map((opt) => {
            const active = value === opt.id;
            return (
                <button
                    key={opt.id}
                    type="button"
                    className={`ec-discount-option-card${active ? " ec-discount-option-card--active" : ""}`}
                    onClick={() => onChange(opt.id)}
                >
                    {opt.icon ? <span className="ec-discount-option-card__icon">{opt.icon}</span> : null}
                    <span className="ec-discount-option-card__label">{opt.label}</span>
                    {active ? (
                        <span className="ec-discount-option-card__check" aria-hidden>
                            <FaCheck />
                        </span>
                    ) : null}
                </button>
            );
        })}
    </div>
);

export default CampaignOptionGrid;
