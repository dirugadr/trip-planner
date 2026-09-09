import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const listAccommodations = (tripId) => apiGet(`/accommodations?trip_id=${tripId}`);
export const createAccommodation = (data) => apiPost('/accommodations', data);
export const updateAccommodation = (id, data) => apiPut(`/accommodations/${id}`, data);
export const deleteAccommodation = (id) => apiDelete(`/accommodations/${id}`);
