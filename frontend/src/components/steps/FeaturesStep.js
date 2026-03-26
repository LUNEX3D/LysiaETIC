import React, { useState } from "react";
import { Box, TextField, Button, Typography, IconButton, List, ListItem, ListItemText } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const FeaturesStep = ({ productData, setProductData }) => {
    const [feature, setFeature] = useState({ key: "", value: "" });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFeature((prev) => ({ ...prev, [name]: value }));
    };

    const addFeature = () => {
        if (!feature.key.trim() || !feature.value.trim()) {
            alert("⚠ Özellik adı ve değeri boş olamaz!");
            return;
        }

        setProductData((prev) => ({
            ...prev,
            features: [...prev.features, feature],
        }));

        setFeature({ key: "", value: "" }); // Alanları temizle
    };

    const removeFeature = (index) => {
        setProductData((prev) => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index),
        }));
    };

    return (
        <Box sx={{ mt: 2, p: 3, border: "1px solid #ccc", borderRadius: "8px" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>⚙ Ürün Özellikleri</Typography>

            {/* Özellik Adı */}
            <TextField
                fullWidth
                label="Özellik Adı"
                name="key"
                value={feature.key}
                onChange={handleChange}
                sx={{ mb: 2 }}
            />

            {/* Özellik Değeri */}
            <TextField
                fullWidth
                label="Özellik Değeri"
                name="value"
                value={feature.value}
                onChange={handleChange}
                sx={{ mb: 2 }}
            />

            {/* Özellik Ekle Butonu */}
            <Button variant="contained" color="primary" onClick={addFeature} sx={{ mb: 2 }}>
                + Özellik Ekle
            </Button>

            {/* Eklenen Özellikler Listesi */}
            {productData.features.length > 0 && (
                <List sx={{ mt: 2 }}>
                    {productData.features.map((f, index) => (
                        <ListItem
                            key={index}
                            secondaryAction={
                                <IconButton edge="end" color="error" onClick={() => removeFeature(index)}>
                                    <DeleteIcon />
                                </IconButton>
                            }
                        >
                            <ListItemText primary={`${f.key}: ${f.value}`} />
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
};

export default FeaturesStep;
