import React, { useState } from "react";
import { Box, TextField, Typography } from "@mui/material";

const ProductDetailsStep = ({ productData, setProductData }) => {
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProductData((prev) => ({
            ...prev,
            [name]: value,
        }));

        // Karakter sınırlaması ve boş alan kontrolü
        if (name === "title" && value.length > 100) {
            setErrors((prev) => ({ ...prev, title: "Ürün başlığı 100 karakteri geçemez." }));
        } else if (name === "description" && value.length > 1000) {
            setErrors((prev) => ({ ...prev, description: "Ürün açıklaması 1000 karakteri geçemez." }));
        } else {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    return (
        <Box sx={{ mt: 2, p: 3, border: "1px solid #ccc", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>📌 Ürün Detayları</Typography>

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

            {/* Karakter sayısını gösterme */}
            <Typography sx={{ fontSize: "12px", color: "#666" }}>
                {productData.description ? productData.description.length : 0} / 1000 karakter
            </Typography>
        </Box>
    );
};

export default ProductDetailsStep;
