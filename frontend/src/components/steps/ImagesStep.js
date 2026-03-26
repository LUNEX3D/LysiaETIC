import React, { useState } from "react";
import { Box, Button, Typography, IconButton, TextField } from "@mui/material";
import { useDropzone } from "react-dropzone";
import { PhotoCamera, Delete } from "@mui/icons-material";

const MAX_IMAGES = 8; // Maksimum yüklenebilir resim sayısı

const ImagesStep = ({ productData, setProductData }) => {
    const [imageUrl, setImageUrl] = useState(""); // URL'den görsel ekleme için state

    const { getRootProps, getInputProps } = useDropzone({
        accept: "image/*",
        onDrop: (acceptedFiles) => {
            if (productData.images.length + acceptedFiles.length > MAX_IMAGES) {
                alert(`⚠ Maksimum ${MAX_IMAGES} adet görsel yükleyebilirsiniz.`);
                return;
            }

            const newImages = acceptedFiles.map((file) => Object.assign(file, {
                preview: URL.createObjectURL(file),
            }));

            setProductData((prev) => ({
                ...prev,
                images: [...prev.images, ...newImages],
            }));
        },
    });

    // Görseli kaldırma fonksiyonu
    const removeImage = (index) => {
        setProductData((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
        }));
    };

    // URL'den görsel ekleme fonksiyonu
    const addImageFromUrl = () => {
        if (!imageUrl.trim()) {
            alert("⚠ URL boş olamaz!");
            return;
        }

        if (productData.images.length >= MAX_IMAGES) {
            alert(`⚠ Maksimum ${MAX_IMAGES} adet görsel yükleyebilirsiniz.`);
            return;
        }

        setProductData((prev) => ({
            ...prev,
            images: [...prev.images, { preview: imageUrl, isUrl: true }],
        }));

        setImageUrl(""); // URL alanını temizle
    };

    return (
        <Box sx={{ mt: 2, p: 3, border: "1px solid #ccc", borderRadius: "8px", textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>📷 Ürün Görselleri</Typography>

            {/* Görsel Yükleme Alanı */}
            <Box
                {...getRootProps()}
                sx={{
                    border: "2px dashed #aaa",
                    p: 4,
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: "#f9f9f9",
                }}
            >
                <input {...getInputProps()} />
                <PhotoCamera sx={{ fontSize: 40, color: "#555" }} />
                <Typography sx={{ mt: 1 }}>Fotoğrafları sürükleyip bırakın veya tıklayarak seçin.</Typography>
            </Box>

            {/* URL'den Görsel Ekleme Alanı */}
            <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                <TextField
                    fullWidth
                    label="Görsel URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    sx={{ flexGrow: 1 }}
                />
                <Button variant="contained" color="primary" onClick={addImageFromUrl}>
                    URL'den Ekle
                </Button>
            </Box>

            {/* Yüklenen Görsellerin Önizlemesi */}
            {productData.images.length > 0 && (
                <Box sx={{ mt: 3, display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                    {productData.images.map((image, index) => (
                        <Box key={index} sx={{ position: "relative", width: "120px" }}>
                            <img
                                src={image.preview}
                                alt={`Ürün ${index + 1}`}
                                style={{
                                    width: "100%",
                                    height: "100px",
                                    objectFit: "cover",
                                    borderRadius: "5px",
                                }}
                            />
                            <IconButton
                                onClick={() => removeImage(index)}
                                sx={{
                                    position: "absolute",
                                    top: 2,
                                    right: 2,
                                    backgroundColor: "rgba(255, 255, 255, 0.7)",
                                }}
                            >
                                <Delete color="error" />
                            </IconButton>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default ImagesStep;
