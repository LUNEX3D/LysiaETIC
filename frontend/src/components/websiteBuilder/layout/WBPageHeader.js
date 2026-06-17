import React from "react";
import WBIkasPageHeader from "./WBIkasPageHeader";
import "../../../styles/websiteBuilder/wbIkasWorkspace.css";

/** @deprecated Prefer WBIkasPageHeader — aynı görünüm için alias */
export default function WBPageHeader({ title, subtitle, actions }) {
    return <WBIkasPageHeader title={title} subtitle={subtitle} actions={actions} />;
}
