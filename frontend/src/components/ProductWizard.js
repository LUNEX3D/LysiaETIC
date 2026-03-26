import React, { useState } from "react";
import { Box, Stepper, Step, StepLabel, Button, Paper, Typography, Snackbar, Alert } from "@mui/material";
import CategoryStep from "./steps/CategoryStep";
import ProductInfoStep from "./steps/ProductInfoStep";
import ProductDetailsStep from "./steps/ProductDetailsStep";
import VariantsStep from "./steps/VariantsStep";
import PricingStep from "./steps/PricingStep";
import FeaturesStep from "./steps/FeaturesStep";
import ImagesStep from "./steps/ImagesStep";

const steps = [
    { label: "Kategori Seç", component: CategoryStep },
    { label: "Ürün Bilgileri", component: ProductInfoStep },
    { label: "Ürün Detayları", component: ProductDetailsStep },
    { label: "Ürün Varyantları", component: VariantsStep },
    { label: "Fiyat ve Stok", component: PricingStep },
    { label: "Ürün Özellikleri", component: FeaturesStep },
    { label: "Fotoğraflar", component: ImagesStep },
];

const ProductWizard = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [productData, setProductData] = useState({
        category: "",
        subCategory: "",
        title: "",
        description: "",
        variants: [],
        price: "",
        stock: "",
        features: [],
        images: [],
    });

    const [error, setError] = useState("");
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    const handleNext = () => {
        if (!validateStep(activeStep)) {
            setSnackbarOpen(true);
            return;
        }
        setActiveStep((prevStep) => prevStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProductData((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = (acceptedFiles) => {
        setProductData((prev) => ({ ...prev, images: [...prev.images, ...acceptedFiles] }));
    };

    const validateStep = (step) => {
        switch (step) {
            case 0:
                if (!productData.category || !productData.subCategory) {
                    setError("Kategori ve Alt Kategori seçilmelidir.");
                    return false;
                }
                break;
            case 1:
                if (!productData.title || !productData.description) {
                    setError("Ürün başlığı ve açıklaması girilmelidir.");
                    return false;
                }
                break;
            case 4:
                if (!productData.price || !productData.stock) {
                    setError("Fiyat ve stok bilgisi girilmelidir.");
                    return false;
                }
                break;
            case 6:
                if (productData.images.length === 0) {
                    setError("En az bir ürün görseli yüklenmelidir.");
                    return false;
                }
                break;
            default:
                setError("");
        }
        return true;
    };

    const getStepContent = (step) => {
        const StepComponent = steps[step].component;
        return (
            <StepComponent
                productData={productData}
                setProductData={setProductData}
                handleChange={handleChange}
                handleImageUpload={handleImageUpload}
            />
        );
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    return (
        <Paper elevation={3} sx={{ p: 4, backgroundColor: "#f9f9f9", borderRadius: "10px" }}>
            <Typography variant="h5" sx={{ textAlign: "center", mb: 3 }}>🛍️ Ürün Yükleme Sihirbazı</Typography>
            <Stepper activeStep={activeStep} alternativeLabel>
                {steps.map((step, index) => (
                    <Step key={index}>
                        <StepLabel>{step.label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            <Box sx={{ mt: 4 }}>
                {getStepContent(activeStep)}
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
                    <Button disabled={activeStep === 0} onClick={handleBack} variant="outlined">
                        ⬅️ Geri
                    </Button>
                    <Button variant="contained" onClick={handleNext}>
                        {activeStep === steps.length - 1 ? "✅ Ürünü Yükle" : "➡️ İleri"}
                    </Button>
                </Box>
            </Box>

            {/* Hata mesajlarını göstermek için Snackbar */}
            <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleSnackbarClose}>
                <Alert onClose={handleSnackbarClose} severity="error">
                    {error}
                </Alert>
            </Snackbar>
        </Paper>
    );
};

export default ProductWizard;
