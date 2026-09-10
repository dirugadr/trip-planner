import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

export const listActivityPois = (activityId) => apiGet(`/activities/${activityId}/pois`);

export const associatePoi = (activityId, poiId) =>
  apiPost(`/activities/${activityId}/pois`, { poi_id: poiId });

export const associateNewPoi = (activityId, data) =>
  apiPost(`/activities/${activityId}/pois/new`, data);

export const reorderActivityPois = (activityId, poiIds) =>
  apiPut(`/activities/${activityId}/pois/reorder`, { poi_ids: poiIds });

export const dissociatePoi = (activityId, poiId) =>
  apiDelete(`/activities/${activityId}/pois/${poiId}`);
