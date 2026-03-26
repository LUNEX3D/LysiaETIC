import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

const theme = createTheme({
    palette: {
        primary: { main: "#4a148c" },
        secondary: { main: "#6a1b9a" },
    },
    typography: { fontFamily: "Inter, sans-serif" },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <React.StrictMode>
                <App />
            </React.StrictMode>
        </LocalizationProvider>
    </ThemeProvider>
);
