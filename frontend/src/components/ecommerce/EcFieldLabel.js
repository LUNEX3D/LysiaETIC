import React from "react";
import EcFieldHint from "./EcFieldHint";

const EcFieldLabel = ({ children, hint, hintLabel, htmlFor, className = "" }) => (
    <label className={`ec-field-label${className ? ` ${className}` : ""}`} htmlFor={htmlFor}>
        <span className="ec-field-label__text">{children}</span>
        {hint ? <EcFieldHint text={hint} label={hintLabel || (typeof children === "string" ? children : "Bilgi")} /> : null}
    </label>
);

export default EcFieldLabel;
