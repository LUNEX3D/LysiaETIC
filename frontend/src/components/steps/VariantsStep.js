import React, { useState } from "react";
import { Box, TextField, Button, Typography, IconButton, List, ListItem, ListItemText } from "@mui/material";
import { Delete } from "@mui/icons-material";

const VariantsStep = ({ productData, setProductData }) => {
    const [variant, setVariant] = useState({ color: "", size: "", barcode: "" });
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setVariant((prev) => ({ ...prev, [name]: value }));

        // Boş giriş kontrolü
        if (!value.trim()) {
            setErrors((prev) => ({ ...prev, [name]: "Bu alan boş bırakılamaz." }));
        } else {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const addVariant = () => {
        // Boş giriş kontrolü
        if (!variant.color || !variant.size || !variant.barcode) {
            setErrors({
                color: !variant.color ? "Renk boş bırakılamaz." : "",
                size: !variant.size ? "Beden boş bırakılamaz." : "",
                barcode: !variant.barcode ? "Barkod boş bırakılamaz." : "",
            });
            return;
        }

        setProductData((prev) => ({
            ...prev,
            variants: [...prev.variants, variant],
        }));

        setVariant({ color: "", size: "", barcode: "" });
    };

    const removeVariant = (index) => {
        setProductData((prev) => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index),
        }));
    };

    return (
        <Box sx={{ mt: 2, p: 3, border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fff" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>🎨 Varyantlar</Typography>

            {/* Renk */}
            <TextField
                fullWidth
                label="Renk"
                name="color"
                value={variant.color}
                onChange={handleChange}
                error={!!errors.color}
                helperText={errors.color}
                sx={{ mb: 2 }}
            />

            {/* Beden */}
            <TextField
                fullWidth
                label="Beden"
                name="size"
                value={variant.size}
                onChange={handleChange}
                error={!!errors.size}
                helperText={errors.size}
                sx={{ mb: 2 }}
            />

            {/* Barkod */}
            <TextField
                fullWidth
                label="Barkod"
                name="barcode"
                value={variant.barcode}
                onChange={handleChange}
                error={!!errors.barcode}
                helperText={errors.barcode}
                sx={{ mb: 2 }}
            />

            {/* Varyant Ekle Butonu */}
            <Button variant="contained" onClick={addVariant} sx={{ mt: 2 }}>
                ➕ Varyant Ekle
            </Button>

            {/* Eklenen Varyantlar */}
            {productData.variants.length > 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6">📌 Eklenen Varyantlar</Typography>
                    <List>
                        {productData.variants.map((v, index) => (
                            <ListItem
                                key={index}
                                secondaryAction={
                                    <IconButton edge="end" onClick={() => removeVariant(index)}>
                                        <Delete />
                                    </IconButton>
                                }
                            >
                                <ListItemText primary={`${v.color} - ${v.size} - ${v.barcode}`} />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}
        </Box>
    );
};

export default VariantsStep;
