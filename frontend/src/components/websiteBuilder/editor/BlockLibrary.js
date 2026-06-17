import React, { useMemo, useState, useEffect } from "react";
import {
    Box, TextField, InputAdornment, Typography, List, ListItemButton, ListItemText,
} from "@mui/material";
import { SearchRounded, AddRounded, StarRounded } from "@mui/icons-material";
import BlockThumbnail from "../blocks/BlockThumbnail";
import BlockLibraryIcon from "../blocks/BlockLibraryIcon";
import { DEFAULT_CONTENT } from "../blocks/BlockRegistry";
import {
    enrichBlockCatalog,
    getCategoriesForCatalog,
    FEATURED_BLOCK_TYPES,
} from "../blocks/blockLibraryMeta";

function BlockCard({ block, onAddBlock, onDragStart }) {
    return (
        <Box
            component="article"
            className="wb-block-card"
            draggable
            onDragStart={(e) => onDragStart(e, block.type)}
            onClick={() => onAddBlock(block.type, DEFAULT_CONTENT[block.type])}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter") onAddBlock(block.type, DEFAULT_CONTENT[block.type]);
            }}
        >
            <BlockThumbnail variant={block.preview} className="wb-block-card-thumb" />
            <Box className="wb-block-card-body">
                <Box className="wb-block-card-title-row">
                    <BlockLibraryIcon name={block.muiIcon} sx={{ color: "primary.main", fontSize: 18 }} />
                    <Typography variant="subtitle2" className="wb-block-card-title" fontWeight={700}>
                        {block.label}
                    </Typography>
                </Box>
                <Typography variant="caption" className="wb-block-card-desc" color="text.secondary">
                    {block.description}
                </Typography>
            </Box>
            <Box className="wb-block-card-add" aria-hidden>
                <AddRounded fontSize="small" />
            </Box>
        </Box>
    );
}

function BlockGrid({ blocks, onAddBlock, onDragStart }) {
    if (blocks.length === 0) return null;
    return (
        <Box className="wb-block-card-grid">
            {blocks.map((block) => (
                <BlockCard
                    key={block.type}
                    block={block}
                    onAddBlock={onAddBlock}
                    onDragStart={onDragStart}
                />
            ))}
        </Box>
    );
}

export default function BlockLibrary({ onAddBlock, blockCatalog }) {
    const [search, setSearch] = useState("");

    const allBlocks = useMemo(() => enrichBlockCatalog(blockCatalog), [blockCatalog]);
    const categories = useMemo(() => getCategoriesForCatalog(allBlocks), [allBlocks]);

    const [categoryId, setCategoryId] = useState(() => categories[0]?.id || "hero");

    useEffect(() => {
        if (!categories.find((c) => c.id === categoryId) && categories[0]) {
            setCategoryId(categories[0].id);
        }
    }, [categories, categoryId]);

    const q = search.trim().toLowerCase();

    const filteredBySearch = useMemo(() => {
        if (!q) return allBlocks;
        return allBlocks.filter(
            (b) =>
                b.label.toLowerCase().includes(q)
                || b.description.toLowerCase().includes(q)
                || b.type.toLowerCase().includes(q)
        );
    }, [allBlocks, q]);

    const categoryBlocks = useMemo(() => {
        if (q) return filteredBySearch;
        return filteredBySearch.filter((b) => b.categoryId === categoryId);
    }, [filteredBySearch, categoryId, q]);

    const featuredBlocks = useMemo(() => {
        if (q) return [];
        return FEATURED_BLOCK_TYPES
            .map((type) => allBlocks.find((b) => b.type === type))
            .filter(Boolean);
    }, [allBlocks, q]);

    const featuredTypes = new Set(FEATURED_BLOCK_TYPES);
    const mainBlocks = useMemo(() => {
        const base = q ? filteredBySearch : categoryBlocks;
        if (q) return base;
        return base.filter((b) => !featuredTypes.has(b.type));
    }, [q, filteredBySearch, categoryBlocks, featuredTypes]);

    const handleDragStart = (e, blockType) => {
        e.dataTransfer.setData("blockType", blockType);
        e.dataTransfer.effectAllowed = "copy";
    };

    return (
        <Box className="wb-block-library">
            <Box className="wb-block-library-search-wrap">
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Blok ara…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRounded sx={{ fontSize: 18, color: "text.secondary" }} />
                            </InputAdornment>
                        ),
                    }}
                    className="wb-block-library-search"
                />
            </Box>

            <Box className="wb-block-library-body">
                {!q && (
                    <List dense className="wb-block-library-categories" disablePadding>
                        {categories.map((cat) => (
                            <ListItemButton
                                key={cat.id}
                                selected={categoryId === cat.id}
                                onClick={() => setCategoryId(cat.id)}
                                sx={{ borderRadius: 1, mb: 0.25, py: 0.75 }}
                            >
                                <ListItemText
                                    primary={cat.label}
                                    primaryTypographyProps={{ fontSize: 13, fontWeight: categoryId === cat.id ? 700 : 500 }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                )}

                <Box className="wb-block-library-main">
                    {!q && featuredBlocks.length > 0 && (
                        <Box className="wb-block-library-section">
                            <Typography className="wb-block-library-section-title" variant="overline">
                                <StarRounded sx={{ fontSize: 14, mr: 0.5, verticalAlign: "text-bottom" }} />
                                Sık kullanılanlar
                            </Typography>
                            <BlockGrid
                                blocks={featuredBlocks}
                                onAddBlock={onAddBlock}
                                onDragStart={handleDragStart}
                            />
                        </Box>
                    )}

                    <Box className="wb-block-library-section">
                        {!q && (
                            <Typography className="wb-block-library-section-title" variant="overline">
                                {categories.find((c) => c.id === categoryId)?.label || "Bloklar"}
                            </Typography>
                        )}
                        {q && (
                            <Typography className="wb-block-library-section-title" variant="overline">
                                Arama sonuçları ({mainBlocks.length})
                            </Typography>
                        )}
                        <BlockGrid
                            blocks={q ? filteredBySearch : mainBlocks}
                            onAddBlock={onAddBlock}
                            onDragStart={handleDragStart}
                        />
                        {(q ? filteredBySearch : mainBlocks).length === 0 && (
                            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                                Blok bulunamadı
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
