import React, { useState } from "react";
import {
    DesktopWindowsRounded, TabletRounded, PhoneIphoneRounded,
    VisibilityRounded, PublishRounded, ArrowBackRounded, CheckCircleRounded,
    KeyboardArrowDownRounded,
} from "@mui/icons-material";
import { CircularProgress, Tooltip, Menu, MenuItem, ListItemText } from "@mui/material";
import "../../../styles/websiteBuilder/editor.css";

const DEVICES = [
    { key: "desktop", icon: DesktopWindowsRounded, label: "Desktop" },
    { key: "tablet", icon: TabletRounded, label: "Tablet" },
    { key: "mobile", icon: PhoneIphoneRounded, label: "Mobil" },
];

export default function EditorToolbar({
    pageName,
    pageSubtitle,
    pages = [],
    currentPageId,
    onSelectPage,
    showPagePicker,
    device,
    onDeviceChange,
    isDirty,
    isSaving,
    onPreview,
    onPublish,
    onBack,
    extraActions,
}) {
    const [pageMenuAnchor, setPageMenuAnchor] = useState(null);
    const saveStatus = isSaving ? "saving" : isDirty ? "unsaved" : "saved";
    const saveLabel = { saving: "Kaydediliyor…", unsaved: "Kaydedilmemiş", saved: "Kaydedildi" }[saveStatus];
    const currentPage = pages.find((p) => p._id === currentPageId);
    const usePageMenu = showPagePicker !== false && pages.length > 0;

    return (
        <header className="wb-toolbar wb-toolbar-v2">
            <div className="wb-toolbar-zone wb-toolbar-zone--left">
                <Tooltip title="Site paneline dön">
                    <button type="button" className="wb-btn wb-btn-ghost wb-btn-icon" onClick={onBack} aria-label="Geri">
                        <ArrowBackRounded sx={{ fontSize: 20 }} />
                    </button>
                </Tooltip>
                {usePageMenu ? (
                    <>
                        <button
                            type="button"
                            className="wb-toolbar-page-picker"
                            onClick={(e) => setPageMenuAnchor(e.currentTarget)}
                        >
                            <span className="wb-toolbar-page-picker-title">{pageName || currentPage?.title || "Sayfa seçin"}</span>
                            <KeyboardArrowDownRounded sx={{ fontSize: 18, opacity: 0.7 }} />
                        </button>
                        <Menu
                            anchorEl={pageMenuAnchor}
                            open={Boolean(pageMenuAnchor)}
                            onClose={() => setPageMenuAnchor(null)}
                            PaperProps={{ sx: { minWidth: 260, maxHeight: 360 } }}
                        >
                            {pages.map((page) => (
                                <MenuItem
                                    key={page._id}
                                    selected={page._id === currentPageId}
                                    onClick={() => {
                                        onSelectPage?.(page._id);
                                        setPageMenuAnchor(null);
                                    }}
                                >
                                    <ListItemText
                                        primary={page.title}
                                        secondary={`/${page.slug || ""} · ${page.status === "published" ? "Yayında" : "Taslak"}`}
                                    />
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                ) : (
                    <div className="wb-toolbar-page-static">
                        <span className="wb-toolbar-page-picker-title">{pageName || "Editör"}</span>
                        {pageSubtitle && (
                            <span className="wb-toolbar-page-subtitle">{pageSubtitle}</span>
                        )}
                    </div>
                )}
                <div className={`wb-save-status wb-save-status--v2 ${saveStatus}`}>
                    {isSaving ? <CircularProgress size={12} color="inherit" /> : <CheckCircleRounded sx={{ fontSize: 14 }} />}
                    <span>{saveLabel}</span>
                </div>
            </div>

            <div className="wb-toolbar-zone wb-toolbar-zone--center">
                <div className="wb-toolbar-device-btns wb-toolbar-device-btns--v2">
                    {DEVICES.map(({ key, icon: Icon, label }) => (
                        <Tooltip key={key} title={label} placement="bottom">
                            <button
                                type="button"
                                className={`wb-device-btn ${device === key ? "active" : ""}`}
                                onClick={() => onDeviceChange(key)}
                                aria-label={label}
                            >
                                <Icon sx={{ fontSize: 18 }} />
                            </button>
                        </Tooltip>
                    ))}
                </div>
            </div>

            <div className="wb-toolbar-zone wb-toolbar-zone--right">
                {extraActions}
                {onPreview && (
                <Tooltip title="Canlı önizleme">
                    <button type="button" className="wb-btn wb-btn-ghost" onClick={onPreview}>
                        <VisibilityRounded sx={{ fontSize: 18 }} />
                        <span>Önizle</span>
                    </button>
                </Tooltip>
                )}
                <button type="button" className="wb-btn wb-btn-success" onClick={onPublish}>
                    <PublishRounded sx={{ fontSize: 18 }} />
                    <span>Yayınla</span>
                </button>
            </div>
        </header>
    );
}
