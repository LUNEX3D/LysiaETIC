import React from "react";
import SectionRenderer from "../websiteBuilder/sections/SectionRenderer";
import { DawnSectionRenderer, isDawnSection } from "../../theme-builder/dawn";
import "../../theme-builder/dawn/dawn-theme.css";

/**
 * Storefront section wrapper — Dawn veya genel SectionRenderer.
 */
export default function WbPublicBlock(props) {
    const { section, themeVariables } = props;
    const useDawn = themeVariables?.themePack === "dawn" || isDawnSection(section?.type);

    if (useDawn) {
        return <DawnSectionRenderer section={section} products={props.products} />;
    }
    return <SectionRenderer mode="storefront" {...props} />;
}
