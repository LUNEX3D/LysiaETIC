import React from "react";
import { Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckStoreConfig, PUCK_DEFAULT_DATA } from "../puck/puckStoreConfig";

export default function WbPuckPageView({ data }) {
    const payload = data?.content?.length ? data : PUCK_DEFAULT_DATA;
    return (
        <div className="wb-puck-page-view">
            <Render config={puckStoreConfig} data={payload} />
        </div>
    );
}
