import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from './api.js';

export const listPoiCategories = () => apiGet('/poi-categories');
export const listPois = (tripId) => apiGet(`/trips/${tripId}/pois`);
export const createPoi = (tripId, data) => apiPost(`/trips/${tripId}/pois`, data);
export const updatePoi = (id, data) => apiPut(`/pois/${id}`, data);
export const deletePoi = (id) => apiDelete(`/pois/${id}`);

export function uploadPoiPhoto(id, file) {
  const fd = new FormData();
  fd.append('file', file);
  return apiUpload(`/pois/${id}/photo`, fd);
}
