import { apiPost } from './api.js';

export const getSmartRoute = (dayId) => apiPost(`/days/${dayId}/smart-route`, {});

export const applySmartRoute = (dayId, order) =>
  apiPost(`/days/${dayId}/smart-route/apply`, { order });
