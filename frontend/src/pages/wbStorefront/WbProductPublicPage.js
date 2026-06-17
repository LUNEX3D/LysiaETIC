import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWbStorefront } from "../../components/wbStorefront/WbStorefrontContext";
import { fetchWbProduct, fetchWbProductByDomain } from "../../services/wbPublicApi";
import WbPublicBlock from "../../components/wbStorefront/WbPublicBlock";
import { isWbCustomDomainHost } from "../../utils/wbStorefrontHost";
import { trackWbPageView, trackWbProductView } from "../../services/wbTrackApi";

export default function WbProductPublicPage() {
    const { productSlug } = useParams();
    const { siteSlug, storeSlug, themeVariables } = useWbStorefront();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const res = isWbCustomDomainHost() && !siteSlug
                    ? await fetchWbProductByDomain(productSlug)
                    : await fetchWbProduct(siteSlug, productSlug);
                setData(res);
                if (res.metaTags?.title) document.title = res.metaTags.title;
                const trackSlug = res.site?.slug || siteSlug;
                if (trackSlug) {
                    trackWbPageView(trackSlug, { pageSlug: `urun/${productSlug}` });
                    trackWbProductView(trackSlug, { productSlug, productId: res.product?._id });
                }
            } catch (e) {
                setError(e.response?.data?.error || "Ürün bulunamadı");
            }
        })();
    }, [siteSlug, productSlug]);

    if (error) return <p style={{ padding: 24 }}>{error}</p>;
    if (!data) return <p style={{ padding: 24 }}>Yükleniyor…</p>;

    const sections = [...(data.productPage?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const layout = data.productPage?.layoutConfig?.style || "two-column";
    const galleryTypes = new Set(["product-gallery"]);
    const infoTypes = new Set(["product-price", "product-variants", "add-to-cart", "product-description"]);

    const renderBlock = (section) => (
        <WbPublicBlock
            key={section.id}
            section={section}
            themeVariables={themeVariables}
            product={data.product}
            relatedProducts={data.relatedProducts || []}
            reviews={data.reviews || []}
            reviewStats={data.reviewStats}
            siteSlug={siteSlug}
            storeSlug={data.storeSlug || storeSlug}
        />
    );

    if (layout !== "two-column") {
        return <article style={{ padding: "24px" }}>{sections.map(renderBlock)}</article>;
    }

    const left = sections.filter((s) => galleryTypes.has(s.type));
    const right = sections.filter((s) => infoTypes.has(s.type));
    const rest = sections.filter((s) => !galleryTypes.has(s.type) && !infoTypes.has(s.type));

    return (
        <article>
            <div className="wb-sf-product-layout">
                <div>{left.map(renderBlock)}</div>
                <div>{right.map(renderBlock)}</div>
            </div>
            {rest.map(renderBlock)}
        </article>
    );
}
