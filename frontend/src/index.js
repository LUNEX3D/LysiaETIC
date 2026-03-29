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

// ═══════════════════════════════════════════════════════════
// PWA — Service Worker Registration
// ═══════════════════════════════════════════════════════════
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/service-worker.js")
            .then((registration) => {
                console.log("[PWA] Service Worker registered:", registration.scope);

                // Check for updates periodically
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener("statechange", () => {
                            if (
                                newWorker.state === "installed" &&
                                navigator.serviceWorker.controller
                            ) {
                                console.log("[PWA] New content available, refresh to update.");
                            }
                        });
                    }
                });
            })
            .catch((error) => {
                console.log("[PWA] Service Worker registration failed:", error);
            });
    });
}
