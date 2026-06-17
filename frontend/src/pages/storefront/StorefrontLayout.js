import React from "react";
import { useParams, Outlet } from "react-router-dom";
import StorefrontMarketing from "../../components/storefront/StorefrontMarketing";

/** Mağaza vitrin rotaları — popup ve affiliate takibi */
const StorefrontLayout = () => {
    const { slug } = useParams();
    return (
        <StorefrontMarketing slug={slug}>
            <Outlet />
        </StorefrontMarketing>
    );
};

export default StorefrontLayout;
