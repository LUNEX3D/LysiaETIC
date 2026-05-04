import React from "react";
import ProductUploadWizard from "./ProductUploadWizard";

const ProductUploadPage = () => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    return <ProductUploadWizard userId={userId} />;
};

export default ProductUploadPage;
