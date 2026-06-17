import React from "react";
import {
    HomeRounded, ShoppingBagRounded, ArticleRounded, MailRounded,
    InfoRounded, DescriptionRounded, PolicyRounded,
} from "@mui/icons-material";
import { List, ListItemButton, ListItemText, Chip, ListItemIcon } from "@mui/material";

const PAGE_ICON_MAP = {
    home: HomeRounded,
    products: ShoppingBagRounded,
    blog: ArticleRounded,
    contact: MailRounded,
    about: InfoRounded,
    custom: DescriptionRounded,
    policy: PolicyRounded,
};

export default function EditorPagesPanel({ pages, currentPageId, onSelectPage }) {
    return (
        <List dense disablePadding className="wb-pages-list">
            {pages.map((page) => {
                const Icon = PAGE_ICON_MAP[page.type] || DescriptionRounded;
                return (
                    <ListItemButton
                        key={page._id}
                        selected={page._id === currentPageId}
                        onClick={() => onSelectPage(page._id)}
                        sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                            <Icon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                            primary={page.title}
                            secondary={`/${page.slug || ""}`}
                            primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                            secondaryTypographyProps={{ fontSize: 11 }}
                        />
                        {page.status === "published" && (
                            <Chip label="Yayında" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                        )}
                    </ListItemButton>
                );
            })}
        </List>
    );
}
