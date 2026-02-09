import api from "./api";

const list = ({ protocolId, userId, status, pageNumber }) => {
    return api.get("/activities", {
        params: { protocolId, userId, status, pageNumber }
    });
};

const show = (id) => {
    return api.get(`/activities/${id}`);
};

const create = (data) => {
    return api.post("/activities", data);
};

const update = (id, data) => {
    return api.put(`/activities/${id}`, data);
};

const updateItem = (activityId, itemId, data) => {
    return api.put(`/activities/${activityId}/items/${itemId}`, data);
};

const uploadPhoto = (activityId, itemId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/activities/${activityId}/items/${itemId}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
};

const addMaterial = (id, data) => {
    return api.post(`/activities/${id}/materials`, data);
};

const finalize = (id, signatures) => {
    return api.post(`/activities/${id}/finalize`, signatures);
};

const remove = (id) => {
    return api.delete(`/activities/${id}`);
};

// Returns a Blob object
const generatePdf = async (id) => {
    const { data } = await api.get(`/activities/${id}/pdf`, {
        responseType: "blob"
    });
    return data;
};

const listTemplates = (params) => {
    return api.get("/activity-templates", { params });
};

const activityApi = {
    list,
    show,
    create,
    update,
    updateItem,
    uploadPhoto,
    addMaterial,
    finalize,
    remove,
    generatePdf,
    listTemplates,
    showTemplate: (id) => api.get(`/activity-templates/${id}`),
    createTemplate: (data) => api.post("/activity-templates", data),
    updateTemplate: (id, data) => api.put(`/activity-templates/${id}`, data),
    deleteTemplate: (id) => api.delete(`/activity-templates/${id}`)
};

export default activityApi;
