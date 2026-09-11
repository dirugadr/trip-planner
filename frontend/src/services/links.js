import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const listLinks = (tripId, tags = []) => {
  const qs = tags.length > 0 ? `?tags=${encodeURIComponent(tags.join(','))}` : '';
  return apiGet(`/trips/${tripId}/links${qs}`);
};
export const listTags = (tripId) => apiGet(`/trips/${tripId}/tags`);
export const createLink = (tripId, data) => apiPost(`/trips/${tripId}/links`, data);
export const updateLink = (id, data) => apiPut(`/links/${id}`, data);
export const deleteLink = (id) => apiDelete(`/links/${id}`);
