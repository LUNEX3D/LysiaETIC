import React from "react";
import { Navigate } from "react-router-dom";

/** Eski rota — Onboarding Wizard'a yönlendirir */
export default function SiteCreateWizard() {
    return <Navigate to="/website-builder/onboarding" replace />;
}
