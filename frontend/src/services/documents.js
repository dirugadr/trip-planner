import { apiGet, apiDelete, apiUpload, apiDownloadBlob } from './api.js';

export const listDocuments = (tripId) => apiGet(`/trips/${tripId}/documents`);

export function uploadDocument(tripId, file, { activityId, title } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (activityId) fd.append('activity_id', activityId);
  if (title) fd.append('title', title);
  return apiUpload(`/trips/${tripId}/documents`, fd);
}

export const deleteDocument = (id) => apiDelete(`/documents/${id}`);

/** Fetch the (private) file through the API and trigger a browser download. */
export async function downloadDocument(id, fileName) {
  const blob = await apiDownloadBlob(`/documents/${id}/download`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'documento';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
