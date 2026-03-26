import React from "react";
import { Box, TextField, Typography } from "@mui/material";

const PricingStep = ({ productData, setProductData }) => {
    // Değer değişikliklerinde state güncelleme
    const handleChange = (e) => {
        const { name, value } = e.target;
        setProductData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Komisyon oranı hesaplama (isteğe bağlı)
    const calculateCommission = () => {
        const { price, listPrice } = productData;
        if (!price || !listPrice || listPrice <= price) return "Bilinmiyor";

        const commissionRate = (((listPrice - price) / listPrice) * 100).toFixed(2);
        return `${commissionRate}%`;
    };

    return (
        <Box sx={{ mt: 2, p: 3, border: "1px solid #ccc", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>💰 Fiyatlandırma</Typography>

            {/* Liste Fiyatı (İndirim Öncesi) */}
            <TextField
                fullWidth
                label="Liste Fiyatı (İndirim Öncesi)"
                name="listPrice"
                type="number"
                value={productData.listPrice || ""}
                onChange={handleChange}
                sx={{ mb: 2 }}
            />

            {/* Satış Fiyatı */}
            <TextField
                fullWidth
                label="Satış Fiyatı"
                name="price"
                type="number"
                value={productData.price || ""}
                onChange={handleChange}
                sx={{ mb: 2 }}
            />

            {/* Stok Adedi */}
            <TextField
                fullWidth
                label="Stok Adedi"
                name="stock"
                type="number"
                value={productData.stock || ""}
                onChange={handleChange}
                sx={{ mb: 2 }}
            />

            {/* Komisyon Oranı */}
            <Typography sx={{ mt: 2, fontWeight: "bold" }}>
                🏷️ Hesaplanan Komisyon Oranı: {calculateCommission()}
            </Typography>
        </Box>
    );
};

export default PricingStep;
