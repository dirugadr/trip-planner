import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const getActivity = (id) => apiGet(`/activities/${id}`);

export const createActivity = (data) => apiPost('/activities', data);

export const updateActivity = (id, data) => apiPut(`/activities/${id}`, data);

export const deleteActivity = (id) => apiDelete(`/activities/${id}`);

export const moveActivity = (id, direction) => apiPost(`/activities/${id}/move`, { direction });
