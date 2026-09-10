import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const listPoiCategories = () => apiGet('/poi-categories');
export const listPois = (tripId) => apiGet(`/trips/${tripId}/pois`);
export const createPoi = (tripId, data) => apiPost(`/trips/${tripId}/pois`, data);
export const updatePoi = (id, data) => apiPut(`/pois/${id}`, data);
export const deletePoi = (id) => apiDelete(`/pois/${id}`);
