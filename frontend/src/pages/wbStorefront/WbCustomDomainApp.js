import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { isWbCustomDomainHost } from "../../utils/wbStorefrontHost";

const WbStorefrontLayout = lazy(() => import("./WbStorefrontLayout"));
const WbSitePage = lazy(() => import("./WbSitePage"));
const WbProductPublicPage = lazy(() => import("./WbProductPublicPage"));
const WbBlogListPage = lazy(() => import("./WbBlogListPage"));
const WbBlogPostPage = lazy(() => import("./WbBlogPostPage"));

function Fallback() {
    return <div style={{ padding: 48, textAlign: "center" }}>Yükleniyor…</div>;
}

/**
 * Custom domain (www.magazam.com) — root path vitrin.
 * Lysia ana uygulama hostlarında render edilmez.
 */
export default function WbCustomDomainApp() {
    if (!isWbCustomDomainHost()) return null;

    return (
        <Suspense fallback={<Fallback />}>
            <Routes>
                <Route path="/" element={<WbStorefrontLayout />}>
                    <Route index element={<WbSitePage />} />
                    <Route path="page/:pageSlug" element={<WbSitePage />} />
                    <Route path="products" element={<WbSitePage fixedSlug="products" />} />
                    <Route path="collections" element={<WbSitePage fixedSlug="collections" />} />
                    <Route path="about" element={<WbSitePage fixedSlug="about" />} />
                    <Route path="contact" element={<WbSitePage fixedSlug="contact" />} />
                    <Route path="faq" element={<WbSitePage fixedSlug="faq" />} />
                    <Route path="cart" element={<WbSitePage fixedSlug="cart" />} />
                    <Route path="checkout" element={<WbSitePage fixedSlug="checkout" />} />
                    <Route path="search" element={<WbSitePage fixedSlug="search" />} />
                    <Route path="urun/:productSlug" element={<WbProductPublicPage />} />
                    <Route path="blog" element={<WbSitePage fixedSlug="blog" />} />
                    <Route path="blog/:postSlug" element={<WbBlogPostPage />} />
                </Route>
            </Routes>
        </Suspense>
    );
}
