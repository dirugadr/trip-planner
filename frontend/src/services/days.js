import { apiGet, apiPut } from './api.js';

export const updateDay = (id, data) => apiPut(`/days/${id}`, data);

export const getDayRouteView = (dayId) => apiGet(`/days/${dayId}/route-view`);
