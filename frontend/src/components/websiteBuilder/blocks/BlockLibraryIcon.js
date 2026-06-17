import React from "react";
import { WidgetsOutlined } from "@mui/icons-material";
import * as MuiIcons from "@mui/icons-material";

export default function BlockLibraryIcon({ name, sx, fontSize = "small" }) {
    const Icon = (name && MuiIcons[name]) ? MuiIcons[name] : WidgetsOutlined;
    return <Icon sx={sx} fontSize={fontSize} />;
}
