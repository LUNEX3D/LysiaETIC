import React from "react";
import { FaChevronDown } from "react-icons/fa";

/**
 * E-ticaret formlarında okunaklı seçenekler + açılır menü chevron işareti.
 */
const EcSelect = ({ className = "", wrapperClassName = "", children, ...props }) => (
    <div className={`ec-select-wrap ${wrapperClassName}`.trim()}>
        <select className={`ec-select ${className}`.trim()} {...props}>
            {children}
        </select>
        <FaChevronDown className="ec-select-chevron" aria-hidden />
    </div>
);

export default EcSelect;
