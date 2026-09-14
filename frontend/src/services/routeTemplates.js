import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const listRouteTemplates = (tripId) => apiGet(`/trips/${tripId}/route-templates`);

export const createRouteTemplate = (tripId, name, poiIds) =>
  apiPost(`/trips/${tripId}/route-templates`, { name, poi_ids: poiIds });

export const updateRouteTemplate = (id, name, poiIds) =>
  apiPut(`/route-templates/${id}`, { name, poi_ids: poiIds });

export const deleteRouteTemplate = (id) => apiDelete(`/route-templates/${id}`);

export const previewRouteDuration = (tripId, poiIds) =>
  apiPost(`/trips/${tripId}/route-templates/preview`, { poi_ids: poiIds });

export const smartOrderPois = (tripId, poiIds) =>
  apiPost(`/trips/${tripId}/route-templates/smart-order`, { poi_ids: poiIds });

export const applyRouteTemplate = (id, dayId, startTime) =>
  apiPost(`/route-templates/${id}/apply`, { day_id: dayId, start_time: startTime });
