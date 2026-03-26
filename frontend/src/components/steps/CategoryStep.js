import React, { useEffect, useState } from "react";
import { Box, FormControl, InputLabel, Select, MenuItem, CircularProgress, Typography } from "@mui/material";
import { getCategories } from "../../services/api"; // API'den kategorileri çekmek için

const CategoryStep = ({ productData, handleChange }) => {
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSubCategory, setSelectedSubCategory] = useState("");
    const [loading, setLoading] = useState(true);

    // Kategorileri API'den çekme
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const data = await getCategories();
                setCategories(data);
            } catch (error) {
                console.error("❌ Kategoriler yüklenirken hata oluştu:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    // Ana kategori değiştiğinde alt kategorileri güncelle
    const handleCategoryChange = (e) => {
        const categoryId = e.target.value;
        const selectedCat = categories.find((cat) => cat.id === categoryId);

        setSelectedCategory(categoryId);
        setSubCategories(selectedCat?.subCategories || []); // Alt kategorileri ayarla
        setSelectedSubCategory(""); // Yeni kategori seçildiğinde alt kategori sıfırlansın

        // Üst bileşene güncellenmiş veriyi bildir
        handleChange({ target: { name: "category", value: categoryId } });
        handleChange({ target: { name: "subCategory", value: "" } }); // Alt kategoriyi sıfırla
    };

    // Alt kategori seçildiğinde veriyi güncelle
    const handleSubCategoryChange = (e) => {
        const subCategoryId = e.target.value;
        setSelectedSubCategory(subCategoryId);
        handleChange(e);
    };

    return (
        <Box sx={{ mt: 2, p: 2, border: "1px solid #ccc", borderRadius: "8px" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>📂 Kategori Seçimi</Typography>

            {loading ? (
                <CircularProgress />
            ) : (
                <>
                    {/* Ana Kategori Seçimi */}
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Ana Kategori</InputLabel>
                        <Select
                            name="category"
                            value={selectedCategory}
                            onChange={handleCategoryChange}
                            label="Ana Kategori"
                        >
                            {categories.map((category) => (
                                <MenuItem key={category.id} value={category.id}>
                                    {category.name} (ID: {category.id})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Alt Kategori Seçimi */}
                    {subCategories.length > 0 && (
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Alt Kategori</InputLabel>
                            <Select
                                name="subCategory"
                                value={selectedSubCategory}
                                onChange={handleSubCategoryChange}
                                label="Alt Kategori"
                            >
                                {subCategories.map((subCategory) => (
                                    <MenuItem key={subCategory.id} value={subCategory.id}>
                                        {subCategory.name} (ID: {subCategory.id})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Seçilen Kategori ve Alt Kategori Bilgisi */}
                    {selectedCategory && (
                        <Typography variant="body1" sx={{ mt: 2, fontWeight: "bold" }}>
                            🏷 Seçilen Kategori ID: {selectedCategory}
                        </Typography>
                    )}
                    {selectedSubCategory && (
                        <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                            🔖 Seçilen Alt Kategori ID: {selectedSubCategory}
                        </Typography>
                    )}
                </>
            )}
        </Box>
    );
};

export default CategoryStep;
