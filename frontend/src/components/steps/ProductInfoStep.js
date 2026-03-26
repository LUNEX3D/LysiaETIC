import React, { useState } from "react";
import { Box, TextField, Typography } from "@mui/material";

const ProductInfoStep = ({ productData, setProductData }) => {
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProductData((prev) => ({
            ...prev,
            [name]: value,
        }));

        // Karakter sınırı ve hata kontrolleri
        if (name === "title" && value.length > 100) {
            setErrors((prev) => ({ ...prev, title: "Ürün başlığı en fazla 100 karakter olabilir." }));
        } else if (name === "description" && value.length > 1000) {
            setErrors((prev) => ({ ...prev, description: "Ürün açıklaması en fazla 1000 karakter olabilir." }));
        } else {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    return (
        <Box sx={{ mt: 2, p: 3, border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>📌 Ürün Bilgileri</Typography>

            {/* Ürün Başlığı */}
            <TextField
                fullWidth
                label="Ürün Başlığı"
                name="title"
                value={productData.title || ""}
                onChange={handleChange}
                error={!!errors.title}
                helperText={errors.title}
                sx={{ mb: 2 }}
            />

            {/* Ürün Açıklaması */}
            <TextField
                fullWidth
                label="Ürün Açıklaması"
                name="description"
                multiline
                rows={4}
                value={productData.description || ""}
                onChange={handleChange}
                error={!!errors.description}
                helperText={errors.description}
                sx={{ mb: 2 }}
            />

            {/* Karakter Sayacı */}
            <Typography sx={{ fontSize: "12px", color: "#777" }}>
                {productData.description ? productData.description.length : 0} / 1000 karakter
            </Typography>
        </Box>
    );
};

export default ProductInfoStep;
