import { apiPut } from './api.js';

export const updateDay = (id, data) => apiPut(`/days/${id}`, data);
