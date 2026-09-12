import { put, get, del } from '@vercel/blob';
import config from '../config/index.js';

const token = () => config.blob.token;

/** Upload a buffer to the Blob store. Private by default (Documents: personal
 * travel files, streamed back through our own auth gate — see streamBlob()).
 * Pass `{ access: 'public' }` for content meant to be hotlinked directly
 * (e.g. POI photos rendered as plain <img> tags across the app) — a private
 * blob's URL 403s on a direct unauthenticated fetch, confirmed live. */
export function uploadBlob(pathname, buffer, contentType, { access = 'private' } = {}) {
  return put(pathname, buffer, {
    access,
    token: token(),
    contentType,
    addRandomSuffix: true,
  });
}

/** Open a read stream for a stored blob (private). Returns { stream, blob } or null. */
export async function streamBlob(url) {
  const res = await get(url, { access: 'private', token: token() });
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, blob: res.blob };
}

/** Delete a blob by URL. Swallows "already gone". */
export async function deleteBlob(url) {
  try {
    await del(url, { token: token() });
  } catch (err) {
    // A missing blob is fine — we're deleting anyway.
    if (err?.name !== 'BlobNotFoundError') throw err;
  }
}
