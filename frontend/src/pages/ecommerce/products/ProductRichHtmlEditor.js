import React, { useRef, useEffect, useState, useCallback } from "react";
import {
    FaBold,
    FaItalic,
    FaUnderline,
    FaStrikethrough,
    FaListUl,
    FaListOl,
    FaLink,
    FaImage,
    FaFilm,
    FaCode,
    FaExpand,
    FaCompress,
    FaArrowsAltV,
    FaMagic,
    FaEraser,
} from "react-icons/fa";
import { uploadProductImage, generateDescription } from "../../../services/productManagementApi";
import {
    sanitizeDescriptionHtml,
    sanitizeDescriptionPlain,
} from "../../../utils/sanitizeDescriptionHtml";

/**
 * contentEditable HTML editörü — ürün açıklaması ve özel alanlar için ortak.
 */
const ProductRichHtmlEditor = ({
    value = "",
    onChange,
    loadKey = "",
    placeholder = "İçerik…",
    showAi = false,
    aiContext = {},
    compact = false,
    className = "",
}) => {
    const editorRef = useRef(null);
    const fileRef = useRef(null);
    const loadedRef = useRef(false);
    const [pasteModal, setPasteModal] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [editorExpanded, setEditorExpanded] = useState(false);
    const [sourceMode, setSourceMode] = useState(false);
    const [sourceHtml, setSourceHtml] = useState("");

    const applySanitizedHtml = useCallback(
        (html) => {
            if (!editorRef.current) return;
            editorRef.current.innerHTML = sanitizeDescriptionHtml(html);
            onChange(editorRef.current.innerHTML);
        },
        [onChange]
    );

    const syncToParent = useCallback(() => {
        if (!editorRef.current) return;
        const cleaned = sanitizeDescriptionHtml(editorRef.current.innerHTML);
        if (cleaned !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = cleaned;
        }
        onChange(editorRef.current.innerHTML);
    }, [onChange]);

    useEffect(() => {
        loadedRef.current = false;
    }, [loadKey]);

    useEffect(() => {
        if (loadedRef.current || sourceMode) return;
        if (editorRef.current) {
            editorRef.current.innerHTML = sanitizeDescriptionHtml(value || "");
            loadedRef.current = true;
        }
    }, [value, sourceMode, loadKey]);

    const exec = (cmd, cmdValue = null) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, cmdValue);
        syncToParent();
    };

    const handlePaste = (e) => {
        const html = e.clipboardData.getData("text/html");
        const plain = e.clipboardData.getData("text/plain");
        if (html && html.trim() && html !== plain) {
            e.preventDefault();
            setPasteModal({ html, plain });
        }
    };

    const applyPaste = (withStyles) => {
        if (!pasteModal || !editorRef.current) return;
        editorRef.current.focus();
        if (withStyles) {
            document.execCommand("insertHTML", false, sanitizeDescriptionHtml(pasteModal.html));
        } else {
            document.execCommand("insertHTML", false, sanitizeDescriptionPlain(pasteModal.plain));
        }
        setPasteModal(null);
        syncToParent();
    };

    const insertImageUrl = (url) => {
        if (!url) return;
        const safe = url.replace(/"/g, "&quot;");
        exec("insertHTML", `<img src="${safe}" alt="" style="max-width:100%;height:auto;" />`);
    };

    const insertVideoUrl = (url) => {
        if (!url) return;
        const safe = url.replace(/"/g, "&quot;");
        if (/youtube\.com|youtu\.be/i.test(url)) {
            let embed = url;
            const m = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
            if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
            exec(
                "insertHTML",
                `<div class="ec-prod-embed-video"><iframe src="${embed}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe></div>`
            );
        } else {
            exec(
                "insertHTML",
                `<video src="${safe}" controls style="max-width:100%;"></video>`
            );
        }
    };

    const handleImageFile = async (e) => {
        const file = e.target.files?.[0];
        if (fileRef.current) fileRef.current.value = "";
        if (!file) return;
        try {
            const res = await uploadProductImage(file);
            if (res?.url) insertImageUrl(res.url);
        } catch {
            window.alert("Görsel yüklenemedi");
        }
    };

    const handleAddImage = () => {
        const choice = window.prompt(
            "Görsel URL girin veya boş bırakıp Tamam'a basarak bilgisayardan seçin",
            "https://"
        );
        if (choice === null) return;
        if (choice.trim() && choice !== "https://") {
            insertImageUrl(choice.trim());
        } else {
            fileRef.current?.click();
        }
    };

    const handleAddVideo = () => {
        const url = window.prompt("Video URL (mp4 veya YouTube)");
        if (url?.trim()) insertVideoUrl(url.trim());
    };

    const handleAddLink = () => {
        const url = window.prompt("Bağlantı URL");
        if (url?.trim()) exec("createLink", url.trim());
    };

    const handleAi = async () => {
        if (!aiContext.title?.trim()) {
            window.alert("Önce ürün adı girin");
            return;
        }
        setAiLoading(true);
        try {
            const res = await generateDescription({
                productName: aiContext.title.trim(),
                brand: aiContext.brand || undefined,
                price: aiContext.price || undefined,
            });
            if (res?.description && editorRef.current) {
                editorRef.current.innerHTML = res.description;
                syncToParent();
            }
        } catch (e) {
            window.alert(e.response?.data?.error || "Açıklama oluşturulamadı");
        } finally {
            setAiLoading(false);
        }
    };

    const toggleSource = () => {
        if (!sourceMode) {
            setSourceHtml(editorRef.current?.innerHTML || "");
            setSourceMode(true);
        } else {
            if (editorRef.current) {
                applySanitizedHtml(sourceHtml);
            }
            setSourceMode(false);
        }
    };

    const expanded = editorExpanded || fullscreen;
    const editorSizeClass = [
        expanded && !fullscreen ? "ec-prod-editor--expanded" : "",
        fullscreen ? "ec-prod-editor--fullscreen" : "",
        compact && !expanded ? "ec-prod-editor--compact" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={`ec-prod-rich-editor ${fullscreen ? "ec-prod-rich-editor--fullscreen" : ""} ${className}`.trim()}
        >
            <div className="ec-prod-editor-toolbar">
                {showAi && (
                    <>
                        <button
                            type="button"
                            className="ec-prod-editor-ai"
                            disabled={aiLoading}
                            onClick={handleAi}
                        >
                            <FaMagic /> {aiLoading ? "Oluşturuluyor…" : "Açıklama Oluştur"}
                        </button>
                        <span className="ec-prod-editor-sep" />
                    </>
                )}
                <button type="button" title="Kalın" onClick={() => exec("bold")}>
                    <FaBold />
                </button>
                <button type="button" title="İtalik" onClick={() => exec("italic")}>
                    <FaItalic />
                </button>
                <button type="button" title="Altı çizili" onClick={() => exec("underline")}>
                    <FaUnderline />
                </button>
                <button type="button" title="Üstü çizili" onClick={() => exec("strikeThrough")}>
                    <FaStrikethrough />
                </button>
                <button type="button" title="Biçimi temizle" onClick={() => exec("removeFormat")}>
                    <FaEraser />
                </button>
                <span className="ec-prod-editor-sep" />
                <button type="button" title="Madde işaretli" onClick={() => exec("insertUnorderedList")}>
                    <FaListUl />
                </button>
                <button type="button" title="Numaralı liste" onClick={() => exec("insertOrderedList")}>
                    <FaListOl />
                </button>
                <span className="ec-prod-editor-sep" />
                <button type="button" title="Bağlantı" onClick={handleAddLink}>
                    <FaLink />
                </button>
                <button type="button" title="Görsel" onClick={handleAddImage}>
                    <FaImage />
                </button>
                <button type="button" title="Video" onClick={handleAddVideo}>
                    <FaFilm />
                </button>
                <span className="ec-prod-editor-sep" />
                <button
                    type="button"
                    title="HTML kaynak"
                    className={sourceMode ? "ec-prod-editor-btn--active" : ""}
                    onClick={toggleSource}
                >
                    <FaCode />
                </button>
                <button
                    type="button"
                    title={editorExpanded ? "Daralt" : "Alanı genişlet"}
                    className={editorExpanded && !fullscreen ? "ec-prod-editor-btn--active" : ""}
                    onClick={() => {
                        setEditorExpanded((v) => !v);
                        setFullscreen(false);
                    }}
                >
                    <FaArrowsAltV />
                </button>
                <button
                    type="button"
                    title={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
                    className={fullscreen ? "ec-prod-editor-btn--active" : ""}
                    onClick={() => {
                        setFullscreen((f) => !f);
                        if (!fullscreen) setEditorExpanded(true);
                    }}
                >
                    {fullscreen ? <FaCompress /> : <FaExpand />}
                </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageFile} />

            {sourceMode ? (
                <textarea
                    className={`ec-prod-editor ec-prod-editor--source ${editorSizeClass}`}
                    value={sourceHtml}
                    onChange={(e) => setSourceHtml(e.target.value)}
                    rows={expanded ? 18 : compact ? 8 : 10}
                />
            ) : (
                <div
                    ref={editorRef}
                    className={`ec-prod-editor ec-prod-editor--rich ${editorSizeClass}`}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncToParent}
                    onBlur={syncToParent}
                    onPaste={handlePaste}
                    data-placeholder={placeholder}
                />
            )}

            {pasteModal && (
                <div className="ec-prod-modal-backdrop" onClick={() => setPasteModal(null)}>
                    <div className="ec-prod-paste-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Yapıştırma Uyarısı</h3>
                        <p>
                            Metni, kopyaladığınız metindeki stillerle birlikte mi yapıştırmak istiyorsunuz? Eğer
                            Evet ile devam ederseniz temanızda görünüm bozulabilir.
                        </p>
                        <div className="ec-prod-paste-modal__actions">
                            <button type="button" className="ec-prod-btn" onClick={() => applyPaste(false)}>
                                Hayır
                            </button>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                onClick={() => applyPaste(true)}
                            >
                                Evet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductRichHtmlEditor;
