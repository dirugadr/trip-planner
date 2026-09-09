import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const listTrips = () => apiGet('/trips');

export const getTrip = (id) => apiGet(`/trips/${id}`);

export const createTrip = (data) => apiPost('/trips', data);

export const updateTrip = (id, data) => apiPut(`/trips/${id}`, data);

export const deleteTrip = (id) => apiDelete(`/trips/${id}`);
