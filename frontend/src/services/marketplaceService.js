import axios from "./api";

export const getAvailableMarketplaces = async () => {
    const response = await axios.get("/marketplace/available");
    return response.data;
};

export const connectMarketplace = async (data) => {
    const response = await axios.post("/marketplace/connect", data);
    return response.data;
};

export const getUserIntegrations = async () => {
    const response = await axios.get("/marketplace/integrations");
    return response.data;
};

export const deleteIntegration = async (id) => {
    const response = await axios.delete(`/marketplace/delete/${id}`);
    return response.data;
};
