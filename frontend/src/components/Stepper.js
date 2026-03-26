import React from "react";
import { Stepper as MuiStepper, Step, StepLabel } from "@mui/material";

const Stepper = ({ steps, currentStep }) => {
    if (!steps || steps.length === 0) {
        console.error("🚨 Adım listesi boş veya tanımlı değil!");
        return null;
    }

    return (
        <MuiStepper
            activeStep={currentStep}
            alternativeLabel
            sx={{
                "& .MuiStepIcon-root": { color: "#ccc" }, // Pasif adımlar gri renkli
                "& .Mui-active .MuiStepIcon-root": { color: "#1976d2" }, // Aktif adım mavi renkli
                "& .Mui-completed .MuiStepIcon-root": { color: "#4caf50" }, // Tamamlanan adım yeşil renkli
            }}
        >
            {steps.map((label, index) => (
                <Step key={index}>
                    <StepLabel>{label}</StepLabel>
                </Step>
            ))}
        </MuiStepper>
    );
};

export default Stepper;
