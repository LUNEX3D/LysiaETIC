import React, { useRef, useState, useMemo } from "react";

import { FaPlus, FaTimes, FaImage, FaLink, FaUpload, FaFilm, FaMagic, FaEye } from "react-icons/fa";

import { uploadProductImage } from "../../../services/productManagementApi";

import ProductAiImageEditor from "./ProductAiImageEditor";



const MAX_MEDIA = 10;

const ACCEPT =

    "image/jpeg,image/jpg,image/png,image/webp,image/heic,video/mp4,.jpg,.jpeg,.png,.webp,.heic,.mp4";



export const isVideoUrl = (url) =>

    /\.mp4(\?|#|$)/i.test(String(url || "")) || String(url || "").includes("/video");



const normalizeUrl = (raw) => {

    const u = String(raw || "").trim();

    if (!u) return "";

    if (/^https?:\/\//i.test(u) || u.startsWith("/")) return u;

    return `https://${u}`;

};



const ProductMediaSection = ({ form, setForm, visible }) => {

    const fileRef = useRef(null);

    const [urlInput, setUrlInput] = useState("");

    const [uploading, setUploading] = useState(false);

    const [error, setError] = useState("");

    const [dragOver, setDragOver] = useState(false);

    const [editor, setEditor] = useState(null);

    const [previewUrl, setPreviewUrl] = useState(null);



    const images = form.images || [];

    const videos = form.videos || [];

    const totalCount = images.length + videos.length;



    const items = useMemo(

        () => [

            ...images.map((url, index) => ({ url, kind: "image", index })),

            ...videos.map((url, index) => ({ url, kind: "video", index })),

        ],

        [images, videos]

    );



    if (!visible) return null;



    const appendMedia = (url, kind) => {

        if (totalCount >= MAX_MEDIA) {

            setError(`En fazla ${MAX_MEDIA} medya ekleyebilirsiniz.`);

            return;

        }

        if (kind === "video") {

            setForm({ ...form, videos: [...videos, url] });

        } else {

            setForm({ ...form, images: [...images, url] });

        }

        setError("");

    };



    const replaceImage = (index, newUrl) => {

        const next = [...images];

        next[index] = newUrl;

        setForm({ ...form, images: next });

    };



    const insertImageAfter = (index, newUrl) => {

        if (totalCount >= MAX_MEDIA) {

            setError(`En fazla ${MAX_MEDIA} medya ekleyebilirsiniz.`);

            return;

        }

        const next = [...images];

        next.splice(index + 1, 0, newUrl);

        setForm({ ...form, images: next });

    };



    const removeMedia = (kind, index) => {

        if (kind === "video") {

            setForm({ ...form, videos: videos.filter((_, i) => i !== index) });

        } else {

            setForm({ ...form, images: images.filter((_, i) => i !== index) });

        }

    };



    const uploadFiles = async (fileList) => {

        const files = Array.from(fileList || []);

        if (!files.length) return;

        const remain = MAX_MEDIA - totalCount;

        const batch = files.slice(0, remain);

        if (!batch.length) {

            setError(`En fazla ${MAX_MEDIA} medya ekleyebilirsiniz.`);

            return;

        }

        setUploading(true);

        setError("");

        const nextImages = [...images];

        const nextVideos = [...videos];

        try {

            for (const file of batch) {

                if (nextImages.length + nextVideos.length >= MAX_MEDIA) break;

                const tooBig = file.size > 10 * 1024 * 1024;

                if (tooBig) {

                    setError(`${file.name}: dosya 10MB sınırını aşıyor.`);

                    continue;

                }

                const res = await uploadProductImage(file);

                if (res?.url) {

                    const kind = res.kind || (file.type === "video/mp4" ? "video" : "image");

                    if (kind === "video") nextVideos.push(res.url);

                    else nextImages.push(res.url);

                }

            }

            if (nextImages.length !== images.length || nextVideos.length !== videos.length) {

                setForm({ ...form, images: nextImages, videos: nextVideos });

            }

        } catch (e) {

            setError(e.response?.data?.error || "Yükleme başarısız");

        } finally {

            setUploading(false);

            if (fileRef.current) fileRef.current.value = "";

        }

    };



    const handleFileChange = (e) => uploadFiles(e.target.files);



    const handleAddUrl = () => {

        const url = normalizeUrl(urlInput);

        if (!url) return;

        if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {

            setError("Geçerli bir link girin (https://…)");

            return;

        }

        const kind = isVideoUrl(url) ? "video" : "image";

        appendMedia(url, kind);

        setUrlInput("");

    };



    const onDrop = (e) => {

        e.preventDefault();

        setDragOver(false);

        uploadFiles(e.dataTransfer.files);

    };



    return (

        <>

            <section className="ec-prod-section" id="ec-sec-media">

                <div className="ec-prod-section__head">

                    <h3>

                        Medya <FaImage style={{ opacity: 0.45, fontSize: 12 }} />

                    </h3>

                </div>



                <div className="ec-prod-media-toolbar">

                    <input

                        ref={fileRef}

                        type="file"

                        accept={ACCEPT}

                        multiple

                        hidden

                        onChange={handleFileChange}

                    />

                    <button

                        type="button"

                        className="ec-prod-btn ec-prod-btn--primary"

                        disabled={uploading || totalCount >= MAX_MEDIA}

                        onClick={() => fileRef.current?.click()}

                    >

                        <FaUpload /> {uploading ? "Yükleniyor…" : "Bilgisayardan Seç"}

                    </button>

                    <div className="ec-prod-media-url-row">

                        <FaLink className="ec-prod-media-url-icon" />

                        <input

                            type="url"

                            value={urlInput}

                            onChange={(e) => setUrlInput(e.target.value)}

                            placeholder="Görsel veya video linki yapıştırın"

                            onKeyDown={(e) => {

                                if (e.key === "Enter") {

                                    e.preventDefault();

                                    handleAddUrl();

                                }

                            }}

                        />

                        <button

                            type="button"

                            className="ec-prod-btn"

                            disabled={!urlInput.trim() || totalCount >= MAX_MEDIA}

                            onClick={handleAddUrl}

                        >

                            <FaPlus /> Ekle

                        </button>

                    </div>

                </div>



                {error && <div className="ec-prod-form-error ec-prod-media-error">{error}</div>}



                <p className="ec-prod-media-hint">

                    Maksimum 10MB — .jpeg, .jpg, .png, .webp, .heic veya .mp4. Toplam {totalCount}/{MAX_MEDIA}{" "}

                    medya.

                </p>



                <div

                    className={`ec-prod-media-drop ${dragOver ? "ec-prod-media-drop--active" : ""}`}

                    onDragOver={(e) => {

                        e.preventDefault();

                        setDragOver(true);

                    }}

                    onDragLeave={() => setDragOver(false)}

                    onDrop={onDrop}

                >

                    <div className="ec-prod-media-grid ec-prod-media-grid--ikas">

                        {items.map((item) => (

                            <div

                                key={`${item.kind}-${item.index}-${item.url}`}

                                className="ec-prod-media-card"

                            >

                                {item.kind === "video" ? (

                                    <video src={item.url} muted playsInline />

                                ) : (

                                    <img src={item.url} alt="" />

                                )}

                                {item.kind === "image" && (

                                    <>

                                        <button

                                            type="button"

                                            className="ec-prod-media-ai-btn"

                                            onClick={() =>

                                                setEditor({ url: item.url, index: item.index })

                                            }

                                        >

                                            <FaMagic /> AI ile Düzenle

                                        </button>

                                        <div className="ec-prod-media-card-actions">

                                            <button

                                                type="button"

                                                className="ec-prod-media-card-icon"

                                                aria-label="Önizle"

                                                onClick={() => setPreviewUrl(item.url)}

                                            >

                                                <FaEye />

                                            </button>

                                            <button

                                                type="button"

                                                className="ec-prod-media-card-icon"

                                                aria-label="Kaldır"

                                                onClick={() => removeMedia(item.kind, item.index)}

                                            >

                                                <FaTimes />

                                            </button>

                                        </div>

                                    </>

                                )}

                                {item.kind === "video" && (

                                    <>

                                        <span className="ec-prod-media-badge">

                                            <FaFilm />

                                        </span>

                                        <button

                                            type="button"

                                            className="ec-prod-media-remove"

                                            onClick={() => removeMedia(item.kind, item.index)}

                                            aria-label="Kaldır"

                                        >

                                            <FaTimes />

                                        </button>

                                    </>

                                )}

                            </div>

                        ))}

                        {totalCount < MAX_MEDIA && (

                            <button

                                type="button"

                                className="ec-prod-media-add"

                                disabled={uploading}

                                onClick={() => fileRef.current?.click()}

                            >

                                <FaPlus />

                                <span>Ekle</span>

                            </button>

                        )}

                    </div>

                    {totalCount === 0 && !uploading && (

                        <p className="ec-prod-media-drop-hint">

                            Dosyaları buraya sürükleyip bırakabilir veya bilgisayardan seçebilirsiniz.

                        </p>

                    )}

                </div>

            </section>



            {editor && (

                <ProductAiImageEditor

                    imageUrl={editor.url}

                    productTitle={form.title}

                    onClose={() => setEditor(null)}

                    onSave={(newUrl) => {

                        replaceImage(editor.index, newUrl);

                        setEditor(null);

                    }}

                    onSaveAsNew={(newUrl) => {

                        insertImageAfter(editor.index, newUrl);

                        setEditor(null);

                    }}

                />

            )}



            {previewUrl && (

                <div className="ec-prod-modal-backdrop" onClick={() => setPreviewUrl(null)}>

                    <div className="ec-prod-ai-preview" onClick={(e) => e.stopPropagation()}>

                        <button

                            type="button"

                            className="ec-prod-modal__close"

                            onClick={() => setPreviewUrl(null)}

                            aria-label="Kapat"

                        >

                            <FaTimes />

                        </button>

                        <img src={previewUrl} alt="" />

                    </div>

                </div>

            )}

        </>

    );

};



export default ProductMediaSection;

