import React from "react";
import { Box, Typography, Button } from "@mui/material";

const HomePage = () => {
    return (
        <Box sx={{ textAlign: "center", mt: 10 }}>
            <Typography variant="h3" gutterBottom>
                Hoş Geldiniz!
            </Typography>
            <Typography variant="h5" gutterBottom>
                Ürün yönetim sistemine erişmek için lütfen giriş yapın veya kayıt olun.
            </Typography>
            <Button variant="contained" href="/login" sx={{ mr: 2 }}>
                Giriş Yap
            </Button>
            <Button variant="outlined" href="/register">
                Kayıt Ol
            </Button>
        </Box>
    );
};

export default HomePage;