import React, { useRef, useState, useEffect, useCallback } from "react";
import {
    FaTimes,
    FaMagic,
    FaCrop,
    FaEraser,
    FaLayerGroup,
    FaExpand,
    FaUndo,
    FaRedo,
    FaSearchPlus,
    FaSearchMinus,
} from "react-icons/fa";
import { editProductImageAi, uploadProductImage } from "../../../services/productManagementApi";
import {
    inpaintFromMask,
    maskCanvasFromStrokes,
    upscaleCanvas,
    canvasToBlob,
    removeBackgroundClient,
} from "../../../utils/canvasInpaint";

const ASPECTS = [
    { id: "free", label: "Serbest", ratio: null },
    { id: "1:1", label: "1:1", ratio: 1 },
    { id: "16:9", label: "16:9", ratio: 16 / 9 },
    { id: "4:3", label: "4:3", ratio: 4 / 3 },
];

const ProductAiImageEditor = ({ imageUrl, productTitle, onClose, onSave, onSaveAsNew }) => {
    const imgRef = useRef(null);
    const wrapRef = useRef(null);
    const workCanvasRef = useRef(null);

    const [currentUrl, setCurrentUrl] = useState(imageUrl);
    const [history, setHistory] = useState([imageUrl]);
    const [historyIdx, setHistoryIdx] = useState(0);
    const [activeTool, setActiveTool] = useState(null);
    const [brushSize, setBrushSize] = useState(28);
    const [strokes, setStrokes] = useState([]);
    const [currentStroke, setCurrentStroke] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const [zoom, setZoom] = useState(100);
    const [natural, setNatural] = useState({ w: 0, h: 0 });
    const [cropAspect, setCropAspect] = useState("free");
    const [cropRect, setCropRect] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

    const pushUrl = useCallback((url) => {
        setCurrentUrl(url);
        setHistoryIdx((idx) => {
            setHistory((prev) => [...prev.slice(0, idx + 1), url]);
            return idx + 1;
        });
    }, []);

    const undo = () => {
        setHistory((h) => {
            setHistoryIdx((idx) => {
                if (idx <= 0) return idx;
                const next = idx - 1;
                setCurrentUrl(h[next]);
                return next;
            });
            return h;
        });
    };

    const redo = () => {
        setHistory((h) => {
            setHistoryIdx((idx) => {
                if (idx >= h.length - 1) return idx;
                const next = idx + 1;
                setCurrentUrl(h[next]);
                return next;
            });
            return h;
        });
    };

    const loadImageToCanvas = useCallback(async (url) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
        const canvas = workCanvasRef.current || document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        workCanvasRef.current = canvas;
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        return canvas;
    }, []);

    const uploadCanvas = async (canvas) => {
        const blob = await canvasToBlob(canvas);
        const file = new File([blob], "edited.png", { type: "image/png" });
        const res = await uploadProductImage(file);
        if (!res?.url) throw new Error("Kayıt başarısız");
        return res.url;
    };

    const runServerOrClient = async (action, extra = {}) => {
        setProcessing(true);
        setError("");
        try {
            const res = await editProductImageAi({
                imageUrl: currentUrl,
                action,
                maskBase64: extra.maskBase64,
            });
            if (res.url) {
                pushUrl(res.url);
                setStrokes([]);
                setCurrentStroke(null);
                return;
            }
            if (res.useClient) {
                const canvas = await loadImageToCanvas(currentUrl);
                if (action === "upscale") {
                    const up = upscaleCanvas(canvas, res.scale || 2);
                    const url = await uploadCanvas(up);
                    pushUrl(url);
                } else if (action === "remove_bg") {
                    const blob = await removeBackgroundClient(currentUrl);
                    const url = await uploadCanvas(await blobToCanvas(blob));
                    pushUrl(url);
                } else if (action === "remove_object" && extra.maskCanvas) {
                    inpaintFromMask(canvas, extra.maskCanvas);
                    const url = await uploadCanvas(canvas);
                    pushUrl(url);
                }
                setStrokes([]);
                setCurrentStroke(null);
                return;
            }
            throw new Error(res.message || "İşlem tamamlanamadı");
        } catch (e) {
            setError(e.response?.data?.error || e.message || "İşlem başarısız");
        } finally {
            setProcessing(false);
        }
    };

    async function blobToCanvas(blob) {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        return canvas;
    }

    const handleRemoveBg = () => runServerOrClient("remove_bg");
    const handleUpscale = () => runServerOrClient("upscale");

    const handleObjectRemove = async () => {
        if (!strokes.length && !currentStroke) {
            setError("Kaldırmak istediğiniz alanı fırçayla boyayın");
            return;
        }
        const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
        if (!natural.w) await loadImageToCanvas(currentUrl);
        const maskCanvas = maskCanvasFromStrokes(natural.w, natural.h, allStrokes, brushSize);
        const maskBase64 = maskCanvas.toDataURL("image/png");
        await runServerOrClient("remove_object", { maskBase64, maskCanvas });
    };

    const applyCrop = async () => {
        setProcessing(true);
        setError("");
        try {
            const canvas = await loadImageToCanvas(currentUrl);
            const x = Math.round(cropRect.x * canvas.width);
            const y = Math.round(cropRect.y * canvas.height);
            const w = Math.round(cropRect.w * canvas.width);
            const h = Math.round(cropRect.h * canvas.height);
            const cropped = document.createElement("canvas");
            cropped.width = w;
            cropped.height = h;
            cropped.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
            const url = await uploadCanvas(cropped);
            pushUrl(url);
            setActiveTool(null);
        } catch (e) {
            setError(e.message || "Kırpma başarısız");
        } finally {
            setProcessing(false);
        }
    };

    const pointerToImage = (e) => {
        const img = imgRef.current;
        if (!img || !natural.w) return null;
        const rect = img.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * natural.w;
        const y = ((e.clientY - rect.top) / rect.height) * natural.h;
        return { x, y };
    };

    const onPointerDown = (e) => {
        if (activeTool !== "object") return;
        e.preventDefault();
        const p = pointerToImage(e);
        if (!p) return;
        setCurrentStroke([p]);
    };

    const onPointerMove = (e) => {
        if (activeTool !== "object" || !currentStroke) return;
        const p = pointerToImage(e);
        if (!p) return;
        setCurrentStroke((s) => [...s, p]);
    };

    const onPointerUp = () => {
        if (!currentStroke?.length) return;
        setStrokes((s) => [...s, currentStroke]);
        setCurrentStroke(null);
    };

    useEffect(() => {
        loadImageToCanvas(currentUrl).catch(() => {});
    }, [currentUrl, loadImageToCanvas]);

    useEffect(() => {
        const ar = ASPECTS.find((a) => a.id === cropAspect)?.ratio;
        if (!ar || !natural.w) return;
        let w = 0.8;
        let h = w / ar * (natural.w / natural.h);
        if (h > 0.9) {
            h = 0.9;
            w = h * ar * (natural.h / natural.w);
        }
        setCropRect({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
    }, [cropAspect, natural]);

    const maskOverlay =
        activeTool === "object" && natural.w > 0 ? (
            <svg
                className="ec-prod-ai-mask-svg"
                viewBox={`0 0 ${natural.w} ${natural.h}`}
                preserveAspectRatio="xMidYMid meet"
            >
                {[...strokes, currentStroke].filter(Boolean).map((stroke, si) => (
                    <polyline
                        key={si}
                        fill="none"
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={brushSize}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                    />
                ))}
            </svg>
        ) : null;

    const cropOverlay =
        activeTool === "crop" ? (
            <div
                className="ec-prod-ai-crop-box"
                style={{
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.w * 100}%`,
                    height: `${cropRect.h * 100}%`,
                }}
            />
        ) : null;

    return (
        <div className="ec-prod-ai-editor">
            <header className="ec-prod-ai-editor__head">
                <div className="ec-prod-ai-editor__breadcrumb">
                    <button type="button" className="ec-prod-ai-back" onClick={onClose}>
                        ←
                    </button>
                    <span>
                        {productTitle || "Ürün"} &gt; <strong>AI ile Düzenle</strong>
                    </span>
                </div>
                <div className="ec-prod-ai-editor__actions">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Kapat
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn"
                        disabled={processing}
                        onClick={() => onSaveAsNew(currentUrl)}
                    >
                        Yeni Görsel Olarak Kaydet
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={processing}
                        onClick={() => onSave(currentUrl)}
                    >
                        Kaydet
                    </button>
                </div>
            </header>

            <div className="ec-prod-ai-editor__body">
                <aside className="ec-prod-ai-tools">
                    <button
                        type="button"
                        className={`ec-prod-ai-tool ${activeTool === "crop" ? "ec-prod-ai-tool--active" : ""}`}
                        onClick={() => setActiveTool(activeTool === "crop" ? null : "crop")}
                    >
                        <FaCrop /> Kırp
                    </button>
                    <button
                        type="button"
                        className={`ec-prod-ai-tool ${activeTool === "object" ? "ec-prod-ai-tool--active" : ""}`}
                        onClick={() => setActiveTool(activeTool === "object" ? null : "object")}
                    >
                        <FaEraser /> Nesne Kaldır
                    </button>
                    <button
                        type="button"
                        className="ec-prod-ai-tool"
                        disabled={processing}
                        onClick={handleRemoveBg}
                    >
                        <FaLayerGroup /> Arka Planı Kaldır
                    </button>
                    <button
                        type="button"
                        className="ec-prod-ai-tool"
                        disabled={processing}
                        onClick={handleUpscale}
                    >
                        <FaExpand /> Yüksek Çözünürlük
                    </button>

                    {activeTool === "object" && (
                        <div className="ec-prod-ai-tool-panel">
                            <label className="ec-prod-ai-brush-label">Fırça boyutu</label>
                            <input
                                type="range"
                                min={8}
                                max={96}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                            />
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary ec-prod-ai-scan-btn"
                                disabled={processing}
                                onClick={handleObjectRemove}
                            >
                                Tarama yapın
                            </button>
                            <button
                                type="button"
                                className="ec-prod-btn"
                                onClick={() => {
                                    setStrokes([]);
                                    setCurrentStroke(null);
                                }}
                            >
                                Vazgeç
                            </button>
                        </div>
                    )}

                    {activeTool === "crop" && (
                        <div className="ec-prod-ai-tool-panel">
                            <p className="ec-prod-io-label">En-boy oranı</p>
                            <div className="ec-prod-ai-aspects">
                                {ASPECTS.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        className={
                                            cropAspect === a.id ? "ec-prod-ai-aspect--active" : ""
                                        }
                                        onClick={() => setCropAspect(a.id)}
                                    >
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={processing}
                                onClick={applyCrop}
                            >
                                Kırpmayı uygula
                            </button>
                            <button type="button" className="ec-prod-btn" onClick={() => setActiveTool(null)}>
                                Vazgeç
                            </button>
                        </div>
                    )}
                </aside>

                <div className="ec-prod-ai-canvas-wrap" ref={wrapRef}>
                    {error && <div className="ec-prod-form-error ec-prod-ai-error">{error}</div>}
                    {processing && (
                        <div className="ec-prod-ai-loading">
                            <FaMagic /> İşleniyor…
                        </div>
                    )}
                    <div
                        className="ec-prod-ai-stage"
                        style={{ transform: `scale(${zoom / 100})` }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                    >
                        <img ref={imgRef} src={currentUrl} alt="" className="ec-prod-ai-image" crossOrigin="anonymous" />
                        {maskOverlay}
                        {cropOverlay}
                    </div>
                </div>
            </div>

            <footer className="ec-prod-ai-editor__foot">
                <button type="button" className="ec-prod-icon-btn" onClick={undo} disabled={historyIdx <= 0}>
                    <FaUndo />
                </button>
                <button
                    type="button"
                    className="ec-prod-icon-btn"
                    onClick={redo}
                    disabled={historyIdx >= history.length - 1}
                >
                    <FaRedo />
                </button>
                <span className="ec-prod-ai-foot-spacer" />
                <button type="button" className="ec-prod-icon-btn" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
                    <FaSearchMinus />
                </button>
                <span className="ec-prod-ai-zoom">{zoom}%</span>
                <button type="button" className="ec-prod-icon-btn" onClick={() => setZoom((z) => Math.min(200, z + 10))}>
                    <FaSearchPlus />
                </button>
            </footer>
        </div>
    );
};

export default ProductAiImageEditor;
