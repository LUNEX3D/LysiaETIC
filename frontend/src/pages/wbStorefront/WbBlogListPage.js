import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWbStorefront } from "../../components/wbStorefront/WbStorefrontContext";
import { fetchWbBlogPosts } from "../../services/wbPublicApi";
import { isWbCustomDomainHost } from "../../utils/wbStorefrontHost";

export default function WbBlogListPage() {
    const { siteSlug } = useWbStorefront();
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        fetchWbBlogPosts(siteSlug).then((d) => setPosts(d.posts || []));
    }, [siteSlug]);

    const base = isWbCustomDomainHost() ? "" : `/site/${siteSlug}`;

    return (
        <div style={{ padding: "32px 24px" }}>
            <h1>Blog</h1>
            <div style={{ display: "grid", gap: 16 }}>
                {posts.map((p) => (
                    <Link key={p._id} to={`${base}/blog/${p.slug}`.replace("//", "/")} style={{ textDecoration: "none", color: "inherit" }}>
                        <h3>{p.title}</h3>
                        <p style={{ color: "#64748b" }}>{p.excerpt}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
