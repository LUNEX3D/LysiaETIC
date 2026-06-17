import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWbStorefront } from "../../components/wbStorefront/WbStorefrontContext";
import { useWbStorefrontSeo } from "../../components/wbStorefront/WbStorefrontSeoContext";
import { stripWbHtml } from "../../utils/wbSafeHtml";
import { fetchWbBlogPost } from "../../services/wbPublicApi";
import { isWbCustomDomainHost } from "../../utils/wbStorefrontHost";

export default function WbBlogPostPage() {
    const { postSlug } = useParams();
    const { siteSlug, site } = useWbStorefront();
    const { applySeo } = useWbStorefrontSeo();
    const [post, setPost] = useState(null);

    useEffect(() => {
        fetchWbBlogPost(siteSlug, postSlug).then((d) => {
            setPost(d.post);
            const jsonLd = [];
            if (d.structuredData) jsonLd.push(d.structuredData);
            if (d.seo?.jsonLd) jsonLd.push(...d.seo.jsonLd);
            if (d.seo) applySeo({ ...d.seo, jsonLd });
            else if (d.metaTags) applySeo({ metaTags: d.metaTags, jsonLd, baseUrl: site?.baseUrl });
        });
    }, [siteSlug, postSlug, applySeo, site?.baseUrl]);

    if (!post) return <p style={{ padding: 24 }}>Yükleniyor…</p>;

    return (
        <article style={{ padding: "32px 24px", maxWidth: 800, margin: "0 auto" }}>
            <Link to={isWbCustomDomainHost() ? "/blog" : `/site/${siteSlug}/blog`}>← Blog</Link>
            <h1>{post.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: stripWbHtml(post.contentHtml || post.content || "") }} />
        </article>
    );
}
